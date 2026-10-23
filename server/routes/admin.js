// Super Admin Management Router
import { Router } from 'express';
import { posStore } from '../db/store.js';

export const adminRouter = Router();

// GET /api/v1/admin/restaurants - List all restaurants & owner accounts
adminRouter.get('/restaurants', (req, res) => {
  const tenants = posStore.data.tenants || [];
  const users = posStore.data.users || [];
  const outlets = posStore.data.outlets || [];

  const enriched = tenants.map(t => {
    const owner = users.find(u => u.tenantId === t.id);
    const tenantOutlets = outlets.filter(o => o.restID === t.primaryRestID || t.id === 'ten_yeezy_01');

    return {
      ...t,
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
adminRouter.post('/restaurants', (req, res) => {
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

    return res.status(201).json({
      status: 'success',
      message: `Restaurant '${brandName}' and owner '${ownerEmail}' created successfully!`,
      data: result
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
