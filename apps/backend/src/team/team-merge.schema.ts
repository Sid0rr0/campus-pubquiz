import { z } from 'zod';

export const teamMergeBodySchema = z.object({
  otherTeamId: z.number().int().positive(),
  name: z.string().min(1),
});

export const teamMergePreviewQuerySchema = z.object({
  otherTeamId: z.coerce.number().int().positive().optional(),
});
