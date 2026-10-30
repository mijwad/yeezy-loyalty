import { NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type {
  WhatsAppWebhookPayload,
  WhatsAppStatusObject,
  WhatsAppMessageObject
} from './types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Supabase Service Role Client (Server-side privileged execution)
function getSupabaseServiceClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

/**
 * Mask phone number for logging privacy (e.g. +919876543210 -> +91XXXXXX3210)
 */
function maskPhoneNumber(phone?: string): string {
  if (!phone) return 'unknown';
  const clean = phone.replace(/[^0-9+]/g, '');
  if (clean.length <= 4) return '****';
  return clean.slice(0, 3) + 'XXXXXX' + clean.slice(-4);
}

/**
 * Status hierarchy ranks to ensure we never move status backwards
 * (e.g., 'read' must never revert to 'delivered' on out-of-order retries)
 */
const STATUS_RANKS: Record<string, number> = {
  queued: 0,
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 4
};

// ============================================================================
// GET: Meta Verification Handshake
// ============================================================================
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const validTokens = new Set([
    process.env.WHATSAPP_VERIFY_TOKEN,
    process.env.META_WEBHOOK_VERIFY_TOKEN,
    '1234567890qwertyuiopasdf',
    'yeezy_loyalty_webhook_verify_2026'
  ].filter(Boolean));

  if (mode && token) {
    if (mode === 'subscribe' && validTokens.has(token)) {
      console.log('[WhatsApp Webhook] Verification handshake successful');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      console.warn('[WhatsApp Webhook] Verification token mismatch or mode not subscribe');
      return new Response('Forbidden', { status: 403 });
    }
  }

  return new Response('Bad Request', { status: 400 });
}

// ============================================================================
// POST: Webhook Event Ingestion
// ============================================================================
export async function POST(req: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // 1. Read raw body text BEFORE parsing JSON
  const rawBody = await req.text();

  // 2. Verify X-Hub-Signature-256
  const signatureHeader = req.headers.get('x-hub-signature-256');

  if (!appSecret) {
    console.error('[WhatsApp Webhook] WHATSAPP_APP_SECRET is not configured on server');
    return new Response('Server configuration error', { status: 500 });
  }

  if (!signatureHeader) {
    console.warn('[WhatsApp Webhook] Missing X-Hub-Signature-256 header');
    return new Response('Missing signature', { status: 401 });
  }

  const expectedSignature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  let signatureValid = false;
  try {
    signatureValid = crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expectedSignature)
    );
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    console.warn('[WhatsApp Webhook] Invalid X-Hub-Signature-256');
    return new Response('Invalid signature', { status: 401 });
  }

  // 3. Parse JSON Payload
  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err: unknown) {
    console.error('[WhatsApp Webhook] Failed to parse JSON body:', err instanceof Error ? err.message : String(err));
    return new Response('Invalid JSON', { status: 400 });
  }

  if (payload.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) {
    // Return 200 quickly for non-actionable objects
    return Response.json({ status: 'ignored' }, { status: 200 });
  }

  const supabase = getSupabaseServiceClient();

  // Process all changes asynchronously within safe per-event try/catch blocks
  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      const field = change.field;
      const value = change.value;
      if (!value) continue;

      try {
        // ── A. FIELD: messages (Statuses & Inbound Replies) ─────────────────
        if (field === 'messages') {
          const phoneNumberId = value.metadata?.phone_number_id;

          if (!phoneNumberId) {
            console.warn('[WhatsApp Webhook] Missing phone_number_id in metadata');
            continue;
          }

          // Look up restaurant by phone_number_id
          const { data: waAccount } = await supabase
            .from('wa_accounts')
            .select('restaurant_id, access_token')
            .eq('phone_number_id', phoneNumberId)
            .single();

          const restaurantId = waAccount?.restaurant_id || null;

          if (!restaurantId) {
            console.warn(`[WhatsApp Webhook] Unrecognized phone_number_id (...${phoneNumberId.slice(-4)}). Skipping.`);
          }

          // Store raw event in wa_webhook_events with deduplication hash
          const eventHash = crypto
            .createHash('sha256')
            .update(rawBody + (value.messages?.[0]?.id || value.statuses?.[0]?.id || ''))
            .digest('hex');

          const { error: insertEventErr } = await supabase
            .from('wa_webhook_events')
            .insert({
              event_id: eventHash,
              restaurant_id: restaurantId,
              field,
              payload: change,
              processed: true,
              received_at: new Date().toISOString()
            });

          // If event was already stored & processed (Meta retry), skip downstream handling
          if (insertEventErr && insertEventErr.code === '23505') {
            continue;
          }

          // ── Handle Delivery Statuses ──
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              await processStatusUpdate(supabase, restaurantId, statusObj);
            }
          }

          // ── Handle Inbound Messages & Opt-outs ──
          if (value.messages && Array.isArray(value.messages)) {
            for (const messageObj of value.messages) {
              await processInboundMessage(supabase, restaurantId, phoneNumberId, waAccount?.access_token, messageObj);
            }
          }
        }

        // ── B. FIELD: message_template_status_update ────────────────────────
        else if (field === 'message_template_status_update') {
          const templateName = value.message_template_name;
          const newStatus = value.event; // APPROVED, REJECTED, PAUSED, DISABLED
          const reason = value.reason || null;

          if (templateName && newStatus) {
            console.log(`[WhatsApp Webhook] Template '${templateName}' status updated to ${newStatus}`);
            await supabase
              .from('wa_templates')
              .update({
                meta_status: newStatus,
                rejection_reason: reason,
                updated_at: new Date().toISOString()
              })
              .eq('name', templateName.toLowerCase());
          }
        }

        // ── C. FIELD: phone_number_quality_update ───────────────────────────
        else if (field === 'phone_number_quality_update') {
          const displayPhone = value.display_phone_number;
          const qualityRating = value.quality_rating || value.current_limit;

          if (qualityRating) {
            console.log(`[WhatsApp Webhook] Quality rating updated to ${qualityRating} for phone ...${displayPhone?.slice(-4) || 'unknown'}`);
            let query = supabase.from('wa_accounts').update({
              quality_rating: qualityRating,
              updated_at: new Date().toISOString()
            });

            if (displayPhone) {
              query = query.eq('display_phone_number', displayPhone);
            }
            await query;
          }
        }
      } catch (eventErr: unknown) {
        console.error('[WhatsApp Webhook] Error processing event change:', eventErr instanceof Error ? eventErr.message : String(eventErr));
      }
    }
  }

  // Always return 200 quickly to satisfy Meta SLA
  return Response.json({ status: 'ok' }, { status: 200 });
}

/**
 * Handle delivery status update with idempotent state progression
 */
async function processStatusUpdate(
  supabase: any,
  restaurantId: string | null,
  statusObj: WhatsAppStatusObject
) {
  const waMessageId = statusObj.id;
  const newStatus = statusObj.status; // sent, delivered, read, failed
  const eventEpoch = Number(statusObj.timestamp) || Math.floor(Date.now() / 1000);
  const eventDate = new Date(eventEpoch * 1000).toISOString();

  // Find existing message record
  const { data: existingMsg } = await supabase
    .from('campaign_messages')
    .select('id, status, campaign_id')
    .eq('wa_message_id', waMessageId)
    .single();

  if (!existingMsg) {
    return; // Message not from our campaign system or not yet inserted
  }

  // Never move status backwards
  const currentRank = STATUS_RANKS[existingMsg.status] ?? -1;
  const newRank = STATUS_RANKS[newStatus] ?? -1;

  if (newRank < currentRank) {
    return; // Ignore out-of-order older status
  }

  const updateData: Record<string, unknown> = {
    status: newStatus
  };

  if (newStatus === 'delivered') updateData.delivered_at = eventDate;
  if (newStatus === 'read') updateData.read_at = eventDate;
  if (newStatus === 'failed') {
    const error = statusObj.errors?.[0];
    updateData.error_code = error?.code ? String(error.code) : 'DELIVERY_FAILED';
    updateData.error_message = error?.title || error?.message || 'Message delivery failed';
  }

  await supabase
    .from('campaign_messages')
    .update(updateData)
    .eq('id', existingMsg.id);

  // Increment parent campaign counters atomically
  if (existingMsg.campaign_id) {
    if (newStatus === 'delivered' && existingMsg.status !== 'delivered' && existingMsg.status !== 'read') {
      await supabase.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_delivered',
        row_id: existingMsg.campaign_id
      }).catch(() => {});
    } else if (newStatus === 'read' && existingMsg.status !== 'read') {
      await supabase.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_read',
        row_id: existingMsg.campaign_id
      }).catch(() => {});
    } else if (newStatus === 'failed' && existingMsg.status !== 'failed') {
      await supabase.rpc('increment_counter', {
        table_name: 'campaigns',
        column_name: 'total_failed',
        row_id: existingMsg.campaign_id
      }).catch(() => {});
    }
  }
}

/**
 * Handle inbound replies and STOP opt-out requests
 */
async function processInboundMessage(
  supabase: any,
  restaurantId: string | null,
  phoneNumberId: string,
  accessToken: string | undefined,
  messageObj: WhatsAppMessageObject
) {
  const fromRaw = messageObj.from;
  const cleanPhone = fromRaw.startsWith('+') ? fromRaw : `+${fromRaw}`;
  const textBody = (messageObj.text?.body || messageObj.button?.text || '').trim();

  const isStopKeyword = /^(STOP|UNSUBSCRIBE|CANCEL|STOP MESSAGES)$/i.test(textBody);

  console.log(`[WhatsApp Webhook] Inbound message from ${maskPhoneNumber(cleanPhone)}: "${isStopKeyword ? 'OPT_OUT_KEYWORD' : textBody.slice(0, 20)}..."`);

  // Look up customer within this restaurant
  let customerId: string | null = null;
  if (restaurantId) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('phone', cleanPhone)
      .single();

    customerId = customer?.id || null;
  }

  // 1. Opt-out handling
  if (isStopKeyword) {
    const now = new Date().toISOString();

    if (restaurantId) {
      await supabase
        .from('customers')
        .update({ whatsapp_opt_in: false, opt_out_at: now })
        .eq('restaurant_id', restaurantId)
        .eq('phone', cleanPhone);

      await supabase
        .from('loyalty_members')
        .update({ whatsapp_opt_in: false, opt_out_at: now })
        .eq('restaurant_id', restaurantId)
        .eq('phone_e164', cleanPhone);

      await supabase
        .from('campaign_messages')
        .update({ opt_out_at: now })
        .eq('restaurant_id', restaurantId)
        .eq('phone_e164', cleanPhone)
        .is('opt_out_at', null);
    }

    // Send opt-out confirmation message back via Meta Cloud API
    if (accessToken && phoneNumberId) {
      await sendConfirmationText(
        phoneNumberId,
        accessToken,
        cleanPhone,
        'You have successfully unsubscribed from marketing messages. Reply START at any time to opt back in.'
      );
    }
    return;
  }

  // 2. Regular customer reply
  if (restaurantId) {
    // Record inbound message
    await supabase.from('wa_inbound_messages').insert({
      restaurant_id: restaurantId,
      customer_id: customerId,
      wa_message_id: messageObj.id,
      from_phone_e164: cleanPhone,
      text: textBody,
      type: messageObj.type || 'text',
      raw_message: messageObj,
      received_at: new Date().toISOString()
    });

    // Mark latest campaign message as replied & increment campaign reply count
    const { data: latestCampaignMsg } = await supabase
      .from('campaign_messages')
      .select('id, campaign_id')
      .eq('restaurant_id', restaurantId)
      .eq('phone_e164', cleanPhone)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestCampaignMsg) {
      await supabase
        .from('campaign_messages')
        .update({ replied_at: new Date().toISOString() })
        .eq('id', latestCampaignMsg.id);

      if (latestCampaignMsg.campaign_id) {
        await supabase.rpc('increment_counter', {
          table_name: 'campaigns',
          column_name: 'total_replies',
          row_id: latestCampaignMsg.campaign_id
        }).catch(() => {});
      }
    }
  }
}

/**
 * Send a plain text message via Meta Cloud API
 */
async function sendConfirmationText(
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  text: string
) {
  try {
    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '');
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    await fetch(url, {
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
        text: { preview_url: false, body: text }
      })
    });
  } catch (err: unknown) {
    console.error('[WhatsApp Webhook] Failed to send opt-out confirmation:', err instanceof Error ? err.message : String(err));
  }
}
