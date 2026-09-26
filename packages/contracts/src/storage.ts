import { z } from 'zod';

export const StorageConnectionId = z.string().uuid();
export type StorageConnectionId = z.infer<typeof StorageConnectionId>;

export const StorageConnectionIdParamsSchema = z.object({
  connectionId: StorageConnectionId,
});
export type StorageConnectionIdParams = z.infer<typeof StorageConnectionIdParamsSchema>;

export const CreateStorageConnectionInput = z.object({
  accountId: z.string().trim().min(1).max(64),
  bucket: z.string().trim().min(1).max(255),
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
