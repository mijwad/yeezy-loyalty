/**
 * Meta WhatsApp Cloud API Review & Diagnostic Test Script
 * Use this to verify tokens, send test messages, and create message templates for Meta App Review.
 *
 * Usage:
 *   node scripts/meta-api-tester.mjs check
 *   node scripts/meta-api-tester.mjs send <phone_number> [template_name]
 *   node scripts/meta-api-tester.mjs create-template <template_name> <body_text>
 */
import dotenv from 'dotenv';
dotenv.config();

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

const token = process.env.META_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const phoneId = process.env.META_PHONE_NUMBER_ID;
const wabaId = process.env.META_WABA_ID;
const appId = process.env.META_APP_ID || '1449921280434310';

async function checkStatus() {
  console.log('\n🔍 --- META WHATSAPP API STATUS AUDIT ---');
  console.log(`App ID:          ${appId}`);
  console.log(`Phone Number ID: ${phoneId || '⚠️ NOT SET in .env (META_PHONE_NUMBER_ID)'}`);
  console.log(`WABA ID:         ${wabaId || '⚠️ NOT SET in .env (META_WABA_ID)'}`);
  console.log(`Access Token:    ${token ? token.slice(0, 15) + '...' + token.slice(-6) : '❌ NOT SET'}`);

  if (!token) {
    console.error('\n❌ Error: No META_ACCESS_TOKEN found in .env');
    return;
  }

  try {
    const res = await fetch(`${GRAPH_API_BASE}/debug_token?input_token=${token}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.error) {
      console.log('\n❌ Token Status: EXPIRED or INVALID');
      console.log(`Reason: ${data.error.message} [Code: ${data.error.code}]`);
      console.log('\n👉 HOW TO FIX:');
      console.log('1. Go to https://developers.facebook.com/apps/' + appId + '/whatsapp-business/wa-dev-console/');
      console.log('2. Click "API Setup" in the left sidebar.');
      console.log('3. Copy the fresh "Temporary access token" or create a System User token.');
      console.log('4. Copy the "Phone number ID" and "WhatsApp Business Account ID".');
      console.log('5. Paste them in your .env or in the Yeezy Loyalty Meta Review Console in the app.');
      return;
    }

    const info = data.data || {};
    console.log('\n✅ Token Status: VALID');
    console.log(`App ID:      ${info.app_id}`);
    console.log(`Scopes:      ${(info.scopes || []).join(', ')}`);
    console.log(`Expires At:  ${info.expires_at ? new Date(info.expires_at * 1000).toLocaleString() : 'Permanent'}`);

    // If Phone ID is set, check phone number details
    if (phoneId) {
      const phoneRes = await fetch(`${GRAPH_API_BASE}/${phoneId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const phoneData = await phoneRes.json();
      if (!phoneData.error) {
        console.log(`\n📱 Connected WhatsApp Number: ${phoneData.display_phone_number} (${phoneData.verified_name || 'Unverified'})`);
        console.log(`Quality Rating: ${phoneData.quality_rating}`);
      }
    }
  } catch (err) {
    console.error('Network check error:', err.message);
  }
}

async function sendMessage(toPhone, templateName = 'hello_world') {
  if (!phoneId) {
    console.error('❌ Error: META_PHONE_NUMBER_ID is required in .env');
    return;
  }
  const cleanPhone = toPhone.replace(/[^0-9]/g, '');

  console.log(`\n🚀 Sending '${templateName}' to +${cleanPhone}...`);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: { code: 'en_US' }
    }
  };

  const res = await fetch(`${GRAPH_API_BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.error) {
    console.error('❌ Meta API Error:', data.error);
  } else {
    console.log('✅ Message Dispatched Successfully!');
    console.log('Message ID:', data.messages?.[0]?.id);
    console.log('Check recipient WhatsApp now.');
  }
}

async function createTemplate(name, bodyText) {
  if (!wabaId) {
    console.error('❌ Error: META_WABA_ID is required in .env');
    return;
  }
  const cleanName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  console.log(`\n📝 Submitting Template '${cleanName}' to Meta Graph API...`);

  const payload = {
    name: cleanName,
    category: 'MARKETING',
    language: 'en_US',
    components: [
      {
        type: 'BODY',
        text: bodyText || 'Hello {{1}}, welcome to our restaurant! Enjoy your exclusive loyalty voucher on your next visit.',
        example: {
          body_text: [['Alex']]
        }
      }
    ]
  };

  const res = await fetch(`${GRAPH_API_BASE}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.error) {
    console.error('❌ Meta Template Submission Error:', data.error);
  } else {
    console.log('✅ Template Created Successfully on Meta WABA!');
    console.log('Meta Template ID:', data.id);
    console.log('Status:', data.status || 'PENDING');
  }
}

const action = process.argv[2] || 'check';
const arg1 = process.argv[3];
const arg2 = process.argv[4];

if (action === 'check') {
  checkStatus();
} else if (action === 'send') {
  if (!arg1) {
    console.log('Usage: node scripts/meta-api-tester.mjs send <phone_number> [template_name]');
  } else {
    sendMessage(arg1, arg2);
  }
} else if (action === 'create-template') {
  if (!arg1) {
    console.log('Usage: node scripts/meta-api-tester.mjs create-template <template_name> [body_text]');
  } else {
    createTemplate(arg1, arg2);
  }
} else {
  console.log('Commands: check | send <phone> | create-template <name>');
}
