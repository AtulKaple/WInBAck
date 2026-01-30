import mongoose from "mongoose";

const MedicationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },

    name: { type: String, required: true },
    form: {
      type: String,
      enum: ["tablet","capsule","syrup","injection","drops","inhaler","other"],
      required: true,
    },
    dosage: String,

    diseases: [{ type: mongoose.Schema.Types.ObjectId, ref: "Disease" }],

    frequency: {
      type: {
        type: String,
        enum: ["daily","weekly","hourly","prn"],
        required: true,
      },
      times: [String],              // HH:mm
      daysOfWeek: [Number],         // 0–6
      intervalHours: Number,
    },

    mealTiming: {
      type: String,
      enum: ["before_meal","after_meal","anytime","prn"],
    },

    instructions: String,

    emailNotificationsEnabled: { type: Boolean, default: true },

    status: {
      type: String,
      enum: ["active","stopped"],
      default: "active",
    },

    stoppedAt: Date,
    stopReason: String,

    resumedAt: Date,
    resumeReason: String,

    startDate: { type: Date, required: true },
    endDate: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Medication", MedicationSchema);
