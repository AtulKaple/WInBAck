import Medication from "../models/Medication";
import MedicationAudit from "../models/MedicationAudit";
import MedicationDose from "../models/MedicationDose";

export async function stopMedication(id, reason) {
  const now = new Date();

  const med = await Medication.findByIdAndUpdate(
    id,
    {
      status: "stopped",
      stoppedAt: now,
      stopReason: reason,
    },
    { new: true }
  );

  // 🔥 DELETE FUTURE DOSES
  await MedicationDose.deleteMany({
    medicationId: id,
    scheduledAt: { $gt: now },
    status: "pending",
  });

  await MedicationAudit.create({
    medicationId: id,
    action: "stopped",
    reason,
  });

  return med;
}


export async function resumeMedication(id, reason, updates) {
  const now = new Date();

  // 1️⃣ Update medication + resume
  const med = await Medication.findByIdAndUpdate(
    id,
    {
      ...updates,
      status: "active",
      resumedAt: now,
      resumeReason: reason,
    },
    { new: true }
  );

  // 2️⃣ Remove future doses (critical)
  await MedicationDose.deleteMany({
    medicationId: id,
    scheduledAt: { $gte: now },
    status: "pending",
  });

  // 3️⃣ Regenerate doses
  // await generateDosesForMedication(med);

  // 4️⃣ Audit
  await MedicationAudit.create({
    medicationId: id,
    action: "resumed",
    reason,
    changes: updates,
  });

  return med;
}


/**
 * Disable email notifications for ONE medication
 */
export async function disableMedicationEmails(
  medicationId: string,
  userId: string
) {
  const med = await Medication.findOneAndUpdate(
    { _id: medicationId, userId },
    { emailNotificationsEnabled: false },
    { new: true }
  );

  if (!med) throw new Error("Medication not found");

  await MedicationAudit.create({
    medicationId,
    action: "email_disabled",
  });

  return med;
}

/**
 * Enable email notifications for ONE medication
 */
export async function enableMedicationEmails(
  medicationId: string,
  userId: string
) {
  const med = await Medication.findOneAndUpdate(
    { _id: medicationId, userId },
    { emailNotificationsEnabled: true },
    { new: true }
  );

  if (!med) throw new Error("Medication not found");

  await MedicationAudit.create({
    medicationId,
    action: "email_enabled",
  });

  return med;
}

/**
 * Disable email notifications for ALL medications of a user
 */
export async function disableAllMedicationEmails(userId: string) {
  const result = await Medication.updateMany(
    { userId },
    { emailNotificationsEnabled: false }
  );

  await MedicationAudit.create({
    action: "all_emails_disabled",
    reason: "User disabled all medication emails",
  });

  return result;
}

/**
 * Enable email notifications for ALL medications of a user
 */
export async function enableAllMedicationEmails(userId: string) {
  const result = await Medication.updateMany(
    { userId },
    { emailNotificationsEnabled: true }
  );

  await MedicationAudit.create({
    action: "all_emails_enabled",
    reason: "User resumed all medication emails",
  });

  return result;
}

