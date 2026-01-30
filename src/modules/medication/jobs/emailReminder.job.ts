import MedicationDose from "../models/MedicationDose";
import { sendDoseReminder } from "../services/notification.service";

export async function runEmailReminderJob() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 1000); // last 1 min
  const windowEnd = now;

  const doses = await MedicationDose.find({
    status: "pending",
    scheduledAt: {
      $gte: windowStart,
      $lte: windowEnd,
    },
    emailSentAt: { $exists: false },
    $or: [
      { snoozedUntil: { $exists: false } },
      { snoozedUntil: { $lte: now } },
    ],
  }).populate("medicationId");

  for (const dose of doses) {
    const med: any = dose.medicationId;

    if (!med) continue;
    if (med.status !== "active") continue;
    if (!med.emailNotificationsEnabled) continue;

    // const user = await User.findById(dose.userId);
    // if (!user?.email) continue;
    // if (user.emailNotificationsEnabled === false) continue;

    // await sendDoseReminder(user, med, dose);
    await sendDoseReminder( med, dose);


    // 🔐 prevent re-sending
    dose.emailSentAt = new Date();
    await dose.save();
  }
}

