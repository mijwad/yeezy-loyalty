import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

export interface GeneratedApiKey {
  restaurantId: string;
  name: string;
  isTest: boolean;
  plaintextKey: string;
  keyPrefix: string;
  last4: string;
  keyHash: string;
  scopes: string[];
}

export function generateApiKey(restaurantId: string, name: string, isTest: boolean = false): GeneratedApiKey {
  const prefix = isTest ? 'lk_test_' : 'lk_live_';
  // 32 random bytes -> 64 hex characters
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

export async function seedPilotKeys(dbClient?: any): Promise<GeneratedApiKey[]> {
  console.log('============================================================');
  console.log('      YEEZY LOYALTY PLATFORM: PILOT API KEY GENERATOR       ');
  console.log('============================================================\n');

  const pilotRestaurants = [
    { id: 'ten_yeezy_01', name: 'Downtown Bistro (Live)', isTest: false },
    { id: 'ten_yeezy_01', name: 'Downtown Bistro (Test/Sandbox)', isTest: true },
    { id: 'ten_smokehouse_02', name: 'Smoke House Deli (Live)', isTest: false },
    { id: 'ten_smokehouse_02', name: 'Smoke House Deli (Test/Sandbox)', isTest: true },
  ];

  const generatedKeys: GeneratedApiKey[] = [];

  const db = dbClient || new PGlite();
  if (!dbClient) {
    const migrationSql = fs.readFileSync(path.resolve('supabase/migrations/20261024_init_production_schema.sql'), 'utf8');
    await db.exec(migrationSql);
  }

  for (const pilot of pilotRestaurants) {
    const keyData = generateApiKey(pilot.id, pilot.name, pilot.isTest);
    generatedKeys.push(keyData);

    await db.query(`
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

  console.log('IMPORTANT: The following plaintext API keys are shown ONCE. The database stores ONLY their SHA-256 hash.\n');
  console.table(generatedKeys.map(k => ({
    Restaurant: k.restaurantId,
    Name: k.name,
    Prefix: k.keyPrefix,
    Last4: k.last4,
    PlaintextKey: k.plaintextKey
  })));

  if (!dbClient) {
    await db.close();
  }

  return generatedKeys;
}

if (process.argv[1]?.endsWith('seed-pilot-api-keys.ts') || process.argv[1]?.endsWith('seed-pilot-api-keys.js')) {
  seedPilotKeys()
    .then(() => {
      console.log('Pilot API keys generated and hashed successfully.');
    })
    .catch((err) => {
      console.error('Error seeding pilot API keys:', err);
      process.exit(1);
    });
}
