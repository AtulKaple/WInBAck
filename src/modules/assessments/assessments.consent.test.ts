import fs from 'fs/promises';
import path from 'path';
import assessmentsRouter from './routes';
import { ConsentStore, CONSENT_STORE_PATH } from '../consent/store';

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');
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
        item: [],
        scoring: { method: 'sum', interpretation: [{ min: 0, max: 27, label: 'Range' }] },
      },
    ]),
    'utf8'
  );
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
});

describe('Assessments consent gating', () => {
  it('blocks patient listing without consent', async () => {
    const handlers = getHandlers('/', 'get');
    const res = await runHandlers(handlers, { authContext: { userId: 'test-patient-1', role: 'patient', source: 'stub' }, query: {}, params: {}, body: {} });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('CONSENT_REQUIRED');
  });

  it('allows patient listing with active consent', async () => {
    const store = new ConsentStore();
    await store.append(
      {
        resourceType: 'Consent',
        id: 'consent-1',
        patient: 'Patient/test-patient-1',
        status: 'active',
        scope: ['assessments'],
        provision: {},
        dateTime: new Date().toISOString(),
        performer: 'test-patient-1',
      } as any,
      { userId: 'test-patient-1', role: 'patient' }
    );

    const handlers = getHandlers('/', 'get');
    const res = await runHandlers(handlers, { authContext: { userId: 'test-patient-1', role: 'patient', source: 'stub' }, query: {}, params: {}, body: {} });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0]?.id).toBe('phq9');
  });

  it('allows admin listing without consent', async () => {
    const handlers = getHandlers('/', 'get');
    const res = await runHandlers(handlers, { authContext: { userId: 'admin-1', role: 'admin', source: 'stub' }, query: {}, params: {}, body: {} });
    expect(res.statusCode).toBe(200);
  });
});
