import fs from 'fs/promises';
import path from 'path';
import { secureRead } from '../../security/secureWrite';
import { DeidObservation, DeidResponse, DeidRunSummary } from './deid.types';
import { AUDIT_PATH, verifyLedger } from '../../security/secureWrite';
import { pseudonymize } from './pseudonym';

export const DEID_CONSENT_FILTER_ENABLED = true;
export const DEID_TEXT_EXCLUSION_ENABLED = true;
export const DEID_SMALL_N_GUARD_ENABLED = true;

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'deid');
const RESPONSES_PATH = path.join(DATA_DIR, 'deid_questionnaire_responses.json');
const OBS_PATH = path.join(DATA_DIR, 'deid_observations.json');
const INDEX_PATH = path.join(DATA_DIR, 'deid_index.json');
const RUNS_PATH = path.join(DATA_DIR, 'deid_runs.json');
const K_SUPPRESSION = Number(process.env.K_SUPPRESSION || 5);

const SOURCE_CONSENTS = path.join(__dirname, '..', '..', 'data', 'consents.json');
const SOURCE_RESPONSES = path.join(__dirname, '..', '..', 'data', 'responses.json');
const SOURCE_DIARY = path.join(__dirname, '..', '..', 'data', 'diary.json');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readRuns(): Promise<DeidRunSummary[]> {
  try {
    const raw = await fs.readFile(RUNS_PATH, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function runDeidPipeline(): Promise<DeidRunSummary> {
  await ensureDir();
  const startedAt = new Date().toISOString();
  let finishedAt = '';
  const consents = await secureRead<any>(SOURCE_CONSENTS);
  const researchUsers = new Set(
    consents.filter((c) => c.status === 'active' && (c.scope || []).includes('research')).map((c) => (c.patient || '').replace('Patient/', ''))
  );
  const responses = await secureRead<any>(SOURCE_RESPONSES, (r) => researchUsers.has(r.userId));
  const diary = await secureRead<any>(SOURCE_DIARY, (d) => d.kind === 'entry' && researchUsers.has(d.userId));

  const includedUsers = new Set<string>();
  const deidResponses: DeidResponse[] = responses.map((r: any, idx: number) => {
    const pseudo = pseudonymize(r.userId);
    includedUsers.add(r.userId);
    return {
      resourceType: 'QuestionnaireResponse',
      id: `dqr-${idx + 1}`,
      pseudoId: pseudo.pseudonym,
      questionnaireId: r.questionnaireId,
      authoredMonth: (r.submittedAt || '').slice(0, 7),
      score: r.computed?.score ?? 0,
      interpretation: r.computed?.interpretation ?? '',
    };
  });

  const deidObservations: DeidObservation[] = [];
  // assessment score observations
  responses.forEach((r: any, idx: number) => {
    const pseudo = pseudonymize(r.userId);
    includedUsers.add(r.userId);
    deidObservations.push({
      resourceType: 'Observation',
      subject: { reference: `Patient/${pseudo.pseudonym}` },
      effectiveMonth: (r.submittedAt || '').slice(0, 7),
      code: { text: 'Assessment Score' },
      valueQuantity: { value: r.computed?.score ?? 0 },
    });
  });
  // diary mood/symptom observations
  diary.forEach((d: any) => {
    const pseudo = pseudonymize(d.userId);
    includedUsers.add(d.userId);
    const month = (d.date || '').slice(0, 7);
    deidObservations.push({
      resourceType: 'Observation',
      subject: { reference: `Patient/${pseudo.pseudonym}` },
      effectiveMonth: month,
      code: { text: 'Mood' },
      valueInteger: d.mood,
    });
    deidObservations.push({
      resourceType: 'Observation',
      subject: { reference: `Patient/${pseudo.pseudonym}` },
      effectiveMonth: month,
      code: { text: 'Symptom Score' },
      valueInteger: d.symptomScore,
    });
  });

  await fs.writeFile(RESPONSES_PATH, JSON.stringify(deidResponses, null, 2), 'utf8');
  await fs.writeFile(OBS_PATH, JSON.stringify(deidObservations, null, 2), 'utf8');
  await fs.writeFile(
    INDEX_PATH,
    JSON.stringify(
      {
        pseudonymVersion: process.env.DEID_PSEUDONYM_VERSION || 'v1',
        pseudonyms: Array.from(includedUsers).map((u) => pseudonymize(u).pseudonym),
        datasetVersion: 'v1',
        generatedAt: finishedAt,
        kSuppressionThreshold: 5,
      },
      null,
      2
    ),
    'utf8'
  );

  const runId = `deid-${Date.now()}`;
  finishedAt = new Date().toISOString();
  const summary: DeidRunSummary = {
    runId,
    startedAt,
    finishedAt,
    processedUsers: consents.length,
    includedUsers: includedUsers.size,
    excludedUsers: consents.length - includedUsers.size,
    outputsWritten: { responses: deidResponses.length, observations: deidObservations.length },
  };

  const runs = await readRuns();
  runs.push(summary);
  await fs.writeFile(RUNS_PATH, JSON.stringify(runs, null, 2), 'utf8');

  return summary;
}

export async function latestDeidStatus() {
  await ensureDir();
  const runs = await readRuns();
  const latest = runs.length ? runs[runs.length - 1] : null;
  const responses = await readJsonSafe(RESPONSES_PATH);
  const obs = await readJsonSafe(OBS_PATH);
  const indexRaw = (await readJsonSafe(INDEX_PATH)) as any;
  const pseudoCount = Array.isArray(indexRaw.pseudonyms) ? indexRaw.pseudonyms.length : 0;
  const k = indexRaw.kSuppressionThreshold ?? 5;
  return {
    latestRun: latest,
    stats: {
      responses: responses.length,
      observations: obs.length,
      pseudonyms: pseudoCount,
    },
    dataset: {
      datasetVersion: indexRaw.datasetVersion || 'v1',
      pseudonymVersion: indexRaw.pseudonymVersion || process.env.DEID_PSEUDONYM_VERSION || 'v1',
      kSuppressionThreshold: k,
    },
  };
}

export async function deidDatasetSummary() {
  const responses = await readJsonSafe(RESPONSES_PATH);
  const obs = await readJsonSafe(OBS_PATH);
  const pseudoIds = new Set<string>();
  responses.forEach((r: any) => {
    if (r.pseudoId) pseudoIds.add(r.pseudoId);
    if (r.subject?.reference?.startsWith('Patient/')) pseudoIds.add(r.subject.reference.replace('Patient/', ''));
  });
  obs.forEach((o: any) => {
    if (o.subject?.reference?.startsWith('Patient/')) pseudoIds.add(o.subject.reference.replace('Patient/', ''));
  });
  const cohortSize = pseudoIds.size;
  return { cohortSize, counts: { responses: responses.length, observations: obs.length } };
}

export async function deidDatasetAggregate() {
  const responses = await readJsonSafe(RESPONSES_PATH);
  const obs = await readJsonSafe(OBS_PATH);
  const pseudoIds = new Set<string>();
  responses.forEach((r: any) => {
    if (r.pseudoId) pseudoIds.add(r.pseudoId);
    if (r.subject?.reference?.startsWith('Patient/')) pseudoIds.add(r.subject.reference.replace('Patient/', ''));
  });
  obs.forEach((o: any) => {
    if (o.subject?.reference?.startsWith('Patient/')) pseudoIds.add(o.subject.reference.replace('Patient/', ''));
  });
  const cohortSize = pseudoIds.size;
  if (cohortSize < K_SUPPRESSION) return { cohortSize };
  const byQuestionnaire: Record<string, number[]> = {};
  responses.forEach((r: any) => {
    byQuestionnaire[r.questionnaireId] = byQuestionnaire[r.questionnaireId] || [];
    byQuestionnaire[r.questionnaireId].push(r.score);
  });
  const assessmentAggregates = Object.entries(byQuestionnaire).map(([id, scores]) => ({
    questionnaireId: id,
    meanScore: scores.reduce((s, v) => s + v, 0) / scores.length,
    medianScore: scores.slice().sort((a, b) => a - b)[Math.floor(scores.length / 2)] || 0,
    count: scores.length,
  }));
  const moodValues = obs.filter((o: any) => o.code?.text === 'Mood').map((o: any) => o.valueInteger ?? o.valueQuantity?.value);
  const symptomValues = obs
    .filter((o: any) => o.code?.text === 'Symptom Score')
    .map((o: any) => o.valueInteger ?? o.valueQuantity?.value);
  const diaryAggregates = {
    avgMood: moodValues.length ? moodValues.reduce((s, v) => s + v, 0) / moodValues.length : null,
    avgSymptom: symptomValues.length ? symptomValues.reduce((s, v) => s + v, 0) / symptomValues.length : null,
  };
  return { cohortSize, assessmentAggregates, diaryAggregates };
}

async function readJsonSafe(filePath: string): Promise<any[]> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
