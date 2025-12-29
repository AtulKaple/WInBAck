import { Router } from 'express';
import { requireAuthContext } from '../../auth';
import { requireRole } from '../../middleware/auth';
import { handleRun, handleStatus, handleDatasetSummary, handleDatasetAggregate } from './deid.controller';
import { csrfGuard } from '../../security/csrfGuard';

const router = Router();

router.post('/run', requireAuthContext, requireRole(['admin']), csrfGuard, handleRun);
router.get('/status', requireAuthContext, requireRole(['admin']), handleStatus);
router.get('/dataset/summary', requireAuthContext, requireRole(['researcher']), handleDatasetSummary);
router.get('/dataset/aggregate', requireAuthContext, requireRole(['researcher']), handleDatasetAggregate);

export default router;
