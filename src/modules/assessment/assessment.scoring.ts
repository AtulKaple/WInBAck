export function scoreQuestionnaire(
  questionnaire: any,
  answers: Record<string, string>
) {
  const breakdown = questionnaire.questions.map((q: any) => {
    const selectedOptionId = answers[q.id];

    if (!selectedOptionId) {
      throw new Error(`Missing answer for question ${q.id}`);
    }

    const option = q.options.find(
      (o: any) => o.id === selectedOptionId
    );

    if (!option) {
      throw new Error(`Invalid option for question ${q.id}`);
    }

    return {
      questionId: q.id,
      selectedOptionId: option.id,
      score: option.value,
      label: option.label,
    };
  });

  const score = breakdown.reduce(
    (total: number, b: any) => total + b.score,
    0
  );

  const band = questionnaire.scoring?.interpretation?.find(
    (i: any) => score >= i.min && score <= i.max
  );

  return {
    score,
    interpretation: band?.label ?? 'Unclassified',
    breakdown,
  };
}

