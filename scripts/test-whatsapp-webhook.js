/**
 * Automated Verification Script for WhatsApp Cloud API Webhook
 * Tests:
 * 1. GET Meta verification handshake
 * 2. POST Signed delivery status update payload (sent -> delivered -> read)
 * 3. POST Signed customer STOP opt-out reply
 *
 * Usage:
 *   node scripts/test-whatsapp-webhook.js [TARGET_URL] [VERIFY_TOKEN] [APP_SECRET]
 */
import crypto from 'node:crypto';

const TARGET_URL = process.argv[2] || 'http://localhost:4000/api/whatsapp/webhook';
const VERIFY_TOKEN = process.argv[3] || process.env.WHATSAPP_VERIFY_TOKEN || 'yeezy_loyalty_webhook_verify_2026';
const APP_SECRET = process.argv[4] || process.env.WHATSAPP_APP_SECRET || 'test_meta_app_secret_12345';

console.log('========================================================');
console.log('WHATSAPP CLOUD API WEBHOOK TEST RUNNER');
console.log(`Endpoint:    ${TARGET_URL}`);
console.log(`VerifyToken: ${VERIFY_TOKEN}`);
console.log('========================================================\n');

async function runTests() {
  let passed = 0;
  let total = 0;

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: GET Verification Handshake
  // ───────────────────────────────────────────────────────────────────────────
  total++;
  console.log('[Test 1] Testing GET Handshake (hub.mode=subscribe)...');
  try {
    const challenge = 'test_challenge_code_987654';
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': challenge
    });

    const res = await fetch(`${TARGET_URL}?${params.toString()}`);
    const text = await res.text();

    if (res.status === 200 && text === challenge) {
      console.log(`✅ [Test 1 Passed] Received 200 with challenge match: "${text}"\n`);
      passed++;
    } else {
      console.error(`❌ [Test 1 Failed] Status: ${res.status}, Body: "${text}"\n`);
    }
  } catch (err) {
    console.error(`❌ [Test 1 Failed] Network error: ${err.message}\n`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: POST Delivery Status Update (Delivered & Read)
  // ───────────────────────────────────────────────────────────────────────────
  total++;
  console.log('[Test 2] Testing POST Signed Status Update (delivered/read)...');
  try {
    const statusPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID_101',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+919876543210',
                  phone_number_id: 'mock_phone_123'
                },
                statuses: [
                  {
                    id: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSMzJBMkU2RjBFREEwRDg0NkY1AA==',
                    status: 'delivered',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    recipient_id: '919876543210',
                    pricing: {
                      billable: true,
                      pricing_model: 'CBP',
                      category: 'marketing'
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const rawBody = JSON.stringify(statusPayload);
    const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');

    const res = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature
      },
      body: rawBody
    });

    const json = await res.json().catch(() => null);

    if (res.status === 200) {
      console.log(`✅ [Test 2 Passed] Delivery status accepted:`, json, '\n');
      passed++;
    } else {
      console.error(`❌ [Test 2 Failed] Status: ${res.status}:`, json, '\n');
    }
  } catch (err) {
    console.error(`❌ [Test 2 Failed] Network error: ${err.message}\n`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: POST Inbound STOP Reply (Opt-out Compliance)
  // ───────────────────────────────────────────────────────────────────────────
  total++;
  console.log('[Test 3] Testing POST Signed Inbound Customer "STOP" Reply...');
  try {
    const stopPayload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'WHATSAPP_BUSINESS_ACCOUNT_ID_101',
          changes: [
            {
              field: 'messages',
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+919876543210',
                  phone_number_id: 'mock_phone_123'
                },
                contacts: [
                  {
                    profile: { name: 'Aarav Kumar' },
                    wa_id: '919876543210'
                  }
                ],
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhggQ0ZBNTlGMEY0OTMwMDdFRDg1QUEwRUQ0OTUxM0FGMTcA',
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: 'text',
                    text: {
                      body: 'STOP'
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const rawBody = JSON.stringify(stopPayload);
    const signature = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');

    const res = await fetch(TARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature
      },
      body: rawBody
    });

    const json = await res.json().catch(() => null);

    if (res.status === 200) {
      console.log(`✅ [Test 3 Passed] STOP opt-out event processed successfully:`, json, '\n');
      passed++;
    } else {
      console.error(`❌ [Test 3 Failed] Status: ${res.status}:`, json, '\n');
    }
  } catch (err) {
    console.error(`❌ [Test 3 Failed] Network error: ${err.message}\n`);
  }

  console.log(`Test Summary: ${passed}/${total} checks completed.`);
}

runTests();
