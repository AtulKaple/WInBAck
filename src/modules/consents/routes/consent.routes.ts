// routes/consent.routes.ts
import { Router } from "express";
import { ConsentService } from "../services/ConsentService";
import { MODULES } from "../constants/consent.constants";

const router = Router();

router.post("/grant", async (req, res) => {
  const userId = req.authContext?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { modules, policyVersion, policyHash, capturedBy = "web" } = req.body;

  const granted = [];
  for (const module of modules ?? []) {
    if (!MODULES.includes(module)) continue;

    const result = await ConsentService.grantConsent({
      userId,
      module,
      policyVersion,
      policyHash,
      capturedBy
    });

    granted.push({ module, ...result });
  }

  res.json({ status: "ok", granted });
});

router.post("/revoke", async (req, res) => {
  const userId = req.authContext?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { modules, reason = "user_revoked", capturedBy = "web" } = req.body;

  const targets = modules?.length ? modules : MODULES;
  const revoked = [];

  for (const module of targets) {
    if (!MODULES.includes(module)) continue;

    const result = await ConsentService.revokeConsent({
      userId,
      module,
      reason,
      capturedBy
    });

    revoked.push({ module, ...result });
  }

  res.json({ status: "ok", revoked });
});

router.get("/status", async (req, res) => {
  const userId = req.authContext?.userId;
  const consents = await ConsentService.listUserConsents(userId);
  res.json(consents);
});

router.get("/status/:module", async (req, res) => {
  const userId = req.authContext?.userId;
  const status = await ConsentService.getConsentStatus(
    userId,
    req.params.module
  );
  res.json(status);
});

export default router;
