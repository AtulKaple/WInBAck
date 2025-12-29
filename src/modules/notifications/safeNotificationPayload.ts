import { NotificationRecord } from './notifications.types';

const ALLOWED_TYPES = [
  'ASSESSMENT_DUE',
  'ASSESSMENT_COMPLETED',
  'DIARY_REMINDER',
  'CONSENT_REQUIRED',
  'SYSTEM_ANNOUNCEMENT',
] as const;

const MESSAGE_MAP: Record<(typeof ALLOWED_TYPES)[number], string> = {
  ASSESSMENT_DUE: 'You have an assessment to complete.',
  ASSESSMENT_COMPLETED: 'Assessment completed.',
  DIARY_REMINDER: 'Reminder: Update your diary.',
  CONSENT_REQUIRED: 'Action needed: Please review consent.',
  SYSTEM_ANNOUNCEMENT: 'System announcement.',
};

const CTA_ALLOWLIST = [
  '/patient/dashboard',
  '/patient/assessments',
  '/patient/consent',
  '/patient/diary',
  '/admin/dashboard',
  '/admin/system-status',
] as const;

export const NOTIF_SCRUBBER_ENFORCED = true;
export const NOTIF_FORBIDDEN_KEYS = ['score', 'scores', 'answers', 'answer', 'notes', 'note', 'questionnaire', 'diary', 'observation', 'title', 'text'];

type BuildInput = {
  type: (typeof ALLOWED_TYPES)[number];
  userId: string;
  ctaUrl?: string;
  severity?: 'info' | 'warning';
  metadata?: { module?: 'assessments' | 'diary' | 'consent' | 'system' };
  message?: string;
};

export function buildSafeNotification(input: BuildInput): NotificationRecord {
  if (!ALLOWED_TYPES.includes(input.type)) {
    throw new Error('Notification type not allowed');
  }
  const keys = Object.keys(input);
  if (keys.some((k) => NOTIF_FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f)))) {
    throw new Error('Forbidden field detected');
  }
  if (input.metadata && Object.keys(input.metadata).some((k) => NOTIF_FORBIDDEN_KEYS.some((f) => k.toLowerCase().includes(f)))) {
    throw new Error('Forbidden metadata field');
  }
  if (input.message && input.message !== MESSAGE_MAP[input.type]) {
    throw new Error('Custom messages are not allowed');
  }
  const cta = input.ctaUrl || defaultCta(input.type);
  if (!CTA_ALLOWLIST.includes(cta as any)) {
    throw new Error('CTA not allowed');
  }
  const now = new Date().toISOString();
  return {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: input.userId,
    type: input.type,
    message: MESSAGE_MAP[input.type],
    ctaUrl: cta,
    severity: input.severity || (input.type === 'CONSENT_REQUIRED' ? 'warning' : 'info'),
    createdAt: now,
    readAt: null,
    source: 'patienthub',
    metadata: { module: input.metadata?.module || moduleForType(input.type) },
  };
}

function defaultCta(type: (typeof ALLOWED_TYPES)[number]) {
  if (type === 'CONSENT_REQUIRED') return '/patient/consent';
  if (type === 'ASSESSMENT_COMPLETED' || type === 'ASSESSMENT_DUE') return '/patient/assessments';
  if (type === 'DIARY_REMINDER') return '/patient/diary';
  return '/patient/dashboard';
}

function moduleForType(type: (typeof ALLOWED_TYPES)[number]): 'assessments' | 'diary' | 'consent' | 'system' {
  if (type === 'ASSESSMENT_COMPLETED' || type === 'ASSESSMENT_DUE') return 'assessments';
  if (type === 'DIARY_REMINDER') return 'diary';
  if (type === 'CONSENT_REQUIRED') return 'consent';
  return 'system';
}
