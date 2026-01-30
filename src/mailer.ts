import nodemailer from "nodemailer";
import dotenv from 'dotenv';
dotenv.config();

// 1. Capture the port and host to debug (don't log the password!)
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = process.env.SMTP_USER;

console.log(`🔌 SMTP Config | Host: ${smtpHost} | Port: ${smtpPort} | User: ${smtpUser ? "Set" : "Missing"}`);

// 2. Create Transporter with dynamic security settings
export const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  // CRITICAL FIX: If port is 465, secure MUST be true. If 587, it MUST be false.
  secure: smtpPort === 465, 
  auth: {
    user: smtpUser,
    pass: process.env.SMTP_PASS,
  },
  // 3. Increase timeouts to 30s (Render can be slow to resolve external DNS)
  connectionTimeout: 30_000,
  greetingTimeout: 30_000,
  socketTimeout: 30_000,
  // 4. Ensure we use the correct TLS protocols
  tls: {
    rejectUnauthorized: false // Optional: Helps if the certificate chain is minorly broken
  }
} as any);

// 5. Verification check on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Connection Check Failed:", error);
  } else {
    console.log("✅ SMTP Server is ready to take our messages");
  }
});