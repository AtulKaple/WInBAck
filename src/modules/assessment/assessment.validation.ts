export function validateAnswersPayload(
  questionnaire: any,
  answers: Record<string, string>
):
  | { ok: true }
  | { ok: false; error: { code: string; details: string } } {

  for (const question of questionnaire.questions) {
    const answer = answers[question.id];

    if (!answer) {
      return {
        ok: false,
        error: {
          code: 'MISSING_ANSWER',
          details: `Missing answer for question ${question.id}`,
        },
      };
    }

    const valid = question.options?.some(
      (opt: any) => opt.id === answer
    );

    if (!valid) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ANSWER',
          details: `Invalid option for question ${question.id}`,
        },
      };
    }
  }

  return { ok: true };
}


// assessment.validation.ts

type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { error: string; details?: any } };

export type NormalizedQuestionnaire = {
  id: string;
  title: string;
  description?: string;
  version: string;
  updatedAt?: string;
  questions: {
    id: string;
    text: string;
    type: 'mcq' | 'scale' | 'boolean';
    required: boolean;
    options?: { id: string; label: string; value: number }[];
  }[];
  scoring?: any;
};

export function validateQuestionnairePayload(
  payload: any
): ValidationResult<NormalizedQuestionnaire> {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: { error: 'INVALID_PAYLOAD' } };
  }

  const { id, title, version, questions } = payload;

  if (!id || typeof id !== 'string') {
    return { ok: false, error: { error: 'INVALID_ID' } };
  }

  if (!title || typeof title !== 'string') {
    return { ok: false, error: { error: 'INVALID_TITLE' } };
  }

  if (!version || typeof version !== 'string') {
    return { ok: false, error: { error: 'INVALID_VERSION' } };
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: { error: 'NO_QUESTIONS' } };
  }

  const normalizedQuestions = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];

    if (!q.id || !q.text || !q.type) {
      return {
        ok: false,
        error: {
          error: 'INVALID_QUESTION',
          details: { index: i },
        },
      };
    }

    if (!['mcq', 'scale', 'boolean'].includes(q.type)) {
      return {
        ok: false,
        error: {
          error: 'UNSUPPORTED_QUESTION_TYPE',
          details: { questionId: q.id },
        },
      };
    }

    if (q.type === 'mcq') {
      if (!Array.isArray(q.options) || q.options.length === 0) {
        return {
          ok: false,
          error: {
            error: 'MCQ_OPTIONS_REQUIRED',
            details: { questionId: q.id },
          },
        };
      }

      q.options.forEach((opt: any, idx: number) => {
        if (
          !opt.id ||
          typeof opt.label !== 'string' ||
          typeof opt.value !== 'number'
        ) {
          throw {
            error: 'INVALID_OPTION',
            details: { questionId: q.id, index: idx },
          };
        }
      });
    }

    normalizedQuestions.push({
      id: q.id,
      text: q.text,
      type: q.type,
      required: Boolean(q.required),
      options: q.options,
    });
  }

  return {
    ok: true,
    data: {
      id,
      title,
      description: payload.description ?? '',
      version,
      updatedAt: payload.updatedAt,
      questions: normalizedQuestions,
      scoring: payload.scoring,
    },
  };
}

