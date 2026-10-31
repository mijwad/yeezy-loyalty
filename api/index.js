// Vercel Serverless Function Entrypoint
// Handles API (/api/*, /v1/*, /pos/*, /integrations/*, /health, /ready, /metrics) requests
import { app } from '../server/app.js';

export default function handler(req, res) {
  return app(req, res);
}

