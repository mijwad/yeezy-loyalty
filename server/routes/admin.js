// Super Admin Management Router
import { Router } from 'express';
import crypto from 'node:crypto';
import { posStore } from '../db/store.js';
import { supabaseAdmin } from '../db/supabase.js';
import { DEFAULT_LOYALTY_CONFIG } from '../../lib/loyalty/config.js';

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
  'ten_durbar_mvnrq6po': 'lk_live_c511_durbar_cafe_live_pos_key_2026_9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d'
};

// GET /api/v1/admin/restaurants - List all restaurants & owner accounts
adminRouter.get('/restaurants', async (req, res) => {
  // Sync with persistent Supabase database
  if (supabaseAdmin) {
    try {
      const [{ data: sbTenants }, { data: sbKeys }] = await Promise.all([
        supabaseAdmin.from('tenants').select('*'),
        supabaseAdmin.from('api_keys').select('*').eq('is_test', false)
      ]);

      if (sbTenants && sbTenants.length > 0) {
        for (const st of sbTenants) {
          const tenantId = st.code && st.code !== 'NULL' ? st.code : st.id;
          let existing = posStore.data.tenants?.find(t => t.id === tenantId || t.id === st.id);
          if (!existing) {
            const newTenant = {
              id: tenantId,
              name: st.name,
              brandName: st.name,
              ownerId: `usr_${tenantId}`,
              ownerName: st.primary_contact_name || 'Restaurant Owner',
              ownerEmail: st.primary_contact_email && st.primary_contact_email !== 'NULL' ? st.primary_contact_email : `${tenantId}@restaurant.com`,
              plan: 'ENTERPRISE',
              active: st.status === 'ACTIVE',
              createdAt: st.created_at || new Date().toISOString(),
              primaryRestID: tenantId,
              outletsCount: 1,
              totalDiners: 0,
              lifetimeSales: 0
            };
            if (!posStore.data.tenants) posStore.data.tenants = [];
            posStore.data.tenants.push(newTenant);
          }
        }
      }
    } catch (err) {
      console.warn('[Admin Sync] Supabase sync warning:', err.message);
    }
  }

  const tenants = posStore.data.tenants || [];
  const users = posStore.data.users || [];
  const outlets = posStore.data.outlets || [];

  const enriched = tenants.map(t => {
    const owner = users.find(u => u.tenantId === t.id);
    const tenantOutlets = outlets.filter(o => o.restID === t.primaryRestID || t.id === 'ten_yeezy_01');
    const apiKey = PILOT_KEYS[t.id] || t.apiKey || `lk_live_${t.id.replace(/[^a-z0-9]/g, '')}9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d`;

    return {
      ...t,
      apiKey,
      owner: owner ? {
        id: owner.id,
        name: owner.name,
        email: owner.email,
        role: owner.role
      } : null,
      outlets: tenantOutlets
    };
  });

  const totalDiners = enriched.reduce((sum, t) => sum + (t.totalDiners || 0), 0);
  const totalSales = enriched.reduce((sum, t) => sum + (t.lifetimeSales || 0), 0);

  return res.json({
    status: 'success',
    totalRestaurants: tenants.length,
    globalStats: {
      totalRestaurants: tenants.length,
      totalOutlets: outlets.length,
      globalDiners: totalDiners,
      globalSales: totalSales
    },
    restaurants: enriched
  });
});

// POST /api/v1/admin/restaurants - Super Admin creates new restaurant and owner
adminRouter.post('/restaurants', async (req, res) => {
  const { brandName, ownerName, ownerEmail, password, primaryOutletName, petpoojaRestID } = req.body;

  if (!brandName || !ownerName || !ownerEmail) {
    return res.status(400).json({ status: 'error', message: 'brandName, ownerName, and ownerEmail are required' });
  }

  try {
    const result = posStore.createRestaurantTenant({
      brandName,
      ownerName,
      ownerEmail,
      password: password || 'owner123',
      primaryOutletName,
      petpoojaRestID
    });

    const tenant = result.tenant;

    // Generate real cryptographic API Key (v1)
    const rawApiKey = `lk_live_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawApiKey).digest('hex');
    const keyPrefix = rawApiKey.slice(0, 12);
    const keyLast4 = rawApiKey.slice(-4);

    tenant.apiKey = rawApiKey;
    posStore.persist();

    // Persist permanently to Supabase cloud database
    if (supabaseAdmin) {
      try {
        const tenantUuid = toUuid(tenant.id);
        const contactPhone = req.body.ownerPhone || req.body.phone || '+919876543210';
        await Promise.all([
          supabaseAdmin.from('tenants').upsert({
            id: tenantUuid,
            code: tenant.id,
            name: brandName.trim(),
            status: 'ACTIVE',
            primary_contact_name: ownerName.trim(),
            primary_contact_email: ownerEmail.trim().toLowerCase(),
            primary_contact_phone: contactPhone
          }, { onConflict: 'id' }),

          supabaseAdmin.from('loyalty_programs').upsert({
            restaurant_id: tenant.id,
            is_active: true,
            config: DEFAULT_LOYALTY_CONFIG
          }, { onConflict: 'restaurant_id' }),

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
        console.log(`[Supabase Admin] Successfully persisted restaurant ${tenant.id} and API key.`);
      } catch (sbErr) {
        console.error('[Supabase Admin] Error persisting to Supabase:', sbErr.message);
      }
    }

    return res.status(201).json({
      status: 'success',
      message: `Restaurant '${brandName}' and owner '${ownerEmail}' created successfully!`,
      data: {
        ...result,
        apiKey: rawApiKey
      }
    });
  } catch (err) {
    return res.status(400).json({ status: 'error', message: err.message });
  }
});

// POST /api/v1/admin/impersonate/:tenantId - Super Admin switches into restaurant
adminRouter.post('/impersonate/:tenantId', (req, res) => {
  const tenant = posStore.data.tenants.find(t => t.id === req.params.tenantId);
  if (!tenant) {
    return res.status(404).json({ status: 'error', message: 'Restaurant not found' });
  }

  const owner = posStore.data.users.find(u => u.tenantId === tenant.id) || {
    id: `usr_${tenant.id}`,
    name: tenant.ownerName || 'Restaurant Owner',
    email: tenant.ownerEmail,
    role: 'RESTAURANT_OWNER',
    tenantId: tenant.id
  };

  return res.json({
    status: 'success',
    message: `Now managing ${tenant.name}`,
    impersonatedUser: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      role: 'RESTAURANT_OWNER',
      tenantId: tenant.id,
      tenantName: tenant.name,
      primaryRestID: tenant.primaryRestID,
      isImpersonated: true
    }
  });
});

// POST /api/v1/admin/reset-data - Wipe all data to zero
adminRouter.post('/reset-data', (req, res) => {
  posStore.resetToZero();
  return res.json({
    status: 'success',
    message: 'All restaurant customer and transactional data successfully reset to 0'
  });
});
