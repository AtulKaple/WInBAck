import { Router } from "express";
import {
  createMedication,
  stopMedication,
  resumeMedication,
  updateMedication,
  getMedications,
  stopMedicationEmails,
  resumeMedicationEmails,
  stopAllMedicationEmails,
  resumeAllMedicationEmails,
  getMedicationDoses,
} from "../controllers/medication.controller";
import {
  markDose,
  snoozeDose,
  getTodayDoses,
  getPastDoses,
  addDose,
} from "../controllers/dose.controller";
import { getMedicationAnalytics } from "../controllers/researchMedication.controller";
// import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// router.use(authMiddleware);

/* Medication lifecycle */
router.post("/", createMedication);
router.get("/", getMedications);
router.put("/:id", updateMedication);
router.post("/:id/stop", stopMedication);
router.post("/:id/resume", resumeMedication);

/* Dose actions */
router.get("/doses/today", getTodayDoses);
router.get("/doses/past", getPastDoses);
router.post("/dose/:id/mark", markDose);
router.post("/dose/:id/snooze", snoozeDose);
router.post("/dose/:id/add", addDose);

// stop emails for ONE medication
router.post("/:id/email/stop", stopMedicationEmails);

// resume emails for ONE medication
router.post("/:id/email/resume", resumeMedicationEmails);

// stop emails for ALL medications of user
router.post("/email/stop-all", stopAllMedicationEmails);

router.post("/email/resume-all", resumeAllMedicationEmails);

router.get("/:medicationId/doses", getMedicationDoses);

//Researcher Analytics
router.get("/analytics", getMedicationAnalytics);

export default router;
