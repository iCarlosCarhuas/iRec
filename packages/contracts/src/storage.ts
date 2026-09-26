import { z } from 'zod';

const CloudflareAccountIdPattern = /^[0-9a-f]{32}$/i;
const R2BucketPattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

export const StorageConnectionId = z.string().uuid();
export type StorageConnectionId = z.infer<typeof StorageConnectionId>;

export const StorageConnectionIdParamsSchema = z.object({
  connectionId: StorageConnectionId,
});
export type StorageConnectionIdParams = z.infer<typeof StorageConnectionIdParamsSchema>;

export const CreateStorageConnectionInput = z.object({
  accountId: z
    .string()
    .trim()
    .regex(
      CloudflareAccountIdPattern,
      'accountId debe ser un Cloudflare Account ID hexadecimal de 32 caracteres',
    ),
  bucket: z
    .string()
    .trim()
    .min(3)
    .max(63)
    .regex(
      R2BucketPattern,
      'bucket solo puede usar minusculas, numeros y guiones, sin guion al inicio o final',
    ),
  accessKeyId: z.string().trim().min(1).max(256),
  secretAccessKey: z.string().min(1).max(512),
});
export type CreateStorageConnectionInput = z.infer<typeof CreateStorageConnectionInput>;

export const StorageConnectionContract = z.object({
  id: StorageConnectionId,
  ownerId: z.string().uuid(),
  accountId: z.string(),
  bucket: z.string(),
  lastVerifiedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type StorageConnectionContract = z.infer<typeof StorageConnectionContract>;

export const StorageConnectionsResponseSchema = z.object({
  connections: z.array(StorageConnectionContract),
});
export type StorageConnectionsResponse = z.infer<typeof StorageConnectionsResponseSchema>;
