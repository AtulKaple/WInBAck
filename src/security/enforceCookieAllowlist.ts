import { NextFunction, Request, Response } from 'express';
import { COOKIE_ALLOWLIST, COOKIE_HEALTH_SEMANTICS } from './cookiePolicy';
import { safeLogger } from './safeLogger';

const STRICT_MODE = process.env.COOKIE_POLICY_STRICT === 'true' && process.env.NODE_ENV === 'production';

function normalizeCookies(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') return [value];
  return [];
}

export const enforceCookieAllowlist = (req: Request, res: Response, next: NextFunction) => {
  let blocked: string[] = [];
  const originalSetHeader = res.setHeader.bind(res);
  const originalAppend = (res as any).append?.bind(res);
  const originalEnd = res.end.bind(res);
  const self: any = res;

  const filter = (value: any): string[] => {
    const cookies = normalizeCookies(value);
    const kept: string[] = [];
    cookies.forEach((c) => {
      const name = c.split('=')[0];
      if (COOKIE_ALLOWLIST.has(name)) {
        kept.push(c);
      } else {
        blocked.push(name);
      }
    });
    return kept;
  };

  res.setHeader = function setHeaderPatched(name: string, value: any) {
    if (typeof name === 'string' && name.toLowerCase() === 'set-cookie') {
      const filtered = filter(value);
      if (!filtered.length) return self;
      return originalSetHeader(name, filtered);
    }
    return originalSetHeader(name as any, value);
  } as any;

  (res as any).append = function appendPatched(name: string, value: any) {
    if (typeof name === 'string' && name.toLowerCase() === 'set-cookie') {
      const filtered = filter(value);
      if (!filtered.length) return self;
      return originalAppend ? originalAppend(name, filtered) : originalSetHeader(name, filtered);
    }
    return originalAppend ? originalAppend(name, value) : originalSetHeader(name, value);
  };

  res.end = function endPatched(chunk?: any, encoding?: any, cb?: any) {
    if (blocked.length && STRICT_MODE && !res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      const payload = JSON.stringify({ error: 'COOKIE_POLICY_VIOLATION' });
      safeLogger.info('cookie.policy.violation.strict', { blocked: Array.from(new Set(blocked)), path: req.path });
      return originalEnd(payload, 'utf8', cb);
    }
    return originalEnd(chunk, encoding, cb);
  };

  res.on('finish', () => {
    if (blocked.length) {
      safeLogger.info('cookie.policy.violation', {
        blocked: Array.from(new Set(blocked)),
        path: req.path,
        mode: STRICT_MODE ? 'strict' : 'warn',
        healthSemanticsAllowed: COOKIE_HEALTH_SEMANTICS,
      });
    }
  });

  next();
};
