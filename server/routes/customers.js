// Customers & Guest Directory REST Router
import { Router } from 'express';
import { posStore } from '../db/store.js';
import { syncCustomerToSupabase } from '../db/supabase.js';

export const customersRouter = Router();

// GET /api/v1/customers - Search, filter, and sort
customersRouter.get('/', (req, res) => {
  const { search = '', tier = 'all', sort = 'spend_desc' } = req.query;

  let customers = [...posStore.data.customers];

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
    count: customers.length,
    totalCount: posStore.data.customers.length,
    customers
  });
});

// GET /api/v1/customers/:id - Customer profile with orders & ledger history
customersRouter.get('/:id', (req, res) => {
  const customer = posStore.data.customers.find(c => c.id === req.params.id);
  if (!customer) {
    return res.status(404).json({ status: 'error', message: 'Customer not found' });
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
customersRouter.post('/:id/adjust-points', (req, res) => {
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

// POST /api/v1/customers - Register a new customer
customersRouter.post('/', (req, res) => {
  const { phone, name, email } = req.body;
  if (!phone) {
    return res.status(400).json({ status: 'error', message: 'Phone number is required' });
  }

  const customer = posStore.getOrCreateCustomer(phone, name);
  if (email) customer.email = email;
  posStore.persist();

  // Async mirror to Supabase
  syncCustomerToSupabase(customer);

  return res.status(201).json({
    status: 'success',
    message: `Customer ${customer.name} registered with ${customer.pointsBalance} welcome points.`,
    customer
  });
});
