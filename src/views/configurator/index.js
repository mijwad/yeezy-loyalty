// Loyalty Program Multi-Step Configurator Module with co-located event handling
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';

export function renderConfigurator(state, activeStep = 1, activePanel = 'theme') {
  const { loyaltyProgram, activeOutlet } = state;
  const p = loyaltyProgram;

  const steps = [
    { num: 1, label: 'Theme & Rules', key: 'theme' },
    { num: 2, label: 'Rewards Tiers', key: 'rewards' },
    { num: 3, label: 'Reminders & Expiry', key: 'reminders' },
    { num: 4, label: 'Channels', key: 'channels' },
    { num: 5, label: 'Review & Activate', key: 'review' }
  ];

  const progressPercent = Math.min(100, Math.round((activeStep / 5) * 100));

  return `
    <div class="min-h-screen bg-[#f5f8f9] flex flex-col font-sans select-none animate-fade-in">
      
      <!-- Top Stepper Header -->
      <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div class="px-6 py-3 flex items-center justify-between">
          <!-- Left: Back Button & Store Selector Pill -->
          <div class="flex items-center space-x-4">
            <a 
              href="#loyalty" 
              class="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span class="material-symbols-outlined text-sm">arrow_back</span>
              <span>Back to Overview</span>
            </a>
            
            <div class="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-md text-xs font-bold text-slate-800 bg-slate-50">
              <span class="material-symbols-outlined text-sm text-slate-500">storefront</span>
              <span id="configurator-outlet-name">${activeOutlet}</span>
            </div>
          </div>

          <!-- Middle: Step Indicator Pills -->
          <div class="hidden lg:flex items-center gap-2">
            ${steps.map(s => `
              <button 
                type="button"
                data-config-step="${s.num}" 
                class="config-step-btn px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${s.num === activeStep ? 'bg-[#008384] text-white shadow-sm' : (s.num < activeStep ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100')}"
              >
                <span class="w-4 h-4 rounded-full ${s.num === activeStep ? 'bg-white text-[#008384]' : 'bg-slate-200 text-slate-700'} text-[10px] flex items-center justify-center font-black">
                  ${s.num < activeStep ? '✓' : s.num}
                </span>
                <span>${s.label}</span>
              </button>
            `).join('')}
          </div>

          <!-- Right: Action CTA -->
          <div class="flex items-center gap-3">
            <button 
              id="btn-save-draft"
              type="button" 
              class="hidden sm:inline-flex px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Save Draft
            </button>
            ${activeStep === 5 ? `
              <button 
                id="btn-activate-program" 
                type="button" 
                class="px-6 py-2 bg-[#008384] hover:bg-[#006e6f] text-white text-xs font-bold rounded-lg shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-sm">rocket_launch</span>
                <span>Activate Program</span>
              </button>
            ` : `
              <button 
                id="btn-next-step" 
                type="button" 
                class="px-5 py-2 bg-[#008384] hover:bg-[#006e6f] text-white text-xs font-bold rounded-lg shadow-md transition active:scale-95 flex items-center gap-1.5"
              >
                <span>Continue</span>
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            `}
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-slate-100 h-[3px]">
          <div class="bg-[#008384] h-[3px] transition-all duration-300" style="width: ${progressPercent}%;"></div>
        </div>
      </header>

      <!-- Main Configurator Split Layout -->
      <main class="flex-1 flex overflow-hidden min-h-[calc(100vh-65px)]">
        
        <!-- Left Section: Live Interactive Smartphone Card Preview -->
        <section class="flex-1 bg-[#f0f9fa] p-6 md:p-10 flex items-center justify-center overflow-y-auto relative">
          
          <div class="flex items-center justify-center w-full max-w-4xl relative">
            
            <!-- Central Mobile Preview Card -->
            <div class="w-[350px] sm:w-[370px] bg-[#221c19] text-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col relative border-4 border-[#382f2a] transition-all duration-300">
              
              <!-- Header Image & Logo Area -->
              <div 
                id="preview-card-banner" 
                class="relative w-full h-[190px] overflow-hidden bg-cover bg-center transition-all" 
                style="background-image: url('${p.bannerUrl}');"
              >
                <div class="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#221c19]/95"></div>
                
                <!-- Circular Logo Badge -->
                <div class="absolute bottom-2 left-5 w-18 h-18 bg-white rounded-full p-1 shadow-xl flex items-center justify-center border-2 border-white">
                  <div class="w-16 h-16 rounded-full flex flex-col items-center justify-center text-center bg-white p-1">
                    <span id="preview-logo-text" class="text-[11px] font-black tracking-widest text-slate-900 uppercase">
                      ${p.name.slice(0, 6)}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Card Body Content -->
              <div class="px-6 pt-3 pb-6 flex flex-col space-y-4">
                <div>
                  <h2 id="preview-program-title" class="text-2xl font-black text-white tracking-tight">${p.title}</h2>
                  <p id="preview-program-subtitle" class="text-xs text-slate-300 mt-0.5 font-normal">${p.subtitle}</p>
                </div>

                <!-- Spend to Points Conversion Rate -->
                <div class="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 flex items-center justify-between">
                  <span class="text-xs text-amber-300 font-bold tracking-wide">
                    ₹<span id="preview-spend-rate">${p.spendRate}</span> Spent = <span id="preview-points-rate">${p.pointsRate}</span> Points
                  </span>
                  <span class="text-[10px] bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded font-bold">Automatic</span>
                </div>

                <!-- Milestones & Tiers List -->
                <div class="space-y-3 pt-1" id="preview-tiers-container">
                  ${p.rewardTiers.map(tier => `
                    <div class="flex items-start justify-between text-xs border-b border-[#3b322c]/80 pb-3">
                      <div class="w-20 shrink-0 font-extrabold text-sm text-white flex items-baseline gap-1">
                        <span>${tier.points}</span>
                        <span class="text-[10px] font-medium text-slate-400">PTS</span>
                      </div>
                      <div class="flex-1 text-slate-200 text-xs">
                        <div class="font-bold text-white">${tier.title}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5 leading-tight">${tier.condition}</div>
                      </div>
                    </div>
                  `).join('')}
                </div>

                <!-- Terms Snippet -->
                <div class="pt-2 border-t border-[#3b322c]/50">
                  <p class="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                    * Terms apply: Points valid for 12 months. Dine-in only.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </section>

        <!-- Right Section: Interactive Configuration Panel -->
        <aside class="w-full lg:w-[420px] xl:w-[460px] border-l border-slate-200 bg-white flex flex-col shrink-0 z-10 shadow-lg justify-between overflow-y-auto">
          
          <div class="p-6 md:p-8 space-y-6">

            <!-- STEP 1: THEME & BASIC INFO -->
            ${activeStep === 1 ? `
              <div class="space-y-6 animate-fade-in">
                <div>
                  <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">Theme & Branding</h2>
                  <p class="text-xs text-slate-500 mt-1">Configure your restaurant's digital loyalty card look and feel.</p>
                </div>

                <!-- Brand Name Input -->
                <div class="space-y-2">
                  <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">Restaurant Program Name</label>
                  <input 
                    id="input-program-name" 
                    type="text" 
                    value="${p.name}" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#008384] focus:outline-none"
                    placeholder="e.g. durbar, Downtown Bistro, Yeezy Club"
                  >
                </div>

                <!-- Headline & Subtitle -->
                <div class="space-y-2">
                  <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">Card Title</label>
                  <input 
                    id="input-program-title" 
                    type="text" 
                    value="${p.title}" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#008384] focus:outline-none"
                  >
                </div>
                <div class="space-y-2">
                  <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">Card Subtitle</label>
                  <input 
                    id="input-program-subtitle" 
                    type="text" 
                    value="${p.subtitle}" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-[#008384] focus:outline-none"
                  >
                </div>

                <!-- Color Palette Picker -->
                <div class="space-y-2">
                  <label class="block text-xs font-bold text-slate-800 uppercase tracking-wider">Color Theme</label>
                  <div class="grid grid-cols-4 gap-2">
                    <button type="button" data-theme-color="#0a7d74" class="theme-color-btn py-2 px-3 rounded-xl border-2 ${p.themeColor === '#0a7d74' ? 'border-[#0a7d74] bg-teal-50' : 'border-slate-200'} flex flex-col items-center gap-1">
                      <span class="w-5 h-5 rounded-full bg-[#0a7d74] shadow-sm"></span>
                      <span class="text-[10px] font-bold text-slate-700">Teal</span>
                    </button>
                    <button type="button" data-theme-color="#7c3aed" class="theme-color-btn py-2 px-3 rounded-xl border-2 ${p.themeColor === '#7c3aed' ? 'border-[#7c3aed] bg-purple-50' : 'border-slate-200'} flex flex-col items-center gap-1">
                      <span class="w-5 h-5 rounded-full bg-[#7c3aed] shadow-sm"></span>
                      <span class="text-[10px] font-bold text-slate-700">Violet</span>
                    </button>
                    <button type="button" data-theme-color="#a43073" class="theme-color-btn py-2 px-3 rounded-xl border-2 ${p.themeColor === '#a43073' ? 'border-[#a43073] bg-pink-50' : 'border-slate-200'} flex flex-col items-center gap-1">
                      <span class="w-5 h-5 rounded-full bg-[#a43073] shadow-sm"></span>
                      <span class="text-[10px] font-bold text-slate-700">Rose</span>
                    </button>
                    <button type="button" data-theme-color="#b45309" class="theme-color-btn py-2 px-3 rounded-xl border-2 ${p.themeColor === '#b45309' ? 'border-[#b45309] bg-amber-50' : 'border-slate-200'} flex flex-col items-center gap-1">
                      <span class="w-5 h-5 rounded-full bg-[#b45309] shadow-sm"></span>
                      <span class="text-[10px] font-bold text-slate-700">Amber</span>
                    </button>
                  </div>
                </div>

                <!-- Points Ratio Configuration -->
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <span class="text-xs font-bold text-slate-900 uppercase tracking-wider block">Points Earning Ratio</span>
                  <div class="flex items-center gap-2">
                    <div class="flex-1">
                      <label class="text-[10px] text-slate-500 font-bold block mb-1">For every (₹)</label>
                      <input id="input-spend-rate" type="number" value="${p.spendRate}" class="w-full px-3 py-2 text-xs border rounded-lg font-bold">
                    </div>
                    <span class="text-slate-400 font-bold mt-4">=</span>
                    <div class="flex-1">
                      <label class="text-[10px] text-slate-500 font-bold block mb-1">Customer Earns (pts)</label>
                      <input id="input-points-rate" type="number" value="${p.pointsRate}" class="w-full px-3 py-2 text-xs border rounded-lg font-bold">
                    </div>
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- STEP 2: REWARDS TIERS EDITOR -->
            ${activeStep === 2 ? `
              <div class="space-y-6 animate-fade-in">
                <div>
                  <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">Reward Tiers</h2>
                  <p class="text-xs text-slate-500 mt-1">Define points milestones and redemption vouchers for your diners.</p>
                </div>

                <!-- Tiers List -->
                <div class="space-y-4" id="config-tiers-list">
                  ${p.rewardTiers.map((tier, idx) => `
                    <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3 relative">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-black text-[#008384] uppercase tracking-wider">Tier ${idx + 1}</span>
                        <button type="button" data-delete-tier="${tier.id}" class="text-red-500 hover:text-red-700 text-xs font-bold">
                          Remove
                        </button>
                      </div>

                      <div class="grid grid-cols-2 gap-2">
                        <div>
                          <label class="text-[10px] text-slate-500 font-bold block mb-1">Points Needed</label>
                          <input type="number" value="${tier.points}" data-tier-field="points" data-tier-id="${tier.id}" class="tier-input w-full px-3 py-1.5 text-xs border rounded-lg font-bold">
                        </div>
                        <div>
                          <label class="text-[10px] text-slate-500 font-bold block mb-1">Reward Type</label>
                          <select data-tier-field="rewardType" data-tier-id="${tier.id}" class="tier-input w-full px-2 py-1.5 text-xs border rounded-lg">
                            <option value="item" ${tier.rewardType === 'item' ? 'selected' : ''}>Free Menu Item</option>
                            <option value="discount_amount" ${tier.rewardType === 'discount_amount' ? 'selected' : ''}>₹ Flat Discount</option>
                            <option value="discount_percentage" ${tier.rewardType === 'discount_percentage' ? 'selected' : ''}>% Percentage Off</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label class="text-[10px] text-slate-500 font-bold block mb-1">Reward Description</label>
                        <input type="text" value="${tier.title}" data-tier-field="title" data-tier-id="${tier.id}" class="tier-input w-full px-3 py-1.5 text-xs border rounded-lg font-medium">
                      </div>
                    </div>
                  `).join('')}
                </div>

                <button 
                  id="btn-add-reward-tier" 
                  type="button" 
                  class="w-full py-2.5 rounded-xl border-2 border-dashed border-[#008384] text-[#008384] hover:bg-teal-50 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span class="material-symbols-outlined text-sm">add_circle</span>
                  <span>Add Reward Tier</span>
                </button>
              </div>
            ` : ''}

            <!-- STEP 3: REMINDERS & EXPIRY -->
            ${activeStep === 3 ? `
              <div class="space-y-6 animate-fade-in">
                <div>
                  <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">Reminders & Expiry</h2>
                  <p class="text-xs text-slate-500 mt-1">Automate win-back messages and points expiration alerts.</p>
                </div>

                <!-- 30-Day Inactivity Reminder -->
                <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-xs font-bold text-slate-900 block">30-Day Win-Back Reminder</span>
                      <span class="text-[11px] text-slate-500">Sent if guest hasn't dined in 30 days</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input id="toggle-inactivity" type="checkbox" ${p.reminders.inactivityReminderEnabled ? 'checked' : ''} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#008384]"></div>
                    </label>
                  </div>
                  <textarea id="text-inactivity-message" rows="3" class="w-full p-2.5 text-xs border rounded-xl text-slate-700 font-medium">${p.reminders.inactivityMessage}</textarea>
                </div>

                <!-- 11-Month Points Expiry Alert -->
                <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <span class="text-xs font-bold text-slate-900 block">11-Month Expiry Warning Alert</span>
                      <span class="text-[11px] text-slate-500">Warn guests before points expire</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input id="toggle-expiry-alert" type="checkbox" ${p.reminders.expiryAlertEnabled ? 'checked' : ''} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#008384]"></div>
                    </label>
                  </div>
                  <textarea id="text-expiry-message" rows="3" class="w-full p-2.5 text-xs border rounded-xl text-slate-700 font-medium">${p.reminders.expiryAlertMessage}</textarea>
                </div>

                <!-- 12-Month Expiration Policy -->
                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span class="text-xs font-bold text-slate-900 block">Points Expiration Policy</span>
                    <span class="text-[11px] text-slate-500">Points lapse 12 months from purchase date</span>
                  </div>
                  <span class="text-xs font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">12 Months</span>
                </div>
              </div>
            ` : ''}

            <!-- STEP 4: DELIVERY CHANNELS -->
            ${activeStep === 4 ? `
              <div class="space-y-6 animate-fade-in">
                <div>
                  <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">Delivery Channels</h2>
                  <p class="text-xs text-slate-500 mt-1">Configure where guests receive points notifications.</p>
                </div>

                <!-- WhatsApp Channel -->
                <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-emerald-600 text-xl">chat</span>
                      <span class="text-xs font-bold text-slate-900">WhatsApp Utility (Verified)</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input id="toggle-channel-whatsapp" type="checkbox" ${p.channels.whatsappUtility.enabled ? 'checked' : ''} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#008384]"></div>
                    </label>
                  </div>
                  <p class="text-[11px] text-slate-500">Delivered via Meta Official WhatsApp Cloud API with verified green badge.</p>
                </div>

                <!-- SMS Channel -->
                <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-blue-600 text-xl">sms</span>
                      <span class="text-xs font-bold text-slate-900">SMS Gateway</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input id="toggle-channel-sms" type="checkbox" ${p.channels.sms.enabled ? 'checked' : ''} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#008384]"></div>
                    </label>
                  </div>
                  <p class="text-[11px] text-slate-500">Instant transactional SMS sent directly after POS billing checkout. Sender ID: <strong>${p.channels.sms.senderId}</strong></p>
                </div>

                <!-- WhatsApp Marketing Channel -->
                <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-pink-600 text-xl">campaign</span>
                      <span class="text-xs font-bold text-slate-900">WhatsApp Marketing</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input id="toggle-channel-wa-marketing" type="checkbox" ${p.channels.whatsappMarketing.enabled ? 'checked' : ''} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#008384]"></div>
                    </label>
                  </div>
                  <p class="text-[11px] text-slate-500">Promotional broadcasts for VIP specials, weekend offers, and double points events.</p>
                </div>

                <!-- Email Channel -->
                <div class="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-orange-600 text-xl">mail</span>
                      <span class="text-xs font-bold text-slate-900">Email Dining Summaries</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input id="toggle-channel-email" type="checkbox" ${p.channels.email.enabled ? 'checked' : ''} class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#008384]"></div>
                    </label>
                  </div>
                  <p class="text-[11px] text-slate-500">Weekly and monthly statements from <strong>${p.channels.email.fromEmail}</strong>.</p>
                </div>
              </div>
            ` : ''}

            <!-- STEP 5: REVIEW & ACTIVATE -->
            ${activeStep === 5 ? `
              <div class="space-y-6 animate-fade-in">
                <div>
                  <h2 class="text-xl font-extrabold text-slate-900 tracking-tight">Review Program</h2>
                  <p class="text-xs text-slate-500 mt-1">Verify your configuration before setting your loyalty program live.</p>
                </div>

                <div class="space-y-3 text-xs">
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span class="text-slate-500 font-semibold">Program Name</span>
                    <span class="font-bold text-slate-900">${p.title}</span>
                  </div>
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span class="text-slate-500 font-semibold">Earning Model</span>
                    <span class="font-bold text-emerald-700">₹${p.spendRate} Spent = ${p.pointsRate} Pts</span>
                  </div>
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span class="text-slate-500 font-semibold">Active Reward Tiers</span>
                    <span class="font-bold text-slate-900">${p.rewardTiers.length} Tiers Configured</span>
                  </div>
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span class="text-slate-500 font-semibold">Reminders</span>
                    <span class="font-bold text-slate-900">30-Day Win-Back Active</span>
                  </div>
                  <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                    <span class="text-slate-500 font-semibold">Delivery Channels</span>
                    <span class="font-bold text-slate-900">SMS, WhatsApp & Email</span>
                  </div>
                </div>

                <div class="pt-2">
                  <button 
                    id="btn-activate-program-panel"
                    type="button" 
                    class="w-full py-3.5 px-4 rounded-xl bg-[#008384] hover:bg-[#006e6f] text-white font-extrabold text-sm transition shadow-lg flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span class="material-symbols-outlined text-lg">celebration</span>
                    <span>Activate Loyalty Program</span>
                  </button>
                  <p class="text-[11px] text-center text-slate-400 mt-2 font-medium">
                    Program will be immediately active for ${activeOutlet} diners.
                  </p>
                </div>
              </div>
            ` : ''}

          </div>

          <!-- Bottom Stepper Navigation Controls -->
          <div class="p-6 border-t border-slate-200 bg-white flex items-center justify-between">
            ${activeStep > 1 ? `
              <button 
                id="btn-prev-step" 
                type="button" 
                class="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Previous Step
              </button>
            ` : `<div></div>`}

            ${activeStep < 5 ? `
              <button 
                id="btn-bottom-next-step" 
                type="button" 
                class="px-5 py-2 bg-[#008384] hover:bg-[#006e6f] text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5"
              >
                <span>Next: ${steps[activeStep].label}</span>
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            ` : `
              <button 
                id="btn-bottom-activate" 
                type="button" 
                class="px-6 py-2 bg-[#008384] hover:bg-[#006e6f] text-white text-xs font-bold rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-sm">rocket_launch</span>
                <span>Activate Now</span>
              </button>
            `}
          </div>

        </aside>

      </main>

    </div>
  `;
}

export function attachConfiguratorListeners() {
  document.querySelectorAll('.config-step-btn').forEach(btn => {
    btn.onclick = () => {
      const step = parseInt(btn.getAttribute('data-config-step'), 10);
      store.setUIState({ configuratorStep: step });
    };
  });

  const nextStepBtn = document.getElementById('btn-next-step');
  const bottomNextStepBtn = document.getElementById('btn-bottom-next-step');
  const advance = () => {
    const cur = store.getUIState().configuratorStep;
    if (cur < 5) store.setUIState({ configuratorStep: cur + 1 });
  };
  if (nextStepBtn) nextStepBtn.onclick = advance;
  if (bottomNextStepBtn) bottomNextStepBtn.onclick = advance;

  const prevStepBtn = document.getElementById('btn-prev-step');
  if (prevStepBtn) {
    prevStepBtn.onclick = () => {
      const cur = store.getUIState().configuratorStep;
      if (cur > 1) store.setUIState({ configuratorStep: cur - 1 });
    };
  }

  const saveDraftBtn = document.getElementById('btn-save-draft');
  if (saveDraftBtn) {
    saveDraftBtn.onclick = () => {
      store.saveState();
      showToast('Loyalty program draft configuration saved.');
    };
  }

  const triggerActivation = () => {
    store.setState(s => ({
      ...s,
      loyaltyProgram: {
        ...s.loyaltyProgram,
        isActive: true,
        activationDate: new Date().toISOString().slice(0, 10)
      }
    }));
    store.setUIState({ activeModal: 'activationSuccess' });
  };

  const topActivate = document.getElementById('btn-activate-program');
  const panelActivate = document.getElementById('btn-activate-program-panel');
  const bottomActivate = document.getElementById('btn-bottom-activate');
  if (topActivate) topActivate.onclick = triggerActivation;
  if (panelActivate) panelActivate.onclick = triggerActivation;
  if (bottomActivate) bottomActivate.onclick = triggerActivation;

  // Live input synchronization with preview
  const inputName = document.getElementById('input-program-name');
  if (inputName) {
    inputName.oninput = (e) => {
      const val = e.target.value;
      store.setState(s => ({ ...s, loyaltyProgram: { ...s.loyaltyProgram, name: val } }), { silent: true });
      const logoText = document.getElementById('preview-logo-text');
      if (logoText) logoText.innerText = val.slice(0, 6) || 'LOYAL';
    };
  }

  const inputTitle = document.getElementById('input-program-title');
  if (inputTitle) {
    inputTitle.oninput = (e) => {
      const val = e.target.value;
      store.setState(s => ({ ...s, loyaltyProgram: { ...s.loyaltyProgram, title: val } }), { silent: true });
      const cardTitle = document.getElementById('preview-program-title');
      if (cardTitle) cardTitle.innerText = val;
    };
  }

  const inputSubtitle = document.getElementById('input-program-subtitle');
  if (inputSubtitle) {
    inputSubtitle.oninput = (e) => {
      const val = e.target.value;
      store.setState(s => ({ ...s, loyaltyProgram: { ...s.loyaltyProgram, subtitle: val } }), { silent: true });
      const cardSub = document.getElementById('preview-program-subtitle');
      if (cardSub) cardSub.innerText = val;
    };
  }

  const inputSpendRate = document.getElementById('input-spend-rate');
  const inputPointsRate = document.getElementById('input-points-rate');
  if (inputSpendRate) {
    inputSpendRate.oninput = (e) => {
      const val = parseInt(e.target.value, 10) || 100;
      store.setState(s => ({ ...s, loyaltyProgram: { ...s.loyaltyProgram, spendRate: val } }), { silent: true });
      const prevSpend = document.getElementById('preview-spend-rate');
      if (prevSpend) prevSpend.innerText = val;
    };
  }
  if (inputPointsRate) {
    inputPointsRate.oninput = (e) => {
      const val = parseInt(e.target.value, 10) || 10;
      store.setState(s => ({ ...s, loyaltyProgram: { ...s.loyaltyProgram, pointsRate: val } }), { silent: true });
      const prevPts = document.getElementById('preview-points-rate');
      if (prevPts) prevPts.innerText = val;
    };
  }

  // Color picker
  document.querySelectorAll('.theme-color-btn').forEach(btn => {
    btn.onclick = () => {
      const color = btn.getAttribute('data-theme-color');
      if (color) {
        store.setState(s => ({ ...s, loyaltyProgram: { ...s.loyaltyProgram, themeColor: color } }));
      }
    };
  });

  // Reward Tiers Add / Remove / Edit
  const addTierBtn = document.getElementById('btn-add-reward-tier');
  if (addTierBtn) {
    addTierBtn.onclick = () => {
      const newTier = {
        id: `tier-${Date.now()}`,
        points: 2000,
        title: 'Chef Special Tasting Flight (Complimentary)',
        condition: '*Reservation required 24 hours in advance.',
        rewardType: 'item'
      };
      store.setState(s => ({
        ...s,
        loyaltyProgram: {
          ...s.loyaltyProgram,
          rewardTiers: [...s.loyaltyProgram.rewardTiers, newTier]
        }
      }));
      showToast('Added new reward tier!');
    };
  }

  document.querySelectorAll('[data-delete-tier]').forEach(btn => {
    btn.onclick = () => {
      const tierId = btn.getAttribute('data-delete-tier');
      store.setState(s => ({
        ...s,
        loyaltyProgram: {
          ...s.loyaltyProgram,
          rewardTiers: s.loyaltyProgram.rewardTiers.filter(t => t.id !== tierId)
        }
      }));
    };
  });

  document.querySelectorAll('.tier-input').forEach(input => {
    input.oninput = (e) => {
      const tierId = input.getAttribute('data-tier-id');
      const field = input.getAttribute('data-tier-field');
      const tiers = [...store.getState().loyaltyProgram.rewardTiers];
      const tier = tiers.find(t => t.id === tierId);
      if (tier && field) {
        tier[field] = field === 'points' ? (parseInt(e.target.value, 10) || 0) : e.target.value;
        store.setState(s => ({
          ...s,
          loyaltyProgram: { ...s.loyaltyProgram, rewardTiers: tiers }
        }), { silent: true });
      }
    };
  });

  // Step 3: Reminders & Expiry Toggles
  const toggleInactivity = document.getElementById('toggle-inactivity');
  if (toggleInactivity) {
    toggleInactivity.onchange = () => {
      store.setState(s => ({
        ...s,
        loyaltyProgram: {
          ...s.loyaltyProgram,
          reminders: { ...s.loyaltyProgram.reminders, inactivityReminderEnabled: toggleInactivity.checked }
        }
      }));
      showToast(toggleInactivity.checked ? '30-day win-back reminder enabled' : '30-day win-back reminder disabled');
    };
  }

  const toggleExpiryAlert = document.getElementById('toggle-expiry-alert');
  if (toggleExpiryAlert) {
    toggleExpiryAlert.onchange = () => {
      store.setState(s => ({
        ...s,
        loyaltyProgram: {
          ...s.loyaltyProgram,
          reminders: { ...s.loyaltyProgram.reminders, expiryAlertEnabled: toggleExpiryAlert.checked }
        }
      }));
      showToast(toggleExpiryAlert.checked ? 'Expiry warning alert enabled' : 'Expiry warning alert disabled');
    };
  }

  const textInactivity = document.getElementById('text-inactivity-message');
  if (textInactivity) {
    textInactivity.onblur = () => {
      store.setState(s => ({
        ...s,
        loyaltyProgram: {
          ...s.loyaltyProgram,
          reminders: { ...s.loyaltyProgram.reminders, inactivityMessage: textInactivity.value }
        }
      }));
    };
  }

  const textExpiry = document.getElementById('text-expiry-message');
  if (textExpiry) {
    textExpiry.onblur = () => {
      store.setState(s => ({
        ...s,
        loyaltyProgram: {
          ...s.loyaltyProgram,
          reminders: { ...s.loyaltyProgram.reminders, expiryAlertMessage: textExpiry.value }
        }
      }));
    };
  }

  // Step 4: Channel Toggles
  const channelToggleMap = [
    { id: 'toggle-channel-whatsapp', path: 'whatsappUtility' },
    { id: 'toggle-channel-sms', path: 'sms' },
    { id: 'toggle-channel-wa-marketing', path: 'whatsappMarketing' },
    { id: 'toggle-channel-email', path: 'email' }
  ];

  channelToggleMap.forEach(({ id, path }) => {
    const toggle = document.getElementById(id);
    if (toggle) {
      toggle.onchange = () => {
        store.setState(s => ({
          ...s,
          loyaltyProgram: {
            ...s.loyaltyProgram,
            channels: {
              ...s.loyaltyProgram.channels,
              [path]: { ...s.loyaltyProgram.channels[path], enabled: toggle.checked }
            }
          }
        }));
        const label = path.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
        showToast(`${label} channel ${toggle.checked ? 'enabled' : 'disabled'}`);
      };
    }
  });
}

