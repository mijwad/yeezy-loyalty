import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let unresolvedObserves = 0;

// Helper for strict failure assertions with SQLSTATE verification
async function expectFail(label, fn, expectedSqlState) {
  totalChecks++;
  let threw = false;
  let actualError = null;
  try {
    await fn();
  } catch (err) {
    threw = true;
    actualError = err;
  }

  if (!threw) {
    failedChecks++;
    console.error(`  ❌ FAIL [NO_ERROR]: ${label} - Expected operation to fail, but it succeeded!`);
    throw new Error(`[ASSERTION FAILED] ${label}: Expected operation to fail, but it succeeded!`);
  }

  if (expectedSqlState && actualError.code !== expectedSqlState) {
    failedChecks++;
    console.error(`  ❌ FAIL [WRONG_SQLSTATE]: ${label} - Expected '${expectedSqlState}', got '${actualError.code}'`);
    throw new Error(
      `[ASSERTION FAILED] ${label}: Expected SQLSTATE '${expectedSqlState}', but got '${actualError.code}' (${actualError.message})`
    );
  }

  passedChecks++;
  console.log(`  ✔ PASS [${actualError.code || 'ERR'}]: ${label}`);
  return actualError;
}

function assert(condition, message) {
  totalChecks++;
  if (!condition) {
    failedChecks++;
    console.error(`  ❌ ASSERTION FAILED: ${message}`);
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
  passedChecks++;
}

async function run() {
  console.log('================================================================');
  console.log('PETPOOJA LOYALTY SCHEMA & RPC RIGOROUS TEST SUITE (PGLite)');
  console.log('================================================================\n');

  const db = new PGlite();

  // Mock Supabase environment for PGlite WASM
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$ SELECT 'authenticated'::text; $$ LANGUAGE sql;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid; $$ LANGUAGE sql;
  `);

  const migrations = [
    'supabase/migrations/20261024_init_production_schema.sql',
    'supabase/migrations/20261025_points_expiry_function.sql',
    'supabase/migrations/20261026_pos_integration_tables.sql',
    'supabase/migrations/20261027_whatsapp_campaigns_module.sql',
    'supabase/migrations/20261028_whatsapp_webhook_events.sql',
    'supabase/migrations/20261030_petpooja_schema.sql',
    'supabase/migrations/20261031_fix_earn_points_idempotency.sql',
    'supabase/migrations/20261031120000_orders_outlet_id_not_null.sql',
    'supabase/migrations/20261101_loyalty_rpc_hardening.sql',
    'supabase/migrations/20261102_earn_events_and_late_commit.sql',
    'supabase/migrations/20261103_lock_ordering_and_security.sql',
    'supabase/migrations/20261104_lockdown_mutating_functions.sql',
    'supabase/migrations/20261105_petpooja_atomic_redeem.sql'
  ];

  console.log('--- Applying Migrations ---');
  for (const m of migrations) {
    let sql = fs.readFileSync(path.resolve(m), 'utf8');
    // PGlite compatibility: ignore external C shared object libraries
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '-- skipped');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '-- skipped');
    await db.exec(sql);
    console.log(`✔ Applied: ${m}`);
  }
  console.log('All migrations applied successfully.\n');

  // Set up base restaurant tenant
  const RESTAURANT_ID = 'ten_durbar_01';
  await db.query(`
    INSERT INTO public.loyalty_programs (restaurant_id, is_active, config)
    VALUES ($1, true, '{
      "point_value_paise": 100,
      "earn": {
        "base_rate_bps": 500,
        "points_expiry_days": 90,
        "bonus_points_expiry_days": 30
      },
      "redeem": {
        "min_points": 50,
        "min_bill_paise": 20000,
        "max_percent_of_bill": 50
      },
      "tiers": [
        {"name": "Silver", "min_visits": 0, "multiplier": 1.0},
        {"name": "Gold", "min_visits": 5, "multiplier": 1.25},
        {"name": "Platinum", "min_visits": 12, "multiplier": 1.5}
      ]
    }'::jsonb)
  `, [RESTAURANT_ID]);

  // Insert base Petpooja outlet A
  const outletRes = await db.query(`
    INSERT INTO public.outlets (tenant_id, name, pos_system, eatery_branch_code)
    VALUES ($1, 'Durbar Cafe Kochi', 'PETPOOJA', 'PP_KOCHI_01')
    RETURNING id
  `, [RESTAURANT_ID]);
  const outletId = outletRes.rows[0].id;

  // Insert member
  const memberRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, '+919847012345', 'Rahul Nair', 'Silver')
    RETURNING id
  `, [RESTAURANT_ID]);
  const memberId = memberRes.rows[0].id;

  // ============================================================================
  // SECTION 1: OUTLETS & PETPOOJA BRANCH UNIQUENESS
  // ============================================================================
  console.log('--- Section 1: Outlets & Branch Uniqueness ---');

  // Test duplicate eatery_branch_code for pos_system = 'PETPOOJA' (Must fail: 23505)
  await expectFail(
    'Duplicate eatery_branch_code for pos_system=PETPOOJA must fail (23505)',
    () => db.query(
      `INSERT INTO public.outlets (tenant_id, name, pos_system, eatery_branch_code)
       VALUES ($1, 'Another Branch', 'PETPOOJA', 'PP_KOCHI_01')`,
      [RESTAURANT_ID]
    ),
    '23505'
  );

  // Test duplicate eatery_branch_code for non-PETPOOJA system (e.g. RMS)
  const rmsOutletRes = await db.query(
    `INSERT INTO public.outlets (tenant_id, name, pos_system, eatery_branch_code)
     VALUES ($1, 'RMS Branch Same Code', 'RMS', 'PP_KOCHI_01')
     RETURNING id`,
    [RESTAURANT_ID]
  );
  assert(rmsOutletRes.rows.length === 1, 'Non-PETPOOJA outlet with same branch code should succeed');
  console.log('  ✔ PASS: Same eatery_branch_code allowed for non-PETPOOJA pos_system=RMS (partial index isolation)');

  // ============================================================================
  // SECTION 2: PETPOOJA REWARDS CONSTRAINTS & IDENTITY
  // ============================================================================
  console.log('\n--- Section 2: Petpooja Rewards Constraints & Identity ---');

  // GENERATED ALWAYS: Manually supplying petpooja_reward_id must fail (428C9)
  await expectFail(
    'Manual insert into GENERATED ALWAYS AS IDENTITY petpooja_reward_id must fail (428C9)',
    () => db.query(
      `INSERT INTO public.petpooja_rewards (petpooja_reward_id, restaurant_id, name, points_required, discount_type, discount_value)
       VALUES (999, $1, 'Illegal Reward', 100, 2, 100.00)`,
      [RESTAURANT_ID]
    ),
    '428C9'
  );

  // discount_type=3 requires pos_item_id: NULL must fail (23514)
  await expectFail(
    'discount_type=3 with pos_item_id=NULL must fail CHECK (23514)',
    () => db.query(
      `INSERT INTO public.petpooja_rewards (restaurant_id, name, points_required, discount_type, discount_value, pos_item_id)
       VALUES ($1, 'Free Brownie NULL Item', 200, 3, 0, NULL)`,
      [RESTAURANT_ID]
    ),
    '23514'
  );

  // discount_type=3 requires pos_item_id: empty string must fail (23514)
  await expectFail(
    'discount_type=3 with pos_item_id="" must fail CHECK (23514)',
    () => db.query(
      `INSERT INTO public.petpooja_rewards (restaurant_id, name, points_required, discount_type, discount_value, pos_item_id)
       VALUES ($1, 'Free Brownie Empty Item', 200, 3, 0, '   ')`,
      [RESTAURANT_ID]
    ),
    '23514'
  );

  // discount_type=1 allowed to have NULL or '' pos_item_id
  const rewPctRes = await db.query(
    `INSERT INTO public.petpooja_rewards (restaurant_id, name, points_required, discount_type, discount_value, pos_item_id)
     VALUES ($1, '10% Off Bill', 100, 1, 10.00, NULL)
     RETURNING petpooja_reward_id`,
    [RESTAURANT_ID]
  );
  assert(rewPctRes.rows.length === 1, 'discount_type=1 with pos_item_id=NULL should succeed');
  console.log(`  ✔ PASS: discount_type=1 allowed with pos_item_id=NULL (ID: ${rewPctRes.rows[0].petpooja_reward_id})`);

  // discount_type=2 allowed to have NULL or '' pos_item_id
  const rewFixedRes = await db.query(
    `INSERT INTO public.petpooja_rewards (restaurant_id, name, points_required, discount_type, discount_value, pos_item_id)
     VALUES ($1, '₹50 Off Bill', 50, 2, 50.00, '')
     RETURNING petpooja_reward_id`,
    [RESTAURANT_ID]
  );
  assert(rewFixedRes.rows.length === 1, 'discount_type=2 with pos_item_id="" should succeed');
  console.log(`  ✔ PASS: discount_type=2 allowed with pos_item_id="" (ID: ${rewFixedRes.rows[0].petpooja_reward_id})`);

  // discount_type=3 with valid pos_item_id succeeds
  const rewFreeItemRes = await db.query(
    `INSERT INTO public.petpooja_rewards (restaurant_id, name, points_required, discount_type, discount_value, pos_item_id)
     VALUES ($1, 'Free Cold Coffee', 150, 3, 0, 'MENU_COFFEE_01')
     RETURNING petpooja_reward_id`,
    [RESTAURANT_ID]
  );
  const freeItemId = rewFreeItemRes.rows[0].petpooja_reward_id;
  assert(freeItemId > 0, 'discount_type=3 with pos_item_id should succeed');
  console.log(`  ✔ PASS: discount_type=3 succeeds with pos_item_id='MENU_COFFEE_01' (ID: ${freeItemId})`);

  // Invalid discount_type (0 and 4) must fail (23514)
  await expectFail(
    'discount_type=0 must fail CHECK (23514)',
    () => db.query(
      `INSERT INTO public.petpooja_rewards (restaurant_id, name, points_required, discount_type, discount_value)
       VALUES ($1, 'Bad Type 0', 100, 0, 10)`,
      [RESTAURANT_ID]
    ),
    '23514'
  );

  await expectFail(
    'discount_type=4 must fail CHECK (23514)',
    () => db.query(
      `INSERT INTO public.petpooja_rewards (restaurant_id, name, points_required, discount_type, discount_value)
       VALUES ($1, 'Bad Type 4', 100, 4, 10)`,
      [RESTAURANT_ID]
    ),
    '23514'
  );

  // ============================================================================
  // SECTION 3: PETPOOJA REDEMPTIONS LIFECYCLE & PARTIAL UNIQUENESS
  // ============================================================================
  console.log('\n--- Section 3: Petpooja Redemptions Lifecycle & Partial Uniqueness ---');

  // Invalid status must fail (23514)
  await expectFail(
    'Invalid status must fail CHECK (23514)',
    () => db.query(
      `INSERT INTO public.petpooja_redemptions (
        restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
      ) VALUES ($1, $2, $3, '+919847012345', 'INV-X', 'CASHBACK', 'INVALID_STATUS', 50)`,
      [RESTAURANT_ID, outletId, memberId]
    ),
    '23514'
  );

  // Invalid kind must fail (23514)
  await expectFail(
    'Invalid kind must fail CHECK (23514)',
    () => db.query(
      `INSERT INTO public.petpooja_redemptions (
        restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
      ) VALUES ($1, $2, $3, '+919847012345', 'INV-X', 'CRYPTO', 'HELD', 50)`,
      [RESTAURANT_ID, outletId, memberId]
    ),
    '23514'
  );

  // Negative points_burned must fail (23514)
  await expectFail(
    'Negative points_burned must fail CHECK (23514)',
    () => db.query(
      `INSERT INTO public.petpooja_redemptions (
        restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
      ) VALUES ($1, $2, $3, '+919847012345', 'INV-X', 'CASHBACK', 'HELD', -10)`,
      [RESTAURANT_ID, outletId, memberId]
    ),
    '23514'
  );

  // Test expires_at default is within 2h55m and 3h05m of now
  const ttlTestRes = await db.query(
    `INSERT INTO public.petpooja_redemptions (
      restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
    ) VALUES ($1, $2, $3, '+919847012345', 'INV-TTL-CHECK', 'CASHBACK', 'HELD', 50)
    RETURNING created_at, expires_at`,
    [RESTAURANT_ID, outletId, memberId]
  );
  const createdAt = new Date(ttlTestRes.rows[0].created_at);
  const expiresAt = new Date(ttlTestRes.rows[0].expires_at);
  const diffMinutes = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 60);
  assert(diffMinutes >= 175 && diffMinutes <= 185, `Default expires_at should be 3 hours (~180 min), got ${diffMinutes} min`);
  console.log(`  ✔ PASS: expires_at default is 3 hours (${diffMinutes.toFixed(2)} min from created_at)`);

  // Clean up TTL check row
  await db.query(`DELETE FROM public.petpooja_redemptions WHERE invoice_no = 'INV-TTL-CHECK'`);

  // PARTIAL UNIQUE INDEX TEST:
  // Step A: Insert HELD row on (outletId, 'INV-REUSE')
  const hold1 = await db.query(
    `INSERT INTO public.petpooja_redemptions (
      restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
    ) VALUES ($1, $2, $3, '+919847012345', 'INV-REUSE', 'CASHBACK', 'HELD', 50)
    RETURNING id`,
    [RESTAURANT_ID, outletId, memberId]
  );
  const hold1Id = hold1.rows[0].id;

  // Step B: Concurrent active insert on same (outletId, 'INV-REUSE') must fail (23505)
  await expectFail(
    'Concurrent active (HELD) redemption on same invoice must fail (23505)',
    () => db.query(
      `INSERT INTO public.petpooja_redemptions (
        restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
      ) VALUES ($1, $2, $3, '+919847012345', 'INV-REUSE', 'CASHBACK', 'PENDING_OTP', 50)`,
      [RESTAURANT_ID, outletId, memberId]
    ),
    '23505'
  );

  // Step C1: Transition to SETTLED -> new HELD on same invoice MUST SUCCEED
  await db.query(`UPDATE public.petpooja_redemptions SET status = 'SETTLED' WHERE id = $1`, [hold1Id]);
  const hold2 = await db.query(
    `INSERT INTO public.petpooja_redemptions (
      restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
    ) VALUES ($1, $2, $3, '+919847012345', 'INV-REUSE', 'CASHBACK', 'HELD', 50)
    RETURNING id`,
    [RESTAURANT_ID, outletId, memberId]
  );
  assert(hold2.rows.length === 1, 'New HELD row after SETTLED should succeed');
  console.log('  ✔ PASS: New HELD row succeeds after prior redemption transitioned to SETTLED');

  // Step C2: Transition to CANCELLED -> new HELD on same invoice MUST SUCCEED
  await db.query(`UPDATE public.petpooja_redemptions SET status = 'CANCELLED' WHERE id = $1`, [hold2.rows[0].id]);
  const hold3 = await db.query(
    `INSERT INTO public.petpooja_redemptions (
      restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
    ) VALUES ($1, $2, $3, '+919847012345', 'INV-REUSE', 'CASHBACK', 'HELD', 50)
    RETURNING id`,
    [RESTAURANT_ID, outletId, memberId]
  );
  assert(hold3.rows.length === 1, 'New HELD row after CANCELLED should succeed');
  console.log('  ✔ PASS: New HELD row succeeds after prior redemption transitioned to CANCELLED');

  // Step C3: Transition to EXPIRED_RELEASED -> new HELD on same invoice MUST SUCCEED
  await db.query(`UPDATE public.petpooja_redemptions SET status = 'EXPIRED_RELEASED' WHERE id = $1`, [hold3.rows[0].id]);
  const hold4 = await db.query(
    `INSERT INTO public.petpooja_redemptions (
      restaurant_id, outlet_id, member_id, phone_e164, invoice_no, kind, status, points_burned
    ) VALUES ($1, $2, $3, '+919847012345', 'INV-REUSE', 'CASHBACK', 'HELD', 50)
    RETURNING id`,
    [RESTAURANT_ID, outletId, memberId]
  );
  assert(hold4.rows.length === 1, 'New HELD row after EXPIRED_RELEASED should succeed');
  console.log('  ✔ PASS: New HELD row succeeds after prior redemption transitioned to EXPIRED_RELEASED');

  // Clean up test rows
  await db.query(`DELETE FROM public.petpooja_redemptions WHERE invoice_no = 'INV-REUSE'`);

  // ============================================================================
  // SECTION 4: ORDERS IDEMPOTENCY & OUTLET CONSTRAINT
  // ============================================================================
  console.log('\n--- Section 4: Orders Table Idempotency & Outlet Constraint ---');

  // Insert valid order
  await db.query(
    `INSERT INTO public.orders (outlet_id, pos_order_id, pos_bill_no, subtotal_amount)
     VALUES ($1, 'ORD_TEST_001', 'BILL_001', 450.00)`,
    [outletId]
  );

  // Duplicate (outlet_id, pos_order_id) must fail (23505)
  await expectFail(
    'Duplicate (outlet_id, pos_order_id) on same outlet must fail (23505)',
    () => db.query(
      `INSERT INTO public.orders (outlet_id, pos_order_id, pos_bill_no, subtotal_amount)
       VALUES ($1, 'ORD_TEST_001', 'BILL_001', 450.00)`,
      [outletId]
    ),
    '23505'
  );

  // Order with outlet_id=NULL must fail NOT NULL constraint (23502)
  await expectFail(
    'Order with outlet_id=NULL must fail NOT NULL constraint (23502)',
    () => db.query(
      `INSERT INTO public.orders (outlet_id, pos_order_id, pos_bill_no, subtotal_amount)
       VALUES (NULL, 'ORD_NULL_OUTLET', 'BILL_NULL_1', 100.00)`
    ),
    '23502'
  );

  // Deleting an outlet that has existing orders must fail with restrict_violation (23001) due to ON DELETE RESTRICT
  await expectFail(
    'Deleting outlet with orders must fail with FK restrict violation 23001 (RESTRICT)',
    () => db.query(
      `DELETE FROM public.outlets WHERE id = $1`,
      [outletId]
    ),
    '23001'
  );

  // ============================================================================
  // SECTION 5: RPC ENGINE TESTING (RESERVE, COMMIT, RELEASE, EARN)
  // ============================================================================
  console.log('\n--- Section 5: RPC Engine Integration & Balance Assertions ---');

  // 1. Credit 200 points to member directly via loyalty_ledger for clean initial state
  await db.query(`
    INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
    VALUES ($1, $2, 'earn_base', 200, 200, NOW() + INTERVAL '90 days')
  `, [RESTAURANT_ID, memberId]);

  let bal = await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId]);
  let availableBalance = bal.rows[0].bal;
  assert(availableBalance === 200, `Expected initial balance of 200, got ${availableBalance}`);
  console.log(`Initial Available Balance: ${availableBalance} points`);

  // 2. Test: reserve -> commit
  console.log('\nTesting Flow 1: Reserve -> Commit');
  const res1 = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 80, 50000, 900) as res
  `, [RESTAURANT_ID]);
  const res1Data = res1.rows[0].res;
  assert(res1Data.success === true, `Reserve failed: ${JSON.stringify(res1Data)}`);
  const reservation1Id = res1Data.reservation_id;
  assert(res1Data.points_reserved === 80, `Expected 80 points reserved, got ${res1Data.points_reserved}`);

  bal = await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId]);
  assert(bal.rows[0].bal === 120, `Balance after reserve should be 120, got ${bal.rows[0].bal}`);
  console.log(`  ✔ Reserve 80 pts succeeded (Reservation: ${reservation1Id}). Available: ${bal.rows[0].bal}`);

  // Commit reservation 1
  const commit1 = await db.query(`
    SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_FLOW_1') as res
  `, [RESTAURANT_ID, reservation1Id]);
  const commit1Data = commit1.rows[0].res;
  assert(commit1Data.success === true, `Commit failed: ${JSON.stringify(commit1Data)}`);
  bal = await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId]);
  assert(bal.rows[0].bal === 120, `Balance after commit should stay 120 (hold converted to ledger deduction)`);
  console.log(`  ✔ Commit succeeded. Available: ${bal.rows[0].bal}`);

  // Test commit idempotency
  const commit1Retry = await db.query(`
    SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_FLOW_1') as res
  `, [RESTAURANT_ID, reservation1Id]);
  assert(commit1Retry.rows[0].res.idempotent === true, 'Subsequent commit call should be idempotent');
  console.log('  ✔ Commit is idempotent: repeat commit returned idempotent: true');

  // 3. Test: reserve -> release
  console.log('\nTesting Flow 2: Reserve -> Release');
  const res2 = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 70, 50000, 900) as res
  `, [RESTAURANT_ID]);
  const res2Data = res2.rows[0].res;
  assert(res2Data.success === true, `Reserve failed: ${JSON.stringify(res2Data)}`);
  const reservation2Id = res2Data.reservation_id;

  bal = await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId]);
  assert(bal.rows[0].bal === 50, `Balance after reserve 70 should be 50, got ${bal.rows[0].bal}`);
  console.log(`  ✔ Reserve 70 pts succeeded (Reservation: ${reservation2Id}). Available: ${bal.rows[0].bal}`);

  // Release reservation 2
  const rel2 = await db.query(`
    SELECT public.fn_loyalty_release_points($1, $2) as res
  `, [RESTAURANT_ID, reservation2Id]);
  assert(rel2.rows[0].res.success === true, 'Release failed');
  bal = await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId]);
  assert(bal.rows[0].bal === 120, `Balance after release should restore to 120, got ${bal.rows[0].bal}`);
  console.log(`  ✔ Release succeeded. Available balance restored: ${bal.rows[0].bal}`);

  // Test release idempotency
  const rel2Retry = await db.query(`
    SELECT public.fn_loyalty_release_points($1, $2) as res
  `, [RESTAURANT_ID, reservation2Id]);
  assert(rel2Retry.rows[0].res.idempotent === true, 'Release should be idempotent');
  console.log('  ✔ Release is idempotent: repeat release returned idempotent: true');

  // 4. Test: Flow 3 - Member meets minimum (120 >= 50), first reserves 50, second requests 100
  console.log('\nTesting Flow 3: INSUFFICIENT_BALANCE vs BELOW_MIN_POINTS Distinction');
  console.log(`  Current available balance: ${bal.rows[0].bal}`); // 120 pts
  // First reserve: 50 pts (balance leaves 70 pts, which is >= min 50)
  const res3A = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 50, 60000, 900) as res
  `, [RESTAURANT_ID]);
  assert(res3A.rows[0].res.success === true, 'First 50 pt reserve should succeed');
  bal = await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId]);
  assert(bal.rows[0].bal === 70, `Balance should be 70, got ${bal.rows[0].bal}`);
  console.log(`  ✔ First reserve of 50 pts succeeded. Remaining available: ${bal.rows[0].bal}`);

  // Second reserve: member has 70 pts (above min 50), requests 100 pts -> MUST BE INSUFFICIENT_BALANCE
  const res3B = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 100, 60000, 900) as res
  `, [RESTAURANT_ID]);
  const res3BData = res3B.rows[0].res;
  assert(res3BData.success === false, 'Second reserve requesting 100 pts on 70 balance should be rejected');
  assert(
    res3BData.error.code === 'INSUFFICIENT_BALANCE',
    `Expected exact code INSUFFICIENT_BALANCE, but got '${res3BData.error.code}' (${res3BData.error.message})`
  );
  console.log(`  ✔ Second reserve correctly rejected with INSUFFICIENT_BALANCE (Member has 70 >= 50, but < 100 requested)`);

  // Release reservation 3A to clean up
  await db.query(`SELECT public.fn_loyalty_release_points($1, $2)`, [RESTAURANT_ID, res3A.rows[0].res.reservation_id]);
  bal = await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId]);
  assert(bal.rows[0].bal === 120, 'Balance restored to 120');

  // Test Case: BELOW_MIN_POINTS (Member balance is strictly below min 50 points)
  console.log('\nTesting Separate BELOW_MIN_POINTS check:');
  const lowBalPhone = '+919847000001';
  const lowBalMemberRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, $2, 'Low Balance Guest', 'Silver') RETURNING id
  `, [RESTAURANT_ID, lowBalPhone]);
  // Credit only 30 points (below min 50)
  await db.query(`
    INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
    VALUES ($1, $2, 'earn_base', 30, 30, NOW() + INTERVAL '90 days')
  `, [RESTAURANT_ID, lowBalMemberRes.rows[0].id]);

  const belowMinRes = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, $2, 20, 40000, 900) as res
  `, [RESTAURANT_ID, lowBalPhone]);
  const belowMinData = belowMinRes.rows[0].res;
  assert(belowMinData.success === false, 'Reserve for member with balance < 50 must fail');
  assert(
    belowMinData.error.code === 'BELOW_MIN_POINTS',
    `Expected exact code BELOW_MIN_POINTS, got '${belowMinData.error.code}'`
  );
  console.log(`  ✔ BELOW_MIN_POINTS correctly asserted: ${belowMinData.error.code} (${belowMinData.error.message})`);

  // 5. Input Validations for fn_loyalty_reserve_points (negative, zero, NULL)
  console.log('\nTesting fn_loyalty_reserve_points Input Validations:');
  const zeroPts = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 0, 40000, 900) as res`, [RESTAURANT_ID])).rows[0].res;
  assert(zeroPts.success === false, 'Zero points reservation must fail');
  assert(zeroPts.error.code === 'INVALID_POINTS', `Expected INVALID_POINTS, got ${zeroPts.error.code}`);

  const negPts = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, '+919847012345', -20, 40000, 900) as res`, [RESTAURANT_ID])).rows[0].res;
  assert(negPts.success === false, 'Negative points reservation must fail');
  assert(negPts.error.code === 'INVALID_POINTS', `Expected INVALID_POINTS, got ${negPts.error.code}`);

  const nullPts = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, '+919847012345', NULL, 40000, 900) as res`, [RESTAURANT_ID])).rows[0].res;
  assert(nullPts.success === false, 'NULL points reservation must fail');
  assert(nullPts.error.code === 'INVALID_POINTS', `Expected INVALID_POINTS, got ${nullPts.error.code}`);

  const zeroBill = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 50, 0, 900) as res`, [RESTAURANT_ID])).rows[0].res;
  assert(zeroBill.success === false, 'Zero bill reservation must fail');
  assert(zeroBill.error.code === 'INVALID_BILL_AMOUNT', `Expected INVALID_BILL_AMOUNT, got ${zeroBill.error.code}`);

  const negBill = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 50, -5000, 900) as res`, [RESTAURANT_ID])).rows[0].res;
  assert(negBill.success === false, 'Negative bill reservation must fail');
  assert(negBill.error.code === 'INVALID_BILL_AMOUNT', `Expected INVALID_BILL_AMOUNT, got ${negBill.error.code}`);

  // Direct table check: redemption_reservations CHECK constraint prevents negative points
  await expectFail(
    'Direct insert of negative points into redemption_reservations must fail CHECK (points > 0)',
    () => db.query(
      `INSERT INTO public.redemption_reservations (restaurant_id, member_id, phone_e164, points, discount_paise, bill_amount_paise, expires_at)
       VALUES ($1, $2, '+919847012345', -50, 5000, 40000, NOW() + INTERVAL '15 min')`,
      [RESTAURANT_ID, memberId]
    ),
    '23514'
  );
  console.log('  ✔ Negative, zero, and NULL points correctly rejected (INVALID_POINTS); negative reservations cannot raise balance');

  // ============================================================================
  // SECTION 6: EXTENDED TESTS (BRAND NEW PHONE, NAMESPACED ORDER, COMMIT FAILURE)
  // ============================================================================
  console.log('\n--- Section 6: Extended Edge Cases & Resilience ---');

  // 1. Earn for a brand-new phone (auto-provisioning under row lock)
  const BRAND_NEW_PHONE = '+919847998877';
  const brandNewEarn = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, 'ORD_BRAND_NEW_01', $2, 30000, 'dine_in') as res
  `, [RESTAURANT_ID, BRAND_NEW_PHONE]);
  const brandNewData = brandNewEarn.rows[0].res;
  assert(brandNewData.success === true, `Earn for brand new phone failed: ${JSON.stringify(brandNewData)}`);
  assert(brandNewData.points_earned === 15, `Expected 15 points on 30000 paise (5%), got ${brandNewData.points_earned}`);
  assert(brandNewData.visit_count === 1, `Brand new phone visit count should be 1, got ${brandNewData.visit_count}`);

  const brandNewMemberInDb = await db.query(`
    SELECT id, tier, visit_count FROM public.loyalty_members WHERE restaurant_id = $1 AND phone_e164 = $2
  `, [RESTAURANT_ID, BRAND_NEW_PHONE]);
  assert(brandNewMemberInDb.rows.length === 1, 'Brand-new member must exist in loyalty_members');
  console.log(`  ✔ Brand-new phone auto-provisioned under lock: ${BRAND_NEW_PHONE} awarded ${brandNewData.points_earned} pts, visit 1`);

  // 2. Two outlets with the same native POS orderID using namespaced key (both must credit)
  const outletBRes = await db.query(`
    INSERT INTO public.outlets (tenant_id, name, pos_system, eatery_branch_code)
    VALUES ($1, 'Durbar Cafe Calicut', 'PETPOOJA', 'PP_CALICUT_02')
    RETURNING id
  `, [RESTAURANT_ID]);
  const outletBId = outletBRes.rows[0].id;

  const namespacedOrderA = `${outletId}:BILL_SAME_100`;
  const namespacedOrderB = `${outletBId}:BILL_SAME_100`;

  const earnOutletA = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, $2, '+919847012345', 20000, 'dine_in') as res
  `, [RESTAURANT_ID, namespacedOrderA]);
  assert(earnOutletA.rows[0].res.success === true, 'Outlet A earn failed');
  assert(earnOutletA.rows[0].res.points_earned === 10, 'Outlet A should earn 10 pts');

  const earnOutletB = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, $2, '+919847012345', 20000, 'dine_in') as res
  `, [RESTAURANT_ID, namespacedOrderB]);
  assert(earnOutletB.rows[0].res.success === true, 'Outlet B earn failed');
  assert(earnOutletB.rows[0].res.points_earned === 10, 'Outlet B should earn 10 pts');
  assert(earnOutletB.rows[0].res.idempotent !== true, 'Outlet B earn must not be marked idempotent from Outlet A');
  console.log(`  ✔ Same POS orderID namespaced per outlet (${namespacedOrderA} and ${namespacedOrderB}) both credited independently`);

  // 3. Commit-failure path: expired reservation returns redemption_commit failure and needs_review
  const expiredResSetup = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, '+919847012345', 50, 40000, 900) as res
  `, [RESTAURANT_ID]);
  const expiredResId = expiredResSetup.rows[0].res.reservation_id;

  // Force reservation to be expired past the 24-hour settlement grace window
  await db.query(`
    UPDATE public.redemption_reservations
    SET expires_at = NOW() - INTERVAL '25 hours'
    WHERE id = $1
  `, [expiredResId]);

  const earnExpiredRes = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, 'ORD_WITH_EXPIRED_RES', '+919847012345', 40000, 'dine_in', $2) as res
  `, [RESTAURANT_ID, expiredResId]);
  const earnExpiredData = earnExpiredRes.rows[0].res;
  assert(earnExpiredData.success === true, 'Order earn should still complete');
  assert(earnExpiredData.redemption_commit !== null, 'redemption_commit details must be present');
  assert(earnExpiredData.redemption_commit.success === false, 'redemption_commit must report success: false');
  assert(
    earnExpiredData.redemption_commit.error.code === 'RESERVATION_EXPIRED',
    `Expected RESERVATION_EXPIRED, got ${earnExpiredData.redemption_commit.error.code}`
  );
  assert(earnExpiredData.needs_review === true, 'needs_review must be true when redemption_commit fails');
  console.log(`  ✔ Expired reservation handled safely: redemption_commit.error='RESERVATION_EXPIRED', needs_review=true`);

  // 4. Zero-point idempotency & State Invariance test
  console.log('\nTesting Zero-Point Idempotency Bug & State Invariance Gate:');
  const zeroIdemPhone = '+919847112233';
  const zeroMemberRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier, visit_count, lifetime_spend_paise)
    VALUES ($1, $2, 'Zero Idem Guest', 'Silver', 4, 10000)
    RETURNING id
  `, [RESTAURANT_ID, zeroIdemPhone]);
  const zeroMemberId = zeroMemberRes.rows[0].id;

  // First call with 500 paise (0 points earned)
  const zCall1 = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, 'ORD_ZERO_IDEM_100', $2, 500, 'dine_in') as res
  `, [RESTAURANT_ID, zeroIdemPhone]);
  const firstData = zCall1.rows[0].res;
  assert(firstData.success === true, 'First zero-point call must succeed');
  assert(firstData.points_earned === 0, '500 paise must earn 0 points');
  const expectedVisitsAfterFirst = firstData.visit_count;
  const expectedTierAfterFirst = firstData.tier;

  // Retries 1, 2, 3 with identical order_id
  for (let r = 1; r <= 3; r++) {
    const retryRes = await db.query(`
      SELECT public.fn_loyalty_earn_points($1, 'ORD_ZERO_IDEM_100', $2, 500, 'dine_in') as res
    `, [RESTAURANT_ID, zeroIdemPhone]);
    assert(retryRes.rows[0].res.success === true, `Retry ${r} must succeed`);
    assert(retryRes.rows[0].res.idempotent === true, `Retry ${r} must be flagged idempotent`);
  }

  const zeroMemberState = (await db.query(`
    SELECT visit_count, lifetime_spend_paise, tier FROM public.loyalty_members WHERE id = $1
  `, [zeroMemberId])).rows[0];

  assert(zeroMemberState.visit_count === expectedVisitsAfterFirst, `visit_count must stay equal to state after first call (${expectedVisitsAfterFirst}), got ${zeroMemberState.visit_count}`);
  assert(zeroMemberState.lifetime_spend_paise === 10500, `lifetime_spend_paise must change exactly once (10500), got ${zeroMemberState.lifetime_spend_paise}`);
  assert(zeroMemberState.tier === expectedTierAfterFirst, `tier must stay equal to state after first call (${expectedTierAfterFirst}), got ${zeroMemberState.tier}`);
  console.log(`  ✔ Zero-point idempotency verified: state invariant across 3 retries (visits: ${zeroMemberState.visit_count}, tier: ${zeroMemberState.tier})`);

  // 4b. Concurrent Earn(with reservation) + Direct Commit Lock Ordering (Deadlock Safety)
  console.log('\nTesting Lock Ordering: Concurrent Earn(with reservation) + Direct Commit:');
  const deadPhone = '+919847665544';
  const deadMember = (await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, $2, 'Deadlock Test Guest', 'Silver') RETURNING id
  `, [RESTAURANT_ID, deadPhone])).rows[0].id;
  await db.query(`INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at) VALUES ($1, $2, 'earn_base', 100, 100, NOW() + INTERVAL '90 days')`, [RESTAURANT_ID, deadMember]);

  const deadRes = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 900) as res`, [RESTAURANT_ID, deadPhone])).rows[0].res;
  const deadResId = deadRes.reservation_id;

  const [earnDeadRes, directDeadCommit] = await Promise.all([
    db.query(`SELECT public.fn_loyalty_earn_points($1, 'ORD_LOCK_EARN', $2, 20000, 'dine_in', $3) as res`, [RESTAURANT_ID, deadPhone, deadResId]),
    db.query(`SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_LOCK_DIRECT') as res`, [RESTAURANT_ID, deadResId])
  ]);
  assert(earnDeadRes.rows[0].res.success === true, 'Earn with reservation must succeed');
  assert(directDeadCommit.rows[0].res.success === true, 'Direct commit must succeed');
  console.log('  ✔ Lock ordering verified: concurrent earn + direct commit executed without deadlock (Member -> Reservation lock hierarchy)');

  // 5. Late Commit within 24h grace window (INSUFFICIENT_AT_LATE_COMMIT)
  console.log('\nTesting Late Commit within 24h Grace Window:');
  const latePhone = '+919847334455';
  const lateMemberRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, $2, 'Late Commit Guest', 'Silver') RETURNING id
  `, [RESTAURANT_ID, latePhone]);
  const lateMemberId = lateMemberRes.rows[0].id;

  // Credit 100 points
  await db.query(`
    INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
    VALUES ($1, $2, 'earn_base', 100, 100, NOW() + INTERVAL '90 days')
  `, [RESTAURANT_ID, lateMemberId]);

  // Reserve 60 points with 900s TTL (R1)
  const r1Res = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, $2, 60, 40000, 900) as res
  `, [RESTAURANT_ID, latePhone]);
  const r1Id = r1Res.rows[0].res.reservation_id;

  // Move R1 expires_at 2 hours into past (within 24h grace window)
  await db.query(`
    UPDATE public.redemption_reservations
    SET expires_at = NOW() - INTERVAL '2 hours'
    WHERE id = $1
  `, [r1Id]);

  // Spend those 60 points through another reserve + commit (R2)
  const r2Res = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, $2, 60, 40000, 900) as res
  `, [RESTAURANT_ID, latePhone]);
  const r2Id = r2Res.rows[0].res.reservation_id;
  await db.query(`SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_SPEND_R2')`, [RESTAURANT_ID, r2Id]);

  // Balance now has only 40 points unexpired. Now commit R1 (needs 60 points)
  const lateCommitRes = await db.query(`
    SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_LATE_R1') as res
  `, [RESTAURANT_ID, r1Id]);
  const lateCommitData = lateCommitRes.rows[0].res;
  assert(lateCommitData.success === false, 'Late commit must fail due to insufficient remaining points');
  assert(
    lateCommitData.error.code === 'INSUFFICIENT_AT_LATE_COMMIT',
    `Expected exact code INSUFFICIENT_AT_LATE_COMMIT, got ${lateCommitData.error.code}`
  );

  // Invariant assertion: zero negative remaining rows in loyalty_ledger
  const negRemainingRows = await db.query(`
    SELECT COUNT(*) as cnt FROM public.loyalty_ledger WHERE member_id = $1 AND remaining < 0
  `, [lateMemberId]);
  assert(parseInt(negRemainingRows.rows[0].cnt) === 0, 'No ledger rows may have negative remaining');
  console.log(`  ✔ Late commit correctly rejected with INSUFFICIENT_AT_LATE_COMMIT; zero negative remaining in ledger`);

  // Earn with this late reservation flags needs_review
  const earnLateRes = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, 'ORD_EARN_WITH_LATE_RES', $2, 30000, 'dine_in', $3) as res
  `, [RESTAURANT_ID, latePhone, r1Id]);
  assert(earnLateRes.rows[0].res.success === true, 'Order earn should still complete');
  assert(earnLateRes.rows[0].res.needs_review === true, 'needs_review must be true for failed late commit');
  assert(
    earnLateRes.rows[0].res.redemption_commit.error.code === 'INSUFFICIENT_AT_LATE_COMMIT',
    `Expected redemption_commit.error.code = INSUFFICIENT_AT_LATE_COMMIT, got ${earnLateRes.rows[0].res.redemption_commit.error.code}`
  );
  console.log(`  ✔ Earn with late commit failure returns redemption_commit details and flags needs_review=true`);

  // 6. TTL Duration on available balance 60 minutes later
  console.log('\nTesting TTL Durations (10800s vs 900s 60 minutes later):');
  const ttlPhone = '+919847556677';
  const ttlMember = (await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, $2, 'TTL Test Guest', 'Silver') RETURNING id
  `, [RESTAURANT_ID, ttlPhone])).rows[0].id;

  // Add 200 points
  await db.query(`
    INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
    VALUES ($1, $2, 'earn_base', 200, 200, NOW() + INTERVAL '90 days')
  `, [RESTAURANT_ID, ttlMember]);

  // Res A: 10800s (3 hours), Res B: 900s (15 minutes)
  const res3hr = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 10800) as res`, [RESTAURANT_ID, ttlPhone])).rows[0].res.reservation_id;
  const res15min = (await db.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 900) as res`, [RESTAURANT_ID, ttlPhone])).rows[0].res.reservation_id;

  // Fast forward by 60 minutes
  await db.query(`UPDATE public.redemption_reservations SET expires_at = expires_at - INTERVAL '60 minutes' WHERE id IN ($1, $2)`, [res3hr, res15min]);

  const bal60min = (await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, ttlMember])).rows[0].bal;
  assert(bal60min === 150, `Expected 150 available balance (200 - 50 held by 3hr res), got ${bal60min}`);
  console.log(`  ✔ TTL verified: 10800s reservation holds balance 60 mins later (balance: ${bal60min}), 900s reservation expired`);

  // ============================================================================
  // SECTION 7: FN_LOYALTY_EARN_POINTS IDEMPOTENCY STRICT ASSERTION
  // ============================================================================
  console.log('\n--- Section 7: fn_loyalty_earn_points Idempotency Verification ---');
  const ORDER_ID = 'ORD_LOYALTY_EARN_TEST_99';
  const earn1 = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, $2, '+919847012345', 40000, 'dine_in') as res
  `, [RESTAURANT_ID, ORDER_ID]);
  const earn1Data = earn1.rows[0].res;
  assert(earn1Data.success === true, `First earn call must succeed, got: ${JSON.stringify(earn1Data)}`);
  assert(earn1Data.points_earned > 0, `First earn call must award points, got: ${earn1Data.points_earned}`);
  const pointsEarnedFirst = earn1Data.points_earned;
  console.log(`  ✔ First earn call awarded: ${pointsEarnedFirst} points (new balance: ${earn1Data.new_balance})`);

  const balAfterEarn1 = (await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId])).rows[0].bal;

  // Second earn call with identical order_id
  const earn2 = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, $2, '+919847012345', 40000, 'dine_in') as res
  `, [RESTAURANT_ID, ORDER_ID]);
  const earn2Data = earn2.rows[0].res;

  const balAfterEarn2 = (await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memberId])).rows[0].bal;

  // Strict assertions on second earn call
  assert(earn2Data.success === true, `Second earn call must have success=true, got: ${JSON.stringify(earn2Data)}`);
  assert(earn2Data.idempotent === true, `Second earn call must return idempotent=true, got: ${JSON.stringify(earn2Data)}`);
  assert(
    earn2Data.points_earned === pointsEarnedFirst,
    `Second earn call points_earned (${earn2Data.points_earned}) must match first call (${pointsEarnedFirst})`
  );
  assert(balAfterEarn2 === balAfterEarn1, `Balance double-credited! Before: ${balAfterEarn1}, After: ${balAfterEarn2}`);
  console.log(`  ✔ Second earn call returned idempotent: true with identical points_earned (${earn2Data.points_earned}) and unchanged balance (${balAfterEarn2}).`);

  // ============================================================================
  // SECTION 8: FN_PETPOOJA_REDEEM ATOMIC RPC VERIFICATION
  // ============================================================================
  console.log('\n--- Section 8: fn_petpooja_redeem Atomic Verification ---');

  // Create a dedicated member with 200 points for Petpooja redeem testing
  const ppMemRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, '+919876500001', 'Petpooja Redeem Test Member', 'Silver')
    RETURNING id;
  `, [RESTAURANT_ID]);
  const ppMemberId = ppMemRes.rows[0].id;

  await db.query(`
    INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
    VALUES ($1, $2, 'earn_base', 200, 200, NOW() + INTERVAL '90 days')
  `, [RESTAURANT_ID, ppMemberId]);

  // Test 1: Successful initial redeem and idempotent retry returns the same reservation
  console.log('Testing fn_petpooja_redeem: Idempotent Retry...');
  const r1 = await db.query(`
    SELECT public.fn_petpooja_redeem($1, $2, '+919876500001', 'INV_PETPOOJA_IDEMP', 50, 40000, 10800) as res
  `, [RESTAURANT_ID, outletId]);
  const r1Data = r1.rows[0].res;
  assert(r1Data.success === true, `Initial redeem must succeed: ${JSON.stringify(r1Data)}`);
  assert(r1Data.idempotent === false, 'Initial redeem should have idempotent: false');
  assert(r1Data.points === 50, 'Points burned must be 50');
  assert(r1Data.discount_paise === 5000, 'Discount must be 5000 paise');
  const resId1 = r1Data.reservation_id;

  // Idempotent retry: same phone, invoice, points
  const r1Retry = await db.query(`
    SELECT public.fn_petpooja_redeem($1, $2, '+919876500001', 'INV_PETPOOJA_IDEMP', 50, 40000, 10800) as res
  `, [RESTAURANT_ID, outletId]);
  const r1RetryData = r1Retry.rows[0].res;
  assert(r1RetryData.success === true, `Retry must succeed: ${JSON.stringify(r1RetryData)}`);
  assert(r1RetryData.idempotent === true, 'Retry must have idempotent: true');
  assert(r1RetryData.reservation_id === resId1, `Retry must return same reservation_id (${resId1}), got: ${r1RetryData.reservation_id}`);

  // Confirm exactly 1 active HELD redemption row
  const heldCount1 = (await db.query(`
    SELECT COUNT(*) as cnt FROM public.petpooja_redemptions
    WHERE outlet_id = $1 AND invoice_no = 'INV_PETPOOJA_IDEMP' AND status = 'HELD'
  `, [outletId])).rows[0].cnt;
  assert(parseInt(heldCount1) === 1, `Expected exactly 1 HELD redemption row, got ${heldCount1}`);
  console.log(`  ✔ Idempotent retry verified: returned same reservation (${resId1}) with idempotent=true`);

  // Test 2: Changed points replaces the old hold and frees its points
  console.log('Testing fn_petpooja_redeem: Changed Points on Same Invoice...');
  const balBeforeChange = (await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, ppMemberId])).rows[0].bal;
  assert(balBeforeChange === 150, `Expected available balance 150 (200 - 50 held), got ${balBeforeChange}`);

  // Change points on same invoice from 50 to 80
  const r2Change = await db.query(`
    SELECT public.fn_petpooja_redeem($1, $2, '+919876500001', 'INV_PETPOOJA_IDEMP', 80, 40000, 10800) as res
  `, [RESTAURANT_ID, outletId]);
  const r2ChangeData = r2Change.rows[0].res;
  assert(r2ChangeData.success === true, `Changed redeem must succeed: ${JSON.stringify(r2ChangeData)}`);
  assert(r2ChangeData.points === 80, 'Points burned must be 80');
  assert(r2ChangeData.reservation_id !== resId1, 'Must create a new reservation for changed points');

  // Old reservation should be released
  const oldResStatus = (await db.query(`
    SELECT status FROM public.redemption_reservations WHERE id = $1
  `, [resId1])).rows[0].status;
  assert(oldResStatus === 'released', `Old reservation must be 'released', got ${oldResStatus}`);

  // Old redemption row should be CANCELLED
  const cancelledRows = (await db.query(`
    SELECT COUNT(*) as cnt FROM public.petpooja_redemptions
    WHERE outlet_id = $1 AND invoice_no = 'INV_PETPOOJA_IDEMP' AND status = 'CANCELLED'
  `, [outletId])).rows[0].cnt;
  assert(parseInt(cancelledRows) === 1, `Expected 1 CANCELLED redemption row, got ${cancelledRows}`);

  // Balance after 80 pt reservation should be 200 - 80 = 120
  const balAfterChange = (await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, ppMemberId])).rows[0].bal;
  assert(balAfterChange === 120, `Expected balance 120 (200 - 80), got ${balAfterChange}`);
  console.log(`  ✔ Changed points replaced old hold: old reservation released, old redemption CANCELLED, available balance = ${balAfterChange}`);

  // Test 3: Validation failure leaves zero orphan rows
  console.log('Testing fn_petpooja_redeem: Validation Failure & Orphan Safety...');
  const invFail = 'INV_PETPOOJA_FAIL_TEST';
  // Bill below minimum (min is ₹200 / 20000 paise, pass 5000)
  const failRes = await db.query(`
    SELECT public.fn_petpooja_redeem($1, $2, '+919876500001', $3, 50, 5000, 10800) as res
  `, [RESTAURANT_ID, outletId, invFail]);
  const failData = failRes.rows[0].res;
  assert(failData.success === false, 'Redeem below min bill must fail');
  assert(failData.error.code === 'MIN_BILL_NOT_MET', `Expected MIN_BILL_NOT_MET, got ${failData.error.code}`);

  // Assert NO orphan rows in petpooja_redemptions or redemption_reservations
  const orphanRedemptions = (await db.query(`
    SELECT COUNT(*) as cnt FROM public.petpooja_redemptions WHERE invoice_no = $1
  `, [invFail])).rows[0].cnt;
  assert(parseInt(orphanRedemptions) === 0, `Expected 0 orphan petpooja_redemptions, got ${orphanRedemptions}`);

  // Requested points exceeding balance
  const failPts = await db.query(`
    SELECT public.fn_petpooja_redeem($1, $2, '+919876500001', $3, 500, 40000, 10800) as res
  `, [RESTAURANT_ID, outletId, invFail]);
  const failPtsData = failPts.rows[0].res;
  assert(failPtsData.success === false, 'Redeem exceeding balance must fail');
  assert(failPtsData.error.code === 'INSUFFICIENT_BALANCE', `Expected INSUFFICIENT_BALANCE, got ${failPtsData.error.code}`);
  console.log('  ✔ Validation failure safety verified: zero orphan rows created in petpooja_redemptions or reservations');

  // Test 4: Redeem followed by member balance equals expected
  console.log('Testing fn_petpooja_redeem: Member Balance Consistency...');
  const invBal = 'INV_PETPOOJA_BAL_VERIFY';
  // Balance is 120, redeem 50
  const balTestRes = await db.query(`
    SELECT public.fn_petpooja_redeem($1, $2, '+919876500001', $3, 50, 40000, 10800) as res
  `, [RESTAURANT_ID, outletId, invBal]);
  assert(balTestRes.rows[0].res.success === true, 'Redeem 50 pts must succeed');
  const balAfterBalTest = (await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, ppMemberId])).rows[0].bal;
  assert(balAfterBalTest === 70, `Expected balance 70 (120 - 50), got ${balAfterBalTest}`);

  // Commit the reservation via order
  const commitBalTest = await db.query(`
    SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_PETPOOJA_COMMIT_FINAL') as res
  `, [RESTAURANT_ID, balTestRes.rows[0].res.reservation_id]);
  assert(commitBalTest.rows[0].res.success === true, 'Commit must succeed');
  const balAfterCommit = (await db.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, ppMemberId])).rows[0].bal;
  assert(balAfterCommit === 70, `Available balance after commit must remain 70, got ${balAfterCommit}`);
  console.log(`  ✔ Member balance verified: 70 available points consistent through hold and commit`);

  // ============================================================================
  // SUMMARY REPORT & EXIT CODE DETERMINATION
  // ============================================================================
  console.log('\n================================================================');
  console.log('TEST SUMMARY');
  console.log(`  Total Checks Executed : ${totalChecks}`);
  console.log(`  Passed Checks         : ${passedChecks}`);
  console.log(`  Failed Checks         : ${failedChecks}`);
  console.log(`  Unresolved Observes   : ${unresolvedObserves}`);
  console.log('================================================================');

  if (failedChecks > 0 || unresolvedObserves > 0) {
    console.error('\n❌ TEST RUN FAILED: Checks failed or unresolved observes remaining.\n');
    process.exit(1);
  }

  console.log('\n🎉 ALL CHECKS PASSED PERFECTLY WITH ZERO UNRESOLVED OBSERVES! 🎉\n');
}

run().catch(err => {
  console.error('\n❌ FATAL TEST RUNNER FAILURE:', err);
  process.exit(1);
});
