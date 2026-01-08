export const CONSENT_STATES = {
  NOT_ASKED: "NOT_ASKED",
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  REVOKED: "REVOKED",
  EXPIRED: "EXPIRED"
};

export const MODULES = [
  "assessments",
  "diary",
  "analytics",
  "ai_insights",
  "secure_share"
];

export const PURPOSES = [
  "care",
  "personal_tracking",
  "research_aggregate",
  "research_export"
];

export const ROLES = {
  PATIENT: "patient",
  CAREGIVER: "caregiver",
  RESEARCHER: "researcher",
  ADMIN: "admin"
};

export const ERROR_CODES = {
  CONSENT_REQUIRED: "CONSENT_REQUIRED",
  CONSENT_REVOKED: "CONSENT_REVOKED"
};
