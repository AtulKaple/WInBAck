import { ConsentService } from "../services/ConsentService";
import { CONSENT_STATES } from "../constants/consent.constants";
import { requireConsent } from "../middleware/requireConsent";

describe("Consent Module – Unit Tests", () => {
  const userId = "user-test-1";
  const module = "assessments";
  const purpose = "care";

  beforeEach(() => {
    // Reset JSON stores
    jest.resetModules();
  });

  test("No consent → status is NOT_ASKED", () => {
    const status = ConsentService.getConsentStatus({
      userId,
      module,
      purpose
    });

    expect(status.state).toBe(CONSENT_STATES.NOT_ASKED);
  });

  test("Grant consent → state becomes ACTIVE", () => {
    const result = ConsentService.grantConsent({
      userId,
      module,
      purpose,
      role: "patient",
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    expect(result.state).toBe(CONSENT_STATES.ACTIVE);

    const status = ConsentService.getConsentStatus({
      userId,
      module,
      purpose
    });

    expect(status.state).toBe(CONSENT_STATES.ACTIVE);
  });

  test("Revoke consent → state becomes REVOKED", () => {
    ConsentService.grantConsent({
      userId,
      module,
      purpose,
      role: "patient",
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    ConsentService.revokeConsent({
      userId,
      module,
      purpose,
      reason: "user_revoked"
    });

    const status = ConsentService.getConsentStatus({
      userId,
      module,
      purpose
    });

    expect(status.state).toBe(CONSENT_STATES.REVOKED);
  });

  test("requireConsent blocks request when no consent", () => {
    const req = { user: { id: userId } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    requireConsent({ module, purpose })(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("requireConsent allows request when ACTIVE", () => {
    ConsentService.grantConsent({
      userId,
      module,
      purpose,
      role: "patient",
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    const req = { user: { id: userId } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    requireConsent({ module, purpose })(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test("Audit entry is written on consent change", () => {
    const result = ConsentService.grantConsent({
      userId,
      module,
      purpose,
      role: "patient",
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    expect(result.auditRef).toBeDefined();
  });
});
