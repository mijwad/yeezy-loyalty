import { app } from '../server/app.js';
import http from 'node:http';

const LIVE_KEY_YEEZY = 'lk_live_6b6f34465f168ee1d824915e5c0cb1c7cf1224b998eba8f1005e6e0d6fd9b194';
const LIVE_KEY_SMOKEHOUSE = 'lk_live_730ba5b943263d58c363b5605a9ffc3bdbfa739274e9e6ba58d4c872ce4eabbb';

async function main() {
  console.log('============================================================');
  console.log('  END-TO-END VERIFICATION: PUBLIC API V1 & CANONICAL SDK    ');
  console.log('============================================================\n');

  // Start server on ephemeral port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Test server running at: ${baseUrl}\n`);

  try {
    // 1. Test GET /v1/ping without key -> expect 401
    console.log('1. Testing /v1/ping without API key (Expect 401)...');
    const unauthRes = await fetch(`${baseUrl}/v1/ping`);
    console.log(`   Status: ${unauthRes.status}`);
    if (unauthRes.status !== 401) throw new Error('Expected 401 for unauthenticated request');
    console.log('   [PASS] 401 Unauthorized received\n');

    // 2. Test GET /v1/ping with Yeezy Live Key -> expect 200
    console.log('2. Testing /v1/ping with Downtown Bistro Live Key (Expect 200)...');
    const pingRes = await fetch(`${baseUrl}/v1/ping`, {
      headers: { 'Authorization': `Bearer ${LIVE_KEY_YEEZY}` }
    });
    const pingJson = await pingRes.json();
    console.log(`   Status: ${pingRes.status}`, pingJson);
    if (pingRes.status !== 200 || pingJson.restaurant_id !== 'ten_yeezy_01') {
      throw new Error('Ping failed or returned incorrect restaurant_id');
    }
    console.log('   [PASS] API key authenticated and restaurant identity confirmed\n');

    // 3. Test GET /v1/customers/lookup for Rahul Nair (+919847012345)
    console.log('3. Testing /v1/customers/lookup for +919847012345 with bill_paise=50000...');
    const lookupRes = await fetch(`${baseUrl}/v1/customers/lookup?phone=%2B919847012345&bill_paise=50000`, {
      headers: { 'Authorization': `Bearer ${LIVE_KEY_YEEZY}` }
    });
    const lookupJson = await lookupRes.json();
    console.log(`   Status: ${lookupRes.status}`, JSON.stringify(lookupJson, null, 2));
    if (lookupRes.status !== 200 || !lookupJson.found) {
      throw new Error('Customer lookup failed');
    }
    console.log(`   Available Balance: ${lookupJson.customer.available_points} pts`);
    console.log('   [PASS] Customer lookup returned valid profile and redemption calculation\n');

    // 4. Test Cross-Tenant Leakage Isolation
    console.log('4. Testing Cross-Tenant Leak Isolation: Smoke House Deli looking up Yeezy customer...');
    const leakRes = await fetch(`${baseUrl}/v1/customers/lookup?phone=%2B919847012345`, {
      headers: { 'Authorization': `Bearer ${LIVE_KEY_SMOKEHOUSE}` }
    });
    console.log(`   Status: ${leakRes.status}`);
    if (leakRes.status !== 404) {
      throw new Error(`SECURITY LEAK: Cross-tenant member accessed! Status was ${leakRes.status}`);
    }
    console.log('   [PASS] Cross-tenant access strictly prevented (404 Not Found)\n');

    // 5. Test Two-Phase Redemption: Reserve Points
    console.log('5. Testing POST /v1/redemptions/reserve (Hold 10 points on ₹300 bill)...');
    const reserveRes = await fetch(`${baseUrl}/v1/redemptions/reserve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVE_KEY_YEEZY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `idem-res-${Date.now()}`
      },
      body: JSON.stringify({
        phone: '+919847012345',
        points: 10,
        bill_paise: 30000
      })
    });
    const reserveJson = await reserveRes.json();
    console.log(`   Status: ${reserveRes.status}`, reserveJson);
    if (reserveRes.status !== 201 || !reserveJson.success) {
      throw new Error(`Reservation failed: ${JSON.stringify(reserveJson)}`);
    }
    const reservationId = reserveJson.reservation_id;
    console.log(`   Reservation ID: ${reservationId}, Discount: ₹${reserveJson.discount_inr}`);
    console.log('   [PASS] Points reserved successfully\n');

    // 6. Verify Active Hold on Customer Balance
    console.log('6. Verifying active hold deducted from available balance...');
    const lookupAfterReserve = await fetch(`${baseUrl}/v1/customers/lookup?phone=%2B919847012345`, {
      headers: { 'Authorization': `Bearer ${LIVE_KEY_YEEZY}` }
    });
    const lookupAfterJson = await lookupAfterReserve.json();
    console.log(`   Available Balance after hold: ${lookupAfterJson.customer.available_points} pts`);
    console.log(`   Active Reservations: ${lookupAfterJson.customer.active_reservations_points} pts`);
    if (lookupAfterJson.customer.available_points !== 65) {
      throw new Error(`Expected balance 65, got ${lookupAfterJson.customer.available_points}`);
    }
    console.log('   [PASS] Hold reflected in available balance immediately\n');

    // 7. Test Two-Phase Redemption: Commit Points (Idempotent)
    console.log(`7. Testing POST /v1/redemptions/${reservationId}/commit (Finalize on bill pay)...`);
    const commitIdemKey = `idem-commit-${Date.now()}`;
    const commitRes = await fetch(`${baseUrl}/v1/redemptions/${reservationId}/commit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVE_KEY_YEEZY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': commitIdemKey
      },
      body: JSON.stringify({ order_id: 'ORD-PROD-LIVE-101' })
    });
    const commitJson = await commitRes.json();
    console.log(`   Status: ${commitRes.status}`, commitJson);
    if (commitRes.status !== 200 || !commitJson.success) {
      throw new Error(`Commit failed: ${JSON.stringify(commitJson)}`);
    }

    // Test Idempotent Replay
    console.log('   Testing idempotent replay of commit call...');
    const commitReplayRes = await fetch(`${baseUrl}/v1/redemptions/${reservationId}/commit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVE_KEY_YEEZY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': commitIdemKey
      },
      body: JSON.stringify({ order_id: 'ORD-PROD-LIVE-101' })
    });
    console.log(`   Replay Status: ${commitReplayRes.status}, Replay Header: ${commitReplayRes.headers.get('x-idempotent-replay')}`);
    if (commitReplayRes.status !== 200) {
      throw new Error('Idempotent replay failed');
    }
    console.log('   [PASS] Commit succeeded and idempotency protected\n');

    // 8. Test Ingest Order: POST /v1/orders
    console.log('8. Testing POST /v1/orders (Ingest order and earn points)...');
    const orderRes = await fetch(`${baseUrl}/v1/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LIVE_KEY_YEEZY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `idem-ord-${Date.now()}`
      },
      body: JSON.stringify({
        order_id: `ORD-INGEST-${Date.now()}`,
        phone: '+919847012345',
        subtotal_paise: 40000, // ₹400
        order_type: 'dine_in'
      })
    });
    const orderJson = await orderRes.json();
    console.log(`   Status: ${orderRes.status}`, orderJson);
    if (orderRes.status !== 200 || !orderJson.success) {
      throw new Error(`Order ingest failed: ${JSON.stringify(orderJson)}`);
    }
    console.log(`   Points Earned: ${orderJson.points_earned}, New Balance: ${orderJson.new_balance}`);
    console.log('   [PASS] Order processed and points earned on production database\n');

    console.log('============================================================');
    console.log('   ALL END-TO-END TESTS PASSED ON PRODUCTION SUPABASE!       ');
    console.log('============================================================');
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('\nE2E Verification Error:', err);
  process.exit(1);
});
