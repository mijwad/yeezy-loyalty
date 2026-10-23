// Register New Customer Modal
import { store } from '../state/store.js';
import { apiUrl } from '../config/api.js';

export function renderRegisterCustomerModal() {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div class="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl border border-outline-variant/30 overflow-hidden flex flex-col">
        
        <!-- Header -->
        <div class="bg-gradient-to-r from-teal-700 to-emerald-800 text-white px-6 py-5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-black">
              <span class="material-symbols-outlined text-lg">person_add</span>
            </div>
            <div>
              <h2 class="text-base font-extrabold tracking-tight">Register New Diner</h2>
              <p class="text-xs text-emerald-100">Instantly grant welcome bonus points</p>
            </div>
          </div>
          <button 
            id="btn-close-register-modal" 
            type="button" 
            class="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <!-- Form Body -->
        <form id="form-register-customer" class="p-6 flex flex-col gap-4 text-xs">
          <div>
            <label class="block text-[11px] font-bold text-on-surface uppercase tracking-wider mb-1">Mobile Number *</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold text-xs">+91</span>
              <input 
                id="reg-input-phone" 
                type="tel" 
                maxlength="10" 
                required 
                placeholder="9876543210"
                class="w-full pl-12 pr-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low font-bold text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-on-surface uppercase tracking-wider mb-1">Guest Full Name *</label>
            <input 
              id="reg-input-name" 
              type="text" 
              required 
              placeholder="e.g. Meera Kapoor"
              class="w-full px-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low font-bold text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white"
            />
          </div>

          <div>
            <label class="block text-[11px] font-bold text-on-surface uppercase tracking-wider mb-1">Email Address</label>
            <input 
              id="reg-input-email" 
              type="email" 
              placeholder="guest@example.com"
              class="w-full px-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface-container-low font-bold text-on-surface text-xs focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white"
            />
          </div>

          <div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="material-symbols-outlined text-emerald-600">stars</span>
              <span class="text-emerald-900 font-bold text-xs">Initial Welcome Bonus</span>
            </div>
            <span class="text-xs font-black text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200">
              +100 Points
            </span>
          </div>

          <div class="pt-2 flex items-center justify-end gap-2.5">
            <button 
              id="btn-cancel-register" 
              type="button" 
              class="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold text-xs transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-extrabold text-xs transition flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <span class="material-symbols-outlined text-sm">how_to_reg</span>
              <span>Register Guest</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  `;
}

export function attachRegisterCustomerModalListeners() {
  const closeBtn = document.getElementById('btn-close-register-modal');
  const cancelBtn = document.getElementById('btn-cancel-register');
  if (closeBtn) closeBtn.onclick = () => store.setUIState({ activeModal: null });
  if (cancelBtn) cancelBtn.onclick = () => store.setUIState({ activeModal: null });

  const form = document.getElementById('form-register-customer');
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const phone = document.getElementById('reg-input-phone')?.value.replace(/\D/g, '');
      const name = document.getElementById('reg-input-name')?.value.trim();
      const email = document.getElementById('reg-input-email')?.value.trim() || `${phone}@guest.yeezy.app`;

      if (!phone || phone.length < 10) {
        window.showToast('Please enter a valid 10-digit mobile number');
        return;
      }
      if (!name) {
        window.showToast('Please enter guest full name');
        return;
      }

      // Backend sync
      try {
        await fetch(apiUrl('/api/v1/customers'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, name, email })
        });
      } catch (err) {
        console.warn('Backend customer reg error:', err);
      }

      // Local store update
      store.setState(prev => {
        const customers = [...prev.customers];
        const newCustomer = {
          id: `cust-${Date.now()}`,
          name,
          email,
          phone: `+91 ${phone}`,
          initials: name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'VG',
          avatarBg: 'bg-primary text-on-primary',
          tier: 'New',
          tierBadge: 'bg-surface-container-high text-on-surface',
          visits: 0,
          lifetimeSpend: '₹0',
          numericSpend: 0,
          pointsBalance: '100 pts',
          numericPoints: 100,
          favoriteDish: 'Chef Special',
          lastVisit: 'Registered today',
          lastVisitDate: new Date().toISOString().slice(0, 10),
          status: 'New Guest',
          joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          totalRedeemed: '0 Rewards',
          recentOrders: []
        };
        customers.unshift(newCustomer);

        return {
          ...prev,
          customers,
          todayStats: {
            ...prev.todayStats,
            customers: customers.length,
            activeMembers: customers.length,
            activeMembersGrowth: `+${customers.length}`
          }
        };
      });

      store.setUIState({ activeModal: null });
      window.showToast(`✨ Guest ${name} registered with 100 welcome points!`);
    };
  }
}
