import { buildSafeNotification } from './safeNotificationPayload';

describe('safe notification payload', () => {
  it('omits PHI and uses allowlisted message/cta', () => {
    const notif = buildSafeNotification({ type: 'ASSESSMENT_COMPLETED', userId: 'user-1' });
    expect(notif).toMatchObject({
      type: 'ASSESSMENT_COMPLETED',
      userId: 'user-1',
      ctaUrl: '/patient/assessments',
      message: 'Assessment completed.',
      severity: 'info',
    });
    expect((notif as any).score).toBeUndefined();
    expect((notif as any).notes).toBeUndefined();
  });

  it('rejects forbidden fields', () => {
    expect(() =>
      buildSafeNotification({ type: 'ASSESSMENT_COMPLETED', userId: 'user-2', metadata: { module: 'assessments', score: 5 } as any })
    ).toThrow();
    expect(() => buildSafeNotification({ type: 'ASSESSMENT_COMPLETED', userId: 'user-2', message: 'custom' })).toThrow();
  });
});
