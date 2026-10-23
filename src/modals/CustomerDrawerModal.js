// Customer Slide-Over Profile Drawer Modal
import { store } from '../state/store.js';

export function renderCustomerDrawer(customer) {
  if (!customer) return '';

  return `
    <div id="customerDrawerOverlay" class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end animate-fade-in">
      <div 
        id="customerDrawerContent"
        class="bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto flex flex-col justify-between animate-slide-right border-l border-slate-200"
        onclick="event.stopPropagation()"
      >
        <!-- Header -->
        <div class="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full ${customer.avatarBg} font-bold text-base flex items-center justify-center shadow-sm">
              ${customer.initials}
            </div>
            <div>
              <h2 class="text-lg font-black text-slate-900">${customer.name}</h2>
              <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${customer.tierBadge}">
                ${customer.status} • Joined ${customer.joinedDate}
              </span>
            </div>
          </div>
          <button id="btn-close-customer-drawer" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition" type="button">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="p-6 space-y-6">
          <!-- Key Metrics Grid -->
          <div class="grid grid-cols-3 gap-3">
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Spend</span>
              <span class="text-base font-black text-primary">${customer.lifetimeSpend}</span>
            </div>
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span class="text-[10px] uppercase font-bold text-slate-400 block">Total Visits</span>
              <span class="text-base font-black text-slate-900">${customer.visits}</span>
            </div>
            <div class="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span class="text-[10px] uppercase font-bold text-slate-400 block">Points Bal.</span>
              <span class="text-base font-black text-emerald-700">${customer.pointsBalance}</span>
            </div>
          </div>

          <!-- Contact Details -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-medium">Mobile Phone:</span>
              <span class="font-bold text-slate-900 font-mono">${customer.phone}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-medium">Email Address:</span>
              <span class="font-bold text-slate-900">${customer.email}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-medium">Favorite Dish:</span>
              <span class="font-bold text-primary">${customer.favoriteDish}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-medium">Rewards Claimed:</span>
              <span class="font-bold text-slate-900">${customer.totalRedeemed}</span>
            </div>
          </div>

          <!-- Dining & Order History -->
          <div>
            <h3 class="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Recent Dining Receipts</h3>
            <div class="space-y-2.5">
              ${(customer.recentOrders || []).map(ord => `
                <div class="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-sm">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-slate-900">${ord.id}</span>
                      <span class="text-[10px] text-slate-400">${ord.date}</span>
                    </div>
                    <div class="text-[11px] text-slate-600 mt-0.5">${ord.items}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-black text-slate-900">${ord.total}</div>
                    <div class="text-[10px] font-bold text-emerald-700">+${ord.pointsEarned} pts</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="p-6 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
          <button 
            type="button" 
            class="flex-1 py-2.5 px-3 rounded-xl bg-primary text-white font-bold text-xs shadow hover:bg-primary/90 transition text-center"
            onclick="window.showToast('Complimentary 200 bonus points issued to ${customer.name}!')"
          >
            Gift 200 Bonus Pts
          </button>
          <button 
            type="button" 
            class="flex-1 py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-white transition text-center"
            onclick="window.showToast('Win-back WhatsApp notification queued for ${customer.name}')"
          >
            Send WhatsApp
          </button>
        </div>
      </div>
    </div>
  `;
}

export function attachCustomerDrawerListeners() {
  const closeBtn = document.getElementById('btn-close-customer-drawer');
  if (closeBtn) {
    closeBtn.onclick = () => {
      store.setUIState({ activeModal: null, selectedCustomer: null });
    };
  }

  const overlay = document.getElementById('customerDrawerOverlay');
  if (overlay) {
    overlay.onclick = () => {
      store.setUIState({ activeModal: null, selectedCustomer: null });
    };
  }
}
