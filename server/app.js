// Yeezy Loyalty & Multi-POS Backend Express App
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';

import { v1PublicRouter } from './routes/v1Public.js';
import { posUnifiedRouter } from './routes/posUnified.js';
import { posRouter } from './routes/pos.js';
import { loyaltyRouter } from './routes/loyalty.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { customersRouter } from './routes/customers.js';
import { dashboardRouter } from './routes/dashboard.js';
import { marketplaceRouter } from './routes/marketplace.js';
import { whatsappWebhookRouter } from './routes/whatsappWebhook.js';
import { whatsappRouter } from './routes/whatsappModule.js';
import { petpoojaRouter } from './integrations/petpooja/routes.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler, requestLogger } from './middleware/errorHandler.js';
import { validateRequest } from './middleware/validateRequest.js';
import { supabaseAdmin } from './db/supabase.js';
import { posStore } from './db/store.js';

dotenv.config();

const app = express();

// Sync cloud database at startup
if (posStore.syncWithSupabase) {
  posStore.syncWithSupabase().catch(err => {
    console.warn('[Startup] Supabase initial sync notice:', err.message);
  });
}

// Trust proxy for correct IP behind load balancers
app.set('trust proxy', 1);

// Dynamic CORS origin verification allowing production frontends, previews, and local dev
const envOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [])
].filter(Boolean).map(o => o.trim());

const allowedOrigins = new Set([
  'https://beebill.online',
  'http://beebill.online',
  'https://www.beebill.online',
  'http://www.beebill.online',
  'https://yeezy-loyalty.vercel.app',
  'https://yeezy-loyalty.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  ...envOrigins
]);

function isAllowedOrigin(origin) {
  if (!origin) return true; // Allow non-browser requests (curl, server-to-server)
  if (allowedOrigins.has(origin)) return true;
  // Allow all beebill.online domains and subdomains
  if (/^https?:\/\/([a-zA-Z0-9_-]+\.)*beebill\.online$/.test(origin)) return true;
  // Allow all vercel preview and production subdomains
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/.test(origin)) return true;
  // Allow all onrender subdomains
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*onrender\.com$/.test(origin)) return true;
  // Allow localhost on any port
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Tenant-ID',
    'X-Petpooja-Signature',
    'X-RMS-Signature',
    'X-Signature',
    'X-Requested-With',
    'X-Request-ID',
    'Accept'
  ],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request ID for correlation
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Structured request logging
app.use(requestLogger);

// Health check (no auth required) - supports both /health and /api/health
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'Yeezy Loyalty Engine',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Petpooja Loyalty Integration (exact API spec)
app.use('/integrations/petpooja', petpoojaRouter);
app.use('/api/integrations/petpooja', petpoojaRouter);

app.get(['/ready', '/api/ready'], async (req, res) => {
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
app.use('/pos', posRouter);
app.use('/api/pos', posRouter);

// WhatsApp Cloud API Webhook (unauthenticated Meta handshake & event ingestion)
app.use('/api/whatsapp/webhook', whatsappWebhookRouter);

// Automatic Multi-Tenant Session & Token Resolver (Dashboard & Legacy)
app.use('/api', authMiddleware);

// WhatsApp Campaign Module (authenticated restaurant management)
app.use('/api/whatsapp', whatsappRouter);

// API Routes with validation
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/admin', adminRouter);
app.use('/api/v1/pos', posRouter);
app.use('/api/v1/pos', posUnifiedRouter);
app.use('/api/v1/customers', customersRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/loyalty', loyaltyRouter);
app.use('/api/loyalty', loyaltyRouter); // Legacy path

// Marketplace & POS Onboarding Routes (requires authentication)
app.use('/api/marketplace', marketplaceRouter);

// Metrics endpoint (Prometheus format)
app.get(['/metrics', '/api/metrics'], async (req, res) => {
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
const PUBLIC_PATH = path.join(__dirname, '..', 'public');

// Legal Compliance Pages for Meta & Public Audit
app.get(['/privacy', '/privacy-policy'], (req, res) => {
  const pPath = path.join(PUBLIC_PATH, 'privacy.html');
  if (fs.existsSync(pPath)) return res.sendFile(pPath);
  res.sendFile(path.join(DIST_PATH, 'privacy.html'));
});

app.get(['/terms', '/terms-of-service'], (req, res) => {
  const tPath = path.join(PUBLIC_PATH, 'terms.html');
  if (fs.existsSync(tPath)) return res.sendFile(tPath);
  res.sendFile(path.join(DIST_PATH, 'terms.html'));
});

app.get('/data-deletion', (req, res) => {
  const dPath = path.join(PUBLIC_PATH, 'data-deletion.html');
  if (fs.existsSync(dPath)) return res.sendFile(dPath);
  res.sendFile(path.join(DIST_PATH, 'data-deletion.html'));
});

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
        marketplace: {
          posSystems: 'GET /api/marketplace/pos-systems',
          outlets: 'GET /api/marketplace/outlets',
          createOutlet: 'POST /api/marketplace/outlets',
          connectOutlet: 'POST /api/marketplace/outlets/:outletId/connect',
          apiKeys: 'GET /api/marketplace/api-keys',
          createApiKey: 'POST /api/marketplace/api-keys',
          revokeApiKey: 'DELETE /api/marketplace/api-keys/:keyId',
          integrationGuide: 'GET /api/marketplace/integration-guide/:posSystem',
          webhookTest: 'POST /api/marketplace/webhook-test/:posSystem'
        },
        docs: 'See OpenAPI spec at /openapi.yaml'
      },
      supportedPOSSystems: posAdapterFactory.getRegisteredSystems()
    });
  });
}

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export { app };
export default app;