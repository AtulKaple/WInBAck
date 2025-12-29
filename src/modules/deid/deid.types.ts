export type DeidResponse = {
  resourceType: 'QuestionnaireResponse';
  id: string;
  pseudoId: string;
  questionnaireId: string;
  authoredMonth: string;
  score: number;
  interpretation: string;
};

export type DeidObservation = {
  resourceType: 'Observation';
  subject: { reference: string };
  effectiveMonth: string;
  code: { text: string };
  valueInteger?: number;
  valueQuantity?: { value: number };
};

export type DeidRunSummary = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  processedUsers: number;
  includedUsers: number;
  excludedUsers: number;
  outputsWritten: { responses: number; observations: number };
};
