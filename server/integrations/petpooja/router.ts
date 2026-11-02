/**
 * Petpooja Router
 * Routes for Petpooja POS integration
 */

import { Router, Request, Response } from 'express';
import { petpoojaFullAuth } from './auth';
import {
  handleSaveOrder,
  handleGetRewards,
  handleRedeem,
  handleVerifyOtp,
} from './service';
import {
  SaveOrderRequestSchema,
  GetRewardsRequestSchema,
  RedeemRequestSchema,
  VerifyOtpRequestSchema,
} from './schemas';
import { ZodError } from 'zod';

const router = Router();

// Validation middleware factory
function validate(schema: any) {
  return (req: Request, res: Response, next: Function) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(200).json({
          status: false,
          message: `Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
        });
      }
      return res.status(200).json({ status: false, message: 'Invalid request' });
    }
  };
}

// POST /integrations/petpooja/saveOrder - Earn points from order
router.post(
  '/saveOrder',
  petpoojaFullAuth,
  validate(SaveOrderRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const outlet = (req as any).petpoojaOutlet;
      const result = await handleSaveOrder(req.body, outlet);
      res.json(result);
    } catch (error) {
      console.error('saveOrder error:', error);
      res.status(200).json({ status: false, message: 'Internal server error' });
    }
  }
);

// POST /integrations/petpooja/getRewards - Get customer rewards
router.post(
  '/getRewards',
  petpoojaFullAuth,
  validate(GetRewardsRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const outlet = (req as any).petpoojaOutlet;
      const result = await handleGetRewards(req.body, outlet);
      res.json(result);
    } catch (error) {
      console.error('getRewards error:', error);
      res.status(200).json({ status: false, message: 'Internal server error' });
    }
  }
);

// POST /integrations/petpooja/redeem - Redeem points / Send OTP
router.post(
  '/redeem',
  petpoojaFullAuth,
  validate(RedeemRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const outlet = (req as any).petpoojaOutlet;
      const result = await handleRedeem(req.body, outlet);
      res.json(result);
    } catch (error) {
      console.error('redeem error:', error);
      res.status(200).json({ status: false, message: 'Internal server error' });
    }
  }
);

// POST /integrations/petpooja/verifyOtp - Verify OTP and complete redemption
router.post(
  '/verifyOtp',
  petpoojaFullAuth,
  validate(VerifyOtpRequestSchema),
  async (req: Request, res: Response) => {
    try {
      const outlet = (req as any).petpoojaOutlet;
      const result = await handleVerifyOtp(req.body, outlet);
      res.json(result);
    } catch (error) {
      console.error('verifyOtp error:', error);
      res.status(200).json({ status: false, message: 'Internal server error' });
    }
  }
);

export default router;