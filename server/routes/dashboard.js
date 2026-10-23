// Dashboard Metrics & Live Aggregations Router
import { Router } from 'express';
import { posStore } from '../db/store.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', (req, res) => {
  const { customers, orders, creditsBalance, loyaltyProgram, outlets } = posStore.data;

  const totalSales = orders.reduce((sum, o) => sum + (o.financials?.netPaid || 0), 0);
  const totalOrders = orders.length;
  const totalPointsIssued = posStore.data.loyaltyLedger
    .filter(l => l.pointsDelta > 0)
    .reduce((sum, l) => sum + l.pointsDelta, 0);

  const totalPointsBurned = posStore.data.loyaltyLedger
    .filter(l => l.pointsDelta < 0)
    .reduce((sum, l) => sum + Math.abs(l.pointsDelta), 0);

  const rewardsRedeemed = posStore.data.loyaltyLedger.filter(l => l.type === 'REDEEM_BURN').length;

  const repeatCustomers = customers.filter(c => (c.visits || 0) > 1).length;
  const repeatRate = customers.length > 0 ? `${Math.round((repeatCustomers / customers.length) * 100)}%` : '0%';
  const burnRate = totalPointsIssued > 0 ? `${Math.round((totalPointsBurned / totalPointsIssued) * 100)}%` : '0%';
  const roi = totalSales > 0 ? `${((totalSales / Math.max(1, totalPointsBurned || 100))).toFixed(1)}x` : '0.0x';

  res.json({
    status: 'success',
    activeOutlet: outlets[0]?.name || 'Downtown Bistro',
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
    creditsBalance,
    programTitle: loyaltyProgram.title,
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
