// Loyalty Program Configurator REST Router
import { Router } from 'express';
import { posStore } from '../db/store.js';

export const loyaltyRouter = Router();

// GET /api/v1/loyalty/program
loyaltyRouter.get('/program', (req, res) => {
  return res.json({
    status: 'success',
    program: posStore.data.loyaltyProgram
  });
});

// PUT /api/v1/loyalty/program
loyaltyRouter.put('/program', (req, res) => {
  const updates = req.body;
  posStore.data.loyaltyProgram = {
    ...posStore.data.loyaltyProgram,
    ...updates
  };
  posStore.persist();

  return res.json({
    status: 'success',
    message: 'Loyalty program configuration updated successfully',
    program: posStore.data.loyaltyProgram
  });
});
