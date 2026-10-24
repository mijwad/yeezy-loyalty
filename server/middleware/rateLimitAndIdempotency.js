import crypto from 'node:crypto';
import { supabaseAdmin } from '../db/supabase.js';

/**
 * Shared Postgres Token Bucket Rate Limiter
 * Default: 60 tokens capacity, 20 refill/sec (burst 60, sustained 20 req/s per API key)
 */
export function rateLimiter({ cost = 1, capacity = 60, refillPerSec = 20 } = {}) {
  return async (req, res, next) => {
    const restaurantId = req.restaurantId || req.ip || 'anonymous';
    const bucketKey = `rate_limit:${restaurantId}`;

    try {
      const { data, error } = await supabaseAdmin.rpc('fn_check_rate_limit', {
        p_key: bucketKey,
        p_cost: cost,
        p_capacity: capacity,
        p_refill_per_sec: refillPerSec
      });

      if (error) {
        console.warn('[Rate Limit RPC Notice]', error.message);
        return next(); // Fail open if rate limit table is momentarily unreachable
      }

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
      next();
    } catch (err) {
      console.warn('[Rate Limit Exception]', err);
      next();
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
 */
export function idempotency() {
  return async (req, res, next) => {
    const idempotencyKey = req.headers['idempotency-key'];
    if (!idempotencyKey || req.method === 'GET' || req.method === 'HEAD') {
      return next();
    }

    const restaurantId = req.restaurantId;
    if (!restaurantId) {
      return next();
    }

    const requestBodyStr = JSON.stringify(req.body || {});
    const requestHash = crypto.createHash('sha256').update(`${req.path}:${requestBodyStr}`).digest('hex');

    try {
      // Check existing cached response
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
            .then();
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.warn('[Idempotency Middleware Catch]', err);
      next();
    }
  };
}
