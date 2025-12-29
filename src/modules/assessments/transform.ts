import { FhirQuestionnaire, fhirQuestionnaireSchema, questionnaireSchema } from './schema';
import { z } from 'zod';

export function toFhirQuestionnaire(input: unknown): FhirQuestionnaire {
  const asFhir = fhirQuestionnaireSchema.safeParse(input);
  if (asFhir.success) {
    return asFhir.data;
  }

  const simplified = questionnaireSchema.safeParse(input);
  if (!simplified.success) {
    throw new Error('Invalid questionnaire payload');
  }

  return simplifiedToFhir(simplified.data);
}

function simplifiedToFhir(q: z.infer<typeof questionnaireSchema>): FhirQuestionnaire {
  return {
    resourceType: 'Questionnaire',
    id: q.id,
    title: q.title,
    status: 'active',
    description: q.description,
    version: q.version,
    updatedAt: q.updatedAt,
    item: q.questions.map((question) => ({
      linkId: question.id,
      text: question.text,
      type: 'choice',
      answerOption: question.options.map((opt) => ({
        valueCoding: { code: opt.id, display: opt.label },
        valueInteger: opt.value,
      })),
    })),
    scoring: q.scoring,
  };
}

export function fhirToScoringShape(q: FhirQuestionnaire): z.infer<typeof questionnaireSchema> {
  return {
    id: q.id,
    title: q.title,
    description: q.description || '',
    version: q.version || '1.0.0',
    updatedAt: q.updatedAt || new Date().toISOString(),
    questions: q.item.map((item) => ({
      id: item.linkId,
      text: item.text,
      type: 'mcq',
      required: true,
      options: item.answerOption.map((opt) => ({
        id: opt.valueCoding?.code || String(opt.valueInteger ?? ''),
        label: opt.valueCoding?.display || String(opt.valueInteger ?? opt.valueCoding?.code ?? ''),
        value: opt.valueInteger ?? 0,
      })),
    })),
    scoring: q.scoring || { method: 'sum', interpretation: [{ min: 0, max: 9999, label: 'Unclassified' }] },
  };
}
