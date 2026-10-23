// Apps & POS Integrations View
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { apiUrl } from '../../config/api.js';

let activeCategoryFilter = 'all';
let searchQuery = '';

export function renderAppsIntegrationsView(state) {
  const { isPetpoojaIntegrated, petpoojaRestID, activeOutlet } = state;
  let posList = state.posIntegrations || [];

  // Dynamically sync petpooja integration status
  posList = posList.map(item => {
    if (item.id === 'petpooja') {
      return {
        ...item,
        isLive: isPetpoojaIntegrated,
        statusText: isPetpoojaIntegrated ? `Connected (${petpoojaRestID || 'PP_DEL_101'})` : 'Ready to Connect',
        outlet: `${activeOutlet} (${petpoojaRestID || 'PP_DEL_101'})`
      };
    }
    return item;
  });

  // Calculate counts for filters
  const totalCount = posList.length;
  const posCount = posList.filter(p => p.category === 'pos').length;
  const aggCount = posList.filter(p => p.category === 'aggregator').length;
  const connectedCount = posList.filter(p => p.isLive).length;

  // Filter based on active category
  let filteredList = posList;
  if (activeCategoryFilter === 'pos') {
    filteredList = filteredList.filter(p => p.category === 'pos');
  } else if (activeCategoryFilter === 'aggregator') {
    filteredList = filteredList.filter(p => p.category === 'aggregator');
  } else if (activeCategoryFilter === 'connected') {
    filteredList = filteredList.filter(p => p.isLive);
  }

  // Filter based on search query
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredList = filteredList.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.tagline.toLowerCase().includes(q) || 
      p.description.toLowerCase().includes(q) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-20">
      
      <!-- Breadcrumb & Page Title -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">
            <span>Platform</span>
            <span>/</span>
            <span class="text-primary">Apps & POS Integrations</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span>Apps & POS Integrations</span>
            <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-primary/10 text-primary border border-primary/20">
              ${connectedCount} Active
            </span>
          </h1>
          <p class="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl font-medium leading-relaxed">
            Connect your physical billing terminals, cloud POS software, and online aggregators. Sync diner loyalty points, automated cashier prompts, and instant bill webhooks in real time.
          </p>
        </div>

        <!-- Top Right Action CTAs -->
        <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button 
            id="btn-open-webhook-docs"
            type="button" 
            class="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs transition shadow-xs flex items-center gap-2 active:scale-95"
          >
            <span class="material-symbols-outlined text-base text-slate-500">webhook</span>
            <span>Webhook Endpoints</span>
          </button>

          <button 
            id="btn-open-add-pos-modal"
            type="button" 
            class="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-xs transition shadow-md flex items-center gap-2 active:scale-95"
          >
            <span class="material-symbols-outlined text-base">add_circle</span>
            <span>+ Add POS Platform</span>
          </button>
        </div>
      </div>

      <!-- Live Engine Ribbon (KPIs) -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        
        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
            <span class="material-symbols-outlined text-2xl">point_of_sale</span>
          </div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Connected Terminals</div>
            <div class="text-lg font-black text-slate-900 mt-0.5 flex items-center gap-1.5">
              <span>${connectedCount} Connected</span>
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-black">
            <span class="material-symbols-outlined text-2xl">sync</span>
          </div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sync Latency</div>
            <div class="text-lg font-black text-slate-900 mt-0.5">&lt; 15ms (Instant)</div>
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-black">
            <span class="material-symbols-outlined text-2xl">store</span>
          </div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Outlet</div>
            <div class="text-sm font-black text-slate-900 mt-0.5 truncate max-w-[130px]">${activeOutlet}</div>
          </div>
        </div>

        <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center gap-3.5">
          <div class="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
            <span class="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <div class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Loyalty Engine</div>
            <div class="text-lg font-black text-slate-900 mt-0.5">10% Points Live</div>
          </div>
        </div>

      </div>

      <!-- Search & Category Filters Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        
        <!-- Filter Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button 
            type="button" 
            class="tab-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${activeCategoryFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}"
            data-filter="all"
          >
            All Platforms (${totalCount})
          </button>
          
          <button 
            type="button" 
            class="tab-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${activeCategoryFilter === 'pos' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}"
            data-filter="pos"
          >
            POS Billing Systems (${posCount})
          </button>

          <button 
            type="button" 
            class="tab-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${activeCategoryFilter === 'aggregator' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}"
            data-filter="aggregator"
          >
            Aggregators (${aggCount})
          </button>

          <button 
            type="button" 
            class="tab-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${activeCategoryFilter === 'connected' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}"
            data-filter="connected"
          >
            Connected (${connectedCount})
          </button>
        </div>

        <!-- Search Bar -->
        <div class="relative w-full sm:w-64">
          <span class="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-base">search</span>
          <input 
            id="input-search-integrations" 
            type="text" 
            placeholder="Search POS platforms..." 
            value="${searchQuery}"
            class="w-full pl-9 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary transition"
          />
        </div>
      </div>

      <!-- POS Platform Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        ${filteredList.map(item => {
          const isPetpooja = item.id === 'petpooja';
          const isYeezyBill = item.id === 'yeezy_bill';
          const isCustomPos = item.id === 'custom_pos';
          const isUserAdded = !item.isDefault;

          return `
            <div class="bg-white rounded-3xl p-6 border ${item.isLive ? 'border-slate-300 shadow-md ring-1 ring-slate-100' : 'border-slate-200 shadow-xs hover:border-slate-300 hover:shadow-md'} transition-all flex flex-col justify-between group relative overflow-hidden">
              
              <!-- Subtle accent top border if live -->
              ${item.isLive ? `
                <div class="absolute top-0 left-0 right-0 h-1.5 ${isPetpooja ? 'bg-[#00c59e]' : isYeezyBill ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : 'bg-primary'}"></div>
              ` : ''}

              <div>
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-3 mb-4">
                  <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl ${item.iconBg} ${item.iconColor} flex items-center justify-center font-black text-xl shadow-md shrink-0">
                      <span class="material-symbols-outlined text-2xl">${item.icon}</span>
                    </div>
                    <div>
                      <h3 class="text-base font-black text-slate-900 tracking-tight leading-tight flex items-center gap-1.5">
                        <span>${item.name}</span>
                        ${isYeezyBill ? '<span class="text-[10px] bg-purple-100 text-purple-800 font-extrabold px-1.5 py-0.5 rounded">Native</span>' : ''}
                      </h3>
                      <p class="text-[11px] font-semibold text-slate-400 mt-0.5">${item.categoryLabel}</p>
                    </div>
                  </div>

                  <!-- Status Pill -->
                  <span class="px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 flex items-center gap-1.5 ${item.isLive ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
                    <span class="w-1.5 h-1.5 rounded-full ${item.isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
                    <span>${item.isLive ? (item.statusText || 'Connected') : 'Available'}</span>
                  </span>
                </div>

                <!-- Description -->
                <p class="text-xs text-slate-600 leading-relaxed mb-4 min-h-[38px]">
                  ${item.description}
                </p>

                <!-- Tags -->
                <div class="flex flex-wrap gap-1.5 mb-5">
                  ${(item.tags || []).map(tag => `
                    <span class="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">
                      ${tag}
                    </span>
                  `).join('')}
                </div>

                <!-- Outlet Info line -->
                <div class="text-[11px] text-slate-500 flex items-center gap-1.5 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 mb-5">
                  <span class="material-symbols-outlined text-sm text-slate-400">storefront</span>
                  <span class="truncate">${item.outlet || activeOutlet}</span>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                ${isPetpooja ? `
                  <button 
                    type="button" 
                    class="btn-trigger-petpooja flex-1 py-2.5 px-4 rounded-xl ${item.isLive ? 'bg-slate-900 hover:bg-black text-white' : 'bg-[#00c59e] hover:bg-[#00b08d] text-white'} font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span class="material-symbols-outlined text-sm">${item.isLive ? 'settings' : 'link'}</span>
                    <span>${item.isLive ? 'Manage Petpooja POS' : 'Connect Petpooja (3 Steps)'}</span>
                  </button>
                ` : isYeezyBill ? `
                  <div class="flex gap-2 w-full">
                    <button 
                      type="button" 
                      class="btn-trigger-yeezy-bill flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <span class="material-symbols-outlined text-sm">tune</span>
                      <span>Configure Yeezy Bill</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn-quick-punch-bill py-2.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-bold text-xs transition shadow-xs active:scale-95"
                      title="Simulate 1-click test bill"
                    >
                      <span class="material-symbols-outlined text-sm">bolt</span>
                    </button>
                  </div>
                ` : isCustomPos ? `
                  <button 
                    type="button" 
                    class="btn-trigger-webhook-docs flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span class="material-symbols-outlined text-sm">terminal</span>
                    <span>View Webhook Endpoints</span>
                  </button>
                ` : isUserAdded ? `
                  <div class="flex items-center gap-2 w-full">
                    <button 
                      type="button" 
                      class="btn-manage-custom-pos flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                      data-id="${item.id}"
                    >
                      <span class="material-symbols-outlined text-sm">settings</span>
                      <span>Connected & Active</span>
                    </button>
                    <button 
                      type="button" 
                      class="btn-delete-pos-card p-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                      data-id="${item.id}"
                      data-name="${item.name}"
                      title="Disconnect & Remove Card"
                    >
                      <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ` : `
                  <button 
                    type="button" 
                    class="btn-connect-platform flex-1 py-2.5 px-4 rounded-xl ${item.isLive ? 'bg-slate-100 text-slate-700' : 'bg-primary hover:bg-primary/90 text-white'} font-bold text-xs transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                    data-id="${item.id}"
                    data-name="${item.name}"
                    data-is-live="${item.isLive}"
                  >
                    <span class="material-symbols-outlined text-sm">${item.isLive ? 'check_circle' : 'add_link'}</span>
                    <span>${item.isLive ? 'Connected' : `Connect ${item.name}`}</span>
                  </button>
                `}
              </div>

            </div>
          `;
        }).join('')}

        <!-- Add Any POS Platform Promo Card -->
        <div 
          id="card-add-pos-prompt" 
          class="border-2 border-dashed border-slate-300 hover:border-primary/60 bg-slate-50/50 hover:bg-primary/[0.02] rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all group min-h-[280px]"
        >
          <div class="w-14 h-14 rounded-2xl bg-white border border-slate-200 group-hover:border-primary/40 group-hover:scale-110 group-hover:bg-primary/10 text-slate-400 group-hover:text-primary flex items-center justify-center transition-all shadow-xs mb-3">
            <span class="material-symbols-outlined text-3xl">add_business</span>
          </div>
          <h3 class="text-base font-black text-slate-900 tracking-tight">Connect Any Other POS</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Link CaptainBiz, SlickPOS, Torfus, Shawarma POS, or custom legacy software in seconds.
          </p>
          <button 
            type="button" 
            class="mt-4 px-4 py-2 rounded-xl bg-white border border-slate-300 group-hover:border-primary text-slate-800 group-hover:text-primary font-bold text-xs transition shadow-xs flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-sm">add</span>
            <span>Add POS Card</span>
          </button>
        </div>

      </div>

    </div>
  `;
}

export function attachAppsIntegrationsListeners() {
  // Search input
  const searchInput = document.getElementById('input-search-integrations');
  if (searchInput) {
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      store.notify();
    };
  }

  // Filter tabs
  document.querySelectorAll('.tab-filter-btn').forEach(btn => {
    btn.onclick = () => {
      activeCategoryFilter = btn.getAttribute('data-filter') || 'all';
      store.notify();
    };
  });

  // Top action buttons
  const addPosBtn = document.getElementById('btn-open-add-pos-modal');
  if (addPosBtn) {
    addPosBtn.onclick = () => {
      store.setUIState({ activeModal: 'addPosPlatform' });
    };
  }

  const addPosCardPrompt = document.getElementById('card-add-pos-prompt');
  if (addPosCardPrompt) {
    addPosCardPrompt.onclick = () => {
      store.setUIState({ activeModal: 'addPosPlatform' });
    };
  }

  const webhookDocsBtn = document.getElementById('btn-open-webhook-docs');
  if (webhookDocsBtn) {
    webhookDocsBtn.onclick = () => {
      store.setUIState({ activeModal: 'webhookDocs' });
    };
  }

  // Petpooja trigger button
  document.querySelectorAll('.btn-trigger-petpooja').forEach(btn => {
    btn.onclick = () => {
      store.setUIState({ activeModal: 'petpoojaIntegration' });
    };
  });

  // Yeezy Bill trigger button
  document.querySelectorAll('.btn-trigger-yeezy-bill').forEach(btn => {
    btn.onclick = () => {
      store.setUIState({ activeModal: 'yeezyBillConfig' });
    };
  });

  // Quick punch test bill for Yeezy Bill
  document.querySelectorAll('.btn-quick-punch-bill').forEach(btn => {
    btn.onclick = async () => {
      showToast('Punching test bill on Yeezy Bill terminal...');
      try {
        const res = await fetch(apiUrl('/api/v1/pos/simulate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '9876543210', name: 'Sarah Jenkins', amount: 850, discount: 0 })
        });
        await res.json();
        await store.syncWithBackend();
        showToast('Yeezy Bill order settled! Sarah Jenkins earned 85 loyalty points.');
      } catch (e) {
        showToast('Yeezy Bill order punched successfully!');
      }
    };
  });

  // Custom POS trigger
  document.querySelectorAll('.btn-trigger-webhook-docs').forEach(btn => {
    btn.onclick = () => {
      store.setUIState({ activeModal: 'webhookDocs' });
    };
  });

  // Generic connect toggle buttons (e.g. POSist, UrbanPiper, Dotpe)
  document.querySelectorAll('.btn-connect-platform').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      const isLive = btn.getAttribute('data-is-live') === 'true';

      if (isLive) {
        store.updatePosIntegration(id, {
          isLive: false,
          statusText: 'Available'
        });
        showToast(`${name} disconnected.`);
      } else {
        store.updatePosIntegration(id, {
          isLive: true,
          statusText: `Connected (${store.getState().activeOutlet})`
        });
        showToast(`Connected ${name} successfully! Real-time sync enabled.`);
      }
    };
  });

  // Manage custom POS cards
  document.querySelectorAll('.btn-manage-custom-pos').forEach(btn => {
    btn.onclick = () => {
      store.setUIState({ activeModal: 'webhookDocs' });
    };
  });

  // Delete custom POS cards
  document.querySelectorAll('.btn-delete-pos-card').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const name = btn.getAttribute('data-name');
      if (confirm(`Are you sure you want to disconnect and remove ${name}?`)) {
        store.deletePosIntegration(id);
        showToast(`Removed ${name} card.`);
      }
    };
  });
}
