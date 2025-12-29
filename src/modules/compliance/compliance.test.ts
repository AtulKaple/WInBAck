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

const mkToken = (role: 'patient' | 'admin', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const adminHeaders = { Authorization: `Bearer ${mkToken('admin', 'admin-1')}` };

const patientHeaders = { Authorization: `Bearer ${mkToken('patient', 'test-patient-1')}` };

const DIARY_PATH = path.join(__dirname, '..', '..', 'data', 'diary.json');

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 3).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(AUDIT_PATH, JSON.stringify([
    { ts: new Date().toISOString(), action: 'consent.write', actorUserId: 'test-patient-1', actorRole: 'patient', resourceType: 'Consent', resourceId: 'c1', hash: 'h1', prevHash: '', ciphertext: 'x' }
  ], null, 2), 'utf8');
  await fs.writeFile(DIARY_PATH, '[]', 'utf8');
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
});

describe('Compliance endpoints', () => {
  it('requires admin', async () => {
    const res = await client().get('/api/compliance/assessments').set(patientHeaders);
    expect([401, 403]).toContain(res.status);
  });

  it('returns compliance info for admin', async () => {
    const res = await client().get('/api/compliance/assessments').set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('consentGateEnabled', true);
    expect(res.body).toHaveProperty('diaryConsentGateEnabled', true);
  });

  it('audit endpoint returns non-PHI fields', async () => {
    const res = await client().get('/api/compliance/audit?module=assessments').set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).not.toHaveProperty('ciphertext');
    expect(res.body.data[0]).toHaveProperty('resourceType');
  });

  it('audit endpoint filters diary module metadata only', async () => {
    await fs.writeFile(AUDIT_PATH, JSON.stringify([
      { ts: new Date().toISOString(), action: 'DIARY_CREATE', actorUserId: 'p1', actorRole: 'patient', resourceType: 'Observation', resourceId: 'd1', hash: 'h2', prevHash: '', ciphertext: 'secret' },
    ], null, 2), 'utf8');
    const res = await client().get('/api/compliance/audit?module=diary').set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('ciphertext');
    expect(res.body.data[0].action).toBe('DIARY_CREATE');
  });

  it('diary admin stats requires admin and returns counts', async () => {
    // patient blocked
    const blocked = await client().get('/api/diary/admin/stats').set(patientHeaders);
    expect([401, 403]).toContain(blocked.status);

    // create consent and diary entry
    await client().post('/api/consent').set(patientHeaders).send({
      resourceType: 'Consent',
      id: 'c1',
      patient: 'Patient/test-patient-1',
      status: 'active',
      scope: ['diary'],
      provision: {},
      dateTime: new Date().toISOString(),
      performer: 'test-patient-1',
    });
    await client().post('/api/diary').set({ ...patientHeaders, 'Content-Type': 'application/json' }).send({ date: '2025-01-05', mood: 5, symptomScore: 2, notes: 'note' });

    const res = await client().get('/api/diary/admin/stats').set(adminHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data.totalEntries).toBeGreaterThan(0);
    expect(res.body.data).not.toHaveProperty('notes');
  });
});
