/**
 * Petpooja Authentication Middleware
 * Validates partner token using timing-safe comparison
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import crypto from 'crypto';

// Expected environment variable: PETPOOJA_PARTNER_TOKEN
const PARTNER_TOKEN = process.env.PETPOOJA_PARTNER_TOKEN;

if (!PARTNER_TOKEN) {
  console.error('⚠️  WARNING: PETPOOJA_PARTNER_TOKEN not set in environment!');
  console.error('   All Petpooja requests will be rejected.');
}

/**
 * Hash token for storage/comparison
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify token using timing-safe comparison
 */
export function verifyToken(inputToken: string): boolean {
  if (!PARTNER_TOKEN) return false;

  const inputHash = hashToken(inputToken);
  const expectedHash = hashToken(PARTNER_TOKEN);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash),
      Buffer.from(expectedHash)
    );
  } catch {
    return false;
  }
}

/**
 * Express middleware to validate Petpooja token
 */
export function petpoojaAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.body?.token;

  if (!token) {
    return res.status(200).json({ status: false, message: 'Missing token' });
  }

  if (!verifyToken(token)) {
    return res.status(200).json({ status: false, message: 'Invalid token' });
  }

  next();
}

/**
 * Resolve outlet by eateryBranchCode
 */
export async function resolveOutlet(eateryBranchCode: string) {
  const outlet = await prisma.outlet.findUnique({
    where: { eateryBranchCode },
  });

  return outlet;
}

/**
 * Full auth middleware: validates token AND resolves outlet
 */
export async function petpoojaFullAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.body?.token;
  const eateryBranchCode = req.body?.eateryBranchCode || req.body?.data?.Restaurant?.eateryBranchCode;

  if (!token) {
    return res.status(200).json({ status: false, message: 'Missing token' });
  }

  if (!verifyToken(token)) {
    return res.status(200).json({ status: false, message: 'Invalid token' });
  }

  if (!eateryBranchCode) {
    return res.status(200).json({ status: false, message: 'Missing eateryBranchCode' });
  }

  const outlet = await resolveOutlet(eateryBranchCode);

  if (!outlet) {
    return res.status(200).json({ status: false, message: 'Unknown branch' });
  }

  // Attach outlet to request for downstream use
  (req as any).petpoojaOutlet = outlet;

  next();
}