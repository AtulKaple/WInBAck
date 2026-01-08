import crypto from "crypto";
import { StorageAdapter } from "./StorageAdapter";
import { MODULES, CONSENT_STATES } from "../constants/consent.constants";
import { nowISO } from "../utils/time";
import { AuditService } from "./AuditService";

export class ConsentService {

  /** Ensure baseline consent exists for user */
  static ensureUser(userId: string, meta?: any) {
    const consents = StorageAdapter.readConsents();

    if (!consents[userId]) {
      const modules: Record<string, any> = {};
      for (const m of MODULES) {
        modules[m] = {
          state: CONSENT_STATES.PENDING,
          grantedAt: null,
          revokedAt: null
        };
      }

      consents[userId] = {
        id: crypto.randomUUID(),
        userId,
        purpose: "care",
        role: "patient",
        modules,
        policyVersion: meta?.policyVersion ?? null,
        policyHash: meta?.policyHash ?? null,
        createdAt: nowISO(),
        updatedAt: nowISO()
      };

      StorageAdapter.writeConsents(consents);
    }

    return consents[userId];
  }

  /** Grant consent for a single module */
  static grantConsent({ userId, module, policyVersion, policyHash, capturedBy }: { userId: string; module: string; policyVersion?: string; policyHash?: string; capturedBy: string }) {
    const consents = StorageAdapter.readConsents();
    const record = this.ensureUser(userId, { policyVersion, policyHash });

    record.modules[module] = {
      state: CONSENT_STATES.ACTIVE,
      grantedAt: nowISO(),
      revokedAt: null
    };

    record.policyVersion = policyVersion ?? record.policyVersion;
    record.policyHash = policyHash ?? record.policyHash;
    record.updatedAt = nowISO();

    consents[userId] = record;
    StorageAdapter.writeConsents(consents);

    AuditService.append({
      actor: userId,
      action: "CONSENT_GRANTED",
      module,
      prevState: CONSENT_STATES.NOT_ASKED,
      newState: CONSENT_STATES.ACTIVE,
      capturedBy,
      policyHash
    });

    return record.modules[module];
  }

  /** Revoke consent for a single module */
  static revokeConsent({ userId, module, reason, capturedBy }: { userId: string; module: string; reason: string; capturedBy: string }) {
    const consents = StorageAdapter.readConsents();
    const record = this.ensureUser(userId);

    record.modules[module] = {
      state: CONSENT_STATES.REVOKED,
      grantedAt: record.modules[module]?.grantedAt ?? null,
      revokedAt: nowISO()
    };

    record.updatedAt = nowISO();
    consents[userId] = record;
    StorageAdapter.writeConsents(consents);

    AuditService.append({
      actor: userId,
      action: "CONSENT_REVOKED",
      module,
      prevState: CONSENT_STATES.ACTIVE,
      newState: CONSENT_STATES.REVOKED,
      reason,
      capturedBy
    });

    return record.modules[module];
  }

  /** List all module consents for user */
  static listUserConsents(userId: string) {
    const consents = StorageAdapter.readConsents();
    return this.ensureUser(userId).modules;
  }

  /** Get single module consent */
  static getConsentStatus(userId: string, module: string) {
    return this.ensureUser(userId).modules[module];
  }
}
