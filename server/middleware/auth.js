// Production Multi-Tenant Authentication & Session Middleware
// Phase 0.5 Hardened: Eliminates unauthenticated x-tenant-id impersonation
import { posStore } from '../db/store.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7).trim() 
    : (req.query?.token || req.headers['x-auth-token']);

  const tenantHeader = req.headers['x-tenant-id'] || req.query?.tenantId;

  // Initialize clean auth context
  req.user = null;
  req.session = null;
  req.tenantId = null;

  if (token) {
    // Session token authentication (dashboard users)
    const session = posStore.getSession(token);
    if (session && session.user) {
      req.user = session.user;
      req.session = session;

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

  // Unauthenticated requests: NEVER allow arbitrary tenantHeader to set req.tenantId.
  // Unauthenticated requests have req.tenantId = null.
  req.tenantId = null;

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
