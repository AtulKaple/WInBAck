import { transporter } from "../../../mailer";

export async function sendDoseReminder( med, dose) {
  if (!med.emailNotificationsEnabled) return;
  if (dose.snoozedUntil && dose.snoozedUntil > new Date()) return;

  const time = dose.scheduledAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: "kapleatul@gmail.com",
    subject: `Medication Reminder: ${med.name} at ${time}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height:1.6">
        <h2 style="color:#2c3e50">Medication Reminder</h2>

        <p>Hello <strong>${"Patient"}</strong>,</p>

        <p>This is a reminder to take your medication as scheduled.</p>

        <table style="border-collapse: collapse; margin-top:10px">
          <tr>
            <td><strong>Medication</strong></td>
            <td style="padding-left:10px">${med.name}</td>
          </tr>
          <tr>
            <td><strong>Dosage</strong></td>
            <td style="padding-left:10px">${med.dosage || "As prescribed"}</td>
          </tr>
          <tr>
            <td><strong>Form</strong></td>
            <td style="padding-left:10px">${med.form}</td>
          </tr>
          <tr>
            <td><strong>Scheduled Time</strong></td>
            <td style="padding-left:10px">${time}</td>
          </tr>
          <tr>
            <td><strong>Meal Instruction</strong></td>
            <td style="padding-left:10px">${med.mealTiming || "Anytime"}</td>
          </tr>
        </table>

        ${
          med.instructions
            ? `<p style="margin-top:10px"><strong>Instructions:</strong> ${med.instructions}</p>`
            : ""
        }

        <p style="margin-top:20px;color:#555">
          Please take your medication as advised by your healthcare provider.
        </p>

        <hr />

        <p style="font-size:12px;color:#888">
          You are receiving this email because medication reminders are enabled
          for your account. You can manage notification preferences in the app.
        </p>
      </div>
    `,
  });
}

