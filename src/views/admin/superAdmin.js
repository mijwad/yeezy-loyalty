import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { apiUrl, apiFetch } from '../../config/api.js';

export function renderSuperAdminView(state) {
  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto pb-16">
      
      <!-- Top Title & Quick Actions -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
              <span class="material-symbols-outlined text-xs">shield_person</span> Super Admin Console
            </span>
          </div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
            Global Restaurant Management
          </h1>
          <p class="text-xs md:text-sm text-gray-500 mt-0.5 font-medium">
            Manage all tenant brands, onboard restaurant owners, configure POS webhooks, and impersonate dashboards.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <button 
            id="btn-open-create-restaurant" 
            type="button" 
            class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 active:scale-95"
          >
            <span class="material-symbols-outlined text-base">add_business</span>
            Create Restaurant Owner
          </button>
        </div>
      </div>

      <!-- Global Platform KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="admin-global-kpis">
        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Restaurants</span>
          <div class="text-3xl font-black text-gray-900 mt-2" id="kpi-total-restaurants">1</div>
          <span class="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-0.5">
            <span class="material-symbols-outlined text-xs">trending_up</span> Active SaaS tenants
          </span>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Connected Outlets</span>
          <div class="text-3xl font-black text-gray-900 mt-2" id="kpi-total-outlets">1</div>
          <span class="text-[11px] text-teal-600 font-bold mt-1">Petpooja POS integrated</span>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Global Enrolled Diners</span>
          <div class="text-3xl font-black text-primary mt-2" id="kpi-total-diners">0</div>
          <span class="text-[11px] text-purple-600 font-bold mt-1">Across all restaurant brands</span>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex flex-col justify-between">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">System Webhook Health</span>
          <div class="text-3xl font-black text-emerald-600 mt-2">100%</div>
          <span class="text-[11px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span> Live ingestion
          </span>
        </div>
      </div>

      <!-- Create Restaurant Owner Form Card (Collapsible) -->
      <div id="create-restaurant-card" class="hidden bg-white rounded-3xl p-6 md:p-8 border-2 border-primary/30 shadow-xl space-y-6 animate-fade-in">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">add_business</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900">Provision New Restaurant & Owner Account</h3>
              <p class="text-xs text-gray-500">Creates a new restaurant tenant and email login credentials for the owner</p>
            </div>
          </div>
          <button id="btn-close-create-restaurant" type="button" class="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <form id="form-create-restaurant" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 block mb-1">Restaurant Brand Name *</label>
              <input 
                id="input-brand-name" 
                type="text" 
                required 
                placeholder="e.g. Bombay Canteen, Farzi Cafe" 
                class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary font-medium"
              >
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 block mb-1">Owner Full Name *</label>
              <input 
                id="input-owner-name" 
                type="text" 
                required 
                placeholder="e.g. Sameer Seth" 
                class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary font-medium"
              >
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 block mb-1">Owner Email (Used for Login) *</label>
              <input 
                id="input-owner-email" 
                type="email" 
                required 
                placeholder="owner@restaurantbrand.com" 
                class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary font-medium"
              >
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 block mb-1">Temporary Initial Password *</label>
              <input 
                id="input-owner-password" 
                type="text" 
                value="owner123" 
                required 
                class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary font-mono"
              >
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-700 block mb-1">Primary Outlet Name</label>
              <input 
                id="input-outlet-name" 
                type="text" 
                placeholder="e.g. Lower Parel Flagship" 
                class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary font-medium"
              >
            </div>
            <div>
              <label class="text-xs font-bold text-gray-700 block mb-1">Petpooja restID (POS Outlet ID)</label>
              <input 
                id="input-petpooja-restid" 
                type="text" 
                placeholder="e.g. PP_MUM_881" 
                class="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary font-mono uppercase"
              >
            </div>
          </div>

          <div class="pt-2 flex justify-end gap-3">
            <button 
              type="button" 
              id="btn-cancel-create" 
              class="px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              id="btn-submit-create-restaurant" 
              class="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-sm">check_circle</span>
              Provision Restaurant & Account
            </button>
          </div>
        </form>
      </div>

      <!-- Restaurant Directory Table -->
      <div class="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Managed Restaurant Tenants</h3>
            <p class="text-xs text-gray-500">Click "Login as Owner" on any restaurant to inspect or manage their live dashboard</p>
          </div>
          <button 
            id="btn-refresh-restaurants" 
            type="button" 
            class="px-3.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-700 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span class="material-symbols-outlined text-sm">refresh</span>
            Refresh List
          </button>
        </div>

        <div class="overflow-x-auto rounded-2xl border border-gray-100">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="bg-gray-50/80 border-b border-gray-200 font-bold text-gray-500 uppercase tracking-wider text-[11px]">
                <th class="py-3.5 px-4">Restaurant Brand</th>
                <th class="py-3.5 px-4">Owner Credentials (Email)</th>
                <th class="py-3.5 px-4 text-center">POS Outlet restID</th>
                <th class="py-3.5 px-4 text-center">Diners Enrolled</th>
                <th class="py-3.5 px-4 text-center">Status</th>
                <th class="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="restaurants-table-body" class="divide-y divide-gray-100 font-medium">
              <tr>
                <td colspan="6" class="py-8 text-center text-gray-400">Loading managed restaurants from backend...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}

export function attachSuperAdminListeners() {
  const card = document.getElementById('create-restaurant-card');
  const openBtn = document.getElementById('btn-open-create-restaurant');
  const closeBtn = document.getElementById('btn-close-create-restaurant');
  const cancelBtn = document.getElementById('btn-cancel-create');
  const form = document.getElementById('form-create-restaurant');
  const refreshBtn = document.getElementById('btn-refresh-restaurants');
  const tbody = document.getElementById('restaurants-table-body');

  const toggleCard = (show) => {
    if (card) {
      if (show) card.classList.remove('hidden');
      else card.classList.add('hidden');
    }
  };

  if (openBtn) openBtn.onclick = () => toggleCard(true);
  if (closeBtn) closeBtn.onclick = () => toggleCard(false);
  if (cancelBtn) cancelBtn.onclick = () => toggleCard(false);


  // Fetch and populate restaurants table
  const loadRestaurants = async () => {
    try {
      const res = await apiFetch('/api/v1/admin/restaurants');
      const data = await res.json();

      if (res.ok && data.restaurants && tbody) {
        // Update KPIs
        const kpiRest = document.getElementById('kpi-total-restaurants');
        const kpiOut = document.getElementById('kpi-total-outlets');
        const kpiDiners = document.getElementById('kpi-total-diners');
        if (kpiRest) kpiRest.innerText = data.globalStats.totalRestaurants;
        if (kpiOut) kpiOut.innerText = data.globalStats.totalOutlets;
        if (kpiDiners) kpiDiners.innerText = data.globalStats.globalDiners.toLocaleString();

        tbody.innerHTML = data.restaurants.map(rest => {
          const defaultPwd = rest.defaultPassword || 'owner123';
          return `
          <tr class="hover:bg-gray-50/60 transition">
            <td class="py-3.5 px-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-purple-100 text-primary font-black text-xs flex items-center justify-center shrink-0">
                  ${rest.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p class="font-bold text-gray-900 text-xs">${rest.name}</p>
                  <p class="text-[11px] text-gray-400">${rest.plan || 'ENTERPRISE'} Plan</p>
                </div>
              </div>
            </td>
            <td class="py-3.5 px-4">
              <div class="space-y-0.5">
                <p class="font-bold text-gray-900">${rest.ownerName}</p>
                <p class="text-[11px] text-gray-600 font-mono">${rest.ownerEmail}</p>
                <p class="text-[10px] text-primary/80 font-medium">Password: <span class="font-mono font-bold">${defaultPwd}</span></p>
              </div>
            </td>
            <td class="py-3.5 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                ${rest.primaryRestID}
              </span>
            </td>
            <td class="py-3.5 px-4 text-center font-bold text-gray-800">
              ${(rest.totalDiners || 0).toLocaleString()}
            </td>
            <td class="py-3.5 px-4 text-center">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                ACTIVE
              </span>
            </td>
            <td class="py-3.5 px-4 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button 
                  type="button" 
                  data-copy-cred="${rest.ownerEmail}" 
                  data-pwd="${defaultPwd}"
                  data-brand="${rest.name}"
                  class="btn-copy-cred px-2.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1"
                  title="Copy Owner Credentials to clipboard"
                >
                  <span class="material-symbols-outlined text-xs">key</span>
                  <span>Copy Login</span>
                </button>
                <button 
                  type="button" 
                  data-copy-key="${rest.apiKey || ''}"
                  class="btn-copy-pos-key px-2.5 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1"
                  title="Copy Live POS API Key for RMS"
                >
                  <span class="material-symbols-outlined text-xs">vpn_key</span>
                  <span>POS Key</span>
                </button>
                <button 
                  type="button" 
                  data-impersonate-id="${rest.id}"
                  class="btn-impersonate-restaurant px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-xs transition flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-xs">login</span>
                  <span>Login as Owner</span>
                </button>
              </div>
            </td>
          </tr>
        `;
        }).join('');

        // Wire copy login credentials buttons
        document.querySelectorAll('.btn-copy-cred').forEach(btn => {
          btn.onclick = () => {
            const email = btn.getAttribute('data-copy-cred');
            const pwd = btn.getAttribute('data-pwd') || 'owner123';
            const brand = btn.getAttribute('data-brand') || 'Restaurant';
            const credText = `Username: ${email}\nPassword: ${pwd}\n(Or Brand Name: ${brand})`;
            navigator.clipboard.writeText(credText);
            showToast(`✅ Copied login for "${brand}"! (User: ${email} | Pass: ${pwd})`);
          };
        });

        // Wire copy POS key buttons
        document.querySelectorAll('.btn-copy-pos-key').forEach(btn => {
          btn.onclick = () => {
            const key = btn.getAttribute('data-copy-key');
            if (key) {
              navigator.clipboard.writeText(key);
              showToast('✅ POS API Key copied to clipboard! Paste into RMS Settings → Loyalty.');
            } else {
              showToast('No API key found for this restaurant', 'error');
            }
          };
        });

        // Wire impersonation buttons
        document.querySelectorAll('.btn-impersonate-restaurant').forEach(btn => {
          btn.onclick = async () => {
            const tenantId = btn.getAttribute('data-impersonate-id');
            try {
              const impRes = await apiFetch(`/api/v1/admin/impersonate/${tenantId}`, {
                method: 'POST'
              });
              const impData = await impRes.json();
              if (impRes.ok && impData.status === 'success') {
                await store.loginUser(impData.impersonatedUser, impData.token);
                showToast(`Now managing ${impData.impersonatedUser.tenantName}!`);
                window.location.hash = '#dashboard';
              }
            } catch (err) {
              console.error(err);
              showToast('Error switching tenant view', 'error');
            }
          };
        });
      }
    } catch (err) {
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-red-500">Failed to connect to backend server</td></tr>`;
      }
    }
  };

  loadRestaurants();
  if (refreshBtn) refreshBtn.onclick = loadRestaurants;

  // Form submission: Create new restaurant & owner
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const brandName = document.getElementById('input-brand-name')?.value.trim();
      const ownerName = document.getElementById('input-owner-name')?.value.trim();
      const ownerEmail = document.getElementById('input-owner-email')?.value.trim();
      const password = document.getElementById('input-owner-password')?.value.trim() || 'owner123';
      const primaryOutletName = document.getElementById('input-outlet-name')?.value.trim();
      const petpoojaRestID = document.getElementById('input-petpooja-restid')?.value.trim();

      const submitBtn = document.getElementById('btn-submit-create-restaurant');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Provisioning...';
      }

      try {
        const res = await apiFetch('/api/v1/admin/restaurants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandName,
            ownerName,
            ownerEmail,
            password,
            primaryOutletName,
            petpoojaRestID
          })
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          const credText = `Username: ${ownerEmail} (or "${brandName}")\nPassword: ${password}`;
          navigator.clipboard.writeText(credText);
          showToast(`🎉 Restaurant "${brandName}" created!\nOwner can login with: ${ownerEmail} (or "${brandName}") | Password: ${password}`, 'info', 7000);
          form.reset();
          toggleCard(false);
          loadRestaurants();
        } else {
          showToast(data.message || 'Error creating restaurant', 'error');
        }
      } catch (err) {
        showToast('Error contacting backend server', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span class="material-symbols-outlined text-sm">check_circle</span> Provision Restaurant & Account`;
        }
      }
    };
  }
}
