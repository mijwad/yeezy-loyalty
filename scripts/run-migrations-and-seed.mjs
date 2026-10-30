import pg from 'pg';
const { Client } = pg;
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const RAW_URL = process.env.LOCAL_PG_URL || 'postgres://postgres:test@127.0.0.1:54329/postgres';

let parsedUrl;
try {
  parsedUrl = new URL(RAW_URL);
} catch (err) {
  console.error(`\n❌ INVALID URL: Could not parse connection string '${RAW_URL}': ${err.message}`);
  process.exit(1);
}

// Safety Guard: NEVER allow remote/production URLs
const ALLOWED_HOSTS = ['localhost', '127.0.0.1', '::1'];
if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
  console.error(`\n❌ SAFETY ABORT: Database host '${parsedUrl.hostname}' is NOT a permitted local address (${ALLOWED_HOSTS.join(', ')})!`);
  console.error('Do not touch production. Migrations and seeds must only run on local test databases.\n');
  process.exit(1);
}

function generateApiKey(restaurantId, name, isTest = false) {
  const prefix = isTest ? 'lk_test_' : 'lk_live_';
  const randomHex = crypto.randomBytes(32).toString('hex');
  const plaintextKey = `${prefix}${randomHex}`;
  const last4 = plaintextKey.slice(-4);
  const keyHash = crypto.createHash('sha256').update(plaintextKey).digest('hex');

  return {
    restaurantId,
    name,
    isTest,
    plaintextKey,
    keyPrefix: prefix,
    last4,
    keyHash,
    scopes: ['customers:read', 'customers:write', 'points:earn', 'points:redeem']
  };
}

async function main() {
  console.log('================================================================');
  console.log('YEEZY LOYALTY PLATFORM: LOCAL DB MIGRATIONS & SEED RUNNER');
  console.log(`Target: ${parsedUrl.hostname}:${parsedUrl.port || 5432}${parsedUrl.pathname}`);
  console.log('================================================================\n');

  const client = new Client({ connectionString: RAW_URL });
  await client.connect();
  console.log('✔ Connected to local PostgreSQL instance.');

  try {
    // 1. Roles & Mock Auth
    console.log('\n--- Step 1: Provisioning Supabase Roles & Auth Schema ---');
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
      END $$;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$ SELECT 'service_role'::text; $$ LANGUAGE sql;
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid; $$ LANGUAGE sql;
    `);
    console.log('✔ Roles (anon, authenticated, service_role) and auth schema ready.');

    // 2. Apply Migrations in Order
    console.log('\n--- Step 2: Applying Migrations in Chronological Order ---');
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
      await client.query(sql);
      console.log(`  ✔ Applied: ${m}`);
    }
    console.log('✔ All 13 migrations applied successfully.');

    // 3. Apply Seed Data
    console.log('\n--- Step 3: Seeding Database ---');

    // A. Production Seed SQL (Loyalty programs, members, ledger, customers, campaigns)
    const seedSqlPath = path.resolve('scripts/production_import.sql');
    if (fs.existsSync(seedSqlPath)) {
      const seedSql = fs.readFileSync(seedSqlPath, 'utf8');
      await client.query(seedSql);
      console.log('  ✔ Loaded seed data from scripts/production_import.sql');
    }

    // B. Outlets Seeding (if not present)
    const outletsRes = await client.query(`
      INSERT INTO public.outlets (tenant_id, name, pos_system, eatery_branch_code)
      VALUES 
        ('ten_yeezy_01', 'Downtown Bistro Main Outlet', 'PETPOOJA', 'BIZ_001'),
        ('ten_yeezy_01', 'Downtown Bistro Delivery Kitchen', 'PETPOOJA', 'BIZ_002'),
        ('ten_smokehouse_02', 'Smokehouse Delhi Indiranagar', 'PETPOOJA', 'SMK_001')
      ON CONFLICT (eatery_branch_code) WHERE pos_system = 'PETPOOJA' AND eatery_branch_code IS NOT NULL DO NOTHING
      RETURNING id, name, eatery_branch_code;
    `);
    console.log(`  ✔ Outlets verified/seeded (${outletsRes.rows.length} new/active).`);

    // C. Pilot API Keys
    const pilotRestaurants = [
      { id: 'ten_yeezy_01', name: 'Downtown Bistro (Live)', isTest: false },
      { id: 'ten_yeezy_01', name: 'Downtown Bistro (Test/Sandbox)', isTest: true },
      { id: 'ten_smokehouse_02', name: 'Smoke House Deli (Live)', isTest: false },
      { id: 'ten_smokehouse_02', name: 'Smoke House Deli (Test/Sandbox)', isTest: true }
    ];

    for (const pilot of pilotRestaurants) {
      const keyData = generateApiKey(pilot.id, pilot.name, pilot.isTest);
      await client.query(`
        INSERT INTO public.api_keys (
          restaurant_id, name, key_prefix, key_hash, last4, scopes, is_test, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (key_hash) DO NOTHING;
      `, [
        keyData.restaurantId,
        keyData.name,
        keyData.keyPrefix,
        keyData.keyHash,
        keyData.last4,
        keyData.scopes,
        keyData.isTest
      ]);
    }
    console.log('  ✔ Pilot API keys seeded.');

    // D. Petpooja Sample Catalog Rewards
    await client.query(`
      INSERT INTO public.petpooja_rewards (
        restaurant_id, name, points_required, discount_type, discount_value, min_bill_amount_paise, pos_item_id
      ) VALUES
        ('ten_yeezy_01', '10% Off Entire Bill', 100, 1, 10.0, 20000, NULL),
        ('ten_yeezy_01', 'Flat ₹150 Off', 150, 2, 150.0, 30000, NULL),
        ('ten_yeezy_01', 'Free Cold Coffee', 80, 3, 0.0, 10000, 'ITEM_COFFEE_01')
      ON CONFLICT DO NOTHING;
    `);
    console.log('  ✔ Petpooja sample rewards seeded.');

    // 4. Verification Counts
    console.log('\n--- Step 4: Verification of Database State ---');
    const tables = [
      'loyalty_programs',
      'loyalty_members',
      'loyalty_ledger',
      'outlets',
      'petpooja_rewards',
      'api_keys',
      'campaigns'
    ];

    const counts = [];
    for (const tbl of tables) {
      const res = await client.query(`SELECT count(*)::int as count FROM public.${tbl}`);
      counts.push({ Table: `public.${tbl}`, Rows: res.rows[0].count });
    }
    console.table(counts);

    console.log('\n🎉 ALL MIGRATIONS AND SEEDS EXECUTED SUCCESSFULLY ON LOCAL POSTGRES! 🎉\n');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('\n❌ MIGRATION / SEED RUNNER FAILURE:', err);
  process.exit(1);
});
