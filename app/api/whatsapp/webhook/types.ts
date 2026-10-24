/**
 * TypeScript Interfaces for WhatsApp Business Cloud API Webhook Payloads
 * Specification: Meta Graph API v21.0
 */

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account' | string;
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id: string; // WABA ID
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  field: 'messages' | 'message_template_status_update' | 'phone_number_quality_update' | string;
  value: WhatsAppChangeValue;
}

export interface WhatsAppChangeValue {
  messaging_product?: 'whatsapp';
  metadata?: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
  statuses?: WhatsAppStatusObject[];
  messages?: WhatsAppMessageObject[];
  // Template status update payload fields
  event?: 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  message_template_id?: string;
  message_template_name?: string;
  message_template_language?: string;
  reason?: string;
  // Quality update payload fields
  display_phone_number?: string;
  event_type?: string;
  current_limit?: string;
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
}

export interface WhatsAppStatusObject {
  id: string; // wa_message_id (e.g. wamid.HBgM...)
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string; // Unix epoch string
  recipient_id: string; // Customer phone without '+'
  conversation?: {
    id: string;
    expiration_timestamp?: string;
    origin?: {
      type: 'marketing' | 'utility' | 'authentication' | 'service';
    };
  };
  pricing?: {
    billable: boolean;
    pricing_model: 'CBP';
    category: 'marketing' | 'utility' | 'authentication' | 'service';
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: { details: string };
  }>;
}

export interface WhatsAppMessageObject {
  from: string; // Customer phone (e.g. "919876543210")
  id: string; // Inbound wamid
  timestamp: string; // Unix epoch string
  type: 'text' | 'button' | 'interactive' | 'image' | 'location' | string;
  text?: {
    body: string;
  };
  button?: {
    text: string;
    payload: string;
  };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string };
  };
}
