import {
  BadGatewayException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { OwnedStorageCredentials } from './storage.service.js';
import { buildR2Endpoint } from './r2-verifier.service.js';

const R2_OBJECT_TIMEOUT_MS = 10_000;

function createClient(credentials: OwnedStorageCredentials): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: buildR2Endpoint(credentials.accountId),
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

export function r2HttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) {
    return undefined;
  }

  return (error as { $metadata?: { httpStatusCode?: number } }).$metadata
    ?.httpStatusCode;
}

@Injectable()
export class R2ObjectService {
  async presignPut(input: {
    credentials: OwnedStorageCredentials;
    objectKey: string;
    contentType: string;
    expiresIn: number;
  }): Promise<{ uploadUrl: string; expiresAt: Date }> {
    const client = createClient(input.credentials);

    try {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: input.credentials.bucket,
          Key: input.objectKey,
          ContentType: input.contentType,
        }),
        { expiresIn: input.expiresIn },
      );

      return {
        uploadUrl,
        expiresAt: new Date(Date.now() + input.expiresIn * 1000),
      };
    } catch {
      throw new BadGatewayException({
        type: 'https://irec.app/problems/r2-presign-failed',
        title: 'R2 presign failed',
        status: 502,
        detail: 'No se pudo generar la autorizacion temporal de upload.',
      });
    } finally {
      client.destroy();
    }
  }

  async headObject(input: {
    credentials: OwnedStorageCredentials;
    objectKey: string;
  }): Promise<{
    contentType: string | undefined;
    sizeBytes: number | undefined;
    lastModified: Date | undefined;
  }> {
    const client = createClient(input.credentials);
    const abortController = new AbortController();
    const timeout = setTimeout(
      () => abortController.abort(),
      R2_OBJECT_TIMEOUT_MS,
    );

    try {
      const result = await client.send(
        new HeadObjectCommand({
          Bucket: input.credentials.bucket,
          Key: input.objectKey,
        }),
        { abortSignal: abortController.signal },
      );

      return {
        contentType: result.ContentType,
        sizeBytes: result.ContentLength,
        lastModified: result.LastModified,
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new BadGatewayException({
          type: 'https://irec.app/problems/r2-upload-validation-timeout',
          title: 'R2 upload validation timeout',
          status: 502,
          detail: 'Cloudflare R2 no respondio a tiempo al validar el objeto.',
        });
      }

      if (r2HttpStatus(error) === 404) {
        throw new UnprocessableEntityException({
          type: 'https://irec.app/problems/r2-upload-object-missing',
          title: 'Uploaded object not found',
          status: 422,
          detail: 'El objeto esperado no existe en R2.',
        });
      }

      throw new BadGatewayException({
        type: 'https://irec.app/problems/r2-upload-validation-failed',
        title: 'R2 upload validation failed',
        status: 502,
        detail: 'No se pudo validar el objeto cargado en R2.',
      });
    } finally {
      clearTimeout(timeout);
      client.destroy();
    }
  }
}
