// Top Customers & Loyalty VIPs Table Card Component
import { store } from '../../state/store.js';

export function renderVIPTableCard(customers) {
  return `
    <div class="bg-surface-container-lowest rounded-2xl p-space-lg border border-outline-variant/30 shadow-sm flex flex-col gap-space-md">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-space-xs">
          <span class="material-symbols-outlined text-secondary text-2xl">military_tech</span>
          <div>
            <h3 class="text-lg font-bold text-on-surface">Top Customers & Loyalty VIPs</h3>
            <p class="text-xs text-on-surface-variant mt-0.5">Top lifetime spenders and highest frequency diners</p>
          </div>
        </div>
        <div class="flex items-center gap-space-sm">
          <a href="#customer-insights" class="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            View All Diners (${customers.length}) <span class="material-symbols-outlined text-xs">arrow_forward</span>
          </a>
        </div>
      </div>

      <!-- VIP Diners Table or Clean Zero State -->
      ${customers.length === 0 ? `
        <div class="py-10 px-4 text-center flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-container-low/40 border border-outline-variant/20">
          <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black mb-1">
            <span class="material-symbols-outlined text-2xl">point_of_sale</span>
          </div>
          <p class="font-extrabold text-sm text-on-surface">No guest activity recorded yet</p>
          <p class="text-xs text-on-surface-variant max-w-sm">Every new customer visit or POS bill settlement will automatically appear here with real-time lifetime spend and points.</p>
          <div class="flex items-center gap-2 mt-2">
            <button id="btn-quick-pos-empty" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary/90 transition active:scale-95">
              <span class="material-symbols-outlined text-sm">point_of_sale</span>
              <span>⚡ Process First POS Bill</span>
            </button>
            <button id="btn-quick-reg-empty" type="button" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest transition">
              <span class="material-symbols-outlined text-sm">person_add</span>
              <span>+ Register Guest</span>
            </button>
          </div>
        </div>
      ` : `
        <div class="overflow-x-auto rounded-xl border border-outline-variant/20">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-surface-container-low/50 border-b border-outline-variant/30 font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">
                <th class="py-3 px-4">Customer</th>
                <th class="py-3 px-4 text-center">Total Visits</th>
                <th class="py-3 px-4 text-right">Lifetime Spend</th>
                <th class="py-3 px-4 text-right">Points Balance</th>
                <th class="py-3 px-4">Favorite Dish / Last Visited</th>
                <th class="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-outline-variant/20 font-medium">
              ${customers.slice(0, 6).map(cust => `
                <tr 
                  data-customer-id="${cust.id}" 
                  class="customer-row-click hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                >
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-full ${cust.avatarBg} font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                        ${cust.initials}
                      </div>
                      <div>
                        <p class="font-bold text-on-surface text-xs">${cust.name}</p>
                        <p class="text-[11px] text-on-surface-variant">${cust.email}</p>
                      </div>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-center font-bold text-on-surface">
                    <span class="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface">
                      ${cust.visits} visits
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right font-black text-sm text-primary">
                    ${cust.lifetimeSpend}
                  </td>
                  <td class="py-3 px-4 text-right font-bold text-on-surface">
                    ${cust.pointsBalance}
                  </td>
                  <td class="py-3 px-4">
                    <span class="font-bold text-on-surface text-xs">${cust.favoriteDish}</span>
                    <span class="block text-[11px] text-outline">${cust.lastVisit}</span>
                  </td>
                  <td class="py-3 px-4 text-center">
                    <button 
                      type="button" 
                      class="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-primary hover:text-white text-on-surface text-[11px] font-bold transition-all shadow-sm"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

export function attachVIPTableListeners() {
  const quickPosBtn = document.getElementById('btn-quick-pos-empty');
  if (quickPosBtn) {
    quickPosBtn.onclick = () => store.setUIState({ activeModal: 'posTerminal' });
  }

  const quickRegBtn = document.getElementById('btn-quick-reg-empty');
  if (quickRegBtn) {
    quickRegBtn.onclick = () => store.setUIState({ activeModal: 'registerCustomer' });
  }

  document.querySelectorAll('.customer-row-click').forEach(row => {
    row.onclick = () => {
      const customerId = row.getAttribute('data-customer-id');
      const cust = store.getState().customers.find(c => c.id === customerId);
      if (cust) {
        store.setUIState({
          selectedCustomer: cust,
          activeModal: 'customerDrawer'
        });
      }
    };
  });
}
