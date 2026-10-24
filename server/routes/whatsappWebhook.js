/**
 * WhatsApp Business Cloud API Webhook Handler
 * Endpoint: /api/whatsapp/webhook
 * Handles GET verification handshake, status updates (delivered/read/failed), STOP opt-outs, and template/quality events
 */
import { Router } from 'express';
import crypto from 'node:crypto';
import { supabaseAdmin } from '../db/supabase.js';
import { MetaWhatsAppClient } from '../whatsapp/metaClient.js';

export const whatsappWebhookRouter = Router();

const STATUS_RANKS = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4
};

function maskPhoneNumber(phone) {
  if (!phone) return 'unknown';
  const clean = String(phone).replace(/[^0-9+]/g, '');
  if (clean.length <= 4) return '****';
  return clean.slice(0, 3) + 'XXXXXX' + clean.slice(-4);
}

/**
 * GET /api/whatsapp/webhook
 * Meta Webhook verification handshake
 */
whatsappWebhookRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_WEBHOOK_VERIFY_TOKEN || 'yeezy_loyalty_webhook_verify_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WhatsApp Webhook] Handshake verified successfully');
      return res.status(200).send(challenge);
    } else {
      console.warn('[WhatsApp Webhook] Verification token mismatch');
      return res.sendStatus(403);
    }
  }

  res.sendStatus(400);
});

/**
 * POST /api/whatsapp/webhook
 * Meta Webhook Event Ingestion (Statuses & Inbound Messages)
 */
whatsappWebhookRouter.post('/', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_WEBHOOK_APP_SECRET;

  if (appSecret && signature) {
    const rawBody = JSON.stringify(req.body);
    const isValid = MetaWhatsAppClient.verifyWebhookSignature(rawBody, signature, appSecret);
    if (!isValid) {
      console.warn('[WhatsApp Webhook] Invalid X-Hub-Signature-256');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  // Acknowledge Meta immediately with 200 OK
  res.status(200).json({ status: 'EVENT_RECEIVED' });

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const field = change.field;
        const value = change.value;
        if (!value) continue;

        if (field === 'messages') {
          const phoneNumberId = value.metadata?.phone_number_id;

          // Lookup restaurant by phone_number_id
          let restaurantId = null;
          let accessToken = null;
          if (supabaseAdmin && phoneNumberId) {
            const { data: waAccount } = await supabaseAdmin
              .from('wa_accounts')
              .select('restaurant_id, access_token')
              .eq('phone_number_id', phoneNumberId)
              .single();
            restaurantId = waAccount?.restaurant_id || null;
            accessToken = waAccount?.access_token || null;
          }

          // Store event in wa_webhook_events
          if (supabaseAdmin) {
            const eventHash = crypto
              .createHash('sha256')
              .update(JSON.stringify(body) + (value.messages?.[0]?.id || value.statuses?.[0]?.id || ''))
              .digest('hex');

            await supabaseAdmin.from('wa_webhook_events').insert({
              event_id: eventHash,
              restaurant_id: restaurantId,
              field,
              payload: change,
              processed: true,
              received_at: new Date().toISOString()
            }).catch(() => {});
          }

          // Handle Status Updates
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              await handleStatusUpdate(statusObj);
            }
          }

          // Handle Inbound Customer Messages & STOP Opt-Outs
          if (value.messages && Array.isArray(value.messages)) {
            for (const messageObj of value.messages) {
              await handleInboundMessage(messageObj, restaurantId, phoneNumberId, accessToken);
            }
          }
        } else if (field === 'message_template_status_update') {
          const templateName = value.message_template_name;
          const newStatus = value.event;
          const reason = value.reason || null;

          if (supabaseAdmin && templateName && newStatus) {
            await supabaseAdmin
              .from('wa_templates')
              .update({
                meta_status: newStatus,
                rejection_reason: reason,
                updated_at: new Date().toISOString()
              })
              .eq('name', templateName.toLowerCase());
          }
        } else if (field === 'phone_number_quality_update') {
          const qualityRating = value.quality_rating || value.current_limit;
          const displayPhone = value.display_phone_number;
          if (supabaseAdmin && qualityRating) {
            let q = supabaseAdmin.from('wa_accounts').update({
              quality_rating: qualityRating,
              updated_at: new Date().toISOString()
            });
            if (displayPhone) q = q.eq('display_phone_number', displayPhone);
            await q;
          }
        }
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Processing error:', err.message);
  }
});

/**
 * Update message status in campaign_messages and parent campaign
 * Never move status backwards (read must not revert to delivered)
 */
async function handleStatusUpdate(statusObj) {
  if (!supabaseAdmin) return;

  const waMessageId = statusObj.id;
  const newStatus = statusObj.status; // sent, delivered, read, failed
  const eventEpoch = Number(statusObj.timestamp) || Math.floor(Date.now() / 1000);
  const eventDate = new Date(eventEpoch * 1000).toISOString();

  const { data: existingMsg } = await supabaseAdmin
    .from('campaign_messages')
    .select('id, status, campaign_id')
    .eq('wa_message_id', waMessageId)
    .single();

  if (!existingMsg) return;

  const currentRank = STATUS_RANKS[existingMsg.status] ?? -1;
  const newRank = STATUS_RANKS[newStatus] ?? -1;

  if (newRank < currentRank) return; // Prevent out-of-order reversion

  const updatePayload = {
    status: newStatus
  };

  if (newStatus === 'delivered') updatePayload.delivered_at = eventDate;
  if (newStatus === 'read') updatePayload.read_at = eventDate;
  if (newStatus === 'failed') {
    const err = statusObj.errors?.[0] || {};
    updatePayload.error_code = String(err.code || 'UNKNOWN_ERROR');
    updatePayload.error_message = err.title || err.message || 'Delivery failed';
  }

  await supabaseAdmin
    .from('campaign_messages')
    .update(updatePayload)
    .eq('id', existingMsg.id);

  if (existingMsg.campaign_id) {
    if (newStatus === 'delivered' && existingMsg.status !== 'delivered' && existingMsg.status !== 'read') {
      await supabaseAdmin.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_delivered',
        row_id: existingMsg.campaign_id
      }).catch(() => {});
    } else if (newStatus === 'read' && existingMsg.status !== 'read') {
      await supabaseAdmin.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_read',
        row_id: existingMsg.campaign_id
      }).catch(() => {});
    } else if (newStatus === 'failed' && existingMsg.status !== 'failed') {
      await supabaseAdmin.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_failed',
        row_id: existingMsg.campaign_id
      }).catch(() => {});
    }
  }
}

/**
 * Handle inbound message (e.g. STOP / UNSUBSCRIBE compliance)
 */
async function handleInboundMessage(messageObj, restaurantId, phoneNumberId, accessToken) {
  if (!supabaseAdmin) return;

  const fromRaw = messageObj.from;
  const customerPhone = fromRaw.startsWith('+') ? fromRaw : `+${fromRaw}`;
  const textBody = (messageObj.text?.body || messageObj.button?.text || '').trim();

  const isStopKeyword = /^(STOP|UNSUBSCRIBE|CANCEL|STOP MESSAGES)$/i.test(textBody);

  console.log(`[WhatsApp Webhook] Inbound from ${maskPhoneNumber(customerPhone)}: "${isStopKeyword ? 'OPT_OUT_KEYWORD' : textBody.slice(0, 20)}..."`);

  // Look up customer within this restaurant
  let customerId = null;
  if (restaurantId) {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('phone', customerPhone)
      .single();
    customerId = customer?.id || null;
  }

  if (isStopKeyword) {
    const now = new Date().toISOString();

    if (restaurantId) {
      await supabaseAdmin
        .from('customers')
        .update({ whatsapp_opt_in: false, opt_out_at: now })
        .eq('restaurant_id', restaurantId)
        .eq('phone', customerPhone);

      await supabaseAdmin
        .from('loyalty_members')
        .update({ whatsapp_opt_in: false, opt_out_at: now })
        .eq('restaurant_id', restaurantId)
        .eq('phone_e164', customerPhone);

      await supabaseAdmin
        .from('campaign_messages')
        .update({ opt_out_at: now })
        .eq('restaurant_id', restaurantId)
        .eq('phone_e164', customerPhone)
        .is('opt_out_at', null);
    }

    if (accessToken && phoneNumberId) {
      const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
      fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: { preview_url: false, body: 'You have been unsubscribed from promotional messages. Reply START at any time to opt back in.' }
        })
      }).catch(() => {});
    }
    return;
  }

  if (restaurantId) {
    await supabaseAdmin.from('wa_inbound_messages').insert({
      restaurant_id: restaurantId,
      customer_id: customerId,
      wa_message_id: messageObj.id,
      from_phone_e164: customerPhone,
      text: textBody,
      type: messageObj.type || 'text',
      raw_message: messageObj,
      received_at: new Date().toISOString()
    }).catch(() => {});

    const { data: latestCampaignMsg } = await supabaseAdmin
      .from('campaign_messages')
      .select('id, campaign_id')
      .eq('restaurant_id', restaurantId)
      .eq('phone_e164', customerPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestCampaignMsg) {
      await supabaseAdmin
        .from('campaign_messages')
        .update({ replied_at: new Date().toISOString() })
        .eq('id', latestCampaignMsg.id);

      if (latestCampaignMsg.campaign_id) {
        await supabaseAdmin.rpc('increment_counter', {
          table_name: 'campaigns',
          column_name: 'total_replies',
          row_id: latestCampaignMsg.campaign_id
        }).catch(() => {});
      }
    }
  }
}
