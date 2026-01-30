export const CONSENT_STATES = {
  NOT_ASKED: "NOT_ASKED",
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED"
} as const;

export const MODULES = [
  "assessments",
  "diary",
  "analytics",
  "ai_insights",
  "medications"
] as const;

export const PURPOSES = [
  "care",
  "personal_tracking",
  "research_aggregate",
  "research_export"
] as const;

export const ROLES = {
  PATIENT: "patient",
  CAREGIVER: "caregiver",
  RESEARCHER: "researcher",
  ADMIN: "admin"
} as const;

export const ERROR_CODES = {
  CONSENT_REQUIRED: "CONSENT_REQUIRED",
  CONSENT_REVOKED: "CONSENT_REVOKED"
};
