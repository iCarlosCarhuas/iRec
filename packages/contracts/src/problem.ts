import { z } from 'zod';

export const ProblemDetailsSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  requestId: z.string().optional(),
}).meta({
  id: 'ProblemDetails',
  description: 'RFC 9457 compatible problem details',
});

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
