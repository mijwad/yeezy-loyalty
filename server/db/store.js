// Supabase + Redis Data Store - Replaces in-memory POSDataStore
// Provides distributed session, cache, rate limiting, and locking for 1M+ users
import { supabase, supabaseAdmin, isSupabaseConfigured, queryWithBreaker, rpcWithBreaker } from './supabase.js';
import { getRedisClient, isRedisAvailable, RedisSessionStore, RedisRateLimiter, RedisLock, RedisCache, RedisIdempotencyStore, RedisKeys } from './redis.js';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { normalizePhone, calculateLedgerBalance } from '../../lib/loyalty/engine.js';
import { DEFAULT_LOYALTY_CONFIG, validateLoyaltyConfig } from '../../lib/loyalty/config.js';

let redisClient = null;
let sessionStore = null;
let rateLimiter = null;
let lockManager = null;
let cache = null;
let idempotencyStore = null;

export async function initStore() {
  if (!isSupabaseConfigured) {
    console.warn('[Store] Supabase not configured. Some features will be limited.');
    return;
  }

  // Initialize Redis
  try {
    redisClient = await getRedisClient();
    if (redisClient) {
      sessionStore = new RedisSessionStore(redisClient, 86400); // 24h
      rateLimiter = new RedisRateLimiter(redisClient);
      lockManager = new RedisLock(redisClient, 30000); // 30s
      cache = new RedisCache(redisClient, 300); // 5min
      idempotencyStore = new RedisIdempotencyStore(redisClient, 86400); // 24h
      console.log('[Store] Redis initialized with session, rate-limit, lock, cache, idempotency');
    }
  } catch (err) {
    console.warn('[Store] Redis initialization failed, falling back to in-memory:', err.message);
  }
}

// In-memory fallback for development without Redis
const memoryFallback = {
  sessions: new Map(),
  rateLimits: new Map(),
  locks: new Map(),
  cache: new Map(),
  idempotency: new Map(),
};

// Session management
export async function createSession(user) {
  const token = `yzy_tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const session = {
    token,
    userId: user.id,
    tenantId: user.tenantId,
    user,
    createdAt: Date.now()
  };

  if (sessionStore) {
    await sessionStore.create(session);
  } else {
    memoryFallback.sessions.set(token, session);
  }
  return token;
}

export async function getSession(token) {
  if (!token) return null;
  if (sessionStore) {
    return await sessionStore.get(token);
  }
  return memoryFallback.sessions.get(token) || null;
}

export async function destroySession(token) {
  if (!token) return false;
  if (sessionStore) {
    return await sessionStore.destroy(token);
  }
  return memoryFallback.sessions.delete(token);
}

export async function refreshSession(token, ttl = 86400) {
  if (!token) return false;
  if (sessionStore) {
    return await sessionStore.refresh(token, ttl);
  }
  const session = memoryFallback.sessions.get(token);
  if (session) {
    session.createdAt = Date.now();
    return true;
  }
  return false;
}

// Rate limiting
export async function checkRateLimit(prefix, identifier, maxRequests, windowMs) {
  if (rateLimiter) {
    return await rateLimiter.checkLimit(prefix, identifier, maxRequests, windowMs);
  }
  // Memory fallback
  const key = `${prefix}:${identifier}`;
  const now = Date.now();
  const timestamps = (memoryFallback.rateLimits.get(key) || []).filter(ts => now - ts < windowMs);
  const allowed = timestamps.length < maxRequests;
  if (allowed) timestamps.push(now);
  memoryFallback.rateLimits.set(key, timestamps);
  return { allowed, remaining: Math.max(0, maxRequests - timestamps.length), resetTime: now + windowMs };
}

// Distributed locking
export async function acquireLock(resource, identifier, ttl = 30000) {
  if (lockManager) {
    return await lockManager.acquire(resource, identifier, ttl);
  }
  // Memory fallback
  const key = `${resource}:${identifier}`;
  if (memoryFallback.locks.has(key)) return { acquired: false, release: () => {} };
  memoryFallback.locks.set(key, true);
  return {
    acquired: true,
    release: () => memoryFallback.locks.delete(key)
  };
}

// Cache
export async function getCache(prefix, key) {
  if (cache) {
    return await cache.get(prefix, key);
  }
  return memoryFallback.cache.get(`${prefix}:${key}`) || null;
}

export async function setCache(prefix, key, value, ttl = 300) {
  if (cache) {
    return await cache.set(prefix, key, value, ttl);
  }
  memoryFallback.cache.set(`${prefix}:${key}`, value);
  return true;
}

export async function delCache(prefix, key) {
  if (cache) {
    return await cache.del(prefix, key);
  }
  memoryFallback.cache.delete(`${prefix}:${key}`);
  return true;
}

// Idempotency
export async function checkIdempotency(key) {
  if (idempotencyStore) {
    return await idempotencyStore.checkAndSet(key);
  }
  const existing = memoryFallback.idempotency.has(key);
  if (!existing) memoryFallback.idempotency.set(key, true);
  return { isNew: !existing };
}

// Member operations (direct Supabase)
export async function getOrCreateLoyaltyMember(restaurantId, phone, name = 'Valued Guest') {
  if (!supabaseAdmin) throw new Error('Supabase not configured');
  const phoneE164 = normalizePhone(phone);
  if (!phoneE164) throw new Error('Valid phone number required');

  // Try cache first
  const cacheKey = `${restaurantId}:${phoneE164}`;
  const cached = await getCache('member', cacheKey);
  if (cached) return cached;

  const { data: member, error } = await supabaseAdmin
    .from('loyalty_members')
    .upsert({
      restaurant_id: restaurantId,
      phone_e164: phoneE164,
      name: name || 'Valued Guest',
      tier: 'Silver'
    }, { onConflict: 'restaurant_id,phone_e164' })
    .select()
    .single();

  if (error) throw error;

  // Attach computed properties
  const balance = await getMemberBalance(restaurantId, member.id);
  member.tenantId = member.restaurant_id;
  member.phone = member.phone_e164;
  member.visits = member.visit_count || 0;
  member.lifetimeSpend = Math.round((member.lifetime_spend_paise || 0) / 100);
  member.pointsBalance = balance;

  await setCache('member', cacheKey, member);
  return member;
}

export async function getLoyaltyMemberById(memberId) {
  if (!supabaseAdmin) return null;
  const { data: member } = await supabaseAdmin
    .from('loyalty_members')
    .select('*')
    .eq('id', memberId)
    .single();
  return member || null;
}

export async function updateMemberTier(memberId, visitCount) {
  if (!supabaseAdmin) return 'Silver';
  let tier = 'Silver';
  if (visitCount >= 12) tier = 'Platinum';
  else if (visitCount >= 5) tier = 'Gold';

  await supabaseAdmin
    .from('loyalty_members')
    .update({ tier, visit_count: visitCount })
    .eq('id', memberId);

  // Invalidate cache
  const { data: member } = await supabaseAdmin
    .from('loyalty_members')
    .select('restaurant_id, phone_e164')
    .eq('id', memberId)
    .single();
  if (member) {
    await delCache('member', `${member.restaurant_id}:${member.phone_e164}`);
  }
  return tier;
}

// Ledger operations
export async function getMemberBalance(restaurantId, memberId) {
  if (!supabaseAdmin) return 0;
  const { data } = await rpcWithBreaker('fn_loyalty_get_available_balance', {
    p_restaurant_id: restaurantId,
    p_member_id: memberId
  });
  return data || 0;
}

export async function getActiveEarnEntries(restaurantId, memberId) {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('loyalty_ledger')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('member_id', memberId)
    .gt('remaining', 0)
    .gt('points', 0)
    .order('expires_at', { ascending: true, nullsLast: true });
  return data || [];
}

export async function appendLoyaltyLedgerEntry(entry) {
  if (!supabaseAdmin) throw new Error('Supabase not configured');

  // Check idempotency
  if (entry.order_id) {
    const idempotentResult = await checkIdempotency(`ledger:${entry.restaurant_id}:${entry.order_id}:${entry.type}`);
    if (!idempotentResult.isNew) {
      // Return existing entry (we'd need to query it, for now return duplicate flag)
      const { data: existing } = await supabaseAdmin
        .from('loyalty_ledger')
        .select('*')
        .eq('restaurant_id', entry.restaurant_id)
        .eq('order_id', entry.order_id)
        .eq('type', entry.type)
        .single();
      return { isDuplicate: true, entry: existing };
    }
  }

  const fullEntry = {
    id: entry.id || `led_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    restaurant_id: entry.restaurant_id,
    member_id: entry.member_id,
    order_id: entry.order_id || null,
    type: entry.type,
    points: entry.points,
    remaining: entry.remaining !== undefined ? entry.remaining : (entry.points > 0 ? entry.points : 0),
    expires_at: entry.expires_at || null,
    meta: entry.meta || {},
    created_at: entry.created_at || new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('loyalty_ledger')
    .insert(fullEntry)
    .select()
    .single();

  if (error) throw error;

  // Invalidate member cache
  await delCache('member', `${entry.restaurant_id}:${entry.member_id}`);
  return { isDuplicate: false, entry: data };
}

export async function decrementEntryRemaining(entryId, amountToDeduct) {
  if (!supabaseAdmin) return;
  const { data: entry } = await supabaseAdmin
    .from('loyalty_ledger')
    .select('remaining')
    .eq('id', entryId)
    .single();

  if (entry && entry.remaining > 0) {
    const newRemaining = Math.max(0, entry.remaining - amountToDeduct);
    await supabaseAdmin
      .from('loyalty_ledger')
      .update({ remaining: newRemaining })
      .eq('id', entryId);
  }
}

// Multiplier rules
export async function getMultiplierRules(restaurantId = 'ten_yeezy_01') {
  if (!supabaseAdmin) return [];
  const { data } = await queryWithBreaker(() => supabaseAdmin
    .from('loyalty_multiplier_rules')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
  );
  return data || [];
}

export async function saveMultiplierRule(rule) {
  if (!supabaseAdmin) throw new Error('Supabase not configured');
  const { data, error } = await supabaseAdmin
    .from('loyalty_multiplier_rules')
    .upsert({
      id: rule.id || `rule_${Date.now()}`,
      restaurant_id: rule.restaurant_id || 'ten_yeezy_01',
      is_active: true,
      ...rule
    }, { onConflict: 'restaurant_id,id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Referrals
export async function createReferral(restaurantId, referrerMemberId, refereeMemberId) {
  if (!supabaseAdmin) throw new Error('Supabase not configured');
  if (referrerMemberId === refereeMemberId) {
    throw new Error('Self-referrals are not permitted');
  }

  const { data: existing } = await supabaseAdmin
    .from('loyalty_referrals')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('referee_member_id', refereeMemberId)
    .maybeSingle();

  if (existing) return existing;

  const { data: referral, error } = await supabaseAdmin
    .from('loyalty_referrals')
    .insert({
      restaurant_id: restaurantId,
      referrer_member_id: referrerMemberId,
      referee_member_id: refereeMemberId,
      referral_code: `REF-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;

  // Update referee with referrer
  await supabaseAdmin
    .from('loyalty_members')
    .update({ referred_by_member_id: referrerMemberId })
    .eq('id', refereeMemberId);

  return referral;
}

export async function getReferralsForReferrer(restaurantId, referrerMemberId) {
  if (!supabaseAdmin) return [];
  const { data } = await queryWithBreaker(() => supabaseAdmin
    .from('loyalty_referrals')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('referrer_member_id', referrerMemberId)
  );
  return data || [];
}

export async function getQualifiedReferralsThisMonth(restaurantId, referrerMemberId) {
  if (!supabaseAdmin) return 0;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from('loyalty_referrals')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('referrer_member_id', referrerMemberId)
    .eq('status', 'qualified')
    .gte('created_at', startOfMonth.toISOString());
  return count || 0;
}

// Campaign log
export async function logCampaign(restaurantId, memberId, type, channel = 'WHATSAPP', convertedOrderId = null) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from('loyalty_campaign_log')
    .insert({
      restaurant_id: restaurantId,
      member_id: memberId,
      type,
      sent_at: new Date().toISOString(),
      channel,
      converted_order_id: convertedOrderId
    })
    .select()
    .single();
  if (error) console.warn('[Campaign Log]', error.message);
  return data;
}

export async function getLastCampaignForMember(restaurantId, memberId) {
  if (!supabaseAdmin) return null;
  const { data } = await queryWithBreaker(() => supabaseAdmin
    .from('loyalty_campaign_log')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('member_id', memberId)
    .order('sent_at', { ascending: false })
    .limit(1)
  );
  return data?.[0] || null;
}

// Expiry runner
export async function expireOldPoints(restaurantId = 'ten_yeezy_01', now = new Date()) {
  if (!supabaseAdmin) return [];
  const { data } = await rpcWithBreaker('fn_expire_points', {
    p_restaurant_id: restaurantId,
    p_now: now.toISOString()
  });
  return data || [];
}

// Auth operations (direct Supabase)
export async function authenticateUser(identifier, password) {
  if (!supabaseAdmin) return null;

  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  // Try to find user in Supabase
  const { data: users } = await supabaseAdmin
    .from('tenant_users')
    .select('*, tenants(*)')
    .or(`email.ilike.${cleanId},full_name.ilike.${cleanId}`);

  if (!users || users.length === 0) return null;

  for (const su of users) {
    const matchesSb = su.password_hash && bcrypt.compareSync(cleanPass, su.password_hash);

    if (matchesSb) {
      const linkedTenantId = su.tenants?.code || su.tenant_id;
      const updatedHash = bcrypt.hashSync(cleanPass, 10);

      // Update password hash in Supabase if needed
      if (su.password_hash !== updatedHash) {
        await supabaseAdmin
          .from('tenant_users')
          .update({ password_hash: updatedHash, updated_at: new Date().toISOString() })
          .eq('id', su.id);
      }

      // Get tenant info
      let tenant = null;
      if (linkedTenantId) {
        const { data: t } = await supabaseAdmin
          .from('tenants')
          .select('*')
          .or(`id.eq.${linkedTenantId},code.eq.${linkedTenantId}`)
          .single();
        tenant = t;
      }

      if (tenant && (tenant.active === false || tenant.status === 'INACTIVE' || tenant.status === 'SUSPENDED')) {
        const err = new Error(`Restaurant '${tenant.name}' has been temporarily deactivated by Super Admin. Please contact platform support.`);
        err.code = 'RESTAURANT_INACTIVE';
        throw err;
      }

      const assignedOutlets = tenant ? await getOutletsForTenant(tenant.id) : [];

      return {
        user: {
          id: su.id,
          name: su.full_name || 'Restaurant Owner',
          email: su.email,
          role: su.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'RESTAURANT_OWNER',
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(su.full_name || 'User')}`,
          tenantId: tenant?.id || linkedTenantId,
          tenantName: tenant?.name || 'Yeezy Global Admin',
          primaryRestID: tenant?.primaryRestID || (assignedOutlets[0]?.restID || 'PP_DEL_101'),
          assignedOutlets
        },
        tenant
      };
    }
  }
  return null;
}

async function getOutletsForTenant(tenantId) {
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('outlets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true);
  return data || [];
}

export async function createRestaurantTenant({ brandName, ownerName, ownerEmail, password, primaryOutletName, petpoojaRestID }) {
  if (!supabaseAdmin) throw new Error('Supabase not configured');
  if (!brandName || !ownerName || !ownerEmail) {
    throw new Error('brandName, ownerName, and ownerEmail are required');
  }
  if (!password || password.trim().length < 8) {
    throw new Error('Password is required and must be at least 8 characters');
  }

  const cleanEmail = ownerEmail.trim().toLowerCase();

  // Check if exists
  const { data: existingTenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('owner_email', cleanEmail)
    .maybeSingle();

  if (existingTenant) {
    // Update existing
    const tenantSlug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15) || 'rest';
    const restId = petpoojaRestID ? petpoojaRestID.trim().toUpperCase() : `PP_${tenantSlug.slice(0, 4).toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`;

    await supabaseAdmin
      .from('tenants')
      .update({
        name: brandName.trim(),
        owner_name: ownerName.trim(),
        primary_rest_id: restId,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingTenant.id);

    await supabaseAdmin
      .from('tenant_users')
      .update({
        full_name: ownerName.trim(),
        password_hash: bcrypt.hashSync(password.trim(), 10)
      })
      .eq('email', cleanEmail);

    return { tenant: existingTenant, user: { email: cleanEmail }, outlet: null };
  }

  // Create new tenant
  const tenantSlug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15) || 'rest';
  const tenantId = `ten_${tenantSlug}_${Date.now().toString(36)}`;
  const restId = petpoojaRestID ? petpoojaRestID.trim().toUpperCase() : `PP_${tenantSlug.slice(0, 4).toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`;

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .insert({
      id: tenantId,
      code: tenantId,
      name: brandName.trim(),
      owner_name: ownerName.trim(),
      owner_email: cleanEmail,
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
      primary_rest_id: restId
    })
    .select()
    .single();

  const { data: user } = await supabaseAdmin
    .from('tenant_users')
    .insert({
      tenant_id: tenant.id,
      full_name: ownerName.trim(),
      email: cleanEmail,
      password_hash: bcrypt.hashSync(password.trim(), 10),
      role: 'RESTAURANT_OWNER'
    })
    .select()
    .single();

  const { data: outlet } = await supabaseAdmin
    .from('outlets')
    .insert({
      id: `out_${Date.now().toString(36)}`,
      tenant_id: tenant.id,
      rest_id: restId,
      name: primaryOutletName ? primaryOutletName.trim() : `${brandName.trim()} Main Outlet`,
      address: 'Kerala, India',
      active: true,
      app_key: `sec_live_${crypto.randomUUID().slice(0, 10)}`,
      pos_system: 'PETPOOJA'
    })
    .select()
    .single();

  // Initialize default loyalty program
  await supabaseAdmin
    .from('loyalty_programs')
    .insert({
      restaurant_id: tenant.id,
      config: DEFAULT_LOYALTY_CONFIG,
      is_active: true
    });

  return { tenant, user, outlet };
}

export async function setTenantStatus(tenantId, newStatus) {
  if (!supabaseAdmin) return null;
  const isValidStatus = ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(newStatus);
  const finalStatus = isValidStatus ? newStatus : 'INACTIVE';

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .update({
      status: finalStatus,
      active: finalStatus === 'ACTIVE',
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId)
    .select()
    .single();

  if (tenant) {
    await supabaseAdmin
      .from('outlets')
      .update({ active: finalStatus === 'ACTIVE' })
      .eq('tenant_id', tenantId);
  }
  return tenant;
}

export async function deleteTenant(tenantId) {
  if (!supabaseAdmin) return false;
  // Delete in order: outlets, tenant_users, loyalty data, tenant
  await supabaseAdmin.from('outlets').delete().eq('tenant_id', tenantId);
  await supabaseAdmin.from('tenant_users').delete().eq('tenant_id', tenantId);
  await supabaseAdmin.from('loyalty_programs').delete().eq('restaurant_id', tenantId);
  await supabaseAdmin.from('loyalty_members').delete().eq('restaurant_id', tenantId);
  await supabaseAdmin.from('loyalty_ledger').delete().eq('restaurant_id', tenantId);
  await supabaseAdmin.from('loyalty_referrals').delete().eq('restaurant_id', tenantId);
  await supabaseAdmin.from('loyalty_multiplier_rules').delete().eq('restaurant_id', tenantId);
  await supabaseAdmin.from('loyalty_campaign_log').delete().eq('restaurant_id', tenantId);
  await supabaseAdmin.from('tenants').delete().eq('id', tenantId);
  return true;
}

export async function syncWithSupabase() {
  // This is now handled by direct Supabase queries
  return true;
}

// Backward compatibility for apiKeyAuth fallback
const PILOT_TENANTS = [
  { id: 'ten_yeezy_01', name: 'Yeezy Loyalty', apiKey: 'lk_live_6b6f34465f168ee1d824915e5c0cb1c7cf1224b998eba8f1005e6e0d6fd9b194' },
  { id: 'ten_smokehouse_02', name: 'Smokehouse', apiKey: 'lk_live_730ba5b943263d58c363b5605a9ffc3bdbfa739274e9e6ba58d4c872ce4eabbb' },
  { id: 'ten_durbar_mvnrq6po', name: 'Durbar Cafe', apiKey: 'lk_live_c511_durbar_cafe_live_pos_key_2026_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d' },
  { id: 'ten_durbar_mvsfe21f', name: 'Durbar Cafe', apiKey: 'lk_live_tendurbarmvsfe21f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d' },
  { id: 'ten_farzi_mvnvc99o', name: 'Farzi Cafe', apiKey: 'lk_live_0049_farzi_cafe_pos_key_2026_9bca1234567890abcdef1234567890abcdef' }
];

export const posStore = {
  data: {
    tenants: PILOT_TENANTS
  }
};

export const store = {
  initStore,
  createSession,
  getSession,
  destroySession,
  refreshSession,
  checkRateLimit,
  acquireLock,
  getCache,
  setCache,
  delCache,
  checkIdempotency,
  getOrCreateLoyaltyMember,
  getLoyaltyMemberById,
  updateMemberTier,
  getMemberBalance,
  getActiveEarnEntries,
  appendLoyaltyLedgerEntry,
  decrementEntryRemaining,
  getMultiplierRules,
  saveMultiplierRule,
  createReferral,
  getReferralsForReferrer,
  getQualifiedReferralsThisMonth,
  logCampaign,
  getLastCampaignForMember,
  expireOldPoints,
  authenticateUser,
  createRestaurantTenant,
  setTenantStatus,
  deleteTenant,
  syncWithSupabase,
};

export default store;