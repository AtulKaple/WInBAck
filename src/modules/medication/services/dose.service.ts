import MedicationDose from "../models/MedicationDose";

export async function markDose(id, status, reason?, takenAt?) {
  const update: any = { status };

  if (status === "taken") {
    if (takenAt) {
      // takenAt = "14:30"
      const dose = await MedicationDose.findById(id);

      const baseDate = new Date(dose.scheduledAt);

      const [hours, minutes] = takenAt.split(":").map(Number);

      baseDate.setHours(hours, minutes, 0, 0);

      update.takenAt = baseDate;
    } else {
      update.takenAt = new Date();
    }
  }
  if (status === "skipped") update.skippedReason = reason;

  return MedicationDose.findByIdAndUpdate(id, update, { new: true });
}
