import fs from 'fs/promises';
import path from 'path';
import router from './routes';
import { AUDIT_PATH } from '../../security/secureWrite';

const adminHeaders = { authorization: 'Bearer admin' };
const patientHeaders = { authorization: 'Bearer patient' };

async function callRoute(method: 'get' | 'post', routePath: string, headers: any = {}, body: any = {}) {
  return new Promise<{ statusCode: number; body: any }>((resolve) => {
    const req: any = {
      method: method.toUpperCase(),
      url: routePath,
      path: routePath,
      headers,
      body,
    };
    const token = (headers.authorization || '').toLowerCase();
    req.authContext = token.includes('admin') ? { userId: 'admin-1', role: 'admin' } : { userId: 'p1', role: 'patient' };
    const res: any = {
      statusCode: 200,
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        resolve({ statusCode: this.statusCode, body: this.body });
      },
    };
    const layer = (router as any).stack.find((l: any) => l.route && l.route.path === routePath);
    if (!layer) return resolve({ statusCode: 404, body: { error: 'not found' } });
    const handlers = layer.route.stack.filter((s: any) => s.method === method).map((s: any) => s.handle);
    if (!handlers.length) return resolve({ statusCode: 405, body: { error: 'method' } });
    let idx = 0;
    const next = () => {
      const h = handlers[idx++];
      if (!h) return resolve({ statusCode: res.statusCode, body: res.body });
      h(req, res, next);
    };
    next();
  });
}

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 4).toString('base64');
  process.env.DEID_PSEUDONYM_SECRET = Buffer.alloc(32, 7).toString('hex');
  process.env.INTERNAL_NOTIFICATION_KEY = 'int-key';
});

beforeEach(async () => {
  await fs.writeFile(AUDIT_PATH, JSON.stringify([
    { ts: '1', action: 'a', actorUserId: 'u', actorRole: 'patient', resourceType: 'Consent', resourceId: '1', hash: 'h1', prevHash: '', ciphertext: 'x' }
  ], null, 2), 'utf8');
});

describe('system status endpoints', () => {
  it('requires admin for status', async () => {
    const res = await callRoute('get', '/status', patientHeaders);
    expect([401, 403]).toContain(res.statusCode);
  });

  it('returns status for admin', async () => {
    const res = await callRoute('get', '/status', adminHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('version', '1.0');
    expect(res.body.controls.length).toBeGreaterThan(0);
    const ids = res.body.controls.map((c: any) => c.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'RESEARCH_DEID_ONLY',
        'RESEARCH_CONSENT_FILTER',
        'PATIENT_MIN_NECESSARY',
        'DEID_PIPELINE_PRESENT',
        'DEID_CONSENT_FILTER',
        'DEID_PSEUDONYMIZATION',
        'DEID_TEXT_EXCLUSION',
        'DEID_SMALL_N_GUARD',
        'RESEARCH_READS_DEID_ONLY',
        'COOKIE_POLICY',
        'COOKIES_NO_HEALTH_SEMANTICS',
        'COOKIE_ALLOWLIST_ENFORCED',
        'AUTH_COOKIE_FLAGS',
        'CSRF_GUARD_ENABLED',
        'THIRD_PARTY_COOKIES_DISABLED',
        'NOTIF_SCRUBBER_ENFORCED',
        'NOTIF_INTERNAL_PUBLISH_PROTECTED',
        'NOTIF_PHI_LEAK_PROTECTION',
      ])
    );
  });

  it('ledger verify detects tamper', async () => {
    await fs.writeFile(AUDIT_PATH, JSON.stringify([{ ts: '1', action: 'a', actorUserId: 'u', actorRole: 'patient', resourceType: 'Consent', resourceId: '1', hash: 'bad', prevHash: '', ciphertext: 'x' }], null, 2), 'utf8');
    const res = await callRoute('get', '/ledger/verify', adminHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(false);
  });

  it('fails encryption check if APP_MASTER_KEY missing', async () => {
    const backup = process.env.APP_MASTER_KEY;
    delete process.env.APP_MASTER_KEY;
    const res = await callRoute('get', '/status', adminHeaders);
    expect(res.body.controls.find((c: any) => c.id === 'ENCRYPTION').status).toBe('fail');
    process.env.APP_MASTER_KEY = backup;
  });

  it('fails deid pseudonymization if secret missing', async () => {
    const backup = process.env.DEID_PSEUDONYM_SECRET;
    delete process.env.DEID_PSEUDONYM_SECRET;
    const res = await callRoute('get', '/status', adminHeaders);
    const ctrl = res.body.controls.find((c: any) => c.id === 'DEID_PSEUDONYMIZATION');
    expect(ctrl.status).toBe('fail');
    process.env.DEID_PSEUDONYM_SECRET = backup;
  });

  it('warns if internal notification key missing', async () => {
    const backup = process.env.INTERNAL_NOTIFICATION_KEY;
    delete process.env.INTERNAL_NOTIFICATION_KEY;
    const res = await callRoute('get', '/status', adminHeaders);
    const ctrl = res.body.controls.find((c: any) => c.id === 'NOTIF_INTERNAL_PUBLISH_PROTECTED');
    expect(ctrl.status).toBe('warn');
    process.env.INTERNAL_NOTIFICATION_KEY = backup;
  });

  it('/cookies requires admin', async () => {
    const res = await callRoute('get', '/cookies', patientHeaders);
    expect([401, 403]).toContain(res.statusCode);
  });

  it('/cookies returns policy', async () => {
    const res = await callRoute('get', '/cookies', adminHeaders);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.policyVersion).toBeDefined();
    expect(res.body.data.authCookie).toHaveProperty('name');
    expect(res.body.data.csrfEnabled).toBe(true);
  });
});
