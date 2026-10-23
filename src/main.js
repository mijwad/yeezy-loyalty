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
  renderCampaignsView, 
  renderAutoCampaignsView, 
  renderQRCodesView, 
  renderFeedbackView, 
  renderReferralsView, 
  renderSettingsView,
  attachSettingsListeners
} from './views/other/index.js';
import { renderSmartInsightsView } from './views/other/smartInsights.js';
import { renderLoginView, attachLoginListeners } from './views/auth/login.js';
import { renderSuperAdminView, attachSuperAdminListeners } from './views/admin/superAdmin.js';

class YeezyLoyaltyApp {
  constructor() {
    this.store = store;

    // React to store state changes
    this.store.subscribe(() => {
      this.render();
    });

    // Hash-based routing
    const handleRoute = () => {
      const route = this.store.getRouteFromHash();
      if (route === 'petpooja-setup' || route === 'petpooja-integration') {
        this.store.setUIState({
          currentRoute: 'settings',
          activeModal: 'petpoojaIntegration'
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
        currentRoute: 'settings',
        activeModal: 'petpoojaIntegration'
      });
    }

    // Initial background sync with Petpooja POS & backend database
    this.store.syncWithBackend();

    // Continuous 4-second heartbeat to automatically reflect cashier POS bills in real time
    setInterval(() => {
      this.store.syncWithBackend();
    }, 4000);

    this.render();
  }

  render() {
    const appEl = document.getElementById('app');
    if (!appEl) return;

    // Capture active element before innerHTML re-render to preserve user cursor & focus
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

    // Full screen login view (without sidebar/header)
    if (route === 'login') {
      appEl.innerHTML = renderLoginView();
      attachLoginListeners();
      return;
    }

    const isConfiguratorMode = route === 'configurator';

    let mainContentHtml = '';

    if (isConfiguratorMode) {
      mainContentHtml = renderConfigurator(state, uiState.configuratorStep, uiState.configuratorPanel);
    } else {
      switch (route) {
        case 'super-admin':
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
        default:
          mainContentHtml = renderDashboard(state);
      }
    }

    const modalHtml = renderActiveModal(state, uiState);

    if (isConfiguratorMode) {
      appEl.innerHTML = `
        <div class="min-h-screen bg-[#f5f8f9]">
          ${mainContentHtml}
          ${modalHtml}
        </div>
      `;
    } else {
      appEl.innerHTML = `
        <div class="min-h-screen bg-background font-body-md text-on-surface antialiased flex flex-col">
          <!-- Desktop Sidebar -->
          <div class="hidden md:block">
            ${renderSidebar(route)}
          </div>
          
          <!-- Mobile Sidebar Drawer -->
          <div id="mobile-sidebar-drawer" class="${uiState.mobileSidebarOpen ? 'block' : 'hidden'} md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm">
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

            <main class="w-full pt-16 bg-background flex-1 pb-16">
              ${mainContentHtml}
            </main>
          </div>

          <!-- Modals Container -->
          ${modalHtml}
        </div>
      `;
    }

    // Attach listeners modularly based on current view
    this.attachEventListeners(route, isConfiguratorMode, uiState);

    // Restore focus if active element was an input/textarea
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

  attachEventListeners(route, isConfiguratorMode, uiState) {
    if (isConfiguratorMode) {
      attachConfiguratorListeners();
    } else {
      attachSidebarListeners();
      attachHeaderListeners();

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
        case 'loyalty':
        case 'activate-loyalty':
          attachActivateLoyaltyListeners();
          break;
        case 'settings':
          attachSettingsListeners();
          break;
      }
    }

    attachActiveModalListeners(uiState);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.yeezyApp = new YeezyLoyaltyApp();
});
