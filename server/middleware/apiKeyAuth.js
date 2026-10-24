import crypto from 'node:crypto';
import { supabaseAdmin } from '../db/supabase.js';

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
    const { data: keyRecord, error } = await supabaseAdmin
      .from('api_keys')
      .select('restaurant_id, name, scopes, is_test, expires_at, revoked_at')
      .eq('key_hash', keyHash)
      .single();

    if (error || !keyRecord) {
      return res.status(401).json({
        error: {
          code: 'INVALID_API_KEY',
          message: 'API key is not recognized'
        }
      });
    }

    if (keyRecord.revoked_at) {
      return res.status(401).json({
        error: {
          code: 'API_KEY_REVOKED',
          message: 'This API key has been revoked'
        }
      });
    }

    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return res.status(401).json({
        error: {
          code: 'API_KEY_EXPIRED',
          message: 'This API key has expired'
        }
      });
    }

    // Attach verified identity
    req.apiKey = {
      restaurantId: keyRecord.restaurant_id,
      name: keyRecord.name,
      scopes: keyRecord.scopes || [],
      isTest: keyRecord.is_test
    };
    req.restaurantId = keyRecord.restaurant_id;

    // Asynchronously update last_used_at
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', keyHash)
      .then();

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
