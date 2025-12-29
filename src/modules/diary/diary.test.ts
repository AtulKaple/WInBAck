import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../../app';
import { AUDIT_PATH, secureReadAll } from '../../security/secureWrite';
import { CONSENT_STORE_PATH } from '../consent/store';

jest.spyOn(app, 'listen').mockImplementation((...args: any[]) => {
  const cb = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
  if (cb) cb();
  return { address: () => ({ address: '127.0.0.1', port: 0 }), close: () => {} } as any;
});

const client = () => request(app);

const mkToken = (role: 'patient' | 'admin', sub: string) =>
  Buffer.from(JSON.stringify({ sub, role, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');

const patientHeaders = { Authorization: `Bearer ${mkToken('patient', 'test-patient-1')}`, 'Content-Type': 'application/json' };
const adminHeaders = { Authorization: `Bearer ${mkToken('admin', 'admin-1')}` };

const DIARY_PATH = path.join(__dirname, '..', '..', 'data', 'diary.json');

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 2).toString('base64');
});

beforeEach(async () => {
  await fs.writeFile(DIARY_PATH, '[]', 'utf8');
  await fs.writeFile(CONSENT_STORE_PATH, '[]', 'utf8');
  await fs.writeFile(AUDIT_PATH, '[]', 'utf8');
});

const grantConsent = () =>
  client()
    .post('/api/consent')
    .set(patientHeaders)
    .send({
      resourceType: 'Consent',
      id: 'consent-test',
      patient: 'Patient/test-patient-1',
      status: 'active',
      scope: ['diary'],
      provision: {},
      dateTime: new Date().toISOString(),
      performer: 'test-patient-1',
    });

describe('Diary module', () => {
  it('blocks without consent', async () => {
    const res = await client().post('/api/diary').set(patientHeaders).send({ date: '2025-01-01', mood: 5, symptomScore: 3, notes: 'hi' });
    expect(res.status).toBe(403);
  });

  it('creates diary entry encrypted and logs audit', async () => {
    await grantConsent().expect(201);
    const res = await client().post('/api/diary').set(patientHeaders).send({ date: '2025-01-02', mood: 7, symptomScore: 2, notes: 'private' });
    expect(res.status).toBe(201);
    const storedRaw = JSON.parse(await fs.readFile(DIARY_PATH, 'utf8'));
    expect(storedRaw[0]).toHaveProperty('ciphertext');
    expect(JSON.stringify(storedRaw[0])).not.toContain('private');
    const audit = JSON.parse(await fs.readFile(AUDIT_PATH, 'utf8'));
    expect(audit[audit.length - 1].action).toBe('DIARY_CREATE');
  });

  it('list endpoint omits notes', async () => {
    await grantConsent().expect(201);
    await client().post('/api/diary').set(patientHeaders).send({ date: '2025-01-03', mood: 6, symptomScore: 1, notes: 'secret' }).expect(201);
    const res = await client().get('/api/diary').set(patientHeaders);
    expect(res.status).toBe(200);
    expect(res.body.data[0]).not.toHaveProperty('notes');
    expect(res.body.data[0].hasNotes).toBe(true);
  });

  it('delete adds redaction marker and audit', async () => {
    await grantConsent().expect(201);
    const created = await client().post('/api/diary').set(patientHeaders).send({ date: '2025-01-04', mood: 4, symptomScore: 5, notes: 'remove' });
    const id = created.body.data.id;
    await client().delete(`/api/diary/${id}`).set(patientHeaders).expect(200);
    const audit = JSON.parse(await fs.readFile(AUDIT_PATH, 'utf8'));
    expect(audit[audit.length - 1].action).toBe('DIARY_REDACT');
    const records = await secureReadAll<any>(DIARY_PATH);
    const redaction = records.find((r: any) => r.kind === 'redaction' && r.targetId === id);
    expect(redaction).toBeDefined();
    const list = await client().get('/api/diary').set(patientHeaders);
    expect(list.body.data.find((i: any) => i.id === id)).toBeUndefined();
  });
});
