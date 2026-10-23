// Production Authentication API Router for Yeezy Platform
import { Router } from 'express';
import { posStore } from '../db/store.js';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', (req, res) => {
  const email = req.body.email || req.body.username || req.body.identifier;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Username or email and password are required' });
  }

  const authResult = posStore.authenticate(email, password);

  if (!authResult) {
    return res.status(401).json({ status: 'error', message: 'Invalid username/email or password' });
  }

  return res.json({
    status: 'success',
    token: authResult.token,
    user: authResult.user
  });
});

// POST /api/v1/auth/register-restaurant - Sign up a brand new restaurant & owner account
authRouter.post('/register-restaurant', (req, res) => {
  const { brandName, ownerName, ownerEmail, password, primaryOutletName } = req.body;

  if (!brandName || !ownerName || !ownerEmail || !password) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'Restaurant Name, Owner Name, Email, and Password are required' 
    });
  }

  try {
    const result = posStore.createRestaurantTenant({
      brandName: brandName.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim(),
      password: password.trim(),
      primaryOutletName: primaryOutletName?.trim() || `${brandName.trim()} Main Outlet`
    });

    // Auto-login newly registered restaurant
    const authResult = posStore.authenticate(ownerEmail, password);

    return res.status(201).json({
      status: 'success',
      message: `Restaurant '${brandName}' registered successfully!`,
      token: authResult.token,
      user: authResult.user
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// GET /api/v1/auth/me
authRouter.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token) {
    const session = posStore.getSession(token);
    if (session) {
      return res.json({
        status: 'success',
        user: session.user
      });
    }
  }

  return res.status(401).json({ status: 'error', message: 'Session expired or invalid' });
});

// POST /api/v1/auth/logout
authRouter.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (token) {
    posStore.destroySession(token);
  }
  return res.json({ status: 'success', message: 'Logged out successfully' });
});
