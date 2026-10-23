// Stream Performance & Store KPIs Deck

export function renderKPIsRow(stats) {
  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      <!-- KPI 1: Active Members -->
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px]">
        <div class="flex items-start justify-between">
          <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Active Members</span>
          <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
            ${stats.activeMembersGrowth}
          </span>
        </div>
        <div class="mt-2 font-black text-3xl text-on-surface tracking-tight">
          ${stats.activeMembers.toLocaleString()}
        </div>
      </div>

      <!-- KPI 2: Repeat Visit Rate -->
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px]">
        <div class="flex items-start justify-between">
          <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Repeat Visit Rate</span>
          <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
            ${stats.repeatVisitGrowth}
          </span>
        </div>
        <div class="mt-2 font-black text-3xl text-on-surface tracking-tight">
          ${stats.repeatVisitRate}
        </div>
      </div>

      <!-- KPI 3: Total Points Issued -->
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px]">
        <div class="flex items-start justify-between">
          <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Total Points Issued</span>
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
      <div class="rounded-2xl bg-surface-container-lowest p-space-md border border-outline-variant/30 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[110px]">
        <div class="flex items-start justify-between">
          <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Loyalty ROI</span>
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
