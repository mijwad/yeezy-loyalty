/**
 * Earn Points Service
 * Core logic for crediting points from orders
 */

import prisma from '../prisma';
import { calculateEarnBasePaise, calculateEarnedPoints } from '../points';
import { normalizePhone, isDummyPhone } from '../phone';

export interface EarnPointsInput {
  outletId: string;
  customerPhone: string;
  customerName?: string;
  customerAddress?: string;
  posOrderId: string;
  invoiceNo?: string;
  orderType: string;
  paymentType: string;
  coreTotal: number; // in rupees
  total: number; // in rupees
  discountTotal: number; // in rupees
  taxTotal: number; // in rupees
  orderFrom?: string; // POS, Zomato, Swiggy
  orderJson: any; // Full Petpooja payload
  earnBaseType: 'CORE_TOTAL' | 'TOTAL' | 'CORE_MINUS_DISCOUNT';
  pointValuePaise: number;
  ignoreAggregators: boolean;
  minBillPaise: number;
}

export interface EarnPointsResult {
  success: boolean;
  pointsEarned: number;
  newBalance: number;
  orderId: string;
  message: string;
  skipped?: boolean;
  skipReason?: string;
}

/**
 * Earn points for an order
 * Idempotent on (outletId, posOrderId)
 */
export async function earnPoints(input: EarnPointsInput): Promise<EarnPointsResult> {
  const {
    outletId,
    customerPhone,
    customerName,
    customerAddress,
    posOrderId,
    invoiceNo,
    orderType,
    paymentType,
    coreTotal,
    total,
    discountTotal,
    taxTotal,
    orderFrom,
    orderJson,
    earnBaseType,
    pointValuePaise,
    ignoreAggregators,
    minBillPaise,
  } = input;

  const normalizedPhone = normalizePhone(customerPhone);

  // Check for dummy phone - silently skip earn but still record order
  const isDummy = isDummyPhone(normalizedPhone);

  // Check if aggregator order should be skipped
  const isAggregator = orderFrom && ['ZOMATO', 'SWIGGY'].includes(orderFrom.toUpperCase());
  const shouldSkipLoyalty = isDummy || (ignoreAggregators && isAggregator);

  // Calculate earn base and points
  const earnBasePaise = calculateEarnBasePaise(coreTotal, discountTotal, earnBaseType);
  const pointsToEarn = shouldSkipLoyalty ? 0 : calculateEarnedPoints(earnBasePaise, { pointValuePaise });

  // Check minimum bill
  const totalPaise = Math.round(total * 100);
  if (!shouldSkipLoyalty && totalPaise < minBillPaise) {
    return {
      success: true,
      pointsEarned: 0,
      newBalance: 0,
      orderId: '',
      message: `Order total below minimum bill of ₹${minBillPaise / 100}`,
      skipped: true,
      skipReason: 'MIN_BILL_NOT_MET',
    };
  }

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Find or create customer
    let customer = await tx.customer.findUnique({
      where: { outletId_phone: { outletId, phone: normalizedPhone } },
    });

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          outletId,
          phone: normalizedPhone,
          name: customerName,
          address: customerAddress,
        },
      });
    }

    // 2. Check idempotency - has this order already been processed?
    const existingOrder = await tx.order.findUnique({
      where: { outletId_posOrderId: { outletId, posOrderId } },
    });

    if (existingOrder) {
      // Return existing result (idempotent)
      const ledger = await tx.pointsLedger.findFirst({
        where: {
          customerId: customer.id,
          referenceType: 'ORDER',
          referenceId: posOrderId,
        },
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true,
        pointsEarned: existingOrder.earnedPoints,
        newBalance: ledger?.balanceAfter ?? 0,
        orderId: existingOrder.id,
        message: 'Transaction Recorded (duplicate)',
        skipped: shouldSkipLoyalty,
        skipReason: shouldSkipLoyalty ? (isDummy ? 'DUMMY_PHONE' : 'AGGREGATOR_ORDER') : undefined,
      };
    }

    // 3. Get current balance
    const lastLedger = await tx.pointsLedger.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
    const currentBalance = lastLedger?.balanceAfter ?? 0;
    const newBalance = currentBalance + pointsToEarn;

    // 4. Create order record
    const order = await tx.order.create({
      data: {
        outletId,
        customerId: customer.id,
        posOrderId,
        invoiceNo,
        orderType,
        paymentType,
        coreTotalPaise: Math.round(coreTotal * 100),
        totalPaise: Math.round(total * 100),
        discountTotalPaise: Math.round(discountTotal * 100),
        taxTotalPaise: Math.round(taxTotal * 100),
        orderFrom: orderFrom ?? 'POS',
        orderJson,
        earnedPoints: pointsToEarn,
        status: shouldSkipLoyalty ? 'SKIPPED_LOYALTY' : 'SETTLED',
        settledAt: shouldSkipLoyalty ? null : new Date(),
      },
    });

    // 5. Create ledger entry if points earned
    if (pointsToEarn > 0) {
      await tx.pointsLedger.create({
        data: {
          customerId: customer.id,
          outletId,
          type: 'EARN',
          points: pointsToEarn,
          balanceAfter: newBalance,
          description: `Order ${posOrderId}`,
          referenceType: 'ORDER',
          referenceId: posOrderId,
          idempotencyKey: `${outletId}:${posOrderId}`,
          metadata: { orderId: order.id, earnBasePaise },
        },
      });
    }

    return {
      success: true,
      pointsEarned: pointsToEarn,
      newBalance,
      orderId: order.id,
      message: shouldSkipLoyalty ? 'Order recorded (loyalty skipped)' : 'Transaction Recorded',
      skipped: shouldSkipLoyalty,
      skipReason: shouldSkipLoyalty ? (isDummy ? 'DUMMY_PHONE' : 'AGGREGATOR_ORDER') : undefined,
    };
  });

  return result;
}

/**
 * Get available balance for a customer
 */
export async function getAvailableBalance(outletId: string, phone: string): Promise<number> {
  const normalizedPhone = normalizePhone(phone);
  const customer = await prisma.customer.findUnique({
    where: { outletId_phone: { outletId, phone: normalizedPhone } },
  });

  if (!customer) return 0;

  const lastLedger = await prisma.pointsLedger.findFirst({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
  });

  return lastLedger?.balanceAfter ?? 0;
}