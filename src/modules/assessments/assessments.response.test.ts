import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../../app';
import { CONSENT_STORE_PATH } from '../consent/store';
import { secureReadAll } from '../../security/secureWrite';
jest.spyOn(app, 'listen').mockImplementation((...args: any[]) => {
  const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  if (cb) cb();
  return { address: () => ({ address: '127.0.0.1', port: 0 }), close: () => {} } as any;
});
const client = () => request(app);

const mkToken = (role: 'patient' | 'admin', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');
const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');

const patientHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${mkToken('patient', 'test-patient-1')}`,
};

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 1).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(
    QUESTIONNAIRES_PATH,
    JSON.stringify([
      {
        resourceType: 'Questionnaire',
        id: 'phq-9',
        title: 'PHQ-9',
        status: 'active',
        item: [
          {
            linkId: 'q1',
            text: 'One',
            type: 'choice',
            answerOption: [{ valueCoding: { code: '0', display: 'Zero' }, valueInteger: 0 }],
          },
        ],
        scoring: { method: 'sum', interpretation: [{ min: 0, max: 10, label: 'Low' }] },
      },
    ]),
    'utf8'
  );
  await fs.writeFile(RESPONSES_PATH, '[]', 'utf8');
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
});

describe('Assessment submission storage', () => {
  const consentPayload = {
    resourceType: 'Consent',
    id: 'consent-test',
    patient: 'Patient/test-patient-1',
    status: 'active',
    scope: ['assessments'],
    provision: {},
    dateTime: new Date().toISOString(),
    performer: 'test-patient-1',
  };

  it('stores QuestionnaireResponse and Observation on submit', async () => {
    await client().post('/api/consent').set(patientHeaders).send(consentPayload).expect(201);
    const submitRes = await client()
      .post('/api/assessments/phq-9/submit')
      .set(patientHeaders)
      .send({ answers: { q1: '0' } });
    expect(submitRes.status).toBe(201);
    const stored = await secureReadAll(RESPONSES_PATH);
    expect(stored[0].response.resourceType).toBe('QuestionnaireResponse');
    expect(stored[0].observation.resourceType).toBe('Observation');
    expect(stored[0].computed.score).toBeDefined();
  });

  it('results endpoint returns minimal fields', async () => {
    await client().post('/api/consent').set(patientHeaders).send(consentPayload).expect(201);
    await client()
      .post('/api/assessments/phq-9/submit')
      .set(patientHeaders)
      .send({ answers: { q1: '0' } })
      .expect(201);

    const res = await client().get('/api/assessments/phq-9/results').set(patientHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('score');
    expect(res.body.data).not.toHaveProperty('response');
    expect(res.body.data.responseId).toBeDefined();
    expect(res.body.data.observationId).toBeDefined();
  });
});
