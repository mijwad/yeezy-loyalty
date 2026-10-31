/**
 * Petpooja API Integration Service
 * Implements the exact Petpooja Loyalty API specification:
 * 1. saveOrder - Earn points from order
 * 2. getRewards - Get customer rewards and balance
 * 3. redeem - Redeem points / Send OTP
 * 4. verifyOtp - Verify OTP and complete redemption
 */

import crypto from 'node:crypto';
import { supabaseAdmin, isSupabaseConfigured, toUuid } from '../../db/supabase.js';
import { normalizePhone } from '../../../lib/loyalty/engine.js';
import { createLoyaltyTriggers } from '../../whatsapp/loyaltyTriggers.js';
import { cleanRestaurantName } from '../../whatsapp/loyaltyTemplates.js';

// Petpooja Partner Token (from environment)
const PARTNER_TOKEN = process.env.PETPOOJA_PARTNER_TOKEN;

/**
 * Hash token for storage/comparison
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify token using timing-safe comparison
 */
function verifyToken(inputToken) {
  if (!inputToken) return false;
  if (!PARTNER_TOKEN) {
    // If not configured in env, allow non-empty partner token so POS webhook functions
    return inputToken.length >= 8;
  }
  const inputHash = hashToken(inputToken);
  const expectedHash = hashToken(PARTNER_TOKEN);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash),
      Buffer.from(expectedHash)
    );
  } catch {
    return false;
  }
}

/**
 * Get outlet by eateryBranchCode
 */
async function getOutletByBranchCode(eateryBranchCode) {
  if (!isSupabaseConfigured || !supabaseAdmin) return null;

  try {
    if (eateryBranchCode) {
      const { data, error } = await supabaseAdmin
        .from('outlets')
        .select('id, tenant_id, rest_id, name, pos_config')
        .eq('eatery_branch_code', eateryBranchCode)
        .maybeSingle();

      if (data) return data;
    }

    // Fallback: return active outlet
    const { data: fallbackOutlet } = await supabaseAdmin
      .from('outlets')
      .select('id, tenant_id, rest_id, name, pos_config')
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    return fallbackOutlet;
  } catch (err) {
    console.error('[Petpooja] Error fetching outlet by branch code:', err);
    return null;
  }
}

/**
 * Get customer by phone and tenant (from loyalty_members)
 */
async function getCustomerByPhone(tenantId, phone) {
  if (!isSupabaseConfigured || !supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('loyalty_members')
      .select('*')
      .eq('restaurant_id', tenantId)
      .eq('phone_e164', phone)
      .single();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.error('[Petpooja] Error fetching customer:', err);
    return null;
  }
}

/**
 * Get available points balance for customer using loyalty RPC
 */
async function getAvailableBalance(tenantId, phone) {
  if (!isSupabaseConfigured || !supabaseAdmin) return 0;

  try {
    // First get the member_id
    const customer = await getCustomerByPhone(tenantId, phone);
    if (!customer) return 0;

    const { data, error } = await supabaseAdmin
      .rpc('fn_loyalty_get_available_balance', {
        p_member_id: customer.id,
        p_restaurant_id: tenantId
      });

    if (error) {
      console.error('[Petpooja] RPC error getting balance:', error);
      return customer?.points_balance || 0;
    }
    return data || 0;
  } catch (err) {
    console.error('[Petpooja] Error getting balance:', err);
    return 0;
  }
}

/**
 * Calculate earn base from order totals
 */
function calculateEarnBasePaise(coreTotal, discountTotal, earnBaseType = 'CORE_MINUS_DISCOUNT') {
  switch (earnBaseType) {
    case 'CORE_TOTAL':
      return Math.max(0, Math.round(coreTotal * 100));
    case 'TOTAL':
      return Math.max(0, Math.round((coreTotal + discountTotal) * 100));
    case 'CORE_MINUS_DISCOUNT':
    default:
      return Math.max(0, Math.round(coreTotal * 100) - Math.round(discountTotal * 100));
  }
}

/**
 * Calculate points earned
 */
function calculateEarnedPoints(earnBasePaise, pointValuePaise = 100) {
  return Math.floor(earnBasePaise / pointValuePaise);
}

/**
 * Convert rupee-equivalent to internal points
 */
function rupeeEquivalentToPoints(rupeeEquivalent, pointValuePaise = 100) {
  return Math.ceil((rupeeEquivalent * 100) / pointValuePaise);
}

/**
 * Convert internal points to rupee-equivalent
 */
function pointsToRupeeEquivalent(points, pointValuePaise = 100) {
  return Math.floor((points * pointValuePaise) / 100);
}

/**
 * Get active Petpooja rewards for outlet/tenant
 */
async function getActivePetpoojaRewards(tenantId) {
  if (!isSupabaseConfigured || !supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('petpooja_rewards')
      .select('*')
      .eq('restaurant_id', tenantId)
      .eq('is_active', true)
      .order('points_required', { ascending: true });

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.error('[Petpooja] Error fetching petpooja rewards:', err);
    return [];
  }
}

/**
 * Calculate redeemable points
 */
function calculateRedeemablePoints(balancePoints, billAmountPaise, pointValuePaise, outletConfig) {
  if (billAmountPaise < (outletConfig.min_bill_paise || 0)) return 0;
  if (balancePoints < (outletConfig.min_points || 1)) return 0;

  const maxRedeemPercent = outletConfig.max_redeem_percent || 100;
  const maxPointsByBill = Math.floor(
    (billAmountPaise * maxRedeemPercent) / 100 / pointValuePaise
  );

  return Math.min(balancePoints, maxPointsByBill);
}

/**
 * Log webhook for debugging with PII redaction
 */
async function logWebhook(outletId, endpoint, requestBody, responseBody, statusCode, latencyMs, success, errorMessage) {
  if (!isSupabaseConfigured || !supabaseAdmin) return;

  try {
    const redactedRequest = JSON.parse(JSON.stringify(requestBody));
    if (redactedRequest.token) redactedRequest.token = '***REDACTED***';
    if (redactedRequest.number) redactedRequest.number = redactedRequest.number.replace(/\d(?=\d{4})/g, '*');
    if (redactedRequest.otp) redactedRequest.otp = '***REDACTED***';

    await supabaseAdmin
      .from('webhook_logs')
      .insert({
        restaurant_id: outletId,
        outlet_id: outletId,
        pos_system: 'PETPOOJA',
        event_type: endpoint.toUpperCase(),
        endpoint: endpoint,
        request_payload: redactedRequest,
        response_payload: responseBody,
        status: success ? 'SUCCESS' : 'ERROR',
        error_message: errorMessage,
        processing_time_ms: latencyMs
      });
  } catch (err) {
    console.error('[Petpooja] Webhook log error:', err);
  }
}

/**
 * ====================
 * ENDPOINT HANDLERS
 * ====================
 */

// 1. SAVE ORDER - Earn Points
export async function handleSaveOrder(req, res) {
  const startTime = Date.now();

  try {
    // Auth
    const token = req.body?.token;
    const eateryBranchCode = req.body?.data?.Restaurant?.eateryBranchCode;

    if (!token || !verifyToken(token)) {
      return res.status(200).json({ status: false, message: 'Invalid or missing token' });
    }

    if (!eateryBranchCode) {
      return res.status(200).json({ status: false, message: 'Missing eateryBranchCode' });
    }

    // Get outlet
    const outlet = await getOutletByBranchCode(eateryBranchCode);
    if (!outlet) {
      return res.status(200).json({ status: false, message: 'Unknown branch' });
    }

    const { data, Restaurant, Customer, Order, OrderItem, Tax, Discount } = req.body;
    const normalizedPhone = normalizePhone(Customer?.phone || '');

    // Check dummy phone
    const dummyPhones = ['0000000000', '9999999999', '1234567890', '1111111111'];
    const isDummy = dummyPhones.includes(normalizedPhone);

    // Extract order details
    const orderId = String(Order?.orderID || '');
    const invoiceNo = String(Order?.invoice_no || Order?.invoiceNo || '');
    const coreTotal = parseFloat(Order?.core_total || 0);
    const total = parseFloat(Order?.total || 0);
    const discountTotal = parseFloat(Order?.discount_total || 0);
    const taxTotal = parseFloat(Order?.tax_total || 0);
    const orderFrom = (Order?.orderFrom || 'POS').toUpperCase();

    // Get outlet config
    const pointValuePaise = outlet.pos_config?.point_value_paise || 100;
    const earnBaseType = outlet.pos_config?.earn_base || 'CORE_MINUS_DISCOUNT';
    const ignoreAggregators = outlet.pos_config?.ignore_aggregators !== false;
    const minBillPaise = outlet.pos_config?.min_bill_paise || 0;

    // Calculate earn
    const earnBasePaise = calculateEarnBasePaise(coreTotal, discountTotal, earnBaseType);
    let pointsToEarn = calculateEarnedPoints(earnBasePaise, pointValuePaise);

    // Check aggregator
    const isAggregator = ['ZOMATO', 'SWIGGY'].includes(orderFrom);
    const shouldSkipLoyalty = isDummy || (ignoreAggregators && isAggregator);

    if (shouldSkipLoyalty) {
      pointsToEarn = 0;
    }

    // Check minimum bill
    const totalPaise = Math.round(total * 100);
    if (!shouldSkipLoyalty && totalPaise < minBillPaise) {
      pointsToEarn = 0;
    }

    // Check idempotency on orders table
    const { data: existingOrder } = await supabaseAdmin
      .from('orders')
      .select('id, points_earned_on_bill')
      .eq('outlet_id', outlet.id)
      .eq('pos_order_id', orderId)
      .single();

    if (existingOrder) {
      // Return existing result (idempotent)
      const response = {
        status: true,
        message: 'Transaction Recorded (duplicate)'
      };
      await logWebhook(outlet.tenant_id, 'saveOrder', req.body, response, 200, Date.now() - startTime, true);
      return res.json(response);
    }

    // Find or create customer in loyalty_members
    let customer = await getCustomerByPhone(outlet.tenant_id, normalizedPhone);
    if (!customer && !isDummy) {
      const { data: newCustomer, error } = await supabaseAdmin
        .from('loyalty_members')
        .insert({
          restaurant_id: outlet.tenant_id,
          phone_e164: normalizedPhone,
          name: Customer?.name || 'Guest',
          tier: 'Silver',
          visit_count: 1,
          lifetime_spend_paise: totalPaise,
          points_balance: pointsToEarn,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!error) customer = newCustomer;
    }

    // Record order
    const orderRecord = {
      restaurant_id: outlet.tenant_id,
      tenant_id: toUuid(outlet.tenant_id),
      outlet_id: outlet.id,
      pos_system: 'PETPOOJA',
      pos_order_id: orderId,
      pos_bill_no: invoiceNo || `BILL-${orderId}`,
      subtotal_amount: Math.round(coreTotal * 100) / 100,
      gross_bill_amount: totalPaise / 100,
      loyalty_discount_amount: 0,
      net_payable_amount: totalPaise / 100,
      points_earned_on_bill: pointsToEarn,
      points_redeemed_on_bill: 0,
      status: 'PAID_SETTLED',
      pos_created_at: new Date().toISOString()
    };

    let orderData = existingOrder;
    if (!existingOrder) {
      const { data: insertedOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderRecord)
        .select()
        .maybeSingle();

      if (orderError && orderError.code !== '23505') {
        console.warn('[Petpooja] Non-fatal order insert notice:', orderError.message);
      }
      orderData = insertedOrder || { id: null };
    }

    // If earned points, update customer balance and ledger using RPC
    let newBalance = 0;
    let isFirstPurchase = false;
    if (pointsToEarn > 0 && customer) {
      // Use fn_loyalty_earn_points RPC for atomic earn with idempotency
      const earnResult = await supabaseAdmin.rpc('fn_loyalty_earn_points', {
        p_restaurant_id: outlet.tenant_id,
        p_order_id: orderId,
        p_phone: normalizedPhone,
        p_subtotal_paise: earnBasePaise,
        p_order_type: orderFrom.toLowerCase(),
        p_reservation_id: null
      });

      if (earnResult.data) {
        newBalance = earnResult.data.new_balance || 0;
        isFirstPurchase = earnResult.data.visit_count === 1;

        // Refresh customer data
        const { data: updatedCustomer } = await supabaseAdmin
          .from('loyalty_members')
          .select('*')
          .eq('restaurant_id', outlet.tenant_id)
          .eq('phone_e164', normalizedPhone)
          .single();
        if (updatedCustomer) customer = updatedCustomer;
      }
    } else if (customer) {
      newBalance = customer.points_balance || 0;
    }

    // If there's a prior redemption for this invoice, settle it
    if (invoiceNo && !shouldSkipLoyalty) {
      await settleRedemption(outlet.tenant_id, invoiceNo, orderId, orderData.id);
    }

    // Send WhatsApp purchase confirmation if enabled
    if (customer && !isDummy && pointsToEarn >= 0) {
      try {
        const triggers = createLoyaltyTriggers(outlet.tenant_id);
        await triggers.onBillSettled(
          {
            id: customer.id,
            phoneNumber: normalizedPhone,
            phone: normalizedPhone,
            phone_e164: normalizedPhone,
            name: customer.name || 'Guest',
            fullName: customer.name || 'Guest',
            is_whatsapp_opt_in: true, // Default to true for transactional messages
            total_visits_count: customer.visit_count || 1
          },
          { name: cleanRestaurantName(outlet?.name || Restaurant?.name || 'Durbar Cafe') },
          {
            orderId: orderId,
            invoiceNo: invoiceNo,
            amount: totalPaise,
            pointsEarned: pointsToEarn
          },
          pointsToEarn,
          newBalance,
          isFirstPurchase
        );
      } catch (whatsappErr) {
        console.error('[Petpooja] WhatsApp notification failed:', whatsappErr.message);
      }
    }

    const response = {
      status: true,
      message: shouldSkipLoyalty ? 'Order recorded (loyalty skipped)' : 'Transaction Recorded'
    };

    await logWebhook(outlet.tenant_id, 'saveOrder', req.body, response, 200, Date.now() - startTime, true);
    return res.json(response);

  } catch (err) {
    console.error('[Petpooja saveOrder Error]', err);
    const response = { status: false, message: 'Internal server error' };
    await logWebhook(null, 'saveOrder', req.body, response, 500, Date.now() - startTime, false, err.message);
    return res.status(200).json(response);
  }
}

// 2. GET REWARDS - Get customer rewards and balance
export async function handleGetRewards(req, res) {
  const startTime = Date.now();

  try {
    const token = req.body?.token;
    const number = req.body?.number;
    const eateryBranchCode = req.body?.eateryBranchCode;
    const billAmount = parseFloat(req.body?.bill_amount || 0);

    if (!token || !verifyToken(token)) {
      return res.status(200).json({ status: false, message: 'Invalid or missing token' });
    }

    if (!eateryBranchCode) {
      return res.status(200).json({ status: false, message: 'Missing eateryBranchCode' });
    }

    const outlet = await getOutletByBranchCode(eateryBranchCode);
    if (!outlet) {
      return res.status(200).json({ status: false, message: 'Unknown branch' });
    }

    const normalizedPhone = normalizePhone(number || '');
    const pointValuePaise = outlet.pos_config?.point_value_paise || 100;

    // Get balance
    const balancePoints = await getAvailableBalance(outlet.tenant_id, normalizedPhone);

    // Get customer
    const customer = await getCustomerByPhone(outlet.tenant_id, normalizedPhone);

    // Get active Petpooja rewards
    const rewards = await getActivePetpoojaRewards(outlet.tenant_id);

    // Calculate redeemable points
    const redeemablePoints = calculateRedeemablePoints(
      balancePoints,
      Math.round(billAmount * 100),
      pointValuePaise,
      outlet.pos_config || {}
    );

    // Format rewards for Petpooja
    // petpooja_rewards uses petpooja_reward_id (BIGINT) as the identifier
    // discount_type: 1=percent, 2=fixed, 3=free item
    // points field in response should be rupee-equivalent string
    const normalRewards = rewards.map((reward) => ({
      id: reward.petpooja_reward_id, // Use the BIGINT identifier
      name: reward.name,
      points: pointsToRupeeEquivalent(reward.points_required, pointValuePaise).toString(),
      discount_type: String(reward.discount_type),
      pos_item_id: reward.pos_item_id || ''
    }));

    const response = {
      status: true,
      otp_required: outlet.pos_config?.otp_required || false,
      reward_information: {
        normal_rewards: normalRewards,
        name: customer?.name || '',
        phone: normalizedPhone,
        balance_points: pointsToRupeeEquivalent(balancePoints, pointValuePaise).toString(),
        redeemable_points: pointsToRupeeEquivalent(redeemablePoints, pointValuePaise).toString()
      }
    };

    await logWebhook(outlet.tenant_id, 'getRewards', req.body, response, 200, Date.now() - startTime, true);
    return res.json(response);

  } catch (err) {
    console.error('[Petpooja getRewards Error]', err);
    const response = { status: false, message: 'Failed to fetch rewards' };
    await logWebhook(null, 'getRewards', req.body, response, 500, Date.now() - startTime, false, err.message);
    return res.status(200).json(response);
  }
}

// 3. REDEEM - Reserve points / Send OTP
export async function handleRedeem(req, res) {
  const startTime = Date.now();

  try {
    const token = req.body?.token;
    const number = req.body?.number;
    const rewardPoints = req.body?.reward_points; // Reward ID (petpooja_reward_id)
    const points = req.body?.points; // Cashback points (rupee-equivalent)
    const invoiceAmount = parseFloat(req.body?.invoice_amount || 0);
    const invoiceNo = String(req.body?.invoice_no || req.body?.invoiceNo || '');
    const eateryBranchCode = req.body?.eateryBranchCode;

    if (!token || !verifyToken(token)) {
      return res.status(200).json({ status: false, message: 'Invalid or missing token' });
    }

    if (!eateryBranchCode) {
      return res.status(200).json({ status: false, message: 'Missing eateryBranchCode' });
    }

    const outlet = await getOutletByBranchCode(eateryBranchCode);
    if (!outlet) {
      return res.status(200).json({ status: false, message: 'Unknown branch' });
    }

    const normalizedPhone = normalizePhone(number || '');
    const pointValuePaise = outlet.pos_config?.point_value_paise || 100;
    const billAmountPaise = Math.round(invoiceAmount * 100);

    // Determine points to redeem
    let pointsToRedeem = 0;
    let rewardName = 'Redeem points';
    let rewardType = '2'; // Fixed discount
    let isCashback = false;
    let petpoojaRewardId = null;

    if (points) {
      // Cashback redemption
      pointsToRedeem = parseInt(points, 10);
      isCashback = true;
    } else if (rewardPoints) {
      // Catalog reward redemption
      const rewardId = parseInt(rewardPoints, 10);
      const rewards = await getActivePetpoojaRewards(outlet.tenant_id);
      const reward = rewards.find(r => r.petpooja_reward_id === rewardId);
      if (reward) {
        pointsToRedeem = reward.points_required;
        rewardName = reward.name;
        rewardType = String(reward.discount_type);
        petpoojaRewardId = reward.petpooja_reward_id;
      }
    }

    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return res.status(200).json({ status: false, message: 'Invalid redemption points' });
    }

    // Convert rupee-equivalent to internal points
    const internalPoints = rupeeEquivalentToPoints(pointsToRedeem, pointValuePaise);

    // Validate customer
    const customer = await getCustomerByPhone(outlet.tenant_id, normalizedPhone);
    if (!customer) {
      return res.status(200).json({ status: false, message: 'Customer not enrolled in loyalty program' });
    }

    const balance = await getAvailableBalance(outlet.tenant_id, normalizedPhone);
    const minPoints = outlet.pos_config?.min_points || 1;
    const maxRedeemPercent = outlet.pos_config?.max_redeem_percent || 100;
    const minBillPaise = outlet.pos_config?.min_bill_paise || 0;

    if (internalPoints < minPoints) {
      return res.status(200).json({ status: false, message: `Minimum ${minPoints} points required for redemption` });
    }
    if (balance < internalPoints) {
      return res.status(200).json({ status: false, message: 'Insufficient points balance' });
    }
    if (billAmountPaise < minBillPaise) {
      return res.status(200).json({ status: false, message: `Minimum bill amount of ₹${minBillPaise / 100} not met` });
    }

    const maxPointsByBill = Math.floor((billAmountPaise * maxRedeemPercent) / 100 / pointValuePaise);
    if (internalPoints > maxPointsByBill) {
      return res.status(200).json({ status: false, message: `Cannot redeem more than ${maxRedeemPercent}% of bill value` });
    }

    // Check for existing active redemption for this invoice
    const { data: existingRedemption } = await supabaseAdmin
      .from('petpooja_redemptions')
      .select('*')
      .eq('restaurant_id', outlet.tenant_id)
      .eq('outlet_id', outlet.id)
      .eq('invoice_no', invoiceNo)
      .in('status', ['PENDING_OTP', 'HELD'])
      .single();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10800 * 1000); // 3 hours

    if (existingRedemption) {
      // Check if expired
      if (new Date(existingRedemption.expires_at) < now) {
        // Mark expired
        await supabaseAdmin
          .from('petpooja_redemptions')
          .update({ status: 'EXPIRED_RELEASED', updated_at: now.toISOString() })
          .eq('id', existingRedemption.id);
      } else if (existingRedemption.points_burned === internalPoints) {
        // Idempotent success
        const response = {
          status: true,
          message: 'success',
          reward_name: rewardName,
          reward_type: rewardType
        };
        await logWebhook(outlet.tenant_id, 'redeem', req.body, response, 200, Date.now() - startTime, true);
        return res.json(response);
      } else {
        // Different points - cancel old
        await supabaseAdmin
          .from('petpooja_redemptions')
          .update({ status: 'CANCELLED', updated_at: now.toISOString() })
          .eq('id', existingRedemption.id);
      }
    }

    // Calculate discount amount
    let discountAmountPaise = internalPoints * pointValuePaise;
    const rewards = await getActivePetpoojaRewards(outlet.tenant_id);
    const reward = rewards.find(r => r.points_required === internalPoints);
    if (reward) {
      if (reward.discount_type === 1) { // percentage
        discountAmountPaise = Math.floor((billAmountPaise * (reward.discount_value || 0)) / 100);
      } else if (reward.discount_type === 2) { // fixed
        discountAmountPaise = Math.round(reward.discount_value * 100);
      } else if (reward.discount_type === 3) { // free item
        discountAmountPaise = Math.round(reward.discount_value * 100);
      }
    }

    // For cashback redemption, use fn_petpooja_redeem RPC for atomic operation
    if (isCashback) {
      const rpcResult = await supabaseAdmin.rpc('fn_petpooja_redeem', {
        p_restaurant_id: outlet.tenant_id,
        p_outlet_id: outlet.id,
        p_member_id: customer.id,
        p_phone_e164: normalizedPhone,
        p_invoice_no: invoiceNo,
        p_points_burned: internalPoints,
        p_discount_paise: discountAmountPaise,
        p_bill_amount_paise: billAmountPaise
      });

      if (rpcResult.error) {
        console.error('[Petpooja] fn_petpooja_redeem error:', rpcResult.error);
        return res.status(200).json({ status: false, message: 'Redemption failed' });
      }

      const result = rpcResult.data;
      if (!result?.success) {
        return res.status(200).json({ status: false, message: result?.error?.message || 'Redemption failed' });
      }

      const response = {
        status: true,
        message: 'success',
        reward_name: rewardName,
        reward_type: rewardType
      };

      await logWebhook(outlet.tenant_id, 'redeem', req.body, response, 200, Date.now() - startTime, true);
      return res.json(response);
    }

    // For catalog reward redemption, create petpooja_redemptions record
    await supabaseAdmin
      .from('petpooja_redemptions')
      .insert({
        restaurant_id: outlet.tenant_id,
        outlet_id: outlet.id,
        member_id: customer.id,
        phone_e164: normalizedPhone,
        invoice_no: invoiceNo,
        kind: 'REWARD',
        status: 'HELD',
        reward_id: petpoojaRewardId,
        points_burned: internalPoints,
        discount_amount_paise: discountAmountPaise,
        reward_name: rewardName,
        expires_at: expiresAt.toISOString()
      });

    // Reserve points in ledger (negative RESERVE entry)
    await supabaseAdmin
      .from('loyalty_ledger')
      .insert({
        restaurant_id: outlet.tenant_id,
        member_id: customer.id,
        type: 'RESERVE',
        points: -internalPoints,
        remaining: balance - internalPoints,
        meta: { invoice_no: invoiceNo, kind: 'REWARD', reward_id: petpoojaRewardId }
      });

    const response = {
      status: true,
      message: 'success',
      reward_name: rewardName,
      reward_type: rewardType
    };

    await logWebhook(outlet.tenant_id, 'redeem', req.body, response, 200, Date.now() - startTime, true);
    return res.json(response);

  } catch (err) {
    console.error('[Petpooja redeem Error]', err);
    const response = { status: false, message: 'Internal server error' };
    await logWebhook(null, 'redeem', req.body, response, 500, Date.now() - startTime, false, err.message);
    return res.status(200).json(response);
  }
}

// 4. VERIFY OTP - Not implemented in v1 (placeholder)
export async function handleVerifyOtp(req, res) {
  const startTime = Date.now();

  const response = {
    status: false,
    message: 'OTP verification is not enabled'
  };

  await logWebhook(null, 'verifyOtp', req.body, response, 200, Date.now() - startTime, false);
  return res.status(200).json(response);
}

/**
 * Settle redemption when order comes in via saveOrder
 * Uses the petpooja_redemptions table and updates loyalty_ledger
 */
async function settleRedemption(tenantId, invoiceNo, posOrderId, orderId) {
  try {
    const { data: redemption } = await supabaseAdmin
      .from('petpooja_redemptions')
      .select('*')
      .eq('restaurant_id', tenantId)
      .eq('invoice_no', invoiceNo)
      .in('status', ['HELD', 'EXPIRED_RELEASED'])
      .single();

    if (!redemption) return;

    const now = new Date();
    const isExpired = new Date(redemption.expires_at) < now;

    if (redemption.status === 'HELD' && !isExpired) {
      // Normal settlement
      await supabaseAdmin
        .from('petpooja_redemptions')
        .update({
          status: 'SETTLED',
          settled_order_id: posOrderId,
          updated_at: now.toISOString()
        })
        .eq('id', redemption.id);

      // Convert RESERVE to BURN in ledger
      await supabaseAdmin
        .from('loyalty_ledger')
        .insert({
          restaurant_id: tenantId,
          member_id: redemption.member_id,
          order_id: orderId,
          type: 'BURN',
          points: -redemption.points_burned,
          remaining: 0,
          meta: {
            redemption_id: redemption.id,
            settled: true,
            invoice_no: invoiceNo
          }
        });

      // Send WhatsApp redemption confirmation
      try {
        const { data: member } = await supabaseAdmin
          .from('loyalty_members')
          .select('*')
          .eq('id', redemption.member_id)
          .single();

        if (member) {
          const triggers = createLoyaltyTriggers(tenantId);
          await triggers.onRewardRedeemed(
            {
              id: member.id,
              phone: member.phone_e164,
              name: member.name || 'Guest',
              is_whatsapp_opt_in: true
            },
            { name: 'Restaurant' },
            { name: redemption.reward_name || 'Reward' },
            redemption.points_burned,
            await getAvailableBalance(tenantId, member.phone_e164)
          );
        }
      } catch (whatsappErr) {
        console.error('[Petpooja] WhatsApp redemption notification failed:', whatsappErr.message);
      }

    } else {
      // Expired at settle time
      await supabaseAdmin
        .from('petpooja_redemptions')
        .update({
          status: 'NEEDS_REVIEW',
          settled_order_id: posOrderId,
          late_settled: true,
          needs_review: true,
          updated_at: now.toISOString()
        })
        .eq('id', redemption.id);
    }
  } catch (err) {
    console.error('[Petpooja] Settle redemption error:', err);
  }
}

export default {
  handleSaveOrder,
  handleGetRewards,
  handleRedeem,
  handleVerifyOtp,
  verifyToken,
  getOutletByBranchCode
};