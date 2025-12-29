import { z } from 'zod';

export const runResponseSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  processedUsers: z.number(),
  includedUsers: z.number(),
  excludedUsers: z.number(),
  outputsWritten: z.object({
    responses: z.number(),
    observations: z.number(),
  }),
});
