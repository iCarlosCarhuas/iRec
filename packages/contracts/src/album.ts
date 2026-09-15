import { z } from 'zod';

export const AlbumVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']).meta({
  id: 'AlbumVisibility',
});

export const CreateAlbumRequestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  visibility: AlbumVisibilitySchema,
  storageConnectionId: z.string().uuid(),
}).meta({
  id: 'CreateAlbumRequest',
  description: 'Contrato previsto para la creacion de albumes',
});

export type CreateAlbumRequest = z.infer<typeof CreateAlbumRequestSchema>;
