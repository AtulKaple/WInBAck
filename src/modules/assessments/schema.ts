import { z } from 'zod';

export const optionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.number(),
});

export const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  type: z.literal('mcq'),
  options: z.array(optionSchema).min(1),
  required: z.boolean().default(true),
});

export const interpretationBandSchema = z.object({
  min: z.number(),
  max: z.number(),
  label: z.string().min(1),
});

export const scoringSchema = z.object({
  method: z.literal('sum'),
  interpretation: z.array(interpretationBandSchema).min(1),
});

export const questionnaireSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  updatedAt: z.string().refine((val) => !Number.isNaN(Date.parse(val)), 'updatedAt must be an ISO date'),
  questions: z.array(questionSchema).min(1),
  scoring: scoringSchema,
});

export const fhirCodingSchema = z.object({
  code: z.string().min(1),
  display: z.string().min(1),
});

export const fhirAnswerOptionSchema = z.object({
  valueCoding: fhirCodingSchema.optional(),
  valueInteger: z.number().optional(),
}).refine((opt) => opt.valueCoding || typeof opt.valueInteger === 'number', {
  message: 'answerOption requires valueCoding or valueInteger',
});

export const fhirItemSchema = z.object({
  linkId: z.string().min(1),
  text: z.string().min(1),
  type: z.literal('choice'),
  answerOption: z.array(fhirAnswerOptionSchema).min(1),
});

export const fhirQuestionnaireSchema = z.object({
  resourceType: z.literal('Questionnaire'),
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  updatedAt: z.string().optional(),
  item: z.array(fhirItemSchema).min(1),
  scoring: scoringSchema.optional(),
});

export const fhirQuestionnaireResponseSchema = z.object({
  resourceType: z.literal('QuestionnaireResponse'),
  id: z.string().optional(),
  questionnaire: z.string().min(1),
  subject: z.string().min(1),
  authored: z.string().min(1),
  status: z.literal('completed'),
  item: z.array(
    z.object({
      linkId: z.string().min(1),
      text: z.string().optional(),
      answer: z.array(
        z.object({
          valueCoding: fhirCodingSchema.optional(),
          valueInteger: z.number().optional(),
        }).refine((a) => a.valueCoding || typeof a.valueInteger === 'number', { message: 'answer requires value' })
      ),
    })
  ),
});

export type Questionnaire = z.infer<typeof questionnaireSchema>;
export type FhirQuestionnaire = z.infer<typeof fhirQuestionnaireSchema>;
export type FhirQuestionnaireResponse = z.infer<typeof fhirQuestionnaireResponseSchema>;
export type Question = z.infer<typeof questionSchema>;
export type Option = z.infer<typeof optionSchema>;
export type InterpretationBand = z.infer<typeof interpretationBandSchema>;
