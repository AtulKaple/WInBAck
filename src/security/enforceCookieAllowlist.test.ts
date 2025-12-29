import { enforceCookieAllowlist } from './enforceCookieAllowlist';
import { setSessionCookie } from './cookiePolicy';
import { safeLogger } from './safeLogger';

type MockRes = ReturnType<typeof createMockRes>;

function createMockRes() {
  const headers: Record<string, string[]> = {};
  const res: any = {
    statusCode: 200,
    headers,
    setHeader(name: string, value: any) {
      headers[name.toLowerCase()] = Array.isArray(value) ? value : [value];
      return res;
    },
    append(name: string, value: any) {
      const key = name.toLowerCase();
      const existing = headers[key] || [];
      headers[key] = existing.concat(Array.isArray(value) ? value : [value]);
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

describe('cookie allowlist enforcement', () => {
  it('strips non-allowlisted cookies and logs violation', async () => {
    const spy = jest.spyOn(safeLogger, 'info').mockImplementation(() => undefined);
    const req: any = { path: '/test' };
    const res: MockRes = createMockRes();
    const next = () => {
      res.cookie('tracker_id', 'abc');
      res.cookie('__Host-ws_session', 'ok');
      res.send('done');
    };

    enforceCookieAllowlist(req, res as any, next);

    const cookies = res.headers['set-cookie'] || [];
    const joined = cookies.join(' ');
    expect(joined).not.toContain('tracker_id');
    expect(joined).toContain('ws_session');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('cookie.policy.violation'),
      expect.objectContaining({ blocked: expect.arrayContaining(['tracker_id']) })
    );
    spy.mockRestore();
  });

  it('applies default flags to session cookie', async () => {
    const req: any = { path: '/session' };
    const res: MockRes = createMockRes();
    const next = () => {
      setSessionCookie(res as any, 'abc');
      res.send('ok');
    };
    enforceCookieAllowlist(req, res as any, next);
    const header = (res.headers['set-cookie'] || []).join(' ');
    expect(header).toContain('ws_session=abc');
    expect(header.toLowerCase()).toContain('httponly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
  });
});
