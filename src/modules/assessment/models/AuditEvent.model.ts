import { Schema, model } from 'mongoose';

const AuditEventSchema = new Schema(
  {
    resourceType: {
      type: String,
      enum: ['AuditEvent'],
      default: 'AuditEvent',
    },

    action: {
      type: String,
      enum: ['CREATE', 'READ', 'UPDATE', 'SUBMIT'],
      required: true,
    },

    actor: {
      userId: String,
      role: String,
    },

    entity: {
      resourceType: String,
      resourceId: String,
    },

    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
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
AuditEventSchema.pre('updateOne', () => {
  throw new Error('AuditEvent is immutable');
});

export const AuditEventModel = model(
  'AuditEvent',
  AuditEventSchema
);
