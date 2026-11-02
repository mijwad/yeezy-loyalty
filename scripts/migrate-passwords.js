// One-time Migration: Ensure all users in Supabase have proper bcrypt password hashes
// Run this ONCE to migrate existing users, then remove
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function migratePasswords() {
  console.log('🔍 Fetching all users from tenant_users...');

  const { data: users, error } = await supabase
    .from('tenant_users')
    .select('id, email, full_name, role, password_hash')
    .is('password_hash', null); // Users WITHOUT proper bcrypt hash

  if (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('✅ All users already have proper bcrypt hashes. No migration needed.');
    process.exit(0);
  }

  console.log(`📋 Found ${users.length} users without proper password hash:`);
  users.forEach(u => console.log(`   - ${u.email} (${u.role})`));

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    let passwordToHash = null;
    let source = '';

    // Check legacy password field first
    if (user.password && typeof user.password === 'string' && user.password.length > 0) {
      passwordToHash = user.password;
      source = 'legacy password field';
    }
    // Fallback: determine default based on role
    else if (user.role === 'SUPER_ADMIN') {
      passwordToHash = 'admin123';
      source = 'SUPER_ADMIN default';
    }
    else {
      passwordToHash = 'owner123';
      source = 'RESTAURANT_OWNER default';
    }

    // Hash the password
    const hash = bcrypt.hashSync(passwordToHash, 10);

    // Update in Supabase
    const { error: updateError } = await supabase
      .from('tenant_users')
      .update({
        password_hash: hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(`❌ Failed to migrate ${user.email}:`, updateError.message);
      skipped++;
    } else {
      console.log(`✅ Migrated ${user.email} (password from: ${source})`);
      migrated++;
    }
  }

  console.log(`\n📊 Migration complete: ${migrated} migrated, ${skipped} skipped`);

  if (migrated > 0) {
    console.log('\n⚠️  IMPORTANT: Users with default passwords should change them on first login!');
    console.log('   - SUPER_ADMIN users: password is "admin123"');
    console.log('   - RESTAURANT_OWNER users: password is "owner123"');
  }
}

migratePasswords().then(() => process.exit(0)).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});