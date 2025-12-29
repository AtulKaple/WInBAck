import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../../app';
import { secureWrite } from '../../security/secureWrite';

jest.spyOn(app, 'listen').mockImplementation((...args: any[]) => {
  const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  if (cb) cb();
  return { address: () => ({ address: '127.0.0.1', port: 0 }), close: () => {} } as any;
});

const client = () => request(app);
const mkToken = (role: 'admin' | 'researcher', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const adminHeaders = { Authorization: `Bearer ${mkToken('admin', 'admin-1')}`, 'Content-Type': 'application/json' };
const researcherHeaders = { Authorization: `Bearer ${mkToken('researcher', 'r-1')}` };

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'deid');
const RUNS_PATH = path.join(DATA_DIR, 'deid_runs.json');
const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');
const DIARY_PATH = path.join(__dirname, '..', '..', 'data', 'diary.json');
const CONSENTS_PATH = path.join(__dirname, '..', '..', 'data', 'consents.json');

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 6).toString('base64');
});

beforeEach(async () => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RUNS_PATH, '[]', 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'deid_questionnaire_responses.json'), '[]', 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'deid_observations.json'), '[]', 'utf8');
  await fs.writeFile(path.join(DATA_DIR, 'deid_index.json'), '[]', 'utf8');
  await fs.writeFile(CONSENTS_PATH, '[]', 'utf8');
  await fs.writeFile(RESPONSES_PATH, '[]', 'utf8');
  await fs.writeFile(DIARY_PATH, '[]', 'utf8');
});

const addConsent = async (userId: string, scopes: string[]) => {
  await secureWrite({
    filePath: CONSENTS_PATH,
    record: {
      resourceType: 'Consent',
      id: `c-${userId}`,
      patient: `Patient/${userId}`,
      status: 'active',
      scope: scopes,
      provision: {},
      dateTime: new Date().toISOString(),
      performer: userId,
    },
    auditMeta: { action: 'consent.write', actorUserId: userId, actorRole: 'patient', resourceType: 'Consent', resourceId: `c-${userId}` },
  });
};

const addResponse = async (userId: string, score: number) => {
  await secureWrite({
    filePath: RESPONSES_PATH,
    record: {
      id: `resp-${userId}-${score}`,
      userId,
      questionnaireId: 'phq-9',
      submittedAt: new Date().toISOString(),
      computed: { score, interpretation: 'ok' },
    },
    auditMeta: { action: 'assessment.submit', actorUserId: userId, actorRole: 'patient', resourceType: 'QuestionnaireResponse', resourceId: `resp-${userId}-${score}` },
  });
};

const addDiary = async (userId: string, mood: number) => {
  await secureWrite({
    filePath: DIARY_PATH,
    record: {
      kind: 'entry',
      id: `d-${userId}-${mood}`,
      userId,
      date: new Date().toISOString().slice(0, 10),
      mood,
      symptomScore: mood,
      notes: 'note',
      createdAt: new Date().toISOString(),
      resourceType: 'Observation',
      status: 'final',
      category: 'patient-reported',
      code: { text: 'Daily Symptom Log' },
      subject: { reference: `Patient/${userId}` },
      effectiveDateTime: new Date().toISOString(),
    },
    auditMeta: { action: 'DIARY_CREATE', actorUserId: userId, actorRole: 'patient', resourceType: 'Observation', resourceId: `d-${userId}-${mood}` },
  });
};

describe('deid pipeline', () => {
  it('requires admin to run', async () => {
    const res = await client().post('/api/deid/run').set(researcherHeaders);
    expect([401, 403]).toContain(res.status);
  });

  it('includes only research-consented users', async () => {
    await addConsent('u1', ['research']);
    await addConsent('u2', ['assessments']);
    await addResponse('u1', 5);
    await addResponse('u2', 10);
    await addDiary('u1', 3);
    await addDiary('u2', 9);

    const run = await client().post('/api/deid/run').set(adminHeaders);
    expect(run.status).toBe(200);

    const summaryRes = await client().get('/api/deid/dataset/summary').set(researcherHeaders);
    expect(summaryRes.status).toBe(403);
  });

  it('researcher aggregate uses deid store and small-n suppression', async () => {
    await addConsent('r1', ['research']);
    for (let i = 0; i < 5; i++) {
      const uid = `r${i + 1}`;
      await addConsent(uid, ['research']);
      await addResponse(uid, i + 1);
      await addDiary(uid, i + 2);
    }
    await client().post('/api/deid/run').set(adminHeaders).expect(200);
    const agg = await client().get('/api/deid/dataset/aggregate').set(researcherHeaders);
    expect(agg.status).toBe(200);
    expect(agg.body.data.cohortSize).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(agg.body)).not.toContain('userId');
  });

  it('deid outputs do not include notes or answers and bucket dates to month', async () => {
    await addConsent('u3', ['research']);
    await addDiary('u3', 5);
    await addResponse('u3', 7);
    await client().post('/api/deid/run').set(adminHeaders).expect(200);
    const deidResponsesRaw = await fs.readFile(path.join(DATA_DIR, 'deid_questionnaire_responses.json'), 'utf8');
    const deidResponses = JSON.parse(deidResponsesRaw);
    expect(JSON.stringify(deidResponses)).not.toMatch(/notes|answer/i);
    expect(deidResponses[0].authoredMonth).toHaveLength(7);

    const deidObsRaw = await fs.readFile(path.join(DATA_DIR, 'deid_observations.json'), 'utf8');
    const deidObs = JSON.parse(deidObsRaw);
    expect(JSON.stringify(deidObs)).not.toMatch(/notes|answer/i);
    expect(deidObs[0].effectiveMonth).toHaveLength(7);
  });
});
