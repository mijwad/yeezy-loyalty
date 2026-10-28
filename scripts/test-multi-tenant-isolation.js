// Multi-Tenant POS & Customer Insights Isolation Verification Script
import { posStore } from '../server/db/store.js';
import { app } from '../server/app.js';
import http from 'http';

const TEST_PORT = 4199;

async function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(TEST_PORT, () => {
      resolve(server);
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function run() {
  console.log('================================================================');
  console.log('🧪 VERIFYING MULTI-TENANT POS KEY & CUSTOMER INSIGHTS ISOLATION');
  console.log('================================================================\n');

  const server = await startServer();
  const baseUrl = `http://localhost:${TEST_PORT}`;

  const restA = 'ten_durbar_mvnrq6po';
  const keyA = 'lk_live_c511_durbar_cafe_live_pos_key_2026_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d';

  const restB = 'ten_farzi_mvnvc99o';
  const keyB = 'lk_live_0049_farzi_cafe_pos_key_2026_9bca1234567890abcdef1234567890abcdef';

  const testPhone = '99' + Date.now().toString().slice(-8);

  try {
    // --------------------------------------------------------------------------
    // TEST 1: POS Key A Ingests Order for Diner at Restaurant A
    // --------------------------------------------------------------------------
    console.log('\n▶ 1. Ingesting Bill at Restaurant A (Durbar Cafe) with POS Key A...');
    const resA = await fetch(`${baseUrl}/api/pos/orders/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyA}`
      },
      body: JSON.stringify({
        order_id: `ORD_DURBAR_${Date.now()}`,
        bill_no: `BILL_DURBAR_101`,
        customer: { phone: testPhone, name: 'Ananya Sharma' },
        net_paid: 1500,
        financials: { subtotal: 1500, gross_amount: 1500, net_paid: 1500 }
      })
    });
    const dataA = await resA.json();
    assert(resA.ok && dataA.status === 'success', 'Restaurant A order saved successfully');
    assert(dataA.customer?.points_earned === 150, `Restaurant A points earned is 150 (got: ${dataA.customer?.points_earned})`);

    // --------------------------------------------------------------------------
    // TEST 2: POS Key B Ingests Order for the SAME Diner at Restaurant B
    // --------------------------------------------------------------------------
    console.log('\n▶ 2. Ingesting Bill for SAME Diner at Restaurant B (Farzi Cafe) with POS Key B...');
    const resB = await fetch(`${baseUrl}/api/pos/orders/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyB}`
      },
      body: JSON.stringify({
        order_id: `ORD_FARZI_${Date.now()}`,
        bill_no: `BILL_FARZI_202`,
        customer: { phone: testPhone, name: 'Ananya Sharma' },
        net_paid: 600,
        financials: { subtotal: 600, gross_amount: 600, net_paid: 600 }
      })
    });
    const dataB = await resB.json();
    assert(resB.ok && dataB.status === 'success', 'Restaurant B order saved successfully');
    assert(dataB.customer?.points_earned === 60, `Restaurant B points earned is 60 (got: ${dataB.customer?.points_earned})`);

    // --------------------------------------------------------------------------
    // TEST 3: Inquire via POS Key A only sees Restaurant A points (150 pts)
    // --------------------------------------------------------------------------
    console.log('\n▶ 3. Inquiring via POS Key A (Durbar Cafe)...');
    const inqA = await fetch(`${baseUrl}/api/pos/loyalty/inquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyA}`
      },
      body: JSON.stringify({ customer_phone: testPhone, bill_amount: 1000 })
    });
    const inqDataA = await inqA.json();
    assert(inqA.ok && inqDataA.status === 'success', 'Inquire A responded successfully');
    assert(inqDataA.customer.points_balance === 150, `POS Key A strictly sees 150 points for Durbar Cafe (got: ${inqDataA.customer.points_balance})`);

    // --------------------------------------------------------------------------
    // TEST 4: Inquire via POS Key B only sees Restaurant B points (60 pts)
    // --------------------------------------------------------------------------
    console.log('\n▶ 4. Inquiring via POS Key B (Farzi Cafe)...');
    const inqB = await fetch(`${baseUrl}/api/pos/loyalty/inquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyB}`
      },
      body: JSON.stringify({ customer_phone: testPhone, bill_amount: 1000 })
    });
    const inqDataB = await inqB.json();
    assert(inqB.ok && inqDataB.status === 'success', 'Inquire B responded successfully');
    assert(inqDataB.customer.points_balance === 60, `POS Key B strictly sees 60 points for Farzi Cafe (got: ${inqDataB.customer.points_balance})`);

    // --------------------------------------------------------------------------
    // TEST 5: Owner A Dashboard & Customer Insights (Durbar Cafe)
    // --------------------------------------------------------------------------
    console.log('\n▶ 5. Logging in as Restaurant A Owner (Durbar Cafe)...');
    const loginA = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'durbar@restaurant.com', password: 'owner123' })
    });
    const authA = await loginA.json();
    assert(loginA.ok && authA.token, 'Durbar Cafe owner logged in');
    const tokenA = authA.token;

    // Get Customer Insights for Restaurant A
    const custResA = await fetch(`${baseUrl}/api/v1/customers`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const custDataA = await custResA.json();
    const dinerAtA = custDataA.customers.find(c => c.phone.includes(testPhone));
    assert(dinerAtA !== undefined, 'Diner is listed in Restaurant A customers');
    assert(dinerAtA.pointsBalance === 150, `Restaurant A sees diner balance = 150 pts (got: ${dinerAtA.pointsBalance})`);
    assert(dinerAtA.lifetimeSpend === 1500, `Restaurant A sees diner lifetime spend = ₹1500 (got: ${dinerAtA.lifetimeSpend})`);

    // --------------------------------------------------------------------------
    // TEST 6: Owner B Dashboard & Customer Insights (Farzi Cafe)
    // --------------------------------------------------------------------------
    console.log('\n▶ 6. Logging in as Restaurant B Owner (Farzi Cafe)...');
    const loginB = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'farzi@restaurant.com', password: 'owner123' })
    });
    const authB = await loginB.json();
    assert(loginB.ok && authB.token, 'Farzi Cafe owner logged in');
    const tokenB = authB.token;

    // Get Customer Insights for Restaurant B
    const custResB = await fetch(`${baseUrl}/api/v1/customers`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const custDataB = await custResB.json();
    const dinerAtB = custDataB.customers.find(c => c.phone.includes(testPhone));
    assert(dinerAtB !== undefined, 'Diner is listed in Restaurant B customers');
    assert(dinerAtB.pointsBalance === 60, `Restaurant B sees diner balance = 60 pts (got: ${dinerAtB.pointsBalance})`);
    assert(dinerAtB.lifetimeSpend === 600, `Restaurant B sees diner lifetime spend = ₹600 (got: ${dinerAtB.lifetimeSpend})`);

    // --------------------------------------------------------------------------
    // TEST 7: Cross-Tenant Spoofing Attempt Blocked
    // --------------------------------------------------------------------------
    console.log('\n▶ 7. Attempting cross-tenant data access with spoofed x-tenant-id header...');
    const spoofRes = await fetch(`${baseUrl}/api/v1/customers`, {
      headers: {
        'Authorization': `Bearer ${tokenB}`,
        'x-tenant-id': restA // Farzi Cafe owner tries to inspect Durbar Cafe
      }
    });
    const spoofData = await spoofRes.json();
    // Farzi owner should still only see Farzi customers, NOT Durbar Cafe!
    const leakedAtB = spoofData.customers.find(c => c.pointsBalance === 150);
    assert(leakedAtB === undefined, 'Spoofed header was safely ignored; Farzi owner CANNOT see Durbar customer data');

    // --------------------------------------------------------------------------
    // TEST 8: Paused / Inactive Restaurant Rejection
    // --------------------------------------------------------------------------
    console.log('\n▶ 8. Testing POS rejection for temporarily deactivated restaurant...');
    posStore.setTenantStatus(restB, 'INACTIVE');
    const pausedRes = await fetch(`${baseUrl}/api/pos/loyalty/inquire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyB}`
      },
      body: JSON.stringify({ customer_phone: testPhone, bill_amount: 500 })
    });
    assert(pausedRes.status === 403, `Deactivated restaurant POS call is rejected with HTTP 403 (got: ${pausedRes.status})`);
    posStore.setTenantStatus(restB, 'ACTIVE'); // restore

    console.log('\n================================================================');
    console.log('🎉 ALL MULTI-TENANT ISOLATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================\n');

  } finally {
    server.close(() => {
      process.exit(0);
    });
  }
}

run();
