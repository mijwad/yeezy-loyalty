// Yeezy Loyalty & Petpooja POS Backend Server Listener (Standalone & Render)
import dotenv from 'dotenv';
import { createServer } from 'http';
import { app, startServer } from './app.js';

dotenv.config();

const PORT = process.env.PORT || 4000;

async function main() {
  const server = createServer(app);
  await startServer(server);

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Yeezy Loyalty POS & Webhook Engine running on port ${PORT}`);
    console.log(`📡 Base URL: http://localhost:${PORT}`);
    console.log(`🔌 Petpooja Inquire: http://localhost:${PORT}/api/v1/pos/petpooja/loyalty/inquire`);
    console.log(`💳 Petpooja Save:    http://localhost:${PORT}/api/v1/pos/petpooja/orders/save`);
    console.log(`🪵 Webhook Logs:     http://localhost:${PORT}/api/v1/pos/webhook-logs`);
    console.log(`🏥 Health:           http://localhost:${PORT}/health`);
    console.log(`✅ Ready:            http://localhost:${PORT}/ready`);
    console.log(`💓 Live:             http://localhost:${PORT}/live`);
    console.log(`=======================================================`);
  });
}

main().catch(err => {
  console.error('[Fatal] Failed to start server:', err);
  process.exit(1);
});