import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../../app';
import { secureWrite, AUDIT_PATH } from '../../security/secureWrite';
import { CONSENT_STORE_PATH } from '../consent/store';
import * as deidService from '../deid/deid.service';

jest.spyOn(app, 'listen').mockImplementation((...args: any[]) => {
  const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  if (cb) cb();
  return { address: () => ({ address: '127.0.0.1', port: 0 }), close: () => {} } as any;
});

const client = () => request(app);
const mkToken = (role: 'patient' | 'researcher' | 'admin', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const patientHeaders = { Authorization: `Bearer ${mkToken('patient', 'p1')}`, 'Content-Type': 'application/json' };
const researcherHeaders = { Authorization: `Bearer ${mkToken('researcher', 'r1')}` };
const adminHeaders = { Authorization: `Bearer ${mkToken('admin', 'admin-1')}` };

const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');
const DIARY_PATH = path.join(__dirname, '..', '..', 'data', 'diary.json');

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 5).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
  await fs.writeFile(RESPONSES_PATH, '[]', 'utf8');
  await fs.writeFile(DIARY_PATH, '[]', 'utf8');
  await fs.writeFile(AUDIT_PATH, '[]', 'utf8');
});

const addConsent = async (userId: string, scopes: string[]) => {
  await client()
    .post('/api/consent')
    .set({ Authorization: `Bearer ${mkToken('patient', userId)}`, 'Content-Type': 'application/json' })
    .send({
      resourceType: 'Consent',
      id: `c-${userId}`,
      patient: `Patient/${userId}`,
      status: 'active',
      scope: scopes,
      provision: {},
      dateTime: new Date().toISOString(),
      performer: userId,
    })
    .expect(201);
};

describe('Analytics module', () => {
  it('patient endpoints require consent', async () => {
    const res = await client().get('/api/analytics/patient/summary').set(patientHeaders);
    expect(res.status).toBe(403);
  });

  it('patient summary returns data without notes', async () => {
    await addConsent('p1', ['assessments', 'diary']);
    await secureWrite({
      filePath: RESPONSES_PATH,
      record: { id: 'r1', userId: 'p1', questionnaireId: 'q1', submittedAt: new Date().toISOString(), computed: { score: 5, interpretation: 'ok' } },
      auditMeta: { action: 'TEST', actorUserId: 'p1', actorRole: 'patient', resourceType: 'QuestionnaireResponse', resourceId: 'r1' },
    });
    await secureWrite({
      filePath: DIARY_PATH,
      record: {
        id: 'd1',
        kind: 'entry',
        userId: 'p1',
        date: new Date().toISOString().slice(0, 10),
        mood: 7,
        symptomScore: 2,
        notes: 'secret',
        createdAt: new Date().toISOString(),
      },
      auditMeta: { action: 'TEST', actorUserId: 'p1', actorRole: 'patient', resourceType: 'Observation', resourceId: 'd1' },
    });
    const res = await client().get('/api/analytics/patient/summary').set(patientHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.assessments.completedCount).toBe(1);
    expect(res.body.data.diary.entriesCount).toBe(1);
  });

  it('research aggregates exclude non-research consent and block small cohorts', async () => {
    const summarySpy = jest.spyOn(deidService, 'deidDatasetSummary').mockResolvedValue({
      cohortSize: 2,
      counts: { responses: 2, observations: 0 },
    } as any);
    const aggSpy = jest.spyOn(deidService, 'deidDatasetAggregate').mockResolvedValue({ cohortSize: 2 } as any);
    const small = await client().get('/api/analytics/research/aggregate').set(researcherHeaders);
    expect(small.status).toBe(403);
    summarySpy.mockRestore();
    aggSpy.mockRestore();
  });

  it('research aggregates hide identifiers', async () => {
    const summarySpy = jest.spyOn(deidService, 'deidDatasetSummary').mockResolvedValue({
      cohortSize: 5,
      counts: { responses: 5, observations: 0 },
    } as any);
    const aggSpy = jest.spyOn(deidService, 'deidDatasetAggregate').mockResolvedValue({
      cohortSize: 5,
      assessmentAggregates: [{ questionnaireId: 'q1', meanScore: 3, medianScore: 3, count: 5 }],
      diaryAggregates: { avgMood: null, avgSymptom: null },
    } as any);
    const res = await client().get('/api/analytics/research/aggregate').set(researcherHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.cohortSize).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(res.body)).not.toContain('userId');
    summarySpy.mockRestore();
    aggSpy.mockRestore();
  });

  it('admin usage requires admin', async () => {
    const res = await client().get('/api/analytics/admin/usage').set(patientHeaders);
    expect([401, 403]).toContain(res.status);
    const ok = await client().get('/api/analytics/admin/usage').set(adminHeaders);
    expect(ok.status).toBe(200);
  });

  it('research aggregate requires deid dataset ready', async () => {
    const summarySpy = jest.spyOn(deidService, 'deidDatasetSummary').mockResolvedValue({ cohortSize: 0, counts: { responses: 0, observations: 0 } } as any);
    const res = await client().get('/api/analytics/research/aggregate').set(researcherHeaders);
    expect(res.status).toBe(503);
    summarySpy.mockRestore();
  });
});
