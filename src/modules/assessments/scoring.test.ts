import { scoreQuestionnaire, ScoringError } from './scoring';
import { Questionnaire } from './schema';

describe('scoreQuestionnaire', () => {
  const questionnaire: Questionnaire = {
    id: 'sample',
    title: 'Sample Assessment',
    description: 'A sample',
    version: '1.0.0',
    updatedAt: '2024-01-01T00:00:00.000Z',
    questions: [
      {
        id: 'q1',
        text: 'Question 1',
        type: 'mcq',
        required: true,
        options: [
          { id: 'a', label: 'A', value: 1 },
          { id: 'b', label: 'B', value: 2 },
        ],
      },
      {
        id: 'q2',
        text: 'Question 2',
        type: 'mcq',
        required: true,
        options: [
          { id: 'c', label: 'C', value: 0 },
          { id: 'd', label: 'D', value: 3 },
        ],
      },
    ],
    scoring: {
      method: 'sum',
      interpretation: [
        { min: 0, max: 1, label: 'Low' },
        { min: 2, max: 4, label: 'Medium' },
        { min: 5, max: 999, label: 'High' },
      ],
    },
  };

  it('computes sum and interpretation', () => {
    const result = scoreQuestionnaire(questionnaire, { q1: 'b', q2: 'd' });
    expect(result.score).toBe(5);
    expect(result.interpretation).toBe('High');
    expect(result.breakdown).toEqual([
      { questionId: 'q1', selectedOptionId: 'b', value: 2 },
      { questionId: 'q2', selectedOptionId: 'd', value: 3 },
    ]);
  });

  it('throws for missing required answers', () => {
    expect(() => scoreQuestionnaire(questionnaire, { q1: 'a' })).toThrow(ScoringError);
  });

  it('throws for invalid option ids', () => {
    expect(() => scoreQuestionnaire(questionnaire, { q1: 'x', q2: 'c' })).toThrow(ScoringError);
  });
});
