// Dashboard View Orchestrator Module
import { store } from '../../state/store.js';
import { exportToCSV } from '../../utils/exportCsv.js';
import { renderHighlightsRow } from './HighlightsRow.js';
import { renderBarChartCard, attachBarChartListeners } from './BarChartCard.js';
import { renderCreditsCard, attachCreditsListeners } from './CreditsCard.js';
import { renderKPIsRow } from './KPIsRow.js';
import { renderVIPTableCard, attachVIPTableListeners } from './VIPTableCard.js';

export function renderDashboard(state) {
  const { timeFilter, todayStats, yesterdayStats, businessHighlights, creditsBalance, customers, user } = state;
  const currentStats = timeFilter === 'yesterday' ? yesterdayStats : todayStats;

  return `
    <div class="px-space-md md:px-space-lg flex flex-col gap-space-lg pb-12">
      <!-- Top Action Bar with Greeting, Outlet Badge & Dynamic Filter -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div>
          <h1 class="font-headline-lg text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
            Hi ${user.name.split(' ')[0]} 👋
          </h1>
          <p class="text-xs md:text-sm text-on-surface-variant font-medium mt-0.5">
            Real-time guest loyalty performance for <span class="font-bold text-primary">${state.activeOutlet}</span>
          </p>
        </div>

        <div class="flex items-center gap-space-sm flex-wrap">
          <!-- Time Filter Pill Switcher -->
          <div class="inline-flex p-1 bg-surface-container-low rounded-xl border border-outline-variant/30 shadow-xs">
            <button 
              id="pill-yesterday" 
              type="button" 
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeFilter === 'yesterday' ? 'bg-white text-on-surface shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}"
            >
              Yesterday
            </button>
            <button 
              id="pill-today" 
              type="button" 
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${timeFilter === 'today' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}"
            >
              Today
            </button>
          </div>

          <!-- Export Report CTA -->
          <button 
            id="btn-export-today-report"
            type="button" 
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-high transition-colors text-xs font-bold text-on-surface shadow-xs"
          >
            <span class="material-symbols-outlined text-sm">download</span>
            <span>Export Report</span>
          </button>
        </div>
      </div>

      <!-- 1. Today's Highlights (4 Cards) -->
      ${renderHighlightsRow(currentStats)}

      <!-- 2. Business Highlights Visualizer Card -->
      ${renderBarChartCard(businessHighlights)}

      <!-- 3. Messaging Credits Balance Deck -->
      ${renderCreditsCard(creditsBalance)}

      <!-- 4. Stream Performance KPIs -->
      ${renderKPIsRow(currentStats, customers)}

      <!-- 5. Top Customers & Loyalty VIPs Table Card -->
      ${renderVIPTableCard(customers)}
    </div>
  `;
}

export function attachDashboardListeners() {
  const pillYesterday = document.getElementById('pill-yesterday');
  const pillToday = document.getElementById('pill-today');
  if (pillYesterday && pillToday) {
    pillYesterday.onclick = () => {
      store.setState({ timeFilter: 'yesterday' });
    };
    pillToday.onclick = () => {
      store.setState({ timeFilter: 'today' });
    };
  }

  const exportBtn = document.getElementById('btn-export-today-report');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const stats = store.getState().todayStats;
      const rows = [
        ['Metric', 'Value', 'Status'],
        ['Total Sales', `₹${stats.sales}`, 'Verified'],
        ['Orders Completed', stats.orders, 'Completed'],
        ['Customers', stats.customers ?? 0, 'Active'],
        ['Rewards Redeemed', stats.rewardsRedeemed, 'Redeemed'],
        ['Active Members', stats.activeMembers, stats.activeMembersGrowth],
        ['Repeat Visit Rate', stats.repeatVisitRate, stats.repeatVisitGrowth]
      ];
      exportToCSV(`Yeezy_Report_${new Date().toISOString().slice(0, 10)}.csv`, rows);
    };
  }

  attachBarChartListeners();
  attachCreditsListeners();
  attachVIPTableListeners();
}
