import { Router } from 'express';
import crypto from 'node:crypto';
import { posStore } from '../db/store.js';
import { supabaseAdmin } from '../db/supabase.js';

function toUuid(str) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export const authRouter = Router();

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res) => {
  const email = req.body.email || req.body.username || req.body.identifier;
  const password = req.body.password;

  if (!email || !password) {
    return res.status(400).json({ status: 'error', message: 'Username, restaurant name, or email and password are required' });
  }

  try {
    const authResult = await posStore.authenticate(email, password);

    if (!authResult) {
      return res.status(401).json({ 
        status: 'error', 
        message: 'Invalid username, restaurant name, or password. Please check your credentials (default restaurant password is owner123).' 
      });
    }

    return res.json({
      status: 'success',
      token: authResult.token,
      user: authResult.user
    });
  } catch (err) {
    if (err.code === 'RESTAURANT_INACTIVE') {
      return res.status(403).json({
        status: 'error',
        code: 'RESTAURANT_INACTIVE',
        message: err.message
      });
    }
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/register-restaurant - Sign up a brand new restaurant & owner account
authRouter.post('/register-restaurant', async (req, res) => {
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

    // Persist permanently to Supabase cloud database
    if (supabaseAdmin) {
      try {
        const tenantUuid = toUuid(result.tenant.id);
        const userObj = result.user || posStore.data.users?.find(u => u.tenantId === result.tenant.id);
        const pwdHash = userObj?.passwordHash || (posStore.data.users?.find(u => u.email === ownerEmail.trim().toLowerCase())?.passwordHash);

        await Promise.all([
          supabaseAdmin.from('tenants').upsert({
            id: tenantUuid,
            code: result.tenant.id,
            name: brandName.trim(),
            status: 'ACTIVE',
            primary_contact_name: ownerName.trim(),
            primary_contact_email: ownerEmail.trim().toLowerCase(),
            primary_contact_phone: req.body.phone || '+919876543210'
          }, { onConflict: 'id' }),

          supabaseAdmin.from('tenant_users').upsert({
            tenant_id: tenantUuid,
            full_name: ownerName.trim(),
            email: ownerEmail.trim().toLowerCase(),
            password_hash: pwdHash,
            role: 'BRAND_OWNER',
            is_active: true
          }, { onConflict: 'tenant_id,email' })
        ]);
      } catch (sbErr) {
        console.warn('[Supabase Register Catch]', sbErr.message);
      }
    }

    // Auto-login newly registered restaurant
    const authResult = await posStore.authenticate(ownerEmail, password);

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
