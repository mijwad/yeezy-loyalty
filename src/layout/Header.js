// Fixed Header Layout Component with co-located event handling
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { exportToCSV } from '../utils/exportCsv.js';

export function renderHeader(state) {
  const { activeOutlet, outlets, user } = state;

  return `
    <header class="fixed top-0 left-0 md:left-64 right-0 h-16 bg-white/98 shadow-[0_1px_4px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-lg border-b border-outline-variant/20 hardware-accelerated">
      <!-- Left: Outlet Selector & Navigation Link -->
      <div class="flex items-center gap-space-md">
        <!-- Mobile hamburger -->
        <button id="mobile-menu-trigger" class="md:hidden text-on-surface p-1 rounded-lg hover:bg-surface-container-high">
          <span class="material-symbols-outlined text-2xl">menu</span>
        </button>

        <!-- Store Selector Pill with Dropdown -->
        <div class="relative" id="outlet-dropdown-wrapper">
          <button 
            id="outlet-selector-btn"
            type="button" 
            class="flex items-center gap-space-xs px-3.5 py-1.5 bg-surface-container-low rounded-full cursor-pointer hover:bg-surface-container-high transition-colors border border-outline-variant/30 text-sm"
          >
            <span class="material-symbols-outlined text-primary text-[18px]">storefront</span>
            <span class="font-bold text-on-surface text-xs md:text-sm tracking-tight" id="current-outlet-name">${activeOutlet}</span>
            <span class="material-symbols-outlined text-on-surface-variant text-[16px]">expand_more</span>
          </button>

          <!-- Dropdown Menu -->
          <div 
            id="outlet-dropdown-menu" 
            class="hidden absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-outline-variant/30 py-2 z-50 animate-fade-in"
          >
            <div class="px-4 py-2 border-b border-outline-variant/20">
              <span class="text-[11px] font-bold uppercase text-on-surface-variant tracking-wider">Select Restaurant Outlet</span>
            </div>
            ${outlets.map(o => `
              <button 
                type="button"
                data-outlet-name="${o.name}"
                class="outlet-option-btn w-full text-left px-4 py-2.5 flex items-start gap-2.5 hover:bg-surface-container-low transition-colors ${o.name === activeOutlet ? 'bg-primary-fixed/30 font-bold text-primary' : 'text-on-surface'}"
              >
                <span class="material-symbols-outlined text-lg mt-0.5 ${o.name === activeOutlet ? 'text-primary' : 'text-outline'}">
                  ${o.name === activeOutlet ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                <div>
                  <div class="text-xs font-bold leading-tight">${o.name}</div>
                  <div class="text-[11px] text-on-surface-variant mt-0.5">${o.address}</div>
                </div>
              </button>
            `).join('')}
            <div class="p-2 border-t border-outline-variant/20">
              <button 
                id="btn-add-outlet"
                type="button" 
                class="w-full text-center py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary-fixed/20 transition-colors flex items-center justify-center gap-1"
                onclick="window.showToast('Adding new outlet feature coming soon!')"
              >
                <span class="material-symbols-outlined text-sm">add_business</span>
                Add New Outlet
              </button>
            </div>
          </div>
        </div>

        <a 
          class="font-semibold text-xs text-on-surface-variant hover:text-primary transition-colors hidden lg:inline-flex items-center gap-1" 
          href="#customer-insights"
        >
          <span>Customer Lifecycle</span>
          <span class="text-[10px] bg-tertiary-fixed text-on-tertiary-fixed font-bold px-1.5 py-0.2 rounded-full">New</span>
        </a>
      </div>

      <!-- Right: Action CTA, Notifications, Profile -->
      <div class="flex items-center gap-space-md">
        <!-- Loyalty Status Pill -->
        <a 
          href="#loyalty" 
          class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition shadow-sm"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Loyalty Program Active</span>
        </a>

        <!-- Petpooja Marketplace Integration (Exact Reelo flow) -->
        <button 
          id="btn-open-petpooja-setup"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 md:py-2 ${state.isPetpoojaIntegrated ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-surface-container-low hover:bg-surface-container-high text-on-surface border-outline-variant/30'} font-extrabold text-xs rounded-full border transition-all shadow-xs active:scale-95" 
          type="button"
          title="${state.isPetpoojaIntegrated ? `Petpooja POS Connected (${state.petpoojaRestID || 'PP_DEL_101'})` : 'Integrate on Petpooja Marketplace'}"
        >
          <span class="w-2 h-2 rounded-full ${state.isPetpoojaIntegrated ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
          <span>${state.isPetpoojaIntegrated ? `Petpooja Connected (${state.petpoojaRestID || 'PP_DEL_101'})` : 'Petpooja Setup'}</span>
        </button>



        <!-- Notifications Bell -->
        <div class="relative" id="notifications-wrapper">
          <button 
            id="notifications-btn"
            class="relative p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-full hover:bg-surface-container-high" 
            type="button"
            aria-label="Notifications"
          >
            <span class="material-symbols-outlined text-[22px]">notifications</span>
            <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#fc79bd] ring-2 ring-surface-container-lowest"></span>
          </button>

          <!-- Notifications Dropdown -->
          <div 
            id="notifications-menu" 
            class="hidden absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-outline-variant/30 py-3 z-50 animate-fade-in"
          >
            <div class="px-4 pb-2 border-b border-outline-variant/20 flex items-center justify-between">
              <span class="text-xs font-bold text-on-surface">Live Activity Alerts</span>
              <span class="text-[10px] font-bold text-primary cursor-pointer hover:underline" id="mark-notifications-read">Mark all read</span>
            </div>
            <div class="max-h-64 overflow-y-auto divide-y divide-outline-variant/10 text-xs">
              <div class="p-3 hover:bg-surface-container-low transition flex items-start gap-2.5">
                <span class="material-symbols-outlined text-primary text-lg mt-0.5">celebration</span>
                <div>
                  <div class="font-bold text-on-surface">Marcus Chen earned 284 pts</div>
                  <div class="text-[11px] text-on-surface-variant mt-0.5">Order #9021 • Truffle Tagliolini bill of ₹2,840</div>
                  <div class="text-[10px] text-outline mt-1">4 minutes ago</div>
                </div>
              </div>
              <div class="p-3 hover:bg-surface-container-low transition flex items-start gap-2.5">
                <span class="material-symbols-outlined text-secondary text-lg mt-0.5">redeem</span>
                <div>
                  <div class="font-bold text-on-surface">Elena Rostova redeemed voucher</div>
                  <div class="text-[11px] text-on-surface-variant mt-0.5">₹125 OFF Dining Voucher applied</div>
                  <div class="text-[10px] text-outline mt-1">28 minutes ago</div>
                </div>
              </div>
              <div class="p-3 hover:bg-surface-container-low transition flex items-start gap-2.5">
                <span class="material-symbols-outlined text-tertiary text-lg mt-0.5">sms</span>
                <div>
                  <div class="font-bold text-on-surface">Automated SMS sent successfully</div>
                  <div class="text-[11px] text-on-surface-variant mt-0.5">30-day win-back reminder delivered to 14 guests</div>
                  <div class="text-[10px] text-outline mt-1">2 hours ago</div>
                </div>
              </div>
            </div>
            <div class="pt-2 px-4 border-t border-outline-variant/20 text-center">
              <a href="#campaigns" class="text-xs font-bold text-primary hover:underline">View All Broadcast Logs</a>
            </div>
          </div>
        </div>

        <!-- Profile Avatar Dropdown -->
        <div class="relative" id="profile-dropdown-wrapper">
          <div 
            id="profile-avatar-btn"
            class="flex items-center gap-2 pl-space-xs cursor-pointer select-none"
          >
            ${user.role === 'SUPER_ADMIN' 
              ? '<span class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200"><span class="material-symbols-outlined text-xs">shield_person</span> Super Admin</span>'
              : '<span class="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 border border-teal-200"><span class="material-symbols-outlined text-xs">storefront</span> Owner</span>'
            }
            <img 
              alt="Profile" 
              class="w-9 h-9 rounded-full object-cover ring-2 ring-primary-fixed shadow-sm hover:ring-primary transition" 
              src="${user.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPpV2wxw7i8SswByK1AqA_9McvWIk_klOo56Mqrga1PI0CEw0fTKSqVwyxbrIgPKYg69ZUQ1S3q7NMu5Aj6DJ026ke_Us2wN53ZRe5J2t0IjzPF7oRAMjNUxtS68SVby7B23Q3wjaEZANCRikHN0nga7Qjgvj66aE3Eu_Ee2P27BJ38n5Se6Rc6gFfErhrGdi9oNKjsegbnlGejUYcelstKMKxah37AADbD_20vqtcTdA3guZfx_z3eQ'}"
            >
          </div>

          <!-- Profile Dropdown -->
          <div 
            id="profile-menu" 
            class="hidden absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-outline-variant/30 py-3 z-50 animate-fade-in"
          >
            <div class="px-4 pb-2 border-b border-outline-variant/20">
              <div class="font-bold text-xs text-on-surface">${user.name}</div>
              <div class="text-[11px] text-on-surface-variant">${user.email}</div>
              <div class="text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full inline-block ${user.role === 'SUPER_ADMIN' ? 'bg-amber-100 text-amber-800 font-black' : 'bg-primary-fixed/40 text-primary'}">
                ${user.role === 'SUPER_ADMIN' ? '👑 Super Admin' : '🍽️ Restaurant Owner'}
              </div>
            </div>
            <div class="py-1 text-xs">
              ${user.role === 'SUPER_ADMIN' ? `
                <a href="#super-admin" class="flex items-center gap-2 px-4 py-2 hover:bg-amber-50 text-amber-900 font-bold transition">
                  <span class="material-symbols-outlined text-base text-amber-600">shield_person</span>
                  <span>Super Admin Console</span>
                </a>
              ` : `
                <a href="#super-admin" class="flex items-center gap-2 px-4 py-2 hover:bg-surface-container-low text-on-surface transition">
                  <span class="material-symbols-outlined text-base">swap_horiz</span>
                  <span>Switch to Super Admin</span>
                </a>
              `}
              <a href="#settings" class="flex items-center gap-2 px-4 py-2 hover:bg-surface-container-low text-on-surface transition">
                <span class="material-symbols-outlined text-base">settings</span>
                <span>Platform Settings</span>
              </a>
              <button id="btn-export-all-data" type="button" class="w-full flex items-center gap-2 px-4 py-2 hover:bg-surface-container-low text-on-surface transition text-left">
                <span class="material-symbols-outlined text-base">file_download</span>
                <span>Export Guest Data (CSV)</span>
              </button>
            </div>
            <div class="pt-2 px-4 border-t border-outline-variant/20">
              <button 
                id="btn-logout" 
                type="button" 
                class="w-full text-left text-xs font-bold text-red-600 hover:text-red-700 transition flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-base">logout</span>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

export function attachHeaderListeners() {
  const petpoojaSetupBtn = document.getElementById('btn-open-petpooja-setup');
  if (petpoojaSetupBtn) {
    petpoojaSetupBtn.onclick = () => {
      store.setUIState({ activeModal: 'petpoojaIntegration' });
    };
  }



  const outletBtn = document.getElementById('outlet-selector-btn');
  const outletMenu = document.getElementById('outlet-dropdown-menu');
  if (outletBtn && outletMenu) {
    outletBtn.onclick = (e) => {
      e.stopPropagation();
      outletMenu.classList.toggle('hidden');
    };
    document.querySelectorAll('.outlet-option-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const outletName = btn.getAttribute('data-outlet-name');
        if (outletName) {
          store.setState({ activeOutlet: outletName });
          showToast(`Switched active outlet to ${outletName}`);
        }
      };
    });
  }

  const notifBtn = document.getElementById('notifications-btn');
  const notifMenu = document.getElementById('notifications-menu');
  if (notifBtn && notifMenu) {
    notifBtn.onclick = (e) => {
      e.stopPropagation();
      notifMenu.classList.toggle('hidden');
    };
    const markAllRead = document.getElementById('mark-notifications-read');
    if (markAllRead) {
      markAllRead.onclick = () => {
        showToast('All activity notifications marked as read.');
        notifMenu.classList.add('hidden');
      };
    }
  }

  const profileBtn = document.getElementById('profile-avatar-btn');
  const profileMenu = document.getElementById('profile-menu');
  if (profileBtn && profileMenu) {
    profileBtn.onclick = (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle('hidden');
    };
  }

  const bookDemoBtn = document.getElementById('btn-book-demo');
  if (bookDemoBtn) {
    bookDemoBtn.onclick = () => {
      store.setUIState({ activeModal: 'bookDemo' });
    };
  }

  const exportAllBtn = document.getElementById('btn-export-all-data');
  if (exportAllBtn) {
    exportAllBtn.onclick = () => {
      const customers = store.getState().customers;
      const rows = [
        ['Name', 'Email', 'Phone', 'Tier', 'Visits', 'Lifetime Spend', 'Points Balance', 'Favorite Dish', 'Last Visit'],
        ...customers.map(c => [
          c.name, c.email, c.phone, c.tier, c.visits, c.lifetimeSpend, c.pointsBalance, c.favoriteDish, c.lastVisit
        ])
      ];
      exportToCSV('Yeezy_Guest_Directory.csv', rows);
    };
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      localStorage.removeItem('yeezy_auth_token');
      showToast('Signed out of Yeezy');
      window.location.hash = '#login';
    };
  }

  // Close menus on outside click
  document.addEventListener('click', () => {
    if (outletMenu) outletMenu.classList.add('hidden');
    if (notifMenu) notifMenu.classList.add('hidden');
    if (profileMenu) profileMenu.classList.add('hidden');
  });
}
