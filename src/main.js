import './utils/toast.js';
import { store } from './state/store.js';
import { renderSidebar, attachSidebarListeners } from './layout/Sidebar.js';
import { renderHeader, attachHeaderListeners } from './layout/Header.js';
import { renderActiveModal, attachActiveModalListeners } from './modals/index.js';

// Lazy-loaded view modules - enables code-splitting
const viewLoaders = {
  dashboard: () => import('./views/dashboard/index.js'),
  'customer-insights': () => import('./views/customers/index.js'),
  customers: () => import('./views/customers/index.js'),
  customer: () => import('./views/customers/index.js'),
  insights: () => import('./views/customers/index.js'),
  loyalty: () => import('./views/loyalty/index.js'),
  'activate-loyalty': () => import('./views/loyalty/index.js'),
  campaigns: () => import('./views/campaigns/index.js'),
  'auto-campaigns': () => import('./views/other/index.js'),
  'qr-codes': () => import('./views/other/index.js'),
  feedback: () => import('./views/other/index.js'),
  referrals: () => import('./views/other/index.js'),
  settings: () => import('./views/other/index.js'),
  'loyalty-settings': () => import('./views/settings/loyaltySettings.js'),
  'roi-simulator': () => import('./views/settings/loyaltySettings.js'),
  'customer-portal': () => import('./views/customer/portal.js'),
  'my-rewards': () => import('./views/customer/portal.js'),
  'meta-review': () => import('./views/settings/metaAppReview.js'),
  'meta-app-review': () => import('./views/settings/metaAppReview.js'),
  'billing-terminal': () => import('./views/billing/index.js'),
  'cashier-billing': () => import('./views/billing/index.js'),
  integrations: () => import('./views/integrations/index.js'),
  'apps-integrations': () => import('./views/integrations/index.js'),
  'pos-integration': () => import('./views/integrations/index.js'),
  configurator: () => import('./views/configurator/index.js'),
  login: () => import('./views/auth/login.js'),
  'super-admin': () => import('./views/admin/superAdmin.js'),
  'smart-insights': () => import('./views/other/smartInsights.js')
};

// Cache for loaded view modules
const viewModuleCache = new Map();

async function loadViewModule(route) {
  if (viewModuleCache.has(route)) {
    return viewModuleCache.get(route);
  }
  const loader = viewLoaders[route];
  if (!loader) {
    // Default to dashboard
    const mod = await import('./views/dashboard/index.js');
    viewModuleCache.set(route, mod);
    return mod;
  }
  const mod = await loader();
  viewModuleCache.set(route, mod);
  return mod;
}

class YeezyLoyaltyApp {
  constructor() {
    this.store = store;
    this.currentLayout = null;
    this.isUserScrolling = false;
    this.scrollTimeout = null;
    this.lastRenderedRoute = null;
    this.lastRenderedModal = null;
    this.lastContentHtml = null;

    // Passive scroll detection to prevent any frame drops or sync interruptions
    window.addEventListener('scroll', () => {
      this.isUserScrolling = true;
      if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.isUserScrolling = false;
      }, 250);
    }, { passive: true });

    // React to store state changes
    this.store.subscribe(() => {
      this.render();
    });

    // Hash-based routing
    const handleRoute = () => {
      const route = this.store.getRouteFromHash();
      if (route === 'petpooja-setup' || route === 'petpooja-integration') {
        this.store.setUIState({
          currentRoute: 'integrations',
          activeModal: 'petpoojaIntegration'
        });
        return;
      }
      if (route === 'apps-integrations') {
        this.store.setUIState({
          currentRoute: 'integrations',
          activeModal: null
        });
        return;
      }
      this.store.setUIState({
        currentRoute: route,
        activeModal: null
      });
    };

    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    const initialRoute = this.store.getRouteFromHash();
    if (initialRoute === 'petpooja-setup' || initialRoute === 'petpooja-integration') {
      this.store.setUIState({
        currentRoute: 'integrations',
        activeModal: 'petpoojaIntegration'
      });
    } else if (initialRoute === 'apps-integrations') {
      this.store.setUIState({
        currentRoute: 'integrations',
        activeModal: null
      });
    }

    // Track last user activity to avoid interrupting active interactions
    this.lastUserActionTime = Date.now();
    ['keydown', 'mousedown', 'input', 'pointerdown', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, () => { this.lastUserActionTime = Date.now(); }, { passive: true });
    });

    // Initial background sync with Petpooja POS & backend database
    this.store.syncWithBackend();

    // Background sync runs only when user has been idle for at least 15 seconds
    setInterval(() => {
      const isIdle = Date.now() - this.lastUserActionTime > 15000;
      const isInputActive = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (document.visibilityState === 'visible' && !this.isUserScrolling && isIdle && !isInputActive) {
        this.store.syncWithBackend();
      }
    }, 30000);

    // Sync when returning to tab
    window.addEventListener('focus', () => {
      const isInputActive = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
      if (!isInputActive) {
        this.store.syncWithBackend();
      }
    });

    this.render().catch(err => console.error('[Render Error]', err));
  }

  async render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    // Capture active element before re-render to preserve user cursor & focus
    const activeEl = document.activeElement;
    let activeSelector = null;
    let selStart = null;
    let selEnd = null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
      if (activeEl.id) {
        activeSelector = `#${activeEl.id}`;
      } else if (activeEl.getAttribute('data-tier-id') && activeEl.getAttribute('data-tier-field')) {
        activeSelector = `[data-tier-id="${activeEl.getAttribute('data-tier-id')}"][data-tier-field="${activeEl.getAttribute('data-tier-field')}"]`;
      }
      selStart = activeEl.selectionStart;
      selEnd = activeEl.selectionEnd;
    }

    const state = this.store.getState();
    const uiState = this.store.getUIState();
    const route = uiState.currentRoute;

    const isPublicCustomerRoute = route === 'customer-portal' || route === 'my-rewards' || route === 'rewards' || route === 'pass' || route === 'card';

    // Require staff authentication for backend dashboard, except login & public customer portal
    const token = localStorage.getItem('yeezy_auth_token');
    if (!token && route !== 'login' && !isPublicCustomerRoute) {
      window.location.hash = '#login';
      return;
    }

    // Public Customer Portal View
    if (isPublicCustomerRoute) {
      this.currentLayout = 'customer-portal';
      const { renderCustomerPortal, attachCustomerPortalListeners } = await loadViewModule('customer-portal');
      appEl.innerHTML = renderCustomerPortal(state);
      attachCustomerPortalListeners();
      return;
    }

    // Full screen login view
    if (route === 'login') {
      this.currentLayout = 'login';
      const { renderLoginView, attachLoginListeners } = await loadViewModule('login');
      appEl.innerHTML = renderLoginView();
      attachLoginListeners();
      return;
    }

    const isConfiguratorMode = route === 'configurator';

    if (isConfiguratorMode) {
      this.currentLayout = 'configurator';
      const { renderConfigurator } = await loadViewModule('configurator');
      appEl.innerHTML = `
        <div class="min-h-screen bg-[#f5f8f9]">
          ${renderConfigurator(state, uiState.configuratorStep, uiState.configuratorPanel)}
          ${renderActiveModal(state, uiState)}
        </div>
      `;
      this.attachEventListeners(route, true, uiState);
      return;
    }

    // Generate main view content
    let mainContentHtml = '';
    const viewModule = await loadViewModule(route);
    switch (route) {
      case 'super-admin':
        if (state.user?.role !== 'SUPER_ADMIN') {
          window.showToast?.('Access Denied: Super Admin account required');
          window.location.hash = '#dashboard';
          return;
        }
        mainContentHtml = viewModule.renderSuperAdminView(state);
        break;
      case 'dashboard':
        mainContentHtml = viewModule.renderDashboard(state);
        break;
      case 'smart-insights':
        mainContentHtml = viewModule.renderSmartInsightsView(state);
        break;
      case 'customer-insights':
      case 'customers':
      case 'customer':
      case 'insights':
        mainContentHtml = viewModule.renderCustomerInsights(state, uiState.customerFilters);
        break;
      case 'loyalty':
      case 'activate-loyalty':
        mainContentHtml = viewModule.renderActivateLoyalty(state);
        break;
      case 'campaigns':
        mainContentHtml = viewModule.renderCampaignsView(state);
        break;
      case 'auto-campaigns':
        mainContentHtml = viewModule.renderAutoCampaignsView(state);
        break;
      case 'qr-codes':
        mainContentHtml = viewModule.renderQRCodesView(state);
        break;
      case 'feedback':
        mainContentHtml = viewModule.renderFeedbackView();
        break;
      case 'referrals':
        mainContentHtml = viewModule.renderReferralsView();
        break;
      case 'settings':
        mainContentHtml = viewModule.renderSettingsView(state);
        break;
      case 'loyalty-settings':
      case 'roi-simulator':
        mainContentHtml = viewModule.renderLoyaltySettingsView(state);
        break;
      case 'customer-portal':
      case 'my-rewards':
        mainContentHtml = viewModule.renderCustomerPortal(state);
        break;
      case 'meta-review':
      case 'meta-app-review':
        mainContentHtml = viewModule.renderMetaAppReviewView(state);
        break;
      case 'billing-terminal':
      case 'cashier-billing':
      case 'integrations':
      case 'apps-integrations':
      case 'pos-integration':
        mainContentHtml = viewModule.renderAppsIntegrationsView(state);
        break;
      default:
        mainContentHtml = viewModule.renderDashboard(state);
    }

    const modalHtml = renderActiveModal(state, uiState);
    const mainViewEl = document.getElementById('main-content-view');
    const modalsRootEl = document.getElementById('modals-root');

    // In-place fast path: Shell is already mounted! Update only view or modal, keeping scroll intact!
    if (this.currentLayout === 'standard' && mainViewEl && modalsRootEl) {
      // If user is currently focused on an active input/textarea/select on the same route, protect it from being wiped
      const isInputActive = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
      if (isInputActive && this.lastRenderedRoute === route) {
        return;
      }

      // Update Main View only if content or route changed
      if (this.lastRenderedRoute !== route || this.lastContentHtml !== mainContentHtml) {
        mainViewEl.innerHTML = mainContentHtml;
        this.lastContentHtml = mainContentHtml;
        this.lastRenderedRoute = route;
        this.currentViewModule = viewModule;
        this.attachViewListeners(route);

        // Update active class strictly on sidebar navigation links (avoiding the brand logo or footer help links)
        document.querySelectorAll('#app-shell aside nav a[data-path], #mobile-sidebar-drawer nav a[data-path]').forEach(a => {
          const href = a.getAttribute('href');
          const isCurrent = href === `#${route}`;
          const isHighlight = href === '#campaigns' || href === '#loyalty' || href === '#activate-loyalty';
          if (isCurrent) {
            if (isHighlight) {
              a.className = 'flex items-center justify-between px-space-md py-2.5 rounded-xl transition-all bg-[#e8f4f3] text-[#167a70] font-label-lg font-bold shadow-xs';
            } else {
              a.className = 'flex items-center justify-between px-space-md py-2.5 rounded-xl transition-all bg-primary-container text-on-primary-container font-label-lg font-bold shadow-sm';
            }
          } else {
            a.className = 'flex items-center justify-between px-space-md py-2.5 rounded-xl transition-all text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface font-medium';
          }
          const icon = a.querySelector('.material-symbols-outlined');
          if (icon) {
            if (isCurrent) {
              icon.className = `material-symbols-outlined text-[20px] ${isHighlight ? 'text-[#167a70]' : 'text-primary'}`;
            } else {
              icon.className = 'material-symbols-outlined text-[20px] text-on-surface-variant';
            }
          }
        });
      }

      // Update Modal container only if active modal changed
      const currentModalKey = uiState.activeModal || 'none';
      if (this.lastRenderedModal !== currentModalKey) {
        modalsRootEl.innerHTML = modalHtml;
        this.lastRenderedModal = currentModalKey;
        attachActiveModalListeners(uiState);
      }

      this.restoreInputFocus(activeSelector, selStart, selEnd);
      return;
    }

    // First mount of standard shell
    this.currentLayout = 'standard';
    this.lastRenderedRoute = route;
    this.lastRenderedModal = uiState.activeModal || 'none';
    this.lastContentHtml = mainContentHtml;
    this.currentViewModule = viewModule;

    appEl.innerHTML = `
      <div id="app-shell" class="min-h-screen bg-background font-body-md text-on-surface antialiased flex flex-col">
        <!-- Desktop Sidebar -->
        <div class="hidden md:block">
          ${renderSidebar(route)}
        </div>
        
        <!-- Mobile Sidebar Drawer -->
        <div id="mobile-sidebar-drawer" class="${uiState.mobileSidebarOpen ? 'block' : 'hidden'} md:hidden fixed inset-0 z-50 bg-black/60">
          <div class="w-64 h-full bg-white relative">
            ${renderSidebar(route)}
            <button id="close-mobile-sidebar-btn" class="absolute top-4 right-4 text-slate-700 p-1" type="button">
              <span class="material-symbols-outlined text-2xl">close</span>
            </button>
          </div>
        </div>

        <!-- Main Layout Area with Left Padding for Sidebar -->
        <div class="md:pl-64 flex-1 flex flex-col min-h-screen">
          ${renderHeader(state)}

          <main id="main-content-view" class="w-full pt-16 bg-background flex-1 pb-16">
            ${mainContentHtml}
          </main>
        </div>

        <!-- Modals Container -->
        <div id="modals-root">
          ${modalHtml}
        </div>
      </div>
    `;

    this.attachEventListeners(route, false, uiState);
    this.restoreInputFocus(activeSelector, selStart, selEnd);
  }

  restoreInputFocus(activeSelector, selStart, selEnd) {
    if (activeSelector) {
      const restored = document.querySelector(activeSelector);
      if (restored && (restored.tagName === 'INPUT' || restored.tagName === 'TEXTAREA')) {
        restored.focus();
        if (typeof selStart === 'number' && typeof selEnd === 'number' && restored.setSelectionRange) {
          try {
            restored.setSelectionRange(selStart, selEnd);
          } catch (_) {}
        }
      }
    }
  }

  attachViewListeners(route) {
    const vm = this.currentViewModule;
    if (!vm) return;

    switch (route) {
      case 'super-admin':
        vm.attachSuperAdminListeners?.();
        break;
      case 'dashboard':
        vm.attachDashboardListeners?.();
        break;
      case 'customer-insights':
      case 'customers':
      case 'customer':
      case 'insights':
        vm.attachCustomerInsightsListeners?.();
        break;
      case 'campaigns':
        vm.attachCampaignsListeners?.();
        break;
      case 'loyalty':
      case 'activate-loyalty':
        vm.attachActivateLoyaltyListeners?.();
        break;
      case 'settings':
        vm.attachSettingsListeners?.();
        break;
      case 'billing-terminal':
      case 'cashier-billing':
        vm.attachBillingScreenListeners?.();
        break;
      case 'loyalty-settings':
      case 'roi-simulator':
        vm.attachLoyaltySettingsListeners?.();
        break;
      case 'customer-portal':
      case 'my-rewards':
        vm.attachCustomerPortalListeners?.();
        break;
      case 'meta-review':
      case 'meta-app-review':
        vm.attachMetaAppReviewListeners?.();
        break;
      case 'integrations':
      case 'apps-integrations':
      case 'pos-integration':
        vm.attachAppsIntegrationsListeners?.();
        break;
    }
  }

  attachEventListeners(route, isConfiguratorMode, uiState) {
    if (isConfiguratorMode) {
      attachConfiguratorListeners();
    } else {
      attachSidebarListeners();
      attachHeaderListeners();
      this.attachViewListeners(route);
    }

    attachActiveModalListeners(uiState);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.yeezyApp = new YeezyLoyaltyApp();
});

// Global error handler - catches uncaught errors to prevent app crash
window.addEventListener('error', (e) => {
  console.error('[Yeezy App Error]', e.error || e.message);
  if (window.showToast) {
    window.showToast('Something went wrong. Please refresh the page.', 'error');
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Yeezy Unhandled Rejection]', e.reason);
  e.preventDefault(); // Prevent default browser error dialog
  if (window.showToast) {
    window.showToast('Network error. Please check connection.', 'error');
  }
});
