const i18n = {
  en: {
    // Brand & Roles
    platform_name: "Yeezy Loyalty Platform",
    diner: "Valued Guest",
    cashier: "Cashier",
    owner: "Restaurant Owner",
    // Tiers
    tier_silver: "Silver Member",
    tier_gold: "Gold VIP",
    tier_platinum: "Platinum Elite",
    // Core Metrics
    points: "Points",
    points_balance: "Points Balance",
    redeemable_value: "Redeemable Value",
    lifetime_spend: "Lifetime Spend",
    total_visits: "Total Visits",
    last_visit: "Last Visit",
    expiry_date: "Expires On",
    // Billing & POS
    phone_input_label: "Customer Phone Number",
    phone_input_placeholder: "e.g. 98470 12345 or +91 98470 12345",
    lookup_customer: "Look Up Guest",
    redeem_available: "Can redeem up to \u20B9{amount} on this bill",
    one_tap_apply: "1-Tap Apply Discount",
    redeem_success: "Redeemed {points} points! \u20B9{amount} deducted from bill.",
    earned_on_bill: "Earned +{points} points on this bill!",
    no_discount_conflicts: "Cannot combine with other discounts",
    // Error Codes
    error_BELOW_MIN_POINTS: "Below minimum balance of {min} points to redeem",
    error_MIN_BILL_NOT_MET: "Minimum bill of \u20B9{min} required to redeem points",
    error_PROGRAM_INACTIVE: "Loyalty program is currently paused",
    error_ORDER_TYPE_NOT_ALLOWED: "Redemption not allowed on this order type",
    error_DISCOUNT_NOT_STACKABLE: "Points cannot be combined with existing coupon discount",
    error_ZERO_REDEEMABLE: "No points can be redeemed on this bill amount",
    error_GUARDRAIL_EXCEEDED: "Effective earn rate exceeds profitability guardrail",
    // Receipt Thermal Print Text
    receipt_title: "LOYALTY REWARDS SUMMARY",
    receipt_points_earned: "Points Earned This Bill: +{points}",
    receipt_points_balance: "Total Available Balance: {balance} Pts (\u20B9{inr})",
    receipt_next_milestone: "Spend \u20B9{more} more to unlock your next big bonus!",
    receipt_thank_you: "Thank you for dining with us!",
    // Customer Portal
    customer_greeting: "Welcome back, {name}!",
    customer_status_title: "Your Yeezy Rewards",
    customer_next_tier_progress: "{remaining} more visits to reach {nextTier}!",
    customer_referral_title: "Refer Friends, Both Get \u20B950!",
    customer_referral_subtitle: "Share your personal referral code with family and friends in Kerala.",
    customer_copy_link: "Copy Referral Link",
    customer_link_copied: "Referral link copied to clipboard!",
    // Multipliers & Kerala Festivals
    festival_onam: "Onam Grand Sadhya (2.0x Points)",
    festival_vishu: "Vishu Kaineettam Special (1.5x Points)",
    festival_eid: "Eid Mubarak Celebration (1.75x Points)",
    slow_slot_happy_hours: "Weekday Afternoon Delight (1.5x Points)",
    slow_slot_sunday_sadhya: "Sunday Family Feast (1.25x Points)",
    // ROI Simulator
    roi_simulator_title: "Loyalty ROI & Profitability Simulator",
    roi_projected_net: "Projected Net Profit",
    roi_breakeven_lift: "Break-even Repeat Lift",
    roi_multiple: "Projected ROI Multiple",
    guardrail_alert: "Profitability Guardrail Active (Max {bps} bps)"
  },
  ml: {
    // Brand & Roles
    platform_name: "\u0D2F\u0D40\u0D38\u0D3F \u0D32\u0D4B\u0D2F\u0D7D\u0D31\u0D4D\u0D31\u0D3F \u0D2A\u0D4D\u0D32\u0D3E\u0D31\u0D4D\u0D31\u0D4D\u200C\u0D2B\u0D4B\u0D02",
    diner: "\u0D2A\u0D4D\u0D30\u0D3F\u0D2F\u0D2A\u0D4D\u0D2A\u0D46\u0D1F\u0D4D\u0D1F \u0D05\u0D24\u0D3F\u0D25\u0D3F",
    cashier: "\u0D15\u0D3E\u0D37\u0D4D\u0D2F\u0D7C",
    owner: "\u0D31\u0D46\u0D38\u0D4D\u0D31\u0D4D\u0D31\u0D4B\u0D31\u0D28\u0D4D\u0D31\u0D4D \u0D09\u0D1F\u0D2E",
    // Tiers
    tier_silver: "\u0D38\u0D3F\u0D7D\u0D35\u0D7C \u0D2E\u0D46\u0D2E\u0D4D\u0D2A\u0D7C",
    tier_gold: "\u0D17\u0D4B\u0D7E\u0D21\u0D4D \u0D35\u0D3F\u0D10\u0D2A\u0D3F",
    tier_platinum: "\u0D2A\u0D4D\u0D32\u0D3E\u0D31\u0D4D\u0D31\u0D3F\u0D28\u0D02 \u0D0E\u0D32\u0D48\u0D31\u0D4D\u0D31\u0D4D",
    // Core Metrics
    points: "\u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E",
    points_balance: "\u0D32\u0D2D\u0D4D\u0D2F\u0D2E\u0D3E\u0D2F \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E",
    redeemable_value: "\u0D21\u0D3F\u0D38\u0D4D\u0D15\u0D57\u0D23\u0D4D\u0D1F\u0D4D \u0D2E\u0D42\u0D32\u0D4D\u0D2F\u0D02",
    lifetime_spend: "\u0D06\u0D15\u0D46 \u0D1A\u0D46\u0D32\u0D35\u0D34\u0D3F\u0D1A\u0D4D\u0D1A\u0D24\u0D4D",
    total_visits: "\u0D06\u0D15\u0D46 \u0D38\u0D28\u0D4D\u0D26\u0D7C\u0D36\u0D28\u0D19\u0D4D\u0D19\u0D7E",
    last_visit: "\u0D05\u0D35\u0D38\u0D3E\u0D28 \u0D38\u0D28\u0D4D\u0D26\u0D7C\u0D36\u0D28\u0D02",
    expiry_date: "\u0D15\u0D3E\u0D32\u0D39\u0D30\u0D23 \u0D24\u0D40\u0D2F\u0D24\u0D3F",
    // Billing & POS
    phone_input_label: "\u0D09\u0D2A\u0D2D\u0D4B\u0D15\u0D4D\u0D24\u0D3E\u0D35\u0D3F\u0D28\u0D4D\u0D31\u0D46 \u0D2E\u0D4A\u0D2C\u0D48\u0D7D \u0D28\u0D2E\u0D4D\u0D2A\u0D7C",
    phone_input_placeholder: "\u0D09\u0D26\u0D3E: 98470 12345 \u0D05\u0D32\u0D4D\u0D32\u0D46\u0D19\u0D4D\u0D15\u0D3F\u0D7D +91 98470 12345",
    lookup_customer: "\u0D35\u0D3F\u0D35\u0D30\u0D19\u0D4D\u0D19\u0D7E \u0D2A\u0D30\u0D3F\u0D36\u0D4B\u0D27\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D15",
    redeem_available: "\u0D08 \u0D2C\u0D3F\u0D32\u0D4D\u0D32\u0D3F\u0D7D \u0D2A\u0D30\u0D2E\u0D3E\u0D35\u0D27\u0D3F \u20B9{amount} \u0D21\u0D3F\u0D38\u0D4D\u0D15\u0D57\u0D23\u0D4D\u0D1F\u0D4D \u0D28\u0D47\u0D1F\u0D3E\u0D02",
    one_tap_apply: "\u0D21\u0D3F\u0D38\u0D4D\u0D15\u0D57\u0D23\u0D4D\u0D1F\u0D4D \u0D1A\u0D47\u0D7C\u0D15\u0D4D\u0D15\u0D41\u0D15",
    redeem_success: "{points} \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D15\u0D41\u0D31\u0D1A\u0D4D\u0D1A\u0D41! \u20B9{amount} \u0D2C\u0D3F\u0D32\u0D4D\u0D32\u0D3F\u0D7D \u0D07\u0D33\u0D35\u0D4D \u0D28\u0D7D\u0D15\u0D3F.",
    earned_on_bill: "\u0D08 \u0D2C\u0D3F\u0D32\u0D4D\u0D32\u0D3F\u0D7D +{points} \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D32\u0D2D\u0D3F\u0D1A\u0D4D\u0D1A\u0D41!",
    no_discount_conflicts: "\u0D2E\u0D31\u0D4D\u0D31\u0D4D \u0D13\u0D2B\u0D31\u0D41\u0D15\u0D33\u0D41\u0D2E\u0D3E\u0D2F\u0D3F \u0D38\u0D02\u0D2F\u0D4B\u0D1C\u0D3F\u0D2A\u0D4D\u0D2A\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D28\u0D3E\u0D35\u0D3F\u0D32\u0D4D\u0D32",
    // Error Codes
    error_BELOW_MIN_POINTS: "\u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D09\u0D2A\u0D2F\u0D4B\u0D17\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D15\u0D41\u0D31\u0D1E\u0D4D\u0D1E\u0D24\u0D4D {min} \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D35\u0D47\u0D23\u0D02",
    error_MIN_BILL_NOT_MET: "\u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D4D \u0D09\u0D2A\u0D2F\u0D4B\u0D17\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D15\u0D41\u0D31\u0D1E\u0D4D\u0D1E \u0D2C\u0D3F\u0D7D \u20B9{min} \u0D06\u0D2F\u0D3F\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D23\u0D02",
    error_PROGRAM_INACTIVE: "\u0D32\u0D4B\u0D2F\u0D7D\u0D31\u0D4D\u0D31\u0D3F \u0D2A\u0D4D\u0D30\u0D4B\u0D17\u0D4D\u0D30\u0D3E\u0D02 \u0D24\u0D3E\u0D7D\u0D15\u0D4D\u0D15\u0D3E\u0D32\u0D3F\u0D15\u0D2E\u0D3E\u0D2F\u0D3F \u0D28\u0D3F\u0D7C\u0D24\u0D4D\u0D24\u0D3F\u0D35\u0D1A\u0D4D\u0D1A\u0D3F\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41",
    error_ORDER_TYPE_NOT_ALLOWED: "\u0D08 \u0D13\u0D7C\u0D21\u0D7C \u0D24\u0D30\u0D24\u0D4D\u0D24\u0D3F\u0D7D \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D4D \u0D09\u0D2A\u0D2F\u0D4B\u0D17\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D15\u0D34\u0D3F\u0D2F\u0D3F\u0D32\u0D4D\u0D32",
    error_DISCOUNT_NOT_STACKABLE: "\u0D2E\u0D31\u0D4D\u0D31\u0D4D \u0D15\u0D42\u0D2A\u0D4D\u0D2A\u0D23\u0D41\u0D15\u0D7E\u0D15\u0D4D\u0D15\u0D4A\u0D2A\u0D4D\u0D2A\u0D02 \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D09\u0D2A\u0D2F\u0D4B\u0D17\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D15\u0D34\u0D3F\u0D2F\u0D3F\u0D32\u0D4D\u0D32",
    error_ZERO_REDEEMABLE: "\u0D08 \u0D2C\u0D3F\u0D7D \u0D24\u0D41\u0D15\u0D2F\u0D4D\u0D15\u0D4D\u0D15\u0D4D \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D09\u0D2A\u0D2F\u0D4B\u0D17\u0D3F\u0D15\u0D4D\u0D15\u0D3E\u0D7B \u0D15\u0D34\u0D3F\u0D2F\u0D3F\u0D32\u0D4D\u0D32",
    error_GUARDRAIL_EXCEEDED: "\u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D4D \u0D28\u0D3F\u0D30\u0D15\u0D4D\u0D15\u0D4D \u0D31\u0D46\u0D38\u0D4D\u0D31\u0D4D\u0D31\u0D4B\u0D31\u0D28\u0D4D\u0D31\u0D4D \u0D32\u0D3E\u0D2D\u0D2A\u0D30\u0D3F\u0D27\u0D3F \u0D15\u0D35\u0D3F\u0D2F\u0D41\u0D28\u0D4D\u0D28\u0D41",
    // Receipt Thermal Print Text
    receipt_title: "\u0D32\u0D4B\u0D2F\u0D7D\u0D31\u0D4D\u0D31\u0D3F \u0D31\u0D3F\u0D35\u0D3E\u0D7C\u0D21\u0D4D \u0D38\u0D02\u0D17\u0D4D\u0D30\u0D39\u0D02",
    receipt_points_earned: "\u0D08 \u0D2C\u0D3F\u0D32\u0D4D\u0D32\u0D3F\u0D7D \u0D32\u0D2D\u0D3F\u0D1A\u0D4D\u0D1A \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D4D: +{points}",
    receipt_points_balance: "\u0D06\u0D15\u0D46 \u0D32\u0D2D\u0D4D\u0D2F\u0D2E\u0D3E\u0D2F \u0D2C\u0D3E\u0D32\u0D7B\u0D38\u0D4D: {balance} Pts (\u20B9{inr})",
    receipt_next_milestone: "\u0D05\u0D1F\u0D41\u0D24\u0D4D\u0D24 \u0D2C\u0D4B\u0D23\u0D38\u0D4D \u0D28\u0D47\u0D1F\u0D3E\u0D7B \u20B9{more} \u0D24\u0D41\u0D15\u0D2F\u0D4D\u0D15\u0D4D\u0D15\u0D4D \u0D15\u0D42\u0D1F\u0D3F \u0D2D\u0D15\u0D4D\u0D37\u0D23\u0D02 \u0D06\u0D38\u0D4D\u0D35\u0D26\u0D3F\u0D15\u0D4D\u0D15\u0D42!",
    receipt_thank_you: "\u0D1E\u0D19\u0D4D\u0D19\u0D33\u0D4B\u0D1F\u0D4A\u0D2A\u0D4D\u0D2A\u0D02 \u0D2D\u0D15\u0D4D\u0D37\u0D23\u0D02 \u0D15\u0D34\u0D3F\u0D1A\u0D4D\u0D1A\u0D24\u0D3F\u0D28\u0D4D \u0D28\u0D28\u0D4D\u0D26\u0D3F!",
    // Customer Portal
    customer_greeting: "\u0D38\u0D4D\u0D35\u0D3E\u0D17\u0D24\u0D02, {name}!",
    customer_status_title: "\u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D2F\u0D40\u0D38\u0D3F \u0D31\u0D3F\u0D35\u0D3E\u0D7C\u0D21\u0D41\u0D15\u0D7E",
    customer_next_tier_progress: "{nextTier} \u0D06\u0D15\u0D3E\u0D7B \u0D07\u0D28\u0D3F {remaining} \u0D38\u0D28\u0D4D\u0D26\u0D7C\u0D36\u0D28\u0D19\u0D4D\u0D19\u0D7E \u0D15\u0D42\u0D1F\u0D3F!",
    customer_referral_title: "\u0D38\u0D41\u0D39\u0D43\u0D24\u0D4D\u0D24\u0D41\u0D15\u0D4D\u0D15\u0D33\u0D46 \u0D15\u0D4D\u0D37\u0D23\u0D3F\u0D15\u0D4D\u0D15\u0D42, \u0D30\u0D23\u0D4D\u0D1F\u0D41\u0D2A\u0D47\u0D7C\u0D15\u0D4D\u0D15\u0D41\u0D02 \u20B950 \u0D28\u0D47\u0D1F\u0D3E\u0D02!",
    customer_referral_subtitle: "\u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D41\u0D1F\u0D46 \u0D31\u0D2B\u0D31\u0D7D \u0D15\u0D4B\u0D21\u0D4D \u0D15\u0D47\u0D30\u0D33\u0D24\u0D4D\u0D24\u0D3F\u0D32\u0D46 \u0D38\u0D41\u0D39\u0D43\u0D24\u0D4D\u0D24\u0D41\u0D15\u0D4D\u0D15\u0D33\u0D41\u0D2E\u0D3E\u0D2F\u0D3F \u0D2A\u0D19\u0D4D\u0D15\u0D3F\u0D1F\u0D42.",
    customer_copy_link: "\u0D32\u0D3F\u0D19\u0D4D\u0D15\u0D4D \u0D15\u0D4B\u0D2A\u0D4D\u0D2A\u0D3F \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D41\u0D15",
    customer_link_copied: "\u0D31\u0D2B\u0D31\u0D7D \u0D32\u0D3F\u0D19\u0D4D\u0D15\u0D4D \u0D15\u0D4B\u0D2A\u0D4D\u0D2A\u0D3F \u0D1A\u0D46\u0D2F\u0D4D\u0D24\u0D41!",
    // Multipliers & Kerala Festivals
    festival_onam: "\u0D13\u0D23\u0D02 \u0D2E\u0D39\u0D3E \u0D38\u0D26\u0D4D\u0D2F \u0D38\u0D4D\u0D2A\u0D46\u0D37\u0D4D\u0D2F\u0D7D (2.0x \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E)",
    festival_vishu: "\u0D35\u0D3F\u0D37\u0D41\u0D15\u0D4D\u0D15\u0D48\u0D28\u0D40\u0D1F\u0D4D\u0D1F\u0D02 \u0D38\u0D4D\u0D2A\u0D46\u0D37\u0D4D\u0D2F\u0D7D (1.5x \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E)",
    festival_eid: "\u0D08\u0D26\u0D4D \u0D2E\u0D41\u0D2C\u0D3E\u0D31\u0D15\u0D4D \u0D13\u0D2B\u0D7C (1.75x \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E)",
    slow_slot_happy_hours: "\u0D09\u0D1A\u0D4D\u0D1A\u0D2D\u0D15\u0D4D\u0D37\u0D23 \u0D39\u0D3E\u0D2A\u0D4D\u0D2A\u0D3F \u0D05\u0D35\u0D47\u0D34\u0D4D\u0D38\u0D4D (1.5x \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E)",
    slow_slot_sunday_sadhya: "\u0D1E\u0D3E\u0D2F\u0D31\u0D3E\u0D34\u0D4D\u0D1A \u0D2B\u0D3E\u0D2E\u0D3F\u0D32\u0D3F \u0D38\u0D26\u0D4D\u0D2F (1.25x \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E)",
    // ROI Simulator
    roi_simulator_title: "\u0D32\u0D4B\u0D2F\u0D7D\u0D31\u0D4D\u0D31\u0D3F \u0D32\u0D3E\u0D2D\u0D15\u0D4D\u0D37\u0D2E\u0D24 \u0D38\u0D3F\u0D2E\u0D41\u0D32\u0D47\u0D31\u0D4D\u0D31\u0D7C",
    roi_projected_net: "\u0D2A\u0D4D\u0D30\u0D24\u0D40\u0D15\u0D4D\u0D37\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28 \u0D05\u0D31\u0D4D\u0D31\u0D3E\u0D26\u0D3E\u0D2F\u0D02",
    roi_breakeven_lift: "\u0D2C\u0D4D\u0D30\u0D47\u0D15\u0D4D\u0D15\u0D4D-\u0D08\u0D35\u0D7B \u0D38\u0D28\u0D4D\u0D26\u0D7C\u0D36\u0D28 \u0D35\u0D33\u0D7C\u0D1A\u0D4D\u0D1A",
    roi_multiple: "\u0D2A\u0D4D\u0D30\u0D24\u0D40\u0D15\u0D4D\u0D37\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28 ROI \u0D17\u0D41\u0D23\u0D3F\u0D24\u0D02",
    guardrail_alert: "\u0D32\u0D3E\u0D2D \u0D38\u0D41\u0D30\u0D15\u0D4D\u0D37\u0D3E \u0D2A\u0D30\u0D3F\u0D27\u0D3F \u0D28\u0D3F\u0D32\u0D35\u0D3F\u0D32\u0D41\u0D23\u0D4D\u0D1F\u0D4D (\u0D2A\u0D30\u0D2E\u0D3E\u0D35\u0D27\u0D3F {bps} bps)"
  }
};
function t(key, lang = "en", params = {}) {
  const dictionary = i18n[lang] || i18n["en"];
  let text = dictionary[key] || i18n["en"][key] || String(key);
  for (const [paramKey, paramVal] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramVal));
  }
  return text;
}
export {
  i18n,
  t
};
