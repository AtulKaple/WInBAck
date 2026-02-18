import mongoose from 'mongoose';
import { scoreQuestionnaire } from './assessment.scoring';
import { IdempotencyKeyModel } from './models/IdempotencyKey.model';
import { QuestionnaireResponseModel } from './models/QuestionnaireResponse.model';
import { ObservationModel } from './models/Observation.model';
import { ProvenanceModel } from './models/Provenance.model';

export async function submitAssessment({
  userId,
  role,
  questionnaire,
  answers,
  idempotencyKey,
  responseId, // 👈 NEW
}: {
  userId: string;
  role: string;
  questionnaire: any;
  answers: Record<string, string>;
  idempotencyKey: string;
  responseId?: string;
}) {
  const session = await mongoose.startSession();

  try {
    let result!: { score: number; interpretation: string; questionnaireResponseId: any; breakdown: any };  

    await session.withTransaction(async () => {
      // 🔒 Idempotency check
      const used = await IdempotencyKeyModel.findOne(
        { key: idempotencyKey },
        null,
        { session }
      );

      if (used) {
        throw new Error("DUPLICATE_SUBMISSION");
      }

      // 📊 Score
      const scoring = scoreQuestionnaire(questionnaire, answers);

      let response;

      if (responseId) {
        // ✅ UPGRADE EXISTING DRAFT
        response = await QuestionnaireResponseModel.findByIdAndUpdate(
          responseId,
          {
            status: "completed",
            answers,
            score: scoring.score,
            authored: new Date(),
            questionnaireId: questionnaire.logicalId,
              minScore: questionnaire.minScore,
              maxScore: questionnaire.maxScore,
          },
          { new: true, session }
        );
      } else {
        // 🧯 Fallback (rare)
        [response] = await QuestionnaireResponseModel.create(
          [
            {
              resourceType: "QuestionnaireResponse",
              questionnaireRef: questionnaire._id,
              questionnaireVersion: questionnaire.version,
              questionnaireId: questionnaire.logicalId,
              minScore: questionnaire.minScore,
              maxScore: questionnaire.maxScore,
              userId,
              status: "completed",
              answers,
              score: scoring.score,
              authored: new Date(),
            },
          ],
          { session }
        );
      }

      // 📈 Observation
      await ObservationModel.create(
        [
          {
            resourceType: "Observation",
            userId,
            questionnaireResponseId: response!._id,
            score: scoring.score,
            interpretation: scoring.interpretation,
            breakdown: scoring.breakdown,
            effectiveDateTime: new Date(),
          },
        ],
        { session }
      );

      // 🧾 Provenance
      await ProvenanceModel.create(
        [
          {
            userId,
            questionnaireId: questionnaire.logicalId,
            version: questionnaire.version,
            recordedAt: new Date(),
          },
        ],
        { session }
      );

      // 🔐 Consume idempotency key
      await IdempotencyKeyModel.create(
        [{ key: idempotencyKey, consumedAt: new Date() }],
        { session }
      );

      result = {
        score: scoring.score,
        interpretation: scoring.interpretation,
        questionnaireResponseId: response!._id,
        breakdown: scoring.breakdown,
      };
    });

    return result;
  } finally {
    session.endSession();
  }
}
