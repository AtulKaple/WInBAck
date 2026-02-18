import { Schema, model } from 'mongoose';

const ObservationSchema = new Schema(
  {
    resourceType: { type: String, enum: ['Observation'], required: true },
    userId: String,
    questionnaireResponseId: Schema.Types.ObjectId,
    score: Number,
    interpretation: String,
    breakdown: Array,
    effectiveDateTime: Date,
  },
  { timestamps: true }
);

export const ObservationModel = model('Observation', ObservationSchema);
