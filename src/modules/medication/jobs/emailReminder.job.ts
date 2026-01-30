import { getCognitoUserEmail } from "../../../aws/cognitoUser.service";
import MedicationDose from "../models/MedicationDose";
import { sendDoseReminder } from "../services/notification.service";

export async function runEmailReminderJob() {
  const now = new Date();

  console.log("📧 Email Reminder Job START", now.toISOString());

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

  console.log(`📦 Found ${doses.length} pending doses`);

  for (const dose of doses) {
    console.log("➡️ Processing dose:", dose._id.toString());

    const med: any = dose.medicationId;

    if (!med) {
      console.log("❌ No medication populated");
      continue;
    }

    if (med.status !== "active") {
      console.log("⏭️ Medication not active");
      continue;
    }

    console.log("🔎 Fetching email for user:", dose.userId);

    let email: string | null = null;
    try {
      email = await getCognitoUserEmail(dose.userId);
    } catch (err) {
      console.error("❌ Cognito email fetch failed", err);
      continue;
    }

    console.log("📨 Email resolved:", email);

    if (!email) {
      console.log("❌ Email missing — skipping");
      continue;
    }

    try {
      await sendDoseReminder(email, med, dose);
      console.log("✅ Email sent to:", email);
    } catch (err) {
      console.error("❌ Email send failed", err);
      continue;
    }

    // Mark as sent
    dose.emailSentAt = new Date();
    await dose.save();

    console.log("🔐 emailSentAt saved");
  }

  console.log("📧 Email Reminder Job END");
}
