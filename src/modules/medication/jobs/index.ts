import cron from "node-cron";
import { runEmailReminderJob } from "./emailReminder.job";
import { runDoseScheduler } from "./doseScheduler.job";
import { runMissedDoseJob } from "./missedDose.job";

/**
 * Every minute:
 * - create upcoming doses
 * - send reminder emails
 */
cron.schedule("* * * * *", async () => {
  await runDoseScheduler();
  await runEmailReminderJob();
});

/**
 * Every 15 minutes:
 * - mark missed doses
 */
cron.schedule("*/15 * * * *", async () => {
  await runMissedDoseJob();
});
