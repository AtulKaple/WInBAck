import { NextFunction, Request, Response } from 'express';
// Consent enforcement disabled.
export const CONSENT_MIDDLEWARE_ENABLED = false;

export const requireActiveConsent = (scope: string) => {
  return async (_req: Request, _res: Response, next: NextFunction) => next();
};
