import { Request } from 'express';
import { AuthAdapter } from './adapter';
import { AuthContext } from './types';

function base64UrlDecode(input: string): Buffer {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  return Buffer.from(input, 'base64');
}

function parseToken(token: string): any {
  const parts = token.split('.');
  const payloadPart = parts.length === 3 ? parts[1] : token;
  try {
    const decoded = base64UrlDecode(payloadPart).toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const cookies = Object.fromEntries(header.split(';').map((c) => c.trim().split('=')));
  return cookies[name];
}

export class SocialStubAdapter implements AuthAdapter {
  async resolve(req: Request): Promise<AuthContext> {
    const bearer = (req.headers.authorization || '').replace('Bearer ', '').trim();
    const cookieToken = readCookie(req, 'ws_session');
    const token = bearer || cookieToken;
    if (!token) throw new Error('Missing token');
    const payload = parseToken(token);
    if (!payload || !payload.sub || !payload.role || !payload.exp) throw new Error('Invalid token');
    if (!['patient', 'researcher', 'admin'].includes(payload.role)) throw new Error('Invalid role');
    if (Date.now() / 1000 >= payload.exp) throw new Error('Token expired');
    return {
      userId: String(payload.sub),
      role: payload.role,
      sessionId: cookieToken,
      issuedAt: payload.iat,
      expiresAt: payload.exp,
      source: 'social-stub',
    };
  }
}
