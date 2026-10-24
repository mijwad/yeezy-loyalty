/**
 * Unified POS Routes - Scalable Multi-POS Integration
 * Uses POSAdapter pattern to support any POS system
 */
import { Router } from 'express';
import { posAdapterFactory } from '../pos/POSAdapterFactory.js';
import { supabaseAdmin } from '../db/supabase.js';
import { calculateEarn, previewRedeem, commitRedeem, normalizePhone } from '../../lib/loyalty/engine.js';

export const posUnifiedRouter = Router();

/**
 * Middleware to get POS adapter and verify webhook
 */
async function posAdapterMiddleware(req, res, next) {
  const posSystem = req.params.posSystem?.toLowerCase();

  if (!posAdapterFactory.hasAdapter(posSystem)) {
    return res.status(404).json({
      status: 'error',
      code: 'POS_SYSTEM_NOT_SUPPORTED',
      message: `POS system '${posSystem}' is not supported. Supported: ${posAdapterFactory.getRegisteredSystems().join(', ')}`
    });
  }

  try {
    const adapter = posAdapterFactory.getAdapter(posSystem);

    // Verify webhook signature
    const verification = await adapter.verifyWebhook(req);
    if (!verification.valid) {
      return res.status(401).json({
        status: 'error',
        code: 'WEBHOOK_VERIFICATION_FAILED',
        message: verification.error || 'Invalid webhook signature'
      });
    }

    req.posAdapter = adapter;
    req.posSystem = posSystem;
    next();
  } catch (err) {
    console.error(`[POS:${posSystem}] Adapter error:`, err);
    return res.status(500).json({
      status: 'error',
      code: 'ADAPTER_ERROR',
      message: 'Failed to initialize POS adapter'
    });
  }
}

/**
 * POST /pos/:posSystem/loyalty/inquire
 * Cashier inputs diner mobile number on billing screen
 */
posUnifiedRouter.post('/:posSystem/loyalty/inquire', posAdapterMiddleware, async (req, res) => {
  const adapter = req.posAdapter;
  const startTime = Date.now();

  try {
    // Parse and validate request
    const parsed = await adapter.parseInquireRequest(req);
    const { tenantId, outletId, phone, name, billAmount, discountableAmount, orderId, tableNo, serverName, items } = parsed;

    // Get loyalty program config from Supabase
    const { data: program, error: programError } = await supabaseAdmin
      .from('loyalty_programs')
      .select('config, is_active')
      .eq('restaurant_id', tenantId)
      .single();

    if (programError || !program || !program.is_active) {
      return res.status(404).json({
        status: 'error',
        code: 'PROGRAM_NOT_FOUND',
        message: 'Active loyalty program not found for this restaurant'
      });
    }

    const config = program.config;
    const pointValuePaise = config.point_value_paise || 100;

    // Get or create member
    const { data: member, error: memberError } = await supabaseAdmin
      .from('loyalty_members')
      .select('*')
      .eq('restaurant_id', tenantId)
      .eq('phone_e164', phone)
      .single();

    let memberRecord = member;
    if (memberError || !member) {
      // Create new member
      const { data: newMember, error: createError } = await supabaseAdmin
        .from('loyalty_members')
        .insert({
          restaurant_id: tenantId,
          phone_e164: phone,
          name: name || 'Valued Guest',
          tier: 'Silver',
          visit_count: 0,
          lifetime_spend_paise: 0
        })
        .select()
        .single();

      if (createError) throw createError;
      memberRecord = newMember;
    }

    // Get available balance using RPC
    const { data: availablePoints, error: balanceError } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: tenantId,
      p_member_id: memberRecord.id
    });

    if (balanceError) throw balanceError;

    // Get active reservations
    const { data: activeRes } = await supabaseAdmin
      .from('redemption_reservations')
      .select('points')
      .eq('restaurant_id', tenantId)
      .eq('member_id', memberRecord.id)
      .eq('status', 'reserved')
      .gt('expires_at', new Date().toISOString());

    const activeReservationsPoints = (activeRes || []).reduce((sum, r) => sum + r.points, 0);
    const currentPoints = availablePoints || 0;

    // Calculate redemption eligibility
    const redeemConfig = config.redeem || {};
    const minBill = redeemConfig.min_bill_paise || 30000;
    const minPoints = redeemConfig.min_points || 50;
    const maxPct = redeemConfig.max_percent_of_bill || 20;

    const isEligible = billAmount >= minBill && currentPoints >= minPoints;
    const maxCapFromBill = Math.floor((discountableAmount * maxPct) / 100);
    const maxPointsByBill = Math.floor(maxCapFromBill / (pointValuePaise / 100));
    const maxRedeemablePoints = isEligible ? Math.min(currentPoints, maxPointsByBill) : 0;
    const maxEligibleDiscountPaise = maxRedeemablePoints * pointValuePaise;

    // Estimated points to earn
    const earnRate = (config.earn?.base_rate_bps || 500) / 10000;
    const estimatedPointsToEarn = Math.floor((billAmount / 100) * earnRate * 100);

    // Generate redemption options (Petpooja/Reelo compatible format)
    const redemptionOptions = generateRedemptionOptions({
      currentPoints,
      maxRedeemablePoints,
      maxEligibleDiscountPaise,
      pointValuePaise,
      programConfig: config
    });

    // Create redemption session
    const sessionToken = `red_sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    await supabaseAdmin
      .from('redemption_sessions')
      .insert({
        session_token: sessionToken,
        restaurant_id: tenantId,
        member_id: memberRecord.id,
        member_phone: phone,
        order_id: orderId,
        table_no: tableNo,
        server_name: serverName,
        bill_amount_paise: billAmount,
        discountable_amount_paise: discountableAmount,
        max_redeemable_points: maxRedeemablePoints,
        max_discount_paise: maxEligibleDiscountPaise,
        available_options: redemptionOptions,
        status: 'OFFERED',
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min TTL
      });

    // Get outlet info
    const { data: outlet } = await supabaseAdmin
      .from('outlets')
      .select('name, rest_id')
      .eq('id', outletId)
      .single();

    const responseData = {
      customer: {
        id: memberRecord.id,
        name: memberRecord.name,
        phone: memberRecord.phone_e164,
        tier: memberRecord.tier,
        visit_count: memberRecord.visit_count,
        lifetime_spend_paise: memberRecord.lifetime_spend_paise,
        point_value_paise: pointValuePaise,
        favorite_dish: memberRecord.metadata?.favorite_dish
      },
      billContext: {
        order_id: orderId,
        table_no: tableNo,
        bill_amount: billAmount,
        discountable_amount: discountableAmount,
        min_bill_amount_required: minBill,
        max_discount_cap_inr: maxCapFromBill,
        estimated_points_to_earn: estimatedPointsToEarn
      },
      redemptionOffer: {
        session_token: sessionToken,
        is_eligible: isEligible && maxRedeemablePoints > 0,
        max_redeemable_points: maxRedeemablePoints,
        max_discount_amount: maxEligibleDiscountPaise,
        message: maxRedeemablePoints > 0
          ? `${memberRecord.name} has ${currentPoints} points available. Maximum eligible discount is ₹${(maxEligibleDiscountPaise / 100).toFixed(0)}.`
          : `${memberRecord.name} has ${currentPoints} points. Minimum bill of ₹${(minBill / 100).toFixed(0)} required.`
      },
      availablePoints: currentPoints,
      loyaltyRewards: redemptionOptions,
      redemptionOptions,
      outlet: outlet || { name: 'Unknown', rest_id: req.posSystem }
    };

    // Format response using adapter
    const formattedResponse = adapter.formatInquireResponse(responseData);

    // Log webhook
    await logWebhook(tenantId, 'POS_LOYALTY_INQUIRE', req.body, formattedResponse, 'SUCCESS');

    res.json(formattedResponse);
  } catch (err) {
    console.error(`[POS:${req.posSystem}] Inquire error:`, err);
    const errorResponse = {
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Failed to process loyalty inquiry'
    };
    await logWebhook(req.tenantId || 'unknown', 'POS_LOYALTY_INQUIRE', req.body, errorResponse, 'ERROR', err.message);
    res.status(500).json(errorResponse);
  }
});

/**
 * POST /pos/:posSystem/loyalty/lock
 * Lock points for redemption
 */
posUnifiedRouter.post('/:posSystem/loyalty/lock', posAdapterMiddleware, async (req, res) => {
  const adapter = req.posAdapter;

  try {
    const parsed = await adapter.parseLockRequest(req);
    const { sessionToken, optionId, customPoints } = parsed;

    // Get session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('redemption_sessions')
      .select('*')
      .eq('session_token', sessionToken)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        status: 'error',
        code: 'SESSION_NOT_FOUND',
        message: 'Redemption session expired or invalid'
      });
    }

    if (session.status !== 'OFFERED') {
      return res.status(400).json({
        status: 'error',
        code: 'SESSION_INVALID_STATE',
        message: `Session is in ${session.status} state, cannot lock`
      });
    }

    // Check session expiry
    if (new Date(session.expires_at) < new Date()) {
      await supabaseAdmin
        .from('redemption_sessions')
        .update({ status: 'EXPIRED' })
        .eq('session_token', sessionToken);

      return res.status(410).json({
        status: 'error',
        code: 'SESSION_EXPIRED',
        message: 'Redemption session has expired'
      });
    }

    // Get member current balance
    const { data: availablePoints } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: session.restaurant_id,
      p_member_id: session.member_id
    });

    const currentPoints = availablePoints || 0;

    // Determine points to lock
    let pointsLocked = 0;
    let discountAmount = 0;
    let selectedOption = null;

    if (optionId && session.available_options) {
      selectedOption = session.available_options.find(o => o.id === optionId);
    }

    if (selectedOption && selectedOption.type !== 'CUSTOM_POINTS') {
      pointsLocked = selectedOption.pointsToBurn;
      discountAmount = selectedOption.discountInr * 100; // Convert to paise
    } else {
      const pts = customPoints || session.max_redeemable_points;
      pointsLocked = Math.min(pts, session.max_redeemable_points, currentPoints);
      discountAmount = pointsLocked * (session.point_value_paise || 100);
    }

    if (currentPoints < pointsLocked) {
      return res.status(400).json({
        status: 'error',
        code: 'INSUFFICIENT_POINTS',
        message: `Customer has only ${currentPoints} points available`
      });
    }

    // Update session
    await supabaseAdmin
      .from('redemption_sessions')
      .update({
        status: 'LOCKED_PENDING_PAYMENT',
        selected_option_id: optionId || 'CUSTOM',
        points_locked: pointsLocked,
        discount_amount_paise: discountAmount
      })
      .eq('session_token', sessionToken);

    const netPayable = Math.max(0, session.bill_amount_paise - discountAmount);

    const responseData = {
      sessionToken,
      selectedOption,
      pointsLocked,
      discountAmount,
      netPayable,
      message: `₹${(discountAmount / 100).toFixed(2)} discount applied to bill (holding ${pointsLocked} points).`
    };

    const formattedResponse = adapter.formatLockResponse(responseData);
    res.json(formattedResponse);

  } catch (err) {
    console.error(`[POS:${req.posSystem}] Lock error:`, err);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Failed to lock points for redemption'
    });
  }
});

/**
 * POST /pos/:posSystem/orders/save
 * Order settlement - earn points, burn redeemed points
 */
posUnifiedRouter.post('/:posSystem/orders/save', posAdapterMiddleware, async (req, res) => {
  const adapter = req.posAdapter;

  try {
    const parsed = await adapter.parseOrderSaveRequest(req);
    const { tenantId, outletId, orderId, billNo, tableNo, serverName, customer, financials, redemptionSessionToken, items } = parsed;

    // Idempotency check
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('outlet_id', outletId)
      .eq('pos_bill_no', billNo)
      .single();

    if (existingOrder) {
      return res.json({
        status: 'success',
        idempotent: true,
        order_id: orderId,
        message: 'Order already ingested and points recorded.'
      });
    }

    // Get or create member
    const { data: member } = await supabaseAdmin
      .from('loyalty_members')
      .upsert({
        restaurant_id: tenantId,
        phone_e164: customer.phone,
        name: customer.name || 'Guest',
        tier: 'Silver'
      }, { onConflict: 'restaurant_id,phone_e164' })
      .select()
      .single();

    let pointsBurned = 0;
    let pointsEarned = 0;

    // 1. Process point burn if redemption session was active
    if (redemptionSessionToken) {
      const { data: session } = await supabaseAdmin
        .from('redemption_sessions')
        .select('*')
        .eq('session_token', redemptionSessionToken)
        .single();

      if (session && session.status === 'LOCKED_PENDING_PAYMENT') {
        pointsBurned = session.points_locked || 0;

        if (pointsBurned > 0) {
          // Commit redemption via RPC (this handles FIFO deduction)
          const { data: commitResult, error: commitError } = await supabaseAdmin.rpc('fn_loyalty_commit_points', {
            p_restaurant_id: tenantId,
            p_reservation_id: session.reservation_id, // Need to link session to reservation
            p_order_id: orderId
          });

          if (commitError || !commitResult?.success) {
            console.warn('[POS] Reservation commit failed, using direct ledger entry:', commitError);
            // Fallback: direct ledger entry
            await supabaseAdmin.from('loyalty_ledger').insert({
              restaurant_id: tenantId,
              member_id: member.id,
              order_id: `REFUND-${orderId}`,
              type: 'redeem',
              points: -pointsBurned,
              remaining: 0,
              meta: { reason: `Points redeemed for ₹${financials.loyaltyDiscount / 100} discount on Bill #${billNo}` }
            });
          }
        }

        // Update session status
        await supabaseAdmin
          .from('redemption_sessions')
          .update({ status: 'COMPLETED_SETTLED' })
          .eq('session_token', redemptionSessionToken);
      }
    } else if (financials.loyaltyDiscount > 0) {
      // Direct discount without prior session
      pointsBurned = Math.round(financials.loyaltyDiscount / (financials.pointValuePaise || 100));
      await supabaseAdmin.from('loyalty_ledger').insert({
        restaurant_id: tenantId,
        member_id: member.id,
        order_id: orderId,
        type: 'redeem',
        points: -pointsBurned,
        remaining: 0,
        meta: { reason: `Points redeemed on Bill #${billNo}` }
      });
    }

    // 2. Calculate and award points earned via RPC
    const { data: earnResult, error: earnError } = await supabaseAdmin.rpc('fn_loyalty_earn_points', {
      p_restaurant_id: tenantId,
      p_order_id: orderId,
      p_phone: customer.phone,
      p_subtotal_paise: financials.subtotal,
      p_order_type: 'dine_in'
    });

    if (earnError) throw earnError;

    const parsedEarn = typeof earnResult === 'string' ? JSON.parse(earnResult) : earnResult;
    pointsEarned = parsedEarn.points_earned || 0;

    // 3. Update member profile
    await supabaseAdmin
      .from('loyalty_members')
      .update({
        lifetime_spend_paise: member.lifetime_spend_paise + financials.netPaid,
        visit_count: member.visit_count + 1,
        last_visit_at: new Date().toISOString(),
        tier: parsedEarn.tier,
        metadata: {
          ...member.metadata,
          favorite_dish: items?.[0]?.name || items?.[0]?.item_name
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', member.id);

    // 4. Save order record
    const { data: savedOrder } = await supabaseAdmin
      .from('orders')
      .insert({
        tenant_id: tenantId,
        outlet_id: outletId,
        pos_system: req.posSystem.toUpperCase(),
        pos_order_id: orderId,
        pos_bill_no: billNo,
        subtotal_amount: financials.subtotal / 100,
        gross_bill_amount: financials.grossAmount / 100,
        loyalty_discount_amount: financials.loyaltyDiscount / 100,
        net_payable_amount: financials.netPaid / 100,
        points_earned_on_bill: pointsEarned,
        points_redeemed_on_bill: pointsBurned,
        items: items || []
      })
      .select()
      .single();

    // 5. Get new balance
    const { data: newBalance } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: tenantId,
      p_member_id: member.id
    });

    // 6. Generate notification
    const simulatedNotification = {
      channel: 'WHATSAPP_UTILITY',
      recipient: customer.phone,
      sent: true,
      message: `Hello ${customer.name}! 🎉 Thank you for dining with us. You earned ${pointsEarned} loyalty points on Bill #${billNo}. Your new total balance is ${newBalance} points. Redeem rewards on your next visit!`
    };

    const responseData = {
      orderId,
      billNo: savedOrder.pos_bill_no,
      customer: {
        name: customer.name,
        phone: customer.phone,
        tier: parsedEarn.tier,
        points_earned: pointsEarned,
        points_burned: pointsBurned,
        new_balance: newBalance || 0
      },
      simulated_notification: simulatedNotification
    };

    const formattedResponse = adapter.formatOrderSaveResponse(responseData);

    await logWebhook(tenantId, 'POS_ORDER_SAVE', req.body, formattedResponse, 'SUCCESS');
    res.json(formattedResponse);

  } catch (err) {
    console.error(`[POS:${req.posSystem}] Order save error:`, err);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Failed to process order settlement'
    });
  }
});

/**
 * POST /pos/:posSystem/orders/cancel
 * Cancel/void order - reverse points
 */
posUnifiedRouter.post('/:posSystem/orders/cancel', posAdapterMiddleware, async (req, res) => {
  const adapter = req.posAdapter;

  try {
    const parsed = await adapter.parseCancelRequest(req);
    const { tenantId, orderId, reason } = parsed;

    // Find order
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('pos_order_id', orderId)
      .single();

    if (!order) {
      return res.status(404).json({
        status: 'error',
        code: 'ORDER_NOT_FOUND',
        message: `Order ${orderId} not found`
      });
    }

    if (order.voided) {
      return res.json({ status: 'success', message: 'Order was already voided previously' });
    }

    // Get member
    const { data: member } = await supabaseAdmin
      .from('loyalty_members')
      .select('*')
      .eq('id', order.member_id)
      .single();

    // Reverse earned points
    if (order.points_earned_on_bill > 0) {
      await supabaseAdmin.from('loyalty_ledger').insert({
        restaurant_id: tenantId,
        member_id: member.id,
        order_id: `VOID-${orderId}`,
        type: 'reversal',
        points: -order.points_earned_on_bill,
        remaining: 0,
        meta: { reason: `Order #${orderId} voided - reversing ${order.points_earned_on_bill} earned points`, original_order_id: orderId }
      });
    }

    // Restore burned points
    if (order.points_redeemed_on_bill > 0) {
      await supabaseAdmin.from('loyalty_ledger').insert({
        restaurant_id: tenantId,
        member_id: member.id,
        order_id: `VOID-${orderId}`,
        type: 'reversal',
        points: order.points_redeemed_on_bill,
        remaining: order.points_redeemed_on_bill,
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        meta: { reason: `Order #${orderId} voided - refunding ${order.points_redeemed_on_bill} redeemed points`, original_order_id: orderId }
      });
    }

    // Update order
    await supabaseAdmin
      .from('orders')
      .update({ voided: true, void_reason: reason })
      .eq('id', order.id);

    // Update member stats
    await supabaseAdmin
      .from('loyalty_members')
      .update({
        lifetime_spend_paise: Math.max(0, member.lifetime_spend_paise - order.net_payable_amount * 100),
        visit_count: Math.max(0, member.visit_count - 1),
        updated_at: new Date().toISOString()
      })
      .eq('id', member.id);

    // Get new balance
    const { data: newBalance } = await supabaseAdmin.rpc('fn_loyalty_get_available_balance', {
      p_restaurant_id: tenantId,
      p_member_id: member.id
    });

    const responseData = {
      orderId,
      voided: true,
      customer: {
        name: member.name,
        new_balance: newBalance || 0
      },
      message: `Order #${orderId} voided successfully. Points balance adjusted.`
    };

    const formattedResponse = adapter.formatCancelResponse(responseData);
    await logWebhook(tenantId, 'POS_ORDER_CANCEL', req.body, formattedResponse, 'SUCCESS');
    res.json(formattedResponse);

  } catch (err) {
    console.error(`[POS:${req.posSystem}] Cancel error:`, err);
    res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Failed to process order cancellation'
    });
  }
});

/**
 * GET /pos/:posSystem/webhook-logs
 * Get webhook audit logs
 */
posUnifiedRouter.get('/:posSystem/webhook-logs', posAdapterMiddleware, async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('webhook_logs')
      .select('*')
      .eq('pos_system', req.posSystem.toUpperCase())
      .order('created_at', { ascending: false })
      .limit(100);

    res.json({
      status: 'success',
      count: data?.length || 0,
      logs: data || []
    });
  } catch (err) {
    console.error('[POS] Webhook logs error:', err);
    res.status(500).json({ status: 'error', message: 'Failed to fetch webhook logs' });
  }
});

/**
 * POST /pos/:posSystem/simulate
 * Testing helper - simulate end-to-end order
 */
posUnifiedRouter.post('/:posSystem/simulate', posAdapterMiddleware, async (req, res) => {
  const { phone = '9876543210', name = 'Test Customer', amount = 1450, discount = 0 } = req.body;
  const orderId = `POS-SIM-${Date.now().toString().slice(-6)}`;

  // Create mock request body in the POS system's format
  // For now, delegate to the inquire endpoint logic
  res.json({
    status: 'success',
    message: 'Simulation endpoint - use actual POS webhook format for testing',
    orderId
  });
});

/**
 * Helper: Generate redemption options
 */
function generateRedemptionOptions({ currentPoints, maxRedeemablePoints, maxEligibleDiscountPaise, pointValuePaise, programConfig }) {
  const options = [];
  const rewardTiers = programConfig.rewardTiers || [];

  // Standard milestone options (Reelo format)
  if (currentPoints >= 100 && maxEligibleDiscountPaise >= 10000) {
    options.push({
      id: 'OPT_100_OFF',
      type: 'POINTS_DISCOUNT',
      label: '100₹ off on entire purchase (100)',
      description: 'Deduct ₹100 from bill (burn 100 pts)',
      pointsToBurn: 100,
      discountInr: 100,
      isRecommended: true,
      eligible: true
    });
  }

  if (currentPoints >= 200 && maxEligibleDiscountPaise >= 20000) {
    options.push({
      id: 'OPT_200_OFF',
      type: 'POINTS_DISCOUNT',
      label: '200₹ off on entire purchase (200)',
      description: 'Deduct ₹200 from bill (burn 200 pts)',
      pointsToBurn: 200,
      discountInr: 200,
      eligible: true
    });
  }

  // Maximum points option
  if (maxRedeemablePoints > 0 && maxRedeemablePoints !== 100 && maxRedeemablePoints !== 200) {
    options.push({
      id: 'OPT_POINTS_MAX',
      type: 'POINTS_DISCOUNT',
      label: `Redeem Max Points: ₹${(maxEligibleDiscountPaise / 100).toFixed(0)} OFF`,
      description: `Burn ${maxRedeemablePoints} points (${programConfig.redeem?.max_percent_of_bill || 20}% bill cap)`,
      pointsToBurn: maxRedeemablePoints,
      discountInr: maxEligibleDiscountPaise / 100,
      eligible: true
    });
  }

  // 500 points milestone
  if (currentPoints >= 500 && maxEligibleDiscountPaise >= 50000) {
    options.push({
      id: 'OPT_POINTS_500',
      type: 'POINTS_DISCOUNT',
      label: `Redeem 500 Points: ₹500 OFF`,
      description: `Deduct ₹500 from bill (burn 500 pts)`,
      pointsToBurn: 500,
      discountInr: 500,
      eligible: true
    });
  }

  // Program reward tiers
  rewardTiers.forEach((tier, idx) => {
    let tierDiscount = 0;
    if (tier.rewardType === 'item') {
      tierDiscount = Math.min(250, maxEligibleDiscountPaise / 100);
    } else if (tier.rewardType === 'discount_amount') {
      tierDiscount = 125;
    } else if (tier.rewardType === 'discount_percentage') {
      tierDiscount = Math.min((maxEligibleDiscountPaise / 100) * 0.15, 400);
    }

    const hasEnoughPoints = currentPoints >= tier.points;
    options.push({
      id: `OPT_TIER_${tier.id || idx}`,
      tierId: tier.id,
      type: 'TIER_VOUCHER',
      label: tier.title,
      description: `Cost: ${tier.points} pts • ${hasEnoughPoints ? 'Eligible' : 'Needs ' + (tier.points - currentPoints) + ' more pts'}`,
      pointsToBurn: tier.points,
      discountInr: Math.round(tierDiscount),
      eligible: hasEnoughPoints && tierDiscount * 100 <= maxEligibleDiscountPaise
    });
  });

  // Custom points option
  options.push({
    id: 'OPT_POINTS_CUSTOM',
    type: 'CUSTOM_POINTS',
    label: 'Custom Points Deduction',
    description: `Enter points up to ${maxRedeemablePoints} pts`,
    maxPoints: maxRedeemablePoints,
    eligible: maxRedeemablePoints > 0
  });

  return options;
}

/**
 * Helper: Log webhook to database
 */
async function logWebhook(restaurantId, eventType, requestPayload, responsePayload, status, errorMessage = null) {
  if (!supabaseAdmin) return;

  try {
    await supabaseAdmin.from('webhook_logs').insert({
      restaurant_id: restaurantId,
      pos_system: eventType.split('_')[0], // Extract POS system from event type
      event_type: eventType,
      request_payload: requestPayload,
      response_payload: responsePayload,
      status,
      error_message: errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[Webhook Log] Failed to log:', err.message);
  }
}

// Need crypto for session token generation
import crypto from 'node:crypto';

export default posUnifiedRouter;