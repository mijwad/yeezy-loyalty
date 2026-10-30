import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

async function testLateCommit() {
  const db = new PGlite();
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$ SELECT 'authenticated'::text; $$ LANGUAGE sql;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid; $$ LANGUAGE sql;
  `);

  for (const m of [
    'supabase/migrations/20261024_init_production_schema.sql',
    'supabase/migrations/20261025_points_expiry_function.sql',
    'supabase/migrations/20261026_pos_integration_tables.sql',
    'supabase/migrations/20261027_whatsapp_campaigns_module.sql',
    'supabase/migrations/20261028_whatsapp_webhook_events.sql',
    'supabase/migrations/20261030_petpooja_schema.sql',
    'supabase/migrations/20261031_fix_earn_points_idempotency.sql',
    'supabase/migrations/20261031120000_orders_outlet_id_not_null.sql',
    'supabase/migrations/20261101_loyalty_rpc_hardening.sql',
    'supabase/migrations/20261102_earn_events_and_late_commit.sql'
  ]) {
    let sql = fs.readFileSync(m, 'utf8');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/g, '-- skipped');
    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/g, '-- skipped');
    await db.exec(sql);
  }

  const RESTAURANT_ID = 'ten_late_commit';
  const PHONE = '+919999111122';

  await db.query(`
    INSERT INTO public.loyalty_programs (restaurant_id, is_active, config)
    VALUES ($1, true, '{
      "point_value_paise": 100,
      "earn": { "base_rate_bps": 500, "points_expiry_days": 90 },
      "redeem": { "min_points": 50, "min_bill_paise": 20000, "max_percent_of_bill": 50 }
    }')
  `, [RESTAURANT_ID]);

  const memRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, $2, 'Late Commit Member', 'Silver') RETURNING id
  `, [RESTAURANT_ID, PHONE]);
  const memberId = memRes.rows[0].id;

  // Member has 100 points
  await db.query(`
    INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
    VALUES ($1, $2, 'earn_base', 100, 100, NOW() + INTERVAL '90 days')
  `, [RESTAURANT_ID, memberId]);

  console.log('1. Member created with 100 points.');

  // Reserve 60 points with short TTL (900s)
  const res1 = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, $2, 60, 40000, 900) as res
  `, [RESTAURANT_ID, PHONE]);
  const r1Id = res1.rows[0].res.reservation_id;
  console.log('2. Reserved 60 points (R1):', r1Id);

  // Move expires_at 2 hours into the past
  await db.query(`
    UPDATE public.redemption_reservations
    SET expires_at = NOW() - INTERVAL '2 hours'
    WHERE id = $1
  `, [r1Id]);
  console.log('3. Moved R1 expires_at 2 hours into past.');

  const balAfterExpiry = await db.query(`
    SELECT public.fn_loyalty_get_available_balance($1, $2) as bal
  `, [RESTAURANT_ID, memberId]);
  console.log('4. Available balance after R1 expired:', balAfterExpiry.rows[0].bal);

  // Spend those points through another reserve + commit
  const res2 = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, $2, 60, 40000, 900) as res
  `, [RESTAURANT_ID, PHONE]);
  const r2Id = res2.rows[0].res.reservation_id;
  console.log('5. Reserved 60 points (R2):', r2Id);

  const commit2 = await db.query(`
    SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_SPEND_R2') as res
  `, [RESTAURANT_ID, r2Id]);
  console.log('6. Committed R2:', commit2.rows[0].res);

  const balAfterR2 = await db.query(`
    SELECT public.fn_loyalty_get_available_balance($1, $2) as bal
  `, [RESTAURANT_ID, memberId]);
  console.log('7. Available balance after committing R2:', balAfterR2.rows[0].bal);

  // Now attempt to commit original reservation R1
  const commit1 = await db.query(`
    SELECT public.fn_loyalty_commit_points($1, $2, 'ORD_LATE_R1') as res
  `, [RESTAURANT_ID, r1Id]);
  const commit1Result = commit1.rows[0].res;
  console.log('8. Result of late commit R1:', JSON.stringify(commit1Result, null, 2));

  // Assertions for late commit
  if (commit1Result.success !== false) {
    throw new Error('FAIL: Late commit with insufficient points should return success: false');
  }
  if (commit1Result.error?.code !== 'INSUFFICIENT_AT_LATE_COMMIT') {
    throw new Error(`FAIL: Expected error code INSUFFICIENT_AT_LATE_COMMIT, got ${commit1Result.error?.code}`);
  }
  console.log('✔ Correctly returned INSUFFICIENT_AT_LATE_COMMIT!');

  // Check ledger remaining values: no negative remaining
  const ledgerRows = await db.query(`
    SELECT id, type, points, remaining FROM public.loyalty_ledger WHERE member_id = $1
  `, [memberId]);
  console.log('9. Ledger rows:', ledgerRows.rows);
  for (const row of ledgerRows.rows) {
    if (row.remaining < 0) {
      throw new Error(`FAIL: Negative remaining detected in ledger row ${row.id}: ${row.remaining}`);
    }
  }
  console.log('✔ Invariant verified: zero negative remaining rows in loyalty_ledger.');

  // Test: earn passing this late reservation flags needs_review
  const earnWithLateRes = await db.query(`
    SELECT public.fn_loyalty_earn_points($1, 'ORD_EARN_LATE_RES', $2, 30000, 'dine_in', $3) as res
  `, [RESTAURANT_ID, PHONE, r1Id]);
  const earnData = earnWithLateRes.rows[0].res;
  if (!earnData.needs_review) {
    throw new Error('FAIL: Earn with failed late commit must set needs_review: true');
  }
  if (earnData.redemption_commit?.error?.code !== 'INSUFFICIENT_AT_LATE_COMMIT') {
    throw new Error(`FAIL: Expected redemption_commit.error.code = INSUFFICIENT_AT_LATE_COMMIT, got ${earnData.redemption_commit?.error?.code}`);
  }
  console.log('✔ Earn with failed late commit correctly flagged needs_review: true and passed redemption_commit error.');

  // --------------------------------------------------------------------------
  // TEST: TTL differences (10800s vs 900s 60 minutes later)
  // --------------------------------------------------------------------------
  console.log('\n--- Testing TTL duration on available balance 60 minutes later ---');
  const TTL_PHONE = '+919999333444';
  const ttlMember = (await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES ($1, $2, 'TTL Test Member', 'Silver') RETURNING id
  `, [RESTAURANT_ID, TTL_PHONE])).rows[0].id;

  // Add 200 points
  await db.query(`
    INSERT INTO public.loyalty_ledger (restaurant_id, member_id, type, points, remaining, expires_at)
    VALUES ($1, $2, 'earn_base', 200, 200, NOW() + INTERVAL '90 days')
  `, [RESTAURANT_ID, ttlMember]);

  // Reservation A: 10800 seconds (3 hours)
  const res3hr = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 10800) as res
  `, [RESTAURANT_ID, TTL_PHONE]);
  const res3hrId = res3hr.rows[0].res.reservation_id;

  // Reservation B: 900 seconds (15 minutes)
  const res15min = await db.query(`
    SELECT public.fn_loyalty_reserve_points($1, $2, 50, 40000, 900) as res
  `, [RESTAURANT_ID, TTL_PHONE]);
  const res15minId = res15min.rows[0].res.reservation_id;

  // Fast forward both reservations by 60 minutes (1 hour)
  await db.query(`
    UPDATE public.redemption_reservations
    SET expires_at = expires_at - INTERVAL '60 minutes'
    WHERE id IN ($1, $2)
  `, [res3hrId, res15minId]);

  // Check available balance
  const bal60minLater = (await db.query(`
    SELECT public.fn_loyalty_get_available_balance($1, $2) as bal
  `, [RESTAURANT_ID, ttlMember])).rows[0].bal;

  // Starting balance was 200.
  // 3hr reservation had 3h - 1h = 2h left (> NOW()) -> still holds 50 points.
  // 15min reservation had 15m - 60m = -45m (< NOW()) -> expired, does NOT hold points.
  // Expected available balance: 200 - 50 = 150 points.
  console.log(`Available balance 60 minutes after reservations: ${bal60minLater} points (Expected: 150)`);
  if (bal60minLater !== 150) {
    throw new Error(`FAIL: Expected available balance 150, but got ${bal60minLater}`);
  }
  console.log('✔ Verified: 10800s TTL reservation still holds points 60 mins later; 900s TTL does not!');
}

testLateCommit().catch(err => {
  console.error(err);
  process.exit(1);
});
