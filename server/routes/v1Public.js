import { Router } from 'express';
import { apiKeyAuth, requireScope } from '../middleware/apiKeyAuth.js';
import { rateLimiter, idempotency } from '../middleware/rateLimitAndIdempotency.js';
import { supabaseAdmin } from '../db/supabase.js';
import { normalizePhone } from '../../lib/loyalty/engine.js';

export const v1PublicRouter = Router();

// Apply API Key Authentication, Rate Limiting, and Idempotency to all v1 public routes
v1PublicRouter.use(apiKeyAuth);
v1PublicRouter.use(rateLimiter());
v1PublicRouter.use(idempotency());

// 1. GET /ping - Validate API Key & Program Status
v1PublicRouter.get('/ping', async (req, res) => {
  try {
    const { data: program } = await supabaseAdmin
      .from('loyalty_programs')
      .select('restaurant_id, is_active, config')
      .eq('restaurant_id', req.restaurantId)
      .single();

    return res.json({
      restaurant_id: req.restaurantId,
      restaurant_name: req.apiKey.name,
      is_active: program?.is_active ?? false,
      point_value_paise: program?.config?.point_value_paise || 100,
      earn_base_rate_bps: program?.config?.earn?.base_rate_bps || 500
    });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 2. GET /program - Public-safe program configuration
v1PublicRouter.get('/program', async (req, res) => {
  try {
    const { data: program } = await supabaseAdmin
      .from('loyalty_programs')
      .select('config, is_active')
      .eq('restaurant_id', req.restaurantId)
      .single();

    if (!program || !program.is_active) {
      return res.status(404).json({
        error: { code: 'PROGRAM_NOT_FOUND', message: 'Active loyalty program not found' }
      });
    }

    return res.json({
      point_value_paise: program.config?.point_value_paise || 100,
      earn: program.config?.earn || {},
      redeem: program.config?.redeem || {},
      tiers: program.config?.tiers || []
    });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 3. GET /customers/lookup?phone=+919876543210&bill_paise=50000
v1PublicRouter.get('/customers/lookup', requireScope('customers:read'), async (req, res) => {
  const rawPhone = req.query.phone;
  const billPaise = req.query.bill_paise ? parseInt(req.query.bill_paise, 10) : null;

  if (!rawPhone) {
    return res.status(400).json({
      error: { code: 'MISSING_PHONE', message: 'phone query parameter is required' }
    });
  }

  const phone = normalizePhone(rawPhone);

  try {
    const { data: member } = await supabaseAdmin
      .from('loyalty_members')
      .select('id, phone_e164, name, tier, lifetime_spend_paise, visit_count')
      .eq('restaurant_id', req.restaurantId)
      .eq('phone_e164', phone)
      .single();

    if (!member) {
      return res.status(404).json({
        found: false,
        error: { code: 'CUSTOMER_NOT_FOUND', message: 'No member found for this phone number' }
      });
    }

    // Call RPC to get available balance (which strictly deducts active unexpired reservations)
    const { data: availablePoints } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: req.restaurantId,
      p_member_id: member.id
    });

    // Check active reservations
    const { data: activeRes } = await supabaseAdmin
      .from('redemption_reservations')
      .select('points')
      .eq('restaurant_id', req.restaurantId)
      .eq('member_id', member.id)
      .eq('status', 'reserved')
      .gt('expires_at', new Date().toISOString());

    const activeReservationsPoints = (activeRes || []).reduce((sum, r) => sum + r.points, 0);

    const customerProfile = {
      id: member.id,
      phone_e164: member.phone_e164,
      name: member.name,
      tier: member.tier,
      available_points: availablePoints || 0,
      active_reservations_points: activeReservationsPoints,
      lifetime_spend_paise: member.lifetime_spend_paise,
      visit_count: member.visit_count
    };

    // Evaluate redemption eligibility if bill_paise was passed
    let redemptionEligibility = undefined;
    if (billPaise !== null) {
      const { data: program } = await supabaseAdmin
        .from('loyalty_programs')
        .select('config')
        .eq('restaurant_id', req.restaurantId)
        .single();

      const redeemConfig = program?.config?.redeem || {};
      const minBill = redeemConfig.min_bill_paise || 0;
      const minPoints = redeemConfig.min_points || 0;
      const maxPct = redeemConfig.max_percent_of_bill || 50;
      const pointVal = program?.config?.point_value_paise || 100;

      if (billPaise < minBill) {
        redemptionEligibility = {
          eligible: false,
          max_points_allowed: 0,
          max_discount_paise: 0,
          ineligible_reason: `Minimum bill of ₹${(minBill / 100).toFixed(2)} not met.`
        };
      } else if (customerProfile.available_points < minPoints) {
        redemptionEligibility = {
          eligible: false,
          max_points_allowed: 0,
          max_discount_paise: 0,
          ineligible_reason: `Minimum balance of ${minPoints} points required to redeem.`
        };
      } else {
        const maxDiscountAllowed = Math.floor((billPaise * maxPct) / 100);
        const maxPointsCapByBill = Math.floor(maxDiscountAllowed / (pointVal / 100));
        const usablePoints = Math.min(customerProfile.available_points, maxPointsCapByBill);

        redemptionEligibility = {
          eligible: usablePoints >= minPoints,
          max_points_allowed: usablePoints,
          max_discount_paise: Math.round(usablePoints * pointVal),
          ineligible_reason: usablePoints < minPoints ? 'Redemption cap below minimum allowed points.' : undefined
        };
      }
    }

    return res.json({
      found: true,
      customer: customerProfile,
      redemption_eligibility: redemptionEligibility
    });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 4. PUT /customers/:phone - Upsert customer profile
v1PublicRouter.put('/customers/:phone', requireScope('customers:write'), async (req, res) => {
  const phone = normalizePhone(req.params.phone);
  const { name, birthday, anniversary } = req.body;

  try {
    const { data: member, error } = await supabaseAdmin
      .from('loyalty_members')
      .upsert({
        restaurant_id: req.restaurantId,
        phone_e164: phone,
        name: name || null,
        metadata: { birthday, anniversary },
        updated_at: new Date().toISOString()
      }, { onConflict: 'restaurant_id,phone_e164' })
      .select('id, phone_e164, name, tier, lifetime_spend_paise, visit_count')
      .single();

    if (error) throw error;

    const { data: availablePoints } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: req.restaurantId,
      p_member_id: member.id
    });

    return res.json({
      id: member.id,
      phone_e164: member.phone_e164,
      name: member.name,
      tier: member.tier,
      available_points: availablePoints || 0,
      active_reservations_points: 0,
      lifetime_spend_paise: member.lifetime_spend_paise,
      visit_count: member.visit_count
    });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 5. POST /redemptions/reserve - Reserve points with 15-minute TTL
v1PublicRouter.post('/redemptions/reserve', requireScope('points:redeem'), async (req, res) => {
  const { phone: rawPhone, points, bill_paise, ttl_seconds } = req.body;

  if (!rawPhone || !points || !bill_paise) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'phone, points, and bill_paise are required' }
    });
  }

  const phone = normalizePhone(rawPhone);

  try {
    const { data: rpcRes, error } = await supabaseAdmin.rpc('fn_loyalty_reserve_points', {
      p_restaurant_id: req.restaurantId,
      p_phone: phone,
      p_points: points,
      p_bill_paise: bill_paise,
      p_ttl_seconds: ttl_seconds || 900
    });

    if (error) throw error;

    const result = typeof rpcRes === 'string' ? JSON.parse(rpcRes) : rpcRes;
    if (!result.success) {
      return res.status(result.error?.code === 'INSUFFICIENT_BALANCE' ? 409 : 400).json(result);
    }

    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 6. POST /redemptions/:id/commit - Finalize reserved points (Idempotent)
v1PublicRouter.post('/redemptions/:id/commit', requireScope('points:redeem'), async (req, res) => {
  const reservationId = req.params.id;
  const orderId = req.body?.order_id || null;

  try {
    const { data: rpcRes, error } = await supabaseAdmin.rpc('fn_loyalty_commit_points', {
      p_restaurant_id: req.restaurantId,
      p_reservation_id: reservationId,
      p_order_id: orderId
    });

    if (error) throw error;

    const result = typeof rpcRes === 'string' ? JSON.parse(rpcRes) : rpcRes;
    if (!result.success) {
      const isExpired = result.error?.code === 'RESERVATION_EXPIRED';
      return res.status(isExpired ? 409 : 400).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 7. POST /redemptions/:id/release - Release held points
v1PublicRouter.post('/redemptions/:id/release', requireScope('points:redeem'), async (req, res) => {
  const reservationId = req.params.id;

  try {
    const { data: rpcRes, error } = await supabaseAdmin.rpc('fn_loyalty_release_points', {
      p_restaurant_id: req.restaurantId,
      p_reservation_id: reservationId
    });

    if (error) throw error;

    const result = typeof rpcRes === 'string' ? JSON.parse(rpcRes) : rpcRes;
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 8. POST /orders - Ingest completed order, award points, and optionally commit linked reservation
v1PublicRouter.post('/orders', requireScope('points:earn'), async (req, res) => {
  const { order_id, phone: rawPhone, subtotal_paise, order_type, reservation_id, customer_name, name, metadata, items } = req.body;

  if (!order_id || !rawPhone || subtotal_paise === undefined || !order_type) {
    return res.status(400).json({
      error: { code: 'BAD_REQUEST', message: 'order_id, phone, subtotal_paise, and order_type are required' }
    });
  }

  const phone = normalizePhone(rawPhone);

  try {
    let reservationCommitted = false;

    // If reservation_id is provided, commit it idempotently within 24h grace window
    if (reservation_id) {
      const { data: commitRes } = await supabaseAdmin.rpc('fn_loyalty_commit_points', {
        p_restaurant_id: req.restaurantId,
        p_reservation_id: reservation_id,
        p_order_id: order_id
      });
      const parsedCommit = typeof commitRes === 'string' ? JSON.parse(commitRes) : commitRes;
      reservationCommitted = Boolean(parsedCommit?.success);

      if (!reservationCommitted && parsedCommit?.error?.code === 'RESERVATION_EXPIRED') {
        // Flag for manual review in audit log if points were unavailable
        await supabaseAdmin.from('audit_log').insert({
          restaurant_id: req.restaurantId,
          actor_type: 'system',
          action: 'RESERVATION_EXPIRED_ORDER_INGEST_FLAG',
          metadata: { order_id, reservation_id, phone, error: parsedCommit.error }
        });
      }
    }

    // Award loyalty points via RPC
    const { data: earnRes, error: earnErr } = await supabaseAdmin.rpc('fn_loyalty_earn_points', {
      p_restaurant_id: req.restaurantId,
      p_order_id: order_id,
      p_phone: phone,
      p_subtotal_paise: subtotal_paise,
      p_order_type: order_type
    });

    if (earnErr) throw earnErr;

    const parsedEarn = typeof earnRes === 'string' ? JSON.parse(earnRes) : earnRes;
    if (!parsedEarn.success) {
      return res.status(400).json(parsedEarn);
    }

    // If a customer name was provided with the order, ensure it is saved to member profile
    const providedName = (customer_name || name || metadata?.customer_name || metadata?.name || '').trim();
    if (providedName && providedName !== 'Valued Guest' && providedName !== 'Guest') {
      await supabaseAdmin
        .from('loyalty_members')
        .update({ name: providedName, updated_at: new Date().toISOString() })
        .eq('restaurant_id', req.restaurantId)
        .eq('phone_e164', phone);
    }

    // Attach items and rich order info to the created loyalty_ledger entry
    const orderItems = Array.isArray(items) ? items : (Array.isArray(metadata?.items) ? metadata.items : []);
    if (orderItems.length > 0 || providedName || metadata?.bill_number) {
      try {
        const { data: ledgerRow } = await supabaseAdmin
          .from('loyalty_ledger')
          .select('id, meta')
          .eq('restaurant_id', req.restaurantId)
          .eq('order_id', order_id)
          .limit(1)
          .maybeSingle();

        if (ledgerRow) {
          await supabaseAdmin
            .from('loyalty_ledger')
            .update({
              meta: {
                ...(ledgerRow.meta || {}),
                items: orderItems,
                customer_name: providedName || undefined,
                bill_number: metadata?.bill_number || undefined,
                order_type: order_type,
                subtotal_paise: subtotal_paise,
              }
            })
            .eq('id', ledgerRow.id);
        }
      } catch (metaErr) {
        console.warn('[Loyalty Ledger Meta Update Warning]', metaErr);
      }
    }

    return res.json({
      success: true,
      order_id: order_id,
      points_earned: parsedEarn.points_earned || 0,
      reservation_committed: reservationCommitted,
      new_balance: parsedEarn.new_balance,
      tier: parsedEarn.tier,
      visit_count: parsedEarn.visit_count
    });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// 9. POST /orders/:id/refund - Reverse points for refunded orders
v1PublicRouter.post('/orders/:id/refund', requireScope('points:earn'), async (req, res) => {
  const orderId = req.params.id;
  const refundPaise = req.body?.refund_paise;

  try {
    // Find original earn entries for order
    const { data: entries } = await supabaseAdmin
      .from('loyalty_ledger')
      .select('member_id, points, meta')
      .eq('restaurant_id', req.restaurantId)
      .eq('order_id', orderId)
      .gt('points', 0);

    if (!entries || entries.length === 0) {
      return res.status(404).json({
        error: { code: 'ORDER_NOT_FOUND', message: 'No earned points found for this order ID' }
      });
    }

    const memberId = entries[0].member_id;
    const totalEarnedPoints = entries.reduce((s, e) => s + e.points, 0);

    // Append reversal ledger entry
    const reversalPoints = -Math.abs(totalEarnedPoints);
    await supabaseAdmin.from('loyalty_ledger').insert({
      restaurant_id: req.restaurantId,
      member_id: memberId,
      order_id: `REFUND-${orderId}`,
      type: 'reversal',
      points: reversalPoints,
      remaining: 0,
      meta: { original_order_id: orderId, refund_paise: refundPaise }
    });

    const { data: newBalance } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: req.restaurantId,
      p_member_id: memberId
    });

    return res.json({
      success: true,
      order_id: orderId,
      points_reversed: totalEarnedPoints,
      new_balance: newBalance || 0
    });
  } catch (err) {
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});
