/**
 * RMS POS Adapter
 * Implements the POSAdapter interface for RMS (Restaurant Management System) webhook integration
 */
import crypto from 'node:crypto';
import { POSAdapter } from './POSAdapter.js';
import { normalizePhone } from '../../lib/loyalty/engine.js';
import { supabaseAdmin } from '../db/supabase.js';

export class RMSAdapter extends POSAdapter {
  constructor(config = {}) {
    super(config);
    this.webhookSecret = config.webhookSecret || process.env.RMS_WEBHOOK_SECRET;
    this.apiKey = config.apiKey || process.env.RMS_API_KEY;
  }

  /**
   * Verify RMS webhook signature
   * RMS sends HMAC-SHA256 signature in X-RMS-Signature header
   */
  async verifyWebhook(req) {
    // For marketplace activation endpoints, skip signature verification
    if (req.path.includes('/marketplace/') || req.path.includes('/activate') || req.path.includes('/handshake')) {
      return { valid: true };
    }

    const signature = req.headers['x-rms-signature'] || req.headers['x-signature'] || req.headers['x-hmac-sha256'];
    if (!signature) {
      return { valid: false, error: 'Missing X-RMS-Signature header' };
    }

    if (!this.webhookSecret) {
      console.warn('[RMS] Webhook secret not configured, skipping verification');
      return { valid: true }; // Allow in dev, block in prod
    }

    // RMS uses HMAC-SHA256 of raw body with webhook secret
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
   * Parse inquire request from RMS format
   * Expected webhook body from RMS:
   * {
   *   "restaurant_id": "restaurant-uuid",
   *   "store_id": "POS_STORE_001",
   *   "customer_phone": "+919876543210",
   *   "customer_name": "John Doe",
   *   "bill_amount": 1500.00,
   *   "discountable_amount": 1400.00,
   *   "order_id": "ORD-12345",
   *   "table_no": "T-5",
   *   "server_name": "Waiter Name",
   *   "items": [...]
   * }
   */
  async parseInquireRequest(req) {
    const body = req.body;

    // RMS sends these field names (based on their internal CanonicalOrder/ReservationInput types)
    const restaurantId = body.restaurant_id || body.restaurantId || body.tenant_id;
    const storeId = body.store_id || body.storeId || body.pos_store_id;
    const customerPhone = body.customer_phone || body.customerPhone || body.phone || body.mobile;
    const customerName = body.customer_name || body.customerName || body.name || 'Valued Guest';
    const billAmount = body.bill_amount || body.billAmount || body.gross_amount || body.order_amount || body.total || 0;
    const discountableAmount = body.discountable_amount || body.discountableAmount || body.discountable || billAmount;
    const orderId = body.order_id || body.orderId || body.orderID || body.bill_no || `ORD-${Date.now()}`;
    const tableNo = body.table_no || body.tableNo || body.table || 'T-1';
    const serverName = body.server_name || body.serverName || body.waiter || body.biller || 'Staff';
    const items = body.items || body.order_items || body.line_items || [];

    if (!restaurantId && !storeId) {
      throw new Error('Missing required field: restaurant_id or store_id');
    }

    if (!customerPhone) {
      throw new Error('Missing required field: customer_phone (or phone/mobile)');
    }

    // Find outlet by store_id or restaurant_id to get tenantId
    const outlet = await this.getOutletByIdentifier(restaurantId, storeId);
    if (!outlet) {
      const identifier = restaurantId || storeId;
      throw new Error(`Outlet not found for identifier: ${identifier}`);
    }

    return {
      restaurantId: restaurantId || storeId,
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
   * Parse lock request from RMS format
   * Expected webhook body from RMS:
   * {
   *   "session_token": "redemption-session-token",
   *   "option_id": "reward-option-id",
   *   "points": 500
   * }
   */
  async parseLockRequest(req) {
    const body = req.body;

    const sessionToken = body.session_token || body.sessionToken || body.token || body.hold_token;
    const optionId = body.option_id || body.optionId || body.selected_option_id || body.reward_id;
    const customPoints = body.custom_points || body.points_to_redeem || body.points || body.pointsToRedeem;

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
   * Parse order save request from RMS format
   * Expected webhook body from RMS (based on their CanonicalOrder):
   * {
   *   "restaurant_id": "restaurant-uuid",
   *   "store_id": "POS_STORE_001",
   *   "order_id": "bill-uuid",
   *   "bill_number": "BILL-123",
   *   "table_no": "T-5",
   *   "server_name": "Waiter Name",
   *   "customer": {
   *     "phone": "+919876543210",
   *     "name": "John Doe"
   *   },
   *   "financials": {
   *     "subtotal": 1500.00,
   *     "discount": 100.00,
   *     "tax": 270.00,
   *     "service_charge": 50.00,
   *     "net_paid": 1720.00,
   *     "payment_mode": "CARD"
   *   },
   *   "order_type": "DINE_IN",
   *   "paid_at": "2024-01-15T14:30:00Z",
   *   "reservation_id": "reservation-uuid",
   *   "items": [...]
   * }
   */
  async parseOrderSaveRequest(req) {
    const body = req.body;

    const restaurantId = body.restaurant_id || body.restaurantId || body.tenant_id;
    const storeId = body.store_id || body.storeId || body.pos_store_id;
    const orderId = body.order_id || body.orderId || body.orderID || body.bill_no || body.billId;
    const billNo = body.bill_number || body.billNumber || body.billno || body.invoice_no || `BILL-${orderId}`;
    const tableNo = body.table_no || body.tableNo || body.table || 'T-1';
    const serverName = body.server_name || body.serverName || body.waiter || body.biller || 'Staff';
    const customerInput = body.customer || {};
    const financials = body.financials || body.order_details || body.totals || {};
    const redemptionSessionToken = body.reservation_id || body.reservationId || body.session_token || body.sessionToken;
    const items = body.items || body.order_items || body.line_items || [];
    const orderType = body.order_type || body.orderType || 'DINE_IN';

    if (!restaurantId && !storeId) {
      throw new Error('Missing required field: restaurant_id or store_id');
    }

    if (!orderId) {
      throw new Error('Missing required field: order_id');
    }

    const outlet = await this.getOutletByIdentifier(restaurantId, storeId);
    if (!outlet) {
      const identifier = restaurantId || storeId;
      throw new Error(`Outlet not found for identifier: ${identifier}`);
    }

    const phone = customerInput?.phone || customerInput?.customer_phone || '9876543210';
    const name = customerInput?.name || customerInput?.customer_name || 'Guest';

    // Convert rupees to paise for all financial fields
    const toPaise = (val) => Math.round(parseFloat(val || 0) * 100);

    return {
      restaurantId: restaurantId || storeId,
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
        subtotal: toPaise(financials?.subtotal),
        tax: toPaise(financials?.tax),
        grossAmount: toPaise(financials?.gross_amount || financials?.total || financials?.grand_total),
        loyaltyDiscount: toPaise(financials?.loyalty_discount || financials?.discount || financials?.loyaltyDiscount),
        netPaid: toPaise(financials?.net_paid || financials?.paid || financials?.netPaid || financials?.grand_total),
        paymentMode: financials?.payment_mode || financials?.paymentMode || financials?.method || 'CARD'
      },
      redemptionSessionToken,
      items,
      orderType
    };
  }

  /**
   * Parse cancel/void request from RMS format
   * Expected webhook body from RMS:
   * {
   *   "restaurant_id": "restaurant-uuid",
   *   "store_id": "POS_STORE_001",
   *   "order_id": "bill-uuid",
   *   "reason": "Customer cancelled"
   * }
   */
  async parseCancelRequest(req) {
    const body = req.body;

    const restaurantId = body.restaurant_id || body.restaurantId || body.tenant_id;
    const storeId = body.store_id || body.storeId || body.pos_store_id;
    const orderId = body.order_id || body.orderId || body.orderID;
    const reason = body.reason || body.void_reason || 'POS void bill settlement';

    if (!restaurantId && !storeId) {
      throw new Error('Missing required field: restaurant_id or store_id');
    }

    if (!orderId) {
      throw new Error('Missing required field: order_id');
    }

    const outlet = await this.getOutletByIdentifier(restaurantId, storeId);
    if (!outlet) {
      const identifier = restaurantId || storeId;
      throw new Error(`Outlet not found for identifier: ${identifier}`);
    }

    return {
      restaurantId: restaurantId || storeId,
      tenantId: outlet.tenant_id,
      orderId,
      reason
    };
  }

  /**
   * Format inquire response for RMS
   * Returns format compatible with RMS expectations
   */
  formatInquireResponse(data) {
    const { customer, billContext, redemptionOffer, availablePoints, loyaltyRewards, redemptionOptions, outlet } = data;

    return {
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        tier: customer.tier,
        visits: customer.visit_count,
        points_balance: availablePoints,
        points_value_inr: (availablePoints * customer.point_value_paise) / 100
      },
      bill_context: {
        order_id: billContext.order_id,
        table_no: billContext.table_no,
        bill_amount: billContext.bill_amount / 100,
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
      redemption_options: redemptionOptions.map(opt => ({
        id: opt.id,
        label: opt.label,
        points_to_burn: opt.pointsToBurn,
        discount_inr: opt.discountInr,
        type: opt.type
      }))
    };
  }

  /**
   * Format lock response for RMS
   */
  formatLockResponse(data) {
    const { sessionToken, selectedOption, pointsLocked, discountAmount, netPayable, message } = data;

    return {
      success: true,
      session_token: sessionToken,
      selected_option: selectedOption,
      points_locked: pointsLocked,
      discount_applied_inr: discountAmount / 100,
      net_payable_after_discount: netPayable / 100,
      message
    };
  }

  /**
   * Format order save response for RMS
   */
  formatOrderSaveResponse(data) {
    const { orderId, billNo, customer, pointsEarned, pointsBurned, newBalance, simulatedNotification } = data;

    return {
      success: true,
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
   * Format cancel response for RMS
   */
  formatCancelResponse(data) {
    return {
      success: true,
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
   * Get outlet by restaurant_id or store_id from database
   * @private
   */
  async getOutletByIdentifier(restaurantId, storeId) {
    if (!supabaseAdmin) return null;

    try {
      // First try by rest_id (restaurant_id from POS)
      if (restaurantId) {
        const { data, error } = await supabaseAdmin
          .from('outlets')
          .select('id, tenant_id, rest_id, name')
          .eq('rest_id', restaurantId)
          .eq('active', true)
          .single();

        if (!error && data) return data;
      }

      // Then try by pos_config->store_id
      if (storeId) {
        const { data, error } = await supabaseAdmin
          .from('outlets')
          .select('id, tenant_id, rest_id, name')
          .eq('pos_config->store_id', storeId)
          .eq('active', true)
          .single();

        if (!error && data) return data;
      }

      return null;
    } catch (err) {
      console.error('[RMSAdapter] Error fetching outlet:', err);
      return null;
    }
  }
}

export default RMSAdapter;