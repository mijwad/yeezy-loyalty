// Super Admin Management Router - Uses new store module with Supabase
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, queryWithBreaker } from '../db/supabase.js';
import { createRestaurantTenant, setTenantStatus, deleteTenant, syncWithSupabase } from '../db/store.js';
import { DEFAULT_LOYALTY_CONFIG } from '../../lib/loyalty/config.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';

export const adminRouter = Router();

// Deterministic UUID converter for Supabase tenants table
function toUuid(str) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
    return str.toLowerCase();
  }
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

// Known pilot keys
const PILOT_KEYS = {
  'ten_yeezy_01': 'lk_live_6b6f34465f168ee1d824915e5c0cb1c7cf1224b998eba8f1005e6e0d6fd9b194',
  'ten_smokehouse_02': 'lk_live_730ba5b943263d58c363b5605a9ffc3bdbfa739274e9e6ba58d4c872ce4eabbb',
  'ten_durbar_mvnrq6po': 'lk_live_c511_durbar_cafe_live_pos_key_2026_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d',
  'ten_durbar_mvsfe21f': 'lk_live_tendurbarmvsfe21f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d',
  'ten_farzi_mvnvc99o': 'lk_live_0049_farzi_cafe_pos_key_2026_9bca1234567890abcdef1234567890abcdef'
};

// Helper: Fetch all tenants with owners and outlets from Supabase
async function fetchTenantsWithDetails() {
  if (!supabaseAdmin) return [];

  const { data: tenants } = await queryWithBreaker(() => supabaseAdmin
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })
  );

  if (!tenants || tenants.length === 0) return [];

  // Fetch all users
  const { data: users } = await queryWithBreaker(() => supabaseAdmin
    .from('tenant_users')
    .select('*')
  );

  // Fetch all outlets
  const { data: outlets } = await queryWithBreaker(() => supabaseAdmin
    .from('outlets')
    .select('*')
  );

  // Fetch all loyalty programs
  const { data: programs } = await queryWithBreaker(() => supabaseAdmin
    .from('loyalty_programs')
    .select('restaurant_id, is_active, config')
  );

  const usersByTenant = (users || []).reduce((acc, u) => {
    const key = u.tenant_id || u.id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  const outletsByTenant = (outlets || []).reduce((acc, o) => {
    const key = o.tenant_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {});

  const programsByTenant = (programs || []).reduce((acc, p) => {
    acc[p.restaurant_id] = p;
    return acc;
  }, {});

  return tenants.map(t => {
    const tenantUsers = usersByTenant[t.id] || usersByTenant[t.code] || [];
    const owner = tenantUsers.find(u => u.role === 'BRAND_OWNER' || u.role === 'RESTAURANT_OWNER') || tenantUsers[0];
    const tenantOutlets = outletsByTenant[t.id] || [];
    const program = programsByTenant[t.id];

    const apiKey = PILOT_KEYS[t.id] || t.apiKey || `lk_live_${t.id.replace(/[^a-z0-9]/g, '')}9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d`;
    const isActive = t.active !== false && t.status !== 'INACTIVE' && t.status !== 'SUSPENDED';

    return {
      ...t,
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      active: isActive,
      apiKey,
      ownerName: t.owner_name || owner?.full_name || `${t.name} Owner`,
      ownerEmail: t.owner_email || owner?.email || `${t.id}@restaurant.com`,
      defaultPassword: (t.owner_email === 'durbar@gmail.com' || t.id === 'ten_durbar_mvsfe21f') ? '12345678' : 'owner123',
      owner: owner ? {
        id: owner.id,
        name: owner.full_name,
        email: owner.email,
        role: owner.role
      } : null,
      outlets: tenantOutlets,
      loyaltyProgram: program
    };
  });
}

// GET /api/v1/admin/restaurants - List all restaurants & owner accounts
adminRouter.get('/restaurants', async (req, res) => {
  // Sync with persistent Supabase database
  await syncWithSupabase();

  const enriched = await fetchTenantsWithDetails();

  const totalDiners = enriched.reduce((sum, t) => sum + (t.totalDiners || 0), 0);
  const totalSales = enriched.reduce((sum, t) => sum + (t.lifetimeSales || 0), 0);
  const activeTenantsCount = enriched.filter(t => t.active).length;

  return res.json({
    status: 'success',
    totalRestaurants: enriched.length,
    activeRestaurants: activeTenantsCount,
    globalStats: {
      totalRestaurants: enriched.length,
      activeRestaurants: activeTenantsCount,
      totalOutlets: enriched.reduce((sum, t) => sum + (t.outlets?.length || 0), 0),
      globalDiners: totalDiners,
      globalSales: totalSales
    },
    restaurants: enriched
  });
});

// POST /api/v1/admin/restaurants - Super Admin creates new restaurant and owner
adminRouter.post('/restaurants', requireAuth, requireSuperAdmin, async (req, res) => {
  const { brandName, ownerName, ownerEmail, password, primaryOutletName, petpoojaRestID } = req.body;

  if (!brandName || !ownerName || !ownerEmail) {
    return res.status(400).json({ status: 'error', message: 'brandName, ownerName, and ownerEmail are required' });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ status: 'error', message: 'Password must be at least 8 characters' });
  }

  try {
    const result = await createRestaurantTenant({
      brandName,
      ownerName,
      ownerEmail,
      password,
      primaryOutletName,
      petpoojaRestID
    });

    const tenant = result.tenant;

    // Generate real cryptographic API Key
    const rawApiKey = `lk_live_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
    const keyPrefix = rawApiKey.slice(0, 12);
    const keyLast4 = rawApiKey.slice(-4);

    // Persist API key to Supabase
    if (supabaseAdmin) {
      try {
        const tenantUuid = toUuid(tenant.id);
        const contactPhone = req.body.ownerPhone || req.body.phone || '+919876543210';

        await Promise.all([
          supabaseAdmin.from('api_keys').insert({
            restaurant_id: tenant.id,
            name: `${brandName.trim()} (Live POS)`,
            key_prefix: keyPrefix,
            key_hash: keyHash,
            last4: keyLast4,
            scopes: ['customers:read', 'customers:write', 'points:earn', 'points:redeem'],
            is_test: false
          })
        ]);
        console.log(`[Supabase Admin] Successfully persisted API key for ${tenant.id}.`);
      } catch (sbErr) {
        console.error('[Supabase Admin] Error persisting API key:', sbErr.message);
      }
    }

    return res.status(201).json({
      status: 'success',
      message: `Restaurant '${brandName}' created! Owner can login with '${ownerEmail}' (Password: ${password})`,
      data: {
        ...result,
        apiKey: rawApiKey,
        credentials: {
          email: ownerEmail.trim().toLowerCase(),
          brandName: brandName.trim(),
          ownerName: ownerName.trim(),
          password
        }
      }
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/admin/impersonate/:tenantId - Super Admin switches into restaurant
adminRouter.post('/impersonate/:tenantId', requireAuth, requireSuperAdmin, async (req, res) => {
  const targetId = req.params.tenantId;

  // Fetch tenant from Supabase
  const { data: tenant } = await queryWithBreaker(() => supabaseAdmin
    .from('tenants')
    .select('*')
    .or(`id.eq.${targetId},code.eq.${targetId},primary_rest_id.eq.${targetId}`)
    .maybeSingle()
  );

  if (!tenant) {
    return res.status(404).json({ status: 'error', message: 'Restaurant not found' });
  }

  // Fetch owner user
  const { data: owner } = await queryWithBreaker(() => supabaseAdmin
    .from('tenant_users')
    .select('*')
    .eq('tenant_id', tenant.id)
    .in('role', ['BRAND_OWNER', 'RESTAURANT_OWNER'])
    .maybeSingle()
  );

  const ownerUser = owner || {
    id: `usr_${tenant.id}`,
    full_name: tenant.owner_name || 'Restaurant Owner',
    email: tenant.owner_email,
    role: 'RESTAURANT_OWNER',
    tenant_id: tenant.id
  };

  // Create session token (JWT)
  const { generateTokens } = await import('../middleware/auth.js');
  const tokens = generateTokens({
    id: ownerUser.id,
    name: ownerUser.full_name,
    email: ownerUser.email,
    role: 'RESTAURANT_OWNER',
    tenantId: tenant.id,
    tenantName: tenant.name,
    primaryRestID: tenant.primary_rest_id
  });

  return res.json({
    status: 'success',
    token: tokens.accessToken,
    message: `Now managing ${tenant.name}`,
    impersonatedUser: {
      id: ownerUser.id,
      name: ownerUser.full_name,
      email: ownerUser.email,
      role: 'RESTAURANT_OWNER',
      tenantId: tenant.id,
      tenantName: tenant.name,
      primaryRestID: tenant.primary_rest_id,
      isImpersonated: true
    }
  });
});

// POST /api/v1/admin/reset-data - Wipe all data to zero (NOT for production)
adminRouter.post('/reset-data', requireAuth, requireSuperAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      status: 'error',
      message: 'Data reset is disabled in production environment'
    });
  }

  // This would require a more complex operation - deleting all tenant data
  // For now, return a message that this should be done via Supabase dashboard
  return res.json({
    status: 'error',
    message: 'Data reset must be performed via Supabase dashboard or migration scripts. Not available via API in this version.'
  });
});

// PATCH /api/v1/admin/restaurants/:id/status - Super Admin toggles restaurant active/inactive
adminRouter.patch('/restaurants/:id/status', requireAuth, requireSuperAdmin, async (req, res) => {
  const targetId = req.params.id;
  const requestedStatus = req.body?.status;

  // Find tenant
  const { data: tenant } = await queryWithBreaker(() => supabaseAdmin
    .from('tenants')
    .select('*')
    .or(`id.eq.${targetId},code.eq.${targetId},primary_rest_id.eq.${targetId}`)
    .maybeSingle()
  );

  if (!tenant) {
    return res.status(404).json({ status: 'error', message: 'Restaurant not found' });
  }

  const updatedTenant = await setTenantStatus(tenant.id, requestedStatus);
  const newStatus = updatedTenant.status || (updatedTenant.active ? 'ACTIVE' : 'INACTIVE');

  return res.json({
    status: 'success',
    message: `Restaurant '${tenant.name}' is now ${newStatus}`,
    data: {
      id: tenant.id,
      name: tenant.name,
      status: newStatus,
      active: updatedTenant.active
    }
  });
});

// PATCH /api/v1/admin/restaurants/:id/password - Super Admin sets/updates restaurant owner password
adminRouter.patch('/restaurants/:id/password', requireAuth, requireSuperAdmin, async (req, res) => {
  const targetId = req.params.id;
  const newPassword = (req.body?.password || req.body?.newPassword || '').trim();

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ status: 'error', message: 'New password must be at least 8 characters' });
  }

  const { data: tenant } = await queryWithBreaker(() => supabaseAdmin
    .from('tenants')
    .select('*')
    .or(`id.eq.${targetId},code.eq.${targetId},primary_rest_id.eq.${targetId}`)
    .maybeSingle()
  );

  if (!tenant) {
    return res.status(404).json({ status: 'error', message: 'Restaurant not found' });
  }

  const pwdHash = bcrypt.hashSync(newPassword, 10);
  const tenantUuid = toUuid(tenant.id);

  // Update in Supabase
  if (supabaseAdmin) {
    try {
      const email = tenant.owner_email;
      const updatePayload = {
        password_hash: pwdHash,
        updated_at: new Date().toISOString()
      };

      await Promise.allSettled([
        supabaseAdmin.from('tenant_users').update(updatePayload).eq('tenant_id', tenantUuid),
        supabaseAdmin.from('tenant_users').update(updatePayload).ilike('email', email || ''),
        supabaseAdmin.from('tenant_users').update(updatePayload).eq('tenant_id', tenant.supabase_id || tenantUuid)
      ]);
    } catch (sbErr) {
      console.warn('[Admin] Failed to update password in Supabase:', sbErr.message);
    }
  }

  return res.json({
    status: 'success',
    message: `Password updated successfully for '${tenant.name}'`,
    data: {
      tenantId: tenant.id,
      brandName: tenant.name,
      ownerEmail: tenant.owner_email,
      newPassword
    }
  });
});

// DELETE /api/v1/admin/restaurants/:id - Super Admin permanently deletes restaurant
adminRouter.delete('/restaurants/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const targetId = req.params.id;

  const { data: tenant } = await queryWithBreaker(() => supabaseAdmin
    .from('tenants')
    .select('*')
    .or(`id.eq.${targetId},code.eq.${targetId},primary_rest_id.eq.${targetId}`)
    .maybeSingle()
  );

  if (!tenant) {
    return res.status(404).json({ status: 'error', message: 'Restaurant not found' });
  }

  const brandName = tenant.name || tenant.brandName || targetId;
  const tenantId = tenant.id;

  // 1. Delete from Supabase first if available
  if (supabaseAdmin) {
    try {
      const tenantUuid = toUuid(tenantId);
      // Delete child records first to satisfy foreign key constraints
      await Promise.allSettled([
        supabaseAdmin.from('api_keys').delete().eq('restaurant_id', tenantId),
        supabaseAdmin.from('loyalty_programs').delete().eq('restaurant_id', tenantId),
        supabaseAdmin.from('pos_integrations').delete().or(`tenant_id.eq.${tenantUuid},petpooja_rest_id.eq.${tenant.primary_rest_id}`),
        supabaseAdmin.from('tenant_users').delete().eq('tenant_id', tenantUuid),
        supabaseAdmin.from('outlets').delete().eq('tenant_id', tenantUuid)
      ]);

      // Delete the tenant record itself
      await supabaseAdmin.from('tenants').delete().or(`id.eq.${tenantUuid},code.eq.${tenantId}`);
      console.log(`[Supabase Admin] Deleted restaurant ${tenantId} (${brandName}) from Supabase.`);
    } catch (sbErr) {
      console.error('[Supabase Admin] Error deleting restaurant from Supabase:', sbErr.message);
    }
  }

  // 2. Delete from store (which handles any remaining cleanup)
  await deleteTenant(tenantId);

  return res.json({
    status: 'success',
    message: `Restaurant '${brandName}' has been permanently deleted.`,
    deletedId: tenantId
  });
});