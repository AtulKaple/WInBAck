import { z } from 'zod';

export const markReadSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const createSystemSchema = z.object({
  userIds: z.array(z.string()).optional(),
  userId: z.string().optional(),
  type: z.literal('SYSTEM_ANNOUNCEMENT'),
  ctaUrl: z.string().optional(),
});

export const internalPublishSchema = z.object({
  userId: z.string(),
  type: z.enum(['ASSESSMENT_DUE', 'ASSESSMENT_COMPLETED', 'DIARY_REMINDER', 'CONSENT_REQUIRED', 'SYSTEM_ANNOUNCEMENT']),
  ctaUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  severity: z.enum(['info', 'warning']).optional(),
});
