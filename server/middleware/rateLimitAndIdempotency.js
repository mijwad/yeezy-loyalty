import crypto from 'node:crypto';
import { supabaseAdmin } from '../db/supabase.js';

/**
 * Local In-Memory Token Bucket (Fail-Closed Fallback)
 * Used when Supabase RPC is unavailable
 */
class LocalTokenBucket {
  constructor() {
    this.buckets = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  async checkLimit(key, cost, capacity, refillPerSec) {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: capacity - cost,
        lastRefill: now,
        capacity,
        refillPerSec
      };
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: bucket.tokens, retryAfter: 0 };
    }

    // Refill tokens based on elapsed time
    const elapsedSec = (now - bucket.lastRefill) / 1000;
    const refillTokens = elapsedSec * bucket.refillPerSec;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refillTokens);
    bucket.lastRefill = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfter: 0 };
    }

    const retryAfter = Math.ceil((cost - bucket.tokens) / bucket.refillPerSec);
    return { allowed: false, remaining: 0, retryAfter };
  }

  cleanup() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }
}

// Global local token bucket instance
const localTokenBucket = new LocalTokenBucket();

/**
 * Shared Postgres Token Bucket Rate Limiter with Local Fail-Closed Fallback
 * Default: 60 tokens capacity, 20 refill/sec (burst 60, sustained 20 req/s per API key)
 * If Supabase is unavailable, falls back to local in-memory token bucket
 */
export function rateLimiter({ cost = 1, capacity = 60, refillPerSec = 20 } = {}) {
  return async (req, res, next) => {
    const restaurantId = req.restaurantId || req.apiKey?.restaurantId || req.ip || 'anonymous';
    const bucketKey = `rate_limit:${restaurantId}`;

    try {
      // Try Supabase RPC first
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.rpc('fn_check_rate_limit', {
          p_key: bucketKey,
          p_cost: cost,
          p_capacity: capacity,
          p_refill_per_sec: refillPerSec
        });

        if (!error && data) {
          const result = typeof data === 'string' ? JSON.parse(data) : data;
          if (!result.allowed) {
            res.setHeader('Retry-After', result.retry_after || 1);
            return res.status(429).json({
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: `Too many requests. Please retry in ${result.retry_after || 1} seconds.`
              }
            });
          }

          res.setHeader('X-RateLimit-Remaining', result.remaining);
          res.setHeader('X-RateLimit-Limit', capacity);
          return next();
        }

        // RPC failed or returned error - log and fall back to local
        if (error) {
          console.warn('[Rate Limit] RPC error, falling back to local:', error.message);
        }
      }
    } catch (err) {
      console.warn('[Rate Limit] RPC exception, falling back to local:', err.message);
    }

    // FAIL-CLOSED: Use local token bucket when Supabase is unavailable
    try {
      const result = await localTokenBucket.checkLimit(bucketKey, cost, capacity, refillPerSec);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 1);
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Please retry in ${result.retryAfter || 1} seconds.`
          }
        });
      }

      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Source', 'local-fallback');
      next();
    } catch (err) {
      console.error('[Rate Limit] Local bucket error (should not happen):', err);
      // Ultimate fail-closed: deny request if even local bucket fails
      return res.status(503).json({
        error: {
          code: 'RATE_LIMIT_SERVICE_UNAVAILABLE',
          message: 'Rate limiting service temporarily unavailable'
        }
      });
    }
  };
}

/**
 * Shared Postgres Idempotency Protection Middleware
 * - Intercepts POST/PUT requests with Idempotency-Key
 * - Checks idempotency_keys table
 * - Replays previous response if identical payload
 * - Rejects with 409 Conflict if key reused with different payload
 * - Stores response on finish
 * - Always scoped by restaurant_id for multi-tenant isolation
 */
export function idempotency() {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['idempotency-key'] || req.headers['idempotency_key'];
    if (!idempotencyKey || req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }

    const restaurantId = req.restaurantId || req.apiKey?.restaurantId;
    if (!restaurantId) {
      // No restaurant context - skip idempotency but warn
      console.warn('[Idempotency] No restaurantId context, skipping idempotency check');
      return next();
    }

    const requestBodyStr = JSON.stringify(req.body || {});
    const requestHash = crypto.createHash('sha256').update(`${req.path}:${requestBodyStr}`).digest('hex');

    try {
      // Check existing cached response - ALWAYS scoped by restaurant_id
      const { data: cached, error } = await supabaseAdmin
        .from('idempotency_keys')
        .select('request_hash, response_status, response_body, expires_at')
        .eq('restaurant_id', restaurantId)
        .eq('idempotency_key', idempotencyKey)
        .single();

      if (cached) {
        if (new Date(cached.expires_at) < new Date()) {
          // Key expired, delete and proceed
          await supabaseAdmin
            .from('idempotency_keys')
            .delete()
            .eq('restaurant_id', restaurantId)
            .eq('idempotency_key', idempotencyKey);
        } else if (cached.request_hash !== requestHash) {
          // Reused key with different payload -> Conflict
          return res.status(409).json({
            error: {
              code: 'IDEMPOTENCY_KEY_MISMATCH',
              message: 'This Idempotency-Key was already used with a different request payload.'
            }
          });
        } else {
          // Idempotent replay
          res.setHeader('X-Idempotent-Replay', 'true');
          return res.status(cached.response_status).json(cached.response_body);
        }
      }

      // Intercept res.json to capture response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Save to idempotency_keys asynchronously if status is successful/valid
        if (res.statusCode < 500) {
          supabaseAdmin
            .from('idempotency_keys')
            .insert({
              restaurant_id: restaurantId,
              idempotency_key: idempotencyKey,
              request_path: req.path,
              request_hash: requestHash,
              response_status: res.statusCode,
              response_body: body,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
            .then(
              () => {},
              (err) => console.warn('[Idempotency] Failed to store response:', err.message)
            );
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.warn('[Idempotency Middleware] Error, proceeding without idempotency:', err.message);
      // Fail open for idempotency (non-critical) but log the error
      next();
    }
  };
}

/**
 * Cleanup on process exit
 */
process.on('SIGTERM', () => {
  localTokenBucket.destroy();
});

process.on('SIGINT', () => {
  localTokenBucket.destroy();
});

export default { rateLimiter, idempotency };