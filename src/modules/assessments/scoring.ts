import { Questionnaire } from './schema';

export type AnswerMap = Record<string, string>;

export type ScoringResult = {
  score: number;
  interpretation: string;
  breakdown: { questionId: string; selectedOptionId: string; value: number }[];
};

export class ScoringError extends Error {}

export function scoreQuestionnaire(questionnaire: Questionnaire, answers: AnswerMap): ScoringResult {
  const breakdown = questionnaire.questions.map((question) => {
    const selectedOptionId = answers[question.id];

    if (question.required && (selectedOptionId === undefined || selectedOptionId === null)) {
      throw new ScoringError(`Missing answer for required question '${question.id}'`);
    }

    if (selectedOptionId === undefined || selectedOptionId === null) {
      return { questionId: question.id, selectedOptionId: '', value: 0 };
    }

    const option = question.options.find((opt) => opt.id === selectedOptionId);
    if (!option) {
      throw new ScoringError(`Invalid option '${selectedOptionId}' for question '${question.id}'`);
    }

    return { questionId: question.id, selectedOptionId, value: option.value };
  });

  const score = breakdown.reduce((sum, item) => sum + item.value, 0);
  const interpretation = deriveInterpretation(questionnaire, score);

  return { score, interpretation, breakdown };
}

function deriveInterpretation(questionnaire: Questionnaire, score: number): string {
  const band = questionnaire.scoring.interpretation.find((range) => score >= range.min && score <= range.max);
  return band ? band.label : 'Unclassified';
}
