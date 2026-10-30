/**
 * Petpooja Integration Routes
 * Mounted at /integrations/petpooja
 * Matches the exact Petpooja Loyalty API specification
 */

import express from 'express';
import { Router } from 'express';
import {
  handleSaveOrder,
  handleGetRewards,
  handleRedeem,
  handleVerifyOtp
} from './service.js';

const router = Router();

// Middleware to parse JSON body
router.use(express.json());

// POST /integrations/petpooja/saveOrder - Earn points from order
router.post('/saveOrder', async (req, res) => {
  await handleSaveOrder(req, res);
});

// POST /integrations/petpooja/getRewards - Get customer rewards
router.post('/getRewards', async (req, res) => {
  await handleGetRewards(req, res);
});

// POST /integrations/petpooja/redeem - Redeem points / Send OTP
router.post('/redeem', async (req, res) => {
  await handleRedeem(req, res);
});

// POST /integrations/petpooja/verifyOtp - Verify OTP and complete redemption
router.post('/verifyOtp', async (req, res) => {
  await handleVerifyOtp(req, res);
});

export default router;