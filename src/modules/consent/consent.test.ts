import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../../app';
import { CONSENT_STORE_PATH } from './store';
jest.spyOn(app, 'listen').mockImplementation((...args: any[]) => {
  const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  if (cb) cb();
  return {
    address: () => ({ address: '127.0.0.1', port: 0 }),
    close: () => {},
  } as any;
});
const client = () => request(app);

const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');
const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');

const mkToken = (role: 'patient', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const patientHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${mkToken('patient', 'test-patient-1')}`,
};

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 1).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
  await fs.writeFile(RESPONSES_PATH, '[]', 'utf8');
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
          {
            linkId: 'q2',
            text: 'Two',
            type: 'choice',
            answerOption: [{ valueCoding: { code: '1', display: 'One' }, valueInteger: 1 }],
          },
        ],
        scoring: { method: 'sum', interpretation: [{ min: 0, max: 10, label: 'Any' }] },
      },
    ]),
    'utf8'
  );
});

const submitAnswers = () =>
  client()
    .post('/api/assessments/phq-9/submit')
    .set(patientHeaders)
    .send({ answers: { q1: '0', q2: '1' } });

describe('Consent enforcement', () => {
  it('returns 403 when submitting assessment without consent', async () => {
    const res = await submitAnswers();
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: 'CONSENT_REQUIRED', requiredScope: 'assessments' });
  });

  it('allows assessment submit after consent is granted', async () => {
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

    const consentRes = await client().post('/api/consent').set(patientHeaders).send(consentPayload);
    expect(consentRes.status).toBe(201);

    const res = await submitAnswers();
    expect(res.status).toBe(201);
  });

  it('blocks after consent revoke', async () => {
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

    await client().post('/api/consent').set(patientHeaders).send(consentPayload);
    const submitOk = await submitAnswers();
    expect(submitOk.status).toBe(201);

    const revokeRes = await client().post('/api/consent/revoke').set(patientHeaders).send({});
    expect(revokeRes.status).toBe(200);

    const blocked = await submitAnswers();
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('CONSENT_REQUIRED');
  });
});
