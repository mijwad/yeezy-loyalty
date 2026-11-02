/**
 * Points unit conversion utilities
 * Handles conversion between internal points and Petpooja's rupee-equivalent units
 */

export interface PointsConfig {
  pointValuePaise: number; // 1 point = X paise (default 100 = ₹1)
}

/**
 * Convert internal points to Petpooja's rupee-equivalent units
 * Petpooja expects balance_points and redeemable_points in rupee-equivalent
 * e.g., if 1 point = ₹1, then 100 points = "100"
 * e.g., if 1 point = ₹0.50, then 100 points = "50"
 */
export function pointsToRupeeEquivalent(points: number, config: PointsConfig): string {
  const rupeeEquivalent = Math.floor((points * config.pointValuePaise) / 100);
  return String(rupeeEquivalent);
}

/**
 * Convert Petpooja's rupee-equivalent units back to internal points
 * Used when customer wants to redeem N rupee-equivalent points
 * Rounds up to ensure customer gets at least what they asked for
 */
export function rupeeEquivalentToPoints(rupeeEquivalent: number, config: PointsConfig): number {
  return Math.ceil((rupeeEquivalent * 100) / config.pointValuePaise);
}

/**
 * Calculate redeemable points based on balance, bill amount, and outlet config
 */
export function calculateRedeemablePoints(
  balancePoints: number,
  billAmountPaise: number,
  config: PointsConfig,
  outletConfig: {
    minBillPaise: number;
    minPoints: number;
    maxRedeemPercent: number; // 0-100
  }
): number {
  // Check minimum bill
  if (billAmountPaise < outletConfig.minBillPaise) {
    return 0;
  }

  // Check minimum points
  if (balancePoints < outletConfig.minPoints) {
    return 0;
  }

  // Calculate max points allowed by bill percentage
  const maxPointsByBill = Math.floor(
    (billAmountPaise * outletConfig.maxRedeemPercent) / 100 / config.pointValuePaise
  );

  // Return minimum of balance and max allowed
  return Math.min(balancePoints, maxPointsByBill);
}

/**
 * Calculate discount amount in paise for a redemption
 */
export function calculateDiscountAmount(
  pointsToRedeem: number,
  reward: { discountType: 'PERCENTAGE' | 'FIXED' | 'FREE_ITEM'; discountValue?: number | null },
  billAmountPaise: number,
  config: PointsConfig
): number {
  switch (reward.discountType) {
    case 'PERCENTAGE':
      // discountValue is percentage (e.g., 10 for 10%)
      const percent = reward.discountValue ?? 0;
      return Math.floor((billAmountPaise * percent) / 100);

    case 'FIXED':
      // discountValue is amount in paise
      return reward.discountValue ?? 0;

    case 'FREE_ITEM':
      // For free items, discount is typically the item price
      // This would need to be looked up from the POS item mapping
      return reward.discountValue ?? 0;

    default:
      // Cashback-style: points * point value
      return pointsToRedeem * config.pointValuePaise;
  }
}

/**
 * Calculate earn base in paise from order totals
 * Earn base = max(0, core_total - discount_total) by default
 */
export function calculateEarnBasePaise(
  coreTotal: number,
  discountTotal: number,
  earnBaseType: 'CORE_TOTAL' | 'TOTAL' | 'CORE_MINUS_DISCOUNT'
): number {
  switch (earnBaseType) {
    case 'CORE_TOTAL':
      return Math.max(0, Math.round(coreTotal * 100));
    case 'TOTAL':
      return Math.max(0, Math.round((coreTotal + discountTotal) * 100)); // total = core + discount? depends on data
    case 'CORE_MINUS_DISCOUNT':
    default:
      return Math.max(0, Math.round(coreTotal * 100) - Math.round(discountTotal * 100));
  }
}

/**
 * Calculate points earned from earn base
 * 1 point per ₹1 by default (configurable via pointValuePaise)
 */
export function calculateEarnedPoints(earnBasePaise: number, config: PointsConfig): number {
  return Math.floor(earnBasePaise / config.pointValuePaise);
}