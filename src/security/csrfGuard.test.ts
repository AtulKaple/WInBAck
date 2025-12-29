import { csrfGuard } from './csrfGuard';
import { getCsrfCookieName } from './cookiePolicy';

const name = getCsrfCookieName();

const mockRes = () => {
  const res: any = { statusCode: 200 };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: any) => {
    res.body = body;
    return res;
  };
  return res;
};

describe('csrfGuard', () => {
  it('fails when tokens missing', () => {
    const req: any = { method: 'POST', headers: {} };
    const res = mockRes();
    const next = jest.fn();
    csrfGuard(req, res as any, next);
    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe('CSRF_FAILED');
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when cookie and header match', () => {
    const token = 'abc123';
    const req: any = {
      method: 'POST',
      headers: { cookie: `${name}=${token}`, 'x-ws-csrf': token },
    };
    const res = mockRes();
    const next = jest.fn();
    csrfGuard(req, res as any, next);
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });
});
