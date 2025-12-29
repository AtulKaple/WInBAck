import { Request, Response } from 'express';
import { createNotification, listNotifications, markRead, unreadCount, listAllNotifications } from './notifications.service';
import { createSystemSchema, internalPublishSchema, markReadSchema } from './notifications.validators';
import { buildSafeNotification } from './safeNotificationPayload';

export async function getNotifications(req: Request, res: Response) {
  const userId = req.authContext?.userId;
  const role = req.authContext?.role;
  const requestedUser = (req.query.userId as string) || userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (req.query.userId && role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const data = requestedUser ? await listNotifications(requestedUser) : [];
  res.json({ data });
}

export async function getUnreadCount(req: Request, res: Response) {
  const userId = req.authContext?.userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const count = await unreadCount(userId);
  res.json({ count });
}

export async function postMarkRead(req: Request, res: Response) {
  const parsed = markReadSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const userId = req.authContext?.role === 'admin' && req.body.userId ? req.body.userId : req.authContext?.userId;
  await markRead(parsed.data.ids, userId || undefined);
  res.json({ ok: true });
}

export async function postCreateSystem(req: Request, res: Response) {
  const parsed = createSystemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const targets = parsed.data.userIds || (parsed.data.userId ? [parsed.data.userId] : []);
  const created = [];
  for (const uid of targets) {
    const notif = await createNotification({ type: 'SYSTEM_ANNOUNCEMENT', userId: uid, ctaUrl: parsed.data.ctaUrl });
    created.push(notif);
  }
  res.status(201).json({ data: created });
}

export async function postInternalPublish(req: Request, res: Response) {
  const key = req.header('x-internal-key');
  if (!process.env.INTERNAL_NOTIFICATION_KEY || key !== process.env.INTERNAL_NOTIFICATION_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const parsed = internalPublishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const notif = await createNotification({ ...parsed.data });
  res.status(201).json({ data: notif });
}

export async function adminListAll(_req: Request, res: Response) {
  const all = await listAllNotifications();
  res.json({ data: all });
}

export async function emitAssessmentCompleted(userId: string | undefined) {
  if (!userId) return;
  await createNotification({ type: 'ASSESSMENT_COMPLETED', userId, ctaUrl: '/patient/dashboard' });
}
