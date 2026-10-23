// Multi-language i18n Dictionary: English & Malayalam (മലയാളം)
// Seamless localization for Kerala restaurants and diner touchpoints.

export type SupportedLanguage = 'en' | 'ml';

export const i18n = {
  en: {
    // Brand & Roles
    platform_name: 'Yeezy Loyalty Platform',
    diner: 'Valued Guest',
    cashier: 'Cashier',
    owner: 'Restaurant Owner',

    // Tiers
    tier_silver: 'Silver Member',
    tier_gold: 'Gold VIP',
    tier_platinum: 'Platinum Elite',

    // Core Metrics
    points: 'Points',
    points_balance: 'Points Balance',
    redeemable_value: 'Redeemable Value',
    lifetime_spend: 'Lifetime Spend',
    total_visits: 'Total Visits',
    last_visit: 'Last Visit',
    expiry_date: 'Expires On',

    // Billing & POS
    phone_input_label: 'Customer Phone Number',
    phone_input_placeholder: 'e.g. 98470 12345 or +91 98470 12345',
    lookup_customer: 'Look Up Guest',
    redeem_available: 'Can redeem up to ₹{amount} on this bill',
    one_tap_apply: '1-Tap Apply Discount',
    redeem_success: 'Redeemed {points} points! ₹{amount} deducted from bill.',
    earned_on_bill: 'Earned +{points} points on this bill!',
    no_discount_conflicts: 'Cannot combine with other discounts',

    // Error Codes
    error_BELOW_MIN_POINTS: 'Below minimum balance of {min} points to redeem',
    error_MIN_BILL_NOT_MET: 'Minimum bill of ₹{min} required to redeem points',
    error_PROGRAM_INACTIVE: 'Loyalty program is currently paused',
    error_ORDER_TYPE_NOT_ALLOWED: 'Redemption not allowed on this order type',
    error_DISCOUNT_NOT_STACKABLE: 'Points cannot be combined with existing coupon discount',
    error_ZERO_REDEEMABLE: 'No points can be redeemed on this bill amount',
    error_GUARDRAIL_EXCEEDED: 'Effective earn rate exceeds profitability guardrail',

    // Receipt Thermal Print Text
    receipt_title: 'LOYALTY REWARDS SUMMARY',
    receipt_points_earned: 'Points Earned This Bill: +{points}',
    receipt_points_balance: 'Total Available Balance: {balance} Pts (₹{inr})',
    receipt_next_milestone: 'Spend ₹{more} more to unlock your next big bonus!',
    receipt_thank_you: 'Thank you for dining with us!',

    // Customer Portal
    customer_greeting: 'Welcome back, {name}!',
    customer_status_title: 'Your Yeezy Rewards',
    customer_next_tier_progress: '{remaining} more visits to reach {nextTier}!',
    customer_referral_title: 'Refer Friends, Both Get ₹50!',
    customer_referral_subtitle: 'Share your personal referral code with family and friends in Kerala.',
    customer_copy_link: 'Copy Referral Link',
    customer_link_copied: 'Referral link copied to clipboard!',

    // Multipliers & Kerala Festivals
    festival_onam: 'Onam Grand Sadhya (2.0x Points)',
    festival_vishu: 'Vishu Kaineettam Special (1.5x Points)',
    festival_eid: 'Eid Mubarak Celebration (1.75x Points)',
    slow_slot_happy_hours: 'Weekday Afternoon Delight (1.5x Points)',
    slow_slot_sunday_sadhya: 'Sunday Family Feast (1.25x Points)',

    // ROI Simulator
    roi_simulator_title: 'Loyalty ROI & Profitability Simulator',
    roi_projected_net: 'Projected Net Profit',
    roi_breakeven_lift: 'Break-even Repeat Lift',
    roi_multiple: 'Projected ROI Multiple',
    guardrail_alert: 'Profitability Guardrail Active (Max {bps} bps)'
  },

  ml: {
    // Brand & Roles
    platform_name: 'യീസി ലോയൽറ്റി പ്ലാറ്റ്‌ഫോം',
    diner: 'പ്രിയപ്പെട്ട അതിഥി',
    cashier: 'കാഷ്യർ',
    owner: 'റെസ്റ്റോറന്റ് ഉടമ',

    // Tiers
    tier_silver: 'സിൽവർ മെമ്പർ',
    tier_gold: 'ഗോൾഡ് വിഐപി',
    tier_platinum: 'പ്ലാറ്റിനം എലൈറ്റ്',

    // Core Metrics
    points: 'പോയിന്റുകൾ',
    points_balance: 'ലഭ്യമായ പോയിന്റുകൾ',
    redeemable_value: 'ഡിസ്കൗണ്ട് മൂല്യം',
    lifetime_spend: 'ആകെ ചെലവഴിച്ചത്',
    total_visits: 'ആകെ സന്ദർശനങ്ങൾ',
    last_visit: 'അവസാന സന്ദർശനം',
    expiry_date: 'കാലഹരണ തീയതി',

    // Billing & POS
    phone_input_label: 'ഉപഭോക്താവിന്റെ മൊബൈൽ നമ്പർ',
    phone_input_placeholder: 'ഉദാ: 98470 12345 അല്ലെങ്കിൽ +91 98470 12345',
    lookup_customer: 'വിവരങ്ങൾ പരിശോധിക്കുക',
    redeem_available: 'ഈ ബില്ലിൽ പരമാവധി ₹{amount} ഡിസ്കൗണ്ട് നേടാം',
    one_tap_apply: 'ഡിസ്കൗണ്ട് ചേർക്കുക',
    redeem_success: '{points} പോയിന്റുകൾ കുറച്ചു! ₹{amount} ബില്ലിൽ ഇളവ് നൽകി.',
    earned_on_bill: 'ഈ ബില്ലിൽ +{points} പോയിന്റുകൾ ലഭിച്ചു!',
    no_discount_conflicts: 'മറ്റ് ഓഫറുകളുമായി സംയോജിപ്പിക്കാനാവില്ല',

    // Error Codes
    error_BELOW_MIN_POINTS: 'പോയിന്റുകൾ ഉപയോഗിക്കാൻ കുറഞ്ഞത് {min} പോയിന്റുകൾ വേണം',
    error_MIN_BILL_NOT_MET: 'പോയിന്റ് ഉപയോഗിക്കാൻ കുറഞ്ഞ ബിൽ ₹{min} ആയിരിക്കണം',
    error_PROGRAM_INACTIVE: 'ലോയൽറ്റി പ്രോഗ്രാം താൽക്കാലികമായി നിർത്തിവച്ചിരിക്കുന്നു',
    error_ORDER_TYPE_NOT_ALLOWED: 'ഈ ഓർഡർ തരത്തിൽ പോയിന്റ് ഉപയോഗിക്കാൻ കഴിയില്ല',
    error_DISCOUNT_NOT_STACKABLE: 'മറ്റ് കൂപ്പണുകൾക്കൊപ്പം പോയിന്റുകൾ ഉപയോഗിക്കാൻ കഴിയില്ല',
    error_ZERO_REDEEMABLE: 'ഈ ബിൽ തുകയ്ക്ക് പോയിന്റുകൾ ഉപയോഗിക്കാൻ കഴിയില്ല',
    error_GUARDRAIL_EXCEEDED: 'പോയിന്റ് നിരക്ക് റെസ്റ്റോറന്റ് ലാഭപരിധി കവിയുന്നു',

    // Receipt Thermal Print Text
    receipt_title: 'ലോയൽറ്റി റിവാർഡ് സംഗ്രഹം',
    receipt_points_earned: 'ഈ ബില്ലിൽ ലഭിച്ച പോയിന്റ്: +{points}',
    receipt_points_balance: 'ആകെ ലഭ്യമായ ബാലൻസ്: {balance} Pts (₹{inr})',
    receipt_next_milestone: 'അടുത്ത ബോണസ് നേടാൻ ₹{more} തുകയ്ക്ക് കൂടി ഭക്ഷണം ആസ്വദിക്കൂ!',
    receipt_thank_you: 'ഞങ്ങളോടൊപ്പം ഭക്ഷണം കഴിച്ചതിന് നന്ദി!',

    // Customer Portal
    customer_greeting: 'സ്വാഗതം, {name}!',
    customer_status_title: 'നിങ്ങളുടെ യീസി റിവാർഡുകൾ',
    customer_next_tier_progress: '{nextTier} ആകാൻ ഇനി {remaining} സന്ദർശനങ്ങൾ കൂടി!',
    customer_referral_title: 'സുഹൃത്തുക്കളെ ക്ഷണിക്കൂ, രണ്ടുപേർക്കും ₹50 നേടാം!',
    customer_referral_subtitle: 'നിങ്ങളുടെ റഫറൽ കോഡ് കേരളത്തിലെ സുഹൃത്തുക്കളുമായി പങ്കിടൂ.',
    customer_copy_link: 'ലിങ്ക് കോപ്പി ചെയ്യുക',
    customer_link_copied: 'റഫറൽ ലിങ്ക് കോപ്പി ചെയ്തു!',

    // Multipliers & Kerala Festivals
    festival_onam: 'ഓണം മഹാ സദ്യ സ്പെഷ്യൽ (2.0x പോയിന്റുകൾ)',
    festival_vishu: 'വിഷുക്കൈനീട്ടം സ്പെഷ്യൽ (1.5x പോയിന്റുകൾ)',
    festival_eid: 'ഈദ് മുബാറക് ഓഫർ (1.75x പോയിന്റുകൾ)',
    slow_slot_happy_hours: 'ഉച്ചഭക്ഷണ ഹാപ്പി അവേഴ്സ് (1.5x പോയിന്റുകൾ)',
    slow_slot_sunday_sadhya: 'ഞായറാഴ്ച ഫാമിലി സദ്യ (1.25x പോയിന്റുകൾ)',

    // ROI Simulator
    roi_simulator_title: 'ലോയൽറ്റി ലാഭക്ഷമത സിമുലേറ്റർ',
    roi_projected_net: 'പ്രതീക്ഷിക്കുന്ന അറ്റാദായം',
    roi_breakeven_lift: 'ബ്രേക്ക്-ഈവൻ സന്ദർശന വളർച്ച',
    roi_multiple: 'പ്രതീക്ഷിക്കുന്ന ROI ഗുണിതം',
    guardrail_alert: 'ലാഭ സുരക്ഷാ പരിധി നിലവിലുണ്ട് (പരമാവധി {bps} bps)'
  }
};

/**
 * Translates a key with optional dynamic template interpolation.
 */
export function t(key: keyof typeof i18n['en'], lang: SupportedLanguage = 'en', params: Record<string, any> = {}): string {
  const dictionary = i18n[lang] || i18n['en'];
  let text = dictionary[key] || i18n['en'][key] || String(key);

  for (const [paramKey, paramVal] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
  }

  return text;
}
