import { z } from 'zod';

export const AlbumVisibility = z.enum(['public', 'private']);
export type AlbumVisibility = z.infer<typeof AlbumVisibility>;

export const AlbumMemberRole = z.enum(['owner', 'member']);
export type AlbumMemberRole = z.infer<typeof AlbumMemberRole>;

export const AlbumMemberStatus = z.enum(['active', 'invited', 'removed']);
export type AlbumMemberStatus = z.infer<typeof AlbumMemberStatus>;

export const AlbumId = z.string().uuid();
export type AlbumId = z.infer<typeof AlbumId>;

export const CreateAlbumInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: AlbumVisibility.default('private'),
});
export type CreateAlbumInput = z.infer<typeof CreateAlbumInput>;

export const UpdateAlbumInput = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: AlbumVisibility.optional(),
});
export type UpdateAlbumInput = z.infer<typeof UpdateAlbumInput>;

export const AlbumContract = z.object({
  id: AlbumId,
  ownerId: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  visibility: AlbumVisibility,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AlbumContract = z.infer<typeof AlbumContract>;

export const AlbumMemberContract = z.object({
  albumId: AlbumId,
  userId: z.string().uuid(),
  role: AlbumMemberRole,
  status: AlbumMemberStatus,
  joinedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AlbumMemberContract = z.infer<typeof AlbumMemberContract>;
