import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';

async function runWithout20261102() {
  console.log('=== RUN 1: Migrations up to 20261101 only (Demonstrating Bug) ===');
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
    'supabase/migrations/20261101_loyalty_rpc_hardening.sql'
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

  const mRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier, visit_count, lifetime_spend_paise)
    VALUES ('t1', '+919999000001', 'Test Member', 'Silver', 0, 0) RETURNING id;
  `);

  for (let i = 1; i <= 4; i++) {
    const res = await db.query(`
      SELECT public.fn_loyalty_earn_points('t1', 'ORD_ZERO_BUG', '+919999000001', 500, 'dine_in') as res;
    `);
    const mem = await db.query(`SELECT visit_count, lifetime_spend_paise FROM public.loyalty_members WHERE id = $1`, [mRes.rows[0].id]);
    console.log(`Call ${i}: visit_count=${mem.rows[0].visit_count}, spend=${mem.rows[0].lifetime_spend_paise}, response_idempotent=${res.rows[0].res.idempotent || false}`);
  }
}

async function runWith20261102() {
  console.log('\n=== RUN 2: All Migrations including 20261102 (Fixed via loyalty_earn_events) ===');
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

  const mRes = await db.query(`
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier, visit_count, lifetime_spend_paise)
    VALUES ('t1', '+919999000001', 'Test Member', 'Silver', 0, 0) RETURNING id;
  `);

  for (let i = 1; i <= 4; i++) {
    const res = await db.query(`
      SELECT public.fn_loyalty_earn_points('t1', 'ORD_ZERO_BUG', '+919999000001', 500, 'dine_in') as res;
    `);
    const mem = await db.query(`SELECT visit_count, lifetime_spend_paise FROM public.loyalty_members WHERE id = $1`, [mRes.rows[0].id]);
    console.log(`Call ${i}: visit_count=${mem.rows[0].visit_count}, spend=${mem.rows[0].lifetime_spend_paise}, response_idempotent=${res.rows[0].res.idempotent || false}`);
  }
}

async function main() {
  await runWithout20261102();
  await runWith20261102();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
