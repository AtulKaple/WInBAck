import path from 'path';
import fs from 'fs/promises';
import { Router } from 'express';
import { z } from 'zod';
import { JsonStore } from '../../storage/jsonStore';
import { secureReadAll, secureWrite } from '../../security/secureWrite';
import { safeLogger, preventBodyLogging } from '../../security/safeLogger';
import { requireRole } from '../../middleware/auth';
import { requireAuthContext } from '../../auth';
import { questionnaireSchema, FhirQuestionnaire, FhirQuestionnaireResponse } from './schema';
import { AnswerMap, scoreQuestionnaire, ScoringError } from './scoring';
import { requireActiveConsent } from '../consent';
import { fhirToScoringShape, toFhirQuestionnaire } from './transform';
import { emitAssessmentCompleted } from '../notifications/notifications.controller';
import { validateQuestionnairePayload } from './service';
import { hasActiveConsent } from '../consent/service';
import { csrfGuard } from '../../security/csrfGuard';

const questionnairesStore = new JsonStore<FhirQuestionnaire[]>(
  path.join(__dirname, '..', '..', 'data', 'questionnaires.json'),
  []
);
const SEED_DIR = path.join(__dirname, '..', '..', 'data', 'seed-assessments');

const seedPromise = seedQuestionnaires();

const shouldLogSeeds = !process.env.JEST_WORKER_ID;

async function seedQuestionnaires() {
  try {
    await fs.access(SEED_DIR);
  } catch (err: any) {
    if (err && err.code === 'ENOENT') return;
    if (shouldLogSeeds) safeLogger.info('assessments.seed.error', { message: err instanceof Error ? err.message : 'seed access error' });
    return;
  }

  try {
    const files = (await fs.readdir(SEED_DIR)).filter((f) => f.endsWith('.json'));
    if (!files.length) return;
    const questionnaires = await questionnairesStore.read();
    const existingIds = new Set(questionnaires.map((q) => q.id));
    let changed = false;

    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(SEED_DIR, file), 'utf8');
        const parsed = JSON.parse(raw);
        const payload = toFhirQuestionnaire(parsed);
        if (!existingIds.has(payload.id)) {
          questionnaires.push(payload);
          existingIds.add(payload.id);
          changed = true;
        }
      } catch (err: any) {
        if (shouldLogSeeds) safeLogger.info('assessments.seed.skip', { file, message: err instanceof Error ? err.message : 'invalid seed' });
      }
    }

    if (changed) {
      await questionnairesStore.write(questionnaires);
      if (shouldLogSeeds) safeLogger.info('assessments.seed.loaded', { count: questionnaires.length });
    }
  } catch (err: any) {
    if (shouldLogSeeds) safeLogger.info('assessments.seed.error', { message: err instanceof Error ? err.message : 'seed load error' });
  }
}

const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');
let responseQueue: Promise<any> = Promise.resolve();

const readResponses = (): Promise<AssessmentResponse[]> => {
  return (responseQueue = responseQueue.then(async () => {
    try {
      const raw = await secureReadAll<AssessmentResponse>(RESPONSES_PATH);
      return raw;
    } catch {
      await secureWrite({ filePath: RESPONSES_PATH, record: [], auditMeta: { action: 'init', resourceType: 'AssessmentResponse', resourceId: 'init' } });
      return [];
    }
  }));
};

const writeResponses = (entry: AssessmentResponse, actor: { userId?: string; role?: string }): Promise<void> => {
  return (responseQueue = responseQueue.then(async () => {
    await secureWrite({
      filePath: RESPONSES_PATH,
      record: entry,
      auditMeta: {
        action: 'assessmentResponse.write',
        actorUserId: actor.userId,
        actorRole: actor.role,
        resourceType: 'AssessmentResponse',
        resourceId: entry.id || 'unknown',
      },
    });
  }));
};

const answerSchema = z.object({
  answers: z.record(z.string()).default({}),
});

const router = Router();

async function enforcePatientConsentIfNeeded(_req: any, _res: any): Promise<boolean> {
  // Consent enforcement disabled.
  return true;
}

router.get('/', async (req, res) => {
  await seedPromise;
  const consentOk = await enforcePatientConsentIfNeeded(req, res);
  if (!consentOk) return;
  const questionnaires = await questionnairesStore.read();
  const metadata = questionnaires.map(({ id, title, description, version, updatedAt }) => ({
    id,
    title,
    description,
    version,
    updatedAt,
  }));
  res.json({ data: metadata });
});

router.get('/:id', async (req, res) => {
  await seedPromise;
  const consentOk = await enforcePatientConsentIfNeeded(req, res);
  if (!consentOk) return;
  const questionnaires = await questionnairesStore.read();
  const questionnaire = questionnaires.find((q) => q.id === req.params.id);
  if (!questionnaire) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  return res.json({ data: questionnaire });
});

router.post('/', requireRole(['admin']), async (req, res) => {
  const validation = validateQuestionnairePayload(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: 'SCHEMA_VALIDATION_FAILED', details: validation.error.details });
  }

  let payload: FhirQuestionnaire;
  try {
    payload = toFhirQuestionnaire(validation.data);
  } catch (err: any) {
    return res.status(400).json({ error: 'SCHEMA_VALIDATION_FAILED', details: err?.message || 'Invalid questionnaire payload' });
  }

  const questionnaires = await questionnairesStore.read();
  const existingIndex = questionnaires.findIndex((q) => q.id === payload.id);

  if (existingIndex >= 0) {
    return res.status(409).json({ error: 'DUPLICATE_ID' });
  }

  questionnaires.push(payload);

  await questionnairesStore.write(questionnaires);
  return res.status(201).json({ data: { id: payload.id } });
});

router.post(
  '/:id/submit',
  preventBodyLogging,
  requireAuthContext,
  requireRole(['patient']),
  csrfGuard,
  requireActiveConsent('assessments'),
  async (req, res) => {
  const parsed = answerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
  }

  const questionnaires = await questionnairesStore.read();
  const questionnaire = questionnaires.find((q) => q.id === req.params.id);
  if (!questionnaire) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  if (!questionnaire.scoring) {
    return res.status(400).json({ error: 'Scoring not configured' });
  }

  const scoringShape = fhirToScoringShape(questionnaire);
  const answers = parsed.data.answers as AnswerMap;
  const userId = req.authContext?.userId;
  const submittedAt = new Date().toISOString();

  let scoring;
  try {
    scoring = scoreQuestionnaire(scoringShape, answers);
  } catch (err) {
    if (err instanceof ScoringError) {
      return res.status(400).json({ error: err.message });
    }
    throw err;
  }

  const responseId = `${questionnaire.id}-${userId || 'anonymous'}-${Date.now()}`;
  const questionnaireResponse: FhirQuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    id: responseId,
    questionnaire: `Questionnaire/${questionnaire.id}`,
    subject: `Patient/${userId || 'anonymous'}`,
    authored: submittedAt,
    status: 'completed',
    item: scoringShape.questions.map((q) => ({
      linkId: q.id,
      text: q.text,
      answer: q.options
        .filter((opt) => answers[q.id] === opt.id)
        .map((opt) => ({
          valueCoding: { code: opt.id, display: opt.label },
          valueInteger: opt.value,
        })),
    })),
  };

  const observation = {
    resourceType: 'Observation' as const,
    id: `${responseId}-obs`,
    status: 'final',
    code: { text: 'Assessment Score' },
    subject: { reference: `Patient/${userId || 'anonymous'}` },
    effectiveDateTime: submittedAt,
    valueQuantity: { value: scoring.score },
    interpretation: [{ text: scoring.interpretation }],
    derivedFrom: [{ reference: `QuestionnaireResponse/${responseId}` }],
  };

  const attemptTimestamp = new Date().toISOString();
  const response: AssessmentResponse = {
    id: responseId,
    assessmentId: questionnaire.id,
    userId: userId || 'anonymous',
    submittedAt,
    attemptTimestamp,
    response: questionnaireResponse,
    observation,
    computed: {
      score: scoring.score,
      interpretation: scoring.interpretation,
      breakdown: scoring.breakdown,
    },
  };

  await writeResponses(response, { userId, role: req.authContext?.role });

  // Store non-PHI notification
  try {
    await emitAssessmentCompleted(userId);
  } catch (err) {
    safeLogger.info('notification.write.error', { message: err instanceof Error ? err.message : 'error' });
  }

  return res
    .status(201)
    .json({
      data: {
        assessmentId: questionnaire.id,
        submittedAt,
        score: scoring.score,
        interpretation: scoring.interpretation,
        responseId: response.id,
        observationId: `${response.id}-obs`,
      },
    });
  }
);

router.get('/:id/results', preventBodyLogging, requireAuthContext, requireRole(['patient']), requireActiveConsent('assessments'), async (req, res) => {
  const userId = req.authContext?.userId;
  const responses = await readResponses();
  const latestOnly = req.query.latestOnly !== 'false';
  const userResponses = responses
    .filter((r) => r.assessmentId === req.params.id && r.userId === userId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  if (userResponses.length === 0) {
    return res.status(404).json({ error: 'No results found for this assessment' });
  }

  if (!latestOnly) {
    return res.json({
      data: userResponses.map((r) => ({
        assessmentId: r.assessmentId,
        submittedAt: r.submittedAt,
        attemptTimestamp: r.attemptTimestamp || r.submittedAt,
        score: r.computed.score,
        interpretation: r.computed.interpretation,
        breakdown: r.computed.breakdown,
        responseId: r.response.id,
        observationId: r.observation.id,
      })),
    });
  }

  const latest = userResponses[0];
  return res.json({
    data: {
      assessmentId: latest.assessmentId,
      submittedAt: latest.submittedAt,
      attemptTimestamp: latest.attemptTimestamp || latest.submittedAt,
      score: latest.computed.score,
      interpretation: latest.computed.interpretation,
      breakdown: latest.computed.breakdown,
      responseId: latest.response.id,
      observationId: latest.observation.id,
    },
  });
});

export type AssessmentResponse = {
  id: string;
  assessmentId: string;
  userId: string;
  submittedAt: string;
  attemptTimestamp?: string;
  response: FhirQuestionnaireResponse;
  observation: {
    resourceType: 'Observation';
    id: string;
    status: string;
    code: { text: string };
    subject: { reference: string };
    effectiveDateTime: string;
    valueQuantity: { value: number };
    interpretation: { text: string }[];
    derivedFrom: { reference: string }[];
  };
  computed: {
    score: number;
    interpretation: string;
    breakdown: { questionId: string; selectedOptionId: string; value: number }[];
  };
};

export default router;
