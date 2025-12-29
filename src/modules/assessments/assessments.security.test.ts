import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../../app';
import { AUDIT_PATH } from '../../security/secureWrite';
import { CONSENT_STORE_PATH } from '../consent/store';
jest.spyOn(app, 'listen').mockImplementation((...args: any[]) => {
  const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  if (cb) cb();
  return { address: () => ({ address: '127.0.0.1', port: 0 }), close: () => {} } as any;
});
const client = () => request(app);

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');
const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');

const mkToken = (role: 'patient' | 'admin', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const patientHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${mkToken('patient', 'test-patient-1')}`,
};

const adminHeaders = {
  Authorization: `Bearer ${mkToken('admin', 'admin-1')}`,
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
          { linkId: 'q1', text: 'One', type: 'choice', answerOption: [{ valueCoding: { code: '0', display: 'Zero' }, valueInteger: 0 }] },
        ],
        scoring: { method: 'sum', interpretation: [{ min: 0, max: 10, label: 'Any' }] },
      },
    ]),
    'utf8'
  );
  await fs.writeFile(RESPONSES_PATH, '[]', 'utf8');
  await fs.writeFile(AUDIT_PATH, '[]', 'utf8');
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
});

describe('Assessments security', () => {
  it('blocks submit/results without consent', async () => {
    const submit = await client().post('/api/assessments/phq-9/submit').set(patientHeaders).send({ answers: { q1: '0' } });
    expect(submit.status).toBe(403);
    expect(submit.body.error).toBe('CONSENT_REQUIRED');

    const results = await client().get('/api/assessments/phq-9/results').set(patientHeaders);
    expect(results.status).toBe(403);
  });

  it('allows with consent and returns minimal results', async () => {
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
    await client().post('/api/consent').set(patientHeaders).send(consentPayload).expect(201);

    const submit = await client().post('/api/assessments/phq-9/submit').set(patientHeaders).send({ answers: { q1: '0' } });
    expect(submit.status).toBe(201);

    const results = await client().get('/api/assessments/phq-9/results').set(patientHeaders);
    expect(results.status).toBe(200);
    expect(results.body.data).toHaveProperty('score');
    expect(results.body.data).not.toHaveProperty('response');
    expect(results.body.data).not.toHaveProperty('answers');
    expect(results.body.data).not.toHaveProperty('item');
  });

  it('detects ledger tampering', async () => {
    await fs.writeFile(
      AUDIT_PATH,
      JSON.stringify([
        { ts: '1', action: 'a', actorUserId: 'x', actorRole: 'patient', resourceType: 'Consent', resourceId: '1', hash: 'bad', prevHash: '', ciphertext: 'x' },
      ]),
      'utf8'
    );
    const compliance = await client().get('/api/compliance/assessments').set(adminHeaders);
    expect(compliance.status).toBe(200);
    expect(compliance.body.ledger.ok).toBe(false);
  });

  it('logger does not emit answers key', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const { safeLogger } = require('../../security/safeLogger');
    safeLogger.info('test', { answers: { q1: 'a' }, other: 'ok' });
    const payload = spy.mock.calls[0][1];
    expect(payload.answers).toBe('[REDACTED]');
    spy.mockRestore();
  });
});
