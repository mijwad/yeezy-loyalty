// WhatsApp Messaging Provider Interface & Kerala Restaurant Templates
// Pluggable adapter supporting Gupshup, Wati, Meta Cloud API, or Local Stub

export interface WhatsAppMessagePayload {
  to: string; // E.164 phone number e.g. +919847012345
  templateName: string;
  language: 'en' | 'ml';
  parameters: Record<string, string | number>;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId: string;
  provider: string;
  error?: string;
  sentAt: string;
}

export interface WhatsAppProvider {
  sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult>;
}

/**
 * Stub WhatsApp Provider (Logs messages cleanly and simulates 100% delivery for local testing & POS demo)
 */
export class StubWhatsAppProvider implements WhatsAppProvider {
  async sendMessage(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    const messageId = `wa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[WhatsApp Stub] Sent template '${payload.templateName}' (${payload.language}) to ${payload.to}`, payload.parameters);
    
    return {
      success: true,
      messageId,
      provider: 'STUB_SIMULATOR',
      sentAt: new Date().toISOString()
    };
  }
}

export const defaultWhatsAppProvider = new StubWhatsAppProvider();

/**
 * Template message renderers
 */
export const WhatsAppTemplates = {
  // 1. Earned points notification
  pointsEarned(dinerName: string, pointsEarned: number, totalBalance: number, inrValue: number, restaurantName: string, lang: 'en' | 'ml' = 'en') {
    if (lang === 'ml') {
      return `നമസ്കാരം ${dinerName}! 🎉\n${restaurantName}-ൽ നിന്ന് താങ്കൾക്ക് +${pointsEarned} ലോയൽറ്റി പോയിന്റുകൾ ലഭിച്ചു!\nആകെ ബാലൻസ്: ${totalBalance} പോയിന്റുകൾ (₹${inrValue}).\nഅടുത്ത തവണ ഭക്ഷണം കഴിക്കുമ്പോൾ ഈ പോയിന്റുകൾ ഉപയോഗിച്ച് ഇളവ് നേടൂ! 🍛`;
    }
    return `Hi ${dinerName}! 🎉\nYou just earned +${pointsEarned} loyalty points at ${restaurantName}!\nTotal Balance: ${totalBalance} Points (Worth ₹${inrValue}).\nRedeem them on your next delicious meal! 🍽️`;
  },

  // 2. 7-Day Expiry Reminder
  expiryReminder(dinerName: string, expiringPoints: number, expiryDateStr: string, restaurantName: string, lang: 'en' | 'ml' = 'en') {
    if (lang === 'ml') {
      return `പ്രിയപ്പെട്ട ${dinerName}, താങ്കളുടെ ${expiringPoints} പോയിന്റുകൾ ${expiryDateStr}-ൽ കാലഹരണപ്പെടാൻ പോകുന്നു! ⏳\n${restaurantName}-ൽ എത്തി സ്വാദിഷ്ടമായ ഭക്ഷണം ആസ്വദിച്ച് പോയിന്റുകൾ ഡിസ്കൗണ്ടായി ഉപയോഗിക്കൂ.`;
    }
    return `Hi ${dinerName}, your ${expiringPoints} loyalty points will expire on ${expiryDateStr}! ⏳\nVisit ${restaurantName} this week to redeem them for instant discounts on your bill.`;
  },

  // 3. Win-back Campaign (Kerala Feast / Double Points)
  winbackInvite(dinerName: string, multiplier: number, validDays: number, restaurantName: string, lang: 'en' | 'ml' = 'en') {
    if (lang === 'ml') {
      return `ഞങ്ങൾ നിങ്ങളെ മിസ് ചെയ്യുന്നു, ${dinerName}! ❤️\n${restaurantName}-ൽ താങ്കൾക്കായി പ്രത്യേക ${multiplier}x ഡബിൾ പോയിന്റ് ഓഫർ ഒരുക്കിയിരിക്കുന്നു!\nഅടുത്ത ${validDays} ദിവസത്തിനുള്ളിൽ സന്ദർശിച്ച് ഇരട്ടി പോയിന്റുകൾ നേടൂ! 🥘`;
    }
    return `We miss you at ${restaurantName}, ${dinerName}! ❤️\nEnjoy an exclusive ${multiplier}x Points Multiplier on your entire bill when you visit us in the next ${validDays} days! Reserve your table today. 🍽️`;
  },

  // 4. Referral Invite Link
  referralShare(referrerName: string, referralCode: string, referralUrl: string, restaurantName: string, lang: 'en' | 'ml' = 'en') {
    if (lang === 'ml') {
      return `${referrerName} നിങ്ങളെ ${restaurantName}-ലേക്ക് ക്ഷണിക്കുന്നു! 🎁\nഈ ലിങ്ക് വഴി ചേരൂ, ആദ്യ ഓർഡറിൽ ₹50 ഡിസ്കൗണ്ട് നേടൂ: ${referralUrl}\n(റഫറൽ കോഡ്: ${referralCode})`;
    }
    return `${referrerName} invited you to try ${restaurantName}! 🎁\nSign up using this link and get ₹50 off your first meal: ${referralUrl}\n(Code: ${referralCode})`;
  }
};
