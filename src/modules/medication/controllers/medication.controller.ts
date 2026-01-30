import Medication from "../models/Medication";
import MedicationAudit from "../models/MedicationAudit";
import MedicationDose from "../models/MedicationDose";
import {
  stopMedication as stopService,
  resumeMedication as resumeService,
  disableMedicationEmails,
  enableMedicationEmails,
  disableAllMedicationEmails,
  enableAllMedicationEmails,
} from "../services/medication.service";

export const createMedication = async (req, res) => {
  const med = await Medication.create({
    ...req.body,
    userId: req.authContext.userId,
  });

  await MedicationAudit.create({
    medicationId: med._id,
    action: "created",
  });

  res.status(201).json(med);
};

export const getMedications = async (req, res) => {
  const meds = await Medication.find({
    userId: req.authContext.userId,
  }).populate("diseases");

  res.json(meds);
};

export const updateMedication = async (req, res) => {
  const med = await Medication.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  await MedicationAudit.create({
    medicationId: med._id,
    action: "updated",
  });

  res.json(med);
};

export const stopMedication = async (req, res) => {
  const med = await stopService(req.params.id, req.body.reason);
  res.json(med);
};

export const resumeMedication = async (req, res) => {
  const { reason, medication } = req.body;

  const med = await resumeService(
    req.params.id,
    reason,
    medication
  );

  res.json(med);
};


/**
 * Disable emails for one medication
 */
export const stopMedicationEmails = async (req, res) => {
  const med = await disableMedicationEmails(
    req.params.id,
    req.authContext.userId
  );
  res.json(med);
};

/**
 * Enable emails for one medication
 */
export const resumeMedicationEmails = async (req, res) => {
  const med = await enableMedicationEmails(
    req.params.id,
    req.authContext.userId
  );
  res.json(med);
};

/**
 * Disable emails for ALL medications of user
 */
export const stopAllMedicationEmails = async (req, res) => {
  const result = await disableAllMedicationEmails(req.authContext.userId);
  res.json({
    success: true,
    modifiedCount: result.modifiedCount,
  });
};

export const resumeAllMedicationEmails = async (req, res) => {
  const result = await enableAllMedicationEmails(req.authContext.userId);

  res.json({
    success: true,
    modifiedCount: result.modifiedCount,
  });
};

export const getMedicationDoses = async (req, res) => {
  try {
    const { medicationId } = req.params;
    const userId = req.authContext.userId; // assuming auth middleware sets this

    const doses = await MedicationDose.find({
      medicationId,
      userId,
    })
      .populate("medicationId", "name dosage form mealTiming")
      .sort({ scheduledAt: -1 }); // latest first

    res.json(doses);
  } catch (err) {
    console.error("Get Medication Doses Error:", err);
    res.status(500).json({ message: "Failed to fetch medication doses" });
  }
};

