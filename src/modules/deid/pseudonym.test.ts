import { pseudonymize } from './pseudonym';

describe('pseudonymize', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DEID_PSEUDONYM_SECRET = 'secret-key-1';
    process.env.DEID_PSEUDONYM_VERSION = 'v1';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('is deterministic for same userId and secret', () => {
    const a = pseudonymize('user-123');
    const b = pseudonymize('user-123');
    expect(a.pseudonym).toBe(b.pseudonym);
  });

  it('changes output when secret changes', () => {
    const a = pseudonymize('user-123');
    process.env.DEID_PSEUDONYM_SECRET = 'different';
    const b = pseudonymize('user-123');
    expect(a.pseudonym).not.toBe(b.pseudonym);
  });

  it('does not expose original userId substring', () => {
    const result = pseudonymize('user-abc');
    expect(result.pseudonym.includes('abc')).toBe(false);
    expect(result.pseudonym.includes('user')).toBe(false);
  });
});
