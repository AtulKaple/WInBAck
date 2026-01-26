import { ConsentAuditModel } from "../models/ConsentAudit.model";
import { nowISO } from "../utils/time";

export const AuditService = {
  async append(event: any) {
    await ConsentAuditModel.create({
      ...event,
      timestamp: nowISO()
    });
  }
};
