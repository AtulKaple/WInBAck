import { questionnaireSchema, Questionnaire } from './schema';
import { z } from 'zod';

export type ValidationResult =
  | { ok: true; data: Questionnaire }
  | { ok: false; error: { code: 'SCHEMA_VALIDATION_FAILED'; details: z.ZodIssue[] } };

export function validateQuestionnairePayload(input: unknown): ValidationResult {
  const parsed = questionnaireSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { code: 'SCHEMA_VALIDATION_FAILED', details: parsed.error.issues } };
  }
  return { ok: true, data: parsed.data };
}
