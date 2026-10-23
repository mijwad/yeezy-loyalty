// Dashboard Metrics & Live Aggregations Router (Multi-Tenant Scoped)
import { Router } from 'express';
import { posStore } from '../db/store.js';
import { authMiddleware } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', authMiddleware, (req, res) => {
  const tenantId = req.tenantId || req.query.tenantId || req.user?.tenantId;

  // Filter records strictly by authenticated tenant
  const customers = tenantId 
    ? posStore.data.customers.filter(c => c.tenantId === tenantId || (!c.tenantId && tenantId === 'ten_yeezy_01'))
    : posStore.data.customers;

  const orders = tenantId 
    ? posStore.data.orders.filter(o => o.tenantId === tenantId || (!o.tenantId && tenantId === 'ten_yeezy_01'))
    : posStore.data.orders;

  const tenantLedger = tenantId 
    ? posStore.data.loyaltyLedger.filter(l => l.tenantId === tenantId || (!l.tenantId && tenantId === 'ten_yeezy_01'))
    : posStore.data.loyaltyLedger;

  const outlets = tenantId 
    ? posStore.data.outlets.filter(o => o.tenantId === tenantId)
    : posStore.data.outlets;

  const tenant = tenantId ? posStore.data.tenants.find(t => t.id === tenantId) : posStore.data.tenants[0];

  const totalSales = orders.reduce((sum, o) => sum + (o.financials?.netPaid || 0), 0);
  const totalOrders = orders.length;

  const totalPointsIssued = tenantLedger
    .filter(l => l.pointsDelta > 0)
    .reduce((sum, l) => sum + l.pointsDelta, 0);

  const totalPointsBurned = tenantLedger
    .filter(l => l.pointsDelta < 0)
    .reduce((sum, l) => sum + Math.abs(l.pointsDelta), 0);

  const rewardsRedeemed = tenantLedger.filter(l => l.type === 'REDEEM_BURN').length;

  const repeatCustomers = customers.filter(c => (c.visits || 0) > 1).length;
  const repeatRate = customers.length > 0 ? `${Math.round((repeatCustomers / customers.length) * 100)}%` : '0%';
  const burnRate = totalPointsIssued > 0 ? `${Math.round((totalPointsBurned / totalPointsIssued) * 100)}%` : '0%';
  const roi = totalSales > 0 ? `${((totalSales / Math.max(1, totalPointsBurned || 100))).toFixed(1)}x` : '0.0x';

  res.json({
    status: 'success',
    tenantId: tenant?.id || 'ten_yeezy_01',
    restaurantName: tenant?.name || tenant?.brandName || 'Downtown Bistro',
    activeOutlet: outlets[0]?.name || tenant?.name || 'Downtown Bistro',
    outlets,
    todayStats: {
      sales: totalSales,
      orders: totalOrders,
      customers: customers.length,
      pointsIssued: totalPointsIssued,
      totalPointsCapacity: 100000,
      burnRate,
      rewardsRedeemed,
      activeMembers: customers.length,
      activeMembersGrowth: customers.length > 0 ? `+${customers.length}` : '0%',
      repeatVisitRate: repeatRate,
      repeatVisitGrowth: repeatCustomers > 0 ? `+${repeatCustomers}` : '0%',
      loyaltyRoi: roi
    },
    creditsBalance: posStore.data.creditsBalance,
    programTitle: posStore.data.loyaltyProgram.title,
    topVIPs: customers.slice(0, 6)
  });
});

// POST /api/v1/dashboard/reset - Reset all dashboard transactional data to 0
dashboardRouter.post('/reset', (req, res) => {
  posStore.resetToZero();
  res.json({
    status: 'success',
    message: 'All platform transaction and customer data reset to 0'
  });
});
