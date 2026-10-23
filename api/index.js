// Vercel Serverless Function Entrypoint
// Routes all /api/* requests to the Express application
import { app } from '../server/app.js';

export default function handler(req, res) {
  return app(req, res);
}
