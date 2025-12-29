import crypto from 'crypto';
import { Router } from 'express';
import { setSessionCookie, setCsrfCookie } from '../../security/cookiePolicy';
import { requireAuthContext } from '../../auth';
import { ensureAssessmentConsent } from '../consent/service';

const router = Router();

router.post('/exchange', requireAuthContext, async (req, res) => {
  const userId = req.authContext?.userId || 'anonymous';
  if (req.authContext?.role === 'patient') {
    try {
      await ensureAssessmentConsent(userId);
    } catch (err: any) {
      return res.status(500).json({ error: 'CONSENT_PROVISION_FAILED', details: err?.message || 'Unable to provision default consent' });
    }
  }
  const sessionId = `sess-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setSessionCookie(res, sessionId);
  res.json({ sessionId, rotated: true });
});

router.get('/csrf', (req, res) => {
  const token = crypto.randomBytes(16).toString('hex');
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
});

export default router;
