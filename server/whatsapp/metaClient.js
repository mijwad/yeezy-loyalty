/**
 * Official Meta WhatsApp Business Cloud API Client (Graph API v21.0)
 * Uses native fetch - zero unofficial libraries
 */
import crypto from 'node:crypto';
import { supabaseAdmin } from '../db/supabase.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

export class MetaWhatsAppClient {
  constructor(account) {
    if (!account) throw new Error('WhatsApp Account configuration is required');
    this.restaurantId = account.restaurant_id;
    this.phoneNumberId = account.phone_number_id;
    this.wabaId = account.waba_id;
    this.accessToken = account.access_token || process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    this.webhookSecret = account.webhook_secret || process.env.WHATSAPP_APP_SECRET || process.env.META_WEBHOOK_APP_SECRET;
  }

  /**
   * Factory method to load restaurant's credentials from Supabase
   */
  static async forRestaurant(restaurantId) {
    const envToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;

    if (!supabaseAdmin) {
      if (envToken) {
        return new MetaWhatsAppClient({
          restaurant_id: restaurantId,
          phone_number_id: process.env.META_PHONE_NUMBER_ID || 'default_phone_id',
          waba_id: process.env.META_WABA_ID || 'default_waba_id',
          access_token: envToken,
          status: 'CONNECTED'
        });
      }
      throw new Error('Supabase client is not available to load WhatsApp account credentials');
    }

    let account = null;
    const { data: matchedAccount } = await supabaseAdmin
      .from('wa_accounts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (matchedAccount && matchedAccount.status === 'CONNECTED') {
      account = matchedAccount;
    } else {
      // Fallback: Use active connected account for platform
      const { data: fallbackAccount } = await supabaseAdmin
        .from('wa_accounts')
        .select('*')
        .eq('status', 'CONNECTED')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      account = fallbackAccount || matchedAccount;
    }

    if (!account) {
      if (envToken) {
        return new MetaWhatsAppClient({
          restaurant_id: restaurantId,
          phone_number_id: process.env.META_PHONE_NUMBER_ID || '1369137272956532',
          waba_id: process.env.META_WABA_ID || '1139673141923119',
          access_token: envToken,
          status: 'CONNECTED'
        });
      }
      throw new Error(`WhatsApp Account not found or not connected for restaurant ${restaurantId}`);
    }

    return new MetaWhatsAppClient(account);
  }

  /**
   * Submit a Message Template to Meta for approval via Graph API
   * POST /{waba_id}/message_templates
   */
  async submitTemplate({ name, category, language = 'en_US', body, headerText, footerText, buttons = [], exampleValues = [] }) {
    const url = `${GRAPH_API_BASE}/${this.wabaId}/message_templates`;

    const components = [];

    // Optional Header
    if (headerText) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: headerText
      });
    }

    // Required Body with example parameters if variables are present
    const bodyComponent = {
      type: 'BODY',
      text: body
    };

    if (exampleValues && exampleValues.length > 0) {
      bodyComponent.example = {
        body_text: [exampleValues]
      };
    }
    components.push(bodyComponent);

    // Optional Footer
    if (footerText) {
      components.push({
        type: 'FOOTER',
        text: footerText
      });
    }

    // Optional Buttons
    if (buttons && buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.map(b => ({
          type: b.type || 'QUICK_REPLY',
          text: b.text
        }))
      });
    }

    const payload = {
      name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      category: category || 'MARKETING',
      language,
      components
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();

    if (!response.ok) {
      const errMsg = json?.error?.message || `Meta Graph API error (${response.status})`;
      const errCode = json?.error?.code || 'META_API_ERROR';
      throw new Error(`Template submission failed: ${errMsg} [${errCode}]`);
    }

    return {
      metaTemplateId: json.id,
      status: json.status || 'PENDING'
    };
  }

  /**
   * Sync Template status from Meta Graph API
   */
  async syncTemplateStatus(templateName) {
    const url = `${GRAPH_API_BASE}/${this.wabaId}/message_templates?name=${encodeURIComponent(templateName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const json = await response.json();
    if (!response.ok) {
      throw new Error(`Failed to sync template status: ${json?.error?.message || response.statusText}`);
    }

    const templateData = json.data?.[0];
    return {
      status: templateData?.status || 'PENDING',
      metaTemplateId: templateData?.id,
      rejectionReason: templateData?.rejected_reason || null
    };
  }

  /**
   * Send a Template Message to a single customer
   * POST /{phone_number_id}/messages
   */
  async sendTemplateMessage({ recipientPhone, templateName, language = 'en_US', parameters = [] }) {
    const cleanPhone = MetaWhatsAppClient.normalizePhoneE164(recipientPhone);
    const url = `${GRAPH_API_BASE}/${this.phoneNumberId}/messages`;

    const bodyParameters = parameters.map((val) => ({
      type: 'text',
      text: String(val)
    }));

    const components = [];
    if (bodyParameters.length > 0) {
      components.push({
        type: 'body',
        parameters: bodyParameters
      });
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const json = await response.json();

    if (!response.ok) {
      const err = json?.error || {};
      return {
        success: false,
        errorCode: String(err.code || response.status),
        errorMessage: err.message || 'Meta API error',
        metaMessageId: null
      };
    }

    return {
      success: true,
      metaMessageId: json.messages?.[0]?.id,
      status: 'sent',
      cost: 0.78 // Meta India Marketing message estimated cost in INR
    };
  }

  /**
   * Verify Meta Webhook Signature (X-Hub-Signature-256)
   */
  static verifyWebhookSignature(rawBody, signatureHeader, appSecret) {
    if (!signatureHeader || !appSecret) return false;
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSig));
    } catch {
      return false;
    }
  }

  /**
   * Normalize phone number to canonical E.164 format (+91 default for India)
   */
  static normalizePhoneE164(phone) {
    if (!phone) throw new Error('Phone number is required');
    let digits = String(phone).replace(/[^0-9]/g, '');

    // If starts with 91 and has 12 digits (e.g. 919745630606)
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    // If has 11 digits starting with 0 (e.g. 09745830506)
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91${digits.slice(1)}`;
    }
    // Standard Indian 10 digits
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    // Any other format, take last 10 digits if it matches Indian mobile
    if (digits.length > 10 && /^[6-9]\d{9}$/.test(digits.slice(-10))) {
      return `+91${digits.slice(-10)}`;
    }
    return `+${digits}`;
  }
}
