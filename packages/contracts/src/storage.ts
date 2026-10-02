import { z } from 'zod';

export const StorageConnectionIdParamsSchema = z.object({
  connectionId: z.string().uuid(),
});
export type StorageConnectionIdParams = z.infer<typeof StorageConnectionIdParamsSchema>;

// Stored lifecycle state is historical, not a live provider health check.
// A failed prepare does not erase a previously successful verification.
export const StorageConnectionContract = z.object({
  id: z.string().uuid(),
  provider: z.literal('google_drive'),
  displayName: z.string().nullable(),
  status: z.enum(['pending', 'ready', 'error', 'revoked']).describe(
    'Stored lifecycle state only; ready does not guarantee current provider health.',
  ),
  lastVerifiedAt: z.string().datetime().nullable().describe(
    'Time of the last successful verification, not of the latest prepare attempt.',
  ),
});
export type StorageConnectionContract = z.infer<typeof StorageConnectionContract>;

export const StorageConnectionsResponseSchema = z.object({
  connections: z.array(StorageConnectionContract),
});
export type StorageConnectionsResponse = z.infer<typeof StorageConnectionsResponseSchema>;
