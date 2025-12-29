import { Router } from 'express';
import { requireRole } from '../../middleware/auth';
import { requireAuthContext } from '../../auth';
import { ensureAssessmentConsent, getLatestConsent } from './service';

const router = Router();

// Consent endpoints are stubbed to always succeed while consent is disabled.
router.get('/me', requireAuthContext, requireRole(['patient']), async (req, res) => {
  const userId = req.authContext?.userId;
  const current = userId ? await getLatestConsent(userId) : null;
  return res.json({ data: current });
});

router.post('/', requireAuthContext, requireRole(['patient']), async (req, res) => {
  const userId = req.authContext?.userId || 'unknown';
  const consent = await ensureAssessmentConsent(userId);
  return res.status(201).json({ data: consent });
});

router.post('/revoke', requireAuthContext, requireRole(['patient']), async (req, res) => {
  const userId = req.authContext?.userId || 'unknown';
  const consent = await ensureAssessmentConsent(userId);
  return res.status(200).json({ data: consent });
});

export default router;
