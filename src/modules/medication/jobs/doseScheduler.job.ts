
import Medication from "../models/Medication";
import MedicationDose from "../models/MedicationDose";
import { computeNextDoseTimes } from "../utils/time.utils";

export async function runDoseScheduler() {
  const meds = await Medication.find({ status: "active" });

  for (const med of meds) {
    if (med.frequency.type === "prn") continue;
    if (med.endDate && med.endDate < new Date()) continue;

    const times = computeNextDoseTimes(med);

    for (const scheduledAt of times) {
      await MedicationDose.updateOne(
        {
          medicationId: med._id,
          scheduledAt,
        },
        {
          $setOnInsert: {
            userId: med.userId,
            medicationId: med._id,
            scheduledAt,
            status: "pending",
          },
        },
        { upsert: true }
      );
    }
  }
}
