import { z } from 'zod';

export const AlbumVisibility = z.enum(['public', 'private']);
export type AlbumVisibility = z.infer<typeof AlbumVisibility>;

export const AlbumMemberRole = z.enum(['owner', 'member']);
export type AlbumMemberRole = z.infer<typeof AlbumMemberRole>;

export const AlbumMemberStatus = z.enum(['active', 'invited', 'removed']);
export type AlbumMemberStatus = z.infer<typeof AlbumMemberStatus>;

export const AlbumId = z.string().uuid();
export type AlbumId = z.infer<typeof AlbumId>;

export const AlbumIdParamsSchema = z.object({
  albumId: AlbumId,
});
export type AlbumIdParams = z.infer<typeof AlbumIdParamsSchema>;

export const AlbumMemberParamsSchema = z.object({
  albumId: AlbumId,
  userId: z.string().uuid(),
});
export type AlbumMemberParams = z.infer<typeof AlbumMemberParamsSchema>;

export const CreateAlbumInput = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  visibility: AlbumVisibility.default('private'),
});
export type CreateAlbumInput = z.infer<typeof CreateAlbumInput>;

export const UpdateAlbumInput = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    visibility: AlbumVisibility.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.visibility !== undefined,
    { message: 'Debe enviarse al menos un campo para actualizar.' },
  );
export type UpdateAlbumInput = z.infer<typeof UpdateAlbumInput>;

export const InviteAlbumMemberInput = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type InviteAlbumMemberInput = z.infer<typeof InviteAlbumMemberInput>;

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

export const AlbumListResponseSchema = z.object({
  albums: z.array(AlbumContract),
});
export type AlbumListResponse = z.infer<typeof AlbumListResponseSchema>;

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

export const AlbumMemberViewContract = AlbumMemberContract.extend({
  email: z.string().email(),
});
export type AlbumMemberViewContract = z.infer<typeof AlbumMemberViewContract>;

export const AlbumMembersResponseSchema = z.object({
  members: z.array(AlbumMemberViewContract),
});
export type AlbumMembersResponse = z.infer<typeof AlbumMembersResponseSchema>;


export const AlbumProposalStatus = z.enum(['pending', 'approved', 'rejected']);
export type AlbumProposalStatus = z.infer<typeof AlbumProposalStatus>;

export const AlbumProposalId = z.string().uuid();
export type AlbumProposalId = z.infer<typeof AlbumProposalId>;

export const AlbumProposalParamsSchema = z.object({
  albumId: AlbumId,
  proposalId: AlbumProposalId,
});
export type AlbumProposalParams = z.infer<typeof AlbumProposalParamsSchema>;

export const CreateAlbumProposalInput = z.object({
  text: z.string().trim().min(1).max(2000),
});
export type CreateAlbumProposalInput = z.infer<typeof CreateAlbumProposalInput>;

export const AlbumProposalContract = z.object({
  id: AlbumProposalId,
  albumId: AlbumId,
  proposedBy: z.string().uuid(),
  text: z.string(),
  status: AlbumProposalStatus,
  moderatedBy: z.string().uuid().nullable(),
  moderatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AlbumProposalContract = z.infer<typeof AlbumProposalContract>;

export const AlbumProposalViewContract = AlbumProposalContract.extend({
  proposerEmail: z.string().email(),
});
export type AlbumProposalViewContract = z.infer<typeof AlbumProposalViewContract>;

export const AlbumProposalsResponseSchema = z.object({
  proposals: z.array(AlbumProposalViewContract),
});
export type AlbumProposalsResponse = z.infer<typeof AlbumProposalsResponseSchema>;
