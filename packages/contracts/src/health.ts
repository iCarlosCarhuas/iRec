import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('irec-api'),
  version: z.string(),
  timestamp: z.string().datetime({ offset: true }),
}).meta({
  id: 'HealthResponse',
  description: 'Estado basico de la API de iRec',
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
