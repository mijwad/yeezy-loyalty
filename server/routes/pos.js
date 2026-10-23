// Petpooja POS Webhook & Loyalty API Router
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { posStore } from '../db/store.js';
import { syncCustomerToSupabase, syncOrderToSupabase } from '../db/supabase.js';

export const posRouter = Router();

/**
 * 1. POS / RMS INQUIRE API
 * Cashier inputs diner mobile number on billing screen.
 * Requests customer points balance and available discount vouchers.
 */
posRouter.post(['/loyalty/inquire', '/petpooja/loyalty/inquire'], (req, res) => {
  try {
    const restID = req.body.restID || req.body.rest_id || req.body.restaurant_id || req.body.rid || req.query?.restID || 'PP_DEL_101';
    const customer_phone = req.body.customer_phone || req.body.phone || req.body.mobile || req.body.cust_phone || req.body.customer_mobile || req.query?.customer_phone || req.query?.phone;
    const customer_name = req.body.customer_name || req.body.name || req.body.cust_name || req.query?.customer_name || 'Valued Guest';
    const bill_amount = req.body.bill_amount || req.body.gross_amount || req.body.order_amount || req.body.bill_total || req.body.total_amount || req.query?.bill_amount || 0;
    const discountable_amount = req.body.discountable_amount || req.body.discountable || bill_amount;
    const order_id = req.body.order_id || req.body.orderID || req.body.orderid || req.body.bill_no || `ORD-${Date.now()}`;
    const table_no = req.body.table_no || req.body.tableno || req.body.table || 'T-1';
    const server_name = req.body.server_name || req.body.waiter || req.body.biller || 'Staff';
    const items = req.body.items || [];

    if (!customer_phone) {
      return res.status(400).json({ status: 'error', message: 'Missing required field: customer_phone (or phone/mobile)' });
    }

  const outlet = posStore.data.outlets.find(o => o.restID === restID) || posStore.data.outlets[0];
  const program = posStore.data.loyaltyProgram;
  const customer = posStore.getOrCreateCustomer(customer_phone, customer_name);

  const billTotal = parseFloat(bill_amount) || 0;
  const discountable = parseFloat(discountable_amount || bill_amount) || billTotal;
  const pointValueInr = program.pointValueInr || 1.0;
  const currentPoints = customer.pointsBalance || 0;
  const pointsWorthInr = currentPoints * pointValueInr;

  // Business Rules:
  // - Minimum bill requirement (e.g. ₹200)
  // - Maximum allowable discount capped at 50% of discountable amount
  const isEligible = billTotal >= (program.minBillToRedeem || 200) && currentPoints > 0;
  const maxCapFromBill = (discountable * (program.maxDiscountPercentage || 50)) / 100;
  const maxEligibleDiscountInr = isEligible ? Math.min(pointsWorthInr, maxCapFromBill) : 0;
  const maxRedeemablePoints = isEligible ? Math.floor(maxEligibleDiscountInr / pointValueInr) : 0;

  // Estimated points customer will earn on this meal if paid in full (e.g. 10% earn rate)
  const earnRate = (program.pointsRate || 10) / (program.spendRate || 100);
  const estimatedPointsToEarn = Math.floor(billTotal * earnRate);

  // Generate selectable redemption options for cashier screen
  const redemptionOptions = [];

  // Option: 100 Rs off standard Petpooja milestone (exact Reelo format: "100₹ off on entire purchase (100)")
  if (currentPoints >= 100 && maxEligibleDiscountInr >= 100) {
    redemptionOptions.push({
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

  // Option: 200 Rs off milestone
  if (currentPoints >= 200 && maxEligibleDiscountInr >= 200) {
    redemptionOptions.push({
      id: 'OPT_200_OFF',
      type: 'POINTS_DISCOUNT',
      label: '200₹ off on entire purchase (200)',
      description: 'Deduct ₹200 from bill (burn 200 pts)',
      pointsToBurn: 200,
      discountInr: 200,
      eligible: true
    });
  }

  // Option 1: Maximum Points Burn
  if (maxRedeemablePoints > 0 && maxRedeemablePoints !== 100 && maxRedeemablePoints !== 200) {
    redemptionOptions.push({
      id: 'OPT_POINTS_MAX',
      type: 'POINTS_DISCOUNT',
      label: `Redeem Max Points: ₹${maxEligibleDiscountInr.toFixed(0)} OFF`,
      description: `Burn ${maxRedeemablePoints} points (50% bill cap)`,
      pointsToBurn: maxRedeemablePoints,
      discountInr: maxEligibleDiscountInr,
      eligible: true
    });
  }

  // Option 2: 500 Points standard milestone if diner has enough
  if (currentPoints >= 500 && maxEligibleDiscountInr >= 500) {
    redemptionOptions.push({
      id: 'OPT_POINTS_500',
      type: 'POINTS_DISCOUNT',
      label: `Redeem 500 Points: ₹500 OFF`,
      description: `Deduct ₹500 from bill (burn 500 pts)`,
      pointsToBurn: 500,
      discountInr: 500,
      eligible: true
    });
  }

  // Options 3+: Program Reward Tiers (Vouchers)
  if (program.rewardTiers && Array.isArray(program.rewardTiers)) {
    program.rewardTiers.forEach((tier, idx) => {
      let tierDiscount = 0;
      if (tier.rewardType === 'item') {
        tierDiscount = Math.min(250, discountable); // Free item nominal value e.g. ₹250
      } else if (tier.rewardType === 'discount_amount') {
        tierDiscount = 125;
      } else if (tier.rewardType === 'discount_percentage') {
        tierDiscount = Math.min((discountable * 0.15), 400); // 15% off capped at ₹400
      }

      const hasEnoughPoints = currentPoints >= tier.points;
      redemptionOptions.push({
        id: `OPT_TIER_${tier.id || idx}`,
        tierId: tier.id,
        type: 'TIER_VOUCHER',
        label: `${tier.title}`,
        description: `Cost: ${tier.points} pts • ${hasEnoughPoints ? 'Eligible' : 'Needs ' + (tier.points - currentPoints) + ' more pts'}`,
        pointsToBurn: tier.points,
        discountInr: Math.round(tierDiscount),
        eligible: hasEnoughPoints && tierDiscount <= maxCapFromBill
      });
    });
  }

  // Option: Custom Points Deduction
  redemptionOptions.push({
    id: 'OPT_POINTS_CUSTOM',
    type: 'CUSTOM_POINTS',
    label: `Custom Points Deduction`,
    description: `Enter points up to ${maxRedeemablePoints} pts`,
    maxPoints: maxRedeemablePoints,
    eligible: maxRedeemablePoints > 0
  });

  // Create temporary lock session token (valid for 15 mins)
  const sessionToken = `red_sess_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  posStore.data.redemptionSessions[sessionToken] = {
    sessionToken,
    customerId: customer.id,
    customerPhone: customer.phone,
    orderId: order_id || `ORD-${Date.now()}`,
    tableNo: table_no || 'T-1',
    serverName: server_name || 'Staff',
    billAmount: billTotal,
    discountableAmount: discountable,
    restID: outlet.restID,
    maxRedeemablePoints,
    maxDiscountAmount: maxEligibleDiscountInr,
    availableOptions: redemptionOptions,
    status: 'OFFERED',
    createdAt: new Date().toISOString()
  };
  posStore.persist();

  const responsePayload = {
    status: 'success',
    outlet: {
      name: outlet.name,
      restID: outlet.restID
    },
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      tier: customer.tier,
      visits: customer.visits,
      points_balance: currentPoints,
      points_value_inr: pointsWorthInr,
      favorite_dish: customer.favoriteDish
    },
    bill_context: {
      order_id: order_id || null,
      table_no: table_no || null,
      bill_amount: billTotal,
      discountable_amount: discountable,
      min_bill_amount_required: program.minBillToRedeem || 200,
      max_discount_cap_inr: maxCapFromBill,
      estimated_points_to_earn: estimatedPointsToEarn
    },
    redemption_offer: {
      session_token: sessionToken,
      is_eligible: isEligible && maxRedeemablePoints > 0,
      max_redeemable_points: maxRedeemablePoints,
      max_discount_amount: maxEligibleDiscountInr,
      requires_otp: false,
      message: maxRedeemablePoints > 0 
        ? `${customer.name} has ${currentPoints} points available. Maximum eligible discount is ₹${maxEligibleDiscountInr.toFixed(0)}.`
        : `${customer.name} has ${currentPoints} points. Minimum bill of ₹${program.minBillToRedeem || 200} required.`
    },
    available_points: currentPoints,
    loyalty_rewards: redemptionOptions,
    redemption_options: redemptionOptions
  };

  posStore.logWebhook({
    eventType: 'PETPOOJA_LOYALTY_INQUIRE',
    restID,
    orderId: order_id,
    payload: req.body,
    status: 'SUCCESS',
    response: responsePayload
  });

  return res.json(responsePayload);
} catch (err) {
  console.error('[Petpooja Inquire Error]', err);
  return res.status(500).json({ status: 'error', message: err.message || 'Internal error in loyalty inquiry' });
}
});

/**
 * 2. POS / RMS LOCK / HOLD POINTS
 * When cashier selects a redemption option, locks the points so they cannot be spent concurrently.
 */
posRouter.post(['/loyalty/lock', '/petpooja/loyalty/lock'], (req, res) => {
  try {
    const session_token = req.body.session_token || req.body.sessionToken || req.body.token;
    const option_id = req.body.option_id || req.body.optionId || req.body.selected_option_id;
    const custom_points = req.body.custom_points || req.body.points_to_redeem || req.body.points;
    const session = posStore.data.redemptionSessions[session_token];

    if (!session) {
      return res.status(404).json({ status: 'error', message: 'Redemption session expired or invalid' });
    }

  const customer = posStore.data.customers.find(c => c.id === session.customerId);
  let pointsLocked = 0;
  let discountAmount = 0;
  let selectedOption = null;

  if (option_id && session.availableOptions) {
    selectedOption = session.availableOptions.find(o => o.id === option_id);
  }

  if (selectedOption && selectedOption.type !== 'CUSTOM_POINTS') {
    pointsLocked = selectedOption.pointsToBurn;
    discountAmount = selectedOption.discountInr;
  } else {
    // Custom points or fallback
    const pts = parseInt(custom_points || req.body.points_to_redeem, 10) || session.maxRedeemablePoints;
    pointsLocked = Math.min(pts, session.maxRedeemablePoints);
    discountAmount = pointsLocked * (posStore.data.loyaltyProgram.pointValueInr || 1.0);
  }

  if (customer.pointsBalance < pointsLocked) {
    return res.status(400).json({ status: 'error', message: `Customer has only ${customer.pointsBalance} points available` });
  }

  session.status = 'LOCKED_PENDING_PAYMENT';
  session.selectedOptionId = option_id || 'CUSTOM';
  session.pointsLocked = pointsLocked;
  session.discountAmount = discountAmount;
  posStore.persist();

  const netPayable = Math.max(0, session.billAmount - discountAmount);

  const responsePayload = {
    status: 'success',
    session_token,
    selected_option: selectedOption,
    points_locked: pointsLocked,
    discount_applied_inr: discountAmount,
    net_payable_after_discount: netPayable,
    message: `₹${discountAmount} discount applied to bill (holding ${pointsLocked} points).`
  };

  posStore.logWebhook({
    eventType: 'POS_LOYALTY_LOCK',
    restID: session.restID,
    orderId: session.orderId,
    payload: req.body,
    status: 'SUCCESS',
    response: responsePayload
  });

  return res.json(responsePayload);
} catch (err) {
  console.error('[POS Lock Error]', err);
  return res.status(500).json({ status: 'error', message: err.message || 'Internal error in loyalty lock' });
}
});

/**
 * 3. POS / RMS SAVE ORDER / BILL SETTLEMENT
 * Cashier tenders and settles the bill in POS.
 * Calculates points earned, burns redeemed points, and appends to double-entry ledger.
 */
posRouter.post(['/orders/save', '/petpooja/orders/save'], (req, res) => {
  try {
    const restID = req.body.restID || req.body.rest_id || req.body.restaurant_id || req.body.rid || 'PP_DEL_101';
    const order_id = req.body.order_id || req.body.orderID || req.body.orderid || req.body.order_no || req.body.bill_no || `ORD-${Date.now()}`;
    const bill_no = req.body.bill_no || req.body.billno || req.body.invoice_no || `BILL-${order_id}`;
    const table_no = req.body.table_no || req.body.tableno || req.body.table || 'T-1';
    const server_name = req.body.server_name || req.body.waiter || req.body.biller || 'Staff';
    const customerInput = req.body.customer || {};
    const financials = req.body.financials || req.body.order_details || {};
    const redemption_session_token = req.body.redemption_session_token || req.body.session_token || req.body.sessionToken;
    const items = req.body.items || req.body.order_items || [];

    if (!order_id) {
      return res.status(400).json({ status: 'error', message: 'Missing order_id' });
    }

  // Idempotency Check: if order already processed, return existing confirmation
  const existingOrder = posStore.data.orders.find(o => o.orderId === order_id);
  if (existingOrder) {
    return res.json({
      status: 'success',
      idempotent: true,
      order_id,
      message: 'Order already ingested and points recorded.',
      order: existingOrder
    });
  }

  const phone = customerInput?.phone || '9876543210';
  const name = customerInput?.name || 'Guest';
  const customer = posStore.getOrCreateCustomer(phone, name);

  const program = posStore.data.loyaltyProgram;
  const netPaid = parseFloat(req.body.net_paid ?? financials?.net_paid ?? financials?.gross_amount ?? 0);
  const loyaltyDiscount = parseFloat(req.body.loyalty_discount ?? financials?.loyalty_discount ?? 0);

  // 1. Process Point Burn if a redemption session was active
  let pointsBurned = 0;
  if (redemption_session_token && posStore.data.redemptionSessions[redemption_session_token]) {
    const session = posStore.data.redemptionSessions[redemption_session_token];
    pointsBurned = session.pointsLocked || Math.round(loyaltyDiscount / (program.pointValueInr || 1.0));
    
    if (pointsBurned > 0) {
      posStore.recordLedgerEntry({
        customerId: customer.id,
        type: 'REDEEM_BURN',
        pointsDelta: -pointsBurned,
        orderId: order_id,
        reason: `Points redeemed for ₹${loyaltyDiscount} discount on Bill #${bill_no || order_id}`
      });
    }
    session.status = 'COMPLETED_SETTLED';
  } else if (loyaltyDiscount > 0) {
    // If POS passed loyalty_discount directly without prior session
    pointsBurned = Math.round(loyaltyDiscount / (program.pointValueInr || 1.0));
    posStore.recordLedgerEntry({
      customerId: customer.id,
      type: 'REDEEM_BURN',
      pointsDelta: -pointsBurned,
      orderId: order_id,
      reason: `Points redeemed on Bill #${bill_no || order_id}`
    });
  }

  // 2. Calculate Points Earned on eligible net spend (e.g., 10 points per ₹100 spent = 10%)
  let pointsEarned = 0;
  if (netPaid >= (program.minBillToEarn || 100)) {
    const earnRatio = (program.pointsRate || 10) / (program.spendRate || 100);
    pointsEarned = Math.min(
      Math.floor(netPaid * earnRatio),
      program.maxPointsPerBill || 5000
    );

    if (pointsEarned > 0) {
      posStore.recordLedgerEntry({
        customerId: customer.id,
        type: 'EARN_PURCHASE',
        pointsDelta: pointsEarned,
        orderId: order_id,
        reason: `Points earned on Bill #${bill_no || order_id} (Net ₹${netPaid})`
      });
    }
  }

  // 3. Update Customer aggregate lifetime stats
  customer.lifetimeSpend += netPaid;
  customer.visits += 1;
  customer.lastVisit = 'Today';
  if (items && items.length > 0) {
    const topItem = items[0]?.name || items[0]?.item_name;
    if (topItem) {
      customer.favoriteDish = topItem;
    }
  }
  posStore.updateCustomerTier(customer);

  // Update Tenant aggregate lifetime stats
  if (posStore.data.tenants && Array.isArray(posStore.data.tenants)) {
    const tenant = posStore.data.tenants.find(t => t.primaryRestID === restID) || posStore.data.tenants[0];
    if (tenant) {
      tenant.lifetimeSales = (tenant.lifetimeSales || 0) + netPaid;
      tenant.totalDiners = posStore.data.customers.length;
    }
  }

  // 4. Save Ingested Order Record
  const savedOrder = {
    orderId: order_id,
    billNo: bill_no || `BILL-${order_id}`,
    restID: restID || 'PP_DEL_101',
    tableNo: table_no || 'T-1',
    serverName: server_name || 'Staff',
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    financials: {
      subtotal: parseFloat(financials?.subtotal || netPaid),
      tax: parseFloat(financials?.tax || 0),
      grossAmount: parseFloat(financials?.gross_amount || netPaid),
      loyaltyDiscount,
      netPaid,
      paymentMode: financials?.payment_mode || 'CARD'
    },
    items: items || [],
    pointsBurned,
    pointsEarned,
    newBalance: customer.pointsBalance,
    settledAt: new Date().toISOString()
  };
  posStore.data.orders.unshift(savedOrder);
  posStore.persist();

  // Async mirror to Supabase Cloud PostgreSQL
  syncCustomerToSupabase(customer);
  syncOrderToSupabase(savedOrder);

  // 5. Generate simulated WhatsApp message invoice
  const simulatedNotification = {
    channel: 'WHATSAPP_UTILITY',
    recipient: customer.phone,
    sent: true,
    message: `Hello ${customer.name}! 🎉 Thank you for dining with us at Downtown Bistro. You earned ${pointsEarned} Yeezy loyalty points on Bill #${bill_no || order_id}. Your new total balance is ${customer.pointsBalance} points. Redeem rewards on your next visit!`
  };

  const responsePayload = {
    status: 'success',
    order_id,
    bill_no: savedOrder.billNo,
    customer: {
      name: customer.name,
      phone: customer.phone,
      tier: customer.tier,
      points_earned: pointsEarned,
      points_burned: pointsBurned,
      new_balance: customer.pointsBalance
    },
    simulated_notification: simulatedNotification
  };

  posStore.logWebhook({
    eventType: 'PETPOOJA_ORDER_SAVE',
    restID,
    orderId: order_id,
    payload: req.body,
    status: 'SUCCESS',
    response: responsePayload
  });

    return res.json(responsePayload);
  } catch (err) {
    console.error('[Petpooja Order Save Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Internal error in order settlement' });
  }
});

/**
 * 4. POS / RMS CANCEL ORDER / VOID REVERSAL
 * Manager voids bill in POS. Reverses points accrued and points burned.
 */
posRouter.post(['/orders/cancel', '/loyalty/unlock', '/petpooja/orders/cancel', '/petpooja/loyalty/unlock'], (req, res) => {
  const { restID, order_id, reason } = req.body;
  const order = posStore.data.orders.find(o => o.orderId === order_id);

  if (!order) {
    return res.status(404).json({ status: 'error', message: `Order ${order_id} not found in loyalty ledger` });
  }

  if (order.voided) {
    return res.json({ status: 'success', message: 'Order was already voided previously' });
  }

  const customer = posStore.data.customers.find(c => c.id === order.customerId);

  // Compensatory ledger entries:
  // - Deduct points that were earned
  if (order.pointsEarned > 0) {
    posStore.recordLedgerEntry({
      customerId: customer.id,
      type: 'REVERSAL_VOID',
      pointsDelta: -order.pointsEarned,
      orderId: order_id,
      reason: `Order #${order_id} voided - reversing ${order.pointsEarned} earned points`
    });
  }

  // - Restore points that were burned
  if (order.pointsBurned > 0) {
    posStore.recordLedgerEntry({
      customerId: customer.id,
      type: 'REVERSAL_VOID',
      pointsDelta: order.pointsBurned,
      orderId: order_id,
      reason: `Order #${order_id} voided - refunding ${order.pointsBurned} redeemed points`
    });
  }

  order.voided = true;
  order.voidReason = reason || 'POS void bill settlement';
  customer.lifetimeSpend = Math.max(0, customer.lifetimeSpend - order.financials.netPaid);
  customer.visits = Math.max(0, customer.visits - 1);
  posStore.updateCustomerTier(customer);
  posStore.persist();

  const responsePayload = {
    status: 'success',
    order_id,
    voided: true,
    customer: {
      name: customer.name,
      new_balance: customer.pointsBalance
    },
    message: `Order #${order_id} voided successfully. Points balance adjusted.`
  };

  posStore.logWebhook({
    eventType: 'PETPOOJA_ORDER_CANCEL',
    restID,
    orderId: order_id,
    payload: req.body,
    status: 'SUCCESS',
    response: responsePayload
  });

  return res.json(responsePayload);
});

/**
 * 5. GET WEBHOOK AUDIT LOGS
 */
posRouter.get('/webhook-logs', (req, res) => {
  return res.json({
    status: 'success',
    count: posStore.data.webhookLogs.length,
    logs: posStore.data.webhookLogs
  });
});

/**
 * 6. SIMULATE POS ORDER (Testing helper)
 * Allows developers or testing scripts to trigger an end-to-end Petpooja order in 1 call.
 */
posRouter.post('/simulate', (req, res) => {
  const { phone = '9876543210', name = 'Sarah Jenkins', amount = 1450, discount = 0 } = req.body;
  const orderId = `PP-SIM-${Date.now().toString().slice(-6)}`;

  const mockPayload = {
    restID: 'PP_DEL_101',
    order_id: orderId,
    bill_no: `BILL/${orderId}`,
    table_no: 'T-4',
    server_name: 'Alex R.',
    customer: { phone, name },
    financials: {
      subtotal: amount,
      tax: Math.round(amount * 0.05),
      gross_amount: Math.round(amount * 1.05),
      loyalty_discount: discount,
      net_paid: Math.round(amount * 1.05) - discount,
      payment_mode: 'UPI'
    },
    items: [
      { item_id: 'ITEM_01', name: 'Chef Special Pasta', qty: 2, price: 450 },
      { item_id: 'ITEM_02', name: 'Sparkling Lemonade', qty: 2, price: 150 }
    ]
  };

  // Delegate to save order logic
  req.body = mockPayload;
  return posRouter.handle(req, res);
});

/**
 * 7. PETPOOJA MARKETPLACE INTEGRATION (Exact Reelo flow)
 */
posRouter.get('/petpooja/marketplace/key', (req, res) => {
  const { tenantId, restID, outletId, email } = req.query;

  let outlet = null;
  if (outletId) {
    outlet = posStore.data.outlets.find(o => o.id === outletId);
  } else if (restID) {
    outlet = posStore.data.outlets.find(o => o.restID === restID);
  } else if (tenantId) {
    outlet = posStore.data.outlets.find(o => o.tenantId === tenantId);
  } else if (email) {
    const user = posStore.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && user.tenantId) {
      outlet = posStore.data.outlets.find(o => o.tenantId === user.tenantId);
    }
  }

  // Fallback to active/first outlet
  if (!outlet) {
    outlet = posStore.data.outlets[0] || { restID: 'PP_DEL_101', name: 'Downtown Bistro' };
  }

  if (!outlet.reeloKey) {
    outlet.reeloKey = randomUUID();
    posStore.persist();
  }

  return res.json({
    status: 'success',
    reeloKey: outlet.reeloKey,
    outletName: outlet.name,
    restID: outlet.restID,
    tenantId: outlet.tenantId,
    isConnected: !!outlet.isMarketplaceConnected
  });
});

const handlePetpoojaActivation = (req, res) => {
  try {
    const reelo_key = req.body?.reelo_key || req.body?.key || req.body?.api_key || req.body?.token || req.body?.app_key || req.query?.reelo_key || req.query?.key;
    const restID = req.body?.restID || req.body?.rest_id || req.body?.restaurant_id || req.body?.rid || req.query?.restID;
    const restaurant_name = req.body?.restaurant_name || req.body?.rest_name || req.body?.name;

    // Multi-tenant resolution: Look up restaurant SPECIFICALLY by its unique key
    let outlet = null;
    if (reelo_key) {
      outlet = posStore.data.outlets.find(o => o.reeloKey === reelo_key);
    }
    if (!outlet && restID) {
      outlet = posStore.data.outlets.find(o => o.restID === restID);
    }
    if (!outlet) {
      outlet = posStore.data.outlets[0];
    }

    outlet.isMarketplaceConnected = true;
    outlet.marketplaceConnectedAt = new Date().toISOString();
    if (restID && (!outlet.restID || outlet.restID.startsWith('PP_DEL_'))) {
      outlet.restID = restID;
    }
    if (restaurant_name) outlet.name = restaurant_name;
    if (reelo_key) outlet.reeloKey = reelo_key;
    posStore.persist();

    posStore.logWebhook({
      eventType: 'PETPOOJA_MARKETPLACE_ACTIVATION',
      restID: outlet.restID,
      payload: req.body,
      status: 'SUCCESS',
      response: { status: 'success', message: 'Integration successful on Petpooja Marketplace' }
    });

    return res.json({
      status: 'success',
      message: 'Integration successful on Petpooja Marketplace!',
      outlet: {
        name: outlet.name,
        restID: outlet.restID,
        reeloKey: outlet.reeloKey,
        connectedAt: outlet.marketplaceConnectedAt
      }
    });
  } catch (err) {
    console.error('[Petpooja Activation Error]', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Error processing Petpooja activation' });
  }
};

posRouter.post('/petpooja/marketplace/handshake', handlePetpoojaActivation);
posRouter.post('/petpooja/marketplace/activate', handlePetpoojaActivation);
posRouter.post('/petpooja/activate', handlePetpoojaActivation);
posRouter.post('/petpooja/handshake', handlePetpoojaActivation);

posRouter.post('/petpooja/marketplace/verify', (req, res) => {
  const { reelo_key, restID, tenantId } = req.body;
  let outlet = null;
  if (reelo_key) {
    outlet = posStore.data.outlets.find(o => o.reeloKey === reelo_key);
  }
  if (!outlet && restID) {
    outlet = posStore.data.outlets.find(o => o.restID === restID);
  }
  if (!outlet && tenantId) {
    outlet = posStore.data.outlets.find(o => o.tenantId === tenantId);
  }
  if (!outlet) {
    outlet = posStore.data.outlets[0];
  }

  outlet.isMarketplaceConnected = true;
  outlet.marketplaceConnectedAt = outlet.marketplaceConnectedAt || new Date().toISOString();
  posStore.persist();

  return res.json({
    status: 'success',
    message: 'Integration successful! Petpooja Marketplace is now linked to your loyalty account.',
    outlet: {
      name: outlet.name,
      restID: outlet.restID,
      reeloKey: outlet.reeloKey,
      connectedAt: outlet.marketplaceConnectedAt
    }
  });
});

posRouter.post('/petpooja/marketplace/disconnect', (req, res) => {
  const outlet = posStore.data.outlets[0];
  outlet.isMarketplaceConnected = false;
  outlet.marketplaceConnectedAt = null;
  posStore.persist();

  return res.json({
    status: 'success',
    message: 'Petpooja Marketplace integration disconnected.',
    outlet: {
      name: outlet.name,
      restID: outlet.restID,
      isMarketplaceConnected: false
    }
  });
});


