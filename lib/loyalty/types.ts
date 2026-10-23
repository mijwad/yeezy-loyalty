// Loyalty Points Module: TypeScript Type Definitions
// Compliant with Kerala / India Restaurant Multi-Tenant Loyalty Build Spec

export type LedgerEntryType =
  | 'earn_base'
  | 'earn_bonus_big_bill'
  | 'earn_bonus_streak'
  | 'earn_referral'
  | 'earn_birthday'
  | 'earn_review'
  | 'earn_winback'
  | 'redeem'
  | 'expire'
  | 'reversal'
  | 'manual_adjust';

export type ReferralStatus = 'pending' | 'qualified' | 'rejected';

export type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'curbside';

export interface TierConfig {
  name: string;
  min_visits: number;
  multiplier: number;
}

export interface BigBillConfig {
  enabled: boolean;
  threshold_paise: number; // e.g. 50000 = ₹500
  bonus_points: number;    // e.g. 25
}

export interface StreakConfig {
  enabled: boolean;
  within_days: number;     // e.g. 7
  bonus_points: number;    // e.g. 10
}

export interface EarnConfig {
  base_rate_bps: number;   // Basis points: 500 = 5.0%
  eligible_amount: 'subtotal_after_discount_excl_tax_and_service_charge' | string;
  big_bill: BigBillConfig;
  streak: StreakConfig;
  bonus_points_expiry_days: number; // default 30
  points_expiry_days: number;       // default 90
}

export interface RedeemConfig {
  min_points: number;              // default 50
  min_bill_paise: number;          // default 30000 = ₹300
  max_percent_of_bill: number;     // default 20%
  stackable_with_discounts: boolean; // default false
  allowed_order_types: string[];   // ['dine_in', 'takeaway']
}

export interface ReferralConfig {
  enabled: boolean;
  referrer_points: number;              // default 50
  referee_points: number;               // default 50
  qualify_min_first_bill_paise: number; // default 30000 = ₹300
  max_referrals_per_month: number;      // default 10
}

export interface WinbackConfig {
  enabled: boolean;
  inactive_days: number; // default 21
  multiplier: number;    // default 2.0
  valid_days: number;    // default 7
}

export interface GuardrailConfig {
  max_effective_earn_rate_bps: number; // default 800 (8.00%)
}

export interface LoyaltyProgramConfig {
  point_value_paise: number; // default 100 = ₹1
  earn: EarnConfig;
  tiers: TierConfig[];
  redeem: RedeemConfig;
  referral: ReferralConfig;
  winback: WinbackConfig;
  guardrail: GuardrailConfig;
}

export interface LoyaltyProgramRecord {
  id: string;
  restaurant_id: string;
  is_active: boolean;
  config: LoyaltyProgramConfig;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyMember {
  id: string;
  restaurant_id: string;
  phone_e164: string;
  name: string;
  tier: string;
  joined_at: string;
  last_visit_at: string | null;
  visit_count: number;
  lifetime_spend_paise: number;
  referred_by_member_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  restaurant_id: string;
  member_id: string;
  order_id: string | null;
  type: LedgerEntryType;
  points: number;          // Positive for earn/reversal additions, negative for redeem/expire
  remaining: number;       // For earn rows, tracks FIFO unexpired points balance
  expires_at: string | null;
  meta: Record<string, any>;
  created_at: string;
}

export interface LoyaltyReferral {
  id: string;
  restaurant_id: string;
  referrer_member_id: string;
  referee_member_id: string;
  status: ReferralStatus;
  qualified_order_id: string | null;
  created_at: string;
}

export interface LoyaltyMultiplierRule {
  id: string;
  restaurant_id: string;
  name: string;
  multiplier: number;
  days_of_week: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  start_time: string;     // 'HH:mm:ss' or 'HH:mm'
  end_time: string;       // 'HH:mm:ss' or 'HH:mm'
  start_date: string | null; // 'YYYY-MM-DD'
  end_date: string | null;   // 'YYYY-MM-DD'
  is_active: boolean;
}

export interface LoyaltyCampaignLog {
  id: string;
  restaurant_id: string;
  member_id: string;
  type: string;
  sent_at: string;
  channel: string;
  converted_order_id: string | null;
}

// Earn Types
export interface EarnInput {
  restaurant_id: string;
  order_id: string;
  member_phone: string;
  member_name?: string;
  subtotal_paise: number;
  discounts_paise?: number;
  points_redeemed_paise?: number;
  tax_paise?: number;
  service_charge_paise?: number;
  order_type?: OrderType | string;
  order_timestamp?: Date | string;
  applied_multiplier?: number; // Override if precomputed
}

export interface LedgerDelta {
  type: LedgerEntryType;
  points: number;
  remaining: number;
  expires_at: string | null;
  meta: Record<string, any>;
}

export interface EarnResult {
  success: boolean;
  skipped?: boolean;
  skip_reason?: string;
  eligible_paise: number;
  multiplier_used: number;
  base_points: number;
  big_bill_points: number;
  streak_points: number;
  total_points_earned: number;
  new_balance: number;
  previous_tier: string;
  new_tier: string;
  ledger_entries: LedgerDelta[];
  referral_qualified?: boolean;
  referral_reward?: {
    referrer_id: string;
    referrer_points: number;
    referee_points: number;
  };
}

// Redeem Types
export type RedeemErrorCode =
  | 'PROGRAM_INACTIVE'
  | 'ORDER_TYPE_NOT_ALLOWED'
  | 'BELOW_MIN_POINTS'
  | 'MIN_BILL_NOT_MET'
  | 'DISCOUNT_NOT_STACKABLE'
  | 'INSUFFICIENT_BALANCE'
  | 'ZERO_REDEEMABLE'
  | 'MEMBER_NOT_FOUND'
  | 'CONCURRENT_CONFLICT';

export interface RedeemPreviewInput {
  restaurant_id: string;
  member_phone: string;
  bill_paise: number;
  requested_points?: number;
  order_type?: string;
  has_conflicting_discounts?: boolean;
}

export interface RedeemPreviewResult {
  allowed: boolean;
  error_code?: RedeemErrorCode;
  error_message?: string;
  member_balance: number;
  point_value_paise: number;
  max_redeemable_points: number;
  max_discount_paise: number;
  redeem_points: number;
  discount_paise: number;
  remaining_balance_after_redeem: number;
}

export interface RedeemCommitInput extends RedeemPreviewInput {
  order_id: string;
  redeem_points: number;
}

export interface FIFOAllocation {
  earn_entry_id: string;
  points_deducted: number;
}

export interface RedeemCommitResult {
  success: boolean;
  error_code?: RedeemErrorCode;
  error_message?: string;
  redeem_points: number;
  discount_paise: number;
  new_balance: number;
  fifo_allocations: FIFOAllocation[];
  ledger_entry: LedgerDelta;
}

// ROI Types
export interface ROIInput {
  members: number;
  visits_before_per_member: number;
  visits_after_per_member: number;
  avg_bill_paise: number;
  contribution_margin_pct: number; // e.g. 40 for 40%
  earn_rate_pct: number;           // e.g. 5 for 5%
  redemption_rate_pct: number;     // e.g. 70 for 70%
  monthly_software_cost_paise?: number; // default 0
}

export interface ROIResult {
  total_visits_after: number;
  incremental_visits: number;
  cost_paise: number;
  cost_inr: number;
  incremental_profit_paise: number;
  incremental_profit_inr: number;
  net_profit_paise: number;
  net_profit_inr: number;
  roi_pct: number;
  roi_multiple: number;
  breakeven_lift_pct: number;
  breakeven_additional_visits: number;
}
