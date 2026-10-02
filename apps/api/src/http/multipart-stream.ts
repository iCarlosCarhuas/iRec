import { UnprocessableEntityException } from '@nestjs/common';

// Zero-dependency streaming multipart parser (multipart/form-data only).
//
// The parser yields field values and file bytes as they arrive: file content
// is forwarded in bounded slices and never accumulated, so a 100MB video
// passes through with a small constant memory footprint. Callers apply
// backpressure naturally by awaiting between pulls (e.g. a Drive chunk PUT).
//
// Contract: text fields are expected before the single `file` part. A file
// part that arrives before validation runs cannot be rewound, so callers
// validate heads/declared fields the moment `fileStart` is yielded.

export interface MultipartFileHead {
  fieldName: string;
  filename: string;
  mimeType: string;
}

export type MultipartParseEvent =
  | { kind: 'field'; name: string; value: string }
  | { kind: 'fileStart'; head: MultipartFileHead }
  | { kind: 'chunk'; data: Buffer }
  | { kind: 'fileEnd'; bytes: number }
  | { kind: 'done' };

export interface MultipartParserLimits {
  maxFields: number;
  maxFieldBytes: number;
  maxHeaderBytes: number;
}

export const DEFAULT_MULTIPART_LIMITS: MultipartParserLimits = {
  maxFields: 10,
  maxFieldBytes: 4096,
  maxHeaderBytes: 16384,
};

const HEADER_END = Buffer.from('\r\n\r\n');

export function extractMultipartBoundary(
  contentType: string | undefined,
): string | null {
  if (!contentType) return null;
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (match?.[1] ?? match?.[2] ?? '').trim();
  if (!boundary || boundary.length > 1024 || /[\r\n]/.test(boundary)) {
    return null;
  }
  return boundary;
}

export function validationError(detail: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    type: 'https://irec.app/problems/validation-error',
    title: 'Validation error',
    status: 422,
    detail,
  });
}

interface PartHeaders {
  name: string;
  filename: string | null;
  mimeType: string;
}

function parsePartHeaders(text: string): PartHeaders {
  let name: string | null = null;
  let filename: string | null = null;
  let mimeType = 'text/plain';
  for (const line of text.split('\r\n')) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const headerName = line.slice(0, separator).trim().toLowerCase();
    const headerValue = line.slice(separator + 1).trim();
    if (headerName === 'content-disposition') {
      const nameMatch = /name="([^"]*)"/i.exec(headerValue);
      if (nameMatch) name = nameMatch[1] ?? null;
      const fileMatch = /filename="([^"]*)"/i.exec(headerValue);
      if (fileMatch) filename = fileMatch[1] ?? '';
    } else if (headerName === 'content-type') {
      mimeType =
        headerValue.split(';')[0]?.trim().toLowerCase() || 'text/plain';
    }
  }
  if (!name) {
    throw validationError(
      'La solicitud multipart no declara los campos requeridos.',
    );
  }
  return { name, filename, mimeType };
}

const truncated = (): UnprocessableEntityException =>
  validationError('El cuerpo multipart esta truncado.');

/**
 * Streams multipart events from a raw request body without buffering file
 * bytes. `source` is consumed until the closing boundary or an error.
 */
export async function* parseMultipart(
  source: AsyncIterable<Buffer | Uint8Array>,
  boundary: string,
  limits: MultipartParserLimits = DEFAULT_MULTIPART_LIMITS,
): AsyncGenerator<MultipartParseEvent> {
  const marker = Buffer.from(`\r\n--${boundary}`);
  const firstMarker = Buffer.from(`--${boundary}`);
  let buffer: Buffer = Buffer.alloc(0);
  let exhausted = false;
  const iterator = source[Symbol.asyncIterator]();

  async function pump(): Promise<boolean> {
    if (exhausted) return false;
    const next = await iterator.next();
    if (next.done) {
      exhausted = true;
      return false;
    }
    const chunk = Buffer.isBuffer(next.value)
      ? next.value
      : Buffer.from(next.value);
    if (chunk.length > 0) {
      buffer = buffer.length > 0 ? Buffer.concat([buffer, chunk]) : chunk;
    }
    return true;
  }

  async function ensure(length: number): Promise<void> {
    while (buffer.length < length && !exhausted) {
      await pump();
    }
  }

  async function readUntil(
    needle: Buffer,
    cap: number,
    tooLarge: () => Error,
  ): Promise<number> {
    for (;;) {
      const index = buffer.indexOf(needle);
      if (index >= 0) return index;
      if (buffer.length > cap + needle.length) throw tooLarge();
      if (!(await pump())) throw truncated();
    }
  }

  async function consumeDelimiter(): Promise<boolean> {
    // Returns true when the closing `--boundary--` was consumed.
    await ensure(2);
    if (buffer.length < 2) throw truncated();
    if (buffer[0] === 0x2d && buffer[1] === 0x2d) {
      // Closing delimiter: drain any epilogue without parsing it.
      buffer = buffer.subarray(2);
      while (await pump()) {
        if (buffer.length > 2) buffer = buffer.subarray(buffer.length - 2);
      }
      buffer = Buffer.alloc(0);
      return true;
    }
    if (buffer[0] !== 0x0d || buffer[1] !== 0x0a) {
      throw validationError('La solicitud multipart es invalida.');
    }
    buffer = buffer.subarray(2);
    return false;
  }

  // Opening boundary (tolerates a small preamble).
  const opening = await readUntil(
    firstMarker,
    limits.maxHeaderBytes,
    () => validationError('La solicitud multipart no contiene partes.'),
  );
  if (opening > 8192) {
    throw validationError('La solicitud multipart no contiene partes.');
  }
  buffer = buffer.subarray(opening + firstMarker.length);
  await ensure(2);
  if (buffer.length < 2) throw truncated();
  if (buffer[0] === 0x2d && buffer[1] === 0x2d) {
    throw validationError('La solicitud multipart no contiene el archivo.');
  }
  if (buffer[0] !== 0x0d || buffer[1] !== 0x0a) {
    throw validationError('La solicitud multipart es invalida.');
  }
  buffer = buffer.subarray(2);

  let fields = 0;
  let fileSeen = false;
  let closed = false;

  while (!closed) {
    const headerEnd = await readUntil(
      HEADER_END,
      limits.maxHeaderBytes,
      () => validationError('Las cabeceras de la parte son demasiado grandes.'),
    );
    const headers = parsePartHeaders(
      buffer.subarray(0, headerEnd).toString('latin1'),
    );
    buffer = buffer.subarray(headerEnd + HEADER_END.length);

    if (headers.filename === null) {
      fields += 1;
      if (fields > limits.maxFields) {
        throw validationError('La solicitud multipart tiene demasiados campos.');
      }
      const end = await readUntil(
        marker,
        limits.maxFieldBytes,
        () => validationError('Un campo de la solicitud es demasiado grande.'),
      );
      const value = buffer.subarray(0, end).toString('utf8');
      yield { kind: 'field', name: headers.name, value };
      buffer = buffer.subarray(end + marker.length);
      closed = await consumeDelimiter();
    } else {
      if (fileSeen) {
        throw validationError('La solicitud debe traer un solo archivo.');
      }
      fileSeen = true;
      yield {
        kind: 'fileStart',
        head: {
          fieldName: headers.name,
          filename: headers.filename,
          mimeType: headers.mimeType,
        },
      };
      let bytes = 0;
      let fileClosed = false;
      while (!fileClosed) {
        const index = buffer.indexOf(marker);
        if (index >= 0) {
          if (index > 0) {
            yield { kind: 'chunk', data: buffer.subarray(0, index) };
            bytes += index;
          }
          buffer = buffer.subarray(index + marker.length);
          fileClosed = true;
        } else {
          // Retain a trailing window so a split delimiter is never emitted
          // as file content nor missed across chunk edges.
          const retain = Math.min(buffer.length, marker.length);
          const emit = buffer.length - retain;
          if (emit > 0) {
            yield { kind: 'chunk', data: buffer.subarray(0, emit) };
            bytes += emit;
            buffer = buffer.subarray(emit);
          }
          if (!(await pump())) throw truncated();
        }
      }
      yield { kind: 'fileEnd', bytes };
      closed = await consumeDelimiter();
    }
  }

  yield { kind: 'done' };
}
