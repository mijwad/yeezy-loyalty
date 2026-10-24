/**
 * Error Handling Middleware
 * Centralized error handling with sanitized responses
 */
import { ZodError } from 'zod';

/**
 * Custom error classes for different error types
 */
export class AppError extends Error {
  constructor(message, code, statusCode = 500, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message, details) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message, details) {
    super(message, 'UNAUTHORIZED', 401, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message, details) {
    super(message, 'FORBIDDEN', 403, details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message, details) {
    super(message, 'CONFLICT', 409, details);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message, retryAfter, details) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class InternalError extends AppError {
  constructor(message, details) {
    super(message, 'INTERNAL_ERROR', 500, details);
    this.name = 'InternalError';
  }
}

/**
 * Async error wrapper - catches async errors and passes to error handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request logger middleware - structured logging
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.id || 'unknown';

  // Log request
  console.log(JSON.stringify({
    level: 'info',
    type: 'request',
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  }));

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    console.log(JSON.stringify({
      level: logLevel,
      type: 'response',
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      timestamp: new Date().toISOString()
    }));
  });

  next();
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    requestId: req.id
  });
}

/**
 * Global error handler - must be last middleware
 */
export function errorHandler(err, req, res, next) {
  const requestId = req.id || 'unknown';

  // Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      errors: err.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      })),
      requestId
    });
  }

  // Known application errors
  if (err instanceof AppError) {
    const response = {
      status: 'error',
      code: err.code,
      message: err.message,
      requestId
    };

    // Include details in development only
    if (process.env.NODE_ENV !== 'production' && err.details) {
      response.details = err.details;
    }

    // Add Retry-After header for rate limit errors
    if (err instanceof RateLimitError && err.retryAfter) {
      res.setHeader('Retry-After', err.retryAfter);
    }

    return res.status(err.statusCode).json(response);
  }

  // Supabase/PostgreSQL errors
  if (err.code) {
    // Unique constraint violations
    if (err.code === '23505') {
      return res.status(409).json({
        status: 'error',
        code: 'CONFLICT',
        message: 'Resource already exists',
        requestId
      });
    }

    // Foreign key violations
    if (err.code === '23503') {
      return res.status(400).json({
        status: 'error',
        code: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist',
        requestId
      });
    }

    // Check constraint violations
    if (err.code === '23514') {
      return res.status(400).json({
        status: 'error',
        code: 'CONSTRAINT_VIOLATION',
        message: 'Data violates constraints',
        requestId
      });
    }

    // Connection errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
      return res.status(503).json({
        status: 'error',
        code: 'SERVICE_UNAVAILABLE',
        message: 'Database temporarily unavailable',
        requestId
      });
    }
  }

  // Log unexpected errors with full stack trace (server-side only)
  console.error(JSON.stringify({
    level: 'error',
    type: 'unhandled_error',
    requestId,
    method: req.method,
    path: req.path,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code
    },
    timestamp: new Date().toISOString()
  }));

  // Sanitized response for production
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: isProduction ? 'An unexpected error occurred' : err.message,
    requestId,
    ...(isProduction ? {} : { stack: err.stack })
  });
}

/**
 * Error boundary for specific route groups
 */
export function createErrorBoundary(errorMap = {}) {
  return (err, req, res, next) => {
    // Check if error matches a mapped error code
    for (const [errorCode, handler] of Object.entries(errorMap)) {
      if (err.code === errorCode || err.name === errorCode) {
        return handler(err, req, res, next);
      }
    }
    // Pass to global handler
    next(err);
  };
}

export default {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  InternalError,
  asyncHandler,
  requestLogger,
  notFoundHandler,
  errorHandler,
  createErrorBoundary
};