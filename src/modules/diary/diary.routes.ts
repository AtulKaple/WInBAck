import { Router } from 'express';
import * as DiaryController from './diary.controller';
import { requireRole } from '../../middleware/auth';
import { requireAuthContext } from '../../auth';
import { requireActiveConsent } from '../consents';

const router = Router();

router.use(requireAuthContext);
router.use(requireRole(['patient', 'admin', 'caregiver']));
router.use( requireActiveConsent('diary'));

router.post('/', DiaryController.create);
router.get('/', DiaryController.list);
router.put('/:id', DiaryController.update);
router.delete('/:id', DiaryController.remove);

export default router;
