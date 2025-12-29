import { Response, CookieOptions } from 'express';

export const COOKIE_POLICY_VERSION = '1.0';
export const COOKIE_HEALTH_SEMANTICS = false;

export const COOKIE_ALLOWLIST = new Set(['__Host-ws_session', 'ws_session', '__Host-ws_csrf', 'ws_csrf', 'ws_ui']);

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});

const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12h

const sessionName = () => (process.env.NODE_ENV === 'production' ? '__Host-ws_session' : 'ws_session');
const csrfName = () => (process.env.NODE_ENV === 'production' ? '__Host-ws_csrf' : 'ws_csrf');

export function getSessionCookieName() {
  return sessionName();
}

export function setSessionCookie(res: Response, value: string, optionsOverride: Partial<CookieOptions> = {}) {
  const opts = baseOptions();
  res.cookie(sessionName(), value, {
    ...opts,
    ...optionsOverride,
    maxAge: optionsOverride.maxAge ?? SESSION_MAX_AGE_MS,
    httpOnly: optionsOverride.httpOnly ?? true,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(sessionName(), { path: '/', httpOnly: true, sameSite: 'strict' });
}

export function getCsrfCookieName() {
  return csrfName();
}

export function setCsrfCookie(res: Response, token: string) {
  const opts = baseOptions();
  res.cookie(csrfName(), token, {
    ...opts,
    httpOnly: false, // must be readable by client for double submit
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function setUiCookie(res: Response, value: string) {
  // UI cookie is optional and must not contain health semantics.
  res.cookie('ws_ui', value, {
    ...baseOptions(),
    httpOnly: false,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function isCookieAllowed(name: string): boolean {
  return COOKIE_ALLOWLIST.has(name);
}
