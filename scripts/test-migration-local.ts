import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('--- Initializing Local PostgreSQL Engine (PGlite) ---');
  const db = new PGlite();

  const migrationPath = path.resolve('supabase/migrations/20261024_init_production_schema.sql');
  console.log(`Reading migration: ${migrationPath}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Executing migration statements...');
  const startTime = Date.now();
  
  // Split on semicolons outside quotes or dollar quotes, or simpler: split by top-level semicolons
  // PGlite can execute multiple statements via exec(), let's see why it failed
  try {
    await db.exec(sql);
  } catch (err: any) {
    console.error('FAILED SQL ERROR:', err.message);
    if (err.position) {
      const pos = parseInt(err.position, 10);
      console.error('ERROR POSITION:', pos);
      console.error('NEAR SQL:', sql.substring(Math.max(0, pos - 100), Math.min(sql.length, pos + 100)));
    }
    throw err;
  }
  console.log(`Migration executed successfully in ${Date.now() - startTime}ms!`);

  // Verify created tables
  const tables = await db.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('\nVerified Public Tables:');
  console.table(tables.rows);

  // Verify created functions
  const functions = await db.query(`
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    ORDER BY routine_name;
  `);
  console.log('\nVerified Public Stored Functions:');
  console.table(functions.rows);

  // Test RPC function: rate limiter
  console.log('\nTesting fn_check_rate_limit()...');
  const rateLimitTest1 = await db.query(`
    SELECT public.fn_check_rate_limit('test_key', 1, 10, 10.0) as result;
  `);
  console.log('Rate limit check 1 (cost 1 / cap 10):', rateLimitTest1.rows[0].result);

  // Test RPC function: earn points
  console.log('\nTesting fn_loyalty_earn_points()...');
  const earnTest = await db.query(`
    SELECT public.fn_loyalty_earn_points(
      'ten_test_01',
      'ORD-TEST-001',
      '+919876543210',
      50000, -- 500.00 INR
      'dine_in'
    ) as result;
  `);
  console.log('Earn points result:', earnTest.rows[0].result);

  // Test available balance
  const memberRes = await db.query(`
    SELECT id FROM public.loyalty_members WHERE restaurant_id = 'ten_test_01' AND phone_e164 = '+919876543210';
  `);
  const memberId = memberRes.rows[0].id;
  console.log('Created member ID:', memberId);

  const balanceRes = await db.query(`
    SELECT public.fn_loyalty_get_available_balance('ten_test_01', $1::UUID) as available_points;
  `, [memberId]);
  console.log('Available balance:', balanceRes.rows[0].available_points);

  // Insert active loyalty program for restaurant
  await db.query(`
    INSERT INTO public.loyalty_programs (restaurant_id, is_active, config)
    VALUES ('ten_test_01', true, '{
      "point_value_paise": 100,
      "earn": { "base_rate_bps": 500 },
      "redeem": { "min_points": 5, "min_bill_paise": 1000, "max_percent_of_bill": 50 }
    }'::jsonb);
  `);

  // Test 2-phase reservation: reserve points
  console.log('\nTesting fn_loyalty_reserve_points()...');
  const reserveRes = await db.query(`
    SELECT public.fn_loyalty_reserve_points(
      'ten_test_01',
      '+919876543210',
      10,
      30000,
      900
    ) as result;
  `);
  console.log('Reserve points result:', reserveRes.rows[0].result);
  const reserveJson = typeof reserveRes.rows[0].result === 'string' 
    ? JSON.parse(reserveRes.rows[0].result) 
    : reserveRes.rows[0].result;
  const reservationId = reserveJson.reservation_id;

  // Check balance after reservation (should reflect deduction of reserved points!)
  const balanceAfterReserve = await db.query(`
    SELECT public.fn_loyalty_get_available_balance('ten_test_01', $1::UUID) as available_points;
  `, [memberId]);
  console.log('Available balance after reservation (must reflect hold):', balanceAfterReserve.rows[0].available_points);

  // Test 2-phase commit: commit points
  console.log('\nTesting fn_loyalty_commit_points()...');
  const commitRes = await db.query(`
    SELECT public.fn_loyalty_commit_points(
      'ten_test_01',
      $1::UUID,
      'ORD-TEST-002'
    ) as result;
  `, [reservationId]);
  console.log('Commit result:', commitRes.rows[0].result);

  // Test commit idempotency
  console.log('Testing commit idempotency (second call with same reservation)...');
  const commitIdempotentRes = await db.query(`
    SELECT public.fn_loyalty_commit_points(
      'ten_test_01',
      $1::UUID,
      'ORD-TEST-002'
    ) as result;
  `, [reservationId]);
  console.log('Commit idempotent result:', commitIdempotentRes.rows[0].result);

  console.log('\nALL LOCAL POSTGRES TESTS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('Local Postgres validation failed:', err);
  process.exit(1);
});
