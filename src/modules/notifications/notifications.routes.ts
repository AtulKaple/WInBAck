import { Router } from 'express';
import { requireAuthContext } from '../../auth';
import { requireRole } from '../../middleware/auth';
import {
  adminListAll,
  getNotifications,
  getUnreadCount,
  postCreateSystem,
  postInternalPublish,
  postMarkRead,
} from './notifications.controller';
import { csrfGuard } from '../../security/csrfGuard';

const router = Router();

router.get('/', requireAuthContext, getNotifications);
router.get('/unread-count', requireAuthContext, requireRole(['patient']), getUnreadCount);
router.post('/mark-read', requireAuthContext, csrfGuard, postMarkRead);
router.post('/create', requireAuthContext, requireRole(['admin']), csrfGuard, postCreateSystem);
router.post('/internal/publish', csrfGuard, postInternalPublish);
router.get('/admin/all', requireAuthContext, requireRole(['admin']), adminListAll);

export default router;
