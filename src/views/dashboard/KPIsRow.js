// Stream Performance & Store KPIs Deck
import { renderInfoTooltip } from '../../utils/tooltip.js';

export function renderKPIsRow(stats) {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      <!-- KPI 1: Active Members -->
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px] relative overflow-visible">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Active Members</span>
            ${renderInfoTooltip("Registered loyalty customers who have dined, accrued, or redeemed points.")}
          </div>
          <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
            ${stats.activeMembersGrowth}
          </span>
        </div>
        <div class="mt-2 font-black text-3xl text-on-surface tracking-tight">
          ${stats.activeMembers.toLocaleString()}
        </div>
      </div>

      <!-- KPI 2: Repeat Visit Rate -->
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px] relative overflow-visible">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Repeat Visit Rate</span>
            ${renderInfoTooltip("Percentage of total customers who returned to dine at your restaurant 2 or more times.")}
          </div>
          <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
            ${stats.repeatVisitGrowth}
          </span>
        </div>
        <div class="mt-2 font-black text-3xl text-on-surface tracking-tight">
          ${stats.repeatVisitRate}
        </div>
      </div>

      <!-- KPI 3: Total Points Issued -->
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px] relative overflow-visible">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Points Issued</span>
            ${renderInfoTooltip("Total loyalty points credited to customer accounts across all settled billing transactions.")}
          </div>
          <span class="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed">
            ${stats.burnRate} Burn
          </span>
        </div>
        <div class="mt-2 flex items-baseline gap-1">
          <span class="font-black text-3xl text-on-surface tracking-tight">${(stats.pointsIssued / 1000).toFixed(0)}k</span>
          <span class="text-xs text-on-surface-variant font-semibold">/ ${(stats.totalPointsCapacity / 1000).toFixed(0)}k pts</span>
        </div>
      </div>

      <!-- KPI 4: Loyalty ROI -->
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px] relative overflow-visible">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Loyalty ROI</span>
            ${renderInfoTooltip("Measured revenue multiple comparing repeat loyalty diner sales against program operational rewards.")}
          </div>
          <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed">
            High Return
          </span>
        </div>
        <div class="mt-2 font-black text-3xl text-secondary tracking-tight">
          ${stats.loyaltyRoi}
        </div>
      </div>
    </div>
  `;
}
