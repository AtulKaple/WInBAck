import { getCognitoUserEmail } from "../../../aws/cognitoUser.service";
import MedicationDose from "../models/MedicationDose";
import { sendDoseReminder } from "../services/notification.service";

export async function runEmailReminderJob() {
  const now = new Date();

  // Optional: pick doses that are scheduled a minute ago or earlier
  const windowStart = new Date(now.getTime() - 60_000); // 1 min buffer

  const doses = await MedicationDose.find({
    status: "pending",
    scheduledAt: { $lte: now }, // pick doses due until now
    $or: [
      { emailSentAt: null },         // not sent yet
      { emailSentAt: { $exists: false } }, // or field missing
    ],
  }).populate("medicationId");

  for (const dose of doses) {
    const med: any = dose.medicationId;

    let email: string | null = null;
    try {
      email = await getCognitoUserEmail(dose.userId);
    } catch (err) {
      console.error("❌ Cognito email fetch failed", err);
      continue;
    }

    if (!email) {
      console.log("❌ Email missing — skipping");
      continue;
    }


    try {
      await sendDoseReminder(email, med, dose);
    } catch (err) {
      console.error("❌ Email send failed", err);
      continue;
    }

    // Mark as sent
    dose.emailSentAt = new Date();
    await dose.save();
  }
}
