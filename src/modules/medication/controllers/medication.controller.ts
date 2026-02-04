import { logActivity } from "../../activityLogs/utils/activityLogger";
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

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "CREATE",
    resource: "Medication",
    resourceId: med._id.toString(),
    description: `Medication created: ${med.name}`,
    targetName: med.name,
    success: true,
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

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "Medication",
    resourceId: med._id.toString(),
    description: "Medication updated",
    changes: req.body,
    success: true,
  });

  res.json(med);
};

export const stopMedication = async (req, res) => {
  const med = await stopService(req.params.id, req.body.reason);

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "Medication",
    resourceId: med._id.toString(),
    description: "Medication stopped",
    changes: { reason: req.body.reason },
    success: true,
  });

  res.json(med);
};

export const resumeMedication = async (req, res) => {
  const { reason, medication } = req.body;

  const med = await resumeService(
    req.params.id,
    reason,
    medication
  );

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "Medication",
    resourceId: med._id.toString(),
    description: "Medication resumed",
    changes: { reason: req.body.reason },
    success: true,
  });

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

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "Medication",
    resourceId: req.params.id,
    description: "Medication emails disabled for this medication",
    success: true,
  });

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

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "Medication",
    resourceId: req.params.id,
    description: "Medication emails enabled for this medication",
    success: true,
  });
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

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "Medication",
    resourceId: req.params.id,
    description: "All Medication emails disabled",
    success: true,
  });
};

export const resumeAllMedicationEmails = async (req, res) => {
  const result = await enableAllMedicationEmails(req.authContext.userId);

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "Medication",
    resourceId: req.params.id,
    description: "All Medication emails enabled",
    success: true,
  });

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

