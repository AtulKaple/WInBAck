import fs from 'fs/promises';
import path from 'path';
import assessmentsRouter from './routes';
import { secureReadAll } from '../../security/secureWrite';
import { CONSENT_STORE_PATH, ConsentStore } from '../consent/store';

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');
const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 1).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(
    QUESTIONNAIRES_PATH,
    JSON.stringify([
      {
        resourceType: 'Questionnaire',
        id: 'phq9',
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

const getHandlers = (pathMatch: string, method: string) => {
  const layer: any = (assessmentsRouter as any).stack.find((l: any) => l.route && l.route.path === pathMatch && l.route.methods[method]);
  if (!layer) throw new Error(`Handler for ${method.toUpperCase()} ${pathMatch} not found`);
  return layer.route.stack.map((s: any) => s.handle);
};

const runHandlers = async (handlers: any[], req: any) => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    sent: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.sent = true;
      return this;
    },
  };
  for (const handler of handlers) {
    await new Promise<void>((resolve, reject) => {
      try {
        const maybePromise = handler(req, res, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(() => resolve()).catch(reject);
        } else if (handler.length < 3) {
          resolve();
        }
      } catch (err) {
        reject(err);
      }
    });
    if (res.sent) break;
  }
  return res;
};

describe('Assessment attempt history', () => {
  it('stores multiple attempts and returns history when latestOnly=false', async () => {
    // Seed consent entry
    const consentEntry = {
      resourceType: 'Consent',
      id: 'consent-test',
      patient: 'Patient/test-patient-1',
      status: 'active',
      scope: ['assessments'],
      provision: {},
      dateTime: new Date().toISOString(),
      performer: 'test-patient-1',
    };
    const store = new ConsentStore();
    await store.append(consentEntry as any, { userId: 'test-patient-1', role: 'patient' });

    const submitHandlers = getHandlers('/:id/submit', 'post');
    const resultsHandlers = getHandlers('/:id/results', 'get');
    const baseReq = {
      params: { id: 'phq9' },
      body: { answers: { q1: '0' } },
      query: {},
      authContext: { userId: 'test-patient-1', role: 'patient', source: 'stub' },
    };

    const res1 = await runHandlers(submitHandlers, { ...baseReq });
    // reinforce consent freshness between attempts
    await store.append(
      {
        ...consentEntry,
        id: 'consent-test-2',
        dateTime: new Date(Date.now() + 1000).toISOString(),
      } as any,
      { userId: 'test-patient-1', role: 'patient' }
    );
    const res2 = await runHandlers(submitHandlers, { ...baseReq });
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);

    const stored = await secureReadAll<any>(RESPONSES_PATH);
    expect(stored.length).toBe(2);
    expect(stored[0]).toHaveProperty('attemptTimestamp');

    const resAll = await runHandlers(resultsHandlers, {
      ...baseReq,
      query: { latestOnly: 'false' },
    });

    expect(resAll.statusCode).toBe(200);
    expect(Array.isArray(resAll.body.data)).toBe(true);
    expect(resAll.body.data.length).toBe(2);
    expect(new Date(resAll.body.data[0].submittedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(resAll.body.data[1].submittedAt).getTime()
    );
    expect(resAll.body.data[0]).toHaveProperty('attemptTimestamp');
  });
});
