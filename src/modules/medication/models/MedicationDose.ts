import mongoose from "mongoose";

const MedicationDoseSchema = new mongoose.Schema(
  {
    medicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Medication" },
    userId: { type: String, required: true },

    scheduledAt: { type: Date, required: true },

    status: {
      type: String,
      enum: ["pending","taken","skipped","missed"],
      default: "pending",
    },

    takenAt: Date,
    skippedReason: String,

    snoozedUntil: { type: Date , default: null },

    emailSentAt: Date,
    
  },
  { timestamps: true }
);

export default mongoose.model("MedicationDose", MedicationDoseSchema);
