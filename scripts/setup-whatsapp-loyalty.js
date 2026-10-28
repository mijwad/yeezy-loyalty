#!/usr/bin/env node
/**
 * WhatsApp Loyalty Templates Setup Script
 *
 * This script helps restaurant owners:
 * 1. Connect their WhatsApp Business Account (Meta Cloud API)
 * 2. Provision all 6 loyalty system templates
 * 3. Verify template status with Meta
 *
 * Usage:
 *   node scripts/setup-whatsapp-loyalty.js <restaurant_id>
 *
 * Or with environment variables:
 *   RESTAURANT_ID=<id> node scripts/setup-whatsapp-loyalty.js
 *
 * Prerequisites:
 * - Meta Developer App created
 * - WhatsApp Business Account connected
 * - Phone number verified
 * - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env
 * - WHATSAPP_ACCESS_TOKEN, META_PHONE_NUMBER_ID, META_WABA_ID in .env
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { LoyaltyTemplateService, LOYALTY_EVENT_TYPES, LOYALTY_TEMPLATES } from '../server/whatsapp/loyaltyTemplates.js';
import { MetaWhatsAppClient } from '../server/whatsapp/metaClient.js';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}%s${colors.reset}`, message);
}

function success(message) { log(`✅ ${message}`, 'green'); }
function warn(message) { log(`⚠️  ${message}`, 'yellow'); }
function error(message) { log(`❌ ${message}`, 'red'); }
function info(message) { log(`ℹ️  ${message}`, 'blue'); }
function step(message) { log(`\n▶ ${message}`, 'cyan'); }

async function setupWhatsAppLoyalty(restaurantId) {
  log('\n╔══════════════════════════════════════════════════════════════╗', 'cyan');
  log('║  Yeezy Loyalty - WhatsApp Template Setup                    ║', 'cyan');
  log('║  Restaurant ID: ' + restaurantId.padEnd(43) + '║', 'cyan');
  log('╚══════════════════════════════════════════════════════════════╝\n', 'cyan');

  // 1. Verify environment variables
  step('1. Checking environment configuration...');

  const requiredEnv = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'WHATSAPP_ACCESS_TOKEN',
    'META_PHONE_NUMBER_ID',
    'META_WABA_ID'
  ];

  const missingEnv = requiredEnv.filter(key => !process.env[key]);
  if (missingEnv.length > 0) {
    error('Missing required environment variables:');
    missingEnv.forEach(key => console.log(`   - ${key}`));
    console.log('\nPlease add these to your .env file:');
    console.log(`
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WHATSAPP_ACCESS_TOKEN=your-meta-access-token
META_PHONE_NUMBER_ID=your-phone-number-id
META_WABA_ID=your-waba-id
META_WEBHOOK_APP_SECRET=your-webhook-secret (optional)
    `);
    process.exit(1);
  }
  success('Environment variables configured');

  // 2. Initialize Supabase client
  step('2. Connecting to Supabase...');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  success('Connected to Supabase');

  // 3. Verify restaurant exists
  step('3. Verifying restaurant...');
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, code, name, primary_contact_phone')
    .eq('id', restaurantId)
    .single();

  if (tenantError || !tenant) {
    error(`Restaurant not found: ${restaurantId}`);
    process.exit(1);
  }
  success(`Restaurant: ${tenant.name} (${tenant.code})`);

  // 4. Connect WhatsApp Business Account
  step('4. Connecting WhatsApp Business Account...');
  try {
    const waAccount = {
      tenant_id: restaurantId,
      phone_number_id: process.env.META_PHONE_NUMBER_ID,
      waba_id: process.env.META_WABA_ID,
      access_token: process.env.WHATSAPP_ACCESS_TOKEN,
      display_phone_number: tenant.primary_contact_phone,
      verified_name: tenant.name,
      status: 'CONNECTED',
      quality_rating: 'GREEN',
      webhook_secret: process.env.META_WEBHOOK_APP_SECRET
    };

    const { data: account, error: waError } = await supabase
      .from('wa_accounts')
      .upsert(waAccount, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (waError) throw waError;
    success('WhatsApp Business Account connected');
    info(`Phone Number ID: ${account.phone_number_id}`);
    info(`WABA ID: ${account.waba_id}`);
  } catch (err) {
    error(`Failed to connect WhatsApp account: ${err.message}`);
    process.exit(1);
  }

  // 5. Provision loyalty templates
  step('5. Provisioning loyalty system templates...');
  const service = new LoyaltyTemplateService(restaurantId);

  // Override the client to use our credentials
  const client = new MetaWhatsAppClient({
    restaurant_id: restaurantId,
    phone_number_id: process.env.META_PHONE_NUMBER_ID,
    waba_id: process.env.META_WABA_ID,
    access_token: process.env.WHATSAPP_ACCESS_TOKEN,
    webhook_secret: process.env.META_WEBHOOK_APP_SECRET,
    status: 'CONNECTED'
  });
  service.client = client;

  const results = await service.ensureAllSystemTemplates();

  console.log('\n  Template Provisioning Results:');
  console.log('  ┌──────────────────────────┬──────────┬────────────────────────────────────────┐');
  console.log('  │ Event Type               │ Status   │ Template Name                          │');
  console.log('  ├──────────────────────────┼──────────┼────────────────────────────────────────┤');

  for (const result of results) {
    const status = result.success ? '✅ OK' : '❌ FAIL';
    const name = result.template?.name || LOYALTY_TEMPLATES[result.eventType]?.name || 'N/A';
    console.log(`  │ ${result.eventType.padEnd(24)} │ ${status} │ ${name.padEnd(38)} │`);

    if (!result.success) {
      console.log(`  │ ${''.padEnd(24)} │         │ Error: ${result.error.padEnd(38)} │`);
    }
  }
  console.log('  └──────────────────────────┴──────────┴────────────────────────────────────────┘');

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  if (failed > 0) {
    warn(`${failed} template(s) failed to provision. Check Meta Business Manager for details.`);
  }

  // 6. Sync template statuses from Meta
  step('6. Syncing template statuses from Meta...');
  const syncResults = await service.syncAllTemplateStatuses();

  console.log('\n  Template Status Sync Results:');
  console.log('  ┌──────────────────────────┬──────────────┬────────────────────────────────────┐');
  console.log('  │ Template Name            │ Meta Status  │ Meta Template ID                   │');
  console.log('  ├──────────────────────────┼──────────────┼────────────────────────────────────┤');

  for (const sync of syncResults) {
    const statusColor = sync.status === 'APPROVED' ? 'green' :
                        sync.status === 'PENDING' ? 'yellow' : 'red';
    console.log(`  │ ${sync.template.padEnd(24)} │ ${colors[statusColor]}${sync.status.padEnd(12)}${colors.reset} │ ${sync.metaTemplateId || 'N/A'.padEnd(34)} │`);
    if (sync.rejectionReason) {
      console.log(`  │ ${''.padEnd(24)} │              │ Rejected: ${sync.rejectionReason.substring(0, 30).padEnd(34)} │`);
    }
  }
  console.log('  └──────────────────────────┴──────────────┴────────────────────────────────────┘');

  // 7. Show next steps
  step('7. Next Steps');
  info('Template provisioning complete!');
  console.log('\n  What happens next:');
  console.log('  1. Meta will review templates (usually 24-48 hours)');
  console.log('  2. Check status with: npm run whatsapp:sync');
  console.log('  3. Once APPROVED, you can send test messages');
  console.log('  4. Set up automated triggers in your POS integration\n');

  console.log('  Available API Endpoints:');
  console.log('  - GET  /api/whatsapp/templates/loyalty          # List all templates with status');
  console.log('  - POST /api/whatsapp/templates/loyalty/provision # Provision all templates');
  console.log('  - POST /api/whatsapp/templates/loyalty/sync      # Sync status from Meta');
  console.log('  - POST /api/whatsapp/templates/loyalty/test-send # Send test message\n');

  console.log('  Loyalty Event Templates (6 total):');
  Object.values(LOYALTY_EVENT_TYPES).forEach(eventType => {
    const t = LOYALTY_TEMPLATES[eventType];
    const categoryIcon = t.category === 'UTILITY' ? '📋' : '📢';
    console.log(`  ${categoryIcon} ${eventType}: ${t.name} (${t.category})`);
  });

  console.log('\n' + '═'.repeat(60));
  success('Setup complete!');
  log('═'.repeat(60) + '\n', 'cyan');
}

// Get restaurant ID from command line or env
const restaurantId = process.argv[2] || process.env.RESTAURANT_ID;

if (!restaurantId) {
  error('Restaurant ID required!');
  console.log('\nUsage:');
  console.log('  node scripts/setup-whatsapp-loyalty.js <restaurant_id>');
  console.log('  OR');
  console.log('  RESTAURANT_ID=<id> node scripts/setup-whatsapp-loyalty.js');
  process.exit(1);
}

setupWhatsAppLoyalty(restaurantId)
  .then(() => process.exit(0))
  .catch(err => {
    error(`Setup failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  });