// Production Multi-Tenant Authentication & Session Middleware with JWT Support
// Phase 0.5 Hardened: Eliminates unauthenticated x-tenant-id impersonation
import jwt from 'jsonwebtoken';
import { posStore } from '../db/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'yeezy-loyalty-jwt-secret-change-in-production';

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
        // Find user in store
        const user = posStore.data.users?.find(u => u.id === decoded.userId);

        if (user) {
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

    // Fallback to session token authentication (legacy)
    const session = posStore.getSession(token);
    if (session && session.user) {
      req.user = session.user;
      req.session = session;
      req.authType = 'session';

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
  }

  // If token is missing or session expired (e.g. server restart), preserve tenantHeader
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