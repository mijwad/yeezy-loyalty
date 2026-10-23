// Authentication API Router for Yeezy Platform
import { Router } from 'express';
import { posStore } from '../db/store.js';

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Email and password are required' });
  }

  const authenticated = posStore.authenticate(email, password);

  if (!authenticated) {
    return res.status(401).json({ status: 'error', message: 'Invalid email or password' });
  }

  const token = `yzy_tok_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

  return res.json({
    status: 'success',
    token,
    user: authenticated
  });
});

// GET /api/v1/auth/me
authRouter.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const emailQuery = req.query.email;

  if (emailQuery) {
    const user = posStore.data.users.find(u => u.email.toLowerCase() === emailQuery.toLowerCase());
    if (user) {
      let tenant = null;
      if (user.tenantId) {
        tenant = posStore.data.tenants.find(t => t.id === user.tenantId);
      }
      return res.json({
        status: 'success',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          tenantId: user.tenantId || null,
          tenantName: tenant ? tenant.name : 'Yeezy Global Admin',
          primaryRestID: tenant ? tenant.primaryRestID : 'PP_DEL_101'
        }
      });
    }
  }

  // Fallback default active user (Alex Rivera)
  const defaultOwner = posStore.data.users.find(u => u.role === 'RESTAURANT_OWNER');
  return res.json({
    status: 'success',
    user: defaultOwner
  });
});

// POST /api/v1/auth/logout
authRouter.post('/logout', (req, res) => {
  return res.json({ status: 'success', message: 'Logged out successfully' });
});
