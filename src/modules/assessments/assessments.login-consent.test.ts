import fs from 'fs/promises';
import path from 'path';
import { CONSENT_STORE_PATH } from '../consent/store';

const QUESTIONNAIRES_PATH = path.join(__dirname, '..', '..', 'data', 'questionnaires.json');

const findHandlers = (router: any, pathMatch: string, method: string) => {
  const layer: any = (router as any).stack.find((l: any) => l.route && l.route.path === pathMatch && l.route.methods[method]);
  if (!layer) throw new Error(`Handler for ${method.toUpperCase()} ${pathMatch} not found`);
  return layer.route.stack.map((s: any) => s.handle);
};

const runHandlers = async (handlers: any[], req: any) => {
  const res: any = {
    statusCode: 200,
    body: undefined,
    sent: false,
    headers: {} as Record<string, any>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.sent = true;
      return this;
    },
    cookie(name: string, value: string, opts: any = {}) {
      const parts = [`${name}=${value}`];
      if (opts.httpOnly) parts.push('HttpOnly');
      if (opts.secure) parts.push('Secure');
      if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
      if (opts.path) parts.push(`Path=${opts.path}`);
      this.headers['set-cookie'] = (this.headers['set-cookie'] || []).concat(parts.join('; '));
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

describe('Patient login consent reset + assessment availability', () => {
  beforeEach(async () => {
    process.env.APP_MASTER_KEY = Buffer.alloc(32, 7).toString('base64');
    await fs.mkdir(path.dirname(CONSENT_STORE_PATH), { recursive: true });
    await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
    await fs.writeFile(QUESTIONNAIRES_PATH, '[]', 'utf8');
    jest.resetModules();
  });

  it('auto-provisions assessment consent on login and returns seeded surveys', async () => {
    // fresh import to ensure login handler uses clean module state
    const authRouter = require('../auth/routes').default;
    const exchangeHandlers = findHandlers(authRouter, '/exchange', 'post');
    const loginReq = { authContext: { userId: 'seed-patient-1', role: 'patient', source: 'stub' } };
    await runHandlers(exchangeHandlers, loginReq);

    // Re-import the assessments router after reset to let seeds run on a fresh file
    const freshAssessmentsRouter = require('./routes').default;
    const listHandlers = findHandlers(freshAssessmentsRouter, '/', 'get');
    const res = await runHandlers(listHandlers, { authContext: loginReq.authContext, query: {}, params: {}, body: {} });

    expect(res.statusCode).toBe(200);
    const ids = (res.body.data || []).map((q: any) => q.id);
    expect(ids).toEqual(expect.arrayContaining(['phq9', 'gad7', 'who5']));
  });
});
