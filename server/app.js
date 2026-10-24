// Yeezy Loyalty & Petpooja POS Backend Express App
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { posRouter } from './routes/pos.js';
import { customersRouter } from './routes/customers.js';
import { dashboardRouter } from './routes/dashboard.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { posStore } from './db/store.js';
import { authMiddleware } from './middleware/auth.js';

import { v1PublicRouter } from './routes/v1Public.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api') || req.path.startsWith('/v1')) {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Canonical Public API v1 for POS Integrations (OpenAPI 3.1 & SDK)
app.use('/v1', v1PublicRouter);

// Automatic Multi-Tenant Session & Token Resolver (Dashboard & Legacy)
app.use('/api', authMiddleware);

// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/pos', posRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/loyalty', loyaltyRouter);
app.use('/api/loyalty', loyaltyRouter);

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, '..', 'dist');

// Serve Frontend Static Assets if dist exists (Render Production Mode)
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH));

  // Express SPA Fallback for client-side routing
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

export { app };
export default app;
