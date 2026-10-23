// Customers & Guest Directory REST Router (Multi-Tenant Scoped)
import { Router } from 'express';
import { posStore } from '../db/store.js';
import { syncCustomerToSupabase } from '../db/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

export const customersRouter = Router();

// GET /api/v1/customers - Search, filter, and sort scoped to authenticated tenant
customersRouter.get('/', authMiddleware, (req, res) => {
  const { search = '', tier = 'all', sort = 'spend_desc' } = req.query;
  const tenantId = req.tenantId || req.query.tenantId || req.user?.tenantId;

  let customers = tenantId
    ? posStore.data.customers.filter(c => c.tenantId === tenantId || (!c.tenantId && tenantId === 'ten_yeezy_01'))
    : posStore.data.customers;

  // Search filter
  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }

  // Tier filter
  if (tier !== 'all') {
    customers = customers.filter(c => c.tier.toLowerCase() === tier.toLowerCase());
  }

  // Sort
  if (sort === 'spend_desc') {
    customers.sort((a, b) => b.lifetimeSpend - a.lifetimeSpend);
  } else if (sort === 'visits_desc') {
    customers.sort((a, b) => b.visits - a.visits);
  } else if (sort === 'points_desc') {
    customers.sort((a, b) => b.pointsBalance - a.pointsBalance);
  }

  return res.json({
    status: 'success',
    tenantId: tenantId || null,
    count: customers.length,
    totalCount: customers.length,
    customers
  });
});

// GET /api/v1/customers/:id - Customer profile with orders & ledger history
customersRouter.get('/:id', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || req.query.tenantId || req.user?.tenantId;
  const customer = posStore.data.customers.find(c => c.id === req.params.id);
  
  if (!customer) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  // Verify tenant ownership unless super admin
  if (tenantId && customer.tenantId && customer.tenantId !== tenantId && req.user?.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ status: 'error', message: 'Access denied: Customer belongs to another restaurant.' });
  }

  const cleanPhone = customer.phone ? String(customer.phone).replace(/\D/g, '').slice(-10) : '';
  const orders = posStore.data.orders.filter(o => 
    o.customerId === customer.id || 
    (cleanPhone && o.customerPhone && String(o.customerPhone).replace(/\D/g, '').slice(-10) === cleanPhone)
  );
  const ledger = posStore.data.loyaltyLedger.filter(l => 
    l.customerId === customer.id ||
    (cleanPhone && l.customerPhone && String(l.customerPhone).replace(/\D/g, '').slice(-10) === cleanPhone)
  );

  return res.json({
    status: 'success',
    customer,
    orders,
    ledger
  });
});

// POST /api/v1/customers/:id/adjust-points - Manager manual points adjustment
customersRouter.post('/:id/adjust-points', authMiddleware, (req, res) => {
  const { pointsDelta, reason } = req.body;
  const customer = posStore.data.customers.find(c => c.id === req.params.id);

  if (!customer) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
  }

  const delta = parseInt(pointsDelta, 10);
  if (isNaN(delta) || delta === 0) {
    return res.status(400).json({ status: 'error', message: 'Invalid pointsDelta amount' });
  }

  const entry = posStore.recordLedgerEntry({
    customerId: customer.id,
    tenantId: customer.tenantId,
    type: 'MANUAL_ADJUST',
    pointsDelta: delta,
    reason: reason || 'Manager manual points adjustment via dashboard'
  });

  return res.json({
    status: 'success',
    customer: {
      name: customer.name,
      pointsBalance: customer.pointsBalance
    },
    ledgerEntry: entry
  });
});

// POST /api/v1/customers - Register a new customer under current tenant
customersRouter.post('/', authMiddleware, (req, res) => {
  const { phone, name, email } = req.body;
  const tenantId = req.tenantId || req.body.tenantId || req.user?.tenantId || 'ten_yeezy_01';

  if (!phone) {
    return res.status(400).json({ status: 'error', message: 'Phone number is required' });
  }

  const customer = posStore.getOrCreateCustomer(phone, name, tenantId);
  if (email) customer.email = email;
  posStore.persist();

  // Async mirror to Supabase
  syncCustomerToSupabase(customer);

  return res.status(201).json({
    status: 'success',
    message: `Customer ${customer.name} registered under ${customer.tenantId}.`,
    customer
  });
});
