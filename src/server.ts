import app from './app';
import "./modules/medication/jobs";
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Winsights PatientHub server running on port ${PORT}`);
});

import net from 'net';

// RUN THIS ONCE ON STARTUP
function testConnectivity() {
  const HOST = process.env.SMTP_HOST || 'smtp.gmail.com'; // Default to Gmail if missing
  const PORT = Number(process.env.SMTP_PORT) || 465;
  
  console.log(`🕵️ TESTING RAW CONNECTION TO: ${HOST}:${PORT}...`);

  const socket = new net.Socket();
  socket.setTimeout(5000); // 5 second timeout

  socket.on('connect', () => {
    console.log(`✅ SUCCESS: Connected to ${HOST}:${PORT}! The network is fine.`);
    socket.destroy();
  });

  socket.on('timeout', () => {
    console.error(`❌ FAILURE: Could not reach ${HOST}:${PORT} - Timed out.`);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error(`❌ FAILURE: Network error to ${HOST}:${PORT}:`, err.message);
  });

  socket.connect(PORT, HOST);
}

// Call it immediately
testConnectivity();
