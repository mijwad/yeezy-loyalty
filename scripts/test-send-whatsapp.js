import dotenv from 'dotenv';
dotenv.config();

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || process.argv[3];
const TO_PHONE = process.argv[2] || process.env.TEST_PHONE_NUMBER;

if (!ACCESS_TOKEN) {
  console.error('❌ Missing WHATSAPP_ACCESS_TOKEN in .env');
  process.exit(1);
}

if (!TO_PHONE) {
  console.log(`
Usage:
  node scripts/test-send-whatsapp.js <recipient_phone> [phone_number_id] [template_name]

Example:
  node scripts/test-send-whatsapp.js +919876543210 102938475610293 hello_world
  `);
  process.exit(1);
}

if (!PHONE_NUMBER_ID) {
  console.error('❌ Missing Phone Number ID. Provide it as argument 2 or set META_PHONE_NUMBER_ID in .env');
  console.log('You can find your Phone Number ID in Meta Developer Dashboard -> WhatsApp -> API Setup');
  process.exit(1);
}

const TEMPLATE_NAME = process.argv[4] || 'hello_world';

async function sendWhatsAppTest() {
  console.log('🚀 Sending WhatsApp message via Meta Cloud API v21.0...');
  console.log(`📱 To: ${TO_PHONE}`);
  console.log(`🆔 Phone Number ID: ${PHONE_NUMBER_ID}`);
  console.log(`📋 Template: ${TEMPLATE_NAME}`);

  let cleanPhone = TO_PHONE.replace(/[^0-9+]/g, '');
  if (/^[6-9]\d{9}$/.test(cleanPhone)) {
    cleanPhone = `+91${cleanPhone}`;
  } else if (!cleanPhone.startsWith('+')) {
    cleanPhone = `+${cleanPhone}`;
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: TEMPLATE_NAME,
      language: { code: 'en_US' }
    }
  };

  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('❌ Meta API Error:', JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ Message dispatched successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Request failed:', err.message);
    process.exit(1);
  }
}

sendWhatsAppTest();
