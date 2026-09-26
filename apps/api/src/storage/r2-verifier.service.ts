import {
  BadGatewayException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  HeadBucketCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { CreateStorageConnectionInput } from '@irec/contracts';

export type R2VerificationInput = Pick<
  CreateStorageConnectionInput,
  'accountId' | 'bucket' | 'accessKeyId' | 'secretAccessKey'
>;

export type R2FailureKind = 'client' | 'upstream';

const VERIFY_TIMEOUT_MS = 10_000;

export function buildR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function classifyR2Failure(error: unknown): R2FailureKind {
  if (typeof error !== 'object' || error === null || !('$metadata' in error)) {
    return 'upstream';
  }

  const metadata = (error as {
    $metadata?: { httpStatusCode?: number };
  }).$metadata;
  const status = metadata?.httpStatusCode;

  return status !== undefined && status >= 400 && status < 500
    ? 'client'
    : 'upstream';
}

@Injectable()
export class R2VerifierService {
  async verify(input: R2VerificationInput): Promise<Date> {
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), VERIFY_TIMEOUT_MS);

    const client = new S3Client({
      region: 'auto',
      endpoint: buildR2Endpoint(input.accountId),
      credentials: {
        accessKeyId: input.accessKeyId,
        secretAccessKey: input.secretAccessKey,
      },
    });

    try {
      await client.send(
        new HeadBucketCommand({ Bucket: input.bucket }),
        { abortSignal: abortController.signal },
      );

      return new Date();
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new BadGatewayException({
          type: 'https://irec.app/problems/r2-verification-timeout',
          title: 'R2 verification timeout',
          status: 502,
          detail: 'Cloudflare R2 no respondio a tiempo.',
        });
      }

      if (classifyR2Failure(error) === 'client') {
        throw new UnprocessableEntityException({
          type: 'https://irec.app/problems/r2-verification-failed',
          title: 'R2 verification failed',
          status: 422,
          detail: 'No se pudo validar la cuenta, bucket o credenciales R2.',
        });
      }

      throw new BadGatewayException({
        type: 'https://irec.app/problems/r2-unavailable',
        title: 'R2 unavailable',
        status: 502,
        detail: 'Cloudflare R2 no esta disponible temporalmente.',
      });
    } finally {
      clearTimeout(timeout);
      client.destroy();
    }
  }
}
