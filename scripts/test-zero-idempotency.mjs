import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

async function test() {
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

  await db.query(`
    INSERT INTO public.loyalty_programs (restaurant_id, is_active, config)
    VALUES ('t1', true, '{"point_value_paise": 100, "earn": {"base_rate_bps": 500, "points_expiry_days": 90}}');
  `);

  // Member with visit_count = 4, Silver
  const mRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier, visit_count, lifetime_spend_paise)
    VALUES ('t1', '+919876543210', 'Test User', 'Silver', 4, 10000)
    RETURNING id;
  `);

  console.log('Initial member: visit_count=4, tier=Silver, lifetime_spend_paise=10000');

  // Call 1: 500 paise (0 points)
  const r1 = await db.query(`SELECT public.fn_loyalty_earn_points('t1', 'ORD_ZERO_1', '+919876543210', 500, 'dine_in') as res`);
  console.log('Call 1 result:', r1.rows[0].res);

  // Retry 1: 500 paise with same order_id
  const r2 = await db.query(`SELECT public.fn_loyalty_earn_points('t1', 'ORD_ZERO_1', '+919876543210', 500, 'dine_in') as res`);
  console.log('Call 2 result (Retry 1):', r2.rows[0].res);

  // Retry 2: 500 paise with same order_id
  const r3 = await db.query(`SELECT public.fn_loyalty_earn_points('t1', 'ORD_ZERO_1', '+919876543210', 500, 'dine_in') as res`);
  console.log('Call 3 result (Retry 2):', r3.rows[0].res);

  // Retry 3: 500 paise with same order_id
  const r4 = await db.query(`SELECT public.fn_loyalty_earn_points('t1', 'ORD_ZERO_1', '+919876543210', 500, 'dine_in') as res`);
  console.log('Call 4 result (Retry 3):', r4.rows[0].res);

  const mem = await db.query(`SELECT visit_count, lifetime_spend_paise, tier FROM public.loyalty_members WHERE id = $1`, [mRes.rows[0].id]);
  console.log('Final member state in DB:', mem.rows[0]);

  // Assertions
  if (mem.rows[0].visit_count !== 5) {
    throw new Error(`FAIL: visit_count should be 5, but got ${mem.rows[0].visit_count}`);
  }
  if (mem.rows[0].lifetime_spend_paise !== 10500) {
    throw new Error(`FAIL: lifetime_spend_paise should be 10500, but got ${mem.rows[0].lifetime_spend_paise}`);
  }
  if (mem.rows[0].tier !== 'Silver') {
    throw new Error(`FAIL: tier should still be Silver, but got ${mem.rows[0].tier}`);
  }
  console.log('SUCCESS: All assertions passed!');
}

test().catch(err => {
  console.error(err.message);
  process.exit(1);
});
