// Customer Insights View Module with co-located event listeners
import { store } from '../../state/store.js';
import { exportToCSV } from '../../utils/exportCsv.js';

export function renderCustomerInsights(state, filters = {}) {
  const { customers } = state;
  const activeTab = filters.activeTab || 'customerlist';
  const searchTerm = (filters.searchTerm || '').toLowerCase();
  const selectedTier = filters.selectedTier || 'all';
  const sortBy = filters.sortBy || 'spend_desc';

  // Filter and sort customers
  let filtered = customers.filter(c => {
    const matchesSearch = !searchTerm || 
      c.name.toLowerCase().includes(searchTerm) || 
      c.email.toLowerCase().includes(searchTerm) || 
      c.phone.includes(searchTerm);
    
    const matchesTier = selectedTier === 'all' || 
      (selectedTier === 'vip' && c.tier === 'VIP') ||
      (selectedTier === 'frequent' && c.tier === 'Frequent') ||
      (selectedTier === 'at-risk' && c.tier === 'At Risk') ||
      (selectedTier === 'new' && c.tier === 'New');

    return matchesSearch && matchesTier;
  });

  if (sortBy === 'spend_desc') {
    filtered.sort((a, b) => b.numericSpend - a.numericSpend);
  } else if (sortBy === 'visits_desc') {
    filtered.sort((a, b) => b.visits - a.visits);
  } else if (sortBy === 'points_desc') {
    filtered.sort((a, b) => b.numericPoints - a.numericPoints);
  }

  // Compute segment counts
  const vipCount = customers.filter(c => c.tier === 'VIP').length;
  const frequentCount = customers.filter(c => c.tier === 'Frequent').length;
  const atRiskCount = customers.filter(c => c.tier === 'At Risk').length;
  const newCount = customers.filter(c => c.tier === 'New').length;
  const totalSpend = customers.reduce((sum, c) => sum + c.numericSpend, 0);
  const avgSpend = customers.length ? Math.round(totalSpend / customers.length) : 0;
  const avgVisits = customers.length ? (customers.reduce((sum, c) => sum + c.visits, 0) / customers.length).toFixed(1) : 0;
  const avgCheckSize = customers.length ? Math.round(totalSpend / customers.reduce((sum, c) => sum + c.visits, 0)) : 0;

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto pb-16">
      
      <!-- Header Title & Subtitle -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Customer Insights</h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
            All your customer behavior data, segmentation details, and activity, easily accessible in one place.
          </p>
        </div>

        <button 
          id="btn-export-customers-csv" 
          type="button" 
          class="self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-on-surface hover:bg-surface-container-high transition text-xs font-bold shadow-sm"
        >
          <span class="material-symbols-outlined text-base">file_download</span>
          Export Customers (.CSV)
        </button>
      </div>

      <!-- Navigation Pill Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1" id="mainTabGroup">
        <button 
          data-insights-tab="overview" 
          type="button"
          class="insights-tab-btn px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-[#00796B] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
        >
          Overview
        </button>
        <button 
          data-insights-tab="rfm" 
          type="button"
          class="insights-tab-btn px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'rfm' ? 'bg-[#00796B] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
        >
          RFM Segmentation
        </button>
        <button 
          data-insights-tab="lifecycle" 
          type="button"
          class="insights-tab-btn px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'lifecycle' ? 'bg-[#00796B] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
        >
          Lifecycle Stages
        </button>
        <button 
          data-insights-tab="customerlist" 
          type="button"
          class="insights-tab-btn px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'customerlist' ? 'bg-[#00796B] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
        >
          Customer Directory (${customers.length})
        </button>
        <button 
          data-insights-tab="activity" 
          type="button"
          class="insights-tab-btn px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${activeTab === 'activity' ? 'bg-[#00796B] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}"
        >
          Activity Feed
        </button>
      </div>

      ${activeTab === 'overview' ? renderOverviewTab(customers, vipCount, frequentCount, atRiskCount, newCount, avgSpend, avgVisits, avgCheckSize, totalSpend) : ''}
      ${activeTab === 'rfm' ? renderRFMTab(customers, vipCount, frequentCount, atRiskCount, newCount) : ''}
      ${activeTab === 'lifecycle' ? renderLifecycleTab(customers, vipCount, frequentCount, atRiskCount, newCount) : ''}
      ${activeTab === 'customerlist' ? renderCustomerListTab(filtered, filters, selectedTier, sortBy) : ''}
      ${activeTab === 'activity' ? renderActivityFeedTab(customers) : ''}

    </div>
  `;
}

function renderOverviewTab(customers, vipCount, frequentCount, atRiskCount, newCount, avgSpend, avgVisits, avgCheckSize, totalSpend) {
  return `
    <!-- Overview Analytics Dashboard -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Guests</span>
        <div class="text-3xl font-black text-gray-900 mt-1">${customers.length}</div>
        <p class="text-xs text-emerald-600 font-bold mt-1 flex items-center gap-0.5">
          <span class="material-symbols-outlined text-xs">trending_up</span> +12 this week
        </p>
      </div>
      <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Average Check Size</span>
        <div class="text-3xl font-black text-gray-900 mt-1">₹${avgCheckSize.toLocaleString()}</div>
        <p class="text-xs text-emerald-600 font-bold mt-1">+8% vs last month</p>
      </div>
      <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Average Visits / Guest</span>
        <div class="text-3xl font-black text-gray-900 mt-1">${avgVisits}</div>
        <p class="text-xs text-emerald-600 font-bold mt-1">Highest in QSR benchmark</p>
      </div>
      <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Lifetime Guest Revenue</span>
        <div class="text-3xl font-black text-primary mt-1">₹${totalSpend.toLocaleString()}</div>
        <p class="text-xs text-gray-500 mt-1">Across all segments</p>
      </div>
    </div>

    <!-- Segment Breakdown -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-5 border border-purple-200 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-primary">VIP Spenders</span>
          <span class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
            <span class="material-symbols-outlined text-primary text-base">diamond</span>
          </span>
        </div>
        <div class="text-3xl font-black text-gray-900 mt-2">${vipCount} Diners</div>
        <p class="text-xs text-gray-500 mt-1">Avg spend ₹${customers.filter(c => c.tier === 'VIP').length ? Math.round(customers.filter(c => c.tier === 'VIP').reduce((s,c) => s + c.numericSpend, 0) / (vipCount || 1)).toLocaleString() : 0}</p>
        <div class="mt-3 w-full bg-purple-100 rounded-full h-1.5">
          <div class="bg-primary h-1.5 rounded-full" style="width: ${customers.length ? Math.round(vipCount / customers.length * 100) : 0}%"></div>
        </div>
        <span class="text-[10px] text-gray-400 mt-1 block">${customers.length ? Math.round(vipCount / customers.length * 100) : 0}% of total base</span>
      </div>

      <div class="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-5 border border-teal-200 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-[#00796B]">Frequent Diners</span>
          <span class="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-[#00796B] text-base">restaurant</span>
          </span>
        </div>
        <div class="text-3xl font-black text-gray-900 mt-2">${frequentCount} Diners</div>
        <p class="text-xs text-gray-500 mt-1">Visiting twice monthly with steady repeat orders</p>
        <div class="mt-3 w-full bg-teal-100 rounded-full h-1.5">
          <div class="bg-[#00796B] h-1.5 rounded-full" style="width: ${customers.length ? Math.round(frequentCount / customers.length * 100) : 0}%"></div>
        </div>
        <span class="text-[10px] text-gray-400 mt-1 block">${customers.length ? Math.round(frequentCount / customers.length * 100) : 0}% of total base</span>
      </div>

      <div class="bg-gradient-to-br from-rose-50 to-white rounded-2xl p-5 border border-rose-200 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-rose-600">Slipping Away</span>
          <span class="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-rose-600 text-base">warning</span>
          </span>
        </div>
        <div class="text-3xl font-black text-gray-900 mt-2">${atRiskCount} Diners</div>
        <p class="text-xs text-gray-500 mt-1">No visit in 30+ days. Win-back eligible.</p>
        <div class="mt-3 w-full bg-rose-100 rounded-full h-1.5">
          <div class="bg-rose-500 h-1.5 rounded-full" style="width: ${customers.length ? Math.round(atRiskCount / customers.length * 100) : 0}%"></div>
        </div>
        <span class="text-[10px] text-gray-400 mt-1 block">${customers.length ? Math.round(atRiskCount / customers.length * 100) : 0}% of total base</span>
      </div>

      <div class="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-5 border border-amber-200 shadow-sm">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold uppercase tracking-wider text-amber-700">New Signups</span>
          <span class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-amber-700 text-base">person_add</span>
          </span>
        </div>
        <div class="text-3xl font-black text-gray-900 mt-2">${newCount} Diners</div>
        <p class="text-xs text-gray-500 mt-1">Joined within last 30 days</p>
        <div class="mt-3 w-full bg-amber-100 rounded-full h-1.5">
          <div class="bg-amber-500 h-1.5 rounded-full" style="width: ${customers.length ? Math.round(newCount / customers.length * 100) : 0}%"></div>
        </div>
        <span class="text-[10px] text-gray-400 mt-1 block">${customers.length ? Math.round(newCount / customers.length * 100) : 0}% of total base</span>
      </div>
    </div>

    <!-- Retention Insights -->
    <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <h3 class="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-lg">insights</span>
        Guest Retention & Spend Trends
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="space-y-3">
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500 font-medium">30-Day Return Rate</span>
            <span class="font-bold text-emerald-700">68.4%</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-emerald-500 h-2 rounded-full transition-all" style="width: 68%"></div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500 font-medium">60-Day Return Rate</span>
            <span class="font-bold text-blue-700">82.1%</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-blue-500 h-2 rounded-full transition-all" style="width: 82%"></div>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-gray-500 font-medium">90-Day Return Rate</span>
            <span class="font-bold text-purple-700">91.5%</span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-2">
            <div class="bg-purple-500 h-2 rounded-full transition-all" style="width: 91%"></div>
          </div>
        </div>
        <div class="space-y-3">
          <span class="text-xs font-bold text-gray-800 block">Top Performing Dishes by Loyalty</span>
          <div class="space-y-2">
            <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
              <span class="font-bold text-gray-800">Truffle Tagliolini</span>
              <span class="font-black text-primary">₹2,840 avg</span>
            </div>
            <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
              <span class="font-bold text-gray-800">Burrata Rustica</span>
              <span class="font-black text-primary">₹1,950 avg</span>
            </div>
            <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs">
              <span class="font-bold text-gray-800">Wagyu Ribeye</span>
              <span class="font-black text-primary">₹3,400 avg</span>
            </div>
          </div>
        </div>
        <div class="space-y-3">
          <span class="text-xs font-bold text-gray-800 block">Loyalty Program Impact</span>
          <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2">
            <div class="flex items-center gap-2 text-xs text-emerald-800 font-bold">
              <span class="material-symbols-outlined text-sm">trending_up</span>
              32% more repeat visits since launch
            </div>
            <div class="flex items-center gap-2 text-xs text-emerald-800 font-bold">
              <span class="material-symbols-outlined text-sm">payments</span>
              ₹18.4L incremental revenue
            </div>
            <div class="flex items-center gap-2 text-xs text-emerald-800 font-bold">
              <span class="material-symbols-outlined text-sm">group</span>
              4.8x customer lifetime value growth
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderRFMTab(customers, vipCount, frequentCount, atRiskCount, newCount) {
  // RFM = Recency, Frequency, Monetary
  return `
    <div class="space-y-6">
      <!-- RFM Explanation Card -->
      <div class="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-6 border border-purple-200 shadow-sm">
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-primary text-2xl">analytics</span>
          </div>
          <div>
            <h3 class="text-base font-bold text-gray-900">RFM Segmentation Analysis</h3>
            <p class="text-xs text-gray-600 mt-1 leading-relaxed">
              Customers are scored on <strong>Recency</strong> (last visit date), <strong>Frequency</strong> (total visits), and <strong>Monetary</strong> (lifetime spend) to identify high-value opportunities and churn risks.
            </p>
          </div>
        </div>
      </div>

      <!-- RFM Segment Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Champions -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-emerald-500"></span>
              <h4 class="text-sm font-bold text-gray-900">🏆 Champions</h4>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">High R • High F • High M</span>
          </div>
          <p class="text-xs text-gray-500 mb-3">Recent buyers who visit frequently and spend the most. Your best customers.</p>
          <div class="space-y-2">
            ${customers.filter(c => c.tier === 'VIP' && c.visits > 15).map(c => `
              <div class="flex items-center gap-2.5 p-2 bg-emerald-50/50 rounded-lg text-xs">
                <div class="w-7 h-7 rounded-full ${c.avatarBg} font-bold text-[10px] flex items-center justify-center shrink-0">${c.initials}</div>
                <div class="flex-1">
                  <span class="font-bold text-gray-900">${c.name}</span>
                  <span class="text-gray-400 ml-1">${c.visits} visits</span>
                </div>
                <span class="font-black text-emerald-700">${c.lifetimeSpend}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Loyal Customers -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-blue-500"></span>
              <h4 class="text-sm font-bold text-gray-900">💎 Loyal Customers</h4>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Med R • High F • High M</span>
          </div>
          <p class="text-xs text-gray-500 mb-3">Consistently purchasing customers with solid frequency and spend.</p>
          <div class="space-y-2">
            ${customers.filter(c => c.tier === 'Frequent' || (c.tier === 'VIP' && c.visits <= 15)).map(c => `
              <div class="flex items-center gap-2.5 p-2 bg-blue-50/50 rounded-lg text-xs">
                <div class="w-7 h-7 rounded-full ${c.avatarBg} font-bold text-[10px] flex items-center justify-center shrink-0">${c.initials}</div>
                <div class="flex-1">
                  <span class="font-bold text-gray-900">${c.name}</span>
                  <span class="text-gray-400 ml-1">${c.visits} visits</span>
                </div>
                <span class="font-black text-blue-700">${c.lifetimeSpend}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- At Risk -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-red-500"></span>
              <h4 class="text-sm font-bold text-gray-900">⚠️ At Risk / Slipping</h4>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">Low R • Med F • Med M</span>
          </div>
          <p class="text-xs text-gray-500 mb-3">Previously engaged customers who haven't visited in 30+ days.</p>
          <div class="space-y-2">
            ${customers.filter(c => c.tier === 'At Risk').map(c => `
              <div class="flex items-center gap-2.5 p-2 bg-red-50/50 rounded-lg text-xs">
                <div class="w-7 h-7 rounded-full ${c.avatarBg} font-bold text-[10px] flex items-center justify-center shrink-0">${c.initials}</div>
                <div class="flex-1">
                  <span class="font-bold text-gray-900">${c.name}</span>
                  <span class="text-gray-400 ml-1">${c.lastVisit}</span>
                </div>
                <button type="button" class="px-2 py-0.5 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold hover:bg-red-200 transition" onclick="window.showToast('Win-back campaign queued for ${c.name}')">
                  Send Win-Back
                </button>
              </div>
            `).join('')}
            ${customers.filter(c => c.tier === 'At Risk').length === 0 ? '<p class="text-xs text-gray-400 italic">No at-risk customers currently. Great job!</p>' : ''}
          </div>
        </div>

        <!-- New / Promising -->
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-amber-500"></span>
              <h4 class="text-sm font-bold text-gray-900">🌟 New & Promising</h4>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">High R • Low F • Low M</span>
          </div>
          <p class="text-xs text-gray-500 mb-3">Recently signed up guests with first few transactions. Nurture them!</p>
          <div class="space-y-2">
            ${customers.filter(c => c.tier === 'New').map(c => `
              <div class="flex items-center gap-2.5 p-2 bg-amber-50/50 rounded-lg text-xs">
                <div class="w-7 h-7 rounded-full ${c.avatarBg} font-bold text-[10px] flex items-center justify-center shrink-0">${c.initials}</div>
                <div class="flex-1">
                  <span class="font-bold text-gray-900">${c.name}</span>
                  <span class="text-gray-400 ml-1">${c.visits} visits</span>
                </div>
                <span class="font-black text-amber-700">${c.lifetimeSpend}</span>
              </div>
            `).join('')}
            ${customers.filter(c => c.tier === 'New').length === 0 ? '<p class="text-xs text-gray-400 italic">No new signups in this period.</p>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLifecycleTab(customers, vipCount, frequentCount, atRiskCount, newCount) {
  const total = customers.length || 1;
  return `
    <div class="space-y-6">
      <!-- Lifecycle Funnel -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 class="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-lg">filter_alt</span>
          Guest Lifecycle Funnel
        </h3>
        
        <div class="flex flex-col items-center gap-3 max-w-xl mx-auto">
          <!-- Stage 1: Awareness / New -->
          <div class="w-full">
            <div class="bg-gradient-to-r from-amber-100 to-amber-50 rounded-2xl p-4 border border-amber-200 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-amber-200 flex items-center justify-center">
                  <span class="material-symbols-outlined text-amber-800 text-xl">person_add</span>
                </div>
                <div>
                  <div class="text-sm font-bold text-gray-900">New Signups</div>
                  <div class="text-[11px] text-gray-500">First 1-3 visits, building awareness</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-amber-800">${newCount}</div>
                <div class="text-[10px] text-amber-600 font-bold">${Math.round(newCount / total * 100)}% of base</div>
              </div>
            </div>
          </div>

          <div class="w-6 h-6 flex items-center justify-center text-gray-300">
            <span class="material-symbols-outlined">arrow_downward</span>
          </div>

          <!-- Stage 2: Engagement / Frequent -->
          <div class="w-[90%]">
            <div class="bg-gradient-to-r from-teal-100 to-teal-50 rounded-2xl p-4 border border-teal-200 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-teal-200 flex items-center justify-center">
                  <span class="material-symbols-outlined text-teal-800 text-xl">restaurant</span>
                </div>
                <div>
                  <div class="text-sm font-bold text-gray-900">Frequent Diners</div>
                  <div class="text-[11px] text-gray-500">Regular visits, building habit</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-teal-800">${frequentCount}</div>
                <div class="text-[10px] text-teal-600 font-bold">${Math.round(frequentCount / total * 100)}% of base</div>
              </div>
            </div>
          </div>

          <div class="w-6 h-6 flex items-center justify-center text-gray-300">
            <span class="material-symbols-outlined">arrow_downward</span>
          </div>

          <!-- Stage 3: Loyalty / VIP -->
          <div class="w-[80%]">
            <div class="bg-gradient-to-r from-purple-100 to-purple-50 rounded-2xl p-4 border border-purple-200 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center">
                  <span class="material-symbols-outlined text-primary text-xl">workspace_premium</span>
                </div>
                <div>
                  <div class="text-sm font-bold text-gray-900">VIP Champions</div>
                  <div class="text-[11px] text-gray-500">Highest spend & most loyal guests</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-primary">${vipCount}</div>
                <div class="text-[10px] text-purple-600 font-bold">${Math.round(vipCount / total * 100)}% of base</div>
              </div>
            </div>
          </div>

          <div class="w-6 h-6 flex items-center justify-center text-gray-300">
            <span class="material-symbols-outlined">arrow_downward</span>
          </div>

          <!-- Stage 4: Advocacy -->
          <div class="w-[70%]">
            <div class="bg-gradient-to-r from-emerald-100 to-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-emerald-200 flex items-center justify-center">
                  <span class="material-symbols-outlined text-emerald-800 text-xl">diversity_3</span>
                </div>
                <div>
                  <div class="text-sm font-bold text-gray-900">Brand Advocates</div>
                  <div class="text-[11px] text-gray-500">Actively referring new guests</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-black text-emerald-800">${Math.max(1, Math.round(vipCount * 0.4))}</div>
                <div class="text-[10px] text-emerald-600 font-bold">Top referrers</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Churn Risk Zone -->
      <div class="bg-white rounded-2xl p-6 border border-red-200 shadow-sm">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-red-500 text-lg">running_with_errors</span>
            Churn Risk Zone
          </h3>
          <button type="button" class="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 transition" onclick="window.showToast('Win-back campaign sent to ${atRiskCount} at-risk diners!')">
            Send Win-Back to All (${atRiskCount})
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          ${customers.filter(c => c.tier === 'At Risk').map(c => `
            <div class="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-full ${c.avatarBg} font-bold text-xs flex items-center justify-center shrink-0">${c.initials}</div>
                <div>
                  <div class="text-xs font-bold text-gray-900">${c.name}</div>
                  <div class="text-[10px] text-red-600">Last visited: ${c.lastVisit}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-xs font-black text-gray-900">${c.pointsBalance}</div>
                <div class="text-[10px] text-red-600 font-bold">Expiring soon</div>
              </div>
            </div>
          `).join('')}
          ${customers.filter(c => c.tier === 'At Risk').length === 0 ? `
            <div class="col-span-2 text-center py-8 text-gray-400">
              <span class="material-symbols-outlined text-4xl mb-2">sentiment_satisfied</span>
              <p class="text-xs font-bold text-gray-600">No churning guests right now!</p>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderCustomerListTab(filtered, filters, selectedTier, sortBy) {
  return `
    <!-- Filter and Search Toolbar -->
    <div class="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
      <div class="relative w-full md:w-80">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
        <input 
          id="customer-search-input"
          type="text" 
          value="${filters.searchTerm || ''}"
          placeholder="Search by name, email, or mobile..." 
          class="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition"
        />
      </div>

      <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto justify-start md:justify-end">
        <!-- Tier Pills -->
        <button data-tier-filter="all" type="button" class="tier-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTier === 'all' ? 'bg-primary text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">All</button>
        <button data-tier-filter="vip" type="button" class="tier-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTier === 'vip' ? 'bg-primary text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">VIP</button>
        <button data-tier-filter="frequent" type="button" class="tier-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTier === 'frequent' ? 'bg-primary text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">Frequent</button>
        <button data-tier-filter="at-risk" type="button" class="tier-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTier === 'at-risk' ? 'bg-primary text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">At Risk</button>
        <button data-tier-filter="new" type="button" class="tier-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedTier === 'new' ? 'bg-primary text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}">New</button>

        <!-- Sort dropdown -->
        <select id="customer-sort-select" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:outline-none ml-2">
          <option value="spend_desc" ${sortBy === 'spend_desc' ? 'selected' : ''}>Sort: Highest Spend</option>
          <option value="visits_desc" ${sortBy === 'visits_desc' ? 'selected' : ''}>Sort: Most Visits</option>
          <option value="points_desc" ${sortBy === 'points_desc' ? 'selected' : ''}>Sort: Points Balance</option>
        </select>
      </div>
    </div>

    <!-- Customer Directory Table -->
    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th class="py-3 px-4">Customer</th>
              <th class="py-3 px-4">Contact</th>
              <th class="py-3 px-4 text-center">Tier</th>
              <th class="py-3 px-4 text-center">Visits</th>
              <th class="py-3 px-4 text-right">Lifetime Spend</th>
              <th class="py-3 px-4 text-right">Points Balance</th>
              <th class="py-3 px-4">Last Visit</th>
              <th class="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 font-medium">
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="8" class="text-center py-12 px-4 text-gray-400">
                  <div class="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                      <span class="material-symbols-outlined text-2xl">person_search</span>
                    </div>
                    <p class="font-extrabold text-sm text-gray-800">No Diners in Directory (0 Guests)</p>
                    <p class="text-xs text-gray-500">Every guest visit, signup, or POS bill will automatically create a live diner profile here.</p>
                    <div class="flex items-center gap-2 mt-2">
                      <button id="btn-empty-pos" type="button" class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-sm hover:bg-primary/90 transition">
                        ⚡ Process First POS Bill
                      </button>
                      <button id="btn-empty-reg" type="button" class="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition">
                        + Register Guest
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ` : filtered.map(c => `
              <tr 
                data-customer-id="${c.id}"
                class="customer-row-click hover:bg-blue-50/40 transition cursor-pointer"
              >
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full ${c.avatarBg} font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                      ${c.initials}
                    </div>
                    <div>
                      <div class="font-bold text-gray-900 text-sm">${c.name}</div>
                      <div class="text-[11px] text-gray-500">${c.favoriteDish}</div>
                    </div>
                  </div>
                </td>
                <td class="py-3.5 px-4 text-gray-600">
                  <div>${c.phone}</div>
                  <div class="text-[11px] text-gray-400">${c.email}</div>
                </td>
                <td class="py-3.5 px-4 text-center">
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${c.tierBadge}">
                    ${c.tier}
                  </span>
                </td>
                <td class="py-3.5 px-4 text-center font-bold text-gray-800">
                  ${c.visits}
                </td>
                <td class="py-3.5 px-4 text-right font-black text-gray-900">
                  ${c.lifetimeSpend}
                </td>
                <td class="py-3.5 px-4 text-right font-bold text-primary">
                  ${c.pointsBalance}
                </td>
                <td class="py-3.5 px-4 text-gray-600">
                  ${c.lastVisit}
                </td>
                <td class="py-3.5 px-4 text-center">
                  <button 
                    type="button" 
                    class="px-3 py-1 bg-gray-100 hover:bg-primary hover:text-white rounded-lg text-[11px] font-bold text-gray-700 transition"
                  >
                    Profile Drawer
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderActivityFeedTab(customers) {
  // Build a timeline from all customer recent orders
  const allEvents = [];
  customers.forEach(c => {
    (c.recentOrders || []).forEach(ord => {
      allEvents.push({
        type: 'order',
        customer: c,
        order: ord,
        dateStr: ord.date,
        sortDate: new Date(ord.date).getTime()
      });
    });
    // Add a "joined" event
    allEvents.push({
      type: 'joined',
      customer: c,
      dateStr: c.joinedDate,
      sortDate: new Date(c.joinedDate).getTime()
    });
  });
  // Sort by date descending
  allEvents.sort((a, b) => b.sortDate - a.sortDate);

  return `
    <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-lg">timeline</span>
          Real-Time Dining Activity Feed
        </h3>
        <span class="text-[11px] text-gray-400 font-medium flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          Live updates
        </span>
      </div>

      <div class="space-y-1 relative">
        <!-- Timeline Line -->
        <div class="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100"></div>

        ${allEvents.slice(0, 20).map(ev => {
          if (ev.type === 'order') {
            return `
              <div class="relative flex items-start gap-4 py-3 pl-2 hover:bg-gray-50/50 rounded-xl transition">
                <div class="relative z-10 w-8 h-8 rounded-full ${ev.customer.avatarBg} font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white">
                  ${ev.customer.initials}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-xs text-gray-900">${ev.customer.name}</span>
                    <span class="text-[10px] text-gray-400">${ev.order.date}</span>
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${ev.customer.tierBadge}">${ev.customer.tier}</span>
                  </div>
                  <p class="text-xs text-gray-600 mt-0.5">
                    Dined and ordered: <span class="font-medium">${ev.order.items}</span>
                  </p>
                  <div class="flex items-center gap-3 mt-1 text-[11px]">
                    <span class="font-black text-gray-900">${ev.order.total}</span>
                    <span class="text-emerald-700 font-bold flex items-center gap-0.5">
                      <span class="material-symbols-outlined text-xs">add_circle</span>
                      ${ev.order.pointsEarned} pts earned
                    </span>
                    <span class="text-gray-400 font-mono">${ev.order.id}</span>
                  </div>
                </div>
              </div>
            `;
          } else {
            return `
              <div class="relative flex items-start gap-4 py-3 pl-2 hover:bg-gray-50/50 rounded-xl transition">
                <div class="relative z-10 w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px] flex items-center justify-center shrink-0 shadow-sm ring-2 ring-white">
                  <span class="material-symbols-outlined text-sm">person_add</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-xs text-gray-900">${ev.customer.name}</span>
                    <span class="text-[10px] text-gray-400">${ev.dateStr}</span>
                  </div>
                  <p class="text-xs text-gray-600 mt-0.5">
                    Joined the loyalty program • Welcome bonus of 100 points credited
                  </p>
                </div>
              </div>
            `;
          }
        }).join('')}
      </div>
    </div>
  `;
}

export function attachCustomerInsightsListeners() {
  document.querySelectorAll('.insights-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.getAttribute('data-insights-tab');
      if (tab) {
        store.setUIState(ui => ({
          ...ui,
          customerFilters: { ...ui.customerFilters, activeTab: tab }
        }));
      }
    };
  });

  // Debounced search input
  let searchTimeout = null;
  const searchInput = document.getElementById('customer-search-input');
  if (searchInput) {
    searchInput.oninput = (e) => {
      const val = e.target.value;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        store.setUIState(ui => ({
          ...ui,
          customerFilters: { ...ui.customerFilters, searchTerm: val }
        }));
        // Restore focus after re-render
        requestAnimationFrame(() => {
          const newSearch = document.getElementById('customer-search-input');
          if (newSearch) {
            newSearch.focus();
            newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
          }
        });
      }, 200);
    };
  }

  document.querySelectorAll('.tier-filter-btn').forEach(btn => {
    btn.onclick = () => {
      const tier = btn.getAttribute('data-tier-filter');
      if (tier) {
        store.setUIState(ui => ({
          ...ui,
          customerFilters: { ...ui.customerFilters, selectedTier: tier }
        }));
      }
    };
  });

  const sortSelect = document.getElementById('customer-sort-select');
  if (sortSelect) {
    sortSelect.onchange = (e) => {
      store.setUIState(ui => ({
        ...ui,
        customerFilters: { ...ui.customerFilters, sortBy: e.target.value }
      }));
    };
  }

  const exportBtn = document.getElementById('btn-export-customers-csv');
  if (exportBtn) {
    exportBtn.onclick = () => {
      const customers = store.getState().customers;
      const rows = [
        ['Name', 'Email', 'Phone', 'Tier', 'Visits', 'Lifetime Spend', 'Points Balance', 'Favorite Dish', 'Last Visit'],
        ...customers.map(c => [
          c.name, c.email, c.phone, c.tier, c.visits, c.lifetimeSpend, c.pointsBalance, c.favoriteDish, c.lastVisit
        ])
      ];
      exportToCSV('Yeezy_Customers_Directory.csv', rows);
    };
  }

  const emptyPosBtn = document.getElementById('btn-empty-pos');
  if (emptyPosBtn) {
    emptyPosBtn.onclick = () => store.setUIState({ activeModal: 'posTerminal' });
  }

  const emptyRegBtn = document.getElementById('btn-empty-reg');
  if (emptyRegBtn) {
    emptyRegBtn.onclick = () => store.setUIState({ activeModal: 'registerCustomer' });
  }

  document.querySelectorAll('.customer-row-click').forEach(row => {
    row.onclick = () => {
      const id = row.getAttribute('data-customer-id');
      const cust = store.getState().customers.find(c => c.id === id);
      if (cust) {
        store.setUIState({
          selectedCustomer: cust,
          activeModal: 'customerDrawer'
        });
      }
    };
  });
}
