import pg from 'pg';
const { Pool, Client } = pg;
import fs from 'node:fs';
import path from 'node:path';

// 1. Strict Configuration: Read ONLY LOCAL_PG_URL, NEVER SUPABASE_*
const RAW_URL = process.env.LOCAL_PG_URL || 'postgres://postgres:test@127.0.0.1:54329/postgres';

let parsedUrl;
try {
  parsedUrl = new URL(RAW_URL);
} catch (err) {
  console.error(`\n❌ INVALID URL: Could not parse connection string '${RAW_URL}': ${err.message}`);
  process.exit(1);
}

// 2. Strict Safety Guard: Allow ONLY localhost / 127.0.0.1 / ::1
const ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];
if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
  console.error(`\n❌ SAFETY ABORT: Database host '${parsedUrl.hostname}' is NOT a permitted local address (${ALLOWED_HOSTS.join(', ')})!`);
  console.error('This concurrency test is destructive and must only be executed against a local test container.\n');
  process.exit(1);
}

let checksPassed = 0;
let checksFailed = 0;

function assert(condition, message) {
  if (!condition) {
    checksFailed++;
    throw new Error(`[CONCURRENCY ASSERTION FAILED] ${message}`);
  }
  checksPassed++;
}

let memberSequence = 0;
async function createFreshMember(pool, restaurantId, namePrefix, initialPoints = 0) {
  memberSequence++;
  const phone = `+919999${String(memberSequence).padStart(6, '0')}`;
  const res = await pool.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier, visit_count, lifetime_spend_paise)
    VALUES ($1, $2, $3, 'Silver', 0, 0)
    RETURNING id, phone_e164;
  `, [restaurantId, phone, `${namePrefix} #${memberSequence}`]);
  const memberId = res.rows[0].id;

  if (initialPoints > 0) {
    await pool.query(`
      INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
      VALUES ($1, $2, 'earn_base', $3, $3, NOW() + INTERVAL '90 days')
    `, [restaurantId, memberId, initialPoints]);
  }

  return { memberId, phone };
}

async function run() {
  console.log('================================================================');
  console.log('PETPOOJA HIGH-CONCURRENCY STRESS & ISOLATION SUITE (PG POOL)');
  const targetDisplay = `${parsedUrl.hostname}:${parsedUrl.port || 5432}${parsedUrl.pathname}`;
  console.log(`Target: ${targetDisplay}`);
  console.log('================================================================\n');

  // Test maintenance connectivity
  const maintClient = new Client({
    connectionString: RAW_URL,
    connectionTimeoutMillis: 3000
  });

  try {
    await maintClient.connect();
    await maintClient.query('SELECT 1');
    console.log('✔ Connected to PostgreSQL maintenance database.');
  } catch (err) {
    console.error('❌ Could not connect to local PostgreSQL instance: ' + err.message);
    console.error('\nNOT RUN');
    console.error(`Local database container is not running on ${RAW_URL}`);
    console.error('Start local PostgreSQL or Docker container to execute multi-client concurrency tests.\n');
    process.exit(2);
  }

  // 3. Create throwaway database loyalty_test_<random>
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const testDbName = `loyalty_test_${randomSuffix}`;
  console.log(`Creating throwaway database: ${testDbName}...`);
  await maintClient.query(`CREATE DATABASE ${testDbName};`);
  await maintClient.end();
  console.log(`✔ Throwaway database created: ${testDbName}\n`);

  const testDbUrl = new URL(RAW_URL);
  testDbUrl.pathname = `/${testDbName}`;

  const pool = new Pool({
    connectionString: testDbUrl.toString(),
    max: 25,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000
  });

  pool.on('error', () => {});

  try {
    // 4. Setup Roles, Supabase Default Privileges & Negative Control
    console.log('--- Step 1: Provisioning Roles & Replicating Supabase Default Privileges ---');
    const initClient = await pool.connect();
    try {
      await initClient.query(`
        DO $$ BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
        END $$;

        GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$ SELECT 'service_role'::text; $$ LANGUAGE sql;
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid; $$ LANGUAGE sql;
      `);
      console.log('✔ Roles initialized and default privileges configured.');

      // Negative control: Confirm anon CAN read an un-revoked table created AFTER defaults
      console.log('--- Negative Control: Verifying anon CAN read under default privileges ---');
      await initClient.query(`
        CREATE TABLE public.throwaway_default_priv_test (
          id SERIAL PRIMARY KEY,
          val TEXT
        );
        INSERT INTO public.throwaway_default_priv_test (val) VALUES ('can_read_unlocked');
      `);

      await initClient.query('SET ROLE anon');
      const ctrlRes = await initClient.query('SELECT * FROM public.throwaway_default_priv_test');
      assert(ctrlRes.rows.length === 1 && ctrlRes.rows[0].val === 'can_read_unlocked', 'Negative control failed: anon could not read un-revoked table');
      await initClient.query('RESET ROLE');
      await initClient.query('DROP TABLE public.throwaway_default_priv_test');
      console.log('✔ Negative control verified: role anon successfully read throwaway table prior to migrations.\n');

      // 5. Apply all migrations in order
      console.log('--- Step 2: Applying Migrations in Order ---');
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

      for (const m of migrations) {
        const sql = fs.readFileSync(path.resolve(m), 'utf8');
        await initClient.query(sql);
        console.log(`✔ Applied: ${m}`);
      }
      console.log('All migrations applied successfully.\n');
    } finally {
      initClient.release();
    }

    const RESTAURANT_ID = 'ten_concurrency_stress';

    // Set up test restaurant program
    await pool.query(`
      INSERT INTO public.loyalty_programs (restaurant_id, is_active, config)
      VALUES ($1, true, '{
        "point_value_paise": 100,
        "earn": { "base_rate_bps": 500, "points_expiry_days": 90 },
        "redeem": { "min_points": 50, "min_bill_paise": 20000, "max_percent_of_bill": 50 }
      }')
      ON CONFLICT (restaurant_id) DO UPDATE SET is_active = true;
    `, [RESTAURANT_ID]);

    // Create test outlet for Petpooja
    const outRes = await pool.query(`
      INSERT INTO public.outlets (tenant_id, name, pos_system, eatery_branch_code)
      VALUES ($1, 'Concurrency Test Outlet', 'PETPOOJA', 'PP_CONC_BRANCH_01')
      RETURNING id;
    `, [RESTAURANT_ID]);
    const outletId = outRes.rows[0].id;

    // ========================================================================
    // TEST (A): 50 rounds x 5-10 parallel reserve calls on 50-point balance
    // Exactly 1 winner per round, zero over-allocation
    // ========================================================================
    console.log('--- Test (a): 50 Rounds x 5-10 Parallel Point Reservations (50 pts / 50 pts) ---');
    const memA = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_A', 0);
    for (let round = 1; round <= 50; round++) {
      // Reset ledger to exactly 50 points
      await pool.query(`DELETE FROM public.redemption_reservations WHERE member_id = $1`, [memA.memberId]);
      await pool.query(`DELETE FROM public.loyalty_ledger WHERE member_id = $1`, [memA.memberId]);
      await pool.query(`
        INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
        VALUES ($1, $2, 'earn_base', 50, 50, NOW() + INTERVAL '90 days')
      `, [RESTAURANT_ID, memA.memberId]);

      const concurrency = 5 + (round % 6); // 5 to 10 parallel callers
      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        promises.push(
          pool.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 900) as res`, [RESTAURANT_ID, memA.phone])
            .then(r => r.rows[0].res)
        );
      }

      const results = await Promise.all(promises);
      const winners = results.filter(r => r.success === true);
      const losers = results.filter(r => r.success === false);

      assert(winners.length === 1, `Round ${round}: Expected exactly 1 winner, got ${winners.length}`);
      assert(losers.length === concurrency - 1, `Round ${round}: Expected ${concurrency - 1} losers, got ${losers.length}`);

      for (const loser of losers) {
        assert(
          loser.error.code === 'BELOW_MIN_POINTS' || loser.error.code === 'INSUFFICIENT_BALANCE',
          `Round ${round}: Loser had unexpected code ${loser.error.code}`
        );
      }
    }
    console.log('✔ Passed Test (a): 50 rounds executed; exactly 1 winner per round with zero over-allocation.\n');

    // ========================================================================
    // TEST (A-VARIANT): 30 rounds x 5-10 parallel reserve calls (150 pts balance / 100 pts reserve)
    // Losers MUST receive exactly INSUFFICIENT_BALANCE (not BELOW_MIN_POINTS)
    // ========================================================================
    console.log('--- Test (a-variant): 30 Rounds x 5-10 Parallel Reserve (150 pts balance / 100 pts requested) ---');
    const memA2 = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_A2', 0);
    for (let round = 1; round <= 30; round++) {
      // Reset ledger to exactly 150 points
      await pool.query(`DELETE FROM public.redemption_reservations WHERE member_id = $1`, [memA2.memberId]);
      await pool.query(`DELETE FROM public.loyalty_ledger WHERE member_id = $1`, [memA2.memberId]);
      await pool.query(`
        INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
        VALUES ($1, $2, 'earn_base', 150, 150, NOW() + INTERVAL '90 days')
      `, [RESTAURANT_ID, memA2.memberId]);

      const concurrency = 5 + (round % 6);
      const promises = [];
      for (let i = 0; i < concurrency; i++) {
        promises.push(
          pool.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 100, 40000, 900) as res`, [RESTAURANT_ID, memA2.phone])
            .then(r => r.rows[0].res)
        );
      }

      const results = await Promise.all(promises);
      const winners = results.filter(r => r.success === true);
      const losers = results.filter(r => r.success === false);

      assert(winners.length === 1, `Variant Round ${round}: Expected exactly 1 winner, got ${winners.length}`);
      assert(losers.length === concurrency - 1, `Variant Round ${round}: Expected ${concurrency - 1} losers, got ${losers.length}`);

      for (const loser of losers) {
        // Since 150 - 100 = 50 >= min_points (50), the remaining balance is NOT below min points.
        // Therefore, losers must strictly receive INSUFFICIENT_BALANCE!
        assert(
          loser.error.code === 'INSUFFICIENT_BALANCE',
          `Variant Round ${round}: Loser must have exact code INSUFFICIENT_BALANCE, got ${loser.error.code}`
        );
      }
    }
    console.log('✔ Passed Test (a-variant): 30 rounds executed; all losers received exact INSUFFICIENT_BALANCE code.\n');

    // ========================================================================
    // TEST (B): 30 rounds x parallel earn with the same order_id
    // Fresh member per test: assert visit_count and lifetime_spend_paise increase exactly once per order
    // ========================================================================
    console.log('--- Test (b): 30 Rounds x Parallel Earn (Idempotency & Visit/Spend Counters) ---');
    const memB = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_B', 0);
    for (let round = 1; round <= 30; round++) {
      const orderId = `CONC_ORD_${round}_${Date.now()}`;

      // Query baseline member stats before parallel earn calls
      const baseline = (await pool.query(`
        SELECT visit_count, lifetime_spend_paise FROM public.loyalty_members WHERE id = $1
      `, [memB.memberId])).rows[0];
      const initialVisits = parseInt(baseline.visit_count);
      const initialSpend = BigInt(baseline.lifetime_spend_paise);

      const [res1, res2] = await Promise.all([
        pool.query(`SELECT public.fn_loyalty_earn_points($1, $2, $3, 20000, 'dine_in') as res`, [RESTAURANT_ID, orderId, memB.phone]).then(r => r.rows[0].res),
        pool.query(`SELECT public.fn_loyalty_earn_points($1, $2, $3, 20000, 'dine_in') as res`, [RESTAURANT_ID, orderId, memB.phone]).then(r => r.rows[0].res)
      ]);

      assert(res1.success === true && res2.success === true, `Round ${round}: Both earn calls must succeed`);
      const idempotentCount = (res1.idempotent ? 1 : 0) + (res2.idempotent ? 1 : 0);
      assert(idempotentCount === 1, `Round ${round}: Expected exactly 1 idempotent response, got ${idempotentCount}`);

      // Check event table
      const eventCount = (await pool.query(`SELECT COUNT(*) as cnt FROM public.loyalty_earn_events WHERE restaurant_id = $1 AND order_id = $2`, [RESTAURANT_ID, orderId])).rows[0].cnt;
      assert(parseInt(eventCount) === 1, `Round ${round}: Expected 1 loyalty_earn_events row, got ${eventCount}`);

      // Check ledger row
      const ledgerCount = (await pool.query(`SELECT COUNT(*) as cnt FROM public.loyalty_ledger WHERE restaurant_id = $1 AND order_id = $2`, [RESTAURANT_ID, orderId])).rows[0].cnt;
      assert(parseInt(ledgerCount) === 1, `Round ${round}: Expected 1 loyalty_ledger row, got ${ledgerCount}`);

      // Assert visit_count and lifetime_spend_paise increase exactly once
      const updated = (await pool.query(`
        SELECT visit_count, lifetime_spend_paise FROM public.loyalty_members WHERE id = $1
      `, [memB.memberId])).rows[0];
      assert(parseInt(updated.visit_count) === initialVisits + 1, `Round ${round}: visit_count must increment exactly once (${initialVisits} -> ${initialVisits + 1}), got ${updated.visit_count}`);
      assert(BigInt(updated.lifetime_spend_paise) === initialSpend + 20000n, `Round ${round}: lifetime_spend_paise must increase by 20000 paise exactly once, got ${updated.lifetime_spend_paise}`);
    }
    console.log('✔ Passed Test (b): 30 rounds executed; visit_count and lifetime_spend_paise incremented exactly once per order.\n');

    // ========================================================================
    // TEST (C): Parallel commit vs release on the same reservation (Fresh Member)
    // One wins; if commit won: 1 'redeem' row & balance reduced; if release won: 0 'redeem' row & balance restored
    // ========================================================================
    console.log('--- Test (c): Parallel Commit vs Release on Same Reservation (Fresh Member) ---');
    const memC = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_C', 100);

    const resHoldC = (await pool.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 900) as res`, [RESTAURANT_ID, memC.phone])).rows[0].res;
    assert(resHoldC.success === true, `Test (c): Reserve must succeed, got: ${JSON.stringify(resHoldC)}`);
    const holdCId = resHoldC.reservation_id;

    const [commitRes, releaseRes] = await Promise.all([
      pool.query(`SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_COMMIT_VS_RELEASE') as res`, [RESTAURANT_ID, holdCId]).then(r => r.rows[0].res),
      pool.query(`SELECT public.fn_loyalty_release_points($1, $2) as res`, [RESTAURANT_ID, holdCId]).then(r => r.rows[0].res)
    ]);

    const commitWon = (commitRes.success === true && releaseRes.success === false);
    const releaseWon = (commitRes.success === false && releaseRes.success === true);
    assert(commitWon || releaseWon, `Either commit or release must succeed exclusively. Commit: ${JSON.stringify(commitRes)}, Release: ${JSON.stringify(releaseRes)}`);

    const balAfterRace = parseInt((await pool.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memC.memberId])).rows[0].bal);
    const redeemRowCount = parseInt((await pool.query(`SELECT COUNT(*) as cnt FROM public.loyalty_ledger WHERE member_id = $1 AND type = 'redeem'`, [memC.memberId])).rows[0].cnt);

    if (commitWon) {
      assert(redeemRowCount === 1, `Commit won: Expected exactly 1 'redeem' ledger row, got ${redeemRowCount}`);
      assert(balAfterRace === 50, `Commit won: Balance must be reduced to 50, got ${balAfterRace}`);
      console.log(`✔ Passed Test (c): Commit won cleanly (1 redeem row, balance reduced to 50).\n`);
    } else {
      assert(redeemRowCount === 0, `Release won: Expected 0 'redeem' ledger rows, got ${redeemRowCount}`);
      assert(balAfterRace === 100, `Release won: Balance must be restored to 100, got ${balAfterRace}`);
      console.log(`✔ Passed Test (c): Release won cleanly (0 redeem rows, balance restored to 100).\n`);
    }

    // ========================================================================
    // TEST (D): Parallel commit x 2 (Idempotency Race with Fresh Member)
    // Exactly 1 'redeem' row, points deducted once
    // ========================================================================
    console.log('--- Test (d): Parallel Commit x 2 Idempotency Race (Fresh Member) ---');
    const memD = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_D', 100);

    const hold2 = (await pool.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 900) as res`, [RESTAURANT_ID, memD.phone])).rows[0].res;
    assert(hold2.success === true, `Test (d): Reserve must succeed, got: ${JSON.stringify(hold2)}`);
    const hold2Id = hold2.reservation_id;

    const [c1, c2] = await Promise.all([
      pool.query(`SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_PARALLEL_COMMIT_2') as res`, [RESTAURANT_ID, hold2Id]).then(r => r.rows[0].res),
      pool.query(`SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_PARALLEL_COMMIT_2') as res`, [RESTAURANT_ID, hold2Id]).then(r => r.rows[0].res)
    ]);

    assert(c1.success === true && c2.success === true, 'Both commit calls must succeed');
    assert(c1.idempotent === true || c2.idempotent === true, 'One of the concurrent commits must be marked idempotent');

    const dRedeemCount = parseInt((await pool.query(`SELECT COUNT(*) as cnt FROM public.loyalty_ledger WHERE member_id = $1 AND type = 'redeem'`, [memD.memberId])).rows[0].cnt);
    assert(dRedeemCount === 1, `Test (d): Expected exactly 1 'redeem' row, got ${dRedeemCount}`);

    const balD = parseInt((await pool.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memD.memberId])).rows[0].bal);
    assert(balD === 50, `Test (d): Points deducted once: balance must be 50 (100 - 50), got ${balD}`);
    console.log('✔ Passed Test (d): Concurrent commits returned idempotent=true; exactly 1 redeem row and 50 balance.\n');

    // ========================================================================
    // TEST (E): Parallel earn for brand-new phone
    // ========================================================================
    console.log('--- Test (e): Parallel Earn for Brand-New Phone ---');
    const CONC_NEW_PHONE = `+919999000${Math.floor(100 + Math.random() * 899)}`;
    const [newE1, newE2] = await Promise.all([
      pool.query(`SELECT public.fn_loyalty_earn_points($1, 'ORD_NEW_PHONE_A', $2, 20000, 'dine_in') as res`, [RESTAURANT_ID, CONC_NEW_PHONE]).then(r => r.rows[0].res),
      pool.query(`SELECT public.fn_loyalty_earn_points($1, 'ORD_NEW_PHONE_B', $2, 20000, 'dine_in') as res`, [RESTAURANT_ID, CONC_NEW_PHONE]).then(r => r.rows[0].res)
    ]);

    assert(newE1.success === true && newE2.success === true, 'Both earn calls for brand-new phone must succeed');
    const memberRows = await pool.query(`SELECT id FROM public.loyalty_members WHERE restaurant_id = $1 AND phone_e164 = $2`, [RESTAURANT_ID, CONC_NEW_PHONE]);
    assert(memberRows.rows.length === 1, `Expected exactly 1 member row created, got ${memberRows.rows.length}`);
    console.log('✔ Passed Test (e): Brand-new member provisioned cleanly without duplicate key error.\n');

    // ========================================================================
    // TEST (G): Concurrent Earn(with reservation) + Direct Commit (Deadlock Resistance)
    // ========================================================================
    console.log('--- Test (g): Concurrent Earn(with reservation) vs Direct Commit (Deadlock Safety) ---');
    const memG = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_G', 100);
    const deadRes = (await pool.query(`SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 900) as res`, [RESTAURANT_ID, memG.phone])).rows[0].res;
    assert(deadRes.success === true, 'Test (g): Reserve must succeed');
    const deadResId = deadRes.reservation_id;

    const [earnWithRes, directCommit] = await Promise.all([
      pool.query(`SELECT public.fn_loyalty_earn_points($1, 'ORD_DEADLOCK_EARN', $2, 20000, 'dine_in', $3) as res`, [RESTAURANT_ID, memG.phone, deadResId]).then(r => r.rows[0].res),
      pool.query(`SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_DEADLOCK_DIRECT') as res`, [RESTAURANT_ID, deadResId]).then(r => r.rows[0].res)
    ]);

    assert(earnWithRes.success === true, 'Earn with reservation must succeed');
    assert(directCommit.success === true, 'Direct commit must succeed');
    console.log('✔ Passed Test (g): Concurrent earn and direct commit completed without deadlock (unified lock order verified).\n');

    // ========================================================================
    // TEST (H): fn_petpooja_redeem Atomic Suite
    // ========================================================================
    console.log('--- Test (h): fn_petpooja_redeem Atomic Multi-Client Verification ---');
    const memH = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_H', 200);

    // 1. Idempotent retry returns the same reservation
    const ppR1 = (await pool.query(`SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_CONC_PP_01', 50, 40000, 10800) as res`, [RESTAURANT_ID, outletId, memH.phone])).rows[0].res;
    assert(ppR1.success === true, `fn_petpooja_redeem must succeed, got: ${JSON.stringify(ppR1)}`);
    assert(ppR1.idempotent === false, 'First redeem must be idempotent=false');
    const ppR1Id = ppR1.reservation_id;

    const ppR1Retry = (await pool.query(`SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_CONC_PP_01', 50, 40000, 10800) as res`, [RESTAURANT_ID, outletId, memH.phone])).rows[0].res;
    assert(ppR1Retry.success === true, 'Retry must succeed');
    assert(ppR1Retry.idempotent === true, 'Retry must return idempotent=true');
    assert(ppR1Retry.reservation_id === ppR1Id, 'Retry must return identical reservation_id');
    console.log('  ✔ Subtest 1: Idempotent retry returns identical reservation.');

    // 2. Changed points replaces the old hold and frees its points
    const ppR2Change = (await pool.query(`SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_CONC_PP_01', 80, 40000, 10800) as res`, [RESTAURANT_ID, outletId, memH.phone])).rows[0].res;
    assert(ppR2Change.success === true, 'Changed points redeem must succeed');
    assert(ppR2Change.points === 80, 'Points burned must be 80');
    assert(ppR2Change.reservation_id !== ppR1Id, 'New reservation must be generated');

    const oldHoldStatus = (await pool.query(`SELECT status FROM public.redemption_reservations WHERE id = $1`, [ppR1Id])).rows[0].status;
    assert(oldHoldStatus === 'released', `Old reservation must be 'released', got ${oldHoldStatus}`);

    const oldPpRowStatus = (await pool.query(`SELECT status FROM public.petpooja_redemptions WHERE id = $1`, [ppR1.redemption_id])).rows[0].status;
    assert(oldPpRowStatus === 'CANCELLED', `Old redemption row must be 'CANCELLED', got ${oldPpRowStatus}`);

    const balAfterChange = parseInt((await pool.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memH.memberId])).rows[0].bal);
    assert(balAfterChange === 120, `Balance must be 120 (200 - 80), got ${balAfterChange}`);
    console.log('  ✔ Subtest 2: Changed points replaced old hold, released points, and set status CANCELLED.');

    // 3. Two parallel redeems for the same invoice produce exactly one active redemption
    const memH2 = await createFreshMember(pool, RESTAURANT_ID, 'Mem_Test_H2', 200);
    const [pRedeem1, pRedeem2] = await Promise.all([
      pool.query(`SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_PARALLEL_PP_02', 50, 40000, 10800) as res`, [RESTAURANT_ID, outletId, memH2.phone]).then(r => r.rows[0].res),
      pool.query(`SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_PARALLEL_PP_02', 50, 40000, 10800) as res`, [RESTAURANT_ID, outletId, memH2.phone]).then(r => r.rows[0].res)
    ]);

    assert(pRedeem1.success === true && pRedeem2.success === true, 'Both parallel calls on same invoice must succeed');
    assert(pRedeem1.idempotent === true || pRedeem2.idempotent === true, 'One of the parallel redeems must be idempotent');
    assert(pRedeem1.reservation_id === pRedeem2.reservation_id, 'Both must reference the exact same reservation');

    const activeHeldCount = parseInt((await pool.query(`
      SELECT COUNT(*) as cnt FROM public.petpooja_redemptions 
      WHERE outlet_id = $1 AND invoice_no = 'INV_PARALLEL_PP_02' AND status = 'HELD'
    `, [outletId])).rows[0].cnt);
    assert(activeHeldCount === 1, `Expected exactly 1 active HELD redemption row, got ${activeHeldCount}`);
    console.log('  ✔ Subtest 3: Parallel redeems on same invoice resolved cleanly with 1 active redemption.');

    // 4. Redeem on a bill where reserve validation fails leaves no orphan rows
    const failRes = (await pool.query(`
      SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_ORPHAN_CHECK', 50, 5000, 10800) as res
    `, [RESTAURANT_ID, outletId, memH2.phone])).rows[0].res;
    assert(failRes.success === false, 'Redeem below min bill must fail');
    assert(failRes.error.code === 'MIN_BILL_NOT_MET', `Expected MIN_BILL_NOT_MET, got ${failRes.error.code}`);

    const orphanRows = parseInt((await pool.query(`
      SELECT COUNT(*) as cnt FROM public.petpooja_redemptions WHERE invoice_no = 'INV_ORPHAN_CHECK'
    `)).rows[0].cnt);
    assert(orphanRows === 0, `Expected 0 petpooja_redemptions rows on validation failure, got ${orphanRows}`);
    console.log('  ✔ Subtest 4: Validation failure left zero orphan rows.');

    // 5. Redeem followed by member balance equals expected
    const ppRBal = (await pool.query(`
      SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_BAL_CHECK_PP', 50, 40000, 10800) as res
    `, [RESTAURANT_ID, outletId, memH2.phone])).rows[0].res;
    assert(ppRBal.success === true, 'Redeem 50 pts must succeed');
    // memH2 had 200 - 50 (from parallel test) = 150; after 50 more, available balance is 100
    const balAfterPpBal = parseInt((await pool.query(`SELECT public.fn_loyalty_get_available_balance($1, $2) as bal`, [RESTAURANT_ID, memH2.memberId])).rows[0].bal);
    assert(balAfterPpBal === 100, `Expected balance 100 (150 - 50), got ${balAfterPpBal}`);
    console.log('  ✔ Subtest 5: Balance holds expected value (100) after redeem hold.\n');

    // ========================================================================
    // TEST (F): Invariant Checks
    // ========================================================================
    console.log('--- Test (f): Global Invariant Checks ---');
    const invRes = await pool.query(`
      WITH unexpired_ledger AS (
        SELECT COALESCE(SUM(remaining), 0) as total_remaining
        FROM public.loyalty_ledger
        WHERE remaining > 0 AND (expires_at IS NULL OR expires_at > NOW())
      ),
      active_res AS (
        SELECT COALESCE(SUM(points), 0) as total_reserved
        FROM public.redemption_reservations
        WHERE status = 'reserved' AND expires_at > NOW()
      )
      SELECT 
        (SELECT total_remaining FROM unexpired_ledger) as ledger_unexpired,
        (SELECT total_reserved FROM active_res) as total_reserved
    `);

    const { ledger_unexpired, total_reserved } = invRes.rows[0];
    assert(parseInt(ledger_unexpired) >= parseInt(total_reserved), 'Global ledger unexpired must cover total reserved');

    const negativeRemaining = await pool.query(`SELECT COUNT(*) as cnt FROM public.loyalty_ledger WHERE remaining < 0`);
    assert(parseInt(negativeRemaining.rows[0].cnt) === 0, `Invariant violation: ${negativeRemaining.rows[0].cnt} rows have negative remaining!`);
    console.log(`✔ Passed Test (f): Global invariants verified (ledger remaining: ${ledger_unexpired}, reserved: ${total_reserved}, 0 negative rows).\n`);

    // ========================================================================
    // PERMISSIONS AUDIT: Complete schema public privilege enumeration
    // ========================================================================
    console.log('--- Permissions & Privilege Audit (Complete Schema public Enumeration) ---');
    const procPrivs = await pool.query(`
      SELECT 
        p.proname,
        pg_get_function_identity_arguments(p.oid) as args,
        p.prosecdef as is_security_definer,
        p.provolatile,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_execute,
        has_function_privilege('public', p.oid, 'EXECUTE') as public_execute
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY p.proname, args;
    `);

    // List of functions that mutate state and MUST be revoked from anon/authenticated/public
    const mutatingSensitiveProcs = [
      'fn_loyalty_reserve_points',
      'fn_loyalty_commit_points',
      'fn_loyalty_release_points',
      'fn_loyalty_earn_points',
      'fn_loyalty_get_available_balance',
      'fn_loyalty_expire_points',
      'fn_expire_points',
      'fn_expire_all_points',
      'fn_petpooja_redeem',
      'increment_counter',
      'fn_seed_default_segments',
      'fn_sync_campaign_attributed_revenue'
    ];

    let mutatingPrivViolation = false;
    for (const r of procPrivs.rows) {
      const isSensitive = mutatingSensitiveProcs.includes(r.proname);
      if (isSensitive) {
        if (r.anon_execute || r.auth_execute || r.public_execute) {
          console.error(`  ❌ SECURITY FLAW: Mutating function ${r.proname}(${r.args}) is EXECUTABLE by anon=${r.anon_execute}, auth=${r.auth_execute}, public=${r.public_execute}`);
          mutatingPrivViolation = true;
        } else {
          console.log(`  ✔ Privilege locked: ${r.proname}(${r.args}) [service_role only]`);
        }
      }
    }
    assert(!mutatingPrivViolation, 'Sensitive mutating functions exposed to anon/authenticated/public execute!');

    // Connect as role anon and verify table read restrictions & RPC execution restrictions
    const anonClient = await pool.connect();
    try {
      await anonClient.query('SET ROLE anon');
      const tablesToCheck = [
        'loyalty_members',
        'loyalty_ledger',
        'petpooja_redemptions',
        'orders',
        'loyalty_earn_events',
        'petpooja_rewards',
        'outlets',
        'redemption_reservations'
      ];

      for (const table of tablesToCheck) {
        let readFailed = false;
        try {
          await anonClient.query(`SELECT * FROM public.${table} LIMIT 1`);
        } catch (e) {
          readFailed = true;
          assert(e.code === '42501', `Expected permission denied (42501), got ${e.code}`);
        }
        assert(readFailed, `Security flaw: role 'anon' was able to read public.${table}!`);
        console.log(`  ✔ Role 'anon' correctly blocked from reading public.${table} (42501)`);
      }

      // Assert anon cannot execute sensitive RPCs
      const rpcsToBlock = [
        { name: 'fn_loyalty_get_available_balance', sql: `SELECT public.fn_loyalty_get_available_balance($1, $2)`, args: [RESTAURANT_ID, memH.memberId] },
        { name: 'fn_petpooja_redeem', sql: `SELECT public.fn_petpooja_redeem($1, $2, $3, 'INV_TEST', 50, 40000)`, args: [RESTAURANT_ID, outletId, memH.phone] },
        { name: 'increment_counter', sql: `SELECT public.increment_counter('orders', 'points_earned_on_bill', $1)`, args: [memH.memberId] },
        { name: 'fn_seed_default_segments', sql: `SELECT public.fn_seed_default_segments($1)`, args: [RESTAURANT_ID] }
      ];

      for (const rpc of rpcsToBlock) {
        let rpcFailed = false;
        try {
          await anonClient.query(rpc.sql, rpc.args);
        } catch (e) {
          rpcFailed = true;
          assert(e.code === '42501', `Expected permission denied (42501) for ${rpc.name}, got ${e.code}`);
        }
        assert(rpcFailed, `Security flaw: role 'anon' was able to EXECUTE public.${rpc.name}!`);
        console.log(`  ✔ Role 'anon' correctly blocked from executing ${rpc.name} (42501)`);
      }
    } finally {
      await anonClient.query('RESET ROLE');
      anonClient.release();
    }

    console.log('\n================================================================');
    console.log('CONCURRENCY & PRIVILEGE SUITE SUMMARY');
    console.log(`  Total Checks Passed : ${checksPassed}`);
    console.log(`  Total Checks Failed : ${checksFailed}`);
    console.log('================================================================');

    if (checksFailed > 0) {
      console.error('\n❌ CONCURRENCY TEST FAILED: One or more assertions failed.\n');
      process.exit(1);
    }

    console.log('\n🎉 ALL CONCURRENCY AND PRIVILEGE ASSERTIONS PASSED PERFECTLY! 🎉\n');
  } finally {
    await pool.end();
    // Drop throwaway database
    console.log(`Cleaning up throwaway database: ${testDbName}...`);
    const cleanClient = new Client({
      connectionString: RAW_URL,
      connectionTimeoutMillis: 3000
    });
    try {
      await cleanClient.connect();
      await cleanClient.query(`DROP DATABASE IF EXISTS ${testDbName} WITH (FORCE);`);
      await cleanClient.end();
      console.log(`✔ Throwaway database dropped cleanly: ${testDbName}`);
    } catch (e) {
      console.error(`Warning: Failed to drop test database ${testDbName}: ${e.message}`);
    }
  }
}

run().catch(err => {
  console.error('\n❌ FATAL CONCURRENCY RUNNER FAILURE:', err);
  process.exit(1);
});
