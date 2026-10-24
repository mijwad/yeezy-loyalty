/**
 * WhatsApp Business Cloud API Webhook Handler
 * Endpoint: /api/whatsapp/webhook
 * Handles GET verification handshake, status updates (delivered/read/failed), and STOP opt-outs
 */
import { Router } from 'express';
import { supabaseAdmin } from '../db/supabase.js';
import { MetaWhatsAppClient } from '../whatsapp/metaClient.js';

export const whatsappWebhookRouter = Router();

/**
 * GET /api/whatsapp/webhook
 * Meta Webhook verification handshake
 */
whatsappWebhookRouter.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'yeezy_loyalty_webhook_verify_2026';

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
  // 1. Signature verification (if app secret configured)
  const signature = req.headers['x-hub-signature-256'];
  const appSecret = process.env.META_WEBHOOK_APP_SECRET;

  if (appSecret && signature) {
    const rawBody = JSON.stringify(req.body);
    const isValid = MetaWhatsAppClient.verifyWebhookSignature(rawBody, signature, appSecret);
    if (!isValid) {
      console.error('[WhatsApp Webhook] Invalid X-Hub-Signature-256');
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
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;

        // A. Handle Status Updates (sent / delivered / read / failed)
        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusObj of value.statuses) {
            await handleStatusUpdate(statusObj);
          }
        }

        // B. Handle Inbound Customer Messages (STOP / UNSUBSCRIBE Opt-out)
        if (value.messages && Array.isArray(value.messages)) {
          for (const messageObj of value.messages) {
            await handleInboundMessage(messageObj, value.metadata);
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
 */
async function handleStatusUpdate(statusObj) {
  if (!supabaseAdmin) return;

  const waMessageId = statusObj.id;
  const newStatus = statusObj.status; // sent, delivered, read, failed
  const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000).toISOString() : new Date().toISOString();

  const updatePayload = {
    status: newStatus
  };

  if (newStatus === 'delivered') updatePayload.delivered_at = timestamp;
  if (newStatus === 'read') updatePayload.read_at = timestamp;
  if (newStatus === 'failed') {
    const err = statusObj.errors?.[0] || {};
    updatePayload.error_code = String(err.code || 'UNKNOWN_ERROR');
    updatePayload.error_message = err.title || err.message || 'Delivery failed';
  }

  const { data: updatedMsg } = await supabaseAdmin
    .from('campaign_messages')
    .update(updatePayload)
    .eq('wa_message_id', waMessageId)
    .select('campaign_id')
    .single();

  if (updatedMsg?.campaign_id) {
    // Increment aggregate counter on parent campaign
    if (newStatus === 'delivered') {
      await supabaseAdmin.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_delivered',
        row_id: updatedMsg.campaign_id
      }).catch(() => {});
    } else if (newStatus === 'read') {
      await supabaseAdmin.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_read',
        row_id: updatedMsg.campaign_id
      }).catch(() => {});
    } else if (newStatus === 'failed') {
      await supabaseAdmin.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_failed',
        row_id: updatedMsg.campaign_id
      }).catch(() => {});
    }
  }
}

/**
 * Handle inbound message (e.g. STOP / UNSUBSCRIBE compliance)
 */
async function handleInboundMessage(messageObj, metadata) {
  if (!supabaseAdmin) return;

  const customerPhone = `+${messageObj.from}`;
  const textBody = (messageObj.text?.body || '').trim().toUpperCase();

  // Check if opt-out keyword
  if (['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT', 'CANCEL'].includes(textBody)) {
    console.log(`[WhatsApp Webhook] Received opt-out command from ${customerPhone}`);

    // Instantly set opt_out_at in customers table
    await supabaseAdmin
      .from('customers')
      .update({
        whatsapp_opt_in: false,
        opt_out_at: new Date().toISOString()
      })
      .eq('phone', customerPhone);

    // Also update loyalty_members if matching
    await supabaseAdmin
      .from('loyalty_members')
      .update({
        whatsapp_opt_in: false,
        opt_out_at: new Date().toISOString()
      })
      .eq('phone_e164', customerPhone);

    // Record opt-out on recent campaign message
    await supabaseAdmin
      .from('campaign_messages')
      .update({ opt_out_at: new Date().toISOString() })
      .eq('phone_e164', customerPhone)
      .is('opt_out_at', null);
  }
}
