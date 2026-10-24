import crypto from 'node:crypto';
import { supabase, supabaseAdmin } from '../db/supabase.js';

/**
 * Cryptographic API Key Verification Middleware for Public API v1
 * - Accepts Bearer lk_live_<hex> or lk_test_<hex>
 * - Computes SHA-256 hash
 * - Resolves restaurant_id strictly from verified api_keys row
 * - Updates last_used_at
 */
export async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header. Expected: Bearer lk_live_... or Bearer lk_test_...'
      }
    });
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey.startsWith('lk_live_') && !rawKey.startsWith('lk_test_')) {
    return res.status(401).json({
      error: {
        code: 'INVALID_API_KEY_FORMAT',
        message: 'API key must start with lk_live_ or lk_test_'
      }
    });
  }

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  try {
    const client = supabaseAdmin || supabase;
    const { data: verifyRes, error } = await client.rpc('fn_verify_api_key', {
      p_key_hash: keyHash
    });

    const result = typeof verifyRes === 'string' ? JSON.parse(verifyRes) : verifyRes;

    if (error || !result || !result.valid) {
      const errCode = result?.error || 'INVALID_API_KEY';
      return res.status(401).json({
        error: {
          code: errCode,
          message: errCode === 'API_KEY_REVOKED' ? 'This API key has been revoked'
                 : errCode === 'API_KEY_EXPIRED' ? 'This API key has expired'
                 : 'API key is not recognized'
        }
      });
    }

    // Attach verified identity
    req.apiKey = {
      restaurantId: result.restaurant_id,
      name: result.name,
      scopes: result.scopes || [],
      isTest: result.is_test
    };
    req.restaurantId = result.restaurant_id;

    next();
  } catch (err) {
    console.error('[API Key Auth Error]', err);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to verify API key'
      }
    });
  }
}

/**
 * Scope enforcement helper
 */
export function requireScope(requiredScope) {
  return (req, res, next) => {
    if (!req.apiKey || !req.apiKey.scopes.includes(requiredScope)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Missing required scope: ${requiredScope}`
        }
      });
    }
    next();
  };
}
