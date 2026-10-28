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
  let dbLedger = [];
  let dbOrders = [];
  const client = supabaseAdmin || supabase;
  if (client) {
    try {
      const [membersRes, ledgerRes, ordersRes] = await Promise.all([
        client
          .from('loyalty_members')
          .select('*', { count: 'exact' })
          .eq('restaurant_id', tenantId)
          .order('lifetime_spend_paise', { ascending: false }),
        client
          .from('loyalty_ledger')
          .select('*')
          .eq('restaurant_id', tenantId)
          .order('created_at', { ascending: false }),
        client
          .from('orders')
          .select('*')
          .eq('restaurant_id', tenantId)
      ]);
      dbMembers = membersRes.data || [];
      dbMemberCount = membersRes.count || dbMembers.length;
      dbLedger = ledgerRes.data || [];
      dbOrders = ordersRes.data || [];
    } catch (err) {
      console.warn('[Dashboard] Supabase aggregation query error:', err?.message || err);
    }
  }

  // Filter records strictly by authenticated tenant
  const customers = posStore.data.customers.filter(c => c.tenantId === tenantId);
  const effectiveCustomerCount = dbMemberCount > 0 ? dbMemberCount : customers.length;
  const localOrders = posStore.data.orders.filter(o => o.tenantId === tenantId);
  const localLedger = posStore.data.loyaltyLedger.filter(l => l.tenantId === tenantId || l.restaurant_id === tenantId);
  const outlets = posStore.data.outlets.filter(o => o.tenantId === tenantId);
  const tenant = posStore.data.tenants.find(t => t.id === tenantId || t.code === tenantId);

  // Supabase ledger & members aggregation
  const dbLedgerEarns = dbLedger.filter(l => l.type === 'earn_base' || l.points > 0);
  const dbLedgerSalesPaise = dbLedgerEarns.reduce((sum, l) => sum + (l.meta?.subtotal_paise || 0), 0);
  const dbMembersSpendPaise = dbMembers.reduce((sum, m) => sum + (m.lifetime_spend_paise || 0), 0);
  const dbSalesPaise = Math.max(dbLedgerSalesPaise, dbMembersSpendPaise);
  const dbSalesRupees = Math.round(dbSalesPaise / 100);

  const dbOrderIds = new Set(dbLedger.filter(l => l.order_id).map(l => l.order_id));
  const dbOrdersCount = Math.max(
    dbOrderIds.size,
    dbMembers.reduce((sum, m) => sum + (m.visit_count || 0), 0),
    dbOrders.length
  );

  const dbPointsIssued = dbLedger.filter(l => l.points > 0).reduce((sum, l) => sum + l.points, 0);
  const dbPointsBurned = dbLedger.filter(l => l.points < 0).reduce((sum, l) => sum + Math.abs(l.points), 0);
  const dbRewardsRedeemed = dbLedger.filter(l => l.type === 'redeem' || l.points < 0).length;

  // Local fallback aggregation
  const localSales = localOrders.reduce((sum, o) => sum + (o.financials?.netPaid || 0), 0);
  const localPointsIssued = localLedger.filter(l => l.pointsDelta > 0).reduce((sum, l) => sum + l.pointsDelta, 0);
  const localPointsBurned = localLedger.filter(l => l.pointsDelta < 0).reduce((sum, l) => sum + Math.abs(l.pointsDelta), 0);
  const localRewardsRedeemed = localLedger.filter(l => l.type === 'REDEEM_BURN').length;

  // Combined totals
  const totalSales = dbSalesRupees + localSales;
  const totalOrders = dbOrdersCount + localOrders.length;
  
  // Lifetime points issued from the start
  const dbMembersPointsIssued = dbMembers.reduce((sum, m) => {
    const spend = Math.round((m.lifetime_spend_paise || 0) / 100);
    return sum + (m.points_balance !== undefined ? m.points_balance : Math.round(spend / 10));
  }, 0);
  const localCustPointsIssued = customers.reduce((sum, c) => {
    return sum + (c.pointsBalance || c.numericPoints || Math.round((c.numericSpend || 0) / 10));
  }, 0);
  const salesPointsIssued = Math.round(totalSales / 10);
  const totalPointsBurned = dbPointsBurned + localPointsBurned;

  const totalPointsIssued = Math.max(
    dbPointsIssued + localPointsIssued,
    dbMembersPointsIssued + totalPointsBurned,
    localCustPointsIssued + totalPointsBurned,
    salesPointsIssued
  );
  
  const rewardsRedeemed = dbRewardsRedeemed + localRewardsRedeemed;

  const dbRepeatCount = dbMembers.filter(m => (m.visit_count || 0) > 1).length;
  const repeatCustomers = dbRepeatCount > 0 ? dbRepeatCount : customers.filter(c => (c.visits || 0) > 1).length;
  const repeatRate = effectiveCustomerCount > 0 ? `${Math.round((repeatCustomers / effectiveCustomerCount) * 100)}%` : '0%';
  const burnRate = totalPointsIssued > 0 ? `${Math.round((totalPointsBurned / totalPointsIssued) * 100)}%` : '0%';
  const roi = totalSales > 0 ? `${((totalSales / Math.max(1, totalPointsBurned || 100))).toFixed(1)}x` : '0.0x';

  const buildChartBars = (totalVal, unitPrefix = '', unitSuffix = '') => [
    { label: 'W1', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W2', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W3', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W4', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W5', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W6', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W7', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W8', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W9', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W10', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W11', value: 0, amount: `${unitPrefix}0${unitSuffix}` },
    { label: 'W12', value: totalVal > 0 ? 80 : 0, amount: `${unitPrefix}${totalVal.toLocaleString()}${unitSuffix}`, isPeak: totalVal > 0 }
  ];

  const businessHighlights = {
    activeTab: 'sales',
    tabs: {
      sales: {
        totalDisplay: `₹${totalSales.toLocaleString()}`,
        label: 'Total Sales',
        peakWeek: 'W12',
        peakHighlight: totalSales > 0 ? `₹${totalSales.toLocaleString()} Captured` : 'No Transactions Yet',
        peakGrowth: totalSales > 0 ? '+100%' : '0%',
        peakSubtitle: totalOrders > 0 ? `${totalOrders} orders captured so far` : '0 orders captured so far',
        bars: buildChartBars(totalSales, '₹')
      },
      orders: {
        totalDisplay: String(totalOrders),
        label: 'Total Orders',
        peakWeek: 'W12',
        peakHighlight: totalOrders > 0 ? `${totalOrders} Orders Processed` : 'No Orders Yet',
        peakGrowth: totalOrders > 0 ? `+${totalOrders}` : '0%',
        peakSubtitle: `${totalOrders} completed orders`,
        bars: buildChartBars(totalOrders, '', ' orders')
      },
      customers: {
        totalDisplay: String(effectiveCustomerCount),
        label: 'Total Customers',
        peakWeek: 'W12',
        peakHighlight: effectiveCustomerCount > 0 ? `${effectiveCustomerCount} Registered Diners` : 'No Diners Yet',
        peakGrowth: effectiveCustomerCount > 0 ? `+${effectiveCustomerCount}` : '0%',
        peakSubtitle: `${effectiveCustomerCount} unique diners seated`,
        bars: buildChartBars(effectiveCustomerCount, '', ' diners')
      },
      rewards: {
        totalDisplay: String(rewardsRedeemed),
        label: 'Rewards Redeemed',
        peakWeek: 'W12',
        peakHighlight: rewardsRedeemed > 0 ? `${rewardsRedeemed} Rewards Redeemed` : 'No Redemptions Yet',
        peakGrowth: rewardsRedeemed > 0 ? `+${rewardsRedeemed}` : '0%',
        peakSubtitle: `${rewardsRedeemed} vouchers redeemed`,
        bars: buildChartBars(rewardsRedeemed, '', ' rewards')
      }
    }
  };

  res.json({
    status: 'success',
    tenantId: tenant?.id || tenantId,
    restaurantName: tenant?.name || tenant?.brandName || 'Durbar Cafe',
    activeOutlet: outlets[0]?.name || tenant?.name || 'Durbar Cafe',
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
    businessHighlights,
    creditsBalance: posStore.data.creditsBalance,
    topVIPs: dbMembers.length > 0
      ? dbMembers.slice(0, 6).map(m => {
          const cleanPhone = (m.phone_e164 || '').replace(/\D/g, '').slice(-10);
          const spend = Math.round((m.lifetime_spend_paise || 0) / 100);

          // Aggregate food items for this member
          const memberItems = {};
          dbLedger
            .filter(l => l.member_id === m.id)
            .forEach(l => {
              const items = Array.isArray(l.meta?.items) ? l.meta.items : [];
              items.forEach(i => {
                const name = (i.name || i.item_name || '').trim();
                if (name) memberItems[name] = (memberItems[name] || 0) + Number(i.quantity || i.qty || 1);
              });
            });
          const topDishes = Object.entries(memberItems).sort((a, b) => b[1] - a[1]);
          const favoriteDish = topDishes.length > 0 ? `${topDishes[0][0]} (${topDishes[0][1]}x)` : 'Chef Special';

          return {
            id: m.id,
            name: m.name || 'Valued Guest',
            phone: m.phone_e164 || `+91 ${cleanPhone}`,
            tier: m.tier || 'Silver',
            visits: m.visit_count || 1,
            lifetimeSpend: `₹${spend.toLocaleString()}`,
            numericSpend: spend,
            pointsBalance: `${Math.round(spend / 10)} pts`,
            favoriteDish,
            lastVisit: m.last_visit_at
              ? new Date(m.last_visit_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Today',
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
