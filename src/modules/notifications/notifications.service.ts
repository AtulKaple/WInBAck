import fs from 'fs/promises';
import path from 'path';
import { buildSafeNotification } from './safeNotificationPayload';
import { NotificationRecord } from './notifications.types';

const STORE_PATH = path.join(__dirname, '..', '..', 'data', 'notifications.json');

async function readAll(): Promise<NotificationRecord[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return raw.trim() ? (JSON.parse(raw) as NotificationRecord[]) : [];
  } catch {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, '[]', 'utf8');
    return [];
  }
}

async function writeAll(data: NotificationRecord[]) {
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

export async function listNotifications(userId: string): Promise<NotificationRecord[]> {
  const all = await readAll();
  return all.filter((n) => n.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function unreadCount(userId: string): Promise<number> {
  const all = await readAll();
  return all.filter((n) => n.userId === userId && !n.readAt).length;
}

export async function markRead(ids: string[], userId?: string): Promise<void> {
  const all = await readAll();
  const now = new Date().toISOString();
  const next = all.map((n) => {
    if (ids.includes(n.id) && (!userId || n.userId === userId)) {
      return { ...n, readAt: n.readAt || now };
    }
    return n;
  });
  await writeAll(next);
}

export async function createNotification(input: Parameters<typeof buildSafeNotification>[0]): Promise<NotificationRecord> {
  const notif = buildSafeNotification(input);
  const all = await readAll();
  all.push(notif);
  await writeAll(all);
  return notif;
}

export async function createConsentRequiredNotification(userId: string): Promise<NotificationRecord | null> {
  const all = await readAll();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = all.find((n) => n.userId === userId && n.type === 'CONSENT_REQUIRED' && new Date(n.createdAt).getTime() >= cutoff);
  if (recent) return null;
  return createNotification({ type: 'CONSENT_REQUIRED', userId, severity: 'warning' });
}

export async function listAllNotifications(): Promise<NotificationRecord[]> {
  return readAll();
}
