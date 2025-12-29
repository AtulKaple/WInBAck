import { Consent } from './types';
import { ConsentStore } from './store';

const store = new ConsentStore();

export async function getLatestConsent(userId: string): Promise<Consent | null> {
  // Consent enforcement disabled: return a synthetic always-active consent.
  return {
    resourceType: 'Consent',
    id: `consent-${userId || 'anon'}`,
    patient: `Patient/${userId || 'anon'}`,
    status: 'active',
    scope: ['assessments', 'diary', 'research'],
    provision: {},
    dateTime: new Date().toISOString(),
    performer: userId || 'anon',
  };
}

export async function appendConsent(consent: Consent, actor: { userId?: string; role?: string }): Promise<void> {
  // No-op while consent is disabled.
  void consent;
  void actor;
}

export async function hasActiveConsent(userId: string, scope: string): Promise<boolean> {
  // Consent checks are bypassed.
  return true;
}

export async function ensureAssessmentConsent(userId: string): Promise<Consent> {
  return (await getLatestConsent(userId))!;
}
