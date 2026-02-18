import { Schema, model } from 'mongoose';

// for Audit trail / version tracking

const ProvenanceSchema = new Schema({
  userId: String,
  questionnaireId: String,
  version: String,
  consentSnapshotId: String,
  recordedAt: Date,
});

export const ProvenanceModel = model('Provenance', ProvenanceSchema);
