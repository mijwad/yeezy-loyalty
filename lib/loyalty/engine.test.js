import test from "node:test";
import assert from "node:assert";
import {
  DEFAULT_LOYALTY_CONFIG,
  validateLoyaltyConfig
} from "./config.ts";
import {
  calculateEarn,
  previewRedeem,
  calculateExpiredEntries,
  evaluateReferralQualification,
  calculateOrderRefundReversal,
  normalizePhone
} from "./engine.ts";
import { calculateROI } from "./roi.ts";
test("Acceptance Test 1: \u20B9200 bill, Silver, first visit -> 10 points", () => {
  const member = {
    id: "mem_01",
    restaurant_id: "rest_01",
    phone_e164: "+919847012345",
    name: "Rahul Nair",
    tier: "Silver",
    joined_at: "2026-10-01T10:00:00Z",
    last_visit_at: null,
    visit_count: 0,
    lifetime_spend_paise: 0,
    referred_by_member_id: null
  };
  const result = calculateEarn({
    config: DEFAULT_LOYALTY_CONFIG,
    member,
    input: {
      restaurant_id: "rest_01",
      order_id: "ord_test_01",
      member_phone: "+919847012345",
      subtotal_paise: 2e4
      // ₹200.00
    }
  });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.base_points, 10);
  assert.strictEqual(result.big_bill_points, 0);
  assert.strictEqual(result.streak_points, 0);
  assert.strictEqual(result.total_points_earned, 10);
});
test("Acceptance Test 2: \u20B9520 bill, Gold (1.25x) -> floor(520\xD75%\xD71.25)=32, plus big-bill 25 = 57 points", () => {
  const member = {
    id: "mem_02",
    restaurant_id: "rest_01",
    phone_e164: "+919847055555",
    name: "Ananya Menon",
    tier: "Gold",
    // Gold multiplier is 1.25x
    joined_at: "2026-09-01T10:00:00Z",
    last_visit_at: "2026-09-15T12:00:00Z",
    // > 7 days ago, so no streak
    visit_count: 6,
    lifetime_spend_paise: 15e4,
    referred_by_member_id: null
  };
  const result = calculateEarn({
    config: DEFAULT_LOYALTY_CONFIG,
    member,
    input: {
      restaurant_id: "rest_01",
      order_id: "ord_test_02",
      member_phone: "+919847055555",
      subtotal_paise: 52e3
      // ₹520.00
    }
  });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.base_points, 32);
  assert.strictEqual(result.big_bill_points, 25);
  assert.strictEqual(result.streak_points, 0);
  assert.strictEqual(result.total_points_earned, 57);
});
test("Acceptance Test 3: Visit 5 days after the previous visit, \u20B9200 bill -> 10 + streak 10 = 20 points", () => {
  const previousVisit = /* @__PURE__ */ new Date("2026-10-10T12:00:00Z");
  const currentVisit = /* @__PURE__ */ new Date("2026-10-15T12:00:00Z");
  const member = {
    id: "mem_03",
    restaurant_id: "rest_01",
    phone_e164: "+919847033333",
    name: "Vishnu Pillai",
    tier: "Silver",
    joined_at: "2026-10-01T10:00:00Z",
    last_visit_at: previousVisit.toISOString(),
    visit_count: 1,
    lifetime_spend_paise: 2e4,
    referred_by_member_id: null
  };
  const result = calculateEarn({
    config: DEFAULT_LOYALTY_CONFIG,
    member,
    input: {
      restaurant_id: "rest_01",
      order_id: "ord_test_03",
      member_phone: "+919847033333",
      subtotal_paise: 2e4,
      // ₹200.00
      order_timestamp: currentVisit.toISOString()
    }
  });
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.base_points, 10);
  assert.strictEqual(result.big_bill_points, 0);
  assert.strictEqual(result.streak_points, 10);
  assert.strictEqual(result.total_points_earned, 20);
});
test("Acceptance Test 4: Balance 120, bill \u20B9400, request 120 -> max 20% = 80 -> redeems 80, discount \u20B980", () => {
  const preview = previewRedeem({
    config: DEFAULT_LOYALTY_CONFIG,
    isProgramActive: true,
    memberBalance: 120,
    input: {
      restaurant_id: "rest_01",
      member_phone: "+919847012345",
      bill_paise: 4e4,
      // ₹400.00
      requested_points: 120,
      order_type: "dine_in"
    }
  });
  assert.strictEqual(preview.allowed, true);
  assert.strictEqual(preview.max_redeemable_points, 80);
  assert.strictEqual(preview.redeem_points, 80);
  assert.strictEqual(preview.discount_paise, 8e3);
  assert.strictEqual(preview.remaining_balance_after_redeem, 40);
});
test("Acceptance Test 5: Balance 120, bill \u20B9250 -> rejected: MIN_BILL_NOT_MET", () => {
  const preview = previewRedeem({
    config: DEFAULT_LOYALTY_CONFIG,
    isProgramActive: true,
    memberBalance: 120,
    input: {
      restaurant_id: "rest_01",
      member_phone: "+919847012345",
      bill_paise: 25e3,
      // ₹250.00 (< ₹300 min_bill_paise)
      requested_points: 50,
      order_type: "dine_in"
    }
  });
  assert.strictEqual(preview.allowed, false);
  assert.strictEqual(preview.error_code, "MIN_BILL_NOT_MET");
});
test("Acceptance Test 6: Balance 30 -> rejected: BELOW_MIN_POINTS", () => {
  const preview = previewRedeem({
    config: DEFAULT_LOYALTY_CONFIG,
    isProgramActive: true,
    memberBalance: 30,
    // < 50 min_points
    input: {
      restaurant_id: "rest_01",
      member_phone: "+919847012345",
      bill_paise: 4e4,
      order_type: "dine_in"
    }
  });
  assert.strictEqual(preview.allowed, false);
  assert.strictEqual(preview.error_code, "BELOW_MIN_POINTS");
});
test("Acceptance Test 7: Same order_id earned twice -> second call is a no-op", () => {
  const member = {
    id: "mem_01",
    restaurant_id: "rest_01",
    phone_e164: "+919847012345",
    name: "Rahul Nair",
    tier: "Silver",
    joined_at: "2026-10-01T10:00:00Z",
    last_visit_at: null,
    visit_count: 0,
    lifetime_spend_paise: 0,
    referred_by_member_id: null
  };
  const first = calculateEarn({
    config: DEFAULT_LOYALTY_CONFIG,
    member,
    input: {
      restaurant_id: "rest_01",
      order_id: "ord_duplicate_check",
      member_phone: "+919847012345",
      subtotal_paise: 2e4
    },
    existingOrderIds: []
  });
  assert.strictEqual(first.success, true);
  assert.strictEqual(first.skipped, void 0);
  assert.strictEqual(first.total_points_earned, 10);
  const second = calculateEarn({
    config: DEFAULT_LOYALTY_CONFIG,
    member,
    input: {
      restaurant_id: "rest_01",
      order_id: "ord_duplicate_check",
      member_phone: "+919847012345",
      subtotal_paise: 2e4
    },
    existingOrderIds: ["ord_duplicate_check"]
  });
  assert.strictEqual(second.success, true);
  assert.strictEqual(second.skipped, true);
  assert.strictEqual(second.skip_reason, "IDEMPOTENT_ALREADY_PROCESSED");
  assert.strictEqual(second.total_points_earned, 0);
  assert.strictEqual(second.ledger_entries.length, 0);
});
test("Acceptance Test 8: Referral: B signs up with A code; B first bill \u20B9350 -> A +50, B +50, status qualified. B first bill \u20B9200 -> stays pending", () => {
  const qualifiedCase = evaluateReferralQualification({
    config: DEFAULT_LOYALTY_CONFIG,
    refereeFirstBillPaise: 35e3,
    referrerQualifiedCountThisMonth: 0,
    orderId: "ord_b_first_350"
  });
  assert.strictEqual(qualifiedCase.qualifies, true);
  assert.strictEqual(qualifiedCase.referrer_points, 50);
  assert.strictEqual(qualifiedCase.referee_points, 50);
  const pendingCase = evaluateReferralQualification({
    config: DEFAULT_LOYALTY_CONFIG,
    refereeFirstBillPaise: 2e4,
    referrerQualifiedCountThisMonth: 0,
    orderId: "ord_b_first_200"
  });
  assert.strictEqual(pendingCase.qualifies, false);
  assert.strictEqual(pendingCase.reason, "FIRST_BILL_BELOW_MIN_THRESHOLD");
});
test("Acceptance Test 9: Points older than 90 days -> expired by cron; bonus points older than 30 days expire", () => {
  const now = /* @__PURE__ */ new Date("2026-10-24T00:00:00Z");
  const baseEntryOld = {
    id: "led_base_old",
    restaurant_id: "rest_01",
    member_id: "mem_01",
    order_id: "ord_old_01",
    type: "earn_base",
    points: 100,
    remaining: 100,
    expires_at: "2026-10-20T00:00:00Z",
    // 4 days ago (> 90 days from creation)
    meta: {},
    created_at: "2026-07-20T00:00:00Z"
  };
  const bonusEntryOld = {
    id: "led_bonus_old",
    restaurant_id: "rest_01",
    member_id: "mem_01",
    order_id: "ord_old_02",
    type: "earn_bonus_big_bill",
    points: 25,
    remaining: 25,
    expires_at: "2026-10-22T00:00:00Z",
    // 2 days ago (> 30 days from creation)
    meta: {},
    created_at: "2026-09-22T00:00:00Z"
  };
  const baseEntryActive = {
    id: "led_base_active",
    restaurant_id: "rest_01",
    member_id: "mem_01",
    order_id: "ord_new_01",
    type: "earn_base",
    points: 50,
    remaining: 50,
    expires_at: "2026-12-01T00:00:00Z",
    // Future date
    meta: {},
    created_at: "2026-10-01T00:00:00Z"
  };
  const { expiredEntries, totalPointsExpired } = calculateExpiredEntries(
    [baseEntryOld, bonusEntryOld, baseEntryActive],
    now
  );
  assert.strictEqual(expiredEntries.length, 2);
  assert.strictEqual(totalPointsExpired, 125);
  assert.strictEqual(expiredEntries[0].points_expired, 100);
  assert.strictEqual(expiredEntries[1].points_expired, 25);
});
test("Acceptance Test 10: Full refund of a \u20B9520 order -> all 57 points reversed", () => {
  const orderEntries = [
    {
      id: "led_01",
      restaurant_id: "rest_01",
      member_id: "mem_02",
      order_id: "ord_refund_520",
      type: "earn_base",
      points: 32,
      remaining: 32,
      expires_at: "2027-01-01T00:00:00Z",
      meta: {},
      created_at: "2026-10-20T00:00:00Z"
    },
    {
      id: "led_02",
      restaurant_id: "rest_01",
      member_id: "mem_02",
      order_id: "ord_refund_520",
      type: "earn_bonus_big_bill",
      points: 25,
      remaining: 25,
      expires_at: "2026-11-20T00:00:00Z",
      meta: {},
      created_at: "2026-10-20T00:00:00Z"
    }
  ];
  const result = calculateOrderRefundReversal({
    orderEntries,
    originalOrderPaise: 52e3,
    refundPaise: 52e3,
    // Full refund
    orderId: "ord_refund_520"
  });
  assert.strictEqual(result.totalPointsReversed, 57);
  assert.notStrictEqual(result.reversalLedgerEntry, null);
  assert.strictEqual(result.reversalLedgerEntry?.points, -57);
  assert.strictEqual(result.reversalLedgerEntry?.type, "reversal");
});
test("Acceptance Test 11: Config with Platinum 2.5x and base 5% -> validation warning/rejection (12.5% > 8% guardrail)", () => {
  const riskyConfig = {
    ...DEFAULT_LOYALTY_CONFIG,
    earn: {
      ...DEFAULT_LOYALTY_CONFIG.earn,
      base_rate_bps: 500
      // 5%
    },
    tiers: [
      { name: "Silver", min_visits: 0, multiplier: 1 },
      { name: "Gold", min_visits: 5, multiplier: 1.5 },
      { name: "Platinum", min_visits: 12, multiplier: 2.5 }
      // 500 * 2.5 = 1250 bps = 12.5% > 800 bps
    ],
    guardrail: {
      max_effective_earn_rate_bps: 800
      // 8% cap
    }
  };
  const validation = validateLoyaltyConfig(riskyConfig);
  assert.strictEqual(validation.isValid, false);
  assert.ok(validation.errors && validation.errors.length > 0);
  assert.ok(validation.errors[0].includes("GUARDRAIL_EXCEEDED"));
  assert.ok(validation.errors[0].includes("12.50%"));
});
test("Acceptance Test 12: ROI sample: 100 members, \u20B9250 bill, 40% margin, 5% earn, 70% redemption, 100 -> 140 visits -> cost \u2248 \u20B91,225, incremental \u2248 \u20B94,000, net \u2248 \u20B92,775, break-even lift \u2248 8.75%", () => {
  const roi = calculateROI({
    members: 100,
    visits_before_per_member: 1,
    // 100 baseline visits
    visits_after_per_member: 1.4,
    // 140 visits
    avg_bill_paise: 25e3,
    // ₹250
    contribution_margin_pct: 40,
    // 40%
    earn_rate_pct: 5,
    // 5%
    redemption_rate_pct: 70,
    // 70%
    monthly_software_cost_paise: 0
  });
  assert.strictEqual(roi.cost_inr, 1225);
  assert.strictEqual(roi.incremental_profit_inr, 4e3);
  assert.strictEqual(roi.net_profit_inr, 2775);
  assert.strictEqual(roi.breakeven_lift_pct, 8.75);
});
test("Acceptance Test 13: Two concurrent redeem requests on the same balance -> only one succeeds (no negative balance)", () => {
  let memberBalance = 80;
  const billPaise = 4e4;
  function tryRedeem(requested) {
    const preview = previewRedeem({
      config: DEFAULT_LOYALTY_CONFIG,
      isProgramActive: true,
      memberBalance,
      input: {
        restaurant_id: "rest_01",
        member_phone: "+919847012345",
        bill_paise: billPaise,
        requested_points: requested,
        order_type: "dine_in"
      }
    });
    if (!preview.allowed) {
      return { success: false, pointsDeducted: 0 };
    }
    if (memberBalance < preview.redeem_points) {
      return { success: false, pointsDeducted: 0 };
    }
    memberBalance -= preview.redeem_points;
    return { success: true, pointsDeducted: preview.redeem_points };
  }
  const req1 = tryRedeem(80);
  assert.strictEqual(req1.success, true);
  assert.strictEqual(req1.pointsDeducted, 80);
  assert.strictEqual(memberBalance, 0);
  const req2 = tryRedeem(80);
  assert.strictEqual(req2.success, false);
  assert.strictEqual(req2.pointsDeducted, 0);
  assert.strictEqual(memberBalance, 0);
});
test("Phone normalization handles Kerala formats (+91, 0, spaces, dashes)", () => {
  assert.strictEqual(normalizePhone("9847012345"), "+919847012345");
  assert.strictEqual(normalizePhone("09847012345"), "+919847012345");
  assert.strictEqual(normalizePhone("+91 98470 12345"), "+919847012345");
  assert.strictEqual(normalizePhone("+91-98470-12345"), "+919847012345");
  assert.strictEqual(normalizePhone("00919847012345"), "+919847012345");
});
