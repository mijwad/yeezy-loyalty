class StubWhatsAppProvider {
  async sendMessage(payload) {
    const messageId = `wa_msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    console.log(`[WhatsApp Stub] Sent template '${payload.templateName}' (${payload.language}) to ${payload.to}`, payload.parameters);
    return {
      success: true,
      messageId,
      provider: "STUB_SIMULATOR",
      sentAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
const defaultWhatsAppProvider = new StubWhatsAppProvider();
const WhatsAppTemplates = {
  // 1. Earned points notification
  pointsEarned(dinerName, pointsEarned, totalBalance, inrValue, restaurantName, lang = "en") {
    if (lang === "ml") {
      return `\u0D28\u0D2E\u0D38\u0D4D\u0D15\u0D3E\u0D30\u0D02 ${dinerName}! \u{1F389}
${restaurantName}-\u0D7D \u0D28\u0D3F\u0D28\u0D4D\u0D28\u0D4D \u0D24\u0D3E\u0D19\u0D4D\u0D15\u0D7E\u0D15\u0D4D\u0D15\u0D4D +${pointsEarned} \u0D32\u0D4B\u0D2F\u0D7D\u0D31\u0D4D\u0D31\u0D3F \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D32\u0D2D\u0D3F\u0D1A\u0D4D\u0D1A\u0D41!
\u0D06\u0D15\u0D46 \u0D2C\u0D3E\u0D32\u0D7B\u0D38\u0D4D: ${totalBalance} \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E (\u20B9${inrValue}).
\u0D05\u0D1F\u0D41\u0D24\u0D4D\u0D24 \u0D24\u0D35\u0D23 \u0D2D\u0D15\u0D4D\u0D37\u0D23\u0D02 \u0D15\u0D34\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D2E\u0D4D\u0D2A\u0D4B\u0D7E \u0D08 \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D09\u0D2A\u0D2F\u0D4B\u0D17\u0D3F\u0D1A\u0D4D\u0D1A\u0D4D \u0D07\u0D33\u0D35\u0D4D \u0D28\u0D47\u0D1F\u0D42! \u{1F35B}`;
    }
    return `Hi ${dinerName}! \u{1F389}
You just earned +${pointsEarned} loyalty points at ${restaurantName}!
Total Balance: ${totalBalance} Points (Worth \u20B9${inrValue}).
Redeem them on your next delicious meal! \u{1F37D}\uFE0F`;
  },
  // 2. 7-Day Expiry Reminder
  expiryReminder(dinerName, expiringPoints, expiryDateStr, restaurantName, lang = "en") {
    if (lang === "ml") {
      return `\u0D2A\u0D4D\u0D30\u0D3F\u0D2F\u0D2A\u0D4D\u0D2A\u0D46\u0D1F\u0D4D\u0D1F ${dinerName}, \u0D24\u0D3E\u0D19\u0D4D\u0D15\u0D33\u0D41\u0D1F\u0D46 ${expiringPoints} \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E ${expiryDateStr}-\u0D7D \u0D15\u0D3E\u0D32\u0D39\u0D30\u0D23\u0D2A\u0D4D\u0D2A\u0D46\u0D1F\u0D3E\u0D7B \u0D2A\u0D4B\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41! \u23F3
${restaurantName}-\u0D7D \u0D0E\u0D24\u0D4D\u0D24\u0D3F \u0D38\u0D4D\u0D35\u0D3E\u0D26\u0D3F\u0D37\u0D4D\u0D1F\u0D2E\u0D3E\u0D2F \u0D2D\u0D15\u0D4D\u0D37\u0D23\u0D02 \u0D06\u0D38\u0D4D\u0D35\u0D26\u0D3F\u0D1A\u0D4D\u0D1A\u0D4D \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D21\u0D3F\u0D38\u0D4D\u0D15\u0D57\u0D23\u0D4D\u0D1F\u0D3E\u0D2F\u0D3F \u0D09\u0D2A\u0D2F\u0D4B\u0D17\u0D3F\u0D15\u0D4D\u0D15\u0D42.`;
    }
    return `Hi ${dinerName}, your ${expiringPoints} loyalty points will expire on ${expiryDateStr}! \u23F3
Visit ${restaurantName} this week to redeem them for instant discounts on your bill.`;
  },
  // 3. Win-back Campaign (Kerala Feast / Double Points)
  winbackInvite(dinerName, multiplier, validDays, restaurantName, lang = "en") {
    if (lang === "ml") {
      return `\u0D1E\u0D19\u0D4D\u0D19\u0D7E \u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D46 \u0D2E\u0D3F\u0D38\u0D4D \u0D1A\u0D46\u0D2F\u0D4D\u0D2F\u0D41\u0D28\u0D4D\u0D28\u0D41, ${dinerName}! \u2764\uFE0F
${restaurantName}-\u0D7D \u0D24\u0D3E\u0D19\u0D4D\u0D15\u0D7E\u0D15\u0D4D\u0D15\u0D3E\u0D2F\u0D3F \u0D2A\u0D4D\u0D30\u0D24\u0D4D\u0D2F\u0D47\u0D15 ${multiplier}x \u0D21\u0D2C\u0D3F\u0D7E \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D4D \u0D13\u0D2B\u0D7C \u0D12\u0D30\u0D41\u0D15\u0D4D\u0D15\u0D3F\u0D2F\u0D3F\u0D30\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41!
\u0D05\u0D1F\u0D41\u0D24\u0D4D\u0D24 ${validDays} \u0D26\u0D3F\u0D35\u0D38\u0D24\u0D4D\u0D24\u0D3F\u0D28\u0D41\u0D33\u0D4D\u0D33\u0D3F\u0D7D \u0D38\u0D28\u0D4D\u0D26\u0D7C\u0D36\u0D3F\u0D1A\u0D4D\u0D1A\u0D4D \u0D07\u0D30\u0D1F\u0D4D\u0D1F\u0D3F \u0D2A\u0D4B\u0D2F\u0D3F\u0D28\u0D4D\u0D31\u0D41\u0D15\u0D7E \u0D28\u0D47\u0D1F\u0D42! \u{1F958}`;
    }
    return `We miss you at ${restaurantName}, ${dinerName}! \u2764\uFE0F
Enjoy an exclusive ${multiplier}x Points Multiplier on your entire bill when you visit us in the next ${validDays} days! Reserve your table today. \u{1F37D}\uFE0F`;
  },
  // 4. Referral Invite Link
  referralShare(referrerName, referralCode, referralUrl, restaurantName, lang = "en") {
    if (lang === "ml") {
      return `${referrerName} \u0D28\u0D3F\u0D19\u0D4D\u0D19\u0D33\u0D46 ${restaurantName}-\u0D32\u0D47\u0D15\u0D4D\u0D15\u0D4D \u0D15\u0D4D\u0D37\u0D23\u0D3F\u0D15\u0D4D\u0D15\u0D41\u0D28\u0D4D\u0D28\u0D41! \u{1F381}
\u0D08 \u0D32\u0D3F\u0D19\u0D4D\u0D15\u0D4D \u0D35\u0D34\u0D3F \u0D1A\u0D47\u0D30\u0D42, \u0D06\u0D26\u0D4D\u0D2F \u0D13\u0D7C\u0D21\u0D31\u0D3F\u0D7D \u20B950 \u0D21\u0D3F\u0D38\u0D4D\u0D15\u0D57\u0D23\u0D4D\u0D1F\u0D4D \u0D28\u0D47\u0D1F\u0D42: ${referralUrl}
(\u0D31\u0D2B\u0D31\u0D7D \u0D15\u0D4B\u0D21\u0D4D: ${referralCode})`;
    }
    return `${referrerName} invited you to try ${restaurantName}! \u{1F381}
Sign up using this link and get \u20B950 off your first meal: ${referralUrl}
(Code: ${referralCode})`;
  }
};
export {
  StubWhatsAppProvider,
  WhatsAppTemplates,
  defaultWhatsAppProvider
};
