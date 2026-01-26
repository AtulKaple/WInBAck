import { ConsentModel } from "../models/Consent.model";
import { MODULES, CONSENT_STATES } from "../constants/consent.constants";
import { nowISO } from "../utils/time";
import { AuditService } from "./AuditService";

export class ConsentService {
  static async ensureUser(userId: string, meta?: any) {
    let consent = await ConsentModel.findOne({ userId });

    if (!consent) {
      const modules: any = {};
      for (const m of MODULES) {
        modules[m] = {
          state: CONSENT_STATES.PENDING,
          grantedAt: null,
          revokedAt: null
        };
      }

      consent = await ConsentModel.create({
        userId,
        purpose: "care",
        role: "patient",
        modules,
        policyVersion: meta?.policyVersion ?? null,
        policyHash: meta?.policyHash ?? null,
        createdAt: nowISO(),
        updatedAt: nowISO()
      });
    }

    return consent;
  }

  static async grantConsent({
    userId,
    module,
    policyVersion,
    policyHash,
    capturedBy
  }: any) {
    const consent = await this.ensureUser(userId, {
      policyVersion,
      policyHash
    });

    const prevState = consent.modules.get(module)?.state;

    consent.modules.set(module, {
      state: CONSENT_STATES.ACTIVE,
      grantedAt: nowISO(),
      revokedAt: null
    });

    consent.policyVersion = policyVersion ?? consent.policyVersion;
    consent.policyHash = policyHash ?? consent.policyHash;
    consent.updatedAt = nowISO();

    await consent.save();

    await AuditService.append({
      userId,
      action: "CONSENT_GRANTED",
      module,
      prevState,
      newState: CONSENT_STATES.ACTIVE,
      capturedBy,
      policyHash
    });

    return consent.modules.get(module);
  }

  static async revokeConsent({
    userId,
    module,
    reason,
    capturedBy
  }: any) {
    const consent = await this.ensureUser(userId);

    const prev = consent.modules.get(module);

    consent.modules.set(module, {
      state: CONSENT_STATES.REVOKED,
      grantedAt: prev?.grantedAt ?? null,
      revokedAt: nowISO()
    });

    consent.updatedAt = nowISO();
    await consent.save();

    await AuditService.append({
      userId,
      action: "CONSENT_REVOKED",
      module,
      prevState: prev?.state,
      newState: CONSENT_STATES.REVOKED,
      reason,
      capturedBy
    });

    return consent.modules.get(module);
  }

  static async listUserConsents(userId: string) {
    const consent = await this.ensureUser(userId);
    return Object.fromEntries(consent.modules);
  }

  static async getConsentStatus(userId: string, module: string) {
    const consent = await this.ensureUser(userId);
    return consent.modules.get(module);
  }
}
