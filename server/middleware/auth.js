// Production Multi-Tenant Authentication & Session Middleware
import { posStore } from '../db/store.js';

export function authMiddleware(req, res, next) {
  // Extract token from Authorization header or query
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') 
    ? authHeader.slice(7).trim() 
    : (req.query?.token || req.headers['x-auth-token']);

  const tenantHeader = req.headers['x-tenant-id'] || req.query?.tenantId;

  if (token) {
    const session = posStore.getSession(token);
    if (session) {
      req.user = session.user;
      req.session = session;

      // Super Admin can override tenantId via header/query to inspect any restaurant
      if (session.user.role === 'SUPER_ADMIN') {
        req.tenantId = tenantHeader || session.user.tenantId || null;
      } else {
        // Restaurant owner is strictly locked to their own tenantId
        req.tenantId = session.user.tenantId;
      }

      return next();
    }
  }

  // Fallback for public POS webhooks or unauthenticated inspection
  if (tenantHeader) {
    req.tenantId = tenantHeader;
  }

  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required. Please log in with valid credentials.'
    });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({
      status: 'error',
      message: 'Access denied: Super Admin privileges required.'
    });
  }
  next();
}
