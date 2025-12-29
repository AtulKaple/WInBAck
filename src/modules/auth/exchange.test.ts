import fs from 'fs/promises';
import path from 'path';
import authRouter from './routes';
import { getLatestConsent } from '../consent/service';
import { CONSENT_STORE_PATH } from '../consent/store';

type MockRes = ReturnType<typeof createMockRes>;

function createMockRes() {
  const headers: Record<string, string[]> = {};
  const res: any = {
    statusCode: 200,
    body: null,
    headers,
    setHeader(name: string, value: any) {
      headers[name.toLowerCase()] = Array.isArray(value) ? value : [value];
      return res;
    },
    append(name: string, value: any) {
      const key = name.toLowerCase();
      headers[key] = (headers[key] || []).concat(Array.isArray(value) ? value : [value]);
      return res;
    },
    cookie(name: string, value: string, opts: any = {}) {
      const parts = [`${name}=${value}`];
      if (opts.httpOnly) parts.push('HttpOnly');
      if (opts.secure) parts.push('Secure');
      if (opts.sameSite) parts.push(`SameSite=${typeof opts.sameSite === 'string' ? opts.sameSite[0].toUpperCase() + opts.sameSite.slice(1) : opts.sameSite}`);
      if (opts.path) parts.push(`Path=${opts.path}`);
      if (opts.maxAge) parts.push(`Max-Age=${Math.floor(opts.maxAge / 1000)}`);
      res.append('Set-Cookie', parts.join('; '));
      return res;
    },
    clearCookie(name: string, opts: any = {}) {
      res.cookie(name, '', { ...opts, maxAge: 0 });
    },
    json(payload: any) {
      res.body = payload;
      return res;
    },
    end(body?: any) {
      res.body = body;
      if (typeof res._onfinish === 'function') res._onfinish();
      return res;
    },
    send(body?: any) {
      return res.end(body);
    },
    on(event: string, cb: () => void) {
      if (event === 'finish') res._onfinish = cb;
      return res;
    },
  };
  return res;
}

const findHandlers = (pathMatch: string, method: string) => {
  const layer: any = (authRouter as any).stack.find((l: any) => l.route && l.route.path === pathMatch && l.route.methods[method]);
  if (!layer) throw new Error(`Handler for ${method.toUpperCase()} ${pathMatch} not found`);
  return layer.route.stack.map((s: any) => s.handle);
};

describe('/api/auth/exchange cookies', () => {
  const originalEnv = process.env.NODE_ENV;
  beforeEach(async () => {
    process.env.APP_MASTER_KEY = Buffer.alloc(32, 9).toString('base64');
    await fs.mkdir(path.dirname(CONSENT_STORE_PATH), { recursive: true });
    await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
  });
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('sets HttpOnly session cookie in allowlist and rotates value', async () => {
    const handlers = findHandlers('/exchange', 'post');
    const handler = handlers[handlers.length - 1];
    const res1: MockRes = createMockRes();
    const res2: MockRes = createMockRes();
    const baseReq = { authContext: { userId: 'user-1', role: 'patient', source: 'stub' } };
    await handler(baseReq, res1, () => {});
    await handler(baseReq, res2, () => {});

    const cookies = (res: MockRes) => (res.headers['set-cookie'] || []);
    const c1 = cookies(res1).join(' ');
    const c2 = cookies(res2).join(' ');

    expect(c1).toMatch(/ws_session/);
    expect(c1.toLowerCase()).toContain('httponly');
    expect(c1).toContain('Path=/');
    expect(c1).toContain('SameSite=Strict');
    expect(res1.body?.sessionId).not.toEqual(res2.body?.sessionId);
    expect(c1).not.toEqual(c2);
  });

  it('marks cookie Secure in production', async () => {
    process.env.NODE_ENV = 'production';
    const handlers = findHandlers('/exchange', 'post');
    const handler = handlers[handlers.length - 1];
    const res: MockRes = createMockRes();
    const req = { authContext: { userId: 'user-1', role: 'patient', source: 'stub' } };
    await handler(req, res, () => {});
    const cookie = (res.headers['set-cookie'] || []).join(' ');
    expect(cookie).toContain('Secure');
    expect(cookie).toMatch(/__Host-ws_session/);
  });

  it('provisions default assessments consent for patient logins', async () => {
    const handlers = findHandlers('/exchange', 'post');
    const handler = handlers[handlers.length - 1];
    const res: MockRes = createMockRes();
    const req = { authContext: { userId: 'patient-1', role: 'patient', source: 'stub' } };

    await handler(req, res, () => {});

    const consent = await getLatestConsent('patient-1');
    expect(consent?.status).toBe('active');
    expect(consent?.scope).toContain('assessments');
    expect(consent?.patient).toBe('Patient/patient-1');
  });

  it('does not alter consent for admin logins', async () => {
    const handlers = findHandlers('/exchange', 'post');
    const handler = handlers[handlers.length - 1];
    const res: MockRes = createMockRes();
    const req = { authContext: { userId: 'admin-1', role: 'admin', source: 'stub' } };

    await handler(req, res, () => {});

    const contents = await fs.readFile(CONSENT_STORE_PATH, 'utf8');
    expect(contents.trim()).toBe('[]');
  });
});
