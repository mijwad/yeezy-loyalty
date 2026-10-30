/**
 * Petpooja API Integration Service
 * Implements the exact Petpooja Loyalty API specification:
 * 1. saveOrder - Earn points from order
 * 2. getRewards - Get customer rewards and balance
 * 3. redeem - Redeem points / Send OTP
 * 4. verifyOtp - Verify OTP and complete redemption
 */

import crypto from 'node:crypto';
import { supabaseAdmin, isSupabaseConfigured, toUuid, syncCustomerToSupabase, syncOrderToSupabase } from '../db/supabase.js';
import { normalizePhone } from '../../lib/loyalty/engine.js';

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
  if (!PARTNER_TOKEN) return false;
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
    const { data, error } = await supabaseAdmin
      .from('outlets')
      .select('id, tenant_id, rest_id, name, pos_config')
      .eq('eatery_branch_code', eateryBranchCode)
      .single();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.error('[Petpooja] Error fetching outlet by branch code:', err);
    return null;
  }
}

/**
 * Get customer by phone and tenant
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
 * Get available points balance for customer
 */
async function getAvailableBalance(tenantId, phone) {
  if (!isSupabaseConfigured || !supabaseAdmin) return 0;

  try {
    const { data, error } = await supabaseAdmin
      .rpc('fn_loyalty_get_available_balance', {
        p_member_id: null,
        p_restaurant_id: tenantId
      });

    if (error) {
      // Fallback: query loyalty_members directly
      const customer = await getCustomerByPhone(tenantId, phone);
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
 * Get active rewards for outlet
 */
async function getActiveRewards(tenantId) {
  if (!isSupabaseConfigured || !supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin
      .from('loyalty_rewards')
      .select('*')
      .eq('restaurant_id', tenantId)
      .eq('is_active', true)
      .order('points_cost', { ascending: true });

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.error('[Petpooja] Error fetching rewards:', err);
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
 * Log webhook for debugging
 */
async function logWebhook(outletId, endpoint, requestBody, responseBody, statusCode, latencyMs, success, errorMessage) {
  if (!isSupabaseConfigured || !supabaseAdmin) return;

  try {
    const redactedRequest = JSON.parse(JSON.stringify(requestBody));
    if (redactedRequest.token) redactedRequest.token = '***REDACTED***';
    if (redactedRequest.number) redactedRequest.number = redactedRequest.number.replace(/\d(?=\d{4})/g, '*');

    await supabaseAdmin
      .from('webhook_logs')
      .insert({
        restaurant_id: outletId,
        pos_system: 'PETPOOJA',
        event_type: endpoint.toUpperCase(),
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

    // Check idempotency
    const existingOrder = await supabaseAdmin
      .from('orders')
      .select('id, points_earned_on_bill')
      .eq('outlet_id', outlet.id)
      .eq('pos_order_id', orderId)
      .single();

    if (existingOrder?.data) {
      // Return existing result (idempotent)
      const response = {
        status: true,
        message: 'Transaction Recorded (duplicate)'
      };
      await logWebhook(outlet.tenant_id, 'saveOrder', req.body, response, 200, Date.now() - startTime, true);
      return res.json(response);
    }

    // Find or create customer
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
      tenant_id: toUuid(outlet.tenant_id),
      outlet_id: outlet.id,
      pos_system: 'PETPOOJA',
      pos_order_id: orderId,
      pos_bill_no: invoiceNo || `BILL-${orderId}`,
      subtotal_amount: Math.round(coreTotal * 100),
      gross_bill_amount: totalPaise,
      loyalty_discount_amount: 0,
      net_payable_amount: totalPaise,
      points_earned_on_bill: pointsToEarn,
      points_redeemed_on_bill: 0
    };

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .upsert(orderRecord, { onConflict: 'outlet_id,pos_order_id' })
      .select()
      .single();

    if (orderError) throw orderError;

    // If earned points, update customer balance and ledger
    if (pointsToEarn > 0 && customer) {
      const newBalance = (customer.points_balance || 0) + pointsToEarn;

      // Update customer points
      await supabaseAdmin
        .from('loyalty_members')
        .update({
          points_balance: newBalance,
          visit_count: (customer.visit_count || 0) + 1,
          lifetime_spend_paise: (customer.lifetime_spend_paise || 0) + totalPaise,
          last_visit_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('restaurant_id', outlet.tenant_id)
        .eq('phone_e164', normalizedPhone);

      // Record ledger entry
      await supabaseAdmin
        .from('loyalty_ledger')
        .insert({
          restaurant_id: outlet.tenant_id,
          member_id: customer.id,
          order_id: orderData.id,
          type: 'EARN',
          points: pointsToEarn,
          remaining: newBalance,
          meta: {
            order_id: orderId,
            earn_base_paise: earnBasePaise,
            invoice_no: invoiceNo
          }
        });
    }

    // If there's a prior redemption for this invoice, settle it
    if (invoiceNo && !shouldSkipLoyalty) {
      await settleRedemption(outlet.tenant_id, invoiceNo, orderId, orderData.id);
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

    // Get active rewards
    const rewards = await getActiveRewards(outlet.tenant_id);

    // Calculate redeemable points
    const redeemablePoints = calculateRedeemablePoints(
      balancePoints,
      Math.round(billAmount * 100),
      pointValuePaise,
      outlet.pos_config || {}
    );

    // Format rewards for Petpooja
    const normalRewards = rewards.map((reward, idx) => ({
      id: idx + 1,
      name: reward.title || reward.name,
      points: pointsToRupeeEquivalent(reward.points_cost, pointValuePaise).toString(),
      discount_type: String(
        reward.reward_type === 'percentage' ? 1 :
        reward.reward_type === 'fixed' ? 2 : 3
      ),
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
    const rewardPoints = req.body?.reward_points; // Reward ID
    const points = req.body?.points; // Cashback points
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

    if (points) {
      pointsToRedeem = parseInt(points, 10);
    } else if (rewardPoints) {
      const rewardId = parseInt(rewardPoints, 10);
      const rewards = await getActiveRewards(outlet.tenant_id);
      const reward = rewards[rewardId - 1];
      if (reward) {
        pointsToRedeem = reward.points_cost;
        rewardName = reward.title || reward.name;
        rewardType = String(reward.reward_type === 'percentage' ? 1 : reward.reward_type === 'fixed' ? 2 : 3);
      }
    }

    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return res.status(200).json({ status: false, message: 'Invalid redemption points' });
    }

    // Convert rupee-equivalent to internal points
    const internalPoints = rupeeEquivalentToPoints(pointsToRedeem, pointValuePaise);

    // Validate
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

    // Check for existing redemption for this invoice
    const { data: existingRedemption } = await supabaseAdmin
      .from('redemption_sessions')
      .select('*')
      .eq('restaurant_id', outlet.tenant_id)
      .eq('order_id', invoiceNo)
      .eq('status', 'HELD')
      .single();

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10800 * 1000); // 3 hours

    if (existingRedemption) {
      // Check if expired
      if (new Date(existingRedemption.expires_at) < now) {
        // Mark expired
        await supabaseAdmin
          .from('redemption_sessions')
          .update({ status: 'EXPIRED_RELEASED' })
          .eq('session_token', existingRedemption.session_token);
      } else if (existingRedemption.points_locked === internalPoints) {
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
          .from('redemption_sessions')
          .update({ status: 'CANCELLED' })
          .eq('session_token', existingRedemption.session_token);
      }
    }

    // Calculate discount amount
    let discountAmountPaise = internalPoints * pointValuePaise;
    const rewards = await getActiveRewards(outlet.tenant_id);
    const reward = rewards.find(r => r.points_cost === internalPoints);
    if (reward) {
      if (reward.reward_type === 'percentage') {
        discountAmountPaise = Math.floor((billAmountPaise * (reward.value || 0)) / 100);
      } else if (reward.reward_type === 'fixed') {
        discountAmountPaise = reward.value || 0;
      }
    }

    // Create redemption session
    const sessionToken = `red_sess_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

    await supabaseAdmin
      .from('redemption_sessions')
      .insert({
        session_token: sessionToken,
        restaurant_id: outlet.tenant_id,
        member_id: customer.id,
        member_phone: normalizedPhone,
        order_id: invoiceNo,
        bill_amount_paise: billAmountPaise,
        discountable_amount_paise: billAmountPaise,
        max_redeemable_points: internalPoints,
        max_discount_paise: discountAmountPaise,
        point_value_paise: pointValuePaise,
        points_locked: internalPoints,
        discount_amount_paise: discountAmountPaise,
        available_options: [{
          id: 'CASHBACK',
          type: 'POINTS_DISCOUNT',
          label: rewardName,
          pointsToBurn: internalPoints,
          discountInr: discountAmountPaise / 100,
          eligible: true
        }],
        status: 'HELD',
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString()
      });

    // Reserve points (negative ledger entry)
    await supabaseAdmin
      .from('loyalty_ledger')
      .insert({
        restaurant_id: outlet.tenant_id,
        member_id: customer.id,
        type: 'RESERVE',
        points: -internalPoints,
        remaining: balance - internalPoints,
        meta: { invoice_no: invoiceNo, session_token: sessionToken }
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

// 4. VERIFY OTP - Not implemented in v1
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
 * Settle redemption when order comes in
 */
async function settleRedemption(tenantId, invoiceNo, posOrderId, orderId) {
  try {
    const { data: redemption } = await supabaseAdmin
      .from('redemption_sessions')
      .select('*')
      .eq('restaurant_id', tenantId)
      .eq('order_id', invoiceNo)
      .in('status', ['HELD', 'EXPIRED_RELEASED'])
      .single();

    if (!redemption) return;

    const now = new Date();
    const isExpired = new Date(redemption.expires_at) < now;

    if (redemption.status === 'HELD' && !isExpired) {
      // Normal settlement
      await supabaseAdmin
        .from('redemption_sessions')
        .update({
          status: 'SETTLED',
          order_id: posOrderId,
          completed_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('session_token', redemption.session_token);

      // Convert RESERVE to BURN in ledger
      await supabaseAdmin
        .from('loyalty_ledger')
        .insert({
          restaurant_id: tenantId,
          member_id: redemption.member_id,
          order_id: orderId,
          type: 'BURN',
          points: -redemption.points_locked,
          remaining: 0, // Will be calculated from previous
          meta: {
            redemption_session: redemption.session_token,
            settled: true
          }
        });
    } else {
      // Expired at settle time
      await supabaseAdmin
        .from('redemption_sessions')
        .update({
          status: 'NEEDS_REVIEW',
          order_id: posOrderId,
          completed_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('session_token', redemption.session_token);
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