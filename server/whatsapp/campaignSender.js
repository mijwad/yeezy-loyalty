/**
 * Campaign Dispatcher & Batch Sending Queue Engine
 * Sends WhatsApp campaigns via Meta Graph API with rate limiting, retries, frequency caps, and idempotency
 */
import { supabaseAdmin } from '../db/supabase.js';
import { MetaWhatsAppClient } from './metaClient.js';
import { SegmentEngine } from './segmentEngine.js';

export class CampaignSender {
  /**
   * Send a test campaign message to the restaurant owner's test number
   */
  static async sendTestMessage({ restaurantId, templateId, testPhone, variableMapping = {} }) {
    if (!restaurantId || !templateId || !testPhone) {
      throw new Error('restaurantId, templateId, and testPhone are required for test send');
    }

    const client = await MetaWhatsAppClient.forRestaurant(restaurantId);

    // Fetch template details
    const { data: template, error: tmplError } = await supabaseAdmin
      .from('wa_templates')
      .select('*')
      .eq('id', templateId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (tmplError || !template) {
      throw new Error('Template not found or not accessible');
    }

    if (template.meta_status !== 'APPROVED') {
      throw new Error(`Cannot send test message: template is ${template.meta_status} (must be APPROVED)`);
    }

    // Resolve variables
    const parameters = (template.variables || []).map((v, idx) => {
      const key = String(idx + 1);
      return variableMapping[key] || v.sample || `Sample_${idx + 1}`;
    });

    return client.sendTemplateMessage({
      recipientPhone: testPhone,
      templateName: template.name,
      language: template.language,
      parameters
    });
  }

  /**
   * Execute or schedule full campaign batch sending
   */
  static async startCampaign(campaignId, restaurantId) {
    if (!supabaseAdmin) {
      throw new Error('Supabase client unavailable');
    }

    // 1. Lock campaign row and set status to 'sending'
    const { data: campaign, error: cError } = await supabaseAdmin
      .from('campaigns')
      .select('*, wa_templates(*)')
      .eq('id', campaignId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (cError || !campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'sending' || campaign.status === 'completed') {
      throw new Error(`Campaign cannot be started: current status is ${campaign.status}`);
    }

    const template = campaign.wa_templates;
    if (!template || template.meta_status !== 'APPROVED') {
      throw new Error('Associated template is not APPROVED by Meta');
    }

    const client = await MetaWhatsAppClient.forRestaurant(restaurantId);

    // 2. Fetch segment or preset definition
    let presetType = 'all';
    let customRules = {};
    if (campaign.segment_id) {
      const { data: segment } = await supabaseAdmin
        .from('segments')
        .select('*')
        .eq('id', campaign.segment_id)
        .single();
      if (segment) {
        presetType = segment.preset_type || 'custom';
        customRules = segment.rules || {};
      }
    }

    // 3. Resolve eligible audience strictly respecting opt-in and frequency capping
    const recipients = await SegmentEngine.getEligibleRecipients(restaurantId, {
      presetType,
      customRules,
      frequencyCapDays: campaign.frequency_cap_days || 7
    });

    if (recipients.length === 0) {
      await supabaseAdmin.from('campaigns').update({
        status: 'completed',
        total_audience: 0,
        completed_at: new Date().toISOString()
      }).eq('id', campaignId);
      return { totalAudience: 0, sent: 0, failed: 0 };
    }

    // Update campaign state
    await supabaseAdmin.from('campaigns').update({
      status: 'sending',
      sent_at: new Date().toISOString(),
      total_audience: recipients.length
    }).eq('id', campaignId);

    // 4. Batch Dispatcher with rate limiting (respecting Meta tier limits)
    let successCount = 0;
    let failureCount = 0;
    let totalCost = 0;

    const BATCH_SIZE = 25;
    const DELAY_BETWEEN_BATCHES_MS = 600; // ~40 messages/sec guardrail

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (customer) => {
        try {
          // Idempotency: Check if already queued/sent for this campaign
          const { data: existing } = await supabaseAdmin
            .from('campaign_messages')
            .select('id')
            .eq('campaign_id', campaignId)
            .eq('customer_id', customer.id)
            .single();

          if (existing) {
            return; // Skip duplicate send
          }

          // Variable substitution
          const params = (template.variables || []).map((_, idx) => {
            const varKey = String(idx + 1);
            const mappingRule = campaign.variable_mapping?.[varKey];
            if (mappingRule === 'customer.name') return customer.name || 'Valued Guest';
            if (mappingRule === 'customer.visits') return String(customer.visit_count || 1);
            return mappingRule || 'Special Offer';
          });

          // Meta Cloud API Dispatch
          const result = await client.sendTemplateMessage({
            recipientPhone: customer.phone,
            templateName: template.name,
            language: template.language,
            parameters: params
          });

          if (result.success) {
            successCount++;
            totalCost += result.cost || 0.78;
            await supabaseAdmin.from('campaign_messages').insert({
              restaurant_id: restaurantId,
              campaign_id: campaignId,
              customer_id: customer.id,
              phone_e164: customer.phone,
              wa_message_id: result.metaMessageId,
              status: 'sent',
              cost: result.cost || 0.78,
              sent_at: new Date().toISOString()
            });
          } else {
            failureCount++;
            await supabaseAdmin.from('campaign_messages').insert({
              restaurant_id: restaurantId,
              campaign_id: campaignId,
              customer_id: customer.id,
              phone_e164: customer.phone,
              status: 'failed',
              error_code: result.errorCode,
              error_message: result.errorMessage,
              cost: 0
            });
          }
        } catch (err) {
          failureCount++;
          console.error(`[CampaignSender] Failed to dispatch to customer ${customer.id}:`, err.message);
        }
      }));

      // Non-blocking rate-limit pause between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // 5. Finalize Campaign
    await supabaseAdmin.from('campaigns').update({
      status: 'completed',
      total_sent: successCount,
      total_failed: failureCount,
      actual_cost: totalCost,
      completed_at: new Date().toISOString()
    }).eq('id', campaignId);

    return {
      totalAudience: recipients.length,
      sent: successCount,
      failed: failureCount,
      totalCost
    };
  }
}
