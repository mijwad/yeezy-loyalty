import prisma from "../prisma";
import { calculateRedeemablePoints, pointsToRupeeEquivalent } from "../points";
import { normalizePhone } from "../phone";
async function getRewards(outletId, phone, billAmount) {
  const normalizedPhone = normalizePhone(phone);
  const billAmountPaise = Math.round(billAmount * 100);
  const customer = await prisma.customer.findUnique({
    where: { outletId_phone: { outletId, phone: normalizedPhone } }
  });
  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId }
  });
  if (!outlet) {
    throw new Error("Outlet not found");
  }
  const pointsConfig = { pointValuePaise: outlet.pointValuePaise };
  let balancePoints = 0;
  if (customer) {
    const lastLedger = await prisma.pointsLedger.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" }
    });
    balancePoints = lastLedger?.balanceAfter ?? 0;
  }
  const rewards = await prisma.reward.findMany({
    where: {
      outletId,
      isActive: true,
      validFrom: { lte: /* @__PURE__ */ new Date() },
      OR: [{ validUntil: null }, { validUntil: { gte: /* @__PURE__ */ new Date() } }]
    },
    orderBy: { pointsCost: "asc" }
  });
  const redeemablePoints = calculateRedeemablePoints(
    balancePoints,
    billAmountPaise,
    pointsConfig,
    {
      minBillPaise: outlet.minBillPaise,
      minPoints: outlet.minPoints,
      maxRedeemPercent: outlet.maxRedeemPercent
    }
  );
  const balancePointsStr = pointsToRupeeEquivalent(balancePoints, pointsConfig);
  const redeemablePointsStr = pointsToRupeeEquivalent(redeemablePoints, pointsConfig);
  const normalRewards = rewards.map((reward, index) => ({
    id: index + 1,
    // Sequential IDs for Petpooja
    name: reward.name,
    points: pointsToRupeeEquivalent(reward.pointsCost, pointsConfig),
    discountType: String(reward.discountType === "PERCENTAGE" ? 1 : reward.discountType === "FIXED" ? 2 : 3),
    posItemId: reward.posItemId ?? ""
  }));
  return {
    status: true,
    otpRequired: outlet.otpRequired,
    rewardInformation: {
      normalRewards,
      name: customer?.name ?? "",
      phone: normalizedPhone,
      balancePoints: balancePointsStr,
      redeemablePoints: redeemablePointsStr
    }
  };
}
async function getRewardById(outletId, rewardId) {
  const rewards = await prisma.reward.findMany({
    where: { outletId, isActive: true },
    orderBy: { pointsCost: "asc" }
  });
  return rewards[rewardId - 1] ?? null;
}
export {
  getRewardById,
  getRewards
};
