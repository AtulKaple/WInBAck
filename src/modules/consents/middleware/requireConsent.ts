// middleware/requireConsent.ts
import { Request, Response, NextFunction } from "express";
import { ConsentService } from "../services/ConsentService";
import { CONSENT_STATES } from "../constants/consent.constants";

export const requireActiveConsent =
  (module: string) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.authContext?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const consent = await ConsentService.getConsentStatus(userId, module);

    if (!consent || consent.state !== CONSENT_STATES.ACTIVE) {
      return res.status(403).json({
        error: "Active consent required",
        code: "CONSENT_REQUIRED",
        module,
        state: consent?.state ?? CONSENT_STATES.NOT_ASKED
      });
    }

    req.consentContext = {
      module,
      state: consent.state,
      grantedAt: consent.grantedAt
    };

    next();
  };
