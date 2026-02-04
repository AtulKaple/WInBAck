import { logActivity } from "../../activityLogs/utils/activityLogger";
import { runDoseScheduler } from "../jobs/doseScheduler.job";
import MedicationDose from "../models/MedicationDose";
import { markDose as markService } from "../services/dose.service";
import { addHours, endOfDay } from "../utils/time.utils";

export const markDose = async (req, res) => {
  const dose = await markService(
    req.params.id,
    req.body.status,
    req.body.reason,
    req.body.takenAt 
  );

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "MedicationDose",
    resourceId: req.params.id.toString(),
    description: `Dose marked as ${req.body.status}`,
    changes: {
      status: req.body.status,
      reason: req.body.reason,
    },
    success: true,
  });

  res.json(dose);
};

export const snoozeDose = async (req, res) => {
  let snoozedUntil;

  switch (req.body.option) {
    case 2:
    case 6:
    case 12:
      snoozedUntil = addHours(new Date(), req.body.option);
      break;
    case "today":
      snoozedUntil = endOfDay();
      break;
    case "stop":
      await MedicationDose.findByIdAndUpdate(req.params.id, {
        snoozedUntil: null,
      });

      await logActivity({
        req,
        actorUserId: req.authContext.userId,
        action: "UPDATE",
        resource: "MedicationDose",
        resourceId: req.params.id,
        description: "Dose snooze stopped",
        changes: { snoozedUntil: null },
        success: true,
      });

      return res.json({ stopped: true });
  }

  const dose = await MedicationDose.findByIdAndUpdate(
    req.params.id,
    { snoozedUntil },
    { new: true },
  );

  await logActivity({
    req,
    actorUserId: req.authContext.userId,
    action: "UPDATE",
    resource: "MedicationDose",
    resourceId: req.params.id.toString(),
    description: "Dose snoozed",
    changes: { snoozedUntil },
    success: true,
  });

  res.json(dose);
};

export const getPastDoses = async (req, res) => {
  await runDoseScheduler(); // 👈 ensure doses exist

  const doses = await MedicationDose.find({
    userId: req.authContext.userId,
    status: { $in: ["taken", "skipped", "missed"] },
  })
    .sort({ scheduledAt: -1 })
    .limit(50)
    .populate("medicationId");

  res.json(doses);
};

export const getTodayDoses = async (req, res) => {
  await runDoseScheduler(); // 👈 ensure doses exist

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const doses = await MedicationDose.find({
    userId: req.authContext.userId,
    scheduledAt: { $gte: start, $lte: end },
  })
    .populate("medicationId")
    // .limit(50)
    .sort({ scheduledAt: 1 });

  res.json(doses);
};

export const addDose = async (req, res) => {
  try {
    const {
      scheduledAt,
      status = "pending",
      takenAt,
      skippedReason,
    } = req.body;

    const userId = req.authContext.userId;

    // Basic validation
    if (!scheduledAt) {
      return res.status(400).json({ message: "scheduledAt is required" });
    }

    if (status === "taken" && !takenAt) {
      return res
        .status(400)
        .json({ message: "takenAt required when status is taken" });
    }

    if (status === "skipped" && !skippedReason?.trim()) {
      return res
        .status(400)
        .json({ message: "Reason required when skipped" });
    }

    const dose = await MedicationDose.create({
      medicationId: req.params.id,
      userId,
      scheduledAt: new Date(scheduledAt),
      status,
      takenAt: status === "taken" ? new Date(takenAt) : null,
      skippedReason: status === "skipped" ? skippedReason : null,
      emailSentAt: null,
    });

    await logActivity({
      req,
      actorUserId: req.authContext.userId,
      action: "CREATE",
      resource: "MedicationDose",
      resourceId: dose._id.toString(),
      description: "Manual dose added",
      changes: {
        scheduledAt: dose.scheduledAt,
        status: dose.status,
      },
      success: true,
    });

    res.status(201).json(dose);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add dose" });
  }
};

