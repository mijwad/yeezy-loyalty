import prisma from "../prisma";
import { calculateEarnBasePaise, calculateEarnedPoints } from "../points";
import { normalizePhone, isDummyPhone } from "../phone";
async function earnPoints(input) {
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
    minBillPaise
  } = input;
  const normalizedPhone = normalizePhone(customerPhone);
  const isDummy = isDummyPhone(normalizedPhone);
  const isAggregator = orderFrom && ["ZOMATO", "SWIGGY"].includes(orderFrom.toUpperCase());
  const shouldSkipLoyalty = isDummy || ignoreAggregators && isAggregator;
  const earnBasePaise = calculateEarnBasePaise(coreTotal, discountTotal, earnBaseType);
  const pointsToEarn = shouldSkipLoyalty ? 0 : calculateEarnedPoints(earnBasePaise, { pointValuePaise });
  const totalPaise = Math.round(total * 100);
  if (!shouldSkipLoyalty && totalPaise < minBillPaise) {
    return {
      success: true,
      pointsEarned: 0,
      newBalance: 0,
      orderId: "",
      message: `Order total below minimum bill of \u20B9${minBillPaise / 100}`,
      skipped: true,
      skipReason: "MIN_BILL_NOT_MET"
    };
  }
  const result = await prisma.$transaction(async (tx) => {
    let customer = await tx.customer.findUnique({
      where: { outletId_phone: { outletId, phone: normalizedPhone } }
    });
    if (!customer) {
      customer = await tx.customer.create({
        data: {
          outletId,
          phone: normalizedPhone,
          name: customerName,
          address: customerAddress
        }
      });
    }
    const existingOrder = await tx.order.findUnique({
      where: { outletId_posOrderId: { outletId, posOrderId } }
    });
    if (existingOrder) {
      const ledger = await tx.pointsLedger.findFirst({
        where: {
          customerId: customer.id,
          referenceType: "ORDER",
          referenceId: posOrderId
        },
        orderBy: { createdAt: "desc" }
      });
      return {
        success: true,
        pointsEarned: existingOrder.earnedPoints,
        newBalance: ledger?.balanceAfter ?? 0,
        orderId: existingOrder.id,
        message: "Transaction Recorded (duplicate)",
        skipped: shouldSkipLoyalty,
        skipReason: shouldSkipLoyalty ? isDummy ? "DUMMY_PHONE" : "AGGREGATOR_ORDER" : void 0
      };
    }
    const lastLedger = await tx.pointsLedger.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" }
    });
    const currentBalance = lastLedger?.balanceAfter ?? 0;
    const newBalance = currentBalance + pointsToEarn;
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
        orderFrom: orderFrom ?? "POS",
        orderJson,
        earnedPoints: pointsToEarn,
        status: shouldSkipLoyalty ? "SKIPPED_LOYALTY" : "SETTLED",
        settledAt: shouldSkipLoyalty ? null : /* @__PURE__ */ new Date()
      }
    });
    if (pointsToEarn > 0) {
      await tx.pointsLedger.create({
        data: {
          customerId: customer.id,
          outletId,
          type: "EARN",
          points: pointsToEarn,
          balanceAfter: newBalance,
          description: `Order ${posOrderId}`,
          referenceType: "ORDER",
          referenceId: posOrderId,
          idempotencyKey: `${outletId}:${posOrderId}`,
          metadata: { orderId: order.id, earnBasePaise }
        }
      });
    }
    return {
      success: true,
      pointsEarned: pointsToEarn,
      newBalance,
      orderId: order.id,
      message: shouldSkipLoyalty ? "Order recorded (loyalty skipped)" : "Transaction Recorded",
      skipped: shouldSkipLoyalty,
      skipReason: shouldSkipLoyalty ? isDummy ? "DUMMY_PHONE" : "AGGREGATOR_ORDER" : void 0
    };
  });
  return result;
}
async function getAvailableBalance(outletId, phone) {
  const normalizedPhone = normalizePhone(phone);
  const customer = await prisma.customer.findUnique({
    where: { outletId_phone: { outletId, phone: normalizedPhone } }
  });
  if (!customer) return 0;
  const lastLedger = await prisma.pointsLedger.findFirst({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" }
  });
  return lastLedger?.balanceAfter ?? 0;
}
export {
  earnPoints,
  getAvailableBalance
};
