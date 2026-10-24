// Yeezy Loyalty & Multi-POS Backend Express App
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';

import { v1PublicRouter } from './routes/v1Public.js';
import { posUnifiedRouter } from './routes/posUnified.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { customersRouter } from './routes/customers.js';
import { dashboardRouter } from './routes/dashboard.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/errorHandler.js';
import { validateRequest } from './middleware/validateRequest.js';
import { supabaseAdmin } from './db/supabase.js';

dotenv.config();

const app = express();

// Trust proxy for correct IP behind load balancers
app.set('trust proxy', 1);

// CORS Configuration - restrict to known origins in production
const corsOptions = {
  origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : true, // Allow all in dev
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Tenant-ID', 'X-Petpooja-Signature'],
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID for correlation
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Structured request logging
app.use(requestLogger);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'Yeezy Loyalty Engine',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/ready', async (req, res) => {
  // Deep health check - verify DB connectivity
  try {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('loyalty_programs').select('id').limit(1);
      if (error) throw error;
    }
    res.json({ status: 'ready', database: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', database: 'disconnected', error: err.message });
  }
});

// Canonical Public API v1 for POS Integrations (OpenAPI 3.1 & SDK)
app.use('/v1', v1PublicRouter);

// Multi-POS Unified Routes (scalable adapter pattern)
app.use('/pos', posUnifiedRouter);

// Automatic Multi-Tenant Session & Token Resolver (Dashboard & Legacy)
app.use('/api', authMiddleware);

// API Routes with validation
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/pos', posUnifiedRouter); // Also available under /api for dashboard
app.use('/api/v1/customers', validateRequest('customerUpsert'), customersRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/loyalty', loyaltyRouter);
app.use('/api/loyalty', loyaltyRouter); // Legacy path

// Metrics endpoint (Prometheus format)
app.get('/metrics', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const [
      { count: programs },
      { count: members },
      { count: ledgerEntries },
      { count: reservations },
      { count: orders }
    ] = await Promise.all([
      supabaseAdmin.from('loyalty_programs').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('loyalty_members').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('loyalty_ledger').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('redemption_reservations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('*', { count: 'exact', head: true })
    ]);

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send([
      `# HELP yeezy_loyalty_programs_total Total number of loyalty programs`,
      `# TYPE yeezy_loyalty_programs_total gauge`,
      `yeezy_loyalty_programs_total ${programs || 0}`,
      `# HELP yeezy_loyalty_members_total Total number of loyalty members`,
      `# TYPE yeezy_loyalty_members_total gauge`,
      `yeezy_loyalty_members_total ${members || 0}`,
      `# HELP yeezy_loyalty_ledger_entries_total Total number of ledger entries`,
      `# TYPE yeezy_loyalty_ledger_entries_total gauge`,
      `yeezy_loyalty_ledger_entries_total ${ledgerEntries || 0}`,
      `# HELP yeezy_loyalty_reservations_total Total number of redemption reservations`,
      `# TYPE yeezy_loyalty_reservations_total gauge`,
      `yeezy_loyalty_reservations_total ${reservations || 0}`,
      `# HELP yeezy_loyalty_orders_total Total number of orders`,
      `# TYPE yeezy_loyalty_orders_total gauge`,
      `yeezy_loyalty_orders_total ${orders || 0}`,
      ``
    ].join('\n'));
  } catch (err) {
    res.status(500).send('# Metrics collection failed\n');
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_PATH = path.join(__dirname, '..', 'dist');

// Serve Frontend Static Assets if dist exists (Render Production Mode)
if (fs.existsSync(DIST_PATH)) {
  app.use(express.static(DIST_PATH, {
    maxAge: '1y',
    etag: true,
    immutable: true
  }));

  // Express SPA Fallback for client-side routing
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/v1') && !req.path.startsWith('/pos') && !req.path.startsWith('/health') && !req.path.startsWith('/ready') && !req.path.startsWith('/metrics')) {
      return res.sendFile(path.join(DIST_PATH, 'index.html'));
    }
    next();
  });
} else {
  // Root API welcome in dev mode if dist is not built
  app.get('/', (req, res) => {
    res.json({
      name: 'Yeezy Loyalty & Multi-POS Integration API',
      version: '1.0.0',
      status: 'active',
      endpoints: {
        health: 'GET /health',
        ready: 'GET /ready',
        metrics: 'GET /metrics',
        posInquire: 'POST /pos/:posSystem/loyalty/inquire',
        posLock: 'POST /pos/:posSystem/loyalty/lock',
        posOrderSave: 'POST /pos/:posSystem/orders/save',
        posCancel: 'POST /pos/:posSystem/orders/cancel',
        publicAPI: 'POST /v1/orders (with API key)',
        docs: 'See OpenAPI spec at /openapi.yaml'
      },
      supportedPOSSystems: ['petpooja'] // Will be dynamic from factory
    });
  });
}

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export { app };
export default app;