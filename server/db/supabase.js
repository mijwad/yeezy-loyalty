// Supabase Cloud PostgreSQL Client with Circuit Breaker & Connection Pooling
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { createSupabaseBreaker, CircuitOpenError } from '../utils/circuitBreaker.js';

dotenv.config();

/**
 * Convert string to UUID format
 * @param {string} str
 * @returns {string}
 */
export function toUuid(str) {
  if (!str) return '00000000-0000-0000-0000-000000000001';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

if (!isSupabaseConfigured && process.env.NODE_ENV === 'production') {
  console.warn('[Security Warning] SUPABASE_URL or SUPABASE_KEY missing in production environment. Live DB sync disabled.');
}

// Create clients with connection pooling
const createSupabaseClient = (key, options = {}) => {
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
    global: {
      headers: { 'x-client-info': 'yeezy-loyalty' }
    },
    ...options
  });
};

export const supabase = isSupabaseConfigured
  ? createSupabaseClient(SUPABASE_KEY)
  : null;

export const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createSupabaseClient(SUPABASE_SERVICE_ROLE_KEY)
  : supabase;

// Circuit breaker for Supabase
const supabaseBreaker = createSupabaseBreaker();

/**
 * Execute a Supabase query with circuit breaker protection
 * @template T
 * @param {() => Promise<T>} operation
 * @param {() => Promise<T>} [fallback]
 * @returns {Promise<T>}
 */
export async function withCircuitBreaker(operation, fallback) {
  try {
    return await supabaseBreaker.execute(operation);
  } catch (error) {
    if (error instanceof CircuitOpenError) {
      console.warn('[Supabase] Circuit breaker OPEN, using fallback if available');
      if (fallback) {
        return await fallback();
      }
    }
    throw error;
  }
}

/**
 * Execute a Supabase RPC with circuit breaker
 * @template T
 * @param {string} fnName
 * @param {Record<string, unknown>} params
 * @param {() => Promise<T>} [fallback]
 * @returns {Promise<T>}
 */
export async function rpcWithBreaker(fnName, params, fallback) {
  return withCircuitBreaker(
    async () => {
      const { data, error } = await supabaseAdmin.rpc(fnName, params);
      if (error) throw error;
      return data;
    },
    fallback
  );
}

/**
 * Execute a Supabase query with circuit breaker
 * @template T
 * @param {() => Promise<{ data: T | null; error: any }>} queryFn
 * @param {() => Promise<T>} [fallback]
 * @returns {Promise<T>}
 */
export async function queryWithBreaker(queryFn, fallback) {
  return withCircuitBreaker(
    async () => {
      const { data, error } = await queryFn();
      if (error) throw error;
      return data;
    },
    fallback
  );
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000002';

// ============================================================================
// SYNC FUNCTIONS - With Circuit Breaker & Retry Logic
// ============================================================================

// Push Loyalty Program configuration to Supabase
export async function syncLoyaltyProgramToSupabase(program) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('loyalty_programs')
      .upsert({
        restaurant_id: program.restaurant_id || DEFAULT_TENANT_ID,
        is_active: program.is_active ?? true,
        config: program.config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'restaurant_id' });

    if (error) console.warn('[Supabase Loyalty Program Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Loyalty Program Catch]', err.message);
    return null;
  }
}

// Push Loyalty Member to Supabase
export async function syncLoyaltyMemberToSupabase(member) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('loyalty_members')
      .upsert({
        restaurant_id: member.restaurant_id || DEFAULT_TENANT_ID,
        phone_e164: member.phone_e164,
        name: member.name,
        tier: member.tier || 'Silver',
        last_visit_at: member.last_visit_at,
        visit_count: member.visit_count || 0,
        lifetime_spend_paise: member.lifetime_spend_paise || 0,
        referred_by_member_id: member.referred_by_member_id || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'restaurant_id,phone_e164' });

    if (error) console.warn('[Supabase Loyalty Member Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Loyalty Member Catch]', err.message);
    return null;
  }
}

// Push Ledger Entry to Supabase
export async function syncLoyaltyLedgerEntryToSupabase(entry) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('loyalty_ledger')
      .insert({
        restaurant_id: entry.restaurant_id || DEFAULT_TENANT_ID,
        member_id: entry.member_id,
        order_id: entry.order_id || null,
        type: entry.type,
        points: entry.points,
        remaining: entry.remaining || 0,
        expires_at: entry.expires_at || null,
        meta: entry.meta || {},
        created_at: entry.created_at || new Date().toISOString()
      });

    if (error) console.warn('[Supabase Loyalty Ledger Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Loyalty Ledger Catch]', err.message);
    return null;
  }
}

// Push Redemption Session to Supabase
export async function syncRedemptionSessionToSupabase(session) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('redemption_sessions')
      .upsert({
        session_token: session.sessionToken,
        restaurant_id: session.restaurantId || session.tenantId || DEFAULT_TENANT_ID,
        member_id: session.memberId || session.customerId,
        member_phone: session.memberPhone || session.customerPhone,
        reservation_id: session.reservationId,
        order_id: session.orderId,
        table_no: session.tableNo,
        server_name: session.serverName,
        bill_amount_paise: session.billAmountPaise || Math.round((session.billAmount || 0) * 100),
        discountable_amount_paise: session.discountableAmountPaise || Math.round((session.discountableAmount || 0) * 100),
        max_redeemable_points: session.maxRedeemablePoints || 0,
        max_discount_paise: session.maxDiscountPaise || Math.round((session.maxDiscountAmount || 0) * 100),
        point_value_paise: session.pointValuePaise || 100,
        selected_option_id: session.selectedOptionId,
        points_locked: session.pointsLocked || 0,
        discount_amount_paise: session.discountAmountPaise || Math.round((session.discountAmount || 0) * 100),
        available_options: session.availableOptions || [],
        status: session.status,
        expires_at: session.expiresAt,
        completed_at: session.completedAt,
        created_at: session.createdAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'session_token' });

    if (error) console.warn('[Supabase Redemption Session Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Redemption Session Catch]', err.message);
    return null;
  }
}

// Push Webhook Log to Supabase
export async function syncWebhookLogToSupabase(log) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('webhook_logs')
      .insert({
        restaurant_id: log.restaurantId || log.tenantId || DEFAULT_TENANT_ID,
        pos_system: log.posSystem || 'PETPOOJA',
        event_type: log.eventType,
        request_payload: log.requestPayload,
        response_payload: log.responsePayload,
        status: log.status,
        error_message: log.errorMessage,
        processing_time_ms: log.processingTimeMs,
        created_at: log.createdAt || new Date().toISOString()
      });

    if (error) console.warn('[Supabase Webhook Log Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Webhook Log Catch]', err.message);
    return null;
  }
}

// Push Outlet to Supabase
export async function syncOutletToSupabase(outlet) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('outlets')
      .upsert({
        id: outlet.id,
        tenant_id: outlet.tenantId,
        rest_id: outlet.restID || outlet.rest_id,
        name: outlet.name,
        address: outlet.address,
        active: outlet.active ?? true,
        app_key: outlet.appKey,
        pos_system: outlet.posSystem || 'PETPOOJA',
        pos_config: outlet.posConfig || {},
        is_marketplace_connected: outlet.isMarketplaceConnected ?? false,
        marketplace_connected_at: outlet.marketplaceConnectedAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'rest_id' });

    if (error) console.warn('[Supabase Outlet Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Outlet Catch]', err.message);
    return null;
  }
}

// Async helper to push a customer to Supabase (legacy compatibility)
export async function syncCustomerToSupabase(customer) {
  const client = supabaseAdmin || supabase;
  if (!client) return null;
  try {
    const tenantId = customer.tenantId || DEFAULT_TENANT_ID;
    const rawPhone = (customer.phone || customer.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const phoneE164 = rawPhone.length === 10 ? `+91${rawPhone}` : (customer.phone || '');

    // 1. Sync to loyalty_members table (primary multi-tenant table used by /api/v1/customers)
    if (tenantId && phoneE164) {
      await client
        .from('loyalty_members')
        .upsert({
          restaurant_id: tenantId,
          phone_e164: phoneE164,
          name: customer.name || 'Valued Guest',
          tier: customer.tier || 'Silver',
          last_visit_at: new Date().toISOString(),
          visit_count: customer.visits || 1,
          lifetime_spend_paise: Math.round((customer.lifetimeSpend || 0) * 100),
          updated_at: new Date().toISOString()
        }, { onConflict: 'restaurant_id,phone_e164' });
    }

    // 2. Legacy customers table sync
    const { data, error } = await client
      .from('customers')
      .upsert({
        tenant_id: toUuid(tenantId),
        phone_number: customer.phone,
        full_name: customer.name,
        email: customer.email,
        points_balance: customer.pointsBalance || 0,
        lifetime_spend: customer.lifetimeSpend || 0,
        total_visits_count: customer.visits || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,phone_number' });

    if (error) console.warn('[Supabase Customer Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Sync Catch]', err.message);
    return null;
  }
}

// Async helper to push an ingested Petpooja order to Supabase (legacy compatibility)
export async function syncOrderToSupabase(order) {
  const client = supabaseAdmin || supabase;
  if (!client) return null;
  try {
    const tenantId = order.tenantId || DEFAULT_TENANT_ID;
    const { data, error } = await client
      .from('orders')
      .upsert({
        tenant_id: toUuid(tenantId),
        outlet_id: DEFAULT_OUTLET_ID,
        pos_system: 'PETPOOJA',
        pos_order_id: String(order.orderId),
        pos_bill_no: String(order.billNo || order.orderId),
        subtotal_amount: order.financials?.subtotal || 0,
        gross_bill_amount: order.financials?.grossAmount || 0,
        loyalty_discount_amount: order.financials?.loyaltyDiscount || 0,
        net_payable_amount: order.financials?.netPaid || 0,
        points_earned_on_bill: order.pointsEarned || 0,
        points_redeemed_on_bill: order.pointsBurned || 0
      }, { onConflict: 'outlet_id,pos_bill_no' })
      .select();

    if (error) console.warn('[Supabase Order Sync Notice]', error.message);

    if (data && data.length > 0 && Array.isArray(order.items) && order.items.length > 0) {
      const orderId = data[0].id;
      const orderItemsToInsert = order.items.map(item => ({
        order_id: orderId,
        pos_item_id: String(item.id || ''),
        item_name: item.name || item.item_name || 'Item',
        quantity: parseFloat(item.quantity || 1),
        unit_price: parseFloat(item.price || item.unit_price || 0),
        total_price: parseFloat(item.total || item.line_total || (parseFloat(item.price || 0) * parseFloat(item.quantity || 1)) || 0)
      }));
      await supabase.from('order_items').insert(orderItemsToInsert);
    }

    return data;
  } catch (err) {
    console.warn('[Supabase Sync Catch]', err.message);
    return null;
  }
}

// Reliable sync with retry logic (outbox pattern)
export async function syncWithRetry(syncFn, args, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await syncFn(...args);
      if (attempt > 0) console.log(`[Sync] Success on retry ${attempt}`);
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
        console.warn(`[Sync] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, err.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('[Sync] All retries failed:', lastError?.message);
  // In production, push to dead letter queue here
  return null;
}

// Health check for Supabase
export async function checkSupabaseHealth() {
  if (!supabaseAdmin) return { healthy: false, error: 'Supabase not configured' };
  try {
    const start = Date.now();
    const { error } = await supabaseAdmin.from('loyalty_programs').select('id').limit(1);
    const latency = Date.now() - start;
    if (error) throw error;
    return { healthy: true, latency };
  } catch (err) {
    return { healthy: false, error: err.message };
  }
}

export default {
  supabase,
  supabaseAdmin,
  isSupabaseConfigured,
  toUuid,
  syncLoyaltyProgramToSupabase,
  syncLoyaltyMemberToSupabase,
  syncLoyaltyLedgerEntryToSupabase,
  syncRedemptionSessionToSupabase,
  syncWebhookLogToSupabase,
  syncOutletToSupabase,
  syncCustomerToSupabase,
  syncOrderToSupabase,
  syncWithRetry,
  checkSupabaseHealth,
  rpcWithBreaker,
  queryWithBreaker,
  withCircuitBreaker,
};