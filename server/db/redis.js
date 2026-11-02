// Redis Client with Connection Pooling and Health Checks
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient = null;
let isRedisConfigured = false;

/**
 * @param {Object} [options]
 * @param {string} [options.url]
 * @param {string} [options.token]
 * @param {Object} [options.clientOptions]
 * @returns {Redis | null}
 */
export function createRedisClient(options = {}) {
  if (!REDIS_URL && !options.url) {
    console.warn('[Redis] No REDIS_URL configured. Redis features disabled.');
    return null;
  }

  const url = options.url || REDIS_URL;
  const token = options.token || REDIS_TOKEN;

  const clientOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('[Redis] Max retries reached. Giving up.');
        return null;
      }
      return Math.min(times * 200, 2000);
    },
    enableReadyCheck: true,
    lazyConnect: true,
    // Connection pool settings
    family: 4,
    connectTimeout: 10000,
    commandTimeout: 5000,
    ...options.clientOptions
  };

  // Handle Upstash REST API format
  if (url?.includes('upstash.io') && token) {
    // For Upstash, we use a different approach
    clientOptions.password = token;
  }

  const client = new Redis(url, clientOptions);

  client.on('connect', () => {
    console.log('[Redis] Connected');
  });

  client.on('ready', () => {
    console.log('[Redis] Ready');
    isRedisConfigured = true;
  });

  client.on('error', (err) => {
    console.error('[Redis] Error:', err.message);
    isRedisConfigured = false;
  });

  client.on('close', () => {
    console.warn('[Redis] Connection closed');
    isRedisConfigured = false;
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return client;
}

/**
 * @returns {Promise<Redis | null>}
 */
export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
    if (redisClient) {
      try {
        await redisClient.connect();
      } catch (err) {
        console.error('[Redis] Failed to connect:', err.message);
        redisClient = null;
      }
    }
  }
  return redisClient;
}

/**
 * @returns {boolean}
 */
export function isRedisAvailable() {
  return isRedisConfigured && redisClient?.status === 'ready';
}

// ============================================================================
// REDIS UTILITIES FOR LOYALTY SYSTEM
// ============================================================================

const KEY_PREFIX = 'yeezy:';

export const RedisKeys = {
  // Sessions
  session: (token) => `${KEY_PREFIX}session:${token}`,
  sessionByUser: (userId) => `${KEY_PREFIX}session:user:${userId}`,

  // Rate limiting
  rateLimit: (prefix, identifier) => `${KEY_PREFIX}ratelimit:${prefix}:${identifier}`,

  // Distributed locks
  lock: (resource, identifier) => `${KEY_PREFIX}lock:${resource}:${identifier}`,

  // Cache
  cache: (prefix, key) => `${KEY_PREFIX}cache:${prefix}:${key}`,

  // Member lookup cache
  member: (restaurantId, phoneE164) => `${KEY_PREFIX}member:${restaurantId}:${phoneE164}`,

  // Program config cache
  program: (restaurantId) => `${KEY_PREFIX}program:${restaurantId}`,

  // Webhook processing
  webhook: (eventId) => `${KEY_PREFIX}webhook:${eventId}`,

  // Idempotency keys
  idempotency: (key) => `${KEY_PREFIX}idempotent:${key}`,
};

/**
 * Redis Session Store
 */
export class RedisSessionStore {
  /**
   * @param {Redis} client
   * @param {number} [defaultTTL=86400] - 24 hours default
   */
  constructor(client, defaultTTL = 86400) {
    /** @type {Redis} */
    this.client = client;
    /** @type {number} */
    this.defaultTTL = defaultTTL;
  }

  /**
   * @param {Object} session
   * @returns {Promise<string>}
   */
  async create(session) {
    if (!this.client) return null;
    const token = session.token || `yzy_tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionData = {
      ...session,
      token,
      createdAt: Date.now()
    };
    await this.client.setex(
      RedisKeys.session(token),
      this.defaultTTL,
      JSON.stringify(sessionData)
    );
    // Also index by userId for lookup
    if (session.userId) {
      await this.client.setex(
        RedisKeys.sessionByUser(session.userId),
        this.defaultTTL,
        token
      );
    }
    return token;
  }

  /**
   * @param {string} token
   * @returns {Promise<Object | null>}
   */
  async get(token) {
    if (!this.client) return null;
    const data = await this.client.get(RedisKeys.session(token));
    return data ? JSON.parse(data) : null;
  }

  /**
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async destroy(token) {
    if (!this.client) return false;
    const session = await this.get(token);
    if (session?.userId) {
      await this.client.del(RedisKeys.sessionByUser(session.userId));
    }
    await this.client.del(RedisKeys.session(token));
    return true;
  }

  /**
   * @param {string} token
   * @param {number} [ttl]
   * @returns {Promise<boolean>}
   */
  async refresh(token, ttl = this.defaultTTL) {
    if (!this.client) return false;
    const session = await this.get(token);
    if (!session) return false;
    await this.client.setex(RedisKeys.session(token), ttl, JSON.stringify(session));
    if (session.userId) {
      await this.client.setex(RedisKeys.sessionByUser(session.userId), ttl, token);
    }
    return true;
  }

  /**
   * @param {string} userId
   * @returns {Promise<Object | null>}
   */
  async getByUserId(userId) {
    if (!this.client) return null;
    const token = await this.client.get(RedisKeys.sessionByUser(userId));
    if (!token) return null;
    return this.get(token);
  }
}

/**
 * Redis Rate Limiter (Sliding Window)
 */
export class RedisRateLimiter {
  /**
   * @param {Redis} client
   */
  constructor(client) {
    /** @type {Redis} */
    this.client = client;
  }

  /**
   * @param {string} prefix
   * @param {string} identifier
   * @param {number} maxRequests
   * @param {number} windowMs
   * @returns {Promise<{allowed: boolean, remaining: number, resetTime: number}>}
   */
  async checkLimit(prefix, identifier, maxRequests, windowMs) {
    if (!this.client) return { allowed: true, remaining: maxRequests };

    const key = RedisKeys.rateLimit(prefix, identifier);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Use sorted set for sliding window
    const pipeline = this.client.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.zadd(key, now, `${now}-${Math.random()}`);
    pipeline.expire(key, Math.ceil(windowMs / 1000) + 1);
    const results = await pipeline.exec();

    const currentCount = results[1][1];
    const allowed = currentCount < maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount);

    return { allowed, remaining, resetTime: now + windowMs };
  }

  /**
   * @param {string} prefix
   * @param {string} identifier
   * @param {number} maxRequests
   * @param {number} windowMs
   * @returns {Promise<{current: number, remaining: number}>}
   */
  async getLimit(prefix, identifier, maxRequests, windowMs) {
    if (!this.client) return { current: 0, remaining: maxRequests };
    const key = RedisKeys.rateLimit(prefix, identifier);
    const now = Date.now();
    const windowStart = now - windowMs;
    await this.client.zremrangebyscore(key, 0, windowStart);
    const current = await this.client.zcard(key);
    return { current, remaining: Math.max(0, maxRequests - current) };
  }
}

/**
 * Redis Distributed Lock
 */
export class RedisLock {
  /**
   * @param {Redis} client
   * @param {number} [defaultTTL=30000] - 30 seconds default
   */
  constructor(client, defaultTTL = 30000) {
    /** @type {Redis} */
    this.client = client;
    /** @type {number} */
    this.defaultTTL = defaultTTL;
  }

  /**
   * @param {string} resource
   * @param {string} identifier
   * @param {number} [ttl]
   * @returns {Promise<{acquired: boolean, release: function}>}
   */
  async acquire(resource, identifier, ttl = this.defaultTTL) {
    if (!this.client) return { acquired: true, release: () => {} };
    const key = RedisKeys.lock(resource, identifier);
    const lockValue = `${identifier}:${Date.now()}`;
    const acquired = await this.client.set(key, lockValue, 'PX', ttl, 'NX');
    if (!acquired) return { acquired: false, release: () => {} };

    const release = async () => {
      // Only release if we still own the lock
      const current = await this.client.get(key);
      if (current === lockValue) {
        await this.client.del(key);
      }
    };
    return { acquired: true, release };
  }

  /**
   * @param {string} resource
   * @param {string} identifier
   * @param {number} [ttl]
   * @returns {Promise<boolean>}
   */
  async extend(resource, identifier, ttl = this.defaultTTL) {
    if (!this.client) return false;
    const key = RedisKeys.lock(resource, identifier);
    const current = await this.client.get(key);
    if (!current || !current.startsWith(identifier)) return false;
    return await this.client.pexpire(key, ttl);
  }
}

/**
 * Redis Cache
 */
export class RedisCache {
  /**
   * @param {Redis} client
   * @param {number} [defaultTTL=300] - 5 minutes default
   */
  constructor(client, defaultTTL = 300) {
    /** @type {Redis} */
    this.client = client;
    /** @type {number} */
    this.defaultTTL = defaultTTL;
  }

  /**
   * @param {string} prefix
   * @param {string} key
   * @returns {Promise<any>}
   */
  async get(prefix, key) {
    if (!this.client) return null;
    const data = await this.client.get(RedisKeys.cache(prefix, key));
    return data ? JSON.parse(data) : null;
  }

  /**
   * @param {string} prefix
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl]
   * @returns {Promise<boolean>}
   */
  async set(prefix, key, value, ttl = this.defaultTTL) {
    if (!this.client) return false;
    await this.client.setex(RedisKeys.cache(prefix, key), ttl, JSON.stringify(value));
    return true;
  }

  /**
   * @param {string} prefix
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async del(prefix, key) {
    if (!this.client) return false;
    await this.client.del(RedisKeys.cache(prefix, key));
    return true;
  }

  /**
   * @param {string} prefix
   * @param {string} pattern
   * @returns {Promise<boolean>}
   */
  async invalidatePattern(prefix, pattern) {
    if (!this.client) return false;
    const keys = await this.client.keys(RedisKeys.cache(prefix, pattern));
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
    return true;
  }
}

/**
 * Redis Idempotency Store
 */
export class RedisIdempotencyStore {
  /**
   * @param {Redis} client
   * @param {number} [defaultTTL=86400] - 24 hours
   */
  constructor(client, defaultTTL = 86400) {
    /** @type {Redis} */
    this.client = client;
    /** @type {number} */
    this.defaultTTL = defaultTTL;
  }

  /**
   * @param {string} key
   * @param {string} [value='processed']
   * @returns {Promise<{isNew: boolean}>}
   */
  async checkAndSet(key, value = 'processed') {
    if (!this.client) return { isNew: true };
    const redisKey = RedisKeys.idempotency(key);
    const result = await this.client.set(redisKey, value, 'PX', this.defaultTTL * 1000, 'NX');
    return { isNew: result === 'OK' };
  }

  /**
   * @param {string} key
   * @returns {Promise<string | null>}
   */
  async get(key) {
    if (!this.client) return null;
    return await this.client.get(RedisKeys.idempotency(key));
  }

  /**
   * @param {string} key
   * @returns {Promise<boolean>}
   */
  async del(key) {
    if (!this.client) return false;
    await this.client.del(RedisKeys.idempotency(key));
    return true;
  }
}

export default {
  createRedisClient,
  getRedisClient,
  isRedisAvailable,
  RedisKeys,
  RedisSessionStore,
  RedisRateLimiter,
  RedisLock,
  RedisCache,
  RedisIdempotencyStore,
};