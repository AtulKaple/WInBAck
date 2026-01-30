import mongoose from "mongoose";

const MedicationAuditSchema = new mongoose.Schema(
  {
    medicationId: mongoose.Schema.Types.ObjectId,
    action: { type: String, required: true },
    reason: String,
    performedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("MedicationAudit", MedicationAuditSchema);