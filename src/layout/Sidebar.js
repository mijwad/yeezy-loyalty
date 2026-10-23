// Navigation Sidebar Layout Component
import { store } from '../state/store.js';

export function renderSidebar(currentPath = 'dashboard') {
  const userRole = store.getState().user?.role;
  const navItems = [
    ...(userRole === 'SUPER_ADMIN' ? [{ path: 'super-admin', label: 'Super Admin', icon: 'shield_person', badge: 'Admin' }] : []),
    { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { path: 'billing-terminal', label: 'Cashier POS', icon: 'point_of_sale', badge: 'POS' },
    { path: 'customer-portal', label: 'Diner Rewards', icon: 'redeem' },
    { path: 'loyalty-settings', label: 'ROI & Settings', icon: 'finance', badge: 'ROI' },
    { path: 'smart-insights', label: 'Smart Insights', icon: 'insights' },
    { path: 'campaigns', label: 'Campaigns', icon: 'campaign' },
    { path: 'customer-insights', label: 'Customer Insights', icon: 'group' },
    { path: 'integrations', label: 'Apps & Integrations', icon: 'hub', badge: store.getState().isPetpoojaIntegrated ? 'Connected' : 'Active' },
    { path: 'loyalty', label: 'Loyalty', icon: 'card_membership', badge: 'Active' },
    { path: 'auto-campaigns', label: 'Auto Campaigns', icon: 'magic_button' },
    { path: 'feedback', label: 'Feedback', icon: 'reviews' },
    { path: 'qr-codes', label: 'QR Codes', icon: 'qr_code_2' },
    { path: 'referrals', label: 'Referrals', icon: 'share' },
    { path: 'settings', label: 'Settings', icon: 'settings' }
  ];

  return `
    <aside class="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between select-none">
      <div class="flex flex-col">
        <!-- Brand Header -->
        <div class="h-16 px-space-lg flex items-center justify-between border-b border-outline-variant/20">
          <a href="#dashboard" class="flex items-center gap-space-sm hover:opacity-90 transition">
            <div class="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-black text-base shadow-sm">
              Y
            </div>
            <div class="flex flex-col">
              <span class="font-headline-md text-lg text-primary tracking-tight font-extrabold leading-none">Yeezy</span>
              <span class="text-[10px] text-on-surface-variant font-semibold tracking-wider uppercase mt-0.5">Loyalty Platform</span>
            </div>
          </a>
          <button id="sidebar-toggle-btn" class="text-on-surface-variant hover:text-on-surface p-space-xs rounded-lg transition-colors md:hidden" type="button" aria-label="Toggle menu">
            <span class="material-symbols-outlined text-title-md">menu_open</span>
          </button>
        </div>

        <!-- Navigation Links -->
        <nav class="px-space-md py-space-sm flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-190px)]">
          ${navItems.map(item => {
            const isActive = currentPath === item.path || 
              (item.path === 'integrations' && ['integrations', 'apps-integrations', 'petpooja-setup'].includes(currentPath)) ||
              (item.path === 'loyalty' && ['activate-loyalty', 'configurator', 'reminder-expiry', 'channels', 'review-activate'].includes(currentPath));
            
            const activeClasses = 'bg-primary-container text-on-primary-container font-label-lg font-bold shadow-sm';
            const inactiveClasses = 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-medium';
            
            return `
              <a 
                href="#${item.path}" 
                data-path="${item.path}" 
                class="flex items-center justify-between px-space-md py-2.5 rounded-xl transition-all ${isActive ? activeClasses : inactiveClasses}"
              >
                <div class="flex items-center gap-space-sm">
                  <span class="material-symbols-outlined text-[20px] ${isActive ? 'text-primary' : 'text-on-surface-variant'}">${item.icon}</span>
                  <span class="text-sm tracking-tight">${item.label}</span>
                </div>
                ${item.badge ? `
                  <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary text-white' : 'bg-primary-fixed text-on-primary-fixed'}">
                    ${item.badge}
                  </span>
                ` : ''}
              </a>
            `;
          }).join('')}
        </nav>
      </div>

      <!-- Bottom Help & Switch Action -->
      <div class="p-space-md flex flex-col gap-space-sm bg-surface-container-low/60 m-space-md rounded-2xl border border-outline-variant/30">
        <button 
          id="btn-switch-old-dashboard"
          class="w-full flex items-center justify-center gap-space-xs py-2 px-space-md rounded-xl bg-surface-container-lowest text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold shadow-xs border border-outline-variant/30" 
          type="button"
          onclick="window.showToast('You are already using the upgraded Yeezy 2.0 experience!')"
        >
          <span class="material-symbols-outlined text-sm">history</span>
          <span>Legacy View</span>
        </button>
        <a 
          class="flex items-center justify-center gap-space-xs py-1 text-on-surface-variant hover:text-primary transition-colors text-xs font-medium" 
          href="#settings"
        >
          <span class="material-symbols-outlined text-xs">help</span>
          <span>Need help? 24/7 Support</span>
        </a>
      </div>
    </aside>
  `;
}

export function attachSidebarListeners() {
  const mobileMenuTrigger = document.getElementById('mobile-menu-trigger');
  if (mobileMenuTrigger) {
    mobileMenuTrigger.onclick = () => {
      store.setUIState({ mobileSidebarOpen: true });
    };
  }

  const closeMobileSidebarBtn = document.getElementById('close-mobile-sidebar-btn');
  if (closeMobileSidebarBtn) {
    closeMobileSidebarBtn.onclick = () => {
      store.setUIState({ mobileSidebarOpen: false });
    };
  }
}
