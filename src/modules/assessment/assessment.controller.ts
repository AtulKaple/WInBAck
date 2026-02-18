import { Request, Response } from "express";
import { QuestionnaireModel } from "./models/Questionnaire.model";
import { QuestionnaireResponseModel } from "./models/QuestionnaireResponse.model";
import { ObservationModel } from "./models/Observation.model";
import { submitAssessment } from "./assessment.service";
import {
  validateAnswersPayload,
  validateQuestionnairePayload,
} from "./assessment.validation";
import {
  toClientQuestionnaire,
  toFhirQuestionnaire,
} from "./assessment.transform";
import { safeLogger } from "../../security/safeLogger";
import { AuditEventModel } from "./models/AuditEvent.model";
import mongoose from "mongoose";

// export async function create(req: Request, res: Response) {
//   const actor = req.authContext!;
//   let payload = req.body;

//   console.log('Received assessment creation request with payload:', JSON.stringify(payload));

//   /**
//    * 1️⃣ MANUAL MODE (Form-based UI)
//    */
//  if (payload.mode === 'manual') {
//   payload = {
//     id: payload.id,
//     title: payload.title,
//     description: payload.description,
//     version: payload.version,
//     updatedAt: new Date().toISOString(),
//     questions: payload.questions.map((q: any) => ({
//       id: q.id,
//       text: q.text,
//       type: 'mcq', // 🔥 FORCE canonical type
//       required: true,
//       options: q.options.map((o: any, idx: number) => ({
//         id: String(idx),        // ensure string
//         label: o.label,
//         value: Number(o.value) // ensure number
//       })),
//     })),
//     scoring: payload.scoring,
//   };
// }

//   /**
//    * 2️⃣ FHIR JSON UPLOAD (like PHQ-9 example)
//    */
//   if (payload.resourceType === 'Questionnaire' && payload.item) {
//     const exists = await QuestionnaireModel.exists({
//       logicalId: payload.id,
//       version: payload.version,
//     });

//     if (exists) {
//       return res.status(409).json({ error: 'DUPLICATE_ID' });
//     }

//     const doc = await QuestionnaireModel.create({
//       resourceType: 'Questionnaire',
//       logicalId: payload.id,
//       version: payload.version,
//       title: payload.title,
//       description: payload.description,
//       item: payload.item,
//       scoring: payload.scoring,
//       publishedAt: new Date(),
//     });

//     await AuditEventModel.create({
//       action: 'CREATE',
//       actor: { userId: actor.userId, role: actor.role },
//       entity: { resourceType: 'Questionnaire', resourceId: doc.id },
//       outcome: 'SUCCESS',
//     });

//     return res.status(201).json({ data: { id: doc.logicalId } });
//   }

//   /**
//    * 3️⃣ INTERNAL NORMALIZED JSON
//    */
//   const validation = validateQuestionnairePayload(payload);
//   if (!validation.ok) {
//     return res.status(400).json(validation.error);
//   }

//   const fhir = toFhirQuestionnaire(validation.data);

//   const exists = await QuestionnaireModel.exists({
//     logicalId: fhir.id,
//     version: fhir.version,
//   });

//   if (exists) {
//     return res.status(409).json({ error: 'DUPLICATE_ID' });
//   }

//   const doc = await QuestionnaireModel.create({
//     resourceType: 'Questionnaire',
//     logicalId: fhir.id,
//     version: fhir.version,
//     title: fhir.title,
//     description: fhir.description,
//     item: fhir.item,
//     scoring: validation.data.scoring,
//     publishedAt: new Date(),
//   });

//   await AuditEventModel.create({
//     action: 'CREATE',
//     actor: { userId: actor.userId, role: actor.role },
//     entity: { resourceType: 'Questionnaire', resourceId: doc.id },
//     outcome: 'SUCCESS',
//   });

//   res.status(201).json({ data: { id: doc.logicalId } });
// }

export async function create(req: Request, res: Response) {
  try {
    const actor = req.authContext!;
    let payload = req.body;

    payload = {
      id: payload.id,
      title: payload.title,
      description: payload.description,
      version: "1.0.0",
      updatedAt: new Date().toISOString(),
      questions: payload.questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        type: "mcq",
        required: true,
        options: q.options.map((o: any, idx: number) => ({
          id: String(idx),
          label: o.label,
          value: Number(o.value),
        })),
      })),
      scoring: payload.scoring,
      minScore: payload.minScore,
      maxScore: payload.maxScore,
    };

    const alreadyExists = await QuestionnaireModel.exists({
      logicalId: payload.id,
    });

    if (alreadyExists) {
      return res.status(409).json({
        error: "ASSESSMENT_ALREADY_EXISTS_USE_PUBLISH",
      });
    }

    // const exists = await QuestionnaireModel.exists({
    //   logicalId: payload.id,
    //   version: payload.version,
    // });

    // if (exists) {
    //   return res.status(409).json({ error: "DUPLICATE_ID" });
    // }

    const doc = await QuestionnaireModel.create({
      resourceType: "Questionnaire",
      logicalId: payload.id,
      version: "1.0.0",
      title: payload.title,
      description: payload.description,
      questions: payload.questions,
      scoring: payload.scoring,
      minScore: payload.minScore,
      maxScore: payload.maxScore,
      publishedAt: new Date(),
    });

    await AuditEventModel.create({
      action: "CREATE",
      actor: { userId: actor.userId, role: actor.role },
      entity: { resourceType: "Questionnaire", resourceId: doc.id },
      outcome: "SUCCESS",
    });

    return res.status(201).json({ data: { id: doc.logicalId } });
  } catch (err: any) {
    console.error("Assessment creation failed:", err);
    return res.status(400).json({
      error: "ASSESSMENT_CREATE_FAILED",
      message: err.message || err,
    });
  }
}

export async function listForPatients(req: Request, res: Response) {
  const latest = await QuestionnaireModel.aggregate([
    { $sort: { publishedAt: -1 } },
    {
      $group: {
        _id: "$logicalId",
        doc: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$doc" } },
    { $sort: { publishedAt: -1 } },
  ]);

  res.json({
    data: latest,
  });
}

export async function listForAdmin(req: Request, res: Response) {
  const questionnaires = await QuestionnaireModel.find()
    .sort({ logicalId: 1, publishedAt: -1 })
    .lean();

  res.json({ data: questionnaires });
}

export async function get(req: Request, res: Response) {
  const { id } = req.params;
  const { version } = req.query;

  const query: any = { logicalId: id };

  if (version) {
    query.version = String(version);
  }

  const questionnaire = await QuestionnaireModel.findOne(query)
    .sort(version ? {} : { publishedAt: -1 }) // latest only if no version specified
    .lean();

  if (!questionnaire) {
    return res.status(404).json({ error: "ASSESSMENT_NOT_FOUND" });
  }

  res.json({ data: toClientQuestionnaire(questionnaire) });
}

export async function saveDraft(req: Request, res: Response) {
  const userId = req.authContext!.userId;

  const questionnaire = await QuestionnaireModel.findOne({
    logicalId: req.params.id,
  }).sort({ publishedAt: -1 });

  if (!questionnaire) {
    return res.status(404).json({ error: "ASSESSMENT_NOT_FOUND" });
  }

  await QuestionnaireResponseModel.findOneAndUpdate(
    {
      userId,
      questionnaireRef: questionnaire._id,
      questionnaireVersion: questionnaire.version,
      status: "in-progress",
    },
    {
      resourceType: "QuestionnaireResponse",
      questionnaireRef: questionnaire._id,
      questionnaireVersion: questionnaire.version,
      userId,
      status: "in-progress",
      answers: req.body.answers,
      authored: new Date(),
    },
    {
      upsert: true,
      new: true,
    },
  );

  res.status(204).send();
}

export const getAssessmentDraft = async (req: Request, res: Response) => {
  try {
    const userId = req.authContext!.userId; // assuming auth middleware
    const { assessmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
      return res.status(400).json({ error: "INVALID_ASSESSMENT_ID" });
    }

    const draft = await QuestionnaireResponseModel.findOne({
      userId: userId,
      questionnaireRef: new mongoose.Types.ObjectId(assessmentId),
      status: "in-progress",
    });

    if (!draft) {
      return res.status(204).send(); // No draft
    }

    return res.json({
      success: true,
      data: draft,
    });
  } catch (err) {
    console.error("Get draft error:", err);
    return res.status(500).json({ message: "Failed to fetch draft" });
  }
};

export async function submit(req: Request, res: Response) {
  const userId = req.authContext!.userId;
  const role = req.authContext!.role;

  const idempotencyKey = req.headers["idempotency-key"];

  if (!idempotencyKey || typeof idempotencyKey !== "string") {
    return res.status(400).json({ error: "IDEMPOTENCY_KEY_REQUIRED" });
  }

  const questionnaire = await QuestionnaireModel.findOne({
    logicalId: req.params.id,
  }).sort({ publishedAt: -1 });

  if (!questionnaire) {
    return res.status(404).json({ error: "ASSESSMENT_NOT_FOUND" });
  }

  const validation = validateAnswersPayload(questionnaire, req.body.answers);
  if (!validation.ok) {
    return res.status(400).json(validation.error);
  }

  // 🔍 Find existing draft
  const draft = await QuestionnaireResponseModel.findOne({
    userId,
    questionnaireRef: questionnaire._id,
    questionnaireVersion: questionnaire.version,
    status: "in-progress",
  });

  safeLogger.info("assessment.submitted", {
    assessmentId: questionnaire.logicalId,
    hadDraft: Boolean(draft),
  });

  const result = await submitAssessment({
    userId,
    role,
    questionnaire,
    answers: req.body.answers,
    idempotencyKey,
    responseId: String(draft?._id), // 👈 PASS EXISTING RESPONSE
  });

  res.status(201).json({
    status: "completed",
    data: {
      score: result.score,
      questionnaireResponseId: result.questionnaireResponseId,
      breakdown: result.breakdown,
      interpretation: result.interpretation,
      submittedAt: new Date().toISOString(),
    },
  });
}

export async function results(req: Request, res: Response) {
  const userId = req.authContext!.userId;

  const observations = await ObservationModel.find({
    userId,
  })
    .sort({ effectiveDateTime: -1 })
    .lean();

  res.json({ data: observations });
}

export async function listResponses(req: Request, res: Response) {
  const userId = req.authContext!.userId;
  const { id } = req.params; // logicalId

  const responses = await QuestionnaireResponseModel.find({
    userId,
    status: "completed",
  })
    .populate({
      path: "questionnaireRef",
      match: { logicalId: id },
    })
    .sort({ authored: -1 })
    .lean();

  res.json({
    data: responses
      .filter((r) => r.questionnaireRef)
      .map((r) => ({
        id: r._id,
        authored: r.authored,
        questionnaireVersion: r.questionnaireVersion,
        answers: r.answers,
      })),
  });
}

export async function getResponseDetail(req: Request, res: Response) {
  const userId = req.authContext!.userId;
  const { responseId } = req.params;

  const response = await QuestionnaireResponseModel.findOne({
    _id: responseId,
    userId,
    status: "completed",
  }).lean();

  if (!response) {
    return res.status(404).json({ error: "RESPONSE_NOT_FOUND" });
  }

  const observation = await ObservationModel.findOne({
    questionnaireResponseId: response._id,
  }).lean();

  res.json({
    data: {
      response,
      observation,
    },
  });
}

function bumpMinor(version: string) {
  const [major, minor] = version.split(".").map(Number);
  return `${major}.${minor + 1}.0`;
}

export async function publishNewVersion(req: Request, res: Response) {
  const payload = req.body;

  // 1️⃣ Get latest version
  const latest = await QuestionnaireModel.findOne({
    logicalId: payload.id,
  }).sort({ publishedAt: -1 });

  if (!latest) {
    return res.status(404).json({ error: "ASSESSMENT_NOT_FOUND" });
  }

  // 2️⃣ 🧹 Delete in-progress responses of OLD version
  await QuestionnaireResponseModel.deleteMany({
    questionnaireRef: latest._id, // safest match
    questionnaireVersion: latest.version,
    status: "in-progress",
  });

  // 2️⃣ Create next version
  const nextVersion = bumpMinor(latest.version);

  const doc = await QuestionnaireModel.create({
    resourceType: "Questionnaire",
    logicalId: payload.id,
    version: nextVersion,
    title: payload.title,
    description: payload.description,
    questions: payload.questions,
    scoring: payload.scoring,
    minScore: payload.minScore,
    maxScore: payload.maxScore,
    publishedAt: new Date(),
  });

  return res.status(201).json({
    data: {
      logicalId: doc.logicalId,
      version: doc.version,
    },
  });
}
