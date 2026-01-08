import { StorageAdapter } from "./StorageAdapter";
import { sha256 } from "../utils/crypto";
import { nowISO } from "../utils/time";

export const AuditService = {
  append(event: any) {
    const audit = StorageAdapter.readAudit();
    if (!audit.records) audit.records = [];

    const prev = audit.records.at(-1);
    const prevHash = prev?.hash ?? null;

    const payload = {
      ...event,
      timestamp: nowISO(),
      prevHash
    };

    const hash = sha256(JSON.stringify(payload));

    audit.records.push({ ...payload, hash });
    StorageAdapter.writeAudit(audit);
  }
};
