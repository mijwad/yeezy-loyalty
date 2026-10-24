import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateApiKey } from './seed-pilot-api-keys.ts';

const BACKUP_FILE = path.resolve('server/data/db.json.bak');
const OUTPUT_SQL = path.resolve('scripts/production_import.sql');

const TENANT_MAPPINGS: Record<string, string> = {
  '00000000-0000-0000-0000-000000000001': 'ten_yeezy_01',
  '00000000-0000-0000-0000-000000000002': 'ten_smokehouse_02'
};

function normalizeRestaurantId(rawId: string | null | undefined): string {
  if (!rawId) return 'ten_yeezy_01';
  return TENANT_MAPPINGS[rawId] || rawId;
}

function stringToUuid(prefix: string, id: string): string {
  const hash = crypto.createHash('md5').update(`${prefix}:${id}`).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join('-');
}

function escapeSql(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''")}'`;
}

function main() {
  const rawData = fs.readFileSync(BACKUP_FILE, 'utf8');
  const backup = JSON.parse(rawData);

  const lines: string[] = [
    '-- ============================================================================',
    '-- PRODUCTION DATA IMPORT & VERIFICATION SCRIPT',
    '-- ============================================================================',
    'BEGIN;',
    ''
  ];

  // 1. Programs
  lines.push('-- 1. LOYALTY PROGRAMS');
  for (const [rawRestId, prog] of Object.entries(backup.loyaltyPrograms || {}) as [string, any][]) {
    const restaurantId = normalizeRestaurantId(rawRestId);
    const configStr = escapeSql(JSON.stringify(prog.config || {}));
    lines.push(`
INSERT INTO public.loyalty_programs (restaurant_id, is_active, config, created_at, updated_at)
VALUES (${escapeSql(restaurantId)}, ${prog.is_active ?? true}, ${configStr}::jsonb, ${escapeSql(prog.created_at || new Date().toISOString())}, ${escapeSql(prog.updated_at || new Date().toISOString())})
ON CONFLICT (restaurant_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  config = EXCLUDED.config,
  updated_at = EXCLUDED.updated_at;
`);
  }

  // 2. Members
  lines.push('-- 2. LOYALTY MEMBERS');
  const memberIdMap = new Map<string, string>();
  for (const mem of backup.loyaltyMembers || []) {
    const restaurantId = normalizeRestaurantId(mem.restaurant_id);
    const memberUuid = stringToUuid('member', mem.id || mem.phone_e164);
    memberIdMap.set(mem.id, memberUuid);

    lines.push(`
INSERT INTO public.loyalty_members (
  id, restaurant_id, phone_e164, name, tier, visit_count,
  lifetime_spend_paise, last_visit_at, joined_at, created_at, updated_at
) VALUES (
  ${escapeSql(memberUuid)}::uuid,
  ${escapeSql(restaurantId)},
  ${escapeSql(mem.phone_e164)},
  ${escapeSql(mem.name)},
  ${escapeSql(mem.tier || 'Silver')},
  ${mem.visit_count || 0},
  ${mem.lifetime_spend_paise || 0},
  ${escapeSql(mem.last_visit_at)},
  ${escapeSql(mem.joined_at || new Date().toISOString())},
  ${escapeSql(mem.joined_at || new Date().toISOString())},
  NOW()
) ON CONFLICT (restaurant_id, phone_e164) DO UPDATE SET
  name = EXCLUDED.name,
  tier = EXCLUDED.tier,
  visit_count = EXCLUDED.visit_count,
  lifetime_spend_paise = EXCLUDED.lifetime_spend_paise,
  last_visit_at = EXCLUDED.last_visit_at,
  updated_at = EXCLUDED.updated_at;
`);
  }

  // 3. Ledger
  lines.push('-- 3. LOYALTY LEDGER');
  for (const entry of backup.loyaltyLedger || []) {
    const restaurantId = normalizeRestaurantId(entry.restaurant_id);
    const targetMemberUuid = memberIdMap.get(entry.member_id) || stringToUuid('member', entry.member_id);
    const ledgerUuid = stringToUuid('ledger', entry.id);
    const metaStr = escapeSql(JSON.stringify(entry.meta || {}));

    lines.push(`
INSERT INTO public.loyalty_ledger (
  id, restaurant_id, member_id, order_id, type, points, remaining, expires_at, meta, created_at
) VALUES (
  ${escapeSql(ledgerUuid)}::uuid,
  ${escapeSql(restaurantId)},
  ${escapeSql(targetMemberUuid)}::uuid,
  ${escapeSql(entry.order_id)},
  ${escapeSql(entry.type)}::loyalty_ledger_entry_type,
  ${entry.points},
  ${entry.remaining || 0},
  ${escapeSql(entry.expires_at)},
  ${metaStr}::jsonb,
  ${escapeSql(entry.created_at || new Date().toISOString())}
) ON CONFLICT (id) DO NOTHING;
`);
  }

  // 4. Multiplier Rules
  lines.push('-- 4. MULTIPLIER RULES');
  for (const rule of backup.loyaltyMultiplierRules || []) {
    const restaurantId = normalizeRestaurantId(rule.restaurant_id);
    const daysArr = rule.days_of_week ? `ARRAY[${rule.days_of_week.join(',')}]::int[]` : `ARRAY[0,1,2,3,4,5,6]::int[]`;

    lines.push(`
INSERT INTO public.loyalty_multiplier_rules (
  id, restaurant_id, name, multiplier, start_time, end_time, days_of_week, start_date, end_date, is_active, created_at
) VALUES (
  ${escapeSql(rule.id)},
  ${escapeSql(restaurantId)},
  ${escapeSql(rule.name)},
  ${rule.multiplier || 1.0},
  ${escapeSql(rule.start_time)},
  ${escapeSql(rule.end_time)},
  ${daysArr},
  ${escapeSql(rule.start_date)},
  ${escapeSql(rule.end_date)},
  ${rule.is_active ?? true},
  NOW()
) ON CONFLICT (restaurant_id, id) DO UPDATE SET
  name = EXCLUDED.name,
  multiplier = EXCLUDED.multiplier,
  start_time = EXCLUDED.start_time,
  end_time = EXCLUDED.end_time,
  days_of_week = EXCLUDED.days_of_week,
  is_active = EXCLUDED.is_active;
`);
  }

  // 5. Pilot API Keys
  lines.push('-- 5. PILOT API KEYS');
  const pilotRestaurants = [
    { id: 'ten_yeezy_01', name: 'Downtown Bistro (Live)', isTest: false },
    { id: 'ten_yeezy_01', name: 'Downtown Bistro (Test/Sandbox)', isTest: true },
    { id: 'ten_smokehouse_02', name: 'Smoke House Deli (Live)', isTest: false },
    { id: 'ten_smokehouse_02', name: 'Smoke House Deli (Test/Sandbox)', isTest: true },
  ];

  const generatedKeys: any[] = [];
  for (const pilot of pilotRestaurants) {
    const key = generateApiKey(pilot.id, pilot.name, pilot.isTest);
    generatedKeys.push(key);
    lines.push(`
INSERT INTO public.api_keys (
  restaurant_id, name, key_prefix, key_hash, last4, scopes, is_test, created_at
) VALUES (
  ${escapeSql(key.restaurantId)},
  ${escapeSql(key.name)},
  ${escapeSql(key.keyPrefix)},
  ${escapeSql(key.keyHash)},
  ${escapeSql(key.last4)},
  ARRAY['customers:read', 'customers:write', 'points:earn', 'points:redeem']::text[],
  ${key.isTest},
  NOW()
) ON CONFLICT (key_hash) DO NOTHING;
`);
  }

  lines.push('COMMIT;');

  fs.writeFileSync(OUTPUT_SQL, lines.join('\n'));
  console.log(`Generated SQL import file: ${OUTPUT_SQL}`);
  console.log('Plaintext API keys for pilot restaurants:');
  console.table(generatedKeys.map(k => ({
    Restaurant: k.restaurantId,
    Name: k.name,
    PlaintextKey: k.plaintextKey
  })));
}

main();
