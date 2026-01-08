import { Router } from "express";
import { ConsentService } from "../services/ConsentService";
import { MODULES } from "../constants/consent.constants";

const router = Router();

/**
 * POST /api/consents/grant
 * Grant consent for one or more modules
 */
router.post("/grant", async (req, res) => {
  try {
    const userId = req.authContext?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      modules,
      policyVersion,
      policyHash,
      capturedBy = "web"
    } = req.body;

    if (!Array.isArray(modules) || modules.length === 0) {
      return res.status(400).json({ error: "No modules provided" });
    }

    // ✅ Ensure baseline consent exists (first login)
    ConsentService.ensureUser(userId, {
      purpose: "care",
      role: "patient",
      policyVersion,
      policyHash,
      capturedBy
    });

    const granted = [];

    for (const module of modules) {
      if (!MODULES.includes(module)) continue;

      const result = ConsentService.grantConsent({
        userId,
        module,
        policyVersion,
        policyHash,
        capturedBy
      });

      granted.push({
        module,
        state: result.state,
        grantedAt: result.grantedAt
      });
    }

    res.json({
      status: "ok",
      granted
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to grant consent" });
  }
});

/**
 * POST /api/consents/revoke
 * Revoke consent (single module or all)
 */
router.post("/revoke", async (req, res) => {
  try {
    const userId = req.authContext?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      modules,
      reason = "user_revoked",
      capturedBy = "web"
    } = req.body;

    // If modules not provided → revoke all
    const revokeModules =
      Array.isArray(modules) && modules.length
        ? modules
        : MODULES;

    const revoked = [];

    for (const module of revokeModules) {
      if (!MODULES.includes(module)) continue;

      const result = ConsentService.revokeConsent({
        userId,
        module,
        reason,
        capturedBy
      });

      revoked.push({
        module,
        state: result.state,
        revokedAt: result.revokedAt
      });
    }

    res.json({
      status: "ok",
      revoked
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to revoke consent" });
  }
});

/**
 * GET /api/consents/status
 * Get all consent states for logged-in user
 */
router.get("/status", async (req, res) => {
  const userId = req.authContext?.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const consents = ConsentService.listUserConsents(userId);
  res.json(consents);
});

/**
 * GET /api/consents/status/:module
 * Get consent status for a single module
 */
router.get("/status/:module", async (req, res) => {
  const userId = req.authContext?.userId;
  const { module } = req.params;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!MODULES.includes(module)) {
    return res.status(400).json({ error: "Invalid module" });
  }

  const status = ConsentService.getConsentStatus(userId, module);
  res.json({
    module,
    ...status
  });
});

export default router;
