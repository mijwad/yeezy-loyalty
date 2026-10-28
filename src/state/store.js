// Central Reactive Store for Yeezy Loyalty Platform (Production Multi-Tenant)
import { initialData } from './initialData.js';
import { apiUrl } from '../config/api.js';

const STORAGE_KEY = 'yeezy_loyalty_state';
const DATA_VERSION_KEY = 'yeezy_state_version';
const CURRENT_VERSION = 'v7_multi_tenant_isolation';

class Store {
  constructor() {
    // Check version to automatically wipe legacy mock numbers and initialize clean 0 state
    const currentVer = localStorage.getItem(DATA_VERSION_KEY);
    if (currentVer !== CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(DATA_VERSION_KEY, CURRENT_VERSION);
    }

    const savedAuthUser = this.getSavedAuthUser();
    const saved = localStorage.getItem(this.getTenantStorageKey(savedAuthUser?.tenantId));
    
    this.state = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(initialData));

    // Ensure state belongs to currently logged-in user if saved session exists
    if (savedAuthUser) {
      this.state.user = {
        id: savedAuthUser.id,
        name: savedAuthUser.name,
        email: savedAuthUser.email,
        role: savedAuthUser.role,
        tenantId: savedAuthUser.tenantId,
        tenantName: savedAuthUser.tenantName,
        avatar: savedAuthUser.avatar || this.state.user.avatar
      };
      this.state.activeOutlet = savedAuthUser.primaryRestID === 'PP_DEL_101'
        ? 'Downtown Bistro'
        : (savedAuthUser.tenantName || 'Main Outlet');

      if (savedAuthUser.assignedOutlets && savedAuthUser.assignedOutlets.length > 0) {
        this.state.outlets = savedAuthUser.assignedOutlets;
      }
    }

    // Ensure integrations exist if loaded from storage
    if (!this.state.posIntegrations) {
      this.state.posIntegrations = JSON.parse(JSON.stringify(initialData.posIntegrations));
    }
    if (!this.state.yeezyBillSettings) {
      this.state.yeezyBillSettings = JSON.parse(JSON.stringify(initialData.yeezyBillSettings));
    }
    
    // Non-persisted UI State
    this.uiState = {
      currentRoute: this.getRouteFromHash(),
      activeModal: null,
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

  getSavedAuthUser() {
    try {
      const raw = localStorage.getItem('yeezy_auth_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  getTenantStorageKey(tenantId) {
    return tenantId ? `yeezy_state_${tenantId}` : STORAGE_KEY;
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

  getAuthHeaders() {
    const token = localStorage.getItem('yeezy_auth_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.state.user?.tenantId) {
      headers['x-tenant-id'] = this.state.user.tenantId;
    }
    return headers;
  }

  saveState() {
    try {
      const key = this.getTenantStorageKey(this.state.user?.tenantId);
      localStorage.setItem(key, JSON.stringify(this.state));
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
    }
  }

  // Update business state (persisted)
  setState(updater, options = {}) {
    const nextState = typeof updater === 'function' ? updater(this.state) : { ...this.state, ...updater };
    if (nextState === this.state) {
      return;
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

  // Set Authenticated User and initialize clean, isolated state for that restaurant
  async loginUser(user, token) {
    localStorage.setItem('yeezy_auth_token', token);
    localStorage.setItem('yeezy_auth_user', JSON.stringify(user));

    // Initialize clean fresh state template for the new restaurant
    const freshState = JSON.parse(JSON.stringify(initialData));
    freshState.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      avatar: user.avatar || freshState.user.avatar
    };

    freshState.activeOutlet = user.primaryRestID === 'PP_DEL_101' 
      ? 'Downtown Bistro' 
      : (user.tenantName || 'Main Outlet');

    if (user.assignedOutlets && user.assignedOutlets.length > 0) {
      freshState.outlets = user.assignedOutlets;
    }

    // Replace current state entirely to prevent state cross-contamination
    this.state = freshState;
    this.uiState.selectedCustomer = null;
    this.uiState.activeModal = null;
    this.saveState();
    this.notify();

    // Pull real tenant data from backend immediately
    await this.syncWithBackend();
  }

  // Sign out and wipe sensitive cached memory
  logout() {
    const token = localStorage.getItem('yeezy_auth_token');
    if (token) {
      fetch(apiUrl('/api/v1/auth/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => {});
    }

    const currentTenantId = this.state.user?.tenantId;
    localStorage.removeItem('yeezy_auth_token');
    localStorage.removeItem('yeezy_auth_user');
    if (currentTenantId) {
      localStorage.removeItem(`yeezy_state_${currentTenantId}`);
    }
    localStorage.removeItem(STORAGE_KEY);

    // Reset whole in-memory state back to clean initial state
    this.state = JSON.parse(JSON.stringify(initialData));
    this.uiState.activeModal = null;
    this.uiState.selectedCustomer = null;
    this.uiState.customerFilters = {
      activeTab: 'customerlist',
      searchTerm: '',
      selectedTier: 'all',
      sortBy: 'spend_desc'
    };
    
    this.notify();
    window.location.hash = '#login';
  }

  // Live 2-way sync bridge with Petpooja POS & backend database (strictly scoped by tenant)
  async syncWithBackend() {
    try {
      const headers = this.getAuthHeaders();
      const [statsRes, custRes] = await Promise.all([
        fetch(apiUrl('/api/v1/dashboard/stats'), { headers }).then(r => r.json()),
        fetch(apiUrl('/api/v1/customers'), { headers }).then(r => r.json())
      ]);

      if (statsRes?.status === 'success' && custRes?.status === 'success') {
        const backendCustomers = custRes.customers || [];
        const todayStats = statsRes.todayStats;

        const formattedCustomers = backendCustomers.map(bc => {
          const cleanPhone = String(bc.phone).slice(-10);
          const initials = bc.name
            ? bc.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            : 'VG';

          return {
            id: bc.id,
            tenantId: bc.tenantId || this.state.user?.tenantId,
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
            topDishes: bc.topDishes || [],
            lastVisit: bc.lastVisit || 'Today',
            lastVisitDate: new Date().toISOString().slice(0, 10),
            status: (bc.visits || 0) > 0 ? 'Active' : 'New Guest',
            joinedDate: bc.joinedDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            totalRedeemed: (bc.totalRedeemed || 0) > 0 ? `${bc.totalRedeemed} Rewards` : '0 Rewards',
            recentOrders: bc.recentOrders || []
          };
        });

        // Check if data actually changed before notifying
        const prevStatsStr = JSON.stringify(this.state.todayStats || {});
        const nextStatsStr = JSON.stringify(todayStats || {});
        const hasStatsChanged = prevStatsStr !== nextStatsStr;
        const hasCustomersChanged = (this.state.customers || []).length !== formattedCustomers.length ||
          (this.state.customers || []).some((c, i) => c.id !== formattedCustomers[i]?.id || c.numericPoints !== formattedCustomers[i]?.numericPoints);
        const hasHighlightsChanged = Boolean(
          statsRes.businessHighlights && 
          JSON.stringify(statsRes.businessHighlights) !== JSON.stringify(this.state.businessHighlights || {})
        );

        if (!hasStatsChanged && !hasCustomersChanged && !hasHighlightsChanged) {
          // No backend state change, avoid disruptive UI refresh
          return;
        }

        // Set state replacing customers with clean tenant array
        this.setState(prev => ({
          ...prev,
          activeOutlet: statsRes.activeOutlet || statsRes.restaurantName || prev.activeOutlet,
          customers: formattedCustomers,
          todayStats: {
            ...prev.todayStats,
            ...todayStats
          },
          ...(statsRes.businessHighlights ? { businessHighlights: statsRes.businessHighlights } : {})
        }), { silent: false });
      }
    } catch (err) {
      console.warn('Backend sync failed:', err);
    }
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

    try {
      await fetch(apiUrl('/api/v1/dashboard/reset'), { 
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } catch (err) {
      console.warn('Backend reset call:', err);
    }
  }

  // POS & Apps Integration helpers
  addPosIntegration(newIntegration) {
    this.setState(prev => {
      const existing = prev.posIntegrations || [];
      return {
        ...prev,
        posIntegrations: [...existing, newIntegration]
      };
    });
  }

  updatePosIntegration(id, updates) {
    this.setState(prev => {
      const updated = (prev.posIntegrations || []).map(item => {
        if (item.id === id) {
          return { ...item, ...updates };
        }
        return item;
      });
      return { ...prev, posIntegrations: updated };
    });
  }

  deletePosIntegration(id) {
    this.setState(prev => {
      return {
        ...prev,
        posIntegrations: (prev.posIntegrations || []).filter(item => item.id !== id)
      };
    });
  }

  updateYeezyBillSettings(newSettings) {
    this.setState(prev => {
      return {
        ...prev,
        yeezyBillSettings: { ...(prev.yeezyBillSettings || {}), ...newSettings }
      };
    });
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
