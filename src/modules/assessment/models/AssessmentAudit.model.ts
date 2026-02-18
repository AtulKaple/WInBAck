import { Schema, model, Types } from "mongoose";

const AssessmentAuditSchema = new Schema(
  {
    resourceType: {
      type: String,
      enum: ["AssessmentAudit"],
      default: "AssessmentAudit",
    },

    action: {
      type: String,
      enum: [
        "CREATE",
        "UPDATE",
        "PUBLISH_NEW_VERSION",
        "SUBMIT",
        "DELETE_DRAFT",
      ],
      required: true,
    },

    actor: {
      userId: { type: String, required: true },
      role: { type: String, required: true },
    },

    assessment: {
      logicalId: { type: String, required: true },
      version: { type: String },
      questionnaireId: { type: Types.ObjectId },
    },

    response: {
      questionnaireResponseId: { type: Types.ObjectId },
    },

    metadata: {
      type: Schema.Types.Mixed, // flexible storage
    },

    outcome: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      required: true,
    },

    recordedAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// 🔒 append-only ledger
AssessmentAuditSchema.pre("updateOne", () => {
  throw new Error("AssessmentAudit is immutable");
});

AssessmentAuditSchema.pre("deleteOne", () => {
  throw new Error("AssessmentAudit cannot be deleted");
});

export const AssessmentAuditModel = model(
  "AssessmentAudit",
  AssessmentAuditSchema
);
