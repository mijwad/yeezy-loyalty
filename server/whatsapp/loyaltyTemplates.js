/**
 * Loyalty WhatsApp Template Configuration System
 * Defines the 6 core loyalty event templates with variable mappings
 * Provides template creation, validation, and Meta synchronization utilities
 */

import { MetaWhatsAppClient } from './metaClient.js';
import { supabaseAdmin } from '../db/supabase.js';

// ============================================================================
// 1. LOYALTY EVENT TEMPLATE DEFINITIONS
// ============================================================================

/**
 * Core loyalty event types that map to WhatsApp templates
 */
export const LOYALTY_EVENT_TYPES = {
  FIRST_PURCHASE: 'FIRST_PURCHASE',
  REPEAT_PURCHASE: 'REPEAT_PURCHASE',
  POINTS_REMINDER: 'POINTS_REMINDER',
  POINTS_EXPIRING: 'POINTS_EXPIRING',
  REWARD_REDEEMED: 'REWARD_REDEEMED',
  CUSTOMER_WINBACK: 'CUSTOMER_WINBACK'
};

/**
 * Template category mapping - Utility for transactional, Marketing for promotional
 */
export const TEMPLATE_CATEGORY_BY_EVENT = {
  [LOYALTY_EVENT_TYPES.FIRST_PURCHASE]: 'UTILITY',
  [LOYALTY_EVENT_TYPES.REPEAT_PURCHASE]: 'UTILITY',
  [LOYALTY_EVENT_TYPES.POINTS_REMINDER]: 'UTILITY', // Can be MARKETING if promotional
  [LOYALTY_EVENT_TYPES.POINTS_EXPIRING]: 'UTILITY',
  [LOYALTY_EVENT_TYPES.REWARD_REDEEMED]: 'UTILITY',
  [LOYALTY_EVENT_TYPES.CUSTOMER_WINBACK]: 'MARKETING'
};

/**
 * System template names (lowercase with underscores for Meta compliance)
 */
export const SYSTEM_TEMPLATE_NAMES = {
  [LOYALTY_EVENT_TYPES.FIRST_PURCHASE]: 'bee_first_purchase',
  [LOYALTY_EVENT_TYPES.REPEAT_PURCHASE]: 'bee_subsequent_purc',
  [LOYALTY_EVENT_TYPES.POINTS_REMINDER]: 'bee_points_reminder',
  [LOYALTY_EVENT_TYPES.POINTS_EXPIRING]: 'bee_points_expiry',
  [LOYALTY_EVENT_TYPES.REWARD_REDEEMED]: 'loyalty_reward_redeemed',
  [LOYALTY_EVENT_TYPES.CUSTOMER_WINBACK]: 'loyalty_winback_offer'
};

/**
 * Complete template definitions for the 6 loyalty message purposes
 */
export const LOYALTY_TEMPLATES = {
  [LOYALTY_EVENT_TYPES.FIRST_PURCHASE]: {
    name: SYSTEM_TEMPLATE_NAMES[LOYALTY_EVENT_TYPES.FIRST_PURCHASE],
    alternateName: 'loyalty_first_purchase',
    eventType: LOYALTY_EVENT_TYPES.FIRST_PURCHASE,
    category: TEMPLATE_CATEGORY_BY_EVENT[LOYALTY_EVENT_TYPES.FIRST_PURCHASE],
    language: 'en',
    headerText: '',
    bodyText: 'Dear Customer,\n\nYour first purchase at {{1}} has been completed successfully.\n\nYou have earned {{2}} points on this purchase.\n\nYour updated loyalty points balance is {{3}} points.\n\nThis message has been sent to inform you about an account update related to your recent purchase.\n\nClick below to view your account details.',
    footerText: '',
    variables: [
      { index: 1, name: 'restaurant_name', sample: 'Durbar', type: 'restaurant.name', required: true, description: 'Restaurant name' },
      { index: 2, name: 'points_earned', sample: '100', type: 'loyalty.points_earned', required: true, description: 'Points earned' },
      { index: 3, name: 'points_balance', sample: '100', type: 'loyalty.points_balance', required: true, description: 'Total points balance' }
    ],
    buttons: [],
    description: 'Sent when a customer makes their first purchase and joins the loyalty program',
    isSystemTemplate: true
  },

  [LOYALTY_EVENT_TYPES.REPEAT_PURCHASE]: {
    name: SYSTEM_TEMPLATE_NAMES[LOYALTY_EVENT_TYPES.REPEAT_PURCHASE],
    alternateName: 'bee_subsequent_purchase',
    eventType: LOYALTY_EVENT_TYPES.REPEAT_PURCHASE,
    category: TEMPLATE_CATEGORY_BY_EVENT[LOYALTY_EVENT_TYPES.REPEAT_PURCHASE],
    language: 'en',
    headerText: '',
    bodyText: 'Dear Customer,\n\nYour purchase at {{1}} has been completed successfully.\n\nYou have earned {{2}} points on this purchase.\n\nYour updated loyalty points balance is {{3}} points.\n\nThis message has been sent to inform you about an account update related to your recent purchase.\n\nClick below to view your account details.',
    footerText: '',
    variables: [
      { index: 1, name: 'restaurant_name', sample: 'Durbar', type: 'restaurant.name', required: true, description: 'Restaurant name' },
      { index: 2, name: 'points_earned', sample: '50', type: 'loyalty.points_earned', required: true, description: 'Points earned' },
      { index: 3, name: 'points_balance', sample: '150', type: 'loyalty.points_balance', required: true, description: 'Total points balance' }
    ],
    buttons: [],
    description: 'Sent when a returning customer makes a purchase and earns points',
    isSystemTemplate: true
  },

  [LOYALTY_EVENT_TYPES.POINTS_REMINDER]: {
    name: SYSTEM_TEMPLATE_NAMES[LOYALTY_EVENT_TYPES.POINTS_REMINDER],
    alternateName: 'loyalty_points_reminder',
    eventType: LOYALTY_EVENT_TYPES.POINTS_REMINDER,
    category: TEMPLATE_CATEGORY_BY_EVENT[LOYALTY_EVENT_TYPES.POINTS_REMINDER],
    language: 'en',
    headerText: '',
    bodyText: 'Dear Customer,\n\nThis is to inform you that your current loyalty points balance at {{1}} is {{2}} points.\n\nThese points are available in your loyalty account as per the restaurant\'s rewards programme.\n\nThis message has been sent to provide you with an update regarding your loyalty account balance.\n\nClick below to view your account details.',
    footerText: '',
    variables: [
      { index: 1, name: 'restaurant_name', sample: 'Durbar', type: 'restaurant.name', required: true, description: 'Restaurant name' },
      { index: 2, name: 'points_balance', sample: '150', type: 'loyalty.points_balance', required: true, description: 'Available points balance' }
    ],
    buttons: [],
    description: 'Periodic reminder of points balance',
    isSystemTemplate: true
  },

  [LOYALTY_EVENT_TYPES.POINTS_EXPIRING]: {
    name: SYSTEM_TEMPLATE_NAMES[LOYALTY_EVENT_TYPES.POINTS_EXPIRING],
    alternateName: 'loyalty_points_expiry',
    eventType: LOYALTY_EVENT_TYPES.POINTS_EXPIRING,
    category: TEMPLATE_CATEGORY_BY_EVENT[LOYALTY_EVENT_TYPES.POINTS_EXPIRING],
    language: 'en',
    headerText: '',
    bodyText: 'Dear Customer,\n\nThis is to inform you that {{1}} points in your loyalty account at {{2}} are scheduled to expire on {{3}}.\n\nThis message has been sent to notify you about an upcoming expiry related to your loyalty account.\n\nClick below to view your account details.',
    footerText: '',
    variables: [
      { index: 1, name: 'points_expiring', sample: '50', type: 'loyalty.points_expiring', required: true, description: 'Points expiring' },
      { index: 2, name: 'restaurant_name', sample: 'Durbar', type: 'restaurant.name', required: true, description: 'Restaurant name' },
      { index: 3, name: 'expiry_date', sample: '2026-12-31', type: 'loyalty.expiry_date', required: true, description: 'Expiry date' }
    ],
    buttons: [],
    description: 'Sent when points are close to expiration',
    isSystemTemplate: true
  },

  [LOYALTY_EVENT_TYPES.REWARD_REDEEMED]: {
    name: SYSTEM_TEMPLATE_NAMES[LOYALTY_EVENT_TYPES.REWARD_REDEEMED],
    eventType: LOYALTY_EVENT_TYPES.REWARD_REDEEMED,
    category: TEMPLATE_CATEGORY_BY_EVENT[LOYALTY_EVENT_TYPES.REWARD_REDEEMED],
    language: 'en_US',
    headerText: 'Reward Redeemed Successfully ✅',
    bodyText: 'Hi {{1}}, your reward {{2}} has been redeemed at {{3}}. Points used: {{4}}. Your remaining balance is {{5}} points.',
    footerText: 'Enjoy your reward! Visit again to earn more.',
    variables: [
      { index: 1, name: 'customer_name', sample: 'Priya', type: 'customer.name', required: true, description: 'Customer full name' },
      { index: 2, name: 'reward_name', sample: 'Free Dessert', type: 'loyalty.reward_name', required: true, description: 'Name of redeemed reward' },
      { index: 3, name: 'restaurant_name', sample: 'Smoke House Deli', type: 'restaurant.name', required: true, description: 'Restaurant/outlet name' },
      { index: 4, name: 'points_used', sample: '200', type: 'loyalty.points_used', required: true, description: 'Points spent on redemption' },
      { index: 5, name: 'points_balance', sample: '235', type: 'loyalty.points_balance', required: true, description: 'Remaining points balance after redemption' }
    ],
    buttons: [],
    description: 'Confirmation sent when a customer redeems a reward using points',
    isSystemTemplate: true
  },

  [LOYALTY_EVENT_TYPES.CUSTOMER_WINBACK]: {
    name: SYSTEM_TEMPLATE_NAMES[LOYALTY_EVENT_TYPES.CUSTOMER_WINBACK],
    eventType: LOYALTY_EVENT_TYPES.CUSTOMER_WINBACK,
    category: TEMPLATE_CATEGORY_BY_EVENT[LOYALTY_EVENT_TYPES.CUSTOMER_WINBACK],
    language: 'en_US',
    headerText: 'We Miss You! 💙',
    bodyText: 'Hi {{1}}, we miss seeing you at {{2}}! Here is a special offer: {{3}}. Valid until {{4}}. We hope to see you again soon.',
    footerText: 'Terms apply. Show this message at checkout.',
    variables: [
      { index: 1, name: 'customer_name', sample: 'Ananya', type: 'customer.name', required: true, description: 'Customer full name' },
      { index: 2, name: 'restaurant_name', sample: 'Smoke House Deli', type: 'restaurant.name', required: true, description: 'Restaurant/outlet name' },
      { index: 3, name: 'offer_details', sample: '20% off your next dine-in bill', type: 'offer.details', required: true, description: 'Win-back offer description' },
      { index: 4, name: 'offer_expiry', sample: 'Sunday, December 15', type: 'offer.expiry_date', required: true, description: 'Offer validity date (formatted)' }
    ],
    buttons: [
      { type: 'QUICK_REPLY', text: 'Claim Offer' },
      { type: 'QUICK_REPLY', text: 'View Menu' }
    ],
    description: 'Marketing message for win-back campaigns. Respect marketing consent and opt-outs.',
    isSystemTemplate: true
  }
};

// ============================================================================
// 2. VARIABLE TYPE RESOLVERS
// ============================================================================

/**
 * Variable type resolvers - map variable types to actual data sources
 * These are used to resolve template variables at send time
 */
export const VARIABLE_RESOLVERS = {
  'customer.name': (context) => context.customer?.fullName || context.customer?.name || 'Valued Guest',
  'customer.phone': (context) => context.customer?.phoneNumber || context.customer?.phone || context.customer?.phone_e164 || '',
  'customer.visits': (context) => String(context.customer?.totalVisitsCount || context.customer?.visits || context.customer?.visit_count || 1),
  'customer.tier': (context) => context.customer?.currentTier?.tierName || context.customer?.tier || 'Silver',
  'restaurant.name': (context) => context.restaurant?.name || context.outlet?.name || 'Our Restaurant',
  'loyalty.points_earned': (context) => String(context.pointsEarned || 0),
  'loyalty.points_balance': (context) => String(context.pointsBalance ?? context.customer?.pointsBalance ?? 0),
  'loyalty.points_expiring': (context) => String(context.pointsExpiring || 0),
  'loyalty.expiry_date': (context) => context.expiryDate ? formatDate(context.expiryDate) : '',
  'loyalty.reward_name': (context) => context.reward?.name || 'Reward',
  'loyalty.points_used': (context) => String(context.pointsUsed || 0),
  'offer.details': (context) => context.offer?.details || 'Special discount on your next visit',
  'offer.expiry_date': (context) => context.offer?.expiryDate ? formatDate(context.offer.expiryDate) : ''
};

/**
 * Format date for display in templates
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Resolve all variables for a template given a context
 */
export function resolveTemplateVariables(templateName, context) {
  const template = LOYALTY_TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Template not found for event: ${templateName}`);
  }

  return template.variables.map(v => {
    const resolver = VARIABLE_RESOLVERS[v.type];
    if (resolver) {
      return resolver(context);
    }
    // Fallback to sample value or context lookup
    return context[v.name] || v.sample || `{{${v.index}}}`;
  });
}

// ============================================================================
// 3. TEMPLATE MANAGEMENT SERVICE
// ============================================================================

export class LoyaltyTemplateService {
  constructor(restaurantId) {
    this.restaurantId = restaurantId;
    this.client = null;
  }

  /**
   * Initialize Meta client for this restaurant
   */
  async initClient() {
    if (!this.client) {
      this.client = await MetaWhatsAppClient.forRestaurant(this.restaurantId);
    }
    return this.client;
  }

  /**
   * Get all system template definitions
   */
  static getAllTemplates() {
    return Object.values(LOYALTY_TEMPLATES);
  }

  /**
   * Get template definition by event type
   */
  static getTemplate(eventType) {
    return LOYALTY_TEMPLATES[eventType];
  }

  /**
   * Get template names for all events
   */
  static getTemplateNames() {
    return Object.values(SYSTEM_TEMPLATE_NAMES);
  }

  /**
   * Create or update a system template in database and submit to Meta
   */
  async ensureSystemTemplate(eventType, options = {}) {
    const templateDef = LOYALTY_TEMPLATES[eventType];
    if (!templateDef) {
      throw new Error(`Unknown event type: ${eventType}`);
    }

    const name = templateDef.name;
    const language = templateDef.language;
    const category = templateDef.category;

    try {
      // Check if template already exists in database
      let existingTemplate = null;
      if (supabaseAdmin) {
        const { data } = await supabaseAdmin
          .from('wa_templates')
          .select('*')
          .eq('tenant_id', this.restaurantId)
          .eq('name', name)
          .eq('language', language)
          .single();
        existingTemplate = data;
      }

      // Prepare template data
      const templateData = {
        tenant_id: this.restaurantId,
        name,
        language,
        category,
        header_text: templateDef.headerText,
        body_text: templateDef.bodyText,
        footer_text: templateDef.footerText,
        buttons: templateDef.buttons,
        variables: templateDef.variables,
        event_type: eventType,
        is_system_template: true,
        description: templateDef.description,
        meta_status: existingTemplate?.meta_status || 'DRAFT',
        meta_template_id: existingTemplate?.meta_template_id
      };

      // Submit to Meta if not already approved
      if (!existingTemplate || existingTemplate.meta_status !== 'APPROVED') {
        const client = await this.initClient();
        try {
          const submission = await client.submitTemplate({
            name,
            category,
            language,
            body: templateDef.bodyText,
            headerText: templateDef.headerText,
            footerText: templateDef.footerText,
            buttons: templateDef.buttons,
            exampleValues: templateDef.variables.map(v => v.sample)
          });

          templateData.meta_status = submission.status;
          templateData.meta_template_id = submission.metaTemplateId;
          templateData.last_synced_at = new Date().toISOString();
        } catch (metaErr) {
          console.warn(`[LoyaltyTemplateService] Meta submission failed for ${name}:`, metaErr.message);
          templateData.meta_status = 'PENDING';
        }
      }

      // Upsert in database
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('wa_templates')
          .upsert(templateData, { onConflict: 'tenant_id,name,language' })
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      return templateData;
    } catch (error) {
      console.error(`[LoyaltyTemplateService] Failed to ensure template ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Ensure all 6 system templates exist for a restaurant
   */
  async ensureAllSystemTemplates() {
    const results = [];
    for (const eventType of Object.values(LOYALTY_EVENT_TYPES)) {
      try {
        const result = await this.ensureSystemTemplate(eventType);
        results.push({ eventType, success: true, template: result });
      } catch (err) {
        results.push({ eventType, success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Sync template status from Meta
   */
  async syncTemplateStatus(templateName) {
    try {
      const client = await this.initClient();
      const status = await client.syncTemplateStatus(templateName);

      if (supabaseAdmin) {
        await supabaseAdmin
          .from('wa_templates')
          .update({
            meta_status: status.status,
            meta_template_id: status.metaTemplateId,
            meta_rejection_reason: status.rejectionReason,
            last_synced_at: new Date().toISOString()
          })
          .eq('tenant_id', this.restaurantId)
          .eq('name', templateName);
      }

      return status;
    } catch (error) {
      console.error(`[LoyaltyTemplateService] Sync failed for ${templateName}:`, error.message);
      throw error;
    }
  }

  /**
   * Sync all system template statuses
   */
  async syncAllTemplateStatuses() {
    const results = [];
    for (const name of Object.values(SYSTEM_TEMPLATE_NAMES)) {
      try {
        const status = await this.syncTemplateStatus(name);
        results.push({ template: name, ...status });
      } catch (err) {
        results.push({ template: name, error: err.message });
      }
    }
    return results;
  }

  /**
   * Get template status for all system templates
   */
  async getAllTemplateStatuses() {
    if (!supabaseAdmin) {
      return Object.values(LOYALTY_TEMPLATES).map(t => ({
        name: t.name,
        event_type: t.eventType,
        category: t.category,
        meta_status: 'DRAFT',
        meta_template_id: null
      }));
    }

    const { data, error } = await supabaseAdmin
      .from('wa_templates')
      .select('name, event_type, category, meta_status, meta_template_id, meta_rejection_reason, last_synced_at')
      .eq('tenant_id', this.restaurantId)
      .eq('is_system_template', true)
      .in('name', Object.values(SYSTEM_TEMPLATE_NAMES));

    if (error) throw error;
    return data || [];
  }

  /**
   * Send a loyalty event message to a customer
   */
  async sendLoyaltyMessage(eventType, customerPhone, context) {
    const templateDef = LOYALTY_TEMPLATES[eventType];
    if (!templateDef) {
      throw new Error(`Unknown event type: ${eventType}`);
    }

    const client = await this.initClient();
    const parameters = resolveTemplateVariables(eventType, context);

    let result = await client.sendTemplateMessage({
      recipientPhone: customerPhone,
      templateName: templateDef.name,
      language: templateDef.language || 'en',
      parameters
    });

    // If failed, try language 'en_US'
    if (!result.success && templateDef.language === 'en') {
      const retryResult = await client.sendTemplateMessage({
        recipientPhone: customerPhone,
        templateName: templateDef.name,
        language: 'en_US',
        parameters
      });
      if (retryResult.success) result = retryResult;
    }

    // If still failed and alternate name exists (e.g. bee_subsequent_purchase)
    if (!result.success && templateDef.alternateName) {
      const altResult = await client.sendTemplateMessage({
        recipientPhone: customerPhone,
        templateName: templateDef.alternateName,
        language: templateDef.language || 'en',
        parameters
      });
      if (altResult.success) {
        result = altResult;
      } else {
        // Try alternate with en_US
        const altResultUs = await client.sendTemplateMessage({
          recipientPhone: customerPhone,
          templateName: templateDef.alternateName,
          language: 'en_US',
          parameters
        });
        if (altResultUs.success) result = altResultUs;
      }
    }

    // Log message
    if (supabaseAdmin && result.success) {
      try {
        await supabaseAdmin.from('wa_message_log').insert({
          tenant_id: this.restaurantId,
          customer_id: context.customer?.id,
          direction: 'outbound',
          message_type: 'template',
          wa_message_id: result.metaMessageId,
          template_name: templateDef.name,
          template_language: templateDef.language,
          to_phone_e164: MetaWhatsAppClient.normalizePhoneE164(customerPhone),
          status: result.status,
          cost: result.cost,
          created_at: new Date().toISOString()
        });
      } catch (_) {}
    }

    return result;
  }
}

// ============================================================================
// 4. HELPER FUNCTIONS FOR COMMON LOYALTY EVENTS
// ============================================================================

function resolveCustomerPhone(customer) {
  return customer?.phoneNumber || customer?.phone || customer?.phone_e164 || customer?.mobile || '';
}

/**
 * Send first purchase welcome message
 */
export async function sendFirstPurchaseMessage(restaurantId, customer, restaurant, pointsEarned, pointsBalance) {
  const service = new LoyaltyTemplateService(restaurantId);
  const phone = resolveCustomerPhone(customer);
  return service.sendLoyaltyMessage(LOYALTY_EVENT_TYPES.FIRST_PURCHASE, phone, {
    customer,
    restaurant,
    pointsEarned,
    pointsBalance
  });
}

/**
 * Send repeat purchase message
 */
export async function sendRepeatPurchaseMessage(restaurantId, customer, restaurant, pointsEarned, pointsBalance) {
  const service = new LoyaltyTemplateService(restaurantId);
  const phone = resolveCustomerPhone(customer);
  return service.sendLoyaltyMessage(LOYALTY_EVENT_TYPES.REPEAT_PURCHASE, phone, {
    customer,
    restaurant,
    pointsEarned,
    pointsBalance
  });
}

/**
 * Send points reminder message
 */
export async function sendPointsReminderMessage(restaurantId, customer, restaurant, pointsBalance) {
  const service = new LoyaltyTemplateService(restaurantId);
  const phone = resolveCustomerPhone(customer);
  return service.sendLoyaltyMessage(LOYALTY_EVENT_TYPES.POINTS_REMINDER, phone, {
    customer,
    restaurant,
    pointsBalance
  });
}

/**
 * Send points expiring message
 */
export async function sendPointsExpiringMessage(restaurantId, customer, restaurant, pointsExpiring, expiryDate) {
  const service = new LoyaltyTemplateService(restaurantId);
  const phone = resolveCustomerPhone(customer);
  return service.sendLoyaltyMessage(LOYALTY_EVENT_TYPES.POINTS_EXPIRING, phone, {
    customer,
    restaurant,
    pointsExpiring,
    expiryDate
  });
}

/**
 * Send reward redemption confirmation
 */
export async function sendRewardRedeemedMessage(restaurantId, customer, restaurant, reward, pointsUsed, pointsBalance) {
  const service = new LoyaltyTemplateService(restaurantId);
  const phone = resolveCustomerPhone(customer);
  return service.sendLoyaltyMessage(LOYALTY_EVENT_TYPES.REWARD_REDEEMED, phone, {
    customer,
    restaurant,
    reward,
    pointsUsed,
    pointsBalance
  });
}

/**
 * Send win-back campaign message
 */
export async function sendWinbackMessage(restaurantId, customer, restaurant, offer) {
  const service = new LoyaltyTemplateService(restaurantId);
  return service.sendLoyaltyMessage(LOYALTY_EVENT_TYPES.CUSTOMER_WINBACK, customer.phoneNumber, {
    customer,
    restaurant,
    offer
  });
}

// ============================================================================
// 5. VALIDATION UTILITIES
// ============================================================================

/**
 * Validate template body for Meta compliance
 */
export function validateTemplateBody(bodyText, variables) {
  const errors = [];

  // Check length (1024 chars max)
  if (bodyText.length > 1024) {
    errors.push(`Body text exceeds 1024 characters (current: ${bodyText.length})`);
  }

  // Check for required variables
  const varPattern = /\{\{(\d+)\}\}/g;
  const foundIndices = new Set();
  let match;
  while ((match = varPattern.exec(bodyText)) !== null) {
    foundIndices.add(parseInt(match[1], 10));
  }

  const expectedIndices = variables.map(v => v.index).sort((a, b) => a - b);
  for (const idx of expectedIndices) {
    if (!foundIndices.has(idx)) {
      errors.push(`Variable {{${idx}}} (${variables.find(v => v.index === idx)?.name}) not found in body text`);
    }
  }

  // Check for extra variables
  for (const idx of foundIndices) {
    if (!expectedIndices.includes(idx)) {
      errors.push(`Unexpected variable {{${idx}}} in body text`);
    }
  }

  // Check header length (160 chars max)
  // Check footer length (60 chars max)

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate all system templates
 */
export function validateAllTemplates() {
  const results = {};
  for (const [eventType, template] of Object.entries(LOYALTY_TEMPLATES)) {
    const validation = validateTemplateBody(template.bodyText, template.variables);
    results[eventType] = {
      name: template.name,
      ...validation
    };
  }
  return results;
}