import fs from 'fs/promises';
import path from 'path';
import { buildSafeNotification } from './safeNotificationPayload';
import { createConsentRequiredNotification } from './notifications.service';
import { postInternalPublish, getNotifications } from './notifications.controller';

const STORE_PATH = path.join(__dirname, '..', '..', 'data', 'notifications.json');

function mockReq(body: any = {}, options: any = {}) {
  return {
    body,
    query: options.query || {},
    headers: options.headers || {},
    header: (key: string) => options.headers?.[key.toLowerCase()] || options.headers?.[key] || undefined,
    authContext: options.authContext || { userId: 'p1', role: 'patient' },
  } as any;
}

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res;
  };
  return res;
}

beforeAll(() => {
  process.env.APP_MASTER_KEY = Buffer.alloc(32, 8).toString('base64');
  process.env.INTERNAL_NOTIFICATION_KEY = 'int-key';
});

beforeEach(async () => {
  await fs.writeFile(STORE_PATH, '[]', 'utf8');
});

describe('notifications module', () => {
  it('safe payload blocks PHI fields', () => {
    expect(() =>
      buildSafeNotification({ type: 'ASSESSMENT_COMPLETED', userId: 'p1', metadata: { module: 'assessments', score: 10 } as any })
    ).toThrow();
  });

  it('assessment notifications have no score or questionnaire data', async () => {
    const notif = buildSafeNotification({ type: 'ASSESSMENT_COMPLETED', userId: 'p1' });
    expect(JSON.stringify(notif)).not.toMatch(/score|questionnaire|notes/i);
  });

  it('internal publish requires key', async () => {
    const res1 = mockRes();
    await postInternalPublish(mockReq({ userId: 'p1', type: 'ASSESSMENT_COMPLETED' }, { headers: {} }), res1);
    expect(res1.statusCode).toBe(403);

    const res2 = mockRes();
    await postInternalPublish(
      mockReq({ userId: 'p1', type: 'ASSESSMENT_COMPLETED' }, { headers: { 'x-internal-key': 'int-key' } }),
      res2
    );
    expect(res2.statusCode).toBe(201);
    expect(res2.body.data.message).toBeDefined();
  });

  it('consent-required notification is rate limited', async () => {
    const first = await createConsentRequiredNotification('p1');
    expect(first).not.toBeNull();
    const second = await createConsentRequiredNotification('p1');
    expect(second).toBeNull();
    const stored = JSON.parse(await fs.readFile(STORE_PATH, 'utf8'));
    expect(stored.filter((n: any) => n.type === 'CONSENT_REQUIRED').length).toBe(1);
  });

  it('lists notifications for authenticated user only', async () => {
    await postInternalPublish(
      mockReq({ userId: 'p1', type: 'ASSESSMENT_COMPLETED' }, { headers: { 'x-internal-key': 'int-key' } }),
      mockRes()
    );
    const res = mockRes();
    await getNotifications(mockReq({}, { authContext: { userId: 'p1', role: 'patient' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
  });
});
