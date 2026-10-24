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
    this.accessToken = account.access_token;
    this.webhookSecret = account.webhook_secret || process.env.META_WEBHOOK_APP_SECRET;
  }

  /**
   * Factory method to load restaurant's credentials from Supabase
   */
  static async forRestaurant(restaurantId) {
    if (!supabaseAdmin) {
      throw new Error('Supabase client is not available to load WhatsApp account credentials');
    }

    const { data: account, error } = await supabaseAdmin
      .from('wa_accounts')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !account) {
      throw new Error(`WhatsApp Account not found or not connected for restaurant ${restaurantId}`);
    }

    if (account.status !== 'CONNECTED') {
      throw new Error(`WhatsApp Account is not connected (current status: ${account.status})`);
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
    let cleaned = phone.replace(/[^0-9+]/g, '');

    // Default to +91 if Indian 10-digit number
    if (/^[6-9]\d{9}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      return `+91${cleaned.substring(1)}`;
    }
    if (!cleaned.startsWith('+')) {
      return `+${cleaned}`;
    }
    return cleaned;
  }
}
