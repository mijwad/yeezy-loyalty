import prisma from "../prisma";
async function reserveRedemption(input) {
  const {
    outletId,
    customerPhone,
    invoiceNo,
    points,
    billAmountPaise,
    ttlSeconds = 10800,
    rewardId,
    rewardName,
    discountType,
    discountValue
  } = input;
  const normalizedPhone = customerPhone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91/, "");
  return await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { outletId_phone: { outletId, phone: normalizedPhone } }
    });
    if (!customer) {
      return { success: false, message: "Customer not found", errorCode: "MEMBER_NOT_FOUND" };
    }
    const lastLedger = await tx.pointsLedger.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" }
    });
    const availableBalance = lastLedger?.balanceAfter ?? 0;
    const existingRedemption = await tx.redemption.findFirst({
      where: {
        outletId,
        invoiceNo,
        status: "HELD"
      }
    });
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1e3);
    if (existingRedemption) {
      if (existingRedemption.expiresAt < now) {
        await tx.redemption.update({
          where: { id: existingRedemption.id },
          data: { status: "EXPIRED_RELEASED", needsReview: false }
        });
      } else if (existingRedemption.pointsBurned === points) {
        return {
          success: true,
          reservationId: existingRedemption.id,
          pointsBurned: existingRedemption.pointsBurned,
          discountAmountPaise: existingRedemption.discountAmountPaise,
          expiresAt: existingRedemption.expiresAt,
          message: "Redemption already reserved",
          idempotent: true
        };
      } else {
        await tx.redemption.update({
          where: { id: existingRedemption.id },
          data: { status: "CANCELLED" }
        });
        if (existingRedemption.reservationId) {
          await tx.pointsLedger.create({
            data: {
              customerId: customer.id,
              outletId,
              type: "RELEASE",
              points: existingRedemption.pointsBurned,
              balanceAfter: availableBalance,
              // Will be recalculated
              description: `Released expired reservation for invoice ${invoiceNo}`,
              referenceType: "REDEMPTION",
              referenceId: existingRedemption.id
            }
          });
        }
      }
    }
    const minPoints = 1;
    const maxRedeemPercent = 100;
    const minBillPaise = 0;
    if (points < minPoints) {
      return { success: false, message: `Minimum ${minPoints} points required`, errorCode: "BELOW_MIN_POINTS" };
    }
    if (availableBalance < points) {
      return { success: false, message: "Insufficient points balance", errorCode: "INSUFFICIENT_BALANCE" };
    }
    if (billAmountPaise < minBillPaise) {
      return { success: false, message: `Minimum bill amount not met`, errorCode: "MIN_BILL_NOT_MET" };
    }
    const maxPointsByBill = Math.floor(billAmountPaise * maxRedeemPercent / 100 / 100);
    if (points > maxPointsByBill) {
      return { success: false, message: `Cannot redeem more than ${maxRedeemPercent}% of bill`, errorCode: "EXCEEDS_MAX_REDEEM_PERCENT" };
    }
    let discountAmountPaise = points * 100;
    if (rewardId && discountType) {
      switch (discountType) {
        case "PERCENTAGE":
          discountAmountPaise = Math.floor(billAmountPaise * (discountValue ?? 0) / 100);
          break;
        case "FIXED":
          discountAmountPaise = discountValue ?? 0;
          break;
        case "FREE_ITEM":
          discountAmountPaise = discountValue ?? 0;
          break;
      }
    }
    const newBalance = availableBalance - points;
    await tx.pointsLedger.create({
      data: {
        customerId: customer.id,
        outletId,
        type: "RESERVE",
        points: -points,
        balanceAfter: newBalance,
        description: `Reserved for redemption invoice ${invoiceNo}`,
        referenceType: "REDEMPTION",
        referenceId: invoiceNo
      }
    });
    const redemption = await tx.redemption.create({
      data: {
        outletId,
        customerId: customer.id,
        rewardId,
        invoiceNo,
        pointsBurned: points,
        discountAmountPaise,
        status: "HELD",
        reservationId: invoiceNo,
        // Use invoiceNo as reservation reference
        expiresAt
      }
    });
    return {
      success: true,
      reservationId: redemption.id,
      pointsBurned: points,
      discountAmountPaise,
      expiresAt,
      message: "Points reserved successfully"
    };
  });
}
async function settleRedemption(input) {
  const { outletId, invoiceNo, posOrderId, orderId } = input;
  const redemption = await prisma.redemption.findFirst({
    where: {
      outletId,
      invoiceNo,
      status: { in: ["HELD", "EXPIRED_RELEASED"] }
    }
  });
  if (!redemption) {
    return { success: true, status: "NOT_FOUND", message: "No redemption to settle" };
  }
  const now = /* @__PURE__ */ new Date();
  const isExpired = redemption.expiresAt < now;
  await prisma.$transaction(async (tx) => {
    if (redemption.status === "HELD" && !isExpired) {
      await tx.pointsLedger.create({
        data: {
          customerId: redemption.customerId,
          outletId,
          type: "BURN",
          points: -redemption.pointsBurned,
          balanceAfter: 0,
          // Will be calculated
          description: `Redeemed for order ${posOrderId}`,
          referenceType: "REDEMPTION",
          referenceId: redemption.id
        }
      });
      await tx.redemption.update({
        where: { id: redemption.id },
        data: {
          status: "SETTLED",
          posOrderId,
          settledAt: now
        }
      });
    } else {
      await tx.redemption.update({
        where: { id: redemption.id },
        data: {
          status: "NEEDS_REVIEW",
          posOrderId,
          settledAt: now,
          needsReview: true,
          reviewReason: isExpired ? "HOLD_EXPIRED_AT_SETTLE" : "ALREADY_EXPIRED"
        }
      });
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        /* redemption linked via posOrderId */
      }
    });
  });
  return {
    success: true,
    status: isExpired ? "NEEDS_REVIEW" : "SETTLED",
    pointsBurned: redemption.pointsBurned,
    message: isExpired ? "Redemption settled but hold was expired (needs review)" : "Redemption settled"
  };
}
async function expireHolds() {
  const now = /* @__PURE__ */ new Date();
  const expiredRedemptions = await prisma.redemption.findMany({
    where: {
      status: "HELD",
      expiresAt: { lt: now }
    }
  });
  let expiredCount = 0;
  for (const redemption of expiredRedemptions) {
    await prisma.$transaction(async (tx) => {
      await tx.redemption.update({
        where: { id: redemption.id },
        data: { status: "EXPIRED_RELEASED" }
      });
      const lastLedger = await tx.pointsLedger.findFirst({
        where: { customerId: redemption.customerId },
        orderBy: { createdAt: "desc" }
      });
      const currentBalance = lastLedger?.balanceAfter ?? 0;
      const newBalance = currentBalance + redemption.pointsBurned;
      await tx.pointsLedger.create({
        data: {
          customerId: redemption.customerId,
          outletId: redemption.outletId,
          type: "RELEASE",
          points: redemption.pointsBurned,
          balanceAfter: newBalance,
          description: `Released expired hold for invoice ${redemption.invoiceNo}`,
          referenceType: "REDEMPTION",
          referenceId: redemption.id
        }
      });
      expiredCount++;
    });
  }
  return { expiredCount };
}
async function getRedemptionHistory(outletId, phone) {
  const normalizedPhone = phone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91/, "");
  const customer = await prisma.customer.findUnique({
    where: { outletId_phone: { outletId, phone: normalizedPhone } }
  });
  if (!customer) return [];
  return prisma.redemption.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: { reward: true }
  });
}
export {
  expireHolds,
  getRedemptionHistory,
  reserveRedemption,
  settleRedemption
};
