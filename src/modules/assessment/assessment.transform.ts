export function toClientQuestionnaire(q: any) {
  return {
    _id:q._id,
    id: q.logicalId,
    title: q.title,
    description: q.description,
    version: q.version,
    minScore: q.minScore,
    maxScore: q.maxScore,
    scoring: q.scoring,
    questions: q.questions.map((item: any) => ({
      id: item.id,
      text: item.text,
      options: item.options.map((opt: any) => ({
        id: opt.id,
        label: opt.label,
        value: opt.value,
      })),
    })),
  };
}


import { NormalizedQuestionnaire } from './assessment.validation';

export function toFhirQuestionnaire(q: NormalizedQuestionnaire) {
  return {
    resourceType: 'Questionnaire',
    id: q.id,
    version: q.version,
    status: 'active',
    title: q.title,
    description: q.description,
    date: q.updatedAt ?? new Date().toISOString(),

    item: q.questions.map((question, index) => {
      const baseItem: any = {
        linkId: question.id,
        text: question.text,
        required: question.required,
      };

      if (question.type === 'mcq') {
        baseItem.type = 'choice';
        baseItem.answerOption = question.options?.map((opt) => ({
          valueCoding: {
            code: opt.id,
            display: opt.label,
            extension: [
              {
                url: 'http://winsights.ai/fhir/StructureDefinition/option-score',
                valueDecimal: opt.value,
              },
            ],
          },
        }));
      }

      if (question.type === 'boolean') {
        baseItem.type = 'boolean';
      }

      if (question.type === 'scale') {
        baseItem.type = 'integer';
      }

      return baseItem;
    }),

    // custom extension for scoring metadata
    extension: q.scoring
      ? [
          {
            url: 'http://winsights.ai/fhir/StructureDefinition/scoring',
            valueString: JSON.stringify(q.scoring),
          },
        ]
      : [],
  };
}

