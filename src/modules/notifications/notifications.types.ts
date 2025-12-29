export type NotificationType =
  | 'ASSESSMENT_DUE'
  | 'ASSESSMENT_COMPLETED'
  | 'DIARY_REMINDER'
  | 'CONSENT_REQUIRED'
  | 'SYSTEM_ANNOUNCEMENT';

export type NotificationRecord = {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  ctaUrl: string;
  severity: 'info' | 'warning';
  createdAt: string;
  readAt: string | null;
  source: 'patienthub';
  metadata: { module?: 'assessments' | 'diary' | 'consent' | 'system'; [k: string]: any };
};
