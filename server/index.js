// Yeezy Loyalty & Petpooja POS Backend Server
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { posRouter } from './routes/pos.js';
import { customersRouter } from './routes/customers.js';
import { dashboardRouter } from './routes/dashboard.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { posStore } from './db/store.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Automatic Multi-Tenant Session & Token Resolver
app.use('/api', authMiddleware);

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/pos', posRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/loyalty', loyaltyRouter);

// Health Check & System Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'Yeezy Restaurant Loyalty Engine',
    timestamp: new Date().toISOString(),
    stats: {
      customers: posStore.data.customers.length,
      orders: posStore.data.orders.length,
      ledgerEntries: posStore.data.loyaltyLedger.length,
      webhookLogs: posStore.data.webhookLogs.length
    }
  });
});

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, '..', 'dist');

// Serve Frontend Static Assets if dist exists (Render Production Mode)
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));

  // Express 5 compatible SPA Fallback for client-side routing
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(DIST_PATH, 'index.html'));
    }
    next();
  });
} else {
  // Root API welcome in dev mode if dist is not built
  app.get('/', (req, res) => {
    res.json({
      name: 'Yeezy Loyalty & Petpooja POS Webhook API',
      version: '1.0.0',
      status: 'active',
      endpoints: {
        health: 'GET /api/health',
        petpoojaInquire: 'POST /api/v1/pos/petpooja/loyalty/inquire',
        petpoojaLock: 'POST /api/v1/pos/petpooja/loyalty/lock',
        petpoojaSaveOrder: 'POST /api/v1/pos/petpooja/orders/save'
      }
    });
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Yeezy Loyalty POS & Webhook Engine running on port ${PORT}`);
  console.log(`📡 Base URL: http://localhost:${PORT}`);
  console.log(`🔌 Petpooja Inquire: http://localhost:${PORT}/api/v1/pos/petpooja/loyalty/inquire`);
  console.log(`💳 Petpooja Save:    http://localhost:${PORT}/api/v1/pos/petpooja/orders/save`);
  console.log(`🪵 Webhook Logs:     http://localhost:${PORT}/api/v1/pos/webhook-logs`);
  console.log(`=======================================================`);
});
