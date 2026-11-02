// Production Multi-Tenant Auth Router with JWT Support
// Uses new store module with Supabase + Redis
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../db/supabase.js';
import { authenticateUser, createRestaurantTenant, createSession, destroySession, getSession } from '../db/store.js';
import { requireAuth, requireSuperAdmin, generateTokens, verifyRefreshToken } from '../middleware/auth.js';

function toUuid(str) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export const authRouter = Router();

// POST /api/v1/auth/login - Unified login for all user types
authRouter.post('/login', async (req, res) => {
  const identifier = req.body.identifier || req.body.email || req.body.username;
  const password = req.body.password;
  const rememberMe = req.body.rememberMe || false;

  if (!identifier || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Identifier (email, username, or restaurant name) and password are required'
    });
  }

  try {
    const authResult = await authenticateUser(identifier.trim(), password);

    if (!authResult) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials. Please check your email/username/restaurant name and password.'
      });
    }

    // Generate JWT tokens
    const tokens = generateTokens(authResult.user);

    // Create Redis session with refresh token
    await createSession({
      ...authResult.user,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken
    });

    // Set secure HTTP-only cookie for refresh token
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    };

    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    return res.json({
      status: 'success',
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: authResult.user,
      expiresIn: '24h'
    });
  } catch (err) {
    if (err.code === 'RESTAURANT_INACTIVE') {
      return res.status(403).json({
        status: 'error',
        code: 'RESTAURANT_INACTIVE',
        message: err.message
      });
    }
    console.error('[Auth Login Error]', err);
    return res.status(500).json({ status: 'error', message: 'Authentication failed. Please try again.' });
  }
});

// POST /api/v1/auth/refresh - Refresh access token
authRouter.post('/refresh', async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ status: 'error', message: 'Refresh token required' });
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded || decoded.type !== 'refresh') {
    return res.status(401).json({ status: 'error', message: 'Invalid refresh token' });
  }

  // Verify session exists in Redis
  const session = await getSession(refreshToken);
  if (!session || session.refreshToken !== refreshToken) {
    return res.status(401).json({ status: 'error', message: 'Session expired or invalid' });
  }

  // Generate new tokens
  const tokens = generateTokens(session.user);

  // Update session
  await createSession({
    ...session.user,
    refreshToken: tokens.refreshToken,
    accessToken: tokens.accessToken
  });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };

  res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

  return res.json({
    status: 'success',
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: '24h'
  });
});

// POST /api/v1/auth/register-restaurant - Admin only endpoint (protected)
authRouter.post('/register-restaurant', requireAuth, requireSuperAdmin, async (req, res) => {
  const { brandName, ownerName, ownerEmail, password, primaryOutletName } = req.body;

  if (!brandName || !ownerName || !ownerEmail || !password) {
    return res.status(400).json({
      status: 'error',
      message: 'Restaurant Name, Owner Name, Email, and Password are required'
    });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email format' });
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters' });
  }

  try {
    const result = await createRestaurantTenant({
      brandName: brandName.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
      password: password.trim(),
      primaryOutletName: primaryOutletName?.trim() || `${brandName.trim()} Main Outlet`
    });

    // Persist to Supabase cloud database
    if (supabaseAdmin) {
      try {
        const tenantUuid = toUuid(result.tenant.id);
        const contactPhone = req.body.ownerPhone || req.body.phone || '+919876543210';

        // Generate real cryptographic API Key for POS integration
        const rawApiKey = `lk_live_${crypto.randomBytes(32).toString('hex')}`;
        const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
        const keyPrefix = rawApiKey.slice(0, 12);
        const keyLast4 = rawApiKey.slice(-4);
        result.tenant.apiKey = rawApiKey;

        const { data: existingSbUser } = await supabaseAdmin
          .from('tenant_users')
          .select('id')
          .eq('email', ownerEmail.trim().toLowerCase())
          .maybeSingle();

        const userPayload = {
          tenant_id: tenantUuid,
          full_name: ownerName.trim(),
          email: ownerEmail.trim().toLowerCase(),
          password_hash: bcrypt.hashSync(password.trim(), 10),
          role: 'BRAND_OWNER',
          is_active: true
        };
        if (existingSbUser?.id) {
          userPayload.id = existingSbUser.id;
        }

        await Promise.all([
          supabaseAdmin.from('tenants').upsert({
            id: tenantUuid,
            code: result.tenant.id,
            name: brandName.trim(),
            status: 'ACTIVE',
            primary_contact_name: ownerName.trim(),
            primary_contact_email: ownerEmail.trim().toLowerCase(),
            primary_contact_phone: contactPhone
          }, { onConflict: 'id' }),

          supabaseAdmin.from('tenant_users').upsert(userPayload),

          supabaseAdmin.from('loyalty_programs').upsert({
            restaurant_id: result.tenant.id,
            is_active: true,
            config: (await import('../../lib/loyalty/config.js')).DEFAULT_LOYALTY_CONFIG
          }, { onConflict: 'restaurant_id' }),

          supabaseAdmin.from('api_keys').insert({
            restaurant_id: result.tenant.id,
            name: `${brandName.trim()} (Live POS)`,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            last4: keyLast4,
            scopes: ['customers:read', 'customers:write', 'points:earn', 'points:redeem'],
            is_test: false
          })
        ]);
        console.log(`[Supabase Register] Successfully persisted ${result.tenant.id} and user ${ownerEmail.toLowerCase()} to Supabase.`);
      } catch (sbErr) {
        console.warn('[Supabase Register Catch]', sbErr.message);
      }
    }

    return res.status(201).json({
      status: 'success',
      message: `Restaurant '${brandName}' registered successfully! Owner can login with their email.`,
      data: {
        tenant: result.tenant,
        user: result.user,
        credentials: {
          email: ownerEmail.trim().toLowerCase(),
          brandName: brandName.trim(),
          ownerName: ownerName.trim()
        }
      }
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/auth/forgot-password - Request password reset
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ status: 'error', message: 'Email is required' });
  }

  // Find user by email in Supabase
  const { data: user } = await supabaseAdmin
    .from('tenant_users')
    .select('id, email, role')
    .ilike('email', email)
    .maybeSingle();

  // Always return success to prevent email enumeration
  if (user) {
    // Generate password reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token in Redis with expiry
    await createSession({
      id: `reset_${user.id}`,
      userId: user.id,
      resetToken,
      type: 'password_reset'
    });

    // In production, send email with reset link:
    // await sendPasswordResetEmail(user.email, resetToken);
    console.log(`[Password Reset] Token for ${user.email}: ${resetToken}`);
  }

  return res.json({
    status: 'success',
    message: 'If an account exists with that email, a password reset link has been sent.'
  });
});

// POST /api/v1/auth/reset-password - Reset password with token
authRouter.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ status: 'error', message: 'Reset token and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ status: 'error', message: 'Invalid reset token' });
    }

    // Check if token exists and not used in Redis
    const resetData = await getSession(`reset_${decoded.userId}`);
    if (!resetData || resetData.resetToken !== token || resetData.used) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired reset token' });
    }

    // Update password in Supabase
    const newHash = bcrypt.hashSync(newPassword.trim(), 10);
    const { error: updateError } = await supabaseAdmin
      .from('tenant_users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', decoded.userId);

    if (updateError) {
      return res.status(500).json({ status: 'error', message: 'Failed to update password' });
    }

    // Mark token as used
    await destroySession(`reset_${decoded.userId}`);

    // Invalidate all existing sessions for this user
    // (This would require a Redis pattern scan - simplified for now)

    return res.json({
      status: 'success',
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(400).json({ status: 'error', message: 'Reset token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(400).json({ status: 'error', message: 'Invalid reset token' });
    }
    console.error('[Reset Password Error]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to reset password' });
  }
});

// GET /api/v1/auth/me - Get current user profile
authRouter.get('/me', requireAuth, (req, res) => {
  return res.json({
    status: 'success',
    user: req.user
  });
});

// POST /api/v1/auth/logout
authRouter.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const refreshToken = req.cookies?.refreshToken;

  if (token) {
    await destroySession(token);
  }
  if (refreshToken) {
    await destroySession(refreshToken);
  }

  // Clear refresh token cookie
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  return res.json({ status: 'success', message: 'Logged out successfully' });
});

// POST /api/v1/auth/change-password - Change password (authenticated)
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ status: 'error', message: 'Current password and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters' });
  }

  try {
    // Verify current password via Supabase
    const { data: user } = await supabaseAdmin
      .from('tenant_users')
      .select('id, password_hash, email, role, tenant_id')
      .eq('id', req.user.id)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User account not found' });
    }

    // Verify current password with bcrypt
    const passwordMatches = user.password_hash && bcrypt.compareSync(currentPassword, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect. Please verify and try again.' });
    }

    // Hash new password
    const newHash = bcrypt.hashSync(newPassword.trim(), 10);

    // Update in Supabase
    const { error: updateError } = await supabaseAdmin
      .from('tenant_users')
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      return res.status(500).json({ status: 'error', message: 'Failed to update password' });
    }

    // Invalidate other sessions for this user (keep current)
    // (Would require Redis pattern scan - simplified)

    return res.json({
      status: 'success',
      message: 'Password changed successfully! Stored in database.',
      supabaseUpdated: true
    });
  } catch (err) {
    console.error('[Change Password Error]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to change password. Please try again.' });
  }
});

export { toUuid };