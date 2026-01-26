// models/ConsentAudit.model.ts
import mongoose from "mongoose";

const ConsentAuditSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    action: { type: String, required: true },
    module: String,
    prevState: String,
    newState: String,
    reason: String,
    capturedBy: String,
    policyHash: String,
    timestamp: String
  },
  {
    versionKey: false
  }
);

export const ConsentAuditModel = mongoose.model(
  "ConsentAudit",
  ConsentAuditSchema
);
