import { Request, Response, NextFunction } from 'express';
import { ConsentService } from '../services/ConsentService';
import { CONSENT_STATES } from '../constants/consent.constants';
import 'express';

declare global {
  namespace Express {
    interface Request {
      consentContext?: {
        module: string;
        state: string;
        grantedAt: string | null;
      };
    }
  }
}


export const requireActiveConsent =
  (module: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.authContext?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          code: 'AUTH_REQUIRED'
        });
      }

      const consent = ConsentService.getConsentStatus(userId, module);

      if (!consent || consent.state !== CONSENT_STATES.ACTIVE) {
        return res.status(403).json({
          error: 'Active consent required',
          code: 'CONSENT_REQUIRED',
          module,
          state: consent?.state ?? CONSENT_STATES.NOT_ASKED
        });
      }

      /**
       * Optional: attach for auditing / downstream usage
       */
      req.consentContext = {
        module,
        state: consent.state,
        grantedAt: consent.grantedAt
      };

      return next();
    } catch (err) {
      console.error('requireActiveConsent error', err);
      return res.status(500).json({
        error: 'Consent verification failed',
        code: 'CONSENT_CHECK_FAILED'
      });
    }
  };
