// Today's Highlights 4-card metric strip with 3D badges
import { renderInfoTooltip } from '../../utils/tooltip.js';

export function renderHighlightsRow(stats) {
  const hasOrders = stats.orders > 0;

  return `
    <div class="flex flex-col gap-space-sm">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
          <span class="material-symbols-outlined text-primary text-base">bolt</span>
          Today's Highlights
        </h2>
        <span class="text-[11px] text-on-surface-variant font-medium flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
          Live Syncing • Just now
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <!-- Card 1: Sales -->
        <div class="relative overflow-visible rounded-2xl bg-[#FFF7ED] border border-[#FED7AA]/60 p-space-md shadow-sm flex items-center justify-between min-h-[115px] transition-all hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col justify-between h-full z-10">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-[#EA580C] uppercase tracking-wider">Sales Today</span>
              ${renderInfoTooltip("Total revenue collected from completed orders today.", "left")}
            </div>
            <div class="text-3xl font-black text-[#1B1B1E] tracking-tight mt-1">₹${stats.sales.toLocaleString()}</div>
            <span class="text-[11px] ${hasOrders ? 'text-emerald-600' : 'text-on-surface-variant'} font-bold mt-1 flex items-center gap-0.5">
              <span class="material-symbols-outlined text-xs">${hasOrders ? 'trending_up' : 'schedule'}</span> 
              ${hasOrders ? `+₹${stats.sales.toLocaleString()} captured` : 'Waiting for first bill'}
            </span>
          </div>
          <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div class="absolute -right-2 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
              <div class="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#FDBA74] via-[#F59E0B] to-[#D97706] shadow-lg flex items-center justify-center transform rotate-12 border-4 border-[#FED7AA]/60">
                <div class="w-14 h-14 rounded-full border-2 border-amber-200/50 flex items-center justify-center">
                  <span class="text-2xl font-black text-amber-100 drop-shadow-sm">₹</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Orders -->
        <div class="relative overflow-visible rounded-2xl bg-[#FDF2F8] border border-[#FBCFE8]/60 p-space-md shadow-sm flex items-center justify-between min-h-[115px] transition-all hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col justify-between h-full z-10">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-[#DB2777] uppercase tracking-wider">Orders</span>
              ${renderInfoTooltip("Total number of orders processed through the POS system today.", "left")}
            </div>
            <div class="text-3xl font-black text-[#1B1B1E] tracking-tight mt-1">${stats.orders}</div>
            <span class="text-[11px] ${hasOrders ? 'text-emerald-600' : 'text-on-surface-variant'} font-bold mt-1 flex items-center gap-0.5">
              <span class="material-symbols-outlined text-xs">${hasOrders ? 'check_circle' : 'receipt'}</span> 
              ${hasOrders ? `${stats.orders} completed today` : '0 completed orders'}
            </span>
          </div>
          <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div class="absolute -right-1 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
              <div class="relative w-16 h-20 bg-gradient-to-br from-[#FB923C] to-[#EA580C] rounded-lg shadow-lg flex flex-col items-center pt-1 border border-orange-300/40 transform rotate-6">
                <div class="w-8 h-6 border-2 border-slate-300 rounded-t-full -mt-4 bg-transparent"></div>
                <div class="w-10 h-1 bg-orange-700/30 rounded mt-2"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 3: Customers (with 3D avatar) -->
        <div class="relative overflow-visible rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE]/60 p-space-md shadow-sm flex items-center justify-between min-h-[115px] transition-all hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col justify-between h-full z-10">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-bold text-[#1D4ED8] tracking-tight">Active Guests</span>
              ${renderInfoTooltip("Total unique diners and loyalty guests recorded today.", "left")}
            </div>
            <div class="text-3xl font-black text-[#1B1B1E] tracking-tight mt-1">${stats.customers ?? 0}</div>
            <span class="text-[11px] text-[#1D4ED8] font-bold mt-1">
              ${stats.customers > 0 ? `${stats.customers} registered diners` : 'No diners seated yet'}
            </span>
          </div>
          <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div class="absolute right-2 -bottom-1 w-20 h-24 flex items-end justify-center">
              <img 
                src="/customer-3d-avatar.png" 
                alt="Customers" 
                class="h-24 w-auto object-contain select-none drop-shadow-sm" 
              />
            </div>
          </div>
        </div>

        <!-- Card 4: Rewards Redeemed -->
        <div class="relative overflow-visible rounded-2xl bg-[#F5F3FF] border border-[#DDD6FE]/60 p-space-md shadow-sm flex items-center justify-between min-h-[115px] transition-all hover:shadow-md hover:-translate-y-0.5">
          <div class="flex flex-col justify-between h-full z-10">
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-[#7C3AED] uppercase tracking-wider">Rewards Redeemed</span>
              ${renderInfoTooltip("Total number of loyalty perks, points redemptions, and voucher discounts claimed today.", "left")}
            </div>
            <div class="text-3xl font-black text-[#1B1B1E] tracking-tight mt-1">${stats.rewardsRedeemed}</div>
            <span class="text-[11px] text-[#7C3AED] font-bold mt-1">
              ${stats.rewardsRedeemed > 0 ? `${stats.rewardsRedeemed} discounts used` : '0 redeemed so far'}
            </span>
          </div>
          <div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div class="absolute -right-2 top-1/2 -translate-y-1/2 w-24 h-24 flex items-center justify-center">
              <div class="relative w-18 h-18 bg-gradient-to-br from-[#DC2626] to-[#991B1B] rounded-xl shadow-lg border border-red-300/40 transform -rotate-12 flex items-center justify-center overflow-hidden">
                <div class="absolute inset-y-0 w-3 bg-[#1D4ED8] shadow-sm"></div>
                <div class="absolute inset-x-0 h-3 bg-[#1D4ED8] shadow-sm"></div>
                <div class="absolute -top-1 w-6 h-6 border-2 border-blue-400 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
