import { Schema, model } from 'mongoose';

const QuestionnaireSchema = new Schema(
  {
    resourceType: { type: String, enum: ['Questionnaire'], required: true },
    logicalId: { type: String, required: true }, // phq9
    version: { type: String, required: true },
    title: {  type: String, required: true },
    description: {  type: String, required: true },
    questions: { type: Array, required: true },
    scoring: { type: Object, required: true },
    minScore: {  type: Number, required: true },
    maxScore: {  type: Number, required: true },
    publishedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// 🔒 IMMUTABLE
QuestionnaireSchema.pre('save', function () {
  if (!this.isNew) {
    throw new Error('Questionnaire is immutable once published');
  }
});

QuestionnaireSchema.index({ logicalId: 1, version: 1 }, { unique: true });

export const QuestionnaireModel = model(
  'Questionnaire',
  QuestionnaireSchema
);
