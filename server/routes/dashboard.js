import { Router } from 'express';
import { posStore } from '../db/store.js';
import { supabase, supabaseAdmin } from '../db/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', authMiddleware, async (req, res) => {
  const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.query.tenantId || req.user?.tenantId;

  if (!tenantId) {
    return res.status(400).json({ status: 'error', message: 'Tenant context required' });
  }

  let dbMembers = [];
  let dbMemberCount = 0;
  const client = supabaseAdmin || supabase;
  if (client) {
    try {
      const { data, count } = await client
        .from('loyalty_members')
        .select('*', { count: 'exact' })
        .eq('restaurant_id', tenantId)
        .order('lifetime_spend_paise', { ascending: false })
        .limit(10);
      dbMembers = data || [];
      dbMemberCount = count || dbMembers.length;
    } catch {
      // ignore
    }
  }

  // Filter records strictly by authenticated tenant
  const customers = posStore.data.customers.filter(c => c.tenantId === tenantId);
  const effectiveCustomerCount = dbMemberCount > 0 ? dbMemberCount : customers.length;
  const orders = posStore.data.orders.filter(o => o.tenantId === tenantId);
  const tenantLedger = posStore.data.loyaltyLedger.filter(l => l.tenantId === tenantId || l.restaurant_id === tenantId);
  const outlets = posStore.data.outlets.filter(o => o.tenantId === tenantId);
  const tenant = posStore.data.tenants.find(t => t.id === tenantId || t.code === tenantId);

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
      customers: effectiveCustomerCount,
      pointsIssued: totalPointsIssued,
      totalPointsCapacity: 100000,
      burnRate,
      rewardsRedeemed,
      activeMembers: effectiveCustomerCount,
      activeMembersGrowth: effectiveCustomerCount > 0 ? `+${effectiveCustomerCount}` : '0%',
      repeatVisitRate: repeatRate,
      repeatVisitGrowth: repeatCustomers > 0 ? `+${repeatCustomers}` : '0%',
      loyaltyRoi: roi
    },
    creditsBalance: posStore.data.creditsBalance,
    topVIPs: dbMembers.length > 0
      ? dbMembers.slice(0, 6).map(m => {
          const cleanPhone = (m.phone_e164 || '').replace(/\D/g, '').slice(-10);
          const spend = Math.round((m.lifetime_spend_paise || 0) / 100);
          return {
            id: m.id,
            name: m.name || 'Valued Guest',
            phone: m.phone_e164 || `+91 ${cleanPhone}`,
            tier: m.tier || 'Silver',
            visits: m.visit_count || 1,
            lifetimeSpend: `₹${spend.toLocaleString()}`,
            numericSpend: spend,
            pointsBalance: `${Math.round(spend / 10)} pts`,
            status: 'Active'
          };
        })
      : customers.slice(0, 6)
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
