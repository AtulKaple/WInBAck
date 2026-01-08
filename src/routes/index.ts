import { Router } from 'express';
import assessmentsRouter from '../modules/assessments/routes';
import consentRouter from '../modules/consent';
import complianceRouter from '../modules/compliance/routes';
import diaryRouter from '../modules/diary';
import systemStatusRouter from '../modules/systemStatus/routes';
import analyticsRouter from '../modules/analytics/routes';
import deidRouter from '../modules/deid/deid.routes';
import notificationsRouter from '../modules/notifications/notifications.routes';
import authRouter from '../modules/auth/routes';
import consentRoutes from "../modules/consents/routes/consent.routes";

const router = Router();

router.use('/auth', authRouter);
router.use('/assessments', assessmentsRouter);
router.use('/consent', consentRouter);
router.use('/compliance', complianceRouter);
router.use('/diary', diaryRouter);
router.use('/system', systemStatusRouter);
router.use('/analytics', analyticsRouter);
router.use('/deid', deidRouter);
router.use('/notifications', notificationsRouter);
router.use("/consents", consentRoutes);

export default router;
