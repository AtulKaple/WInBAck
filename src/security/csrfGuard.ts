import { NextFunction, Request, Response } from 'express';
import { getCsrfCookieName } from './cookiePolicy';

export const CSRF_GUARD_ENABLED = true;

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf('=');
        if (idx === -1) return [c, ''];
        return [c.slice(0, idx), c.slice(idx + 1)];
      })
  );
}

export const csrfGuard = (req: Request, res: Response, next: NextFunction) => {
  const method = (req.method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();

  /**
   * ✅ If request is authenticated via Authorization header (JWT),
   * CSRF protection is NOT required.
   */
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return next();
  }

  /**
   * 🔒 Cookie-based auth fallback → enforce CSRF
   */
  const cookies = parseCookies(req.headers.cookie as string | undefined);
  const name = getCsrfCookieName();
  const cookieToken = cookies[name];
  const headerToken = (req.headers['x-ws-csrf'] as string | undefined) || '';

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF_FAILED' });
  }

  return next();
};

