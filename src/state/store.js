// Central Reactive Store for Yeezy Loyalty Platform
import { initialData } from './initialData.js';
import { apiUrl } from '../config/api.js';

const STORAGE_KEY = 'yeezy_loyalty_state';
const DATA_VERSION_KEY = 'yeezy_state_version';
const CURRENT_VERSION = 'v4_clean_zero_state';

class Store {
  constructor() {
    // Check version to automatically wipe legacy mock numbers and initialize clean 0 state
    const currentVer = localStorage.getItem(DATA_VERSION_KEY);
    if (currentVer !== CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION);
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    this.state = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(initialData));
    
    // Non-persisted UI State
    this.uiState = {
      currentRoute: this.getRouteFromHash(),
      activeModal: null, // 'amountSpent' | 'refill' | 'autoRefill' | 'bookDemo' | 'activationSuccess' | 'customerDrawer' | 'posTerminal' | 'registerCustomer'
      selectedCustomer: null,
      amountSpentSlide: 0,
      configuratorStep: 1,
      configuratorPanel: 'theme',
      customerFilters: {
        activeTab: 'customerlist',
        searchTerm: '',
        selectedTier: 'all',
        sortBy: 'spend_desc'
      },
      mobileSidebarOpen: false
    };

    this.subscribers = new Set();
  }

  getRouteFromHash() {
    return window.location.hash.replace('#', '') || 'dashboard';
  }

  getState() {
    return this.state;
  }

  getUIState() {
    return this.uiState;
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  // Update business state (persisted)
  setState(updater, options = {}) {
    const nextState = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
    if (nextState === this.state) {
      return; // No change: skip disk writes and DOM re-renders
    }
    this.state = nextState;
    this.saveState();
    if (!options.silent) {
      this.notify();
    }
  }

  // Update transient UI state (not persisted)
  setUIState(updater) {
    const nextUIState = typeof updater === 'function' ? updater(this.uiState) : { ...this.uiState, ...updater };
    let changed = false;
    const prevKeys = Object.keys(this.uiState);
    const nextKeys = Object.keys(nextUIState);
    if (prevKeys.length !== nextKeys.length) {
      changed = true;
    } else {
      for (const key of nextKeys) {
        if (this.uiState[key] !== nextUIState[key]) {
          changed = true;
          break;
        }
      }
    }
    if (!changed) return;
    this.uiState = nextUIState;
    this.notify();
  }

  // Live 2-way sync bridge with Petpooja POS & backend database
  async syncWithBackend() {
    try {
      const [statsRes, custRes] = await Promise.all([
        fetch(apiUrl('/api/v1/dashboard/stats')).then(r => r.json()),
        fetch(apiUrl('/api/v1/customers')).then(r => r.json())
      ]);

      if (statsRes?.status === 'success' && custRes?.status === 'success') {
        const backendCustomers = custRes.customers || [];
        const todayStats = statsRes.todayStats;

        this.setState(prev => {
          const mergedCustomers = [...prev.customers];

          backendCustomers.forEach(bc => {
            const cleanPhone = String(bc.phone).slice(-10);
            const idx = mergedCustomers.findIndex(c => c.phone.slice(-10) === cleanPhone);

            const initials = bc.name
              ? bc.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              : 'VG';

            const formatted = {
              id: bc.id,
              name: bc.name,
              email: bc.email || `${cleanPhone}@guest.yeezy.app`,
              phone: `+91 ${cleanPhone}`,
              initials,
              avatarBg: 'bg-primary text-on-primary',
              tier: bc.tier || 'New',
              tierBadge: bc.tier === 'VIP' ? 'bg-amber-100 text-amber-800' : 'bg-surface-container-high text-on-surface',
              visits: bc.visits || 0,
              lifetimeSpend: `₹${(bc.lifetimeSpend || 0).toLocaleString()}`,
              numericSpend: bc.lifetimeSpend || 0,
              pointsBalance: `${bc.pointsBalance || 0} pts`,
              numericPoints: bc.pointsBalance || 0,
              favoriteDish: bc.favoriteDish || 'Chef Special',
              lastVisit: bc.lastVisit || 'Today',
              lastVisitDate: new Date().toISOString().slice(0, 10),
              status: (bc.visits || 0) > 0 ? 'Active' : 'New Guest',
              joinedDate: bc.joinedDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              totalRedeemed: (bc.totalRedeemed || 0) > 0 ? `${bc.totalRedeemed} Rewards` : '0 Rewards',
              recentOrders: bc.recentOrders || []
            };

            if (idx >= 0) {
              mergedCustomers[idx] = { ...mergedCustomers[idx], ...formatted };
            } else {
              mergedCustomers.unshift(formatted);
            }
          });

          // Check if data actually changed to prevent unnecessary redraws
          const salesChanged = prev.todayStats.sales !== todayStats.sales;
          const ordersChanged = prev.todayStats.orders !== todayStats.orders;
          const custCountChanged = prev.customers.length !== mergedCustomers.length;
          const pointsChanged = prev.todayStats.pointsIssued !== todayStats.pointsIssued;

          if (!salesChanged && !ordersChanged && !custCountChanged && !pointsChanged) {
            return prev;
          }

          // Update business highlights chart W1 bar
          const updatedHighlights = { ...prev.businessHighlights };
          if (updatedHighlights.tabs) {
            const salesTab = { ...updatedHighlights.tabs.sales };
            salesTab.totalDisplay = `₹${todayStats.sales.toLocaleString()}`;
            salesTab.bars[0] = { label: 'W1', value: Math.min(100, Math.round((todayStats.sales / 5000) * 100) || 25), amount: `₹${todayStats.sales.toLocaleString()}` };
            updatedHighlights.tabs.sales = salesTab;

            const ordersTab = { ...updatedHighlights.tabs.orders };
            ordersTab.totalDisplay = `${todayStats.orders}`;
            ordersTab.bars[0] = { label: 'W1', value: Math.min(100, todayStats.orders * 15), amount: `${todayStats.orders} orders` };
            updatedHighlights.tabs.orders = ordersTab;

            const custTab = { ...updatedHighlights.tabs.customers };
            custTab.totalDisplay = `${mergedCustomers.length}`;
            custTab.bars[0] = { label: 'W1', value: Math.min(100, mergedCustomers.length * 20), amount: `${mergedCustomers.length} diners` };
            updatedHighlights.tabs.customers = custTab;
          }

          return {
            ...prev,
            customers: mergedCustomers,
            businessHighlights: updatedHighlights,
            todayStats: {
              ...prev.todayStats,
              sales: todayStats.sales,
              orders: todayStats.orders,
              customers: mergedCustomers.length,
              pointsIssued: todayStats.pointsIssued,
              rewardsRedeemed: todayStats.rewardsRedeemed,
              activeMembers: mergedCustomers.length,
              activeMembersGrowth: `+${mergedCustomers.length}`,
              repeatVisitRate: todayStats.repeatVisitRate,
              loyaltyRoi: todayStats.loyaltyRoi
            }
          };
        }, { silent: false });
      }
    } catch (_) {}
  }

  // Reset all platform data to 0
  async resetAllDataToZero() {
    const authUser = this.state.user;
    const freshZeroState = JSON.parse(JSON.stringify(initialData));
    if (authUser) {
      freshZeroState.user = authUser;
    }
    this.state = freshZeroState;
    this.saveState();
    this.notify();

    // Also trigger backend wipe
    try {
      await fetch(apiUrl('/api/v1/dashboard/reset'), { method: 'POST' });
    } catch (err) {
      console.warn('Backend reset call:', err);
    }
  }

  subscribe(listener) {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  notify() {
    for (const listener of this.subscribers) {
      listener(this.state, this.uiState);
    }
  }
}

export const store = new Store();
