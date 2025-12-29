import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../../app';
import { CONSENT_STORE_PATH } from '../consent/store';
jest.spyOn(app, 'listen').mockImplementation((...args: any[]) => {
  const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  if (cb) cb();
  return { address: () => ({ address: '127.0.0.1', port: 0 }), close: () => {} } as any;
});
const client = () => request(app);
import { fhirQuestionnaireSchema } from './schema';

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');

const mkToken = (role: 'admin', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const adminHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${mkToken('admin', 'admin-1')}`,
};

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 1).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(QUESTIONNAIRES_PATH, '[]', 'utf8');
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
});

describe('Assessments FHIR storage', () => {
  it('stores simplified upload as FHIR Questionnaire', async () => {
    const simplified = {
      id: 'daily-check',
      title: 'Daily Check',
      description: 'Simple',
      version: '1.0.0',
      updatedAt: '2025-01-01T00:00:00Z',
      questions: [
        {
          id: 'q1',
          text: 'How are you?',
          type: 'mcq',
          required: true,
          options: [
            { id: 'a', label: 'Good', value: 1 },
            { id: 'b', label: 'Bad', value: 0 },
          ],
        },
      ],
      scoring: {
        method: 'sum',
        interpretation: [{ min: 0, max: 10, label: 'Any' }],
      },
    };

    const res = await client().post('/api/assessments').set(adminHeaders).send(simplified);
    expect(res.status).toBe(201);
    const stored = JSON.parse(await fs.readFile(QUESTIONNAIRES_PATH, 'utf8'));
    expect(stored[0].resourceType).toBe('Questionnaire');
    expect(fhirQuestionnaireSchema.safeParse(stored[0]).success).toBe(true);
  });

  it('rejects unsupported resourceType', async () => {
    const badPayload = { resourceType: 'Observation', id: 'bad' };
    const res = await client().post('/api/assessments').set(adminHeaders).send(badPayload);
    expect(res.status).toBe(400);
  });
});
