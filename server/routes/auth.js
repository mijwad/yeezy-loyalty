// Production Multi-Tenant Auth Router with JWT Support
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { posStore } from '../db/store.js';
import { supabaseAdmin } from '../db/supabase.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';

function toUuid(str) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// JWT Secret - should be in environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'yeezy-loyalty-jwt-secret-change-in-production';
const JWT_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';

export const authRouter = Router();

// Helper to generate JWT token
function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

// Helper to verify refresh token
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

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
    const authResult = await posStore.authenticate(identifier.trim(), password);

    if (!authResult) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials. Please check your email/username/restaurant name and password.'
      });
    }

    // Generate JWT tokens
    const tokens = generateTokens(authResult.user);

    // Store refresh token in session for validation
    const session = posStore.getSession(authResult.token);
    if (session) {
      session.refreshToken = tokens.refreshToken;
      session.accessToken = tokens.accessToken;
    }

    // Set secure HTTP-only cookie for refresh token (optional, for better security)
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000 // 7 days or 1 day
    };

    res.cookie('refreshToken', tokens.refreshToken, cookieOptions);

    return res.json({
      status: 'success',
      token: tokens.accessToken, // JWT access token for frontend
      refreshToken: tokens.refreshToken, // Also return in body for non-cookie clients
      user: authResult.user,
      expiresIn: JWT_EXPIRY
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

  // Verify session exists
  const session = posStore.getSession(refreshToken);
  if (!session || session.refreshToken !== refreshToken) {
    return res.status(401).json({ status: 'error', message: 'Session expired or invalid' });
  }

  // Generate new tokens
  const tokens = generateTokens(session.user);

  // Update session
  session.refreshToken = tokens.refreshToken;
  session.accessToken = tokens.accessToken;

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
    expiresIn: JWT_EXPIRY
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
    const result = posStore.createRestaurantTenant({
      brandName: brandName.trim(),
      ownerName: ownerName.trim(),
      ownerEmail: ownerEmail.trim().toLowerCase(),
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

  // Find user by email
  const user = posStore.data.users?.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

  // Always return success to prevent email enumeration
  // In production, you would send an actual email with reset link
  if (user) {
    // Generate password reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Store reset token (in production, save to database with expiry)
    if (!posStore.data.passwordResetTokens) {
      posStore.data.passwordResetTokens = {};
    }
    posStore.data.passwordResetTokens[user.id] = {
      token: resetToken,
      expiresAt: Date.now() + 3600000, // 1 hour
      used: false
    };
    posStore.persist();

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
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ status: 'error', message: 'Invalid reset token' });
    }

    // Check if token exists and not used
    const resetData = posStore.data.passwordResetTokens?.[decoded.userId];
    if (!resetData || resetData.token !== token || resetData.used) {
      return res.status(400).json({ status: 'error', message: 'Invalid or expired reset token' });
    }

    if (Date.now() > resetData.expiresAt) {
      return res.status(400).json({ status: 'error', message: 'Reset token has expired' });
    }

    // Find and update user
    const user = posStore.data.users?.find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // Hash new password
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    delete user.password; // Remove any legacy plaintext password

    // Mark token as used
    resetData.used = true;
    posStore.persist();

    // Invalidate all existing sessions for this user
    for (const [sessionToken, session] of Object.entries(posStore.sessions)) {
      if (session.userId === user.id) {
        delete posStore.sessions[sessionToken];
      }
    }

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
authRouter.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (token) {
    posStore.destroySession(token);
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
    const user = posStore.data.users?.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    // Verify current password
    const passwordMatches = bcrypt.compareSync(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect' });
    }

    // Hash new password
    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    delete user.password;
    posStore.persist();

    // Invalidate all sessions except current
    const currentToken = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null;
    for (const [sessionToken, session] of Object.entries(posStore.sessions)) {
      if (session.userId === user.id && sessionToken !== currentToken) {
        delete posStore.sessions[sessionToken];
      }
    }

    return res.json({
      status: 'success',
      message: 'Password changed successfully. Please log in again with your new password.'
    });
  } catch (err) {
    console.error('[Change Password Error]', err);
    return res.status(500).json({ status: 'error', message: 'Failed to change password' });
  }
});

export { JWT_SECRET, generateTokens, verifyRefreshToken };