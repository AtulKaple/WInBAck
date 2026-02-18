import { Schema, model } from 'mongoose';

const QuestionnaireResponseSchema = new Schema(
  {
    resourceType: { type: String, enum: ['QuestionnaireResponse'], required: true },
    questionnaireRef: { type: Schema.Types.ObjectId, ref: 'Questionnaire', required: true },
    questionnaireVersion: String,
    questionnaireId: String,
    minScore: Number,
    maxScore: Number,
    userId: { type: String, required: true },
    status: { type: String, enum: ['in-progress', 'completed'], required: true },
    answers: { type: Object, default: {} },
    score: Number,
    authored: Date,
  },
  { timestamps: true }
);

QuestionnaireResponseSchema.index(
  { userId: 1, questionnaireRef: 1, questionnaireVersion: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: 'in-progress' } }
);

export const QuestionnaireResponseModel = model(
  'QuestionnaireResponse',
  QuestionnaireResponseSchema
);
