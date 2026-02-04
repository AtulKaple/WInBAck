import { Router } from "express";
import { requireRole } from "../../../middleware/auth";
import { deleteLog, deleteLogsByRange, getLogStats, listActivityLogs } from "../controllers/activityLogs.controller";
const router = Router();

router.get('/logs', requireRole(['admin']), listActivityLogs);
router.get('/logs/stats', requireRole(['admin']), getLogStats);
router.delete('/logs/:id', requireRole(['admin']), deleteLog);
router.post('/logs/delete-range', requireRole(['admin']), deleteLogsByRange);

export default router;