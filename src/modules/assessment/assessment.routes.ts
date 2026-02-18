import { Router } from "express";
import * as controller from "./assessment.controller";
import { requireAuthContext } from "../../auth";
import { requireActiveConsent } from "../consents";

const router = Router();

router.get("/", requireAuthContext, requireActiveConsent("assessments"), controller.listForPatients);
router.get("/admin-assessment", requireAuthContext, controller.listForAdmin);
router.post("/", requireAuthContext, controller.create);
router.post("/publish", requireAuthContext, controller.publishNewVersion);
// router.get(
//   "/admin-assessment/:id/:version",
//   requireAuthContext,
//   controller.getByVersion
// );
router.get(
  "/:id",
  requireAuthContext,
  requireActiveConsent("assessments"),
  controller.get,
);
router.post(
  "/:id/draft",
  requireAuthContext,
  requireActiveConsent("assessments"),
  controller.saveDraft,
);
router.get(
  "/:assessmentId/draft",
  requireAuthContext,
  requireActiveConsent("assessments"),
  controller.getAssessmentDraft,
);
router.post(
  "/:id/submit",
  requireAuthContext,
  requireActiveConsent("assessments"),
  controller.submit,
);
router.get(
  "/:id/results",
  requireAuthContext,
  requireActiveConsent("assessments"),
  controller.results,
);
router.get(
  "/:id/responses",
  requireAuthContext,
  requireActiveConsent("assessments"),
  controller.listResponses
);
router.get(
  "/responses/:responseId",
  requireAuthContext,
  requireActiveConsent("assessments"),
  controller.getResponseDetail
);

export default router;
