import { z } from 'zod';

export const consentSchema = z.object({
  resourceType: z.literal('Consent'),
  id: z.string().min(1),
  patient: z.string().min(1),
  status: z.enum(['active', 'inactive']),
  scope: z.array(z.enum(['assessments', 'diary', 'research'])).min(1),
  provision: z.object({
    period: z
      .object({
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .optional(),
  }),
  dateTime: z.string().min(1),
  performer: z.string().min(1),
});

export type Consent = z.infer<typeof consentSchema>;
