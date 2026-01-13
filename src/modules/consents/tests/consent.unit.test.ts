import { ConsentService } from "../services/ConsentService";
import { CONSENT_STATES } from "../constants/consent.constants";
import { requireActiveConsent } from "../middleware/requireConsent";
import { StorageAdapter } from "../services/StorageAdapter";

describe("Consent Module – Unit Tests", () => {
  const userId = "user-test-1";
  const module = "assessments";

  beforeEach(() => {
    jest.resetModules();

    // Reset JSON storage
    StorageAdapter.writeConsents({});
    StorageAdapter.writeAudit({ records: [] });
  });

  test("No consent → default state is PENDING", () => {
    const status = ConsentService.getConsentStatus(userId, module);

    expect(status.state).toBe(CONSENT_STATES.PENDING);
    expect(status.grantedAt).toBeNull();
  });

  test("Grant consent → state becomes ACTIVE", () => {
    ConsentService.grantConsent({
      userId,
      module,
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    const status = ConsentService.getConsentStatus(userId, module);

    expect(status.state).toBe(CONSENT_STATES.ACTIVE);
    expect(status.grantedAt).toBeDefined();
    expect(status.revokedAt).toBeNull();
  });

  test("Revoke consent → state becomes REVOKED", () => {
    ConsentService.grantConsent({
      userId,
      module,
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    ConsentService.revokeConsent({
      userId,
      module,
      reason: "user_revoked",
      capturedBy: "web"
    });

    const status = ConsentService.getConsentStatus(userId, module);

    expect(status.state).toBe(CONSENT_STATES.REVOKED);
    expect(status.revokedAt).toBeDefined();
  });

  test("requireActiveConsent blocks request when consent is not ACTIVE", async () => {
    const req: any = {
      authContext: { userId }
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const next = jest.fn();

    await requireActiveConsent(module)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "CONSENT_REQUIRED",
        module
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("requireActiveConsent allows request when consent is ACTIVE", async () => {
    ConsentService.grantConsent({
      userId,
      module,
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    const req: any = {
      authContext: { userId }
    };

    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    const next = jest.fn();

    await requireActiveConsent(module)(req, res, next);

    expect(req.consentContext).toEqual(
      expect.objectContaining({
        module,
        state: CONSENT_STATES.ACTIVE
      })
    );

    expect(next).toHaveBeenCalled();
  });

  test("Audit entry is written on consent grant", () => {
    ConsentService.grantConsent({
      userId,
      module,
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    const audit = StorageAdapter.readAudit();

    expect(audit.records.length).toBe(1);
    expect(audit.records[0]).toMatchObject({
      actor: userId,
      action: "CONSENT_GRANTED",
      module,
      newState: CONSENT_STATES.ACTIVE
    });
  });

  test("Audit entry is written on consent revoke", () => {
    ConsentService.grantConsent({
      userId,
      module,
      policyVersion: "v1",
      policyHash: "hash123",
      capturedBy: "web"
    });

    ConsentService.revokeConsent({
      userId,
      module,
      reason: "user_revoked",
      capturedBy: "web"
    });

    const audit = StorageAdapter.readAudit();

    expect(audit.records.length).toBe(2);
    expect(audit.records[1]).toMatchObject({
      actor: userId,
      action: "CONSENT_REVOKED",
      module,
      newState: CONSENT_STATES.REVOKED
    });
  });
});
