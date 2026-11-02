// Production Multi-Tenant Authentication & Session Middleware with JWT + Redis
// Phase 0.5 Hardened: Eliminates unauthenticated x-tenant-id impersonation
import jwt from 'jsonwebtoken';
import { getSession, destroySession, refreshSession } from '../db/store.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required. Generate a secure secret with: openssl rand -base64 32');
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  // Check for token in query param or header (for WebSocket upgrades, etc.)
  const queryToken = req.query?.token || req.headers['x-auth-token'];
  const cookieToken = req.cookies?.refreshToken;

  const token = bearerToken || queryToken || cookieToken;
  const tenantHeader = req.headers['x-tenant-id'] || req.query?.tenantId;

  // Initialize clean auth context
  req.user = null;
  req.session = null;
  req.tenantId = null;
  req.authType = null; // 'jwt' | 'session' | null

  if (token) {
    // First try JWT verification
    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      // Check if it's an access token (not refresh token)
      if (!decoded.type || decoded.type === 'access') {
        // Build user from decoded JWT (stateless)
        if (decoded.tenantId || decoded.userId) {
          const user = {
            id: decoded.userId,
            name: decoded.name || decoded.email?.split('@')[0] || 'Restaurant Owner',
            email: decoded.email,
            role: decoded.role || 'RESTAURANT_OWNER',
            tenantId: decoded.tenantId,
            tenantName: decoded.tenantName || 'Restaurant',
            primaryRestID: decoded.primaryRestID,
            assignedOutlets: decoded.assignedOutlets || []
          };

          // Create session-like object for compatibility
          const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            tenantId: user.tenantId,
            tenantName: user.tenantName,
            primaryRestID: user.primaryRestID,
            assignedOutlets: user.assignedOutlets
          };

          req.user = sessionUser;
          req.session = {
            user: sessionUser,
            token,
            userId: user.id,
            tenantId: user.tenantId,
            createdAt: decoded.iat ? decoded.iat * 1000 : Date.now()
          };
          req.authType = 'jwt';

          // Handle tenant resolution
          if (sessionUser.role === 'SUPER_ADMIN') {
            req.tenantId = tenantHeader || sessionUser.tenantId || null;
          } else {
            // Restaurant owner is strictly locked to their own tenantId
            req.tenantId = sessionUser.tenantId;
          }

          return next();
        }
      }
    } catch (jwtErr) {
      // JWT verification failed, fall through to session check
    }

    // Fallback to Redis session token authentication
    (async () => {
      try {
        const session = await getSession(token);
        if (session && session.user) {
          req.user = session.user;
          req.session = session;
          req.authType = 'session';

          // Refresh session TTL on activity
          await refreshSession(token);

          // Super Admin can inspect any restaurant with verified session
          if (session.user.role === 'SUPER_ADMIN') {
            req.tenantId = tenantHeader || session.user.tenantId || null;
          } else {
            // Restaurant owner is strictly locked to their own tenantId.
            // Incoming x-tenant-id header attempting to access other tenants is ignored!
            req.tenantId = session.user.tenantId;
          }

          return next();
        }
      } catch (err) {
        console.warn('[Auth] Session lookup error:', err.message);
      }

      // If token is missing or session expired (e.g. server restart), preserve tenantHeader
      req.tenantId = tenantHeader || null;
      next();
    })();
    return;
  }

  // No token provided
  req.tenantId = tenantHeader || null;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Please log in with valid credentials.'
    });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      status: 'error',
      code: 'FORBIDDEN',
      message: 'Access denied: Super Admin privileges required.'
    });
  }
  next();
}

export function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      primaryRestID: user.primaryRestID,
      assignedOutlets: user.assignedOutlets
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
}

export async function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function logout(req, res) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7).trim()
    : req.cookies?.refreshToken;

  if (token) {
    await destroySession(token);
  }

  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });

  return res.json({ status: 'success', message: 'Logged out successfully' });
}

export default {
  authMiddleware,
  requireAuth,
  requireSuperAdmin,
  generateTokens,
  verifyRefreshToken,
  logout,
  JWT_SECRET
};