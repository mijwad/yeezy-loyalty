/**
 * Petpooja Service
 * Business logic for each Petpooja endpoint
 */

import { prisma } from '../../lib/prisma';
import { normalizePhone, isDummyPhone, maskPhone } from '../../lib/phone';
import { getRewards as getRewardsLib } from '../../lib/loyalty/rewards';
import { reserveRedemption, settleRedemption, expireHolds } from '../../lib/loyalty/redeem';
import { earnPoints, getAvailableBalance } from '../../lib/loyalty/earn';
import { pointsToRupeeEquivalent, rupeeEquivalentToPoints, calculateEarnBasePaise, calculateEarnedPoints, PointsConfig } from '../../lib/points';
import { SaveOrderRequest, GetRewardsRequest, RedeemRequest, VerifyOtpRequest } from './schemas';

interface PetpoojaOutlet {
  id: string;
  restaurantId: string;
  name: string;
  eateryBranchCode: string;
  pointValuePaise: number;
  earnBase: 'CORE_TOTAL' | 'TOTAL' | 'CORE_MINUS_DISCOUNT';
  ignoreAggregators: boolean;
  minBillPaise: number;
  minPoints: number;
  maxRedeemPercent: number;
  otpRequired: boolean;
}

/**
 * Log webhook request/response for debugging
 */
async function logWebhook(
  outletId: string,
  endpoint: string,
  requestBody: any,
  responseBody: any,
  statusCode: number,
  latencyMs: number,
  success: boolean,
  errorMessage?: string
) {
  // Redact sensitive data
  const redactedRequest = JSON.parse(JSON.stringify(requestBody));
  if (redactedRequest.token) redactedRequest.token = '***REDACTED***';
  if (redactedRequest.number) redactedRequest.number = maskPhone(redactedRequest.number);
  if (redactedRequest.data?.Customer?.phone) redactedRequest.data.Customer.phone = maskPhone(redactedRequest.data.Customer.phone);
  if (redactedRequest.otp) redactedRequest.otp = '***REDACTED***';

  const redactedResponse = JSON.parse(JSON.stringify(responseBody));
  // Don't log full response if large

  await prisma.webhookLog.create({
    data: {
      outletId,
      endpoint,
      requestBody: redactedRequest,
      responseBody: redactedResponse,
      statusCode,
      latencyMs,
      success,
      errorMessage,
    },
  }).catch((err) => {
    console.error('Failed to log webhook:', err);
  });
}

/**
 * Handle Save Order (Earn Points)
 * POST /integrations/petpooja/saveOrder
 */
export async function handleSaveOrder(reqBody: SaveOrderRequest, outlet: PetpoojaOutlet) {
  const startTime = Date.now();
  const { data } = reqBody;

  const {
    Restaurant,
    Customer,
    Order,
    OrderItem,
    Tax,
    Discount,
  } = data;

  // Normalize phone
  const normalizedPhone = normalizePhone(Customer.phone);
  const isDummy = isDummyPhone(normalizedPhone);

  // Extract order details (handle string numbers)
  const orderID = String(Order.orderID);
  const invoiceNo = Order.invoice_no ? String(Order.invoice_no) : undefined;
  const coreTotal = Number(Order.core_total);
  const total = Number(Order.total);
  const discountTotal = Number(Order.discount_total);
  const taxTotal = Number(Order.tax_total);
  const orderFrom = Order.orderFrom?.toUpperCase() || 'POS';

  // Points config
  const pointsConfig: PointsConfig = { pointValuePaise: outlet.pointValuePaise };

  // Calculate earn base and points
  const earnBasePaise = calculateEarnBasePaise(coreTotal, discountTotal, outlet.earnBase);
  const pointsToEarn = calculateEarnedPoints(earnBasePaise, pointsConfig);

  // Check if aggregator order should be skipped
  const isAggregator = ['ZOMATO', 'SWIGGY'].includes(orderFrom);
  const shouldSkipLoyalty = isDummy || (outlet.ignoreAggregators && isAggregator);

  // Check minimum bill
  const totalPaise = Math.round(total * 100);
  if (!shouldSkipLoyalty && totalPaise < outlet.minBillPaise) {
    const response = {
      status: true,
      message: `Order recorded (loyalty skipped: minimum bill ₹${outlet.minBillPaise / 100} not met)`,
    };
    await logWebhook(outlet.id, 'saveOrder', reqBody, response, 200, Date.now() - startTime, true);
    return response;
  }

  // Call earn service
  const result = await earnPoints({
    outletId: outlet.id,
    customerPhone: normalizedPhone,
    customerName: Customer.name,
    customerAddress: Customer.address,
    posOrderId: orderID,
    invoiceNo,
    orderType: Order.order_type,
    paymentType: Order.payment_type,
    coreTotal,
    total,
    discountTotal,
    taxTotal,
    orderFrom,
    orderJson: data,
    earnBaseType: outlet.earnBase,
    pointValuePaise: outlet.pointValuePaise,
    ignoreAggregators: outlet.ignoreAggregators,
    minBillPaise: outlet.minBillPaise,
  });

  // If there's a prior redemption for this invoice, settle it
  if (invoiceNo && !shouldSkipLoyalty) {
    await settleRedemption({
      outletId: outlet.id,
      invoiceNo,
      posOrderId: orderID,
      orderId: result.orderId,
    });
  }

  const response = {
    status: true,
    message: result.message,
  };

  await logWebhook(outlet.id, 'saveOrder', reqBody, response, 200, Date.now() - startTime, true);
  return response;
}

/**
 * Handle Get Rewards
 * POST /integrations/petpooja/getRewards
 */
export async function handleGetRewards(reqBody: GetRewardsRequest, outlet: PetpoojaOutlet) {
  const startTime = Date.now();

  const phone = reqBody.number;
  const billAmount = Number(reqBody.bill_amount);

  try {
    const result = await getRewardsLib(outlet.id, phone, billAmount);

    const response = {
      status: result.status,
      otp_required: result.otpRequired,
      reward_information: result.rewardInformation,
    };

    await logWebhook(outlet.id, 'getRewards', reqBody, response, 200, Date.now() - startTime, true);
    return response;
  } catch (error) {
    const response = { status: false, message: 'Failed to fetch rewards' };
    await logWebhook(outlet.id, 'getRewards', reqBody, response, 200, Date.now() - startTime, false, String(error));
    return response;
  }
}

/**
 * Handle Redeem / Send OTP
 * POST /integrations/petpooja/redeem
 */
export async function handleRedeem(reqBody: RedeemRequest, outlet: PetpoojaOutlet) {
  const startTime = Date.now();

  const phone = reqBody.number;
  const rewardPoints = reqBody.reward_points; // Reward ID (for catalog rewards)
  const points = reqBody.points; // Cashback points
  const invoiceAmount = Number(reqBody.invoice_amount);
  const invoiceNo = String(reqBody.invoice_no);

  const pointsConfig: PointsConfig = { pointValuePaise: outlet.pointValuePaise };
  const billAmountPaise = Math.round(invoiceAmount * 100);

  // For v1: only support cashback (points field), not catalog rewards
  // If reward_points is provided, try to look up the reward
  let pointsToRedeem = points;
  let rewardName = 'Redeem points';
  let rewardType = '2'; // Fixed discount

  if (rewardPoints && !points) {
    // Catalog reward - look up by ID (1-based index)
    const rewardId = parseInt(rewardPoints, 10);
    const rewards = await prisma.reward.findMany({
      where: { outletId: outlet.id, isActive: true },
      orderBy: { pointsCost: 'asc' },
    });
    const reward = rewards[rewardId - 1];
    if (reward) {
      pointsToRedeem = reward.pointsCost;
      rewardName = reward.name;
      rewardType = String(reward.discountType === 'PERCENTAGE' ? 1 : reward.discountType === 'FIXED' ? 2 : 3);
    }
  }

  if (!pointsToRedeem || pointsToRedeem <= 0) {
    const response = { status: false, message: 'Invalid redemption points' };
    await logWebhook(outlet.id, 'redeem', reqBody, response, 200, Date.now() - startTime, false);
    return response;
  }

  // Convert rupee-equivalent to internal points if needed
  // Petpooja sends points in rupee-equivalent, convert to internal
  const internalPoints = rupeeEquivalentToPoints(pointsToRedeem, pointsConfig);

  const result = await reserveRedemption({
    outletId: outlet.id,
    customerPhone: phone,
    invoiceNo,
    points: internalPoints,
    billAmountPaise,
    ttlSeconds: 10800,
    rewardName,
    discountType: rewardType === '1' ? 'PERCENTAGE' : rewardType === '2' ? 'FIXED' : 'FREE_ITEM',
  });

  let response: any;
  if (result.success) {
    response = {
      status: true,
      message: 'success',
      reward_name: rewardName,
      reward_type: rewardType,
    };
  } else {
    // Map error codes to cashier-friendly messages
    const errorMessages: Record<string, string> = {
      MEMBER_NOT_FOUND: 'Customer not enrolled in loyalty program',
      BELOW_MIN_POINTS: `Minimum ${outlet.minPoints} points required for redemption`,
      INSUFFICIENT_BALANCE: 'Insufficient points balance',
      MIN_BILL_NOT_MET: `Minimum bill amount of ₹${outlet.minBillPaise / 100} not met`,
      EXCEEDS_MAX_REDEEM_PERCENT: `Cannot redeem more than ${outlet.maxRedeemPercent}% of bill value`,
    };
    response = {
      status: false,
      message: errorMessages[result.errorCode || ''] || result.message,
    };
  }

  await logWebhook(outlet.id, 'redeem', reqBody, response, 200, Date.now() - startTime, result.success);
  return response;
}

/**
 * Handle Verify OTP / Redeem
 * POST /integrations/petpooja/verifyOtp
 */
export async function handleVerifyOtp(reqBody: VerifyOtpRequest, outlet: PetpoojaOutlet) {
  const startTime = Date.now();

  // For v1: OTP not enabled, return not enabled message
  // In future: verify OTP, then call reserveRedemption or settleRedemption

  const response = {
    status: false,
    message: 'OTP verification is not enabled',
  };

  await logWebhook(outlet.id, 'verifyOtp', reqBody, response, 200, Date.now() - startTime, false);
  return response;
}

/**
 * Run expire holds cleanup (can be called via cron)
 */
export async function runExpireHolds() {
  return expireHolds();
}