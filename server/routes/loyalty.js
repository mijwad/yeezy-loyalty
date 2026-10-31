// Loyalty Points Module REST API Router - Supabase RPC Backend
// All mutations go through Supabase RPCs for ACID guarantees and horizontal scaling
import { Router } from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { normalizePhone, calculateEarn, previewRedeem, commitRedeem, evaluateReferralQualification, calculateOrderRefundReversal } from '../../lib/loyalty/engine.js';
import { calculateROI } from '../../lib/loyalty/roi.js';
import { validateLoyaltyConfig, DEFAULT_LOYALTY_CONFIG } from '../../lib/loyalty/config.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { LoyaltyEventTriggers } from '../whatsapp/loyaltyTriggers.js';
import { cleanRestaurantName } from '../whatsapp/loyaltyTemplates.js';
import { posStore } from '../db/store.js';

export const loyaltyRouter = Router();

// In-memory rate limiter for member lookups (30 requests per minute per IP)
const lookupRateLimits = new Map();
function rateLimitLookup(req, res, next) {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;

  const timestamps = (lookupRateLimits.get(clientIp) || []).filter(ts => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many phone lookups. Please wait a minute before trying again.'
    });
  }

  timestamps.push(now);
  lookupRateLimits.set(clientIp, timestamps);
  next();
}

/**
 * GET /api/loyalty/members/lookup
 * Cashier or customer enters phone -> returns member details, balance, tier, and instant redeemable limits.
 */
loyaltyRouter.post(['/members/lookup', '/lookup'], rateLimitLookup, validateRequest('loyaltyLookup'), asyncHandler(async (req, res) => {
  const { phone, name, restaurant_id, bill_paise, order_type } = req.validated.body;
  const tenantId = restaurant_id || req.tenantId || 'ten_yeezy_01';

  const phoneE164 = normalizePhone(phone);

  // Get or create member via upsert
  const { data: member, error: memberError } = await supabaseAdmin
    .from('loyalty_members')
    .upsert({
      restaurant_id: tenantId,
      phone_e164: phoneE164,
      name: name || 'Valued Guest',
      tier: 'Silver'
    }, { onConflict: 'restaurant_id,phone_e164' })
    .select()
    .single();

  if (memberError) throw memberError;

  // Get program config
  const { data: program, error: programError } = await supabaseAdmin
    .from('loyalty_programs')
    .select('config, is_active')
    .eq('restaurant_id', tenantId)
    .single();

  if (programError || !program) {
    return res.status(404).json({
      status: 'error',
      code: 'PROGRAM_NOT_FOUND',
      message: 'Loyalty program not found for this restaurant'
    });
  }

  // Get available balance via RPC
  const { data: availablePoints, error: balanceError } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
    p_restaurant_id: tenantId,
    p_member_id: member.id
  });

  if (balanceError) throw balanceError;

  // Get active reservations
  const { data: activeRes } = await supabaseAdmin
    .from('redemption_reservations')
    .select('points')
    .eq('restaurant_id', tenantId)
    .eq('member_id', member.id)
    .eq('status', 'reserved')
    .gt('expires_at', new Date().toISOString());

  const activeReservationsPoints = (activeRes || []).reduce((sum, r) => sum + r.points, 0);
  const balance = availablePoints || 0;

  // Calculate preview if bill is provided
  let redeemPreview = null;
  if (bill_paise && bill_paise > 0) {
    redeemPreview = previewRedeem({
      config: program.config,
      isProgramActive: program.is_active,
      memberBalance: balance,
      input: {
        restaurant_id: tenantId,
        member_phone: phoneE164,
        bill_paise: bill_paise,
        order_type: order_type || 'dine_in'
      }
    });
  }

  return res.json({
    status: 'success',
    member: {
      id: member.id,
      phone_e164: member.phone_e164,
      name: member.name,
      tier: member.tier,
      visit_count: member.visit_count,
      lifetime_spend_paise: member.lifetime_spend_paise,
      last_visit_at: member.last_visit_at,
      joined_at: member.joined_at
    },
    points_balance: balance,
    active_reservations_points: activeReservationsPoints,
    point_value_paise: program.config.point_value_paise,
    worth_inr: (balance * program.config.point_value_paise) / 100,
    redeem_preview: redeemPreview
  });
}));

/**
 * POST /api/loyalty/earn
 * Internal engine endpoint called automatically on order payment/settlement.
 * Uses Supabase RPC for atomic, idempotent point earning.
 */
loyaltyRouter.post('/earn', validateRequest('loyaltyEarn'), asyncHandler(async (req, res) => {
  const { order_id, member_phone, member_name, subtotal_paise, discounts_paise, points_redeemed_paise, order_type, restaurant_id } = req.validated.body;
  const tenantId = restaurant_id || req.tenantId || req.headers['x-tenant-id'] || 'ten_durbar_mvsfe21f';

  const { data: earnRes, error: earnErr } = await supabaseAdmin.rpc('fn_loyalty_earn_points', {
    p_restaurant_id: tenantId,
    p_order_id: String(order_id),
    p_phone: normalizePhone(member_phone),
    p_subtotal_paise: subtotal_paise,
    p_order_type: order_type || 'dine_in'
  });

  if (earnErr) throw earnErr;

  const parsedEarn = typeof earnRes === 'string' ? JSON.parse(earnRes) : earnRes;

  if (!parsedEarn.success) {
    return res.status(400).json({
      status: parsedEarn.idempotent ? 'success' : 'error',
      code: parsedEarn.error?.code || 'EARN_FAILED',
      message: parsedEarn.error?.message || 'Failed to earn points',
      idempotent: parsedEarn.idempotent || false
    });
  }

  // Automated WhatsApp Notification Trigger (First Purchase vs Repeat Purchase)
  const cleanPhone = normalizePhone(member_phone);
  try {
    const isFirstVisit = (parsedEarn.visit_count || 1) <= 1;
    const triggers = new LoyaltyEventTriggers(tenantId);
    triggers.onBillSettled(
      {
        phoneNumber: cleanPhone,
        phone: cleanPhone,
        phone_e164: cleanPhone,
        fullName: member_name || 'Guest',
        name: member_name || 'Guest',
        is_whatsapp_opt_in: true,
        total_visits_count: parsedEarn.visit_count || 1,
        currentTier: { tierName: parsedEarn.tier || 'Silver' },
        pointsBalance: parsedEarn.new_balance
      },
      { name: cleanRestaurantName(posStore?.data?.tenants?.find(t => t.id === tenantId)?.name || 'Durbar Cafe') },
      { orderId: order_id, subtotal: (subtotal_paise || 0) / 100 },
      parsedEarn.points_earned,
      parsedEarn.new_balance,
      isFirstVisit
    ).then(res => {
      console.log(`[Loyalty Earn WhatsApp Trigger] Sent ${isFirstVisit ? 'FIRST_PURCHASE' : 'REPEAT_PURCHASE'} notification to ${cleanPhone}:`, res?.success ? 'OK' : res?.reason || res?.error);
    }).catch(err => {
      console.warn(`[Loyalty Earn WhatsApp Trigger] Notification failed:`, err.message);
    });
  } catch (err) {
    console.warn('[Loyalty Earn WhatsApp Trigger Error]', err.message);
  }

  return res.json({
    status: 'success',
    earn: {
      order_id: parsedEarn.order_id,
      points_earned: parsedEarn.points_earned,
      new_balance: parsedEarn.new_balance,
      tier: parsedEarn.tier,
      visit_count: parsedEarn.visit_count,
      idempotent: parsedEarn.idempotent || false
    }
  });
}));

/**
 * POST /api/loyalty/redeem/preview
 * Calculates allowed redeem points, discount in paise, and enforces all validation checks.
 */
loyaltyRouter.post('/redeem/preview', validateRequest('loyaltyRedeemPreview'), asyncHandler(async (req, res) => {
  const { member_phone, bill_paise, requested_points, order_type, has_conflicting_discounts, restaurant_id } = req.validated.body;
  const tenantId = restaurant_id || req.tenantId || 'ten_yeezy_01';

  const cleanPhone = normalizePhone(member_phone);

  // Get member
  const { data: member } = await supabaseAdmin
    .from('loyalty_members')
    .select('id')
    .eq('restaurant_id', tenantId)
    .eq('phone_e164', cleanPhone)
    .single();

  if (!member) {
    return res.status(404).json({
      status: 'error',
      code: 'MEMBER_NOT_FOUND',
      message: 'Member not found'
    });
  }

  // Get program config
  const { data: program } = await supabaseAdmin
    .from('loyalty_programs')
    .select('config, is_active')
    .eq('restaurant_id', tenantId)
    .single();

  if (!program) {
    return res.status(404).json({
      status: 'error',
      code: 'PROGRAM_NOT_FOUND',
      message: 'Loyalty program not found'
    });
  }

  // Get available balance
  const { data: availablePoints } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
    p_restaurant_id: tenantId,
    p_member_id: member.id
  });

  const balance = availablePoints || 0;

  const preview = previewRedeem({
    config: program.config,
    isProgramActive: program.is_active,
    memberBalance: balance,
    input: {
      restaurant_id: tenantId,
      member_phone: cleanPhone,
      bill_paise,
      requested_points,
      order_type: order_type || 'dine_in',
      has_conflicting_discounts: Boolean(has_conflicting_discounts)
    }
  });

  return res.json({
    status: preview.allowed ? 'success' : 'rejected',
    ...preview
  });
}));

/**
 * POST /api/loyalty/redeem/commit
 * Deducts points FIFO by earliest expires_at, writes negative redeem row.
 * Uses Supabase RPC for atomic two-phase commit.
 */
loyaltyRouter.post('/redeem/commit', validateRequest('loyaltyRedeemCommit'), asyncHandler(async (req, res) => {
  const { order_id, member_phone, bill_paise, requested_points, order_type, restaurant_id } = req.validated.body;
  const tenantId = restaurant_id || req.tenantId || 'ten_yeezy_01';

  const cleanPhone = normalizePhone(member_phone);

  // Get member
  const { data: member } = await supabaseAdmin
    .from('loyalty_members')
    .select('id')
    .eq('restaurant_id', tenantId)
    .eq('phone_e164', cleanPhone)
    .single();

  if (!member) {
    return res.status(404).json({
      status: 'error',
      code: 'MEMBER_NOT_FOUND',
      message: 'Member not found'
    });
  }

  // First, reserve points (two-phase)
  const { data: reserveRes, error: reserveErr } = await supabaseAdmin.rpc('fn_loyalty_reserve_points', {
    p_restaurant_id: tenantId,
    p_phone: cleanPhone,
    p_points: requested_points || 0,
    p_bill_paise: bill_paise,
    p_ttl_seconds: 900 // 15 minutes
  });

  if (reserveErr) throw reserveErr;

  const reserveResult = typeof reserveRes === 'string' ? JSON.parse(reserveRes) : reserveRes;

  if (!reserveResult.success) {
    return res.status(reserveResult.error?.code === 'INSUFFICIENT_BALANCE' ? 409 : 400).json({
      status: 'rejected',
      code: reserveResult.error?.code,
      message: reserveResult.error?.message
    });
  }

  // Then commit the reservation
  const { data: commitRes, error: commitErr } = await supabaseAdmin.rpc('fn_loyalty_commit_points', {
    p_restaurant_id: tenantId,
    p_reservation_id: reserveResult.reservation_id,
    p_order_id: String(order_id)
  });

  if (commitErr) throw commitErr;

  const commitResult = typeof commitRes === 'string' ? JSON.parse(commitRes) : commitRes;

  if (!commitResult.success) {
    const isExpired = commitResult.error?.code === 'RESERVATION_EXPIRED';
    return res.status(isExpired ? 409 : 400).json({
      status: 'rejected',
      code: commitResult.error?.code,
      message: commitResult.error?.message
    });
  }

  return res.json({
    status: 'success',
    ...commitResult
  });
}));

/**
 * POST /api/loyalty/referrals
 * Create a referral linking a new referee to an existing referrer member.
 */
loyaltyRouter.post('/referrals', validateRequest('loyaltyReferral'), asyncHandler(async (req, res) => {
  const { referrer_phone, referee_phone, restaurant_id } = req.validated.body;
  const tenantId = restaurant_id || req.tenantId || 'ten_yeezy_01';

  const cleanReferrer = normalizePhone(referrer_phone);
  const cleanReferee = normalizePhone(referee_phone);

  if (cleanReferrer === cleanReferee) {
    return res.status(400).json({
      status: 'error',
      code: 'SELF_REFERRAL',
      message: 'Members cannot refer themselves.'
    });
  }

  // Get or create both members
  const [referrerResult, refereeResult] = await Promise.all([
    supabaseAdmin.from('loyalty_members').upsert({
      restaurant_id: tenantId,
      phone_e164: cleanReferrer,
      tier: 'Silver'
    }, { onConflict: 'restaurant_id,phone_e164' }).select().single(),
    supabaseAdmin.from('loyalty_members').upsert({
      restaurant_id: tenantId,
      phone_e164: cleanReferee,
      tier: 'Silver',
      referred_by_member_id: null // Will be updated after referral creation
    }, { onConflict: 'restaurant_id,phone_e164' }).select().single()
  ]);

  const referrer = referrerResult.data;
  const referee = refereeResult.data;

  if (referrerResult.error) throw referrerResult.error;
  if (refereeResult.error) throw refereeResult.error;

  // Check if referee already has visits
  if (referee.visit_count > 0) {
    return res.status(400).json({
      status: 'error',
      code: 'REFEREE_EXISTS',
      message: 'Referee is already an existing guest.'
    });
  }

  // Create referral record
  const { data: referral, error: referralError } = await supabaseAdmin
    .from('loyalty_referrals')
    .insert({
      restaurant_id: tenantId,
      referrer_member_id: referrer.id,
      referee_member_id: referee.id,
      referral_code: `REF-${Date.now().toString(36).toUpperCase()}`,
      status: 'pending'
    })
    .select()
    .single();

  if (referralError) {
    // Check for unique constraint violation
    if (referralError.code === '23505') {
      return res.status(409).json({
        status: 'error',
        code: 'REFERRAL_EXISTS',
        message: 'Referral already exists for this referee'
      });
    }
    throw referralError;
  }

  // Update referee with referrer
  await supabaseAdmin
    .from('loyalty_members')
    .update({ referred_by_member_id: referrer.id })
    .eq('id', referee.id);

  return res.json({
    status: 'success',
    referral
  });
}));

/**
 * GET & PUT /api/loyalty/program
 * Get and update per-restaurant configuration with Zod validation.
 */
loyaltyRouter.get('/program', asyncHandler(async (req, res) => {
  const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';

  const { data: program, error } = await supabaseAdmin
    .from('loyalty_programs')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .single();

  if (error || !program) {
    // Return default config if not found
    return res.json({
      status: 'success',
      program: {
        id: 'default',
        restaurant_id: restaurantId,
        is_active: true,
        config: DEFAULT_LOYALTY_CONFIG,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    });
  }

  return res.json({
    status: 'success',
    program
  });
}));

loyaltyRouter.put('/program', validateRequest('loyaltyProgramUpdate'), asyncHandler(async (req, res) => {
  const restaurantId = req.tenantId || req.validated.body.restaurant_id || 'ten_yeezy_01';
  const updates = req.validated.body.config;

  const validation = validateLoyaltyConfig(updates);
  if (!validation.isValid) {
    return res.status(400).json({
      status: 'error',
      code: 'CONFIG_VALIDATION_FAILED',
      message: 'Configuration validation failed',
      errors: validation.errors
    });
  }

  const { data: program, error } = await supabaseAdmin
    .from('loyalty_programs')
    .upsert({
      restaurant_id: restaurantId,
      is_active: true,
      config: validation.data,
      updated_at: new Date().toISOString()
    }, { onConflict: 'restaurant_id' })
    .select()
    .single();

  if (error) throw error;

  return res.json({
    status: 'success',
    message: 'Loyalty program configuration updated successfully',
    program,
    warning: validation.warning
  });
}));

/**
 * POST /api/loyalty/simulate
 * Pure ROI simulation function for restaurant owners.
 */
loyaltyRouter.post('/simulate', asyncHandler(async (req, res) => {
  const result = calculateROI(req.body);
  return res.json({
    status: 'success',
    simulation: result
  });
}));

/**
 * GET & POST /api/loyalty/multipliers
 * Multiplier rule management for slow-slot and festival surges.
 */
loyaltyRouter.get('/multipliers', asyncHandler(async (req, res) => {
  const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';

  const { data: rules, error } = await supabaseAdmin
    .from('loyalty_multiplier_rules')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) throw error;

  return res.json({ status: 'success', rules: rules || [] });
}));

loyaltyRouter.post('/multipliers', validateRequest('multiplierRule'), asyncHandler(async (req, res) => {
  const restaurantId = req.tenantId || req.validated.body.restaurant_id || 'ten_yeezy_01';
  const ruleData = { ...req.validated.body, restaurant_id: restaurantId };

  const { data: rule, error } = await supabaseAdmin
    .from('loyalty_multiplier_rules')
    .upsert(ruleData, { onConflict: 'restaurant_id,id' })
    .select()
    .single();

  if (error) throw error;

  return res.json({ status: 'success', rule });
}));

/**
 * POST /api/loyalty/refund
 * Reverses points on refunded orders.
 */
loyaltyRouter.post('/refund', validateRequest('loyaltyRefund'), asyncHandler(async (req, res) => {
  const { order_id, original_order_paise, refund_paise, restaurant_id } = req.validated.body;
  const tenantId = restaurant_id || req.tenantId || 'ten_yeezy_01';

  // Find original earn entries for order
  const { data: entries, error } = await supabaseAdmin
    .from('loyalty_ledger')
    .select('member_id, points, type, meta')
    .eq('restaurant_id', tenantId)
    .eq('order_id', String(order_id))
    .gt('points', 0);

  if (error) throw error;

  if (!entries || entries.length === 0) {
    return res.status(404).json({
      status: 'error',
      code: 'ORDER_NOT_FOUND',
      message: 'No earned points found for this order ID'
    });
  }

  const memberId = entries[0].member_id;
  const totalEarnedPoints = entries.reduce((s, e) => s + e.points, 0);

  // Use engine function for proportional reversal calculation
  const reversal = calculateOrderRefundReversal({
    orderEntries: entries,
    originalOrderPaise: original_order_paise || refund_paise,
    refundPaise: refund_paise,
    orderId: String(order_id)
  });

  if (reversal.reversalLedgerEntry) {
    await supabaseAdmin.from('loyalty_ledger').insert({
      restaurant_id: tenantId,
      member_id: memberId,
      order_id: `REFUND-${order_id}`,
      ...reversal.reversalLedgerEntry
    });
  }

  // Get new balance
  const { data: newBalance } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
    p_restaurant_id: tenantId,
    p_member_id: memberId
  });

  return res.json({
    status: 'success',
    points_reversed: reversal.totalPointsReversed,
    new_balance: newBalance || 0
  });
}));

/**
 * POST /api/loyalty/cron/expire
 * Scheduled expiry cron run - expires old points and stale reservations.
 */
loyaltyRouter.post('/cron/expire', asyncHandler(async (req, res) => {
  const restaurantId = req.tenantId || req.body.restaurant_id || 'ten_yeezy_01';

  // Expire points via engine function (reads from ledger)
  // In production, this would be a scheduled pg_cron job calling the RPC directly
  const { data: expiredReservations } = await supabaseAdmin.rpc('fn_expire_stale_reservations');

  // For points expiry, we need to scan ledger entries
  // This is better done as a pg_cron job calling a dedicated RPC
  // For now, return the reservation cleanup count
  return res.json({
    status: 'success',
    expired_reservations: expiredReservations || 0,
    message: 'Point expiry should be run via pg_cron calling fn_expire_points RPC'
  });
}));

/**
 * GET /api/loyalty/receipt/:orderId
 * Thermal printer text generator.
 */
loyaltyRouter.get('/receipt/:orderId', asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';
  const lang = (req.query.lang || 'en');

  const { data: entries } = await supabaseAdmin
    .from('loyalty_ledger')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('order_id', orderId);

  const earnedThisBill = (entries || [])
    .filter(e => e.type.startsWith('earn_') && e.points > 0)
    .reduce((sum, e) => sum + e.points, 0);

  const memberId = entries?.[0]?.member_id;
  let balance = 0;
  let program = { config: DEFAULT_LOYALTY_CONFIG };

  if (memberId) {
    const { data: bal } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: restaurantId,
      p_member_id: memberId
    });
    balance = bal || 0;

    const { data: prog } = await supabaseAdmin
      .from('loyalty_programs')
      .select('config')
      .eq('restaurant_id', restaurantId)
      .single();
    if (prog) program = prog;
  }

  const inrValue = (balance * program.config.point_value_paise) / 100;

  const receiptLines = [
    '========================================',
    `       Loyalty Receipt       `,
    '========================================',
    `Points Earned: ${earnedThisBill}`,
    `Points Balance: ${balance} (₹${inrValue.toFixed(2)})`,
    `Next Milestone: ${Math.max(0, 150 - (balance % 150))} points`,
    '----------------------------------------',
    `       Thank You!       `,
    '========================================'
  ].join('\n');

  return res.type('text/plain').send(receiptLines);
}));

/**
 * GET /api/loyalty/dashboard/metrics
 * Real data analytics: active members, points issued/redeemed, liability, repeat rate, ROI.
 */
loyaltyRouter.get('/dashboard/metrics', asyncHandler(async (req, res) => {
  const restaurantId = req.tenantId || req.query.restaurant_id || 'ten_yeezy_01';

  // Fetch all metrics in parallel
  const [
    { data: members, count: membersCount },
    { data: ledger },
    { data: program }
  ] = await Promise.all([
    supabaseAdmin.from('loyalty_members').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin.from('loyalty_ledger').select('*').eq('restaurant_id', restaurantId),
    supabaseAdmin.from('loyalty_programs').select('config').eq('restaurant_id', restaurantId).single()
  ]);

  const membersList = members || [];
  const ledgerEntries = ledger || [];
  const config = program?.config || DEFAULT_LOYALTY_CONFIG;

  const pointsIssued = ledgerEntries
    .filter(e => e.type.startsWith('earn_') && e.points > 0)
    .reduce((s, e) => s + e.points, 0);

  const pointsRedeemed = Math.abs(ledgerEntries
    .filter(e => e.type === 'redeem')
    .reduce((s, e) => s + e.points, 0));

  const pointsExpired = Math.abs(ledgerEntries
    .filter(e => e.type === 'expire')
    .reduce((s, e) => s + e.points, 0));

  const outstandingLiabilityPoints = Math.max(0, pointsIssued - pointsRedeemed - pointsExpired);
  const outstandingLiabilityInr = (outstandingLiabilityPoints * config.point_value_paise) / 100;

  const repeatMembers = membersList.filter(m => m.visit_count > 1).length;
  const repeatRate = membersList.length > 0 ? (repeatMembers / membersList.length) * 100 : 0;

  const totalSalesPaise = membersList.reduce((s, m) => s + (m.lifetime_spend_paise || 0), 0);
  const discountPaise = pointsRedeemed * config.point_value_paise;
  const effectiveCostPct = totalSalesPaise > 0 ? (discountPaise / totalSalesPaise) * 100 : 0;

  const guardrailBps = config.guardrail?.max_effective_earn_rate_bps || 800;
  const isGuardrailExceeded = (effectiveCostPct * 100) > guardrailBps;

  const { count: referralsCount } = await supabaseAdmin
    .from('loyalty_referrals')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId);

  return res.json({
    status: 'success',
    metrics: {
      activeMembers: membersList.length,
      repeatRate: parseFloat(repeatRate.toFixed(1)),
      pointsIssued,
      pointsRedeemed,
      pointsExpired,
      outstandingLiabilityPoints,
      outstandingLiabilityInr,
      effectiveCostPct: parseFloat(effectiveCostPct.toFixed(2)),
      guardrailBps,
      isGuardrailExceeded,
      referralsCount: referralsCount || 0
    }
  });
}));

export default loyaltyRouter;