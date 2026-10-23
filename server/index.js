// Yeezy Loyalty & Petpooja POS Backend Server Listener (Standalone & Render)
import dotenv from 'dotenv';
import { app } from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Yeezy Loyalty POS & Webhook Engine running on port ${PORT}`);
  console.log(`📡 Base URL: http://localhost:${PORT}`);
  console.log(`🔌 Petpooja Inquire: http://localhost:${PORT}/api/v1/pos/petpooja/loyalty/inquire`);
  console.log(`💳 Petpooja Save:    http://localhost:${PORT}/api/v1/pos/petpooja/orders/save`);
  console.log(`🪵 Webhook Logs:     http://localhost:${PORT}/api/v1/pos/webhook-logs`);
  console.log(`=======================================================`);
});
