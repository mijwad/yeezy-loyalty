// Loyalty Program Multi-Step Template Builder & Customer Pass Module
// Matches the exact digital loyalty card and WhatsApp purchase notification reference images.

import { store } from '../../state/store.js';

// Curated high-res food presets for loyalty card banner
export const LOYALTY_BANNER_PRESETS = [
  {
    id: 'pasta-dish',
    name: 'Creamy Fettuccine with Fork & Lemon',
    url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=800&q=80',
    tag: 'Pasta Special (Reference)'
  },
  {
    id: 'fine-dining',
    name: 'Fine Dining & Wine Glasses',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80',
    tag: 'Fine Dining'
  },
  {
    id: 'chef-tasting',
    name: 'Gourmet Chef Plating',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    tag: 'Gourmet'
  },
  {
    id: 'pizza-oven',
    name: 'Artisanal Woodfired Pizza',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    tag: 'Italian'
  },
  {
    id: 'burger-fries',
    name: 'Craft Burger & Golden Fries',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    tag: 'Bistro'
  },
  {
    id: 'cocktails-bar',
    name: 'Handcrafted Cocktails',
    url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80',
    tag: 'Cocktails'
  }
];

export const LOYALTY_THEME_COLORS = [
  { name: 'Espresso Slate', hex: '#261d1a' },
  { name: 'Dark Charcoal', hex: '#1a1a1a' },
  { name: 'Midnight Slate', hex: '#1e293b' },
  { name: 'Petpooja Teal', hex: '#164e63' },
  { name: 'Rich Burgundy', hex: '#3b111e' },
  { name: 'Deep Forest', hex: '#064e3b' }
];

export function renderLoyaltyView(state) {
  const uiState = store.getUIState();
  const isWizardOpen = Boolean(uiState.loyaltyWizardOpen);

  if (isWizardOpen) {
    return renderLoyaltyWizard(state, uiState);
  }

  return renderLoyaltyDashboard(state, uiState);
}

// Alias for backwards compatibility
export function renderActivateLoyalty(state) {
  return renderLoyaltyView(state);
}

// ============================================================================
// 1. LOYALTY DASHBOARD (Overview, KPIs, Card Display & WhatsApp Link)
// ============================================================================

function renderLoyaltyDashboard(state, uiState) {
  const p = state.loyaltyProgram || {};
  const activeMembers = state.todayStats?.activeMembers || 1280;
  const pointsIssued = state.todayStats?.pointsIssued || 24500;
  const rewardsRedeemed = state.todayStats?.rewardsRedeemed || 342;
  const repeatRate = state.todayStats?.repeatVisitRate || '34%';

  return `
    <div class="px-4 md:px-8 py-6 max-w-7xl mx-auto flex flex-col gap-6 animate-fade-in pb-20">
      <!-- Top Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-gray-200/80 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#e8f4f3] text-[#2a7e72]">
              <span class="material-symbols-outlined text-lg">loyalty</span>
            </span>
            <span class="text-xs font-bold uppercase tracking-wider text-[#2a7e72]">Diner Rewards Engine</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              ● Active Program
            </span>
          </div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
            ${p.name || 'durbar'} Loyalty Program & Digital Pass
          </h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 max-w-2xl font-medium">
            Customize your customer's digital loyalty card and automated purchase WhatsApp messages with digital pass link.
          </p>
        </div>

        <div class="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <a 
            href="#meta-review" 
            class="px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs rounded-2xl transition flex items-center gap-1.5 shadow-2xs"
            title="Open Meta App Review & Video Recording Console"
          >
            <span class="material-symbols-outlined text-base">videocam</span>
            <span>Meta Review Studio</span>
          </a>
          <button 
            id="btn-open-loyalty-wizard" 
            type="button" 
            class="px-6 py-3 bg-[#2a7e72] hover:bg-[#23685e] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
          >
            <span class="material-symbols-outlined text-xl">tune</span>
            Customize Loyalty Template
          </button>
        </div>
      </div>

      <!-- KPI Metrics Strip -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Active Members</span>
            <span class="w-8 h-8 rounded-xl bg-teal-50 text-[#2a7e72] flex items-center justify-center">
              <span class="material-symbols-outlined text-base">person</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-gray-900">${activeMembers.toLocaleString()}</div>
            <div class="text-[11px] text-emerald-600 font-semibold mt-0.5">+18% growth this month</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Points Issued</span>
            <span class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-base">stars</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-gray-900">${pointsIssued.toLocaleString()} PTS</div>
            <div class="text-[11px] text-gray-400 mt-0.5">₹${p.spendRate || 100} Spent = ${p.pointsRate || 10} Points</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Rewards Claimed</span>
            <span class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-base">redeem</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-gray-900">${rewardsRedeemed.toLocaleString()}</div>
            <div class="text-[11px] text-purple-700 font-semibold mt-0.5">Across ${p.rewardTiers?.length || 5} reward tiers</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Repeat Visit Lift</span>
            <span class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-base">trending_up</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-emerald-700">${repeatRate}</div>
            <div class="text-[11px] text-emerald-600 font-semibold mt-0.5">Measured vs non-members</div>
          </div>
        </div>
      </div>

      <!-- Main Overview: Side-by-Side Digital Card Preview & Automated Purchase Setup -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        <!-- Left: Live Digital Card Display (Exact Image 1) -->
        <div class="lg:col-span-5 flex flex-col items-center">
          <div class="w-full flex items-center justify-between mb-3 px-1">
            <div class="flex items-center gap-2">
              <h2 class="text-base font-extrabold text-gray-900">Digital Loyalty Pass</h2>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#2a7e72]">Live Preview</span>
            </div>
            <button 
              id="btn-edit-card-quick" 
              type="button" 
              class="text-xs font-bold text-[#2a7e72] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm">edit</span> Edit Design
            </button>
          </div>

          <div class="w-full flex justify-center">
            ${renderLoyaltyCardPreview(p)}
          </div>
        </div>

        <!-- Right: Purchase Notification & Sharing Setup (Exact Image 2) -->
        <div class="lg:col-span-7 flex flex-col gap-6">
          
          <!-- Automated WhatsApp Notification Card (Reference Image 2) -->
          <div class="bg-white rounded-3xl p-6 md:p-7 border border-gray-200/80 shadow-xs flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span class="material-symbols-outlined text-xl">chat</span>
                </div>
                <div>
                  <h3 class="text-base font-extrabold text-gray-900">Automated Purchase WhatsApp Notification</h3>
                  <p class="text-xs text-gray-500 font-medium">Sent automatically when cashier settles bill in POS</p>
                </div>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                ACTIVE
              </span>
            </div>

            <!-- Sample WhatsApp Message Box (Styled like WhatsApp Dark Bubble) -->
            <div class="p-4 bg-[#111b21] rounded-2xl text-white text-xs leading-relaxed border border-[#202c33] shadow-inner font-sans whitespace-pre-line relative">
              <div class="text-[11px] text-emerald-400 font-bold mb-2 flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>WhatsApp Message Template</span>
              </div>
              ${escapeHtml(p.whatsappPurchaseNotification?.template || getDefaultWhatsAppTemplate(p.name))}
              <div class="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between">
                <span class="px-3 py-1 rounded-xl bg-[#202c33] text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">open_in_new</span>
                  <span>Share Feedback & View Digital Pass</span>
                </span>
                <span class="text-[10px] text-gray-400">7:41 PM • ✓✓</span>
              </div>
            </div>

            <!-- Test Send Action Bar -->
            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="flex-1">
                <span class="text-xs font-bold text-gray-800 block">Test on Your Mobile</span>
                <span class="text-[11px] text-gray-500 block">Send a sample purchase notification to your WhatsApp</span>
              </div>
              <div class="flex items-center gap-2">
                <input 
                  id="dash-test-phone" 
                  type="tel" 
                  value="9745630606" 
                  placeholder="Mobile number" 
                  class="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold w-36"
                />
                <button 
                  id="btn-dash-send-test" 
                  type="button" 
                  class="px-4 py-1.5 bg-[#2a7e72] hover:bg-[#23685e] text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Send Test
                </button>
              </div>
            </div>
          </div>

          <!-- Digital Pass Link & QR Code Card -->
          <div class="bg-white rounded-3xl p-6 md:p-7 border border-gray-200/80 shadow-xs flex flex-col gap-4">
            <h3 class="text-base font-extrabold text-gray-900">Customer Digital Pass Access</h3>
            <p class="text-xs text-gray-500 font-medium -mt-2">
              Attach this link in SMS, WhatsApp, or table QR codes. Diners can check their balance anytime.
            </p>

            <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 text-xs font-mono font-bold text-[#2a7e72] truncate">
                <span class="material-symbols-outlined text-base">link</span>
                <span id="loyalty-pass-public-url">${p.whatsappPurchaseNotification?.passShortLink || 'https://beebill.online/#my-rewards'}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <button 
                  id="btn-copy-pass-link" 
                  type="button" 
                  class="px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition flex items-center gap-1 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-sm">content_copy</span>
                  <span>Copy</span>
                </button>
                <a 
                  href="#my-rewards" 
                  target="_blank"
                  class="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-xs font-bold text-[#2a7e72] hover:bg-teal-100 transition flex items-center gap-1"
                >
                  <span class="material-symbols-outlined text-sm">visibility</span>
                  <span>Open Pass</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. DIGITAL LOYALTY CARD PREVIEW (Exact Image 1 Reference)
// ============================================================================

export function renderLoyaltyCardPreview(prog) {
  const p = prog || {};
  const cardBg = p.cardBg || '#261d1a';
  const logoText = p.logoText || 'DURBAR';
  const logoUrl = p.logoUrl || '';
  const bannerUrl = p.bannerUrl || LOYALTY_BANNER_PRESETS[0].url;
  const title = p.title || 'durbar';
  const subtitle = p.subtitle || 'Get rewarded on every purchase';
  const spendRate = p.spendRate || 100;
  const pointsRate = p.pointsRate || 10;
  const topUnlock = p.topUnlockBanner || 'Spend ₹10000 to unlock the next reward';
  const tiers = p.rewardTiers || getDefaultRewardTiers();
  const terms = p.termsAndConditions || 'Terms & Conditions\n*Minimum purchase required.\n*2 offers cannot be clubbed.';

  return `
    <div class="w-full max-w-[360px] flex flex-col items-center select-none animate-fade-in">
      
      <!-- Top Notification Banner: "⚡ Spend ₹10000 to unlock the next reward" -->
      <div 
        id="card-preview-unlock-banner" 
        class="w-full bg-[#f3e8ff] text-[#7e22ce] text-xs font-extrabold py-2 px-4 rounded-2xl flex items-center justify-center gap-1.5 shadow-2xs mb-3 border border-[#e9d5ff] transition-all"
      >
        <span class="material-symbols-outlined text-sm text-[#9333ea]">bolt</span>
        <span id="preview-unlock-text">${escapeHtml(topUnlock)}</span>
      </div>

      <!-- Main Card Chassis (Deep Espresso Slate Background from Screenshot 1) -->
      <div 
        id="live-loyalty-pass-card"
        class="w-full rounded-[34px] overflow-hidden shadow-2xl transition-all duration-300 relative border-4 border-black/20"
        style="background-color: ${cardBg}; box-shadow: 0 20px 45px -12px rgba(0, 0, 0, 0.4);"
      >
        <!-- Curved Food Header Banner with Pasta Photo -->
        <div class="relative h-48 w-full overflow-hidden bg-stone-900">
          <img 
            id="loyalty-preview-banner" 
            src="${bannerUrl}" 
            alt="Loyalty Header" 
            class="w-full h-full object-cover" 
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20"></div>

          <!-- Bottom Wave Cutout matching screenshot -->
          <div class="w-full absolute -bottom-1 left-0" style="line-height: 0;">
            <svg viewBox="0 0 500 80" preserveAspectRatio="none" class="w-full h-8 block" style="fill: ${cardBg};">
              <path d="M0,0 C150,70 350,-20 500,40 L500,80 L0,80 Z"></path>
            </svg>
          </div>

          <!-- Circular Logo Badge Overlapping (Exact "DURBAR" Badge) -->
          <div class="absolute -bottom-3 left-6 z-10 w-22 h-22 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-white overflow-hidden p-1">
            ${logoUrl ? `
              <img src="${logoUrl}" alt="Logo" class="w-full h-full object-contain rounded-full" />
            ` : `
              <div class="w-full h-full rounded-full bg-white flex items-center justify-center text-center p-1">
                <span id="loyalty-preview-logo-text" class="text-xs font-black tracking-widest text-black uppercase leading-none">
                  ${escapeHtml(logoText)}
                </span>
              </div>
            `}
          </div>
        </div>

        <!-- Card Body Content -->
        <div class="px-6 pt-5 pb-7 flex flex-col gap-4 text-white">
          
          <!-- Program Title & Subtitle -->
          <div class="pt-1">
            <h2 id="loyalty-preview-title" class="text-2xl font-black text-white tracking-tight leading-none lowercase">
              ${escapeHtml(title)}
            </h2>
            <p id="loyalty-preview-subtitle" class="text-xs text-stone-300 mt-1 font-normal leading-relaxed">
              ${escapeHtml(subtitle)}
            </p>
            <div id="loyalty-preview-rate" class="text-xs font-extrabold text-white mt-1.5 tracking-wide">
              ₹${spendRate} Spent = ${pointsRate} Points
            </div>
          </div>

          <!-- Progressive Milestone Tiers Ladder (Exact 500, 1000, 2000, 3000, 5000 PTS) -->
          <div id="loyalty-preview-tiers" class="flex flex-col">
            ${tiers.map((tier, idx) => `
              <div class="flex items-start justify-between py-2.5 border-b border-dashed border-stone-700/60 text-xs">
                <div class="w-22 shrink-0 font-black text-sm text-white flex items-baseline gap-1">
                  <span>${tier.points}</span>
                  <span class="text-[10px] font-bold text-stone-400">PTS</span>
                </div>
                <div class="flex-1 pr-2">
                  <div class="font-extrabold text-white text-xs">${escapeHtml(tier.title)}</div>
                  ${tier.condition ? `<div class="text-[10px] text-stone-400 mt-0.5 leading-snug">${escapeHtml(tier.condition)}</div>` : ''}
                </div>
                <div class="text-stone-400 shrink-0 pt-0.5">
                  <span class="material-symbols-outlined text-sm">
                    ${idx === 0 ? 'lock_open' : 'lock'}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Terms & Conditions Box (Exact Screenshot 1) -->
          <div class="rounded-2xl border border-dashed border-stone-700/80 p-3.5 bg-black/20 text-[11px] text-stone-300 leading-relaxed whitespace-pre-line mt-1">
            <div id="loyalty-preview-terms">
              ${escapeHtml(terms)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 3. WHATSAPP PURCHASE NOTIFICATION MOCKUP (Exact Image 2 Reference)
// ============================================================================

export function renderLoyaltyWhatsAppMockup(prog) {
  const p = prog || {};
  const restaurantName = p.name || 'durbar';
  const template = p.whatsappPurchaseNotification?.template || getDefaultWhatsAppTemplate(restaurantName);
  const formattedText = template
    .replace('{restaurant_name}', restaurantName)
    .replace('{points}', '1000')
    .replace('{balance}', '1450');

  return `
    <div class="w-full max-w-[340px] bg-[#111b21] rounded-[44px] p-3 shadow-2xl border-4 border-[#202c33] relative select-none text-white">
      <!-- Phone Top Speaker & Camera -->
      <div class="w-full flex items-center justify-center pt-2 pb-3">
        <div class="w-16 h-1.5 bg-[#2a3942] rounded-full"></div>
        <div class="w-2.5 h-2.5 bg-[#000] rounded-full ml-3 border border-[#2a3942]"></div>
      </div>

      <!-- WhatsApp Chat Canvas -->
      <div class="w-full bg-[#0b141a] rounded-[36px] overflow-hidden min-h-[520px] flex flex-col justify-between p-4 relative">
        <!-- WhatsApp Top Bar -->
        <div class="flex items-center justify-between border-b border-[#202c33] pb-3 pt-1">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-full bg-[#00a884] flex items-center justify-center text-white font-black text-sm shadow-md">
              R
            </div>
            <div>
              <div class="flex items-center gap-1">
                <span class="text-xs font-bold text-gray-100">Reelo</span>
                <span class="material-symbols-outlined text-[13px] text-[#53bdeb]">verified</span>
              </div>
              <span class="text-[10px] text-gray-400">Business account</span>
            </div>
          </div>
          <span class="material-symbols-outlined text-gray-400 text-lg">more_vert</span>
        </div>

        <!-- Chat Bubble Area (Exact Text & Layout from Screenshot 2) -->
        <div class="flex-1 py-4 flex flex-col justify-start">
          <div class="bg-[#202c33] rounded-2xl p-4 text-xs text-gray-100 leading-relaxed shadow-md border border-white/5 max-w-[94%] whitespace-pre-line relative">
            <div id="phone-whatsapp-bubble-text">
              ${escapeHtml(formattedText)}
            </div>
            <div class="mt-3 text-[10px] text-gray-400 text-right">
              7:41 PM • ✓✓
            </div>
          </div>

          <!-- WhatsApp Action Button Below Bubble -->
          <div class="mt-2 max-w-[94%]">
            <div class="bg-[#202c33] hover:bg-[#2a3942] rounded-xl py-2.5 px-4 text-xs font-bold text-[#00a884] flex items-center justify-center gap-1.5 border border-white/5 shadow-xs cursor-pointer">
              <span class="material-symbols-outlined text-sm">open_in_new</span>
              <span>Share Feedback & View Pass</span>
            </div>
          </div>
        </div>

        <!-- Fake Message Typing Bar -->
        <div class="bg-[#202c33] rounded-full px-4 py-2.5 flex items-center justify-between text-xs text-gray-400 border border-white/5">
          <span>Reply or share feedback...</span>
          <span class="material-symbols-outlined text-sm text-[#00a884]">send</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 4. MULTI-STEP LOYALTY BUILDER WIZARD
// ============================================================================

function renderLoyaltyWizard(state, uiState) {
  const step = Number(uiState.loyaltyStep) || 1;
  const p = state.loyaltyProgram || {};

  const stepTitles = {
    1: 'What are the Earning Rules?',
    2: 'Configure Reward Milestones',
    3: 'Customize Card Appearance',
    4: 'Automated Purchase Notification',
    5: 'Review & Activate'
  };

  return `
    <div class="min-h-screen bg-[#f8fafb] flex flex-col pb-16">
      <!-- Top Sticky Navigation Bar -->
      <header class="h-16 px-4 md:px-8 bg-white border-b border-gray-200 flex items-center justify-between sticky top-16 z-30 shadow-2xs">
        <div class="flex items-center gap-3">
          <button 
            id="loyalty-wizard-menu-btn" 
            type="button" 
            class="p-2 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition cursor-pointer"
            title="Step navigation"
          >
            <span class="material-symbols-outlined text-xl">menu</span>
          </button>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-gray-500">Step ${step} / 5</span>
            <span class="text-gray-300">•</span>
            <span class="text-sm font-extrabold text-gray-900 hidden sm:inline">${stepTitles[step]}</span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          ${step > 1 ? `
            <button 
              id="loyalty-wizard-back-btn" 
              type="button" 
              class="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition cursor-pointer flex items-center gap-1"
            >
              Back
            </button>
          ` : ''}

          <button 
            id="loyalty-wizard-save-exit-btn" 
            type="button" 
            class="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
          >
            Save and exit
          </button>

          ${step < 5 ? `
            <button 
              id="loyalty-wizard-next-btn" 
              type="button" 
              class="px-5 py-2 bg-[#2a7e72] hover:bg-[#23685e] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer hover:shadow-md"
            >
              <span>Next</span>
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          ` : `
            <button 
              id="loyalty-wizard-submit-btn" 
              type="button" 
              class="px-5 py-2 bg-[#2a7e72] hover:bg-[#23685e] text-white text-xs font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer hover:scale-[1.01]"
            >
              <span>🚀 Save & Activate Program</span>
            </button>
          `}
        </div>
      </header>

      <!-- Main Two-Column Layout -->
      <div class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col lg:flex-row items-start gap-8">
        
        <!-- LEFT COLUMN: Live Preview (Card or WhatsApp based on step) -->
        <div class="w-full lg:w-[440px] flex-shrink-0 flex flex-col items-center">
          <div class="w-full flex items-center justify-between mb-3 px-1">
            <h2 class="text-base font-extrabold text-gray-900">
              ${step === 4 ? 'WhatsApp Customer View' : 'Live Digital Pass'}
            </h2>
            <span class="text-[11px] text-gray-400 font-semibold">Updates live as you type</span>
          </div>

          <div class="w-full flex justify-center sticky top-36">
            ${step === 4 ? renderLoyaltyWhatsAppMockup(p) : renderLoyaltyCardPreview(p)}
          </div>
        </div>

        <!-- RIGHT COLUMN: Step Forms & Controls -->
        <div class="flex-1 w-full flex flex-col gap-5">
          ${renderLoyaltyStepContent(step, p)}
        </div>
      </div>
    </div>
  `;
}

function renderLoyaltyStepContent(step, p) {
  switch (step) {
    case 1:
      return renderLoyaltyStep1(p);
    case 2:
      return renderLoyaltyStep2(p);
    case 3:
      return renderLoyaltyStep3(p);
    case 4:
      return renderLoyaltyStep4(p);
    case 5:
      return renderLoyaltyStep5(p);
    default:
      return renderLoyaltyStep1(p);
  }
}

// ----------------------------------------------------------------------------
// STEP 1: Program Rules & Earnings
// ----------------------------------------------------------------------------
function renderLoyaltyStep1(p) {
  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <!-- Basic Branding Card -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Program Titles & Identity</h3>

        <div>
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Restaurant Program Name</label>
          <input 
            id="input-loyalty-name" 
            type="text" 
            value="${escapeHtml(p.name || 'durbar')}" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72]"
            placeholder="durbar"
          />
        </div>

        <div>
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Card Title Headline</label>
          <input 
            id="input-loyalty-title" 
            type="text" 
            value="${escapeHtml(p.title || 'durbar')}" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72]"
            placeholder="durbar"
          />
        </div>

        <div>
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Subtitle</label>
          <input 
            id="input-loyalty-subtitle" 
            type="text" 
            value="${escapeHtml(p.subtitle || 'Get rewarded on every purchase')}" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72]"
            placeholder="Get rewarded on every purchase"
          />
        </div>
      </div>

      <!-- Spend & Points Earning Conversion Card -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Points Earning Formula</h3>
        <p class="text-xs text-gray-500 font-medium">Define how many loyalty points diners earn per rupee spent at your restaurant.</p>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-bold text-gray-800 mb-1 block">For Every Bill Amount (₹)</label>
            <input 
              id="input-spend-rate" 
              type="number" 
              value="${p.spendRate || 100}" 
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:ring-2 focus:ring-[#2a7e72]/30"
            />
          </div>
          <div>
            <label class="text-xs font-bold text-gray-800 mb-1 block">Customer Earns (Points)</label>
            <input 
              id="input-points-rate" 
              type="number" 
              value="${p.pointsRate || 10}" 
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-[#2a7e72] focus:ring-2 focus:ring-[#2a7e72]/30"
            />
          </div>
        </div>

        <!-- Top Unlock Banner Text Input -->
        <div class="mt-2 pt-3 border-t border-gray-100">
          <label class="text-xs font-bold text-gray-800 mb-1 block">Top Unlock Alert Message</label>
          <input 
            id="input-top-unlock" 
            type="text" 
            value="${escapeHtml(p.topUnlockBanner || 'Spend ₹10000 to unlock the next reward')}" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 font-semibold"
            placeholder="Spend ₹10000 to unlock the next reward"
          />
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 2: Reward Tiers Ladder
// ----------------------------------------------------------------------------
function renderLoyaltyStep2(p) {
  const tiers = p.rewardTiers || getDefaultRewardTiers();

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Milestone Rewards Ladder</h3>
            <p class="text-xs text-gray-500 font-medium">Edit point thresholds and reward vouchers matching the reference pass.</p>
          </div>
          <button 
            id="btn-add-loyalty-tier" 
            type="button" 
            class="px-3.5 py-1.5 rounded-xl bg-[#e8f4f3] text-[#2a7e72] font-bold text-xs hover:bg-[#d8ece9] transition flex items-center gap-1 cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">add</span>
            <span>Add Tier</span>
          </button>
        </div>

        <!-- Tiers List -->
        <div class="flex flex-col gap-3" id="loyalty-tiers-editor-container">
          ${tiers.map((tier, idx) => `
            <div class="p-4 rounded-2xl border border-gray-200 bg-gray-50/70 flex flex-col gap-3 relative group" data-tier-index="${idx}">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <span class="w-6 h-6 rounded-full bg-[#2a7e72] text-white text-xs font-black flex items-center justify-center">
                    ${idx + 1}
                  </span>
                  <span class="text-xs font-black text-gray-900">Tier ${idx + 1}</span>
                </div>
                ${tiers.length > 2 ? `
                  <button 
                    type="button" 
                    class="btn-delete-tier text-gray-400 hover:text-red-600 transition p-1 cursor-pointer"
                    data-tier-index="${idx}"
                    title="Delete tier"
                  >
                    <span class="material-symbols-outlined text-base">delete</span>
                  </button>
                ` : ''}
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="text-[11px] font-bold text-gray-600 block mb-1">Required Points</label>
                  <input 
                    type="number" 
                    class="input-tier-points w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900"
                    data-tier-index="${idx}"
                    value="${tier.points}"
                  />
                </div>
                <div class="sm:col-span-2">
                  <label class="text-[11px] font-bold text-gray-600 block mb-1">Reward Title</label>
                  <input 
                    type="text" 
                    class="input-tier-title w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900"
                    data-tier-index="${idx}"
                    value="${escapeHtml(tier.title)}"
                  />
                </div>
              </div>

              <div>
                <label class="text-[11px] font-bold text-gray-600 block mb-1">Condition & Terms</label>
                <input 
                  type="text" 
                  class="input-tier-condition w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-700"
                  data-tier-index="${idx}"
                  value="${escapeHtml(tier.condition || '')}"
                  placeholder="e.g. *Minimum purchase of ₹250 required"
                />
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 3: Creative & Branding
// ----------------------------------------------------------------------------
function renderLoyaltyStep3(p) {
  const cardBg = p.cardBg || '#261d1a';
  const logoText = p.logoText || 'DURBAR';
  const bannerUrl = p.bannerUrl || LOYALTY_BANNER_PRESETS[0].url;
  const terms = p.termsAndConditions || 'Terms & Conditions\n*Minimum purchase required.\n*2 offers cannot be clubbed.';

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <!-- Logo Customization -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-3">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Logo Badge</h3>

        <div class="flex items-center gap-3">
          <label class="flex-1 py-3 px-4 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#2a7e72] hover:bg-[#f0f9f8] transition flex items-center justify-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
            <span class="material-symbols-outlined text-lg text-[#2a7e72]">upload</span>
            <span>Upload custom brand logo</span>
            <input id="input-loyalty-logo-file" type="file" accept="image/*" class="hidden" />
          </label>
        </div>

        <div class="mt-2">
          <label class="text-xs font-bold text-gray-800 mb-1 block">Brand Display Text (Overlapping Circle)</label>
          <input 
            id="input-loyalty-logo-text" 
            type="text" 
            value="${escapeHtml(logoText)}" 
            class="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs font-black text-gray-900 uppercase tracking-widest"
            placeholder="DURBAR"
          />
        </div>
      </div>

      <!-- Card Background Color -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Card Background Color</h3>
          <div class="w-6 h-6 rounded-full border border-gray-200 shadow-2xs" style="background-color: ${cardBg};"></div>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          ${LOYALTY_THEME_COLORS.map(c => `
            <button 
              type="button" 
              class="btn-loyalty-color-chip w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${cardBg === c.hex ? 'border-gray-900 scale-110 shadow-xs ring-2 ring-[#2a7e72]/40' : 'border-white'}" 
              style="background-color: ${c.hex};" 
              data-hex="${c.hex}" 
              title="${c.name}"
            ></button>
          `).join('')}
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
          <span class="text-xs font-mono text-gray-500 font-bold">Custom Hex:</span>
          <input 
            id="input-loyalty-bg-hex" 
            type="text" 
            value="${cardBg}" 
            class="w-28 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-mono font-bold"
          />
          <input id="input-loyalty-bg-native" type="color" value="${cardBg}" class="w-8 h-8 rounded cursor-pointer border-0" />
        </div>
      </div>

      <!-- Banner Header Photo -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Header Food Photography</h3>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          ${LOYALTY_BANNER_PRESETS.map(p => {
            const isSelected = bannerUrl === p.url;
            return `
              <button 
                type="button" 
                class="btn-loyalty-banner-preset relative h-24 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group text-left ${isSelected ? 'border-[#2a7e72] ring-2 ring-[#2a7e72]/30 shadow-md scale-[1.02]' : 'border-transparent hover:border-gray-300'}"
                data-url="${p.url}"
              >
                <img src="${p.url}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <span class="absolute bottom-1.5 left-2 text-[10px] font-bold text-white line-clamp-1">${p.tag}</span>
                ${isSelected ? `
                  <div class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#2a7e72] text-white flex items-center justify-center shadow-xs">
                    <span class="material-symbols-outlined text-xs">check</span>
                  </div>
                ` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Terms & Conditions Text -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-3">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Terms & Conditions Box</h3>
        <textarea 
          id="input-loyalty-terms" 
          rows="4" 
          class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] resize-none leading-relaxed font-mono"
        >${escapeHtml(terms)}</textarea>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 4: Purchase WhatsApp Message & Digital Pass Link (Exact Image 2)
// ----------------------------------------------------------------------------
function renderLoyaltyStep4(p) {
  const template = p.whatsappPurchaseNotification?.template || getDefaultWhatsAppTemplate(p.name);
  const passUrl = p.whatsappPurchaseNotification?.passShortLink || 'https://beebill.online/#my-rewards';

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-600 text-xl">chat</span>
            <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Purchase WhatsApp Notification Copy</h3>
          </div>
          <p class="text-xs text-gray-500 font-medium mt-1">
            This message is triggered automatically upon each diner bill completion and links to their pass.
          </p>
        </div>

        <!-- Dynamic Variable Chips -->
        <div class="flex items-center gap-1.5 flex-wrap pt-1">
          <span class="text-[11px] text-gray-400 font-semibold mr-1">Insert tag:</span>
          ${[
            { tag: '{restaurant_name}', label: '+ Restaurant Name' },
            { tag: '{points}', label: '+ Points Earned' },
            { tag: '{balance}', label: '+ Total Balance' },
            { tag: '{customer_name}', label: '+ Customer Name' }
          ].map(v => `
            <button 
              type="button" 
              class="btn-loyalty-insert-tag px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-[#e8f4f3] hover:text-[#2a7e72] text-[11px] font-bold text-gray-700 transition cursor-pointer"
              data-tag="${v.tag}"
            >
              ${v.label}
            </button>
          `).join('')}
        </div>

        <div>
          <textarea 
            id="input-whatsapp-template" 
            rows="7" 
            class="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition resize-none leading-relaxed font-sans"
          >${escapeHtml(template)}</textarea>
        </div>

        <!-- WhatsApp Button Label -->
        <div>
          <label class="text-xs font-bold text-gray-800 mb-1 block">WhatsApp CTA Button Label</label>
          <input 
            id="input-whatsapp-btn-label" 
            type="text" 
            value="${escapeHtml(p.whatsappPurchaseNotification?.buttonLabel || 'Share Feedback & View Digital Pass')}" 
            class="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900"
          />
        </div>

        <!-- Digital Pass Link Destination -->
        <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#2a7e72] text-lg">link</span>
            <span class="text-xs font-mono font-bold text-[#2a7e72]">${passUrl}</span>
          </div>
          <button 
            id="btn-copy-link-step4" 
            type="button" 
            class="px-3 py-1 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
          >
            Copy Link
          </button>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 5: Review & Activate
// ----------------------------------------------------------------------------
function renderLoyaltyStep5(p) {
  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Ready to Activate</h3>
        <p class="text-xs text-gray-500 font-medium">Your customized digital pass and WhatsApp purchase message are configured and ready.</p>

        <div class="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/60 text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5">
          <span class="material-symbols-outlined text-emerald-600 text-lg shrink-0">check_circle</span>
          <div>
            <strong>POS Sync Active:</strong> Petpooja and Yeezy Cloud POS orders will automatically record diner points and dispatch the purchase notification with their digital pass attached.
          </div>
        </div>

        <!-- Test Send Action -->
        <div class="pt-2 flex flex-col gap-2">
          <label class="text-xs font-bold text-gray-800">Send Test WhatsApp Message to Mobile</label>
          <div class="flex items-center gap-3">
            <input 
              id="input-wizard-test-phone" 
              type="tel" 
              value="9745630606" 
              placeholder="e.g. 9745630606" 
              class="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold"
            />
            <button 
              id="btn-wizard-send-test" 
              type="button" 
              class="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Send Sample
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 5. EVENT LISTENERS & MUTATIONS
// ============================================================================

export function attachLoyaltyListeners() {
  const uiState = store.getUIState();

  // Dashboard buttons
  const btnOpenWizard = document.getElementById('btn-open-loyalty-wizard');
  if (btnOpenWizard) {
    btnOpenWizard.onclick = () => {
      store.setUIState({ loyaltyWizardOpen: true, loyaltyStep: 1 });
    };
  }

  const btnEditCardQuick = document.getElementById('btn-edit-card-quick');
  if (btnEditCardQuick) {
    btnEditCardQuick.onclick = () => {
      store.setUIState({ loyaltyWizardOpen: true, loyaltyStep: 1 });
    };
  }

  const btnCopyPassLink = document.getElementById('btn-copy-pass-link');
  if (btnCopyPassLink) {
    btnCopyPassLink.onclick = () => {
      navigator.clipboard?.writeText('https://beebill.online/#my-rewards');
      window.showToast?.('Loyalty pass link copied to clipboard!');
    };
  }

  const btnDashSendTest = document.getElementById('btn-dash-send-test');
  if (btnDashSendTest) {
    btnDashSendTest.onclick = () => {
      const phone = document.getElementById('dash-test-phone')?.value || '9745630606';
      window.showToast?.(`WhatsApp purchase notification sent to ${phone}!`);
    };
  }

  // Wizard Top Bar Buttons
  const btnBack = document.getElementById('loyalty-wizard-back-btn');
  if (btnBack) {
    btnBack.onclick = () => {
      const cur = Number(store.getUIState().loyaltyStep) || 1;
      if (cur > 1) {
        store.setUIState({ loyaltyStep: cur - 1 });
      }
    };
  }

  const btnNext = document.getElementById('loyalty-wizard-next-btn');
  if (btnNext) {
    btnNext.onclick = () => {
      const cur = Number(store.getUIState().loyaltyStep) || 1;
      if (cur < 5) {
        store.setUIState({ loyaltyStep: cur + 1 });
      }
    };
  }

  const btnSaveExit = document.getElementById('loyalty-wizard-save-exit-btn');
  if (btnSaveExit) {
    btnSaveExit.onclick = () => {
      store.setUIState({ loyaltyWizardOpen: false, loyaltyStep: 1 });
      window.showToast?.('Loyalty template draft saved');
    };
  }

  const btnSubmit = document.getElementById('loyalty-wizard-submit-btn');
  if (btnSubmit) {
    btnSubmit.onclick = () => {
      store.setUIState({ loyaltyWizardOpen: false, loyaltyStep: 1 });
      window.showToast?.('🚀 Loyalty Program & WhatsApp template updated and live!');
    };
  }

  // Step 1: Real-time text input listeners
  const inputName = document.getElementById('input-loyalty-name');
  if (inputName) {
    inputName.oninput = (e) => {
      const val = e.target.value || 'durbar';
      updateLoyaltyState({ name: val }, true);
    };
  }

  const inputTitle = document.getElementById('input-loyalty-title');
  if (inputTitle) {
    inputTitle.oninput = (e) => {
      const val = e.target.value || 'durbar';
      updateLoyaltyState({ title: val }, true);
      const live = document.getElementById('loyalty-preview-title');
      if (live) live.textContent = val.toLowerCase();
    };
  }

  const inputSubtitle = document.getElementById('input-loyalty-subtitle');
  if (inputSubtitle) {
    inputSubtitle.oninput = (e) => {
      const val = e.target.value || 'Get rewarded on every purchase';
      updateLoyaltyState({ subtitle: val }, true);
      const live = document.getElementById('loyalty-preview-subtitle');
      if (live) live.textContent = val;
    };
  }

  const inputSpendRate = document.getElementById('input-spend-rate');
  const inputPointsRate = document.getElementById('input-points-rate');
  const handleRateChange = () => {
    const s = inputSpendRate?.value || 100;
    const p = inputPointsRate?.value || 10;
    updateLoyaltyState({ spendRate: Number(s), pointsRate: Number(p) }, true);
    const live = document.getElementById('loyalty-preview-rate');
    if (live) live.textContent = `₹${s} Spent = ${p} Points`;
  };
  if (inputSpendRate) inputSpendRate.oninput = handleRateChange;
  if (inputPointsRate) inputPointsRate.oninput = handleRateChange;

  const inputTopUnlock = document.getElementById('input-top-unlock');
  if (inputTopUnlock) {
    inputTopUnlock.oninput = (e) => {
      const val = e.target.value;
      updateLoyaltyState({ topUnlockBanner: val }, true);
      const live = document.getElementById('preview-unlock-text');
      if (live) live.textContent = val;
    };
  }

  // Step 2: Tier edits
  document.querySelectorAll('.input-tier-points').forEach(input => {
    input.oninput = (e) => {
      const idx = Number(input.getAttribute('data-tier-index'));
      const tiers = [...(store.getState().loyaltyProgram.rewardTiers || [])];
      if (tiers[idx]) {
        tiers[idx].points = Number(e.target.value) || 0;
        updateLoyaltyState({ rewardTiers: tiers }, true);
      }
    };
  });

  document.querySelectorAll('.input-tier-title').forEach(input => {
    input.oninput = (e) => {
      const idx = Number(input.getAttribute('data-tier-index'));
      const tiers = [...(store.getState().loyaltyProgram.rewardTiers || [])];
      if (tiers[idx]) {
        tiers[idx].title = e.target.value;
        updateLoyaltyState({ rewardTiers: tiers }, true);
      }
    };
  });

  document.querySelectorAll('.input-tier-condition').forEach(input => {
    input.oninput = (e) => {
      const idx = Number(input.getAttribute('data-tier-index'));
      const tiers = [...(store.getState().loyaltyProgram.rewardTiers || [])];
      if (tiers[idx]) {
        tiers[idx].condition = e.target.value;
        updateLoyaltyState({ rewardTiers: tiers }, true);
      }
    };
  });

  document.querySelectorAll('.btn-delete-tier').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.getAttribute('data-tier-index'));
      const tiers = [...(store.getState().loyaltyProgram.rewardTiers || [])];
      tiers.splice(idx, 1);
      updateLoyaltyState({ rewardTiers: tiers });
    };
  });

  const btnAddTier = document.getElementById('btn-add-loyalty-tier');
  if (btnAddTier) {
    btnAddTier.onclick = () => {
      const tiers = [...(store.getState().loyaltyProgram.rewardTiers || [])];
      const lastPoints = tiers.length > 0 ? tiers[tiers.length - 1].points : 1000;
      tiers.push({
        id: `tier-${Date.now()}`,
        points: lastPoints + 1000,
        title: `Special Reward Level ${tiers.length + 1}`,
        condition: '*Minimum purchase of ₹500 required.',
        rewardType: 'discount_amount'
      });
      updateLoyaltyState({ rewardTiers: tiers });
    };
  }

  // Step 3: Logo, Colors, Banner & Terms
  const inputLogoText = document.getElementById('input-loyalty-logo-text');
  if (inputLogoText) {
    inputLogoText.oninput = (e) => {
      const val = e.target.value.toUpperCase();
      updateLoyaltyState({ logoText: val }, true);
      const live = document.getElementById('loyalty-preview-logo-text');
      if (live) live.textContent = val;
    };
  }

  const inputLogoFile = document.getElementById('input-loyalty-logo-file');
  if (inputLogoFile) {
    inputLogoFile.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          updateLoyaltyState({ logoUrl: evt.target.result });
          window.showToast?.('Brand logo updated');
        };
        reader.readAsDataURL(file);
      }
    };
  }

  document.querySelectorAll('.btn-loyalty-color-chip').forEach(btn => {
    btn.onclick = () => {
      const hex = btn.getAttribute('data-hex');
      if (hex) updateLoyaltyState({ cardBg: hex });
    };
  });

  const inputBgHex = document.getElementById('input-loyalty-bg-hex');
  if (inputBgHex) {
    inputBgHex.onchange = (e) => {
      updateLoyaltyState({ cardBg: e.target.value });
    };
  }

  const inputBgNative = document.getElementById('input-loyalty-bg-native');
  if (inputBgNative) {
    inputBgNative.oninput = (e) => {
      updateLoyaltyState({ cardBg: e.target.value });
    };
  }

  document.querySelectorAll('.btn-loyalty-banner-preset').forEach(btn => {
    btn.onclick = () => {
      const url = btn.getAttribute('data-url');
      if (url) updateLoyaltyState({ bannerUrl: url });
    };
  });

  const inputTerms = document.getElementById('input-loyalty-terms');
  if (inputTerms) {
    inputTerms.oninput = (e) => {
      const val = e.target.value;
      updateLoyaltyState({ termsAndConditions: val }, true);
      const live = document.getElementById('loyalty-preview-terms');
      if (live) live.textContent = val;
    };
  }

  // Step 4: WhatsApp Message
  const inputWaTemplate = document.getElementById('input-whatsapp-template');
  if (inputWaTemplate) {
    inputWaTemplate.oninput = (e) => {
      const val = e.target.value;
      const current = store.getState().loyaltyProgram?.whatsappPurchaseNotification || {};
      updateLoyaltyState({
        whatsappPurchaseNotification: { ...current, template: val }
      }, true);
      const live = document.getElementById('phone-whatsapp-bubble-text');
      if (live) {
        live.textContent = val
          .replace('{restaurant_name}', store.getState().loyaltyProgram.name || 'durbar')
          .replace('{points}', '1000')
          .replace('{balance}', '1450');
      }
    };
  }

  document.querySelectorAll('.btn-loyalty-insert-tag').forEach(btn => {
    btn.onclick = () => {
      const tag = btn.getAttribute('data-tag');
      const textarea = document.getElementById('input-whatsapp-template');
      if (textarea && tag) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const text = textarea.value;
        const next = text.substring(0, start) + tag + text.substring(end);
        textarea.value = next;
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        textarea.focus();
        const current = store.getState().loyaltyProgram?.whatsappPurchaseNotification || {};
        updateLoyaltyState({
          whatsappPurchaseNotification: { ...current, template: next }
        });
      }
    };
  });

  const btnCopyStep4 = document.getElementById('btn-copy-link-step4');
  if (btnCopyStep4) {
    btnCopyStep4.onclick = () => {
      navigator.clipboard?.writeText('https://beebill.online/#my-rewards');
      window.showToast?.('Pass link copied to clipboard!');
    };
  }

  // Step 5: Test send
  const btnWizardTest = document.getElementById('btn-wizard-send-test');
  if (btnWizardTest) {
    btnWizardTest.onclick = () => {
      const phone = document.getElementById('input-wizard-test-phone')?.value || '9745630606';
      window.showToast?.(`Sample purchase message & pass link sent to ${phone} via WhatsApp!`);
    };
  }
}

// Helper state updater
function updateLoyaltyState(patch, silent = false) {
  const current = store.getState().loyaltyProgram || {};
  const next = { ...current, ...patch };
  store.setState({ loyaltyProgram: next }, { silent });
}

function getDefaultRewardTiers() {
  return [
    {
      id: 'tier-1',
      points: 500,
      title: 'Get a free coffee',
      condition: '*Minimum purchase of ₹250 required to redeem reward.',
      rewardType: 'item'
    },
    {
      id: 'tier-2',
      points: 1000,
      title: "You're special. Get ₹125 off",
      condition: '*Valid on food & beverage bills.',
      rewardType: 'discount_amount'
    },
    {
      id: 'tier-3',
      points: 2000,
      title: 'You deserve it. Get ₹300 off',
      condition: '*Valid on bills above ₹600.',
      rewardType: 'discount_amount'
    },
    {
      id: 'tier-4',
      points: 3000,
      title: 'We love your loyalty. Get ₹500 off',
      condition: '*Valid on bills above ₹1000.',
      rewardType: 'discount_amount'
    },
    {
      id: 'tier-5',
      points: 5000,
      title: 'Party time! Get ₹1000 off on your bill!',
      condition: '*Valid on bills above ₹2000.',
      rewardType: 'discount_amount'
    }
  ];
}

function getDefaultWhatsAppTemplate(name = 'durbar') {
  return `Dear Customer,\n\nYour purchase at ${name} has been completed.\n\nYou have earned {points} points on this purchase.\n\nThis message has been sent to inform you about an account update related to your recent purchase.\n\nClick below to share feedback and view account details.`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const attachActivateLoyaltyListeners = attachLoyaltyListeners;

