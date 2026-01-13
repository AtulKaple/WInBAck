import { Request, Response, NextFunction } from 'express';
import { SocialStubAdapter } from './socialStubAdapter';
import { AuthAdapter } from './adapter';
import { AuthContext } from './types';
import { CognitoAdapter } from './cognitoAdapter';

const adapter: AuthAdapter = new CognitoAdapter();

export async function resolveAuthContext(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await adapter.resolve(req);
    req.authContext = ctx;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireAuthContext(req: Request, res: Response, next: NextFunction) {
  if (!req.authContext) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

export { AuthContext } from './types';
