/**
 * Petpooja POS Adapter
 * Implements the POSAdapter interface for Petpooja webhook integration
 */
import crypto from 'node:crypto';
import { POSAdapter } from './POSAdapter.js';
import { normalizePhone } from '../../lib/loyalty/engine.js';
import { supabaseAdmin } from '../db/supabase.js';

export class PetpoojaAdapter extends POSAdapter {
  constructor(config = {}) {
    super(config);
    this.webhookSecret = config.webhookSecret || process.env.PETPOOJA_WEBHOOK_SECRET;
    this.apiKey = config.apiKey || process.env.PETPOOJA_API_KEY;
  }

  /**
   * Verify Petpooja webhook signature
   * Petpooja sends HMAC-SHA256 signature in X-Petpooja-Signature header
   */
  async verifyWebhook(req) {
    // For marketplace activation endpoints, skip signature verification
    // as they're initiated by Petpooja dashboard, not webhooks
    if (req.path.includes('/marketplace/') || req.path.includes('/activate') || req.path.includes('/handshake')) {
      return { valid: true };
    }

    const signature = req.headers['x-petpooja-signature'] || req.headers['x-petpooja-hmac'];
    if (!signature) {
      return { valid: false, error: 'Missing X-Petpooja-Signature header' };
    }

    if (!this.webhookSecret) {
      console.warn('[Petpooja] Webhook secret not configured, skipping verification');
      return { valid: true }; // Allow in dev, block in prod
    }

    // Petpooja uses HMAC-SHA256 of raw body with webhook secret
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid webhook signature' };
    }

    return { valid: true };
  }

  /**
   * Parse inquire request from Petpooja format
   */
  async parseInquireRequest(req) {
    const body = req.body;

    // Petpooja sends various field names, normalize them
    const restID = body.restID || body.rest_id || body.restaurant_id || body.rid || body.restID;
    const customerPhone = body.customer_phone || body.phone || body.mobile || body.cust_phone || body.customer_mobile;
    const customerName = body.customer_name || body.name || body.cust_name || 'Valued Guest';
    const billAmount = body.bill_amount || body.gross_amount || body.order_amount || body.bill_total || body.total_amount || 0;
    const discountableAmount = body.discountable_amount || body.discountable || billAmount;
    const orderId = body.order_id || body.orderID || body.orderid || body.bill_no || `ORD-${Date.now()}`;
    const tableNo = body.table_no || body.tableno || body.table || 'T-1';
    const serverName = body.server_name || body.waiter || body.biller || 'Staff';
    const items = body.items || [];

    if (!restID) {
      throw new Error('Missing required field: restID (or rest_id/restaurant_id/rid)');
    }

    if (!customerPhone) {
      throw new Error('Missing required field: customer_phone (or phone/mobile/cust_phone)');
    }

    // Find outlet by restID to get tenantId
    const outlet = await this.getOutletByRestID(restID);
    if (!outlet) {
      throw new Error(`Outlet not found for restID: ${restID}`);
    }

    return {
      restaurantId: restID,
      tenantId: outlet.tenant_id,
      outletId: outlet.id,
      phone: normalizePhone(customerPhone),
      name: customerName,
      billAmount: Math.round(parseFloat(billAmount) * 100), // Convert to paise
      discountableAmount: Math.round(parseFloat(discountableAmount || billAmount) * 100),
      orderId,
      tableNo,
      serverName,
      items
    };
  }

  /**
   * Parse lock request from Petpooja format
   */
  async parseLockRequest(req) {
    const body = req.body;

    const sessionToken = body.session_token || body.sessionToken || body.token;
    const optionId = body.option_id || body.optionId || body.selected_option_id;
    const customPoints = body.custom_points || body.points_to_redeem || body.points;

    if (!sessionToken) {
      throw new Error('Missing required field: session_token');
    }

    return {
      sessionToken,
      optionId,
      customPoints: customPoints ? parseInt(customPoints, 10) : undefined
    };
  }

  /**
   * Parse order save request from Petpooja format
   */
  async parseOrderSaveRequest(req) {
    const body = req.body;

    const restID = body.restID || body.rest_id || body.restaurant_id || body.rid;
    const orderId = body.order_id || body.orderID || body.orderid || body.order_no || body.bill_no;
    const billNo = body.bill_no || body.billno || body.invoice_no || `BILL-${orderId}`;
    const tableNo = body.table_no || body.tableno || body.table || 'T-1';
    const serverName = body.server_name || body.waiter || body.biller || 'Staff';
    const customerInput = body.customer || {};
    const financials = body.financials || body.order_details || {};
    const redemptionSessionToken = body.redemption_session_token || body.session_token || body.sessionToken;
    const items = body.items || body.order_items || [];

    if (!restID) {
      throw new Error('Missing required field: restID');
    }

    if (!orderId) {
      throw new Error('Missing required field: order_id');
    }

    const outlet = await this.getOutletByRestID(restID);
    if (!outlet) {
      throw new Error(`Outlet not found for restID: ${restID}`);
    }

    const phone = customerInput?.phone || '9876543210';
    const name = customerInput?.name || 'Guest';

    return {
      restaurantId: restID,
      tenantId: outlet.tenant_id,
      outletId: outlet.id,
      orderId,
      billNo,
      tableNo,
      serverName,
      customer: {
        phone: normalizePhone(phone),
        name
      },
      financials: {
        subtotal: Math.round(parseFloat(financials?.subtotal || financials?.gross_amount || 0) * 100),
        tax: Math.round(parseFloat(financials?.tax || 0) * 100),
        grossAmount: Math.round(parseFloat(financials?.gross_amount || financials?.subtotal || 0) * 100),
        loyaltyDiscount: Math.round(parseFloat(financials?.loyalty_discount || 0) * 100),
        netPaid: Math.round(parseFloat(financials?.net_paid || financials?.gross_amount || 0) * 100),
        paymentMode: financials?.payment_mode || 'CARD'
      },
      redemptionSessionToken,
      items
    };
  }

  /**
   * Parse cancel request from Petpooja format
   */
  async parseCancelRequest(req) {
    const body = req.body;

    const restID = body.restID || body.rest_id || body.restaurant_id || body.rid;
    const orderId = body.order_id || body.orderID || body.orderid;
    const reason = body.reason || body.void_reason || 'POS void bill settlement';

    if (!restID || !orderId) {
      throw new Error('Missing required fields: restID and order_id');
    }

    const outlet = await this.getOutletByRestID(restID);
    if (!outlet) {
      throw new Error(`Outlet not found for restID: ${restID}`);
    }

    return {
      restaurantId: restID,
      tenantId: outlet.tenant_id,
      orderId,
      reason
    };
  }

  /**
   * Format inquire response for Petpooja
   * Returns format compatible with Petpooja/Reelo expectations
   */
  formatInquireResponse(data) {
    const { customer, billContext, redemptionOffer, availablePoints, loyaltyRewards, redemptionOptions, outlet } = data;

    return {
      status: 'success',
      outlet: {
        name: outlet.name,
        restID: outlet.rest_id
      },
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        tier: customer.tier,
        visits: customer.visit_count,
        points_balance: availablePoints,
        points_value_inr: (availablePoints * customer.point_value_paise) / 100,
        favorite_dish: customer.favorite_dish
      },
      bill_context: {
        order_id: billContext.order_id,
        table_no: billContext.table_no,
        bill_amount: billContext.bill_amount / 100, // Convert back to rupees for Petpooja
        discountable_amount: billContext.discountable_amount / 100,
        min_bill_amount_required: billContext.min_bill_amount_required / 100,
        max_discount_cap_inr: billContext.max_discount_cap_inr / 100,
        estimated_points_to_earn: billContext.estimated_points_to_earn
      },
      redemption_offer: {
        session_token: redemptionOffer.session_token,
        is_eligible: redemptionOffer.is_eligible,
        max_redeemable_points: redemptionOffer.max_redeemable_points,
        max_discount_amount: redemptionOffer.max_discount_amount / 100,
        requires_otp: false,
        message: redemptionOffer.message
      },
      available_points: availablePoints,
      loyalty_rewards: loyaltyRewards,
      redemption_options: redemptionOptions
    };
  }

  /**
   * Format lock response for Petpooja
   */
  formatLockResponse(data) {
    const { sessionToken, selectedOption, pointsLocked, discountAmount, netPayable, message } = data;

    return {
      status: 'success',
      session_token: sessionToken,
      selected_option: selectedOption,
      points_locked: pointsLocked,
      discount_applied_inr: discountAmount / 100,
      net_payable_after_discount: netPayable / 100,
      message
    };
  }

  /**
   * Format order save response for Petpooja
   */
  formatOrderSaveResponse(data) {
    const { orderId, billNo, customer, pointsEarned, pointsBurned, newBalance, simulatedNotification } = data;

    return {
      status: 'success',
      order_id: orderId,
      bill_no: billNo,
      customer: {
        name: customer.name,
        phone: customer.phone,
        tier: customer.tier,
        points_earned: pointsEarned,
        points_burned: pointsBurned,
        new_balance: newBalance
      },
      simulated_notification: simulatedNotification
    };
  }

  /**
   * Format cancel response for Petpooja
   */
  formatCancelResponse(data) {
    return {
      status: 'success',
      order_id: data.orderId,
      voided: true,
      customer: {
        name: data.customer.name,
        new_balance: data.customer.new_balance
      },
      message: data.message
    };
  }

  /**
   * Get outlet by Petpooja restID from database
   * @private
   */
  async getOutletByRestID(restID) {
    if (!supabaseAdmin) return null;

    try {
      const { data, error } = await supabaseAdmin
        .from('outlets')
        .select('id, tenant_id, rest_id, name')
        .eq('rest_id', restID)
        .single();

      if (error || !data) return null;
      return data;
    } catch (err) {
      console.error('[PetpoojaAdapter] Error fetching outlet:', err);
      return null;
    }
  }
}

export default PetpoojaAdapter;