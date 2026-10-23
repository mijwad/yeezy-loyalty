// Pure Loyalty Calculation Engine
// Compliant with Section 3 & Section 7 (Acceptance Tests) of Loyalty Points Module Spec.
// All monetary values in integer paise. Points are integers.

import type {
  LoyaltyProgramConfig,
  TierConfig,
  LoyaltyMember,
  LoyaltyLedgerEntry,
  LoyaltyMultiplierRule,
  EarnInput,
  EarnResult,
  RedeemPreviewInput,
  RedeemPreviewResult,
  RedeemCommitInput,
  RedeemCommitResult,
  LedgerDelta,
  FIFOAllocation
} from './types.ts';

/**
 * Normalizes phone numbers to standard E.164 (+91 for India/Kerala).
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove spaces, parentheses, dashes, dots
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '').trim();

  // If starts with 0091, replace with +91
  if (cleaned.startsWith('0091')) {
    cleaned = '+91' + cleaned.slice(4);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = '+91' + cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = '+91' + cleaned.slice(1);
  } else if (!cleaned.startsWith('+') && cleaned.length === 10) {
    cleaned = '+91' + cleaned;
  }

  // Ensure leading plus
  if (!cleaned.startsWith('+') && cleaned.length > 0) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Evaluates the current member tier based on visit count.
 */
export function evaluateTier(visitCount: number, tiers: TierConfig[]): string {
  if (!tiers || tiers.length === 0) return 'Silver';

  // Sort descending by min_visits
  const sorted = [...tiers].sort((a, b) => b.min_visits - a.min_visits);
  const matched = sorted.find(t => visitCount >= t.min_visits);
  return matched ? matched.name : (tiers[0]?.name || 'Silver');
}

/**
 * Gets tier multiplier for a given tier name.
 */
export function getTierMultiplier(tierName: string, tiers: TierConfig[]): number {
  const tier = tiers.find(t => t.name.toLowerCase() === (tierName || '').toLowerCase());
  return tier ? tier.multiplier : 1.0;
}

/**
 * Determines highest applicable multiplier among active multiplier rules (slow-slot/festival).
 * Does not stack rules; takes the single highest active multiplier.
 */
export function findActiveRuleMultiplier(
  rules: LoyaltyMultiplierRule[],
  orderDate: Date = new Date()
): { multiplier: number; activeRule?: LoyaltyMultiplierRule } {
  if (!rules || rules.length === 0) {
    return { multiplier: 1.0 };
  }

  const dayOfWeek = orderDate.getDay(); // 0 = Sun, 1 = Mon...
  const timeStr = orderDate.toTimeString().slice(0, 8); // 'HH:mm:ss'
  const dateStr = orderDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  let highestMultiplier = 1.0;
  let selectedRule: LoyaltyMultiplierRule | undefined;

  for (const rule of rules) {
    if (!rule.is_active) continue;

    // Check day of week
    if (rule.days_of_week && !rule.days_of_week.includes(dayOfWeek)) {
      continue;
    }

    // Check date bounds if specified
    if (rule.start_date && dateStr < rule.start_date) continue;
    if (rule.end_date && dateStr > rule.end_date) continue;

    // Check time of day
    const ruleStart = rule.start_time.length === 5 ? rule.start_time + ':00' : rule.start_time;
    const ruleEnd = rule.end_time.length === 5 ? rule.end_time + ':00' : rule.end_time;
    if (timeStr < ruleStart || timeStr > ruleEnd) continue;

    if (rule.multiplier > highestMultiplier) {
      highestMultiplier = rule.multiplier;
      selectedRule = rule;
    }
  }

  return { multiplier: highestMultiplier, activeRule: selectedRule };
}

/**
 * Checks if a member is currently inside an active win-back bonus window.
 */
export function isMemberInWinbackWindow(
  lastCampaignSentAt: string | Date | null | undefined,
  validDays: number,
  now: Date = new Date()
): boolean {
  if (!lastCampaignSentAt) return false;
  const sentTime = new Date(lastCampaignSentAt).getTime();
  const windowMs = validDays * 24 * 60 * 60 * 1000;
  const diff = now.getTime() - sentTime;
  return diff >= 0 && diff <= windowMs;
}

/**
 * Calculates current ledger balance by summing points.
 */
export function calculateLedgerBalance(ledger: LoyaltyLedgerEntry[]): number {
  if (!ledger || ledger.length === 0) return 0;
  return ledger.reduce((sum, entry) => sum + entry.points, 0);
}

/**
 * 3.1 EARN ALGORITHM
 * Pure function: calculates points earned, bonuses, and new tier without DB side effects.
 */
export function calculateEarn(params: {
  config: LoyaltyProgramConfig;
  member: LoyaltyMember;
  input: EarnInput;
  existingOrderIds?: string[];
  activeRules?: LoyaltyMultiplierRule[];
  lastWinbackCampaignSentAt?: string | null;
  currentBalance?: number;
}): EarnResult {
  const { config, member, input, existingOrderIds = [], activeRules = [], lastWinbackCampaignSentAt, currentBalance = 0 } = params;

  // 1. Skip if order has no member phone
  const cleanPhone = normalizePhone(input.member_phone);
  if (!cleanPhone) {
    return {
      success: false,
      skipped: true,
      skip_reason: 'NO_MEMBER_PHONE',
      eligible_paise: 0,
      multiplier_used: 1.0,
      base_points: 0,
      big_bill_points: 0,
      streak_points: 0,
      total_points_earned: 0,
      new_balance: currentBalance,
      previous_tier: member.tier,
      new_tier: member.tier,
      ledger_entries: []
    };
  }

  // 1b. Skip if already processed (idempotency per order_id)
  if (input.order_id && existingOrderIds.includes(input.order_id)) {
    return {
      success: true,
      skipped: true,
      skip_reason: 'IDEMPOTENT_ALREADY_PROCESSED',
      eligible_paise: 0,
      multiplier_used: 1.0,
      base_points: 0,
      big_bill_points: 0,
      streak_points: 0,
      total_points_earned: 0,
      new_balance: currentBalance,
      previous_tier: member.tier,
      new_tier: member.tier,
      ledger_entries: []
    };
  }

  // 2. eligible = subtotal - discounts - points_redeemed_value (excl tax & service charge)
  const subtotal = Math.max(0, input.subtotal_paise || 0);
  const discounts = Math.max(0, input.discounts_paise || 0);
  const pointsRedeemedVal = Math.max(0, input.points_redeemed_paise || 0);
  const eligiblePaise = Math.max(0, subtotal - discounts - pointsRedeemedVal);

  const orderTime = input.order_timestamp ? new Date(input.order_timestamp) : new Date();

  // 3. Multiplier calculation
  // multiplier = tier.multiplier * max(active multiplier rules, win-back multiplier if inside winback window)
  const tierMultiplier = getTierMultiplier(member.tier, config.tiers);
  const { multiplier: ruleMultiplier } = findActiveRuleMultiplier(activeRules, orderTime);

  let winbackMultiplier = 1.0;
  if (config.winback.enabled && isMemberInWinbackWindow(lastWinbackCampaignSentAt, config.winback.valid_days, orderTime)) {
    winbackMultiplier = config.winback.multiplier;
  }

  // Highest single promotional multiplier (do not stack rules)
  const promoMultiplier = Math.max(1.0, ruleMultiplier, winbackMultiplier);
  const totalMultiplier = tierMultiplier * promoMultiplier;

  // 4. base_points = floor(eligible * base_rate_bps / 10000 * multiplier / point_value_paise)
  const pointValuePaise = config.point_value_paise || 100;
  const baseRateFraction = config.earn.base_rate_bps / 10000;
  const basePoints = Math.floor((eligiblePaise * baseRateFraction * totalMultiplier) / pointValuePaise);

  // 5. Big-bill bonus if eligible >= threshold (not multiplied)
  let bigBillPoints = 0;
  if (config.earn.big_bill.enabled && eligiblePaise >= config.earn.big_bill.threshold_paise) {
    bigBillPoints = config.earn.big_bill.bonus_points;
  }

  // 6. Streak bonus if previous visit was within within_days
  let streakPoints = 0;
  if (config.earn.streak.enabled && member.last_visit_at) {
    const prevVisit = new Date(member.last_visit_at).getTime();
    const currVisit = orderTime.getTime();
    const diffDays = (currVisit - prevVisit) / (1000 * 60 * 60 * 24);
    if (diffDays >= 0 && diffDays <= config.earn.streak.within_days) {
      streakPoints = config.earn.streak.bonus_points;
    }
  }

  // 7. Generate ledger rows with expiration dates
  const nowMs = orderTime.getTime();
  const baseExpiresAt = new Date(nowMs + config.earn.points_expiry_days * 24 * 60 * 60 * 1000).toISOString();
  const bonusExpiresAt = new Date(nowMs + config.earn.bonus_points_expiry_days * 24 * 60 * 60 * 1000).toISOString();

  const ledgerEntries: LedgerDelta[] = [];

  if (basePoints > 0) {
    ledgerEntries.push({
      type: 'earn_base',
      points: basePoints,
      remaining: basePoints,
      expires_at: baseExpiresAt,
      meta: {
        order_id: input.order_id,
        eligible_paise: eligiblePaise,
        base_rate_bps: config.earn.base_rate_bps,
        tier_multiplier: tierMultiplier,
        promo_multiplier: promoMultiplier,
        total_multiplier: totalMultiplier
      }
    });
  }

  if (bigBillPoints > 0) {
    ledgerEntries.push({
      type: 'earn_bonus_big_bill',
      points: bigBillPoints,
      remaining: bigBillPoints,
      expires_at: bonusExpiresAt,
      meta: {
        order_id: input.order_id,
        threshold_paise: config.earn.big_bill.threshold_paise,
        eligible_paise: eligiblePaise
      }
    });
  }

  if (streakPoints > 0) {
    ledgerEntries.push({
      type: 'earn_bonus_streak',
      points: streakPoints,
      remaining: streakPoints,
      expires_at: bonusExpiresAt,
      meta: {
        order_id: input.order_id,
        within_days: config.earn.streak.within_days,
        previous_visit_at: member.last_visit_at
      }
    });
  }

  const totalPointsEarned = basePoints + bigBillPoints + streakPoints;
  const newVisitCount = member.visit_count + 1;
  const newTier = evaluateTier(newVisitCount, config.tiers);

  return {
    success: true,
    eligible_paise: eligiblePaise,
    multiplier_used: totalMultiplier,
    base_points: basePoints,
    big_bill_points: bigBillPoints,
    streak_points: streakPoints,
    total_points_earned: totalPointsEarned,
    new_balance: currentBalance + totalPointsEarned,
    previous_tier: member.tier,
    new_tier: newTier,
    ledger_entries: ledgerEntries
  };
}

/**
 * 3.2 REDEEM PREVIEW ALGORITHM
 * Validates redemption prerequisites in strict order and returns clear error codes.
 */
export function previewRedeem(params: {
  config: LoyaltyProgramConfig;
  isProgramActive: boolean;
  memberBalance: number;
  input: RedeemPreviewInput;
}): RedeemPreviewResult {
  const { config, isProgramActive, memberBalance, input } = params;
  const pointValuePaise = config.point_value_paise || 100;
  const billPaise = Math.max(0, input.bill_paise || 0);

  // 1. Program active and order type allowed
  if (!isProgramActive) {
    return {
      allowed: false,
      error_code: 'PROGRAM_INACTIVE',
      error_message: 'Loyalty redemption is currently paused by the restaurant.',
      member_balance: memberBalance,
      point_value_paise: pointValuePaise,
      max_redeemable_points: 0,
      max_discount_paise: 0,
      redeem_points: 0,
      discount_paise: 0,
      remaining_balance_after_redeem: memberBalance
    };
  }

  const orderType = (input.order_type || 'dine_in').toLowerCase();
  if (config.redeem.allowed_order_types && !config.redeem.allowed_order_types.map(t => t.toLowerCase()).includes(orderType)) {
    return {
      allowed: false,
      error_code: 'ORDER_TYPE_NOT_ALLOWED',
      error_message: `Redemption is not allowed on ${orderType} orders.`,
      member_balance: memberBalance,
      point_value_paise: pointValuePaise,
      max_redeemable_points: 0,
      max_discount_paise: 0,
      redeem_points: 0,
      discount_paise: 0,
      remaining_balance_after_redeem: memberBalance
    };
  }

  // 2. balance >= min_points
  if (memberBalance < config.redeem.min_points) {
    return {
      allowed: false,
      error_code: 'BELOW_MIN_POINTS',
      error_message: `Minimum ${config.redeem.min_points} points required to redeem (current balance: ${memberBalance}).`,
      member_balance: memberBalance,
      point_value_paise: pointValuePaise,
      max_redeemable_points: 0,
      max_discount_paise: 0,
      redeem_points: 0,
      discount_paise: 0,
      remaining_balance_after_redeem: memberBalance
    };
  }

  // 3. bill_paise >= min_bill_paise
  if (billPaise < config.redeem.min_bill_paise) {
    return {
      allowed: false,
      error_code: 'MIN_BILL_NOT_MET',
      error_message: `Minimum bill of ₹${(config.redeem.min_bill_paise / 100).toFixed(0)} required for points redemption (current bill: ₹${(billPaise / 100).toFixed(0)}).`,
      member_balance: memberBalance,
      point_value_paise: pointValuePaise,
      max_redeemable_points: 0,
      max_discount_paise: 0,
      redeem_points: 0,
      discount_paise: 0,
      remaining_balance_after_redeem: memberBalance
    };
  }

  // 4. No conflicting discount applied (if stackable is false)
  if (!config.redeem.stackable_with_discounts && input.has_conflicting_discounts) {
    return {
      allowed: false,
      error_code: 'DISCOUNT_NOT_STACKABLE',
      error_message: 'Points redemption cannot be combined with existing coupon discounts.',
      member_balance: memberBalance,
      point_value_paise: pointValuePaise,
      max_redeemable_points: 0,
      max_discount_paise: 0,
      redeem_points: 0,
      discount_paise: 0,
      remaining_balance_after_redeem: memberBalance
    };
  }

  // 5. max_redeemable_points = floor(bill_paise * max_percent / 100 / point_value_paise)
  const maxDiscountPaise = Math.floor((billPaise * config.redeem.max_percent_of_bill) / 100);
  const maxRedeemablePoints = Math.floor(maxDiscountPaise / pointValuePaise);

  if (maxRedeemablePoints <= 0) {
    return {
      allowed: false,
      error_code: 'ZERO_REDEEMABLE',
      error_message: 'Bill amount is too low to redeem any points under the current bill percentage cap.',
      member_balance: memberBalance,
      point_value_paise: pointValuePaise,
      max_redeemable_points: 0,
      max_discount_paise: 0,
      redeem_points: 0,
      discount_paise: 0,
      remaining_balance_after_redeem: memberBalance
    };
  }

  // 6. redeem_points = min(requested, balance, max_redeemable_points)
  const requested = input.requested_points !== undefined ? input.requested_points : maxRedeemablePoints;
  const redeemPoints = Math.min(requested, memberBalance, maxRedeemablePoints);

  if (redeemPoints <= 0) {
    return {
      allowed: false,
      error_code: 'ZERO_REDEEMABLE',
      error_message: 'Requested points amount resulted in 0 points to redeem.',
      member_balance: memberBalance,
      point_value_paise: pointValuePaise,
      max_redeemable_points: maxRedeemablePoints,
      max_discount_paise: maxDiscountPaise,
      redeem_points: 0,
      discount_paise: 0,
      remaining_balance_after_redeem: memberBalance
    };
  }

  const discountPaise = redeemPoints * pointValuePaise;

  return {
    allowed: true,
    member_balance: memberBalance,
    point_value_paise: pointValuePaise,
    max_redeemable_points: maxRedeemablePoints,
    max_discount_paise: maxDiscountPaise,
    redeem_points: redeemPoints,
    discount_paise: discountPaise,
    remaining_balance_after_redeem: memberBalance - redeemPoints
  };
}

/**
 * 3.2 REDEEM COMMIT WITH FIFO ALLOCATION
 * Deducts points FIFO by earliest expires_at, returning decremented rows and new redeem ledger entry.
 */
export function commitRedeem(params: {
  preview: RedeemPreviewResult;
  input: RedeemCommitInput;
  activeEarnEntries: LoyaltyLedgerEntry[];
}): RedeemCommitResult {
  const { preview, input, activeEarnEntries } = params;

  if (!preview.allowed) {
    return {
      success: false,
      error_code: preview.error_code,
      error_message: preview.error_message,
      redeem_points: 0,
      discount_paise: 0,
      new_balance: preview.member_balance,
      fifo_allocations: [],
      ledger_entry: {
        type: 'redeem',
        points: 0,
        remaining: 0,
        expires_at: null,
        meta: {}
      }
    };
  }

  const pointsToBurn = preview.redeem_points;
  let pointsRemainingToDeduct = pointsToBurn;
  const allocations: FIFOAllocation[] = [];

  // Sort active earn rows FIFO by earliest expires_at (null expires_at sorted last)
  const sortedEarnEntries = [...activeEarnEntries]
    .filter(e => e.remaining > 0 && e.points > 0)
    .sort((a, b) => {
      if (!a.expires_at) return 1;
      if (!b.expires_at) return -1;
      return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
    });

  for (const entry of sortedEarnEntries) {
    if (pointsRemainingToDeduct <= 0) break;
    const deduct = Math.min(entry.remaining, pointsRemainingToDeduct);
    allocations.push({
      earn_entry_id: entry.id,
      points_deducted: deduct
    });
    pointsRemainingToDeduct -= deduct;
  }

  const ledgerEntry: LedgerDelta = {
    type: 'redeem',
    points: -pointsToBurn,
    remaining: 0,
    expires_at: null,
    meta: {
      order_id: input.order_id,
      discount_paise: preview.discount_paise,
      fifo_allocations: allocations
    }
  };

  return {
    success: true,
    redeem_points: pointsToBurn,
    discount_paise: preview.discount_paise,
    new_balance: preview.remaining_balance_after_redeem,
    fifo_allocations: allocations,
    ledger_entry: ledgerEntry
  };
}

/**
 * 3.3 EXPIRY CALCULATION (Daily Cron)
 * For earn rows with expires_at < now and remaining > 0, generates expire rows.
 */
export function calculateExpiredEntries(
  earnEntries: LoyaltyLedgerEntry[],
  now: Date = new Date()
): {
  expiredEntries: {
    original_entry_id: string;
    points_expired: number;
    expire_ledger_entry: LedgerDelta;
  }[];
  totalPointsExpired: number;
} {
  const expiredEntries: {
    original_entry_id: string;
    points_expired: number;
    expire_ledger_entry: LedgerDelta;
  }[] = [];

  let totalPointsExpired = 0;
  const nowTime = now.getTime();

  for (const entry of earnEntries) {
    if (entry.remaining > 0 && entry.expires_at) {
      const expiryTime = new Date(entry.expires_at).getTime();
      if (expiryTime < nowTime) {
        const pointsExpired = entry.remaining;
        totalPointsExpired += pointsExpired;

        expiredEntries.push({
          original_entry_id: entry.id,
          points_expired: pointsExpired,
          expire_ledger_entry: {
            type: 'expire',
            points: -pointsExpired,
            remaining: 0,
            expires_at: null,
            meta: {
              source_entry_id: entry.id,
              original_type: entry.type,
              expired_at: now.toISOString()
            }
          }
        });
      }
    }
  }

  return {
    expiredEntries,
    totalPointsExpired
  };
}

/**
 * 3.4 REFERRAL QUALIFICATION ALGORITHM
 * Qualifies referral on referee's first paid order >= qualify_min_first_bill_paise.
 * Enforces monthly cap on the referrer.
 */
export function evaluateReferralQualification(params: {
  config: LoyaltyProgramConfig;
  refereeFirstBillPaise: number;
  referrerQualifiedCountThisMonth: number;
  orderId: string;
}): {
  qualifies: boolean;
  reason?: string;
  referrer_points: number;
  referee_points: number;
} {
  const { config, refereeFirstBillPaise, referrerQualifiedCountThisMonth } = params;

  if (!config.referral.enabled) {
    return { qualifies: false, reason: 'REFERRAL_PROGRAM_DISABLED', referrer_points: 0, referee_points: 0 };
  }

  // Check minimum bill qualification
  if (refereeFirstBillPaise < config.referral.qualify_min_first_bill_paise) {
    return {
      qualifies: false,
      reason: 'FIRST_BILL_BELOW_MIN_THRESHOLD',
      referrer_points: 0,
      referee_points: 0
    };
  }

  // Check monthly cap
  if (referrerQualifiedCountThisMonth >= config.referral.max_referrals_per_month) {
    return {
      qualifies: false,
      reason: 'REFERRER_MONTHLY_CAP_REACHED',
      referrer_points: 0,
      referee_points: 0
    };
  }

  return {
    qualifies: true,
    referrer_points: config.referral.referrer_points,
    referee_points: config.referral.referee_points
  };
}

/**
 * 3.5 REFUND AND CANCEL REVERSAL ALGORITHM
 * Reverses points earned on the refunded order (proportional for partial refunds).
 * Allows negative balance if points were already spent.
 */
export function calculateOrderRefundReversal(params: {
  orderEntries: LoyaltyLedgerEntry[];
  originalOrderPaise: number;
  refundPaise: number;
  orderId: string;
}): {
  totalPointsReversed: number;
  reversalLedgerEntry: LedgerDelta | null;
} {
  const { orderEntries, originalOrderPaise, refundPaise, orderId } = params;

  // Filter only earn entries that belong to this order
  const earnEntries = orderEntries.filter(e => e.type.startsWith('earn_') && e.points > 0);
  const totalEarned = earnEntries.reduce((sum, e) => sum + e.points, 0);

  if (totalEarned <= 0) {
    return { totalPointsReversed: 0, reversalLedgerEntry: null };
  }

  const ratio = originalOrderPaise > 0 ? Math.min(1.0, refundPaise / originalOrderPaise) : 1.0;
  const pointsToReverse = Math.round(totalEarned * ratio);

  if (pointsToReverse <= 0) {
    return { totalPointsReversed: 0, reversalLedgerEntry: null };
  }

  const reversalEntry: LedgerDelta = {
    type: 'reversal',
    points: -pointsToReverse,
    remaining: 0,
    expires_at: null,
    meta: {
      order_id: orderId,
      refund_paise: refundPaise,
      original_order_paise: originalOrderPaise,
      total_points_originally_earned: totalEarned,
      refund_ratio: ratio
    }
  };

  return {
    totalPointsReversed: pointsToReverse,
    reversalLedgerEntry: reversalEntry
  };
}
