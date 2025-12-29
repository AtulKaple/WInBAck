import fs from 'fs/promises';
import path from 'path';
import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { requireAuthContext } from '../../auth';
import { AUDIT_PATH, verifyLedger } from '../../security/secureWrite';

const router = Router();

router.get('/assessments', requireAuthContext, requireRole(['admin']), async (_req, res) => {
  const ledgerOk = await verifyLedger();
  const ledgerEntries = await readLedger();
  const lastHash = ledgerEntries.length ? ledgerEntries[ledgerEntries.length - 1].hash : null;
  return res.json({
    consentGateEnabled: true,
    encryptionEnabled: true,
    ledger: { ok: ledgerOk, lastHash },
    diaryConsentGateEnabled: true,
    diaryEncryptionEnabled: true,
    diaryLedgerOk: ledgerOk,
    fhirValidationEnabled: true,
    safeLoggingEnabled: true,
    notificationScrubberEnabled: true,
    lastSecurityCheckAt: new Date().toISOString(),
  });
});

router.get('/audit', requireAuthContext, requireRole(['admin']), async (req, res) => {
  const moduleFilter = typeof req.query.module === 'string' ? req.query.module : undefined;
  if (moduleFilter && !['assessments', 'diary'].includes(moduleFilter)) return res.json({ data: [] });
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const since = typeof req.query.since === 'string' ? req.query.since : undefined;
  const allowedTypes =
    moduleFilter === 'diary'
      ? new Set(['Observation'])
      : new Set(['Consent', 'QuestionnaireResponse', 'Observation']);
  const ledgerEntries = await readLedger();
  const filtered = ledgerEntries
    .filter((e) => allowedTypes.has(e.resourceType))
    .filter((e) => (!action ? true : e.action === action))
    .filter((e) => (!userId ? true : e.actorUserId === userId))
    .filter((e) => (!since ? true : new Date(e.ts).getTime() >= new Date(since).getTime()))
    .map(({ ciphertext, ...rest }) => rest);

  return res.json({ data: filtered.slice(-50) });
});

async function readLedger(): Promise<any[]> {
  try {
    const raw = await fs.readFile(AUDIT_PATH, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch {
    await fs.mkdir(path.dirname(AUDIT_PATH), { recursive: true });
    await fs.writeFile(AUDIT_PATH, '[]', 'utf8');
    return [];
  }
}

export default router;
