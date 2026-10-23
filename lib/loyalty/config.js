import { z } from "zod";
const TierConfigSchema = z.object({
  name: z.string().min(1, "Tier name cannot be empty"),
  min_visits: z.number().int().min(0, "min_visits must be non-negative"),
  multiplier: z.number().positive("Multiplier must be greater than 0")
});
const BigBillSchema = z.object({
  enabled: z.boolean().default(true),
  threshold_paise: z.number().int().positive("threshold_paise must be positive"),
  bonus_points: z.number().int().min(0, "bonus_points must be non-negative")
});
const StreakSchema = z.object({
  enabled: z.boolean().default(true),
  within_days: z.number().int().positive("within_days must be positive"),
  bonus_points: z.number().int().min(0, "bonus_points must be non-negative")
});
const EarnConfigSchema = z.object({
  base_rate_bps: z.number().int().positive("base_rate_bps must be positive (e.g. 500 for 5%)"),
  eligible_amount: z.string().default("subtotal_after_discount_excl_tax_and_service_charge"),
  big_bill: BigBillSchema,
  streak: StreakSchema,
  bonus_points_expiry_days: z.number().int().positive().default(30),
  points_expiry_days: z.number().int().positive().default(90)
});
const RedeemConfigSchema = z.object({
  min_points: z.number().int().min(0).default(50),
  min_bill_paise: z.number().int().min(0).default(3e4),
  max_percent_of_bill: z.number().min(1).max(100).default(20),
  stackable_with_discounts: z.boolean().default(false),
  allowed_order_types: z.array(z.string()).default(["dine_in", "takeaway"])
});
const ReferralConfigSchema = z.object({
  enabled: z.boolean().default(true),
  referrer_points: z.number().int().min(0).default(50),
  referee_points: z.number().int().min(0).default(50),
  qualify_min_first_bill_paise: z.number().int().positive().default(3e4),
  max_referrals_per_month: z.number().int().min(1).default(10)
});
const WinbackConfigSchema = z.object({
  enabled: z.boolean().default(true),
  inactive_days: z.number().int().positive().default(21),
  multiplier: z.number().positive().default(2),
  valid_days: z.number().int().positive().default(7)
});
const GuardrailConfigSchema = z.object({
  max_effective_earn_rate_bps: z.number().int().positive().default(800)
});
const LoyaltyProgramConfigSchema = z.object({
  point_value_paise: z.number().int().positive().default(100),
  earn: EarnConfigSchema,
  tiers: z.array(TierConfigSchema).min(1, "Must define at least one tier"),
  redeem: RedeemConfigSchema,
  referral: ReferralConfigSchema,
  winback: WinbackConfigSchema,
  guardrail: GuardrailConfigSchema
}).superRefine((data, ctx) => {
  const highestTierMultiplier = Math.max(...data.tiers.map((t) => t.multiplier));
  const effectiveEarnRateBps = Math.round(data.earn.base_rate_bps * highestTierMultiplier);
  const maxGuardrailBps = data.guardrail.max_effective_earn_rate_bps;
  if (effectiveEarnRateBps > maxGuardrailBps) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `GUARDRAIL_EXCEEDED: Highest tier effective earn rate (${(effectiveEarnRateBps / 100).toFixed(2)}% / ${effectiveEarnRateBps} bps) exceeds restaurant guardrail of ${(maxGuardrailBps / 100).toFixed(2)}% (${maxGuardrailBps} bps). Risk of unprofitability.`,
      path: ["tiers"]
    });
  }
});
const DEFAULT_LOYALTY_CONFIG = {
  point_value_paise: 100,
  // 1 point = ₹1
  earn: {
    base_rate_bps: 500,
    // 5%
    eligible_amount: "subtotal_after_discount_excl_tax_and_service_charge",
    big_bill: {
      enabled: true,
      threshold_paise: 5e4,
      // ₹500
      bonus_points: 25
    },
    streak: {
      enabled: true,
      within_days: 7,
      bonus_points: 10
    },
    bonus_points_expiry_days: 30,
    points_expiry_days: 90
  },
  tiers: [
    { name: "Silver", min_visits: 0, multiplier: 1 },
    { name: "Gold", min_visits: 5, multiplier: 1.25 },
    { name: "Platinum", min_visits: 12, multiplier: 1.5 }
  ],
  redeem: {
    min_points: 50,
    min_bill_paise: 3e4,
    // ₹300
    max_percent_of_bill: 20,
    // 20%
    stackable_with_discounts: false,
    allowed_order_types: ["dine_in", "takeaway"]
  },
  referral: {
    enabled: true,
    referrer_points: 50,
    referee_points: 50,
    qualify_min_first_bill_paise: 3e4,
    // ₹300
    max_referrals_per_month: 10
  },
  winback: {
    enabled: true,
    inactive_days: 21,
    multiplier: 2,
    valid_days: 7
  },
  guardrail: {
    max_effective_earn_rate_bps: 800
    // 8.00% max cap
  }
};
const PRESET_CONFIGS = {
  conservative: {
    name: "Conservative (3% Base)",
    description: "Safe, low-cost margin protection. Recommended for high-volume, low-margin casual diners.",
    config: {
      ...DEFAULT_LOYALTY_CONFIG,
      earn: {
        ...DEFAULT_LOYALTY_CONFIG.earn,
        base_rate_bps: 300,
        big_bill: { enabled: true, threshold_paise: 6e4, bonus_points: 15 },
        streak: { enabled: true, within_days: 7, bonus_points: 5 }
      },
      tiers: [
        { name: "Silver", min_visits: 0, multiplier: 1 },
        { name: "Gold", min_visits: 6, multiplier: 1.2 },
        { name: "Platinum", min_visits: 15, multiplier: 1.35 }
      ],
      redeem: {
        ...DEFAULT_LOYALTY_CONFIG.redeem,
        max_percent_of_bill: 15
      },
      guardrail: {
        max_effective_earn_rate_bps: 500
      }
    }
  },
  standard: {
    name: "Standard (5% Base - Default)",
    description: "Balanced retention & profitability. Proven formula for Kerala cafes, bistros, and family restaurants.",
    config: DEFAULT_LOYALTY_CONFIG
  },
  aggressive: {
    name: "Aggressive Growth (7% Base)",
    description: "High reward velocity for new restaurant launches and competitive micro-markets.",
    config: {
      ...DEFAULT_LOYALTY_CONFIG,
      earn: {
        ...DEFAULT_LOYALTY_CONFIG.earn,
        base_rate_bps: 700,
        big_bill: { enabled: true, threshold_paise: 4e4, bonus_points: 35 },
        streak: { enabled: true, within_days: 7, bonus_points: 15 }
      },
      tiers: [
        { name: "Silver", min_visits: 0, multiplier: 1 },
        { name: "Gold", min_visits: 4, multiplier: 1.25 },
        { name: "Platinum", min_visits: 10, multiplier: 1.5 }
      ],
      redeem: {
        ...DEFAULT_LOYALTY_CONFIG.redeem,
        max_percent_of_bill: 25
      },
      guardrail: {
        max_effective_earn_rate_bps: 1100
      }
    }
  }
};
function validateLoyaltyConfig(config) {
  const result = LoyaltyProgramConfigSchema.safeParse(config);
  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return {
      isValid: false,
      errors
    };
  }
  const highestTierMultiplier = Math.max(...result.data.tiers.map((t) => t.multiplier));
  const effectiveBps = Math.round(result.data.earn.base_rate_bps * highestTierMultiplier);
  let warning;
  if (effectiveBps > result.data.guardrail.max_effective_earn_rate_bps * 0.9) {
    warning = `Highest tier effective earn rate (${(effectiveBps / 100).toFixed(2)}%) is close to or at your maximum guardrail (${(result.data.guardrail.max_effective_earn_rate_bps / 100).toFixed(2)}%).`;
  }
  return {
    isValid: true,
    data: result.data,
    warning
  };
}
export {
  BigBillSchema,
  DEFAULT_LOYALTY_CONFIG,
  EarnConfigSchema,
  GuardrailConfigSchema,
  LoyaltyProgramConfigSchema,
  PRESET_CONFIGS,
  RedeemConfigSchema,
  ReferralConfigSchema,
  StreakSchema,
  TierConfigSchema,
  WinbackConfigSchema,
  validateLoyaltyConfig
};
