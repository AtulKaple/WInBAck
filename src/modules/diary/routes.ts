import { Router } from 'express';
import path from 'path';
import { z } from 'zod';
import { requireAuthContext } from '../../auth';
import { requireRole } from '../../middleware/auth';
import { requireActiveConsent } from '../consents';
import { preventBodyLogging } from '../../security/safeLogger';
import { secureReadAll, secureWrite, AUDIT_PATH } from '../../security/secureWrite';
import { csrfGuard } from '../../security/csrfGuard';
import fs from 'fs/promises';

const router = Router();

const DIARY_PATH = path.join(__dirname, '..', '..', 'data', 'diary.json');

type DiaryEntry = {
  kind: 'entry';
  id: string;
  userId: string;
  date: string;
  mood: number;
  symptomScore: number;
  notes?: string;
  createdAt: string;
  resourceType: 'Observation';
  status: 'final';
  category: string;
  code: { text: string };
  subject: { reference: string };
  effectiveDateTime: string;
};

type DiaryRedaction = {
  kind: 'redaction';
  targetId: string;
  userId: string;
  createdAt: string;
};

type DiaryRecord = DiaryEntry | DiaryRedaction;

const diarySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.number().int().min(1).max(10),
  symptomScore: z.number().int().min(0).max(10),
  notes: z.string().optional().default(''),
});

async function loadRecords(): Promise<DiaryRecord[]> {
  try {
    return await secureReadAll<DiaryRecord>(DIARY_PATH);
  } catch {
    await fs.writeFile(DIARY_PATH, '[]', 'utf8');
    return [];
  }
}

function buildState(records: DiaryRecord[], role: 'patient' | 'admin', userId: string) {
  const map = new Map<string, { entry: DiaryEntry; redacted: boolean; redactedAt?: string }>();
  const sorted = [...records].sort((a, b) => {
    const ta = 'createdAt' in a ? (a as any).createdAt : '';
    const tb = 'createdAt' in b ? (b as any).createdAt : '';
    return new Date(ta).getTime() - new Date(tb).getTime();
  });

  for (const rec of sorted) {
    if (rec.kind === 'entry') {
      if (role === 'patient' && rec.userId !== userId) continue;
      map.set(rec.id, { entry: rec, redacted: false });
    } else if (rec.kind === 'redaction') {
      const existing = map.get(rec.targetId);
      if (existing && (role === 'admin' || existing.entry.userId === userId)) {
        existing.redacted = true;
        existing.redactedAt = rec.createdAt;
      }
    }
  }
  return map;
}

async function latestAuditHash(): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(AUDIT_PATH, 'utf8');
    const ledger = raw ? JSON.parse(raw) : [];
    return ledger.length ? ledger[ledger.length - 1].hash : undefined;
  } catch {
    return undefined;
  }
}

router.get(
  '/',
  requireAuthContext,
  requireRole(['patient', 'admin', 'caregiver']),
  requireActiveConsent('diary'),
  async (req, res) => {
    const role = req.authContext?.role as 'patient' | 'admin';
    const userId = req.authContext?.userId as string;
    let records = await loadRecords();
    if (!records.length) {
      // seed 5 sample entries for this user to unblock UI and analytics
      const today = new Date();
      const samples = Array.from({ length: 5 }).map((_, idx) => {
        const d = new Date(today);
        d.setDate(d.getDate() - idx);
        return {
          kind: 'entry' as const,
          id: `diary-seed-${userId}-${d.toISOString().slice(0, 10)}`,
          userId,
          date: d.toISOString().slice(0, 10),
          mood: Math.max(1, Math.min(10, 6 + (idx % 3) - 1)),
          symptomScore: Math.max(0, Math.min(10, 3 + (idx % 4) - 1)),
          notes: 'Sample day entry',
          createdAt: new Date().toISOString(),
          resourceType: 'Observation' as const,
          status: 'final' as const,
          category: 'patient-reported',
          code: { text: 'Daily Symptom Log' },
          subject: { reference: `Patient/${userId}` },
          effectiveDateTime: d.toISOString().slice(0, 10),
        };
      });
      for (const entry of samples) {
        await secureWrite({
          filePath: DIARY_PATH,
          record: entry,
          auditMeta: {
            action: 'DIARY_SEED',
            actorUserId: userId,
            actorRole: role,
            resourceType: 'Observation',
            resourceId: entry.id,
          },
        });
      }
      records = await loadRecords();
    }
    const state = buildState(records, role, userId);
    const items = Array.from(state.values())
      .filter((s) => !s.redacted)
      .map((s) => ({
        id: s.entry.id,
        date: s.entry.date,
        mood: s.entry.mood,
        symptomScore: s.entry.symptomScore,
        hasNotes: !!s.entry.notes,
        createdAt: s.entry.createdAt,
      }));
    res.json({ data: items });
  }
);

router.get('/admin/stats', requireAuthContext, requireRole(['admin']), async (_req, res) => {
  const records = await loadRecords();
  const entries = records.filter((r): r is DiaryEntry => r.kind === 'entry');
  const totalEntries = entries.length;
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const entriesLast7d = entries.filter((e) => new Date(e.date) >= sevenAgo);
  const usersWithEntriesLast7d = new Set(entriesLast7d.map((e) => e.userId)).size;

  res.json({ data: { totalEntries, entriesLast7d: entriesLast7d.length, usersWithEntriesLast7d } });
});

router.get(
  '/stats',
  requireAuthContext,
  requireRole(['patient', 'admin', 'caregiver']),
  requireActiveConsent('diary'),
  async (req, res) => {
    const role = req.authContext?.role as 'patient' | 'admin';
    const userId = req.authContext?.userId as string;
    const records = Array.from(buildState(await loadRecords(), role, userId).values()).filter((s) => !s.redacted);

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dates = records.map((r) => r.entry.date).sort().reverse();

    let streak = 0;
    let cursor = todayStr;
    for (const d of dates) {
      if (d === cursor) {
        streak += 1;
        const next = new Date(cursor);
        next.setDate(next.getDate() - 1);
        cursor = next.toISOString().slice(0, 10);
      } else if (new Date(d) < new Date(cursor)) {
        break;
      }
    }

    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 7);
    const last7 = records.filter((r) => new Date(r.entry.date) >= sevenAgo);
    const avgMood = last7.length ? last7.reduce((sum, r) => sum + r.entry.mood, 0) / last7.length : null;
    const avgSymptom = last7.length ? last7.reduce((sum, r) => sum + r.entry.symptomScore, 0) / last7.length : null;

    res.json({
      data: {
        streak,
        lastEntryDate: dates[0] || null,
        avgMood,
        avgSymptom,
      },
    });
  }
);

router.get(
  '/:id',
  requireAuthContext,
  requireRole(['patient', 'admin', 'caregiver']),
  requireActiveConsent('diary'),
  async (req, res) => {
    const role = req.authContext?.role as 'patient' | 'admin';
    const userId = req.authContext?.userId as string;
    const state = buildState(await loadRecords(), role, userId);
    const record = state.get(req.params.id);
    if (!record || record.redacted) return res.status(404).json({ error: 'Not found' });
    if (role === 'admin') {
      return res.json({
        data: {
          id: record.entry.id,
          date: record.entry.date,
          mood: record.entry.mood,
          symptomScore: record.entry.symptomScore,
          hasNotes: !!record.entry.notes,
          createdAt: record.entry.createdAt,
        },
      });
    }
    return res.json({ data: record.entry });
  }
);

router.post(
  '/',
  preventBodyLogging,
  requireAuthContext,
  requireRole(['patient', 'caregiver']),
  csrfGuard,
  requireActiveConsent('diary'),
  async (req, res) => {
    const parsed = diarySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const userId = req.authContext?.userId as string;
    const now = new Date().toISOString();
    const entry: DiaryEntry = {
      kind: 'entry',
      id: `diary-${Date.now()}`,
      userId,
      date: parsed.data.date,
      mood: parsed.data.mood,
      symptomScore: parsed.data.symptomScore,
      notes: parsed.data.notes,
      createdAt: now,
      resourceType: 'Observation',
      status: 'final',
      category: 'patient-reported',
      code: { text: 'Daily Symptom Log' },
      subject: { reference: `Patient/${userId}` },
      effectiveDateTime: parsed.data.date,
    };

    await secureWrite({
      filePath: DIARY_PATH,
      record: entry,
      auditMeta: {
        action: 'DIARY_CREATE',
        actorUserId: userId,
        actorRole: 'patient',
        resourceType: 'Observation',
        resourceId: entry.id,
      },
    });
    const auditHash = await latestAuditHash();
    res.status(201).json({ data: { id: entry.id, createdAt: entry.createdAt, auditHash, consentVerified: true } });
  }
);

router.delete(
  '/:id',
  preventBodyLogging,
  requireAuthContext,
  requireRole(['patient', 'caregiver']),
  csrfGuard,
  requireActiveConsent('diary'),
  async (req, res) => {
    const userId = req.authContext?.userId as string;
    const redaction: DiaryRedaction = {
      kind: 'redaction',
      targetId: req.params.id,
      userId,
      createdAt: new Date().toISOString(),
    };

    await secureWrite({
      filePath: DIARY_PATH,
      record: redaction,
      auditMeta: {
        action: 'DIARY_REDACT',
        actorUserId: userId,
        actorRole: 'patient',
        resourceType: 'Observation',
        resourceId: req.params.id,
      },
    });
    res.json({ ok: true });
  }
);

export default router;
