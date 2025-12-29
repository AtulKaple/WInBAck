import { safeLogger } from './safeLogger';

describe('safeLogger redaction', () => {
  it('redacts PHI-ish fields', () => {
    const spy = jest.spyOn(console, 'info').mockImplementation(() => {});
    safeLogger.info('event', { answers: { q1: 'a' }, text: 'secret', nested: { diary: 'hidden', ok: 'fine' } });
    const payload = spy.mock.calls[0][1];
    expect(payload.answers).toBe('[REDACTED]');
    expect(payload.text).toBe('[REDACTED]');
    expect(payload.nested.diary).toBe('[REDACTED]');
    expect(payload.nested.ok).toBe('fine');
    spy.mockRestore();
  });
});
