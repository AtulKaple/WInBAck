// import cron from "node-cron";
// import MedicationDose from "../models/MedicationDose";

// cron.schedule("*/15 * * * *", async () => {
//   const graceMinutes = 60;
//   const cutoff = new Date(Date.now() - graceMinutes * 60000);

//   await MedicationDose.updateMany(
//     {
//       status: "pending",
//       scheduledAt: { $lt: cutoff },
//       snoozedUntil: { $exists: false },
//     },
//     { status: "missed" }
//   );
// });

import { logActivity } from "../../activityLogs/utils/activityLogger";
import MedicationDose from "../models/MedicationDose";

const GRACE_MINUTES = 60;

export async function runMissedDoseJob() {
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000);

  await MedicationDose.updateMany(
  {
    status: "pending",
    scheduledAt: { $lt: cutoff },
    $or: [
      { snoozedUntil: { $exists: false } },
      { snoozedUntil: { $lt: new Date() } },
    ],
  },
  { status: "missed" }
);

await logActivity({
  actorUserId: "SYSTEM",
  action: "UPDATE",
  resource: "MedicationDose",
  description: "Pending doses marked as missed",
  success: true,
});


}
