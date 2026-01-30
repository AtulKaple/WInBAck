// import cron from "node-cron";
// import Medication from "../models/Medication";
// import { createDoseIfNotExists } from "../services/dose.service";
// import { sendMedicationEmail } from "../services/notification.service";

// cron.schedule("* * * * *", async () => {
//   const now = new Date();
//   const time = now.toTimeString().slice(0, 5);

//   const meds = await Medication.find({
//     status: "active",
//     "frequency.times": time,
//     "frequency.type": { $ne: "prn" },
//   });

//   for (const med of meds) {
//     await createDoseIfNotExists(med._id, med.userId, now);

//     if (med.emailNotificationsEnabled) {
//       await sendMedicationEmail(
//         "kapleatul@gmail.com",
//         med,
//         { scheduledAt: now }
//       );
//     }
//   }
// });


import Medication from "../models/Medication";
import MedicationDose from "../models/MedicationDose";
import { computeNextDoseTimes } from "../utils/time.utils";

export async function runDoseScheduler() {
  const meds = await Medication.find({ status: "active" });

  for (const med of meds) {
    if (med.frequency.type === "prn") continue;

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
