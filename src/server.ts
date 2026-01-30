import app from './app';
import { transporter } from './mailer';
import "./modules/medication/jobs";

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Winsights PatientHub server running on port ${PORT}`);
});

// Add this to your server startup logic
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Error:", error);
  } else {
    console.log("✅ SMTP Server is ready to take our messages");
  }
});
