/**
 * Rewards Lookup Service
 * Get available rewards and balance for a customer
 */

import prisma from '../prisma';
import { calculateRedeemablePoints, pointsToRupeeEquivalent, PointsConfig } from '../points';
import { normalizePhone } from '../phone';

export interface RewardInfo {
  id: number;
  name: string;
  points: string; // Rupee-equivalent as string
  discountType: string; // "1" | "2" | "3"
  posItemId: string;
}

export interface GetRewardsResult {
  status: boolean;
  otpRequired: boolean;
  rewardInformation: {
    normalRewards: RewardInfo[];
    name: string;
    phone: string;
    balancePoints: string; // Rupee-equivalent
    redeemablePoints: string; // Rupee-equivalent
  };
}

/**
 * Get rewards for a customer at a specific bill amount
 */
export async function getRewards(
  outletId: string,
  phone: string,
  billAmount: number // in rupees
): Promise<GetRewardsResult> {
  const normalizedPhone = normalizePhone(phone);
  const billAmountPaise = Math.round(billAmount * 100);

  // Find customer
  const customer = await prisma.customer.findUnique({
    where: { outletId_phone: { outletId, phone: normalizedPhone } },
  });

  // Get outlet config
  const outlet = await prisma.outlet.findUnique({
    where: { id: outletId },
  });

  if (!outlet) {
    throw new Error('Outlet not found');
  }

  const pointsConfig: PointsConfig = { pointValuePaise: outlet.pointValuePaise };

  // Get balance
  let balancePoints = 0;
  if (customer) {
    const lastLedger = await prisma.pointsLedger.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
    });
    balancePoints = lastLedger?.balanceAfter ?? 0;
  }

  // Get active rewards for this outlet
  const rewards = await prisma.reward.findMany({
    where: {
      outletId,
      isActive: true,
      validFrom: { lte: new Date() },
      OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
    },
    orderBy: { pointsCost: 'asc' },
  });

  // Calculate redeemable points
  const redeemablePoints = calculateRedeemablePoints(
    balancePoints,
    billAmountPaise,
    pointsConfig,
    {
      minBillPaise: outlet.minBillPaise,
      minPoints: outlet.minPoints,
      maxRedeemPercent: outlet.maxRedeemPercent,
    }
  );

  // Convert to rupee-equivalent for Petpooja
  const balancePointsStr = pointsToRupeeEquivalent(balancePoints, pointsConfig);
  const redeemablePointsStr = pointsToRupeeEquivalent(redeemablePoints, pointsConfig);

  // Map rewards to Petpooja format
  const normalRewards: RewardInfo[] = rewards.map((reward, index) => ({
    id: index + 1, // Sequential IDs for Petpooja
    name: reward.name,
    points: pointsToRupeeEquivalent(reward.pointsCost, pointsConfig),
    discountType: String(reward.discountType === 'PERCENTAGE' ? 1 : reward.discountType === 'FIXED' ? 2 : 3),
    posItemId: reward.posItemId ?? '',
  }));

  return {
    status: true,
    otpRequired: outlet.otpRequired,
    rewardInformation: {
      normalRewards,
      name: customer?.name ?? '',
      phone: normalizedPhone,
      balancePoints: balancePointsStr,
      redeemablePoints: redeemablePointsStr,
    },
  };
}

/**
 * Get reward by ID (for redemption)
 */
export async function getRewardById(outletId: string, rewardId: number) {
  const rewards = await prisma.reward.findMany({
    where: { outletId, isActive: true },
    orderBy: { pointsCost: 'asc' },
  });

  // Petpooja uses 1-based index
  return rewards[rewardId - 1] ?? null;
}