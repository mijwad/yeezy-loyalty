/**
 * bee.loyalty - Main Express Application
 * Restaurant Loyalty Platform with Petpooja Integration
 */

import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import petpoojaRouter from '../integrations/petpooja/router';
import rewardsRouter from './routes/rewards';
import { prisma } from '../lib/prisma';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for rewards page
app.use('/rewards', express.static(path.join(__dirname, '../public/rewards')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'bee.loyalty', timestamp: new Date().toISOString() });
});

// Petpooja integration routes
// Mounted at /integrations/petpooja (NOT /pos/petpooja to avoid legacy router conflicts)
app.use('/integrations/petpooja', petpoojaRouter);

// Rewards page API
app.use('/api/rewards', rewardsRouter);

// Rewards page - serves HTML for token-based links
app.get('/rewards/:token', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/rewards/index.html'));
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ status: false, message: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  // Petpooja expects HTTP 200 with status:false for business errors
  // Only return 500 for genuine infrastructure failures
  res.status(500).json({ status: false, message: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connection...');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;