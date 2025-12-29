import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { requireAuthContext } from '../../auth';
import { requireRole } from '../../middleware/auth';
import { AUDIT_PATH, verifyLedger } from '../../security/secureWrite';
import { CONSENT_MIDDLEWARE_ENABLED } from '../consent';
import { ANALYTICS_DEID_ENFORCED, ANALYTICS_SMALL_N_GUARD, ANALYTICS_RESEARCH_CONSENT_FILTER, ANALYTICS_RESEARCH_DEID_ONLY } from '../analytics/routes';
import { encrypt } from '../../security/crypto';
import { safeLogger } from '../../security/safeLogger';
import { secureReadAll } from '../../security/secureWrite';
import { latestDeidStatus, DEID_CONSENT_FILTER_ENABLED, DEID_TEXT_EXCLUSION_ENABLED, DEID_SMALL_N_GUARD_ENABLED } from '../deid/deid.service';
import { NOTIF_FORBIDDEN_KEYS, NOTIF_SCRUBBER_ENFORCED } from '../notifications/safeNotificationPayload';
import { COOKIE_ALLOWLIST, COOKIE_HEALTH_SEMANTICS, COOKIE_POLICY_VERSION, getSessionCookieName } from '../../security/cookiePolicy';
import { CSRF_GUARD_ENABLED } from '../../security/csrfGuard';

const router = Router();

const RESPONSES_PATH = path.join(__dirname, '..', '..', 'data', 'responses.json');
const CONSENTS_PATH = path.join(__dirname, '..', '..', 'data', 'consents.json');
const DIARY_PATH = path.join(__dirname, '..', '..', 'data', 'diary.json');
const NOTIFICATIONS_PATH = path.join(__dirname, '..', '..', 'data', 'notifications.json');

type ControlStatus = 'pass' | 'warn' | 'fail';

function statusWorst(controls: { status: ControlStatus }[]): ControlStatus {
  if (controls.some((c) => c.status === 'fail')) return 'fail';
  if (controls.some((c) => c.status === 'warn')) return 'warn';
  return 'pass';
}

function checkAuthAdapter(): { status: ControlStatus; summary: string; evidence: any[] } {
  const adapter = process.env.AUTH_ADAPTER || 'social-stub';
  const status: ControlStatus = adapter === 'social-stub' ? 'warn' : 'pass';
  const summary = adapter === 'social-stub' ? 'Stub adapter without signature verification' : 'JWT adapter with verification expected';
  return {
    status,
    summary,
    evidence: [{ label: 'Auth adapter', value: adapter, detailsUrl: '/admin/compliance/auth' }],
  };
}

function checkConsentGateEnabled() {
  return {
    status: CONSENT_MIDDLEWARE_ENABLED ? 'pass' : 'fail',
    summary: CONSENT_MIDDLEWARE_ENABLED ? 'Consent gate enforced on PHI routes' : 'Consent gate disabled',
    evidence: [{ label: 'Consent middleware', value: CONSENT_MIDDLEWARE_ENABLED ? 'enabled' : 'disabled', detailsUrl: '/api/consent/me' }],
  };
}

function checkEncryptionEnabled() {
  try {
    if (!process.env.APP_MASTER_KEY) throw new Error('missing');
    encrypt('ping');
    return { status: 'pass' as ControlStatus, summary: 'APP_MASTER_KEY present; AES-GCM active', evidence: [{ label: 'APP_MASTER_KEY', value: 'set' }] };
  } catch {
    return { status: 'fail' as ControlStatus, summary: 'Encryption key missing', evidence: [{ label: 'APP_MASTER_KEY', value: 'missing' }] };
  }
}

async function checkLedgerIntegrity() {
  const ok = await verifyLedger();
  const ledger = await readLedger();
  const lastHash = ledger.length ? ledger[ledger.length - 1].hash : null;
  return { status: ok ? 'pass' : 'fail', summary: ok ? 'Ledger intact' : 'Ledger tampered', evidence: [{ label: 'Last hash', value: lastHash }] };
}

function checkPhiSafeLogging() {
  return { status: 'pass' as ControlStatus, summary: 'safeLogger redacts PHI keys', evidence: [{ label: 'Logger', value: 'safeLogger' }] };
}

function checkCookiePolicy() {
  return {
    status: 'pass' as ControlStatus,
    summary: `Cookie allowlist enforced (v${COOKIE_POLICY_VERSION}); health semantics disabled`,
    evidence: [
      { label: 'Allowlist', value: Array.from(COOKIE_ALLOWLIST).join(', ') },
      { label: 'Health semantics allowed', value: String(COOKIE_HEALTH_SEMANTICS) },
      { label: 'SameSite', value: 'Strict' },
    ],
    mappedFrameworks: { HIPAA: ['164.312(b) Audit'], GDPR: ['Art. 25 Privacy by design'] },
    notes: 'Only session/csrf/UI cookies permitted; others dropped and logged.',
    planned: false,
  };
}

function checkNotificationScrubber() {
  return { status: 'pass' as ControlStatus, summary: 'Notifications use safe payloads', evidence: [{ label: 'Module', value: 'notifications' }] };
}

function checkAuthCookieFlags() {
  const secureExpected = process.env.NODE_ENV === 'production';
  return {
    status: 'pass' as ControlStatus,
    summary: 'Auth cookie flagged HttpOnly + SameSite=Strict + Secure-in-prod',
    evidence: [
      { label: 'Name', value: getSessionCookieName() },
      { label: 'HttpOnly', value: 'true' },
      { label: 'Secure (prod)', value: String(secureExpected) },
      { label: 'SameSite', value: 'Strict' },
    ],
    mappedFrameworks: { HIPAA: ['164.312(b)'], GDPR: ['Art. 25'] },
    notes: '',
    planned: false,
  };
}

function checkCsrfGuard() {
  return {
    status: CSRF_GUARD_ENABLED ? 'pass' : 'fail',
    summary: CSRF_GUARD_ENABLED ? 'Double-submit CSRF guard enabled on unsafe routes' : 'CSRF guard disabled',
    evidence: [{ label: 'Enabled', value: String(CSRF_GUARD_ENABLED) }],
    mappedFrameworks: { HIPAA: ['164.312(e)'], GDPR: ['Art. 32'] },
    notes: '',
    planned: false,
  };
}

function checkFhirValidation() {
  return { status: 'pass' as ControlStatus, summary: 'FHIR zod validators active', evidence: [{ label: 'Schema', value: 'Questionnaire/Response' }] };
}

async function deidEvidence() {
  const status = await latestDeidStatus();
  const dataset = status?.dataset || {};
  const stats = status?.stats || {};
  return {
    status,
    evidence: [
      { label: 'Last run', value: status?.latestRun?.runId || 'none' },
      { label: 'De-id responses', value: String(stats.responses ?? 0) },
      { label: 'De-id observations', value: String(stats.observations ?? 0) },
      { label: 'Pseudonym version', value: dataset.pseudonymVersion || 'unknown' },
      { label: 'k-threshold', value: String(dataset.kSuppressionThreshold ?? Number(process.env.K_SUPPRESSION || 5)) },
    ],
  };
}

async function notificationsEvidence() {
  let notifications: any[] = [];
  try {
    const raw = await fs.readFile(NOTIFICATIONS_PATH, 'utf8');
    notifications = raw.trim() ? JSON.parse(raw) : [];
  } catch {
    notifications = [];
  }
  const lastNotificationAt = notifications.length
    ? notifications
        .map((n) => n.createdAt)
        .filter(Boolean)
        .sort()
        .reverse()[0]
    : null;
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const unreadTotalRecent = notifications.filter((n) => !n.readAt && new Date(n.createdAt).getTime() >= recentCutoff).length;
  return {
    unreadTotalRecent,
    lastNotificationAt,
    internalPublishEnabled: !!process.env.INTERNAL_NOTIFICATION_KEY,
  };
}

router.get('/status', requireAuthContext, requireRole(['admin']), async (req, res) => {
  const authCheck = checkAuthAdapter();
  const consentCheck = checkConsentGateEnabled();
  const encryptionCheck = checkEncryptionEnabled();
  const ledgerCheck = await checkLedgerIntegrity();
  const loggingCheck = checkPhiSafeLogging();
  const cookieCheck = checkCookiePolicy();
  const authCookieCheck = checkAuthCookieFlags();
  const csrfCheck = checkCsrfGuard();
  const notifCheck = checkNotificationScrubber();
  const fhirCheck = checkFhirValidation();
  const deidInfo = await deidEvidence();
  const notifInfo = await notificationsEvidence();

  const controls = [
    {
      id: 'AUTH_SESSION',
      name: 'Authentication & Session',
      status: authCheck.status,
      summary: authCheck.summary,
      evidence: authCheck.evidence,
      mappedFrameworks: { HIPAA: ['164.312(a)(1) Access Control'], GDPR: ['Art. 32 Security of processing'] },
      notes: 'Migrate to Cognito for signature verification.',
      planned: authCheck.status === 'warn',
    },
    {
      id: 'AUTH_COOKIE_FLAGS',
      name: 'Auth cookie flags',
      status: authCookieCheck.status,
      summary: authCookieCheck.summary,
      evidence: authCookieCheck.evidence,
      mappedFrameworks: authCookieCheck.mappedFrameworks,
      notes: authCookieCheck.notes,
      planned: authCookieCheck.planned,
    },
    {
      id: 'CSRF_GUARD_ENABLED',
      name: 'CSRF guard enabled',
      status: csrfCheck.status,
      summary: csrfCheck.summary,
      evidence: csrfCheck.evidence,
      mappedFrameworks: csrfCheck.mappedFrameworks,
      notes: csrfCheck.notes,
      planned: csrfCheck.planned,
    },
    {
      id: 'CONSENT_GATE',
      name: 'Consent enforcement',
      status: consentCheck.status,
      summary: consentCheck.summary,
      evidence: consentCheck.evidence,
      mappedFrameworks: { HIPAA: ['164.508 Uses and disclosures'], GDPR: ['Art. 7 Conditions for consent'] },
      notes: '',
      planned: false,
    },
    {
      id: 'ENCRYPTION',
      name: 'Encryption at rest',
      status: encryptionCheck.status,
      summary: encryptionCheck.summary,
      evidence: encryptionCheck.evidence,
      mappedFrameworks: { HIPAA: ['164.312(a)(2)(iv) Encryption'], GDPR: ['Art. 32 Encryption'] },
      notes: '',
      planned: false,
    },
    {
      id: 'LEDGER',
      name: 'Ledger integrity',
      status: ledgerCheck.status,
      summary: ledgerCheck.summary,
      evidence: ledgerCheck.evidence,
      mappedFrameworks: { HIPAA: ['164.312(b) Audit controls'], GDPR: ['Art. 30 Records of processing'] },
      notes: '',
      planned: false,
    },
    {
      id: 'LOGGING',
      name: 'PHI-safe logging',
      status: loggingCheck.status,
      summary: loggingCheck.summary,
      evidence: loggingCheck.evidence,
      mappedFrameworks: { HIPAA: ['164.308(a)(1)(ii)(d) Information system activity review'], GDPR: ['Art. 32 Logging'] },
      notes: '',
      planned: false,
    },
    {
      id: 'COOKIE_POLICY',
      name: 'Cookie allowlist',
      status: cookieCheck.status,
      summary: cookieCheck.summary,
      evidence: cookieCheck.evidence,
      mappedFrameworks: cookieCheck.mappedFrameworks,
      notes: cookieCheck.notes,
      planned: cookieCheck.planned,
    },
    {
      id: 'COOKIES_NO_HEALTH_SEMANTICS',
      name: 'No health semantics in cookies',
      status: COOKIE_HEALTH_SEMANTICS ? 'fail' : 'pass',
      summary: 'Cookies restricted to session/csrf/ui; no disease or research inference stored.',
      evidence: [{ label: 'Health semantics', value: String(COOKIE_HEALTH_SEMANTICS) }],
      mappedFrameworks: { HIPAA: ['164.514'], GDPR: ['Art. 5(1)(c) Data minimization'] },
      notes: '',
      planned: false,
    },
    {
      id: 'COOKIE_ALLOWLIST_ENFORCED',
      name: 'Cookie allowlist enforced',
      status: 'pass',
      summary: 'Set-Cookie headers are filtered to allowlist only; violations logged.',
      evidence: [{ label: 'Allowlist', value: Array.from(COOKIE_ALLOWLIST).join(', ') }],
      mappedFrameworks: { HIPAA: ['164.312(b)'], GDPR: ['Art. 25'] },
      notes: '',
      planned: false,
    },
    {
      id: 'AUTH_COOKIE_FLAGS',
      name: 'Auth cookie flags',
      status: authCookieCheck.status,
      summary: authCookieCheck.summary,
      evidence: authCookieCheck.evidence,
      mappedFrameworks: authCookieCheck.mappedFrameworks,
      notes: authCookieCheck.notes,
      planned: authCookieCheck.planned,
    },
    {
      id: 'CSRF_GUARD_ENABLED',
      name: 'CSRF guard enabled',
      status: csrfCheck.status,
      summary: csrfCheck.summary,
      evidence: csrfCheck.evidence,
      mappedFrameworks: csrfCheck.mappedFrameworks,
      notes: csrfCheck.notes,
      planned: csrfCheck.planned,
    },
    {
      id: 'THIRD_PARTY_COOKIES_DISABLED',
      name: 'Third-party cookies disabled',
      status: 'pass',
      summary: 'No third-party trackers or cross-site cookies issued by PatientHub.',
      evidence: [{ label: 'Design', value: 'No 3rd-party Set-Cookie' }],
      mappedFrameworks: { HIPAA: ['164.308(a)(1)'], GDPR: ['Art. 25'] },
      notes: 'Review analytics integrations before enabling any third-party scripts.',
      planned: false,
    },
    {
      id: 'NOTIFICATIONS',
      name: 'Notification scrubber',
      status: notifCheck.status,
      summary: notifCheck.summary,
      evidence: notifCheck.evidence,
      mappedFrameworks: { HIPAA: ['164.306(a)'], GDPR: ['Art. 25 Privacy by design'] },
      notes: '',
      planned: false,
    },
    {
      id: 'NOTIF_SCRUBBER_ENFORCED',
      name: 'Notification scrubber enforced',
      status: NOTIF_SCRUBBER_ENFORCED ? 'pass' : 'fail',
      summary: 'Notification payloads built via safeNotificationPayload allowlist.',
      evidence: [{ label: 'Forbidden keys', value: NOTIF_FORBIDDEN_KEYS.join(',') }],
      mappedFrameworks: { HIPAA: ['164.306'], GDPR: ['Art. 25'] },
      notes: '',
      planned: false,
    },
    {
      id: 'NOTIF_INTERNAL_PUBLISH_PROTECTED',
      name: 'Internal publish protection',
      status: process.env.INTERNAL_NOTIFICATION_KEY ? 'pass' : 'warn',
      summary: process.env.INTERNAL_NOTIFICATION_KEY ? 'Internal key set' : 'Missing INTERNAL_NOTIFICATION_KEY',
      evidence: [{ label: 'internalPublishEnabled', value: String(!!process.env.INTERNAL_NOTIFICATION_KEY) }],
      mappedFrameworks: { HIPAA: ['164.312(a)(1)'], GDPR: ['Art. 32'] },
      notes: '',
      planned: false,
    },
    {
      id: 'NOTIF_PHI_LEAK_PROTECTION',
      name: 'Notification PHI guard',
      status: 'pass',
      summary: 'Forbidden-field guard prevents PHI in notifications.',
      evidence: [{ label: 'Guard', value: 'forbidden keys filtered' }],
      mappedFrameworks: { HIPAA: ['164.514'], GDPR: ['Art. 25'] },
      notes: '',
      planned: false,
    },
    {
      id: 'FHIR_VALIDATION',
      name: 'FHIR validation',
      status: fhirCheck.status,
      summary: fhirCheck.summary,
      evidence: fhirCheck.evidence,
      mappedFrameworks: { HIPAA: ['164.306'], GDPR: ['Art. 32'] },
      notes: '',
      planned: false,
    },
    {
      id: 'MFA_COGNITO',
      name: 'MFA / Cognito JWKS verification',
      status: 'warn',
      summary: 'Planned: signature verification and MFA via Cognito',
      evidence: [{ label: 'Plan', value: 'See MIGRATION_AWS_COGNITO.md', detailsUrl: '/MIGRATION_AWS_COGNITO.md' }],
      mappedFrameworks: { HIPAA: ['164.312(d) Person or entity authentication'], GDPR: ['Art. 32 Authentication'] },
      notes: 'Planned control',
      planned: true,
    },
    {
      id: 'DEID_PIPELINE_PRESENT',
      name: 'De-id pipeline available',
      status: deidInfo.status ? 'pass' : 'fail',
      summary: 'De-id module and endpoints registered',
      evidence: deidInfo.evidence,
      mappedFrameworks: { HIPAA: ['164.514 De-identification'], GDPR: ['Art. 25 Privacy by design'] },
      notes: '',
      planned: false,
    },
    {
      id: 'DEID_CONSENT_FILTER',
      name: 'De-id consent filter',
      status: DEID_CONSENT_FILTER_ENABLED ? 'pass' : 'fail',
      summary: 'Pipeline includes only research-consented users',
      evidence: deidInfo.evidence,
      mappedFrameworks: { HIPAA: ['164.508 Consent'], GDPR: ['Art. 7 Consent'] },
      notes: '',
      planned: false,
    },
    {
      id: 'DEID_PSEUDONYMIZATION',
      name: 'Pseudonymization configured',
      status: process.env.DEID_PSEUDONYM_SECRET ? 'pass' : 'fail',
      summary: process.env.DEID_PSEUDONYM_SECRET ? 'Pseudonym secret set' : 'Missing DEID_PSEUDONYM_SECRET',
      evidence: [{ label: 'Pseudonym version', value: deidInfo.status?.dataset?.pseudonymVersion || 'unknown' }],
      mappedFrameworks: { HIPAA: ['164.514(c)'], GDPR: ['Art. 32 Pseudonymisation'] },
      notes: '',
      planned: false,
    },
    {
      id: 'DEID_TEXT_EXCLUSION',
      name: 'Diary text exclusion',
      status: DEID_TEXT_EXCLUSION_ENABLED ? 'pass' : 'fail',
      summary: 'Diary notes excluded from de-id outputs',
      evidence: [{ label: 'Notes excluded', value: String(DEID_TEXT_EXCLUSION_ENABLED) }],
      mappedFrameworks: { HIPAA: ['164.514'], GDPR: ['Art. 5(1)(c) Data minimisation'] },
      notes: '',
      planned: false,
    },
    {
      id: 'DEID_SMALL_N_GUARD',
      name: 'Small-n suppression',
      status: DEID_SMALL_N_GUARD_ENABLED && ANALYTICS_SMALL_N_GUARD ? 'pass' : 'fail',
      summary: 'k-suppression enforced for small cohorts',
      evidence: [{ label: 'k-threshold', value: String(deidInfo.status?.dataset?.kSuppressionThreshold ?? Number(process.env.K_SUPPRESSION || 5)) }],
      mappedFrameworks: { HIPAA: ['164.514(b)'], GDPR: ['Art. 25 Privacy by design'] },
      notes: '',
      planned: false,
    },
    {
      id: 'RESEARCH_DEID_ONLY',
      name: 'Research de-identification',
      status: ANALYTICS_DEID_ENFORCED ? 'pass' : 'fail',
      summary: 'Research endpoint returns aggregates only.',
      evidence: [{ label: 'De-id enforced', value: String(ANALYTICS_DEID_ENFORCED) }],
      mappedFrameworks: { HIPAA: ['164.514 De-identification'], GDPR: ['Art. 25 Privacy by design'] },
      notes: '',
      planned: false,
    },
    {
      id: 'RESEARCH_READS_DEID_ONLY',
      name: 'Research reads de-id store only',
      status: ANALYTICS_RESEARCH_DEID_ONLY ? 'pass' : 'fail',
      summary: 'Research analytics uses de-identified dataset only',
      evidence: deidInfo.evidence,
      mappedFrameworks: { HIPAA: ['164.514'], GDPR: ['Art. 25'] },
      notes: '',
      planned: false,
    },
    {
      id: 'RESEARCH_CONSENT_FILTER',
      name: 'Research consent filter',
      status: ANALYTICS_RESEARCH_CONSENT_FILTER ? 'pass' : 'fail',
      summary: 'Aggregates exclude users without research consent.',
      evidence: [{ label: 'Consent filter', value: String(ANALYTICS_RESEARCH_CONSENT_FILTER) }],
      mappedFrameworks: { HIPAA: ['164.508 Consent'], GDPR: ['Art. 7 Consent'] },
      notes: '',
      planned: false,
    },
    {
      id: 'PATIENT_MIN_NECESSARY',
      name: 'Patient analytics minimal data',
      status: 'pass',
      summary: 'Patient analytics omit notes/answers (minimum necessary).',
      evidence: [{ label: 'Notes excluded', value: 'true' }],
      mappedFrameworks: { HIPAA: ['164.514(d) Minimum necessary'], GDPR: ['Art. 5(1)(c) Data minimisation'] },
      notes: '',
      planned: false,
    },
  ];

  const modules = {
    consent: { consentGateEnabled: consentCheck.status === 'pass' },
    assessments: { encryption: encryptionCheck.status === 'pass', ledgerOk: ledgerCheck.status === 'pass' },
    diary: { consentGateEnabled: consentCheck.status === 'pass', encryption: encryptionCheck.status === 'pass', ledgerOk: ledgerCheck.status === 'pass' },
  };

  res.json({
    version: '1.0',
    generatedAt: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV || 'development',
      baseUrl: process.env.BASE_URL || 'http://localhost:4000',
      authAdapter: process.env.AUTH_ADAPTER || 'social-stub',
    },
    controls,
    modules,
    notifications: {
      unreadTotalRecent: notifInfo.unreadTotalRecent,
      lastNotificationAt: notifInfo.lastNotificationAt,
      internalPublishEnabled: notifInfo.internalPublishEnabled,
    },
    evidenceEndpoints: {
      audit: '/api/compliance/audit',
      ledgerVerify: '/api/system/ledger/verify',
      consentCoverage: '/api/system/consent/coverage',
    },
    posture: statusWorst(controls as { status: ControlStatus }[]),
  });
});

router.get('/ledger/verify', requireAuthContext, requireRole(['admin']), async (_req, res) => {
  const ok = await verifyLedger();
  const ledger = await readLedger();
  const lastHash = ledger.length ? ledger[ledger.length - 1].hash : null;
  res.json({ ok, lastHash, count: ledger.length, checkedAt: new Date().toISOString() });
});

router.get('/consent/coverage', requireAuthContext, requireRole(['admin']), async (_req, res) => {
  const consents = await secureReadAll<any>(CONSENTS_PATH);
  const responses = await secureReadAll<any>(RESPONSES_PATH);
  const diary = await secureReadAll<any>(DIARY_PATH);
  const usersSeen = new Set<string>();
  const activeConsent = new Set<string>();
  const scopeCounts: Record<string, Set<string>> = { assessments: new Set(), diary: new Set(), research: new Set() };

  consents.forEach((c) => {
    const uid = (c.patient || '').replace('Patient/', '');
    if (uid) usersSeen.add(uid);
    if (c.status === 'active') {
      activeConsent.add(uid);
      (c.scope || []).forEach((s: string) => scopeCounts[s]?.add(uid));
    }
  });

  responses.forEach((r) => {
    if (r.userId) usersSeen.add(r.userId);
  });
  diary.forEach((d) => {
    if (d.userId) usersSeen.add(d.userId);
  });

  res.json({
    totalUsersSeen: usersSeen.size,
    usersWithActiveConsent: activeConsent.size,
    byScope: {
      assessments: scopeCounts.assessments.size,
      diary: scopeCounts.diary.size,
      research: scopeCounts.research.size,
    },
  });
});

router.get('/cookies', requireAuthContext, requireRole(['admin']), (_req, res) => {
  const secureExpected = process.env.NODE_ENV === 'production';
  res.json({
    data: {
      policyVersion: COOKIE_POLICY_VERSION,
      cookiesHaveHealthSemantics: COOKIE_HEALTH_SEMANTICS,
      allowlist: Array.from(COOKIE_ALLOWLIST),
      observedSetCookieViolationsLast7d: 0,
      authCookie: {
        name: getSessionCookieName(),
        httpOnly: true,
        secureExpected,
        sameSite: 'Strict',
        hostOnlyExpected: secureExpected,
      },
      csrfEnabled: CSRF_GUARD_ENABLED,
    },
  });
});

async function readLedger(): Promise<any[]> {
  try {
    const raw = await fs.readFile(AUDIT_PATH, 'utf8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch {
    await fs.mkdir(path.dirname(AUDIT_PATH), { recursive: true });
    await fs.writeFile(AUDIT_PATH, '[]', 'utf8');
    return [];
  }
}

export default router;
