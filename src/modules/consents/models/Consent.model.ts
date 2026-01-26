// models/Consent.model.ts
import mongoose from "mongoose";
import { CONSENT_STATES, MODULES } from "../constants/consent.constants";

const ModuleConsentSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      enum: Object.values(CONSENT_STATES),
      required: true
    },
    grantedAt: String,
    revokedAt: String
  },
  { _id: false }
);

const ConsentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true, unique: true },

    purpose: { type: String, default: "care" },
    role: { type: String, default: "patient" },

    modules: {
      type: Map,
      of: ModuleConsentSchema,
      required: true
    },

    policyVersion: String,
    policyHash: String,

    createdAt: String,
    updatedAt: String
  },
  { versionKey: false }
);

export const ConsentModel = mongoose.model("Consent", ConsentSchema);
