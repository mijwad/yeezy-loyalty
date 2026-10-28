/**
 * Loyalty Event Triggers - Integration with POS and Loyalty Engine
 *
 * This module provides functions to automatically send WhatsApp messages
 * when loyalty events occur (purchase, redemption, points expiry, etc.)
 *
 * Usage in Petpooja webhook handler or loyalty engine:
 *
 * import { LoyaltyEventTriggers } from './whatsapp/loyaltyTriggers.js';
 *
 * // After bill settlement
 * await LoyaltyEventTriggers.onBillSettled(restaurantId, customer, order, pointsEarned);
 *
 * // After reward redemption
 * await LoyaltyEventTriggers.onRewardRedeemed(restaurantId, customer, reward, pointsUsed);
 *
 * // Scheduled job for points expiry
 * await LoyaltyEventTriggers.sendExpiryReminders(restaurantId);
 *
 * // Scheduled job for win-back
 * await LoyaltyEventTriggers.sendWinBackCampaigns(restaurantId);
 */

import { LoyaltyTemplateService, LOYALTY_EVENT_TYPES, sendFirstPurchaseMessage, sendRepeatPurchaseMessage, sendPointsReminderMessage, sendPointsExpiringMessage, sendRewardRedeemedMessage, sendWinbackMessage } from './loyaltyTemplates.js';

export class LoyaltyEventTriggers {
  constructor(restaurantId) {
    this.restaurantId = restaurantId;
    this.service = new LoyaltyTemplateService(restaurantId);
  }

  /**
   * Trigger: Customer makes a purchase (first or repeat)
   * Call this after bill settlement in POS webhook handler
   */
  async onBillSettled(customer, restaurant, order, pointsEarned, pointsBalance, isFirstPurchase = false) {
    // Check WhatsApp opt-in
    if (!customer.is_whatsapp_opt_in) {
      console.log(`[LoyaltyTriggers] Customer ${customer.id} opted out of WhatsApp`);
      return { skipped: true, reason: 'opt_out' };
    }

    // Check if first purchase (visit_count === 1 after this order)
    const isFirst = isFirstPurchase || (customer.total_visits_count || 0) <= 1;

    try {
      if (isFirst) {
        return await sendFirstPurchaseMessage(
          this.restaurantId,
          customer,
          restaurant,
          pointsEarned,
          pointsBalance
        );
      } else {
        return await sendRepeatPurchaseMessage(
          this.restaurantId,
          customer,
          restaurant,
          pointsEarned,
          pointsBalance
        );
      }
    } catch (error) {
      console.error(`[LoyaltyTriggers] Failed to send purchase message:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger: Customer redeems a reward
   * Call this after successful redemption in POS
   */
  async onRewardRedeemed(customer, restaurant, reward, pointsUsed, pointsBalance) {
    if (!customer.is_whatsapp_opt_in) {
      return { skipped: true, reason: 'opt_out' };
    }

    try {
      return await sendRewardRedeemedMessage(
        this.restaurantId,
        customer,
        restaurant,
        reward,
        pointsUsed,
        pointsBalance
      );
    } catch (error) {
      console.error(`[LoyaltyTriggers] Failed to send redemption message:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger: Send points balance reminder (monthly scheduled job)
   */
  async sendPointsReminders(minPoints = 1) {
    const { supabaseAdmin } from '../db/supabase.js';
    if (!supabaseAdmin) {
      throw new Error('Supabase not configured');
    }

    // Get customers with points balance >= minPoints who haven't been reminded recently
    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('id, phone_number, full_name, points_balance, is_whatsapp_opt_in, tenant_id')
      .eq('tenant_id', this.restaurantId)
      .eq('is_whatsapp_opt_in', true)
      .gte('points_balance', minPoints)
      .is('opt_out_at', null);

    if (error) throw error;
    if (!customers || customers.length === 0) {
      return { sent: 0, message: 'No eligible customers' };
    }

    // Get restaurant info
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', this.restaurantId)
      .single();

    const restaurant = { name: tenant?.name || 'Our Restaurant' };
    let sent = 0;
    let failed = 0;

    for (const customer of customers) {
      try {
        await sendPointsReminderMessage(
          this.restaurantId,
          { ...customer, phoneNumber: customer.phone_number },
          restaurant,
          customer.points_balance
        );
        sent++;
      } catch (err) {
        failed++;
        console.error(`[LoyaltyTriggers] Failed reminder for ${customer.id}:`, err.message);
      }
    }

    return { sent, failed, total: customers.length };
  }

  /**
   * Trigger: Send points expiring reminders (run daily via cron)
   */
  async sendExpiryReminders() {
    const { supabaseAdmin } from '../db/supabase.js';
    if (!supabaseAdmin) {
      throw new Error('Supabase not configured');
    }

    // Find points expiring in the next 30 days (based on loyalty_ledger_transactions.expires_at)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data: expiringPoints, error } = await supabaseAdmin
      .from('loyalty_ledger_transactions')
      .select(`
        id,
        customer_id,
        points_delta,
        expires_at,
        customers!inner(id, phone_number, full_name, is_whatsapp_opt_in, tenant_id)
      `)
      .eq('tenant_id', this.restaurantId)
      .gt('points_delta', 0) // Only earned points
      .eq('is_expired', false)
      .lte('expires_at', thirtyDaysFromNow.toISOString())
      .eq('customers.is_whatsapp_opt_in', true)
      .is('customers.opt_out_at', null);

    if (error) throw error;
    if (!expiringPoints || expiringPoints.length === 0) {
      return { sent: 0, message: 'No points expiring soon' };
    }

    // Group by customer
    const customerExpiryMap = new Map();
    for (const entry of expiringPoints) {
      const cid = entry.customer_id;
      if (!customerExpiryMap.has(cid)) {
        customerExpiryMap.set(cid, {
          customer: entry.customers,
          pointsExpiring: 0,
          earliestExpiry: entry.expires_at
        });
      }
      const data = customerExpiryMap.get(cid);
      data.pointsExpiring += entry.points_delta;
      if (new Date(entry.expires_at) < new Date(data.earliestExpiry)) {
        data.earliestExpiry = entry.expires_at;
      }
    }

    // Get restaurant info
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', this.restaurantId)
      .single();

    const restaurant = { name: tenant?.name || 'Our Restaurant' };
    let sent = 0;
    let failed = 0;

    for (const [customerId, data] of customerExpiryMap) {
      try {
        await sendPointsExpiringMessage(
          this.restaurantId,
          { ...data.customer, phoneNumber: data.customer.phone_number },
          restaurant,
          data.pointsExpiring,
          data.earliestExpiry
        );
        sent++;
      } catch (err) {
        failed++;
        console.error(`[LoyaltyTriggers] Failed expiry reminder for ${customerId}:`, err.message);
      }
    }

    return { sent, failed, total: customerExpiryMap.size };
  }

  /**
   * Trigger: Send win-back campaigns for lapsed customers
   * Run weekly via cron for customers who haven't visited in X days
   */
  async sendWinBackCampaigns(inactiveDays = 90, offerDetails = '20% off your next dine-in bill', offerValidDays = 7) {
    const { supabaseAdmin } from '../db/supabase.js';
    if (!supabaseAdmin) {
      throw new Error('Supabase not configured');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('id, phone_number, full_name, last_visit_at, is_whatsapp_opt_in, tenant_id')
      .eq('tenant_id', this.restaurantId)
      .eq('is_whatsapp_opt_in', true)
      .is('opt_out_at', null)
      .lt('last_visit_at', cutoffDate.toISOString())
      .not('last_visit_at', 'is', null);

    if (error) throw error;
    if (!customers || customers.length === 0) {
      return { sent: 0, message: 'No lapsed customers' };
    }

    // Get restaurant info
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', this.restaurantId)
      .single();

    const restaurant = { name: tenant?.name || 'Our Restaurant' };
    const offerExpiry = new Date();
    offerExpiry.setDate(offerExpiry.getDate() + offerValidDays);

    const offer = {
      details: offerDetails,
      expiryDate: offerExpiry
    };

    let sent = 0;
    let failed = 0;

    for (const customer of customers) {
      // Check if we already sent a win-back recently (frequency cap)
      const recentCutoff = new Date();
      recentCutoff.setDate(recentCutoff.getDate() - 30); // 30 day cap for win-back

      const { data: recentWinback } = await supabaseAdmin
        .from('campaign_messages')
        .select('id')
        .eq('tenant_id', this.restaurantId)
        .eq('customer_id', customer.id)
        .eq('status', 'sent')
        .gte('created_at', recentCutoff.toISOString())
        .limit(1);

      if (recentWinback && recentWinback.length > 0) {
        continue; // Skip - already sent win-back recently
      }

      try {
        await sendWinbackMessage(
          this.restaurantId,
          { ...customer, phoneNumber: customer.phone_number },
          restaurant,
          offer
        );
        sent++;
      } catch (err) {
        failed++;
        console.error(`[LoyaltyTriggers] Failed win-back for ${customer.id}:`, err.message);
      }
    }

    return { sent, failed, total: customers.length };
  }

  /**
   * Trigger: Send birthday bonus notification
   * Run daily via cron
   */
  async sendBirthdayMessages() {
    const { supabaseAdmin } from '../db/supabase.js';
    if (!supabaseAdmin) {
      throw new Error('Supabase not configured');
    }

    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const { data: customers, error } = await supabaseAdmin
      .from('customers')
      .select('id, phone_number, full_name, date_of_birth, is_whatsapp_opt_in, tenant_id')
      .eq('tenant_id', this.restaurantId)
      .eq('is_whatsapp_opt_in', true)
      .is('opt_out_at', null);

    if (error) throw error;
    if (!customers || customers.length === 0) {
      return { sent: 0, message: 'No customers with birthdays today' };
    }

    // Filter for today's birthdays
    const birthdayCustomers = customers.filter(c => {
      if (!c.date_of_birth) return false;
      const dob = new Date(c.date_of_birth);
      return dob.getMonth() + 1 === month && dob.getDate() === day;
    });

    if (birthdayCustomers.length === 0) {
      return { sent: 0, message: 'No birthdays today' };
    }

    // Get restaurant info
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name')
      .eq('id', this.restaurantId)
      .single();

    const restaurant = { name: tenant?.name || 'Our Restaurant' };
    let sent = 0;
    let failed = 0;

    for (const customer of birthdayCustomers) {
      try {
        // Send a birthday message (could be a custom template or use points reminder)
        await sendPointsReminderMessage(
          this.restaurantId,
          { ...customer, phoneNumber: customer.phone_number },
          restaurant,
          customer.points_balance || 0
        );
        sent++;
      } catch (err) {
        failed++;
        console.error(`[LoyaltyTriggers] Failed birthday message for ${customer.id}:`, err.message);
      }
    }

    return { sent, failed, total: birthdayCustomers.length };
  }

  /**
   * Get template status for debugging
   */
  async getTemplateStatus() {
    return this.service.getAllTemplateStatuses();
  }

  /**
   * Provision all templates if not already done
   */
  async ensureTemplatesProvisioned() {
    return this.service.ensureAllSystemTemplates();
  }
}

/**
 * Helper function to create triggers for a restaurant
 */
export function createLoyaltyTriggers(restaurantId) {
  return new LoyaltyEventTriggers(restaurantId);
}

/**
 * Example usage in Petpooja webhook handler:
 *
 * // In server/pos/PetpoojaAdapter.js or webhook handler
 * import { createLoyaltyTriggers } from './whatsapp/loyaltyTriggers.js';
 *
 * export async function handlePetpoojaBillSettled(webhookPayload) {
 *   const { restaurantId, customer, order, loyalty } = webhookPayload;
 *
 *   const triggers = createLoyaltyTriggers(restaurantId);
 *
 *   // Send WhatsApp notification
 *   await triggers.onBillSettled(
 *     customer,
 *     { name: restaurantName },
 *     order,
 *     loyalty.pointsEarned,
 *     loyalty.newBalance,
 *     loyalty.isFirstVisit
 *   );
 *
 *   // If redemption happened
 *   if (loyalty.pointsRedeemed > 0) {
 *     await triggers.onRewardRedeemed(
 *       customer,
 *       { name: restaurantName },
 *       { name: loyalty.redeemedRewardName },
 *       loyalty.pointsRedeemed,
 *       loyalty.newBalance
 *     );
 *   }
 * }
 */

/**
 * Example cron job setup (using node-cron or similar):
 *
 * import cron from 'node-cron';
 * import { createLoyaltyTriggers } from './whatsapp/loyaltyTriggers.js';
 *
 * // Daily at 10 AM - Check points expiry
 * cron.schedule('0 10 * * *', async () => {
 *   for (const restaurantId of getAllActiveRestaurantIds()) {
 *     const triggers = createLoyaltyTriggers(restaurantId);
 *     await triggers.sendExpiryReminders();
 *   }
 * });
 *
 * // Monthly 1st at 11 AM - Points balance reminders
 * cron.schedule('0 11 1 * *', async () => {
 *   for (const restaurantId of getAllActiveRestaurantIds()) {
 *     const triggers = createLoyaltyTriggers(restaurantId);
 *     await triggers.sendPointsReminders();
 *   }
 * });
 *
 * // Weekly Monday at 10 AM - Win-back campaigns
 * cron.schedule('0 10 * * 1', async () => {
 *   for (const restaurantId of getAllActiveRestaurantIds()) {
 *     const triggers = createLoyaltyTriggers(restaurantId);
 *     await triggers.sendWinBackCampaigns();
 *   }
 * });
 *
 * // Daily at 9 AM - Birthday messages
 * cron.schedule('0 9 * * *', async () => {
 *   for (const restaurantId of getAllActiveRestaurantIds()) {
 *     const triggers = createLoyaltyTriggers(restaurantId);
 *     await triggers.sendBirthdayMessages();
 *   }
 * });
 */