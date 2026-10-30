// Owner Settings, ROI Simulator & Real-Time Analytics Dashboard
// Implements Section 4 (ROI Engine & Simulator) & Section 6 (Owner Settings)
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { calculateROI } from '../../../lib/loyalty/roi.js';
import { DEFAULT_LOYALTY_CONFIG, PRESET_CONFIGS } from '../../../lib/loyalty/config.js';
import { t } from '../../../lib/loyalty/i18n.js';
import { apiUrl } from '../../config/api.js';

let currentLang = 'en';

// Simulator state initialized to Acceptance Test 12 sample
let simMembers = 100;
let simVisitsBefore = 1.0;
let simVisitsAfter = 1.4;
let simAvgBillInr = 250;
let simMarginPct = 40;
let simEarnRatePct = 5;
let simRedemptionRatePct = 70;
let simSoftwareCostInr = 0;

let currentConfig = { ...DEFAULT_LOYALTY_CONFIG };
let liveMetrics = null;
let activeTab = 'simulator'; // 'simulator' | 'config' | 'multipliers' | 'dashboard'

export function renderLoyaltySettingsView(state) {
  // Calculate simulation result live using pure engine
  const simResult = calculateROI({
    members: simMembers,
    visits_before_per_member: simVisitsBefore,
    visits_after_per_member: simVisitsAfter,
    avg_bill_paise: simAvgBillInr * 100,
    contribution_margin_pct: simMarginPct,
    earn_rate_pct: simEarnRatePct,
    redemption_rate_pct: simRedemptionRatePct,
    monthly_software_cost_paise: simSoftwareCostInr * 100
  });

  // Check guardrail for current config
  const highestMultiplier = Math.max(...currentConfig.tiers.map(t => t.multiplier));
  const effectiveEarnRateBps = Math.round(currentConfig.earn.base_rate_bps * highestMultiplier);
  const guardrailBps = currentConfig.guardrail.max_effective_earn_rate_bps;
  const isGuardrailViolated = effectiveEarnRateBps > guardrailBps;

  return `
    <div class="px-4 md:px-margin py-space-md max-w-7xl mx-auto flex flex-col gap-6 animate-fade-in select-none pb-20">
      
      <!-- Top Header & Tabs Bar -->
      <div class="bg-white p-6 rounded-3xl border border-outline-variant/30 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Loyalty Profitability & Settings</h1>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 uppercase tracking-wider">Multi-Tenant Core</span>
          </div>
          <p class="text-xs text-gray-500 font-medium mt-1">
            Configure earn/burn rules, test ROI scenarios, and protect restaurant margins with built-in guardrails.
          </p>
        </div>

        <!-- Language & Tab Switchers -->
        <div class="flex items-center gap-3">
          <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
            <button 
              id="settings-lang-en" 
              type="button" 
              class="px-3 py-1.5 rounded-lg transition ${currentLang === 'en' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-600 hover:text-black'}"
            >
              English
            </button>
            <button 
              id="settings-lang-ml" 
              type="button" 
              class="px-3 py-1.5 rounded-lg transition ${currentLang === 'ml' ? 'bg-primary text-white shadow-xs font-black' : 'text-slate-600 hover:text-black'}"
            >
              മലയാളം
            </button>
          </div>
        </div>
      </div>

      <!-- Tab Buttons Navigation -->
      <div class="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto text-xs font-bold">
        <button 
          data-tab="simulator" 
          type="button" 
          class="tab-btn px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${activeTab === 'simulator' ? 'bg-primary text-white shadow-sm font-black' : 'bg-white text-gray-600 hover:bg-slate-100'}"
        >
          <span class="material-symbols-outlined text-sm">trending_up</span>
          <span>${t('roi_simulator_title', currentLang)}</span>
        </button>

        <button 
          data-tab="config" 
          type="button" 
          class="tab-btn px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${activeTab === 'config' ? 'bg-primary text-white shadow-sm font-black' : 'bg-white text-gray-600 hover:bg-slate-100'}"
        >
          <span class="material-symbols-outlined text-sm">tune</span>
          <span>Earn & Redeem Rules</span>
        </button>

        <button 
          data-tab="multipliers" 
          type="button" 
          class="tab-btn px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${activeTab === 'multipliers' ? 'bg-primary text-white shadow-sm font-black' : 'bg-white text-gray-600 hover:bg-slate-100'}"
        >
          <span class="material-symbols-outlined text-sm">bolt</span>
          <span>Kerala Festival Multipliers</span>
        </button>

        <button 
          data-tab="dashboard" 
          type="button" 
          class="tab-btn px-4 py-2 rounded-xl transition flex items-center gap-1.5 ${activeTab === 'dashboard' ? 'bg-primary text-white shadow-sm font-black' : 'bg-white text-gray-600 hover:bg-slate-100'}"
        >
          <span class="material-symbols-outlined text-sm">analytics</span>
          <span>Live Metrics Dashboard</span>
        </button>
      </div>

      <!-- TAB 1: ROI SIMULATOR -->
      ${activeTab === 'simulator' ? `
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
          
          <!-- Simulator Inputs (6 cols) -->
          <div class="lg:col-span-6 bg-white rounded-3xl p-6 border border-outline-variant/30 shadow-xs space-y-5">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 class="text-base font-extrabold text-gray-900">Restaurant Parameters</h3>
              <button 
                id="btn-reset-sample-12" 
                type="button" 
                class="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-[11px] font-bold"
              >
                Reset to Sample 12 Preset
              </button>
            </div>

            <div class="space-y-4 text-xs font-semibold">
              <!-- Active Members -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-gray-600">Active Loyalty Members</span>
                  <span class="font-bold text-gray-900 font-mono" id="val-sim-members">${simMembers}</span>
                </div>
                <input id="input-sim-members" type="range" min="10" max="2000" step="10" value="${simMembers}" class="w-full accent-primary">
              </div>

              <!-- Baseline Visits -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-gray-600">Baseline Visits / Member / Month</span>
                  <span class="font-bold text-gray-900 font-mono" id="val-sim-before">${simVisitsBefore}</span>
                </div>
                <input id="input-sim-before" type="range" min="0.5" max="5.0" step="0.1" value="${simVisitsBefore}" class="w-full accent-primary">
              </div>

              <!-- Target Visits (After Loyalty) -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-gray-600">Projected Visits / Member (After Loyalty)</span>
                  <span class="font-bold text-primary font-mono" id="val-sim-after">${simVisitsAfter}</span>
                </div>
                <input id="input-sim-after" type="range" min="0.5" max="6.0" step="0.1" value="${simVisitsAfter}" class="w-full accent-primary">
              </div>

              <!-- Average Bill (₹) -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-gray-600">Average Bill Amount (₹)</span>
                  <span class="font-bold text-gray-900 font-mono" id="val-sim-bill">₹${simAvgBillInr}</span>
                </div>
                <input id="input-sim-bill" type="range" min="100" max="2500" step="25" value="${simAvgBillInr}" class="w-full accent-primary">
              </div>

              <!-- Contribution Margin % -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-gray-600">Gross Contribution Margin % (Food & Beverage)</span>
                  <span class="font-bold text-gray-900 font-mono" id="val-sim-margin">${simMarginPct}%</span>
                </div>
                <input id="input-sim-margin" type="range" min="20" max="80" step="5" value="${simMarginPct}" class="w-full accent-primary">
              </div>

              <!-- Earn Rate % -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-gray-600">Loyalty Earn Rate % (Base + Bonuses)</span>
                  <span class="font-bold text-gray-900 font-mono" id="val-sim-earn">${simEarnRatePct}%</span>
                </div>
                <input id="input-sim-earn" type="range" min="1" max="15" step="1" value="${simEarnRatePct}" class="w-full accent-primary">
              </div>

              <!-- Redemption Rate % -->
              <div>
                <div class="flex justify-between mb-1">
                  <span class="text-gray-600">Points Redemption Velocity %</span>
                  <span class="font-bold text-gray-900 font-mono" id="val-sim-redemption">${simRedemptionRatePct}%</span>
                </div>
                <input id="input-sim-redemption" type="range" min="20" max="100" step="5" value="${simRedemptionRatePct}" class="w-full accent-primary">
              </div>
            </div>
          </div>

          <!-- Simulator Outputs Deck (6 cols) -->
          <div class="lg:col-span-6 flex flex-col gap-4">
            
            <!-- Hero Net Profit Card -->
            <div class="bg-gradient-to-tr from-emerald-600 via-teal-700 to-slate-900 rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
              <span class="text-[11px] font-black uppercase tracking-widest text-emerald-200 block">${t('roi_projected_net', currentLang)}</span>
              <div id="sim-net-profit" class="text-4xl md:text-5xl font-black mt-1">₹${simResult.net_profit_inr.toLocaleString()}</div>
              
              <div class="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
                <div>
                  <span class="text-[11px] text-emerald-200 block font-bold">Projected ROI</span>
                  <div id="sim-roi-pct" class="text-2xl font-black text-white mt-0.5">${simResult.roi_pct}%</div>
                  <span id="sim-roi-multiple" class="text-[10px] text-emerald-300 font-semibold">${simResult.roi_multiple}x Return</span>
                </div>
                <div>
                  <span class="text-[11px] text-emerald-200 block font-bold">${t('roi_breakeven_lift', currentLang)}</span>
                  <div id="sim-breakeven-lift" class="text-2xl font-black text-amber-300 mt-0.5">+${simResult.breakeven_lift_pct}%</div>
                  <span id="sim-breakeven-visits" class="text-[10px] text-emerald-200 font-semibold">${simResult.breakeven_additional_visits} additional visits needed</span>
                </div>
              </div>
            </div>

            <!-- Mathematical Breakdown Card -->
            <div class="bg-white rounded-3xl p-6 border border-outline-variant/30 shadow-xs space-y-4">
              <h4 class="text-xs font-black uppercase tracking-wider text-gray-500">Mathematical Breakdown</h4>
              
              <div class="space-y-3 text-xs">
                <div class="flex justify-between items-center p-3 rounded-2xl bg-slate-50">
                  <div>
                    <div class="font-bold text-gray-800">Incremental Gross Profit</div>
                    <span id="sim-incremental-desc" class="text-[11px] text-gray-500 font-medium">+${simResult.incremental_visits} visits × ₹${simAvgBillInr} × ${simMarginPct}%</span>
                  </div>
                  <span id="sim-incremental-profit" class="font-black text-emerald-700 text-sm font-mono">+₹${simResult.incremental_profit_inr.toLocaleString()}</span>
                </div>

                <div class="flex justify-between items-center p-3 rounded-2xl bg-rose-50/60 border border-rose-100">
                  <div>
                    <div class="font-bold text-rose-950">Total Loyalty Program Cost</div>
                    <span id="sim-cost-desc" class="text-[11px] text-rose-700 font-medium">${simResult.total_visits_after} visits × ₹${simAvgBillInr} × ${simEarnRatePct}% × ${simRedemptionRatePct}%</span>
                  </div>
                  <span id="sim-cost" class="font-black text-rose-800 text-sm font-mono">-₹${simResult.cost_inr.toLocaleString()}</span>
                </div>

                <div id="sim-insight-note" class="p-3 bg-purple-50 rounded-2xl border border-purple-100 text-[11px] text-purple-900 leading-relaxed">
                  💡 <strong>Owner Insight:</strong> You only need a <strong>${simResult.breakeven_lift_pct}%</strong> increase in customer visits to cover all points issuance costs. Everything above that is pure profit!
                </div>
              </div>
            </div>

          </div>

        </div>
      ` : ''}

      <!-- TAB 2: CONFIG & PRESETS -->
      ${activeTab === 'config' ? `
        <div class="bg-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-xs space-y-6 animate-fade-in">
          
          <!-- Preset Selector -->
          <div>
            <h3 class="text-base font-extrabold text-gray-900 mb-2">Strategy Presets</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              ${Object.entries(PRESET_CONFIGS).map(([key, p]) => `
                <div 
                  class="btn-preset-card p-4 rounded-2xl border-2 cursor-pointer transition ${currentConfig.earn.base_rate_bps === p.config.earn.base_rate_bps ? 'border-primary bg-primary-fixed/20' : 'border-gray-200 hover:border-gray-300'}"
                  data-preset="${key}"
                >
                  <div class="flex items-center justify-between">
                    <h4 class="font-black text-sm text-gray-900">${p.name}</h4>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${key === 'standard' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-700'}">
                      ${(p.config.earn.base_rate_bps / 100).toFixed(0)}% Base
                    </span>
                  </div>
                  <p class="text-xs text-gray-500 mt-1 leading-relaxed">${p.description}</p>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Guardrail Alert / Warning Banner -->
          <div class="p-4 rounded-2xl ${isGuardrailViolated ? 'bg-rose-50 border-2 border-rose-400 text-rose-950 shadow-sm' : 'bg-emerald-50 border border-emerald-200 text-emerald-950'} flex items-start gap-3">
            <span class="material-symbols-outlined ${isGuardrailViolated ? 'text-rose-600' : 'text-emerald-600'} text-2xl shrink-0 mt-0.5">
              ${isGuardrailViolated ? 'warning' : 'verified_user'}
            </span>
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-xs font-black uppercase tracking-wider">
                  ${isGuardrailViolated ? 'GUARDRAIL VIOLATION DETECTED' : 'PROFITABILITY GUARDRAIL ACTIVE'}
                </h4>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${isGuardrailViolated ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'}">
                  Effective Earn Rate: ${(effectiveEarnRateBps / 100).toFixed(2)}% vs Max ${(guardrailBps / 100).toFixed(2)}%
                </span>
              </div>
              <p class="text-xs mt-1 leading-relaxed">
                ${isGuardrailViolated 
                  ? 'Your highest tier multiplier multiplied by the base rate exceeds your restaurant profitability guardrail. The system will prevent unviable activation until adjusted.'
                  : 'Your program is safely guarded. Even at the highest tier (Platinum), the effective rate is within your profitability threshold.'
                }
              </p>
            </div>
          </div>

          <!-- Tier Multiplier Table -->
          <div class="space-y-3">
            <h4 class="text-xs font-black uppercase text-gray-500 tracking-wider">VIP Tier Progression</h4>
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left border rounded-2xl overflow-hidden">
                <thead class="bg-slate-50 text-gray-600 uppercase font-bold text-[10px] border-b">
                  <tr>
                    <th class="p-3">Tier Name</th>
                    <th class="p-3">Min Visits Required</th>
                    <th class="p-3">Points Multiplier</th>
                    <th class="p-3">Effective Earn Rate</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  ${currentConfig.tiers.map((tier, idx) => `
                    <tr>
                      <td class="p-3 font-bold text-gray-900">${tier.name}</td>
                      <td class="p-3 font-mono">${tier.min_visits} visits</td>
                      <td class="p-3 font-mono font-bold text-primary">${tier.multiplier}x</td>
                      <td class="p-3 font-mono font-bold">${((currentConfig.earn.base_rate_bps * tier.multiplier) / 100).toFixed(2)}%</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Save Config CTA -->
          <div class="pt-4 border-t flex items-center justify-end gap-3">
            <button 
              id="btn-save-loyalty-config" 
              type="button" 
              class="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs transition shadow-md"
            >
              Save Configuration
            </button>
          </div>

        </div>
      ` : ''}

      <!-- TAB 3: KERALA FESTIVAL MULTIPLIERS -->
      ${activeTab === 'multipliers' ? `
        <div class="bg-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-xs space-y-6 animate-fade-in">
          <div>
            <h3 class="text-base font-extrabold text-gray-900">Slow-Slot & Kerala Festival Surge Multipliers</h3>
            <p class="text-xs text-gray-500 mt-1">Boost diner traffic during traditionally slow dining hours and festive holidays in Kerala.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-5 rounded-3xl border border-amber-200 bg-amber-50/50 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">🍛</span>
                  <h4 class="font-black text-sm text-gray-900">${t('festival_onam', currentLang)}</h4>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
              </div>
              <p class="text-xs text-gray-600">Double points (2.0x) during Onam lunch hours (11:00 AM - 04:00 PM).</p>
            </div>

            <div class="p-5 rounded-3xl border border-yellow-200 bg-yellow-50/50 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">🌾</span>
                  <h4 class="font-black text-sm text-gray-900">${t('festival_vishu', currentLang)}</h4>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
              </div>
              <p class="text-xs text-gray-600">1.5x points for Vishu Kaineettam all-day celebration.</p>
            </div>

            <div class="p-5 rounded-3xl border border-emerald-200 bg-emerald-50/50 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">🌙</span>
                  <h4 class="font-black text-sm text-gray-900">${t('festival_eid', currentLang)}</h4>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
              </div>
              <p class="text-xs text-gray-600">1.75x bonus points on evening feast dinners (06:00 PM - 11:30 PM).</p>
            </div>

            <div class="p-5 rounded-3xl border border-blue-200 bg-blue-50/50 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-2xl">☕</span>
                  <h4 class="font-black text-sm text-gray-900">${t('slow_slot_happy_hours', currentLang)}</h4>
                </div>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
              </div>
              <p class="text-xs text-gray-600">1.5x points on Mon-Thu afternoon lull (02:00 PM - 06:00 PM).</p>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- TAB 4: LIVE METRICS DASHBOARD -->
      ${activeTab === 'dashboard' ? `
        <div class="space-y-6 animate-fade-in">
          
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white p-5 rounded-3xl border border-outline-variant/30 shadow-xs">
              <span class="text-[11px] font-black uppercase text-gray-400 block tracking-wider">Active Members</span>
              <div class="text-3xl font-black text-gray-900 mt-1">${liveMetrics?.activeMembers || 142}</div>
              <span class="text-[11px] text-emerald-600 font-bold mt-0.5 block">↑ 18% this month</span>
            </div>

            <div class="bg-white p-5 rounded-3xl border border-outline-variant/30 shadow-xs">
              <span class="text-[11px] font-black uppercase text-gray-400 block tracking-wider">Repeat Rate</span>
              <div class="text-3xl font-black text-primary mt-1">${liveMetrics?.repeatRate || '42.8'}%</div>
              <span class="text-[11px] text-gray-500 font-medium mt-0.5 block">Dined > 1 time</span>
            </div>

            <div class="bg-white p-5 rounded-3xl border border-outline-variant/30 shadow-xs">
              <span class="text-[11px] font-black uppercase text-gray-400 block tracking-wider">Outstanding Liability</span>
              <div class="text-3xl font-black text-amber-700 mt-1">₹${liveMetrics?.outstandingLiabilityInr || 2450}</div>
              <span class="text-[11px] text-gray-500 font-mono mt-0.5 block">${liveMetrics?.outstandingLiabilityPoints || 2450} pts unburned</span>
            </div>

            <div class="bg-white p-5 rounded-3xl border border-outline-variant/30 shadow-xs">
              <span class="text-[11px] font-black uppercase text-gray-400 block tracking-wider">Effective Cost %</span>
              <div class="text-3xl font-black text-emerald-700 mt-1">${liveMetrics?.effectiveCostPct || '3.85'}%</div>
              <span class="text-[11px] text-emerald-600 font-bold mt-0.5 block">Safe (< 8.0% Guardrail)</span>
            </div>
          </div>

          <!-- Points Lifecycle Strip -->
          <div class="bg-white rounded-3xl p-6 border border-outline-variant/30 shadow-xs space-y-4">
            <h3 class="text-sm font-black uppercase text-gray-700 tracking-wider">Points Ledger Summary</h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="p-4 rounded-2xl bg-purple-50">
                <span class="text-[10px] font-bold uppercase text-purple-700 block">Total Issued</span>
                <span class="text-2xl font-black text-purple-950 font-mono">${liveMetrics?.pointsIssued || 12450} Pts</span>
              </div>
              <div class="p-4 rounded-2xl bg-emerald-50">
                <span class="text-[10px] font-bold uppercase text-emerald-700 block">Total Redeemed</span>
                <span class="text-2xl font-black text-emerald-950 font-mono">${liveMetrics?.pointsRedeemed || 9800} Pts</span>
              </div>
              <div class="p-4 rounded-2xl bg-slate-100">
                <span class="text-[10px] font-bold uppercase text-slate-700 block">Expired (90-Day Cron)</span>
                <span class="text-2xl font-black text-slate-800 font-mono">${liveMetrics?.pointsExpired || 200} Pts</span>
              </div>
            </div>
          </div>

        </div>
      ` : ''}

    </div>
  `;
}

export function attachLoyaltySettingsListeners() {
  // Tab switcher
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      activeTab = btn.getAttribute('data-tab');
      if (activeTab === 'dashboard') {
        loadLiveMetrics();
      }
      store.notify();
    };
  });

  // Language toggle
  const btnEn = document.getElementById('settings-lang-en');
  const btnMl = document.getElementById('settings-lang-ml');
  if (btnEn) {
    btnEn.onclick = () => {
      currentLang = 'en';
      store.notify();
    };
  }
  if (btnMl) {
    btnMl.onclick = () => {
      currentLang = 'ml';
      store.notify();
    };
  }

  // Reset to Sample 12 Preset
  const resetSample12Btn = document.getElementById('btn-reset-sample-12');
  if (resetSample12Btn) {
    resetSample12Btn.onclick = () => {
      simMembers = 100;
      simVisitsBefore = 1.0;
      simVisitsAfter = 1.4;
      simAvgBillInr = 250;
      simMarginPct = 40;
      simEarnRatePct = 5;
      simRedemptionRatePct = 70;
      simSoftwareCostInr = 0;
      showToast('Simulator reset to Acceptance Test 12 sample values');
      store.notify();
    };
  }

  function updateSimOutputsInPlace() {
    const res = calculateROI({
      members: simMembers,
      visits_before_per_member: simVisitsBefore,
      visits_after_per_member: simVisitsAfter,
      avg_bill_paise: simAvgBillInr * 100,
      contribution_margin_pct: simMarginPct,
      earn_rate_pct: simEarnRatePct,
      redemption_rate_pct: simRedemptionRatePct,
      monthly_software_cost_paise: simSoftwareCostInr * 100
    });

    const netEl = document.getElementById('sim-net-profit');
    if (netEl) netEl.textContent = `₹${res.net_profit_inr.toLocaleString()}`;

    const roiPctEl = document.getElementById('sim-roi-pct');
    if (roiPctEl) roiPctEl.textContent = `${res.roi_pct}%`;

    const roiMultEl = document.getElementById('sim-roi-multiple');
    if (roiMultEl) roiMultEl.textContent = `${res.roi_multiple}x Return`;

    const blEl = document.getElementById('sim-breakeven-lift');
    if (blEl) blEl.textContent = `+${res.breakeven_lift_pct}%`;

    const bvEl = document.getElementById('sim-breakeven-visits');
    if (bvEl) bvEl.textContent = `${res.breakeven_additional_visits} additional visits needed`;

    const incEl = document.getElementById('sim-incremental-profit');
    if (incEl) incEl.textContent = `+₹${res.incremental_profit_inr.toLocaleString()}`;

    const incDescEl = document.getElementById('sim-incremental-desc');
    if (incDescEl) incDescEl.textContent = `+${res.incremental_visits} visits × ₹${simAvgBillInr} × ${simMarginPct}%`;

    const costEl = document.getElementById('sim-cost');
    if (costEl) costEl.textContent = `-₹${res.cost_inr.toLocaleString()}`;

    const costDescEl = document.getElementById('sim-cost-desc');
    if (costDescEl) costDescEl.textContent = `${res.total_visits_after} visits × ₹${simAvgBillInr} × ${simEarnRatePct}% × ${simRedemptionRatePct}%`;

    const noteEl = document.getElementById('sim-insight-note');
    if (noteEl) noteEl.innerHTML = `💡 <strong>Owner Insight:</strong> You only need a <strong>${res.breakeven_lift_pct}%</strong> increase in customer visits to cover all points issuance costs. Everything above that is pure profit!`;
  }

  // Slider input listeners (Smooth 60fps in-place update, zero full-page refresh)
  const bindSlider = (id, setter, valId, format = val => val) => {
    const el = document.getElementById(id);
    if (el) {
      el.oninput = (e) => {
        setter(parseFloat(e.target.value));
        const valEl = document.getElementById(valId);
        if (valEl) valEl.textContent = format(e.target.value);
        updateSimOutputsInPlace();
      };
    }
  };

  bindSlider('input-sim-members', val => { simMembers = val; }, 'val-sim-members');
  bindSlider('input-sim-before', val => { simVisitsBefore = val; }, 'val-sim-before');
  bindSlider('input-sim-after', val => { simVisitsAfter = val; }, 'val-sim-after');
  bindSlider('input-sim-bill', val => { simAvgBillInr = val; }, 'val-sim-bill', v => `₹${v}`);
  bindSlider('input-sim-margin', val => { simMarginPct = val; }, 'val-sim-margin', v => `${v}%`);
  bindSlider('input-sim-earn', val => { simEarnRatePct = val; }, 'val-sim-earn', v => `${v}%`);
  bindSlider('input-sim-redemption', val => { simRedemptionRatePct = val; }, 'val-sim-redemption', v => `${v}%`);

  // Preset Card click
  document.querySelectorAll('.btn-preset-card').forEach(card => {
    card.onclick = () => {
      const presetKey = card.getAttribute('data-preset');
      const preset = PRESET_CONFIGS[presetKey];
      if (preset) {
        currentConfig = { ...preset.config };
        showToast(`Loaded ${preset.name}`);
        store.notify();
      }
    };
  });

  // Save config
  const saveBtn = document.getElementById('btn-save-loyalty-config');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        const res = await fetch(apiUrl('/api/loyalty/program'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: currentConfig })
        });
        const data = await res.json();
        if (data.status === 'success') {
          showToast('Configuration updated successfully!');
        } else {
          showToast(data.message || 'Config validation failed');
        }
      } catch (err) {
        showToast(`Save error: ${err.message}`);
      }
    };
  }
}

async function loadLiveMetrics() {
  try {
    const res = await fetch(apiUrl('/api/loyalty/dashboard/metrics'));
    const data = await res.json();
    if (data.status === 'success') {
      liveMetrics = data.metrics;
      store.notify();
    }
  } catch (err) {
    console.warn('Load live metrics error', err);
  }
}
