import './utils/toast.js';
import { store } from './state/store.js';
import { renderSidebar, attachSidebarListeners } from './layout/Sidebar.js';
import { renderHeader, attachHeaderListeners } from './layout/Header.js';
import { renderActiveModal, attachActiveModalListeners } from './modals/index.js';

// Feature Views
import { renderDashboard, attachDashboardListeners } from './views/dashboard/index.js';
import { renderCustomerInsights, attachCustomerInsightsListeners } from './views/customers/index.js';
import { renderActivateLoyalty, attachActivateLoyaltyListeners } from './views/loyalty/index.js';
import { renderConfigurator, attachConfiguratorListeners } from './views/configurator/index.js';
import { 
  renderAutoCampaignsView, 
  renderQRCodesView, 
  renderFeedbackView, 
  renderReferralsView, 
  renderSettingsView,
  attachSettingsListeners
} from './views/other/index.js';
import { renderCampaignsView, attachCampaignsListeners } from './views/campaigns/index.js';
import { renderSmartInsightsView } from './views/other/smartInsights.js';
import { renderLoginView, attachLoginListeners } from './views/auth/login.js';
import { renderSuperAdminView, attachSuperAdminListeners } from './views/admin/superAdmin.js';
import { renderAppsIntegrationsView, attachAppsIntegrationsListeners } from './views/integrations/index.js';
import { renderBillingScreen, attachBillingScreenListeners } from './views/billing/index.js';
import { renderCustomerPortal, attachCustomerPortalListeners } from './views/customer/portal.js';
import { renderLoyaltySettingsView, attachLoyaltySettingsListeners } from './views/settings/loyaltySettings.js';
import { renderMetaAppReviewView, attachMetaAppReviewListeners } from './views/settings/metaAppReview.js';

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

    this.render();
  }

  render() {
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

    const isPublicCustomerRoute = route === 'customer-portal' || route === 'my-rewards';

    // Require staff authentication for backend dashboard, except login & public customer portal
    const token = localStorage.getItem('yeezy_auth_token');
    if (!token && route !== 'login' && !isPublicCustomerRoute) {
      window.location.hash = '#login';
      return;
    }

    // Public Customer Portal View
    if (isPublicCustomerRoute) {
      this.currentLayout = 'customer-portal';
      appEl.innerHTML = renderCustomerPortal(state);
      attachCustomerPortalListeners();
      return;
    }

    // Full screen login view
    if (route === 'login') {
      this.currentLayout = 'login';
      appEl.innerHTML = renderLoginView();
      attachLoginListeners();
      return;
    }

    const isConfiguratorMode = route === 'configurator';

    if (isConfiguratorMode) {
      this.currentLayout = 'configurator';
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
    switch (route) {
      case 'super-admin':
        if (state.user?.role !== 'SUPER_ADMIN') {
          window.showToast?.('Access Denied: Super Admin account required');
          window.location.hash = '#dashboard';
          return;
        }
        mainContentHtml = renderSuperAdminView(state);
        break;
      case 'dashboard':
        mainContentHtml = renderDashboard(state);
        break;
      case 'smart-insights':
        mainContentHtml = renderSmartInsightsView(state);
        break;
      case 'customer-insights':
        mainContentHtml = renderCustomerInsights(state, uiState.customerFilters);
        break;
      case 'loyalty':
      case 'activate-loyalty':
        mainContentHtml = renderActivateLoyalty(state);
        break;
      case 'campaigns':
        mainContentHtml = renderCampaignsView(state);
        break;
      case 'auto-campaigns':
        mainContentHtml = renderAutoCampaignsView(state);
        break;
      case 'qr-codes':
        mainContentHtml = renderQRCodesView(state);
        break;
      case 'feedback':
        mainContentHtml = renderFeedbackView();
        break;
      case 'referrals':
        mainContentHtml = renderReferralsView();
        break;
      case 'settings':
        mainContentHtml = renderSettingsView(state);
        break;
      case 'loyalty-settings':
      case 'roi-simulator':
        mainContentHtml = renderLoyaltySettingsView(state);
        break;
      case 'customer-portal':
      case 'my-rewards':
        mainContentHtml = renderCustomerPortal(state);
        break;
      case 'meta-review':
      case 'meta-app-review':
        mainContentHtml = renderMetaAppReviewView(state);
        break;
      case 'billing-terminal':
      case 'cashier-billing':
      case 'integrations':
      case 'apps-integrations':
      case 'pos-integration':
        mainContentHtml = renderAppsIntegrationsView(state);
        break;
      default:
        mainContentHtml = renderDashboard(state);
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
        this.attachViewListeners(route);

        // Update active class on sidebar links
        document.querySelectorAll('#app-shell aside a, #mobile-sidebar-drawer a').forEach(a => {
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
    switch (route) {
      case 'super-admin':
        attachSuperAdminListeners();
        break;
      case 'dashboard':
        attachDashboardListeners();
        break;
      case 'customer-insights':
        attachCustomerInsightsListeners();
        break;
      case 'campaigns':
        attachCampaignsListeners();
        break;
      case 'loyalty':
      case 'activate-loyalty':
        attachActivateLoyaltyListeners();
        break;
      case 'settings':
        attachSettingsListeners();
        break;
      case 'billing-terminal':
      case 'cashier-billing':
        attachBillingScreenListeners();
        break;
      case 'loyalty-settings':
      case 'roi-simulator':
        attachLoyaltySettingsListeners();
        break;
      case 'customer-portal':
      case 'my-rewards':
        attachCustomerPortalListeners();
        break;
      case 'meta-review':
      case 'meta-app-review':
        attachMetaAppReviewListeners();
        break;
      case 'integrations':
      case 'apps-integrations':
        attachAppsIntegrationsListeners();
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
