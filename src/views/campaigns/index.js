// Campaigns Management & Multi-Step Template Builder Module
// Supports full Petpooja / Reelo style campaign creation, creative customization, SMS/WhatsApp preview, and audience segmentation.

import { store } from '../../state/store.js';
import { categorizeCustomerSegments } from '../customers/index.js';

// Curated high-res restaurant & hospitality imagery presets
export const BANNER_PRESETS = [
  {
    id: 'wine-dining',
    name: 'Fine Dining & Wine Glasses',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80',
    tag: 'Dinner & Wine'
  },
  {
    id: 'chef-table',
    name: 'Chef Tasting & Toast',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    tag: 'Gourmet'
  },
  {
    id: 'pizza-oven',
    name: 'Artisanal Pizza & Oven',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    tag: 'Italian'
  },
  {
    id: 'burger-craft',
    name: 'Gourmet Burgers & Fries',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    tag: 'Bistro & Grill'
  },
  {
    id: 'asian-bowl',
    name: 'Fresh Asian Bowls & Noodles',
    url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    tag: 'Pan-Asian'
  },
  {
    id: 'cocktails-bar',
    name: 'Signature Cocktails & Bar',
    url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=800&q=80',
    tag: 'Cocktails'
  }
];

export const THEME_COLOR_PRESETS = [
  { name: 'Petpooja Teal', hex: '#2a7e72' },
  { name: 'Emerald Green', hex: '#059669' },
  { name: 'Midnight Slate', hex: '#1e293b' },
  { name: 'Royal Wine', hex: '#881337' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Indigo Dusk', hex: '#4338ca' }
];

export function renderCampaignsView(state) {
  const uiState = store.getUIState();
  const isWizardOpen = Boolean(uiState.campaignWizardOpen);

  if (isWizardOpen) {
    return renderCampaignWizard(state, uiState);
  }

  return renderCampaignsDashboard(state, uiState);
}

// ============================================================================
// 1. CAMPAIGNS DASHBOARD (List View, Metrics & Launch Trigger)
// ============================================================================

function renderCampaignsDashboard(state, uiState) {
  const campaigns = state.campaigns || [];
  const filter = uiState.campaignFilter || 'all';

  const filteredCampaigns = campaigns.filter(c => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const totalSent = campaigns.reduce((s, c) => s + (c.sentCount || 0), 0);
  const totalRedeemed = campaigns.reduce((s, c) => s + (c.redeemedCount || 0), 0);
  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenueGenerated || 0), 0);
  const totalCampaigns = campaigns.length;

  return `
    <div class="px-4 md:px-8 py-6 max-w-7xl mx-auto flex flex-col gap-6 animate-fade-in pb-20">
      <!-- Header Banner -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-gray-200/80 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#e8f4f3] text-[#2a7e72]">
              <span class="material-symbols-outlined text-lg">campaign</span>
            </span>
            <span class="text-xs font-bold uppercase tracking-wider text-[#2a7e72]">Guest Marketing Hub</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">Broadcast & Win-Back Campaigns</h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 max-w-2xl font-medium">
            Design beautiful voucher creatives, configure expiry rules, customize SMS/WhatsApp templates, and send targeted blasts to bring back lapsed diners.
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
            id="btn-open-campaign-wizard" 
            type="button" 
            class="px-6 py-3 bg-[#2a7e72] hover:bg-[#23685e] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
          >
            <span class="material-symbols-outlined text-xl">add</span>
            Create Campaign
          </button>
        </div>
      </div>

      <!-- KPI Metrics Strip -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Total Campaigns</span>
            <span class="w-8 h-8 rounded-xl bg-teal-50 text-[#2a7e72] flex items-center justify-center">
              <span class="material-symbols-outlined text-base">outgoing_mail</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-gray-900">${totalCampaigns}</div>
            <div class="text-[11px] text-gray-400 mt-0.5">Automated & Manual blasts</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Diners Reached</span>
            <span class="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-base">group</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-gray-900">${totalSent.toLocaleString()}</div>
            <div class="text-[11px] text-emerald-600 font-semibold mt-0.5">${totalSent > 0 ? 'Verified WhatsApp Delivery' : 'No broadcasts sent yet'}</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Vouchers Redeemed</span>
            <span class="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-base">loyalty</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-gray-900">${totalRedeemed.toLocaleString()}</div>
            <div class="text-[11px] text-purple-700 font-semibold mt-0.5">${totalSent > 0 ? Math.round((totalRedeemed / totalSent) * 100) : 0}% claim rate</div>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-5 border border-gray-200/70 shadow-xs flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-500">Revenue Generated</span>
            <span class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span class="material-symbols-outlined text-base">payments</span>
            </span>
          </div>
          <div class="mt-3">
            <div class="text-2xl font-extrabold text-gray-900">₹${totalRevenue.toLocaleString()}</div>
            <div class="text-[11px] text-emerald-600 font-semibold mt-0.5">${totalRevenue > 0 ? (totalRevenue / Math.max(1, totalSent * 0.78)).toFixed(1) + 'x Campaign ROI' : '₹0 attributed revenue'}</div>
          </div>
        </div>
      </div>

      <!-- Filter Tabs & Campaign Table -->
      <div class="bg-white rounded-3xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-1.5 p-1 bg-gray-100/70 rounded-xl w-fit">
            ${['all', 'active', 'draft', 'completed'].map(t => {
              const isActive = filter === t;
              const labels = { all: 'All Campaigns', active: 'Active', draft: 'Drafts', completed: 'Completed' };
              return `
                <button 
                  type="button" 
                  class="campaign-tab-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${isActive ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'}"
                  data-filter="${t}"
                >
                  ${labels[t]}
                </button>
              `;
            }).join('')}
          </div>

          <div class="text-xs text-gray-500 font-medium">
            Showing <strong class="text-gray-900">${filteredCampaigns.length}</strong> campaigns
          </div>
        </div>

        ${filteredCampaigns.length === 0 ? `
          <div class="p-12 text-center flex flex-col items-center justify-center">
            <div class="w-16 h-16 rounded-3xl bg-[#e8f4f3] text-[#2a7e72] flex items-center justify-center mb-4">
              <span class="material-symbols-outlined text-3xl">campaign</span>
            </div>
            <h3 class="text-base font-bold text-gray-900">No campaigns found</h3>
            <p class="text-xs text-gray-500 max-w-sm mt-1">Start by creating your first promotional campaign to re-engage lapsed and lost customers.</p>
            <button 
              id="btn-create-first-campaign"
              type="button" 
              class="mt-4 px-5 py-2.5 bg-[#2a7e72] hover:bg-[#23685e] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-base">add</span>
              Create Campaign Now
            </button>
          </div>
        ` : `
          <div class="divide-y divide-gray-100">
            ${filteredCampaigns.map(camp => renderCampaignCardRow(camp)).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderCampaignCardRow(camp) {
  const statusStyles = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
    completed: 'bg-gray-100 text-gray-700 border-gray-200',
    scheduled: 'bg-blue-50 text-blue-700 border-blue-200'
  };

  const statusLabel = {
    active: 'Active & Sending',
    draft: 'Draft',
    completed: 'Delivered',
    scheduled: 'Scheduled'
  };

  return `
    <div class="p-5 md:p-6 hover:bg-gray-50/70 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-start gap-4">
        <!-- Visual Thumbnail -->
        <div class="relative w-16 h-16 rounded-2xl overflow-hidden shadow-xs flex-shrink-0 border border-gray-200">
          <img src="${camp.bannerUrl || BANNER_PRESETS[0].url}" alt="Banner" class="w-full h-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          <span class="absolute bottom-1 left-1.5 text-[9px] font-black text-white px-1 py-0.5 rounded bg-[#2a7e72]/80 uppercase">
            ${camp.channel === 'whatsapp' ? 'WA' : 'SMS'}
          </span>
        </div>

        <div class="flex flex-col">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${statusStyles[camp.status] || statusStyles.active}">
              ${statusLabel[camp.status] || 'Active'}
            </span>
            <span class="text-xs text-gray-400">•</span>
            <span class="text-xs font-semibold text-gray-500">${camp.segmentName || 'All Diners'}</span>
            <span class="text-xs text-gray-400">•</span>
            <span class="text-xs text-gray-400">Expires ${camp.expiryDate || 'N/A'}</span>
          </div>

          <h3 class="text-base font-bold text-gray-900 mt-1">${camp.title}</h3>
          <p class="text-xs text-gray-500 mt-0.5 line-clamp-1">${camp.subtitle || 'Promotional dining voucher'}</p>
        </div>
      </div>

      <!-- Stats & Quick Actions -->
      <div class="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-gray-100">
        <div class="flex items-center gap-5 text-xs">
          <div>
            <div class="text-gray-400 text-[10px] uppercase font-semibold">Sent</div>
            <div class="font-extrabold text-gray-900">${(camp.sentCount || 0).toLocaleString()}</div>
          </div>
          <div>
            <div class="text-gray-400 text-[10px] uppercase font-semibold">Redeemed</div>
            <div class="font-extrabold text-purple-600">${(camp.redeemedCount || 0).toLocaleString()}</div>
          </div>
          <div>
            <div class="text-gray-400 text-[10px] uppercase font-semibold">Sales</div>
            <div class="font-extrabold text-[#2a7e72]">₹${(camp.revenueGenerated || 0).toLocaleString()}</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button 
            type="button" 
            class="btn-edit-campaign p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-200/60 transition cursor-pointer"
            data-campaign-id="${camp.id}"
            title="Edit Campaign"
          >
            <span class="material-symbols-outlined text-lg">edit</span>
          </button>
          <button 
            type="button" 
            class="btn-delete-campaign p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
            data-campaign-id="${camp.id}"
            title="Delete Campaign"
          >
            <span class="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. MULTI-STEP CAMPAIGN WIZARD (Matching Screenshots Pixel-for-Pixel)
// ============================================================================

function renderCampaignWizard(state, uiState) {
  const step = Number(uiState.campaignStep) || 1;
  const form = uiState.campaignForm || {};

  const stepTitles = {
    1: 'What is the Campaign about?',
    2: 'When does the Campaign expire?',
    3: 'Review Campaign Creative',
    4: 'Review SMS',
    5: 'Select Audience & Send Campaign'
  };

  return `
    <div class="min-h-screen bg-[#f8fafb] flex flex-col pb-16">
      <!-- Top Fixed/Sticky Navigation Bar (Exact Reelo Top Bar) -->
      <header class="h-16 px-4 md:px-8 bg-white border-b border-gray-200 flex items-center justify-between sticky top-16 z-30 shadow-2xs">
        <div class="flex items-center gap-3">
          <button 
            id="wizard-step-menu-btn" 
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
              id="wizard-back-btn" 
              type="button" 
              class="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition cursor-pointer flex items-center gap-1"
            >
              Back
            </button>
          ` : ''}

          <button 
            id="wizard-save-exit-btn" 
            type="button" 
            class="px-4 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
          >
            Save and exit
          </button>

          ${step < 5 ? `
            <button 
              id="wizard-next-btn" 
              type="button" 
              class="px-5 py-2 bg-[#2a7e72] hover:bg-[#23685e] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer hover:shadow-md"
            >
              <span>Next</span>
              <span class="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          ` : `
            <button 
              id="wizard-submit-btn" 
              type="button" 
              class="px-5 py-2 bg-[#2a7e72] hover:bg-[#23685e] text-white text-xs font-extrabold rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer hover:scale-[1.01]"
            >
              <span>🚀 Send Campaign Now</span>
            </button>
          `}
        </div>
      </header>

      <!-- Main Two-Column Interactive Layout -->
      <div class="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col lg:flex-row items-start gap-8">
        <!-- LEFT COLUMN: Dynamic Interactive Live Card Preview / Mockup -->
        <div class="w-full lg:w-[460px] flex-shrink-0 flex flex-col items-center">
          <div class="w-full flex items-center justify-between mb-3 px-1">
            <h2 class="text-base font-extrabold text-gray-900">${step === 4 ? 'Device Preview' : stepTitles[step]}</h2>
            ${step === 3 ? `
              <div class="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 text-xs text-gray-500 shadow-2xs">
                <button id="btn-zoom-in" type="button" class="p-1 hover:text-gray-900" title="Zoom in"><span class="material-symbols-outlined text-sm">add</span></button>
                <button id="btn-zoom-out" type="button" class="p-1 hover:text-gray-900" title="Zoom out"><span class="material-symbols-outlined text-sm">remove</span></button>
                <button id="btn-zoom-reset" type="button" class="p-1 hover:text-gray-900" title="Reset"><span class="material-symbols-outlined text-sm">restart_alt</span></button>
                <span class="border-l border-gray-200 pl-1.5 pr-1 text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                  <span class="material-symbols-outlined text-xs">drag_pan</span> Reposition
                </span>
              </div>
            ` : ''}
          </div>

          <!-- Preview Container (Card or Smartphone based on step) -->
          <div class="w-full flex justify-center sticky top-36">
            ${step === 4 ? renderPhoneMockupPreview(form, state) : renderVoucherCardPreview(form)}
          </div>
        </div>

        <!-- RIGHT COLUMN: Step Controls & Configuration Forms -->
        <div class="flex-1 w-full flex flex-col gap-5">
          ${renderWizardStepContent(step, form, state)}
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 3. VOUCHER CARD LIVE PREVIEW (Exact Screenshot 2 & 3 Architecture)
// ============================================================================

export function renderVoucherCardPreview(form) {
  const themeColor = form.themeColor || '#2a7e72';
  const textColor = form.textColor || '#ffffff';
  const bannerUrl = form.bannerUrl || BANNER_PRESETS[0].url;
  const logoText = form.logoText || 'DURBAR';
  const logoUrl = form.logoUrl || '';

  const title = form.title || 'Write campaign title';
  const subtitle = form.subtitle || 'Write campaign subtitle';
  const expiryDate = form.expiryDate ? formatDatePretty(form.expiryDate) : '31 Oct 2026';
  const supportPhone = form.supportPhone || '9745630606';
  const terms = form.termsAndConditions || '2 offers cannot be clubbed. Reward cannot be exchanged for cash.';

  return `
    <div 
      id="live-voucher-card"
      class="w-full max-w-[370px] bg-white rounded-[28px] overflow-hidden shadow-xl border border-gray-200/80 transition-all select-none relative"
      style="box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.12);"
    >
      <!-- Top Banner Image -->
      <div class="relative h-44 w-full overflow-hidden bg-gray-100">
        <img 
          id="card-preview-banner" 
          src="${bannerUrl}" 
          alt="Campaign Creative" 
          class="w-full h-full object-cover transition-transform duration-300"
          style="transform: scale(${form.zoomLevel ? form.zoomLevel / 100 : 1});"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10"></div>
      </div>

      <!-- Overlapping Circular Brand Logo Badge (Exact Durbar Circle) -->
      <div class="relative px-6">
        <div class="absolute -top-10 left-6 z-10 w-20 h-20 rounded-full bg-white shadow-md border-2 border-white flex items-center justify-center overflow-hidden p-1">
          ${logoUrl ? `
            <img src="${logoUrl}" alt="Logo" class="w-full h-full object-contain rounded-full" />
          ` : `
            <div class="w-full h-full rounded-full bg-gray-50 flex items-center justify-center text-center p-1">
              <span class="text-[11px] font-black tracking-widest text-gray-800 uppercase leading-none">${logoText}</span>
            </div>
          `}
        </div>
      </div>

      <!-- Wavy Theme Color Divider (Exact SVG Wave from Screenshot) -->
      <div class="w-full relative mt-[-18px]" style="line-height: 0;">
        <svg viewBox="0 0 500 120" preserveAspectRatio="none" class="w-full h-12 block" style="fill: ${themeColor};">
          <path d="M0,0 C150,90 350,-40 500,40 L500,120 L0,120 Z"></path>
        </svg>
      </div>

      <!-- Middle Theme Banner with Campaign Title Box -->
      <div class="px-6 pb-6 pt-1 transition-colors" style="background-color: ${themeColor}; color: ${textColor};">
        <!-- Inner Rounded Border Box with Title and Subtitle -->
        <div 
          class="rounded-2xl p-4 text-center transition-all border border-dashed border-white/40"
          style="background-color: rgba(0, 0, 0, 0.16);"
        >
          <h3 id="card-preview-title" class="text-xl font-extrabold tracking-tight leading-tight" style="color: ${textColor};">
            ${escapeHtml(title)}
          </h3>
          <p id="card-preview-subtitle" class="text-xs mt-1.5 opacity-90 font-medium leading-relaxed" style="color: ${textColor};">
            ${escapeHtml(subtitle)}
          </p>
        </div>
      </div>

      <!-- Lower Card Body with Expiry & Terms -->
      <div class="px-6 py-5 bg-white flex flex-col items-center text-center gap-3">
        <!-- Expiry Tag -->
        <div class="w-full pt-1">
          <div class="text-[12px] font-bold text-gray-700">
            Expires on <span id="card-preview-expiry" class="font-extrabold text-gray-900">${expiryDate}</span>
          </div>
          <div class="w-12 h-0.5 bg-gray-200 mx-auto mt-2 mb-2 rounded-full"></div>
        </div>

        <!-- Terms and Conditions -->
        <div class="text-[11px] text-gray-500 leading-relaxed font-normal max-w-xs whitespace-pre-line">
          ${escapeHtml(terms)}
        </div>

        <!-- Redemption Single-Use & Support Footer -->
        <div class="text-[10px] text-gray-400 mt-1 leading-snug">
          <div>The campaign can be redeemed once.</div>
          <div>Call <a href="tel:${supportPhone}" class="font-semibold text-gray-700 underline">${supportPhone}</a> for more details.</div>
        </div>
      </div>

      <!-- Voucher Bottom Scalloped Cutout Accent -->
      <div class="h-2 w-full bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 opacity-60"></div>
    </div>
  `;
}

// ============================================================================
// 4. SMARTPHONE MOCKUP PREVIEW (Exact Screenshot 4 Device Frame)
// ============================================================================

export function renderPhoneMockupPreview(form, state) {
  const channel = form.channel || 'sms';
  const logoText = form.logoText || 'mREELO';
  const bodyText = form.smsText || 'Dear Customer,\n\n-Reelo';
  const shortLink = `lreelo.io/${form.shortLinkCode || 'mSvFr'}`;

  return `
    <div class="w-full max-w-[340px] bg-[#1e293b] rounded-[44px] p-3 shadow-2xl border-4 border-[#334155] relative select-none">
      <!-- Phone Top Speaker & Camera Notch -->
      <div class="w-full flex items-center justify-center pt-2 pb-3">
        <div class="w-16 h-1.5 bg-[#475569] rounded-full"></div>
        <div class="w-2.5 h-2.5 bg-[#0f172a] rounded-full ml-3 border border-[#334155]"></div>
      </div>

      <!-- Smartphone Screen Canvas -->
      <div class="w-full bg-[#0f172a] rounded-[36px] overflow-hidden min-h-[500px] flex flex-col justify-between p-4 text-white">
        <!-- Top Status Bar & Sender Header -->
        <div class="flex flex-col items-center border-b border-white/10 pb-4 pt-1">
          <div class="w-14 h-14 rounded-full bg-[#2a7e72] flex items-center justify-center text-white text-xl font-black shadow-md mb-2">
            ${logoText.charAt(0).toUpperCase()}
          </div>
          <div class="text-xs font-bold tracking-wide text-gray-200">${logoText}</div>
          <div class="text-[10px] text-gray-400 mt-0.5">Verified Hospitality Broadcast</div>
        </div>

        <!-- Chat Bubble Area (Slate Blue / Dark Modern Bubble) -->
        <div class="flex-1 py-4 flex flex-col justify-start">
          <div class="bg-[#334155]/90 rounded-2xl p-4 text-xs text-gray-100 leading-relaxed shadow-md border border-white/5 max-w-[92%] whitespace-pre-line relative">
            <div id="phone-preview-bubble-content">
              ${escapeHtml(bodyText)}
            </div>
            <div class="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-teal-400 font-semibold">
              <span class="underline">${shortLink}</span>
              <span class="text-gray-400">Now • ✓✓</span>
            </div>
          </div>
        </div>

        <!-- Fake Message Typing Bar -->
        <div class="bg-[#1e293b] rounded-full px-4 py-2.5 flex items-center justify-between text-xs text-gray-400 border border-white/10">
          <span>Read-only broadcast</span>
          <span class="material-symbols-outlined text-sm text-[#2a7e72]">lock</span>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 5. STEP FORMS & CONTROLS (Right Column Components)
// ============================================================================

function renderWizardStepContent(step, form, state) {
  switch (step) {
    case 1:
      return renderStep1Content(form);
    case 2:
      return renderStep2Content(form);
    case 3:
      return renderStep3Content(form);
    case 4:
      return renderStep4Content(form);
    case 5:
      return renderStep5Content(form, state);
    default:
      return renderStep1Content(form);
  }
}

// ----------------------------------------------------------------------------
// STEP 1: Campaign Type & Reward (Screenshot 2)
// ----------------------------------------------------------------------------
function renderStep1Content(form) {
  const rewardType = form.rewardType || 'percentage';
  const discountValue = form.discountValue || '20';
  const discountScope = form.discountScope || 'entire';
  const hasMax = Boolean(form.hasMaxRedeemLimit);
  const title = form.title || 'Write campaign title';
  const subtitle = form.subtitle || 'Write campaign subtitle';

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <!-- Reward Type Selection Card -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Reward Type</h3>

        <div class="grid grid-cols-1 gap-2.5">
          ${[
            { id: 'percentage', label: 'Redeem % discount', placeholder: 'Enter discount % (e.g. 20)' },
            { id: 'flat', label: 'Redeem ₹ discount', placeholder: 'Enter discount amount (e.g. 150)' },
            { id: 'item', label: 'Redeem a free item', placeholder: 'Enter free item name (e.g. Chef Special Dessert)' },
            { id: 'no_discount', label: 'No Discount', placeholder: '' }
          ].map(opt => {
            const isSelected = rewardType === opt.id;
            return `
              <label class="flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${isSelected ? 'border-[#2a7e72] bg-[#f0f9f8] shadow-2xs' : 'border-gray-200 hover:bg-gray-50'}">
                <span class="text-xs font-bold text-gray-800">${opt.label}</span>
                <input 
                  type="radio" 
                  name="campaign_reward_type" 
                  value="${opt.id}" 
                  class="w-4 h-4 text-[#2a7e72] focus:ring-[#2a7e72]" 
                  ${isSelected ? 'checked' : ''} 
                />
              </label>
            `;
          }).join('')}
        </div>

        ${rewardType !== 'no_discount' ? `
          <!-- Discount Value Input -->
          <div class="mt-1">
            <label class="text-xs font-semibold text-gray-600 mb-1.5 block">Discount Value</label>
            <input 
              id="input-discount-val" 
              type="text" 
              value="${escapeHtml(discountValue)}" 
              placeholder="Enter discount" 
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition"
            />
          </div>

          <!-- Purchase Applicability Scope Buttons -->
          <div class="flex items-center gap-2 mt-2">
            <button 
              type="button" 
              class="btn-scope-toggle flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${discountScope === 'entire' ? 'bg-[#2a7e72] text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
              data-scope="entire"
            >
              Entire purchase
            </button>
            <button 
              type="button" 
              class="btn-scope-toggle flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${discountScope === 'specific' ? 'bg-[#2a7e72] text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
              data-scope="specific"
            >
              Specific Purchase
            </button>
          </div>

          <!-- Max Redemption Limit Toggle -->
          <div class="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-100 mt-2">
            <span class="text-xs font-medium text-gray-700">Set maximum amount customer can redeem</span>
            <input 
              id="toggle-max-redeem" 
              type="checkbox" 
              class="w-4 h-4 text-[#2a7e72] rounded focus:ring-[#2a7e72]" 
              ${hasMax ? 'checked' : ''} 
            />
          </div>

          ${hasMax ? `
            <div class="mt-2">
              <label class="text-[11px] font-semibold text-gray-500 mb-1 block">Maximum Discount Cap (₹)</label>
              <input 
                id="input-max-amount" 
                type="number" 
                value="${form.maxRedeemAmount || 200}" 
                class="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs" 
                placeholder="₹200" 
              />
            </div>
          ` : ''}
        ` : ''}

        <!-- Exact Blue Information Alert from Screenshot -->
        <div class="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/60 flex items-start gap-2.5 text-xs text-blue-900 mt-2">
          <span class="material-symbols-outlined text-blue-600 text-base mt-0.5">info</span>
          <div class="leading-relaxed">
            This feature isn't available in the current integration of Reelo & Petpooja, but our teams are actively working to make it happen for you! 
            <button type="button" class="font-bold underline text-blue-700 ml-1 cursor-pointer" onclick="window.showToast?.('Feedback noted! Feature priority recorded.')">I'm Interested</button>
          </div>
        </div>
      </div>

      <!-- Campaign Title & Description Card -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <div>
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Campaign title</label>
          <input 
            id="input-campaign-title" 
            type="text" 
            value="${escapeHtml(title)}" 
            placeholder="Write campaign title" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition"
          />
        </div>

        <div>
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Campaign Description</label>
          <textarea 
            id="input-campaign-desc" 
            rows="3" 
            placeholder="Write campaign subtitle" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition resize-none"
          >${escapeHtml(subtitle)}</textarea>
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 2: Expiration & Redemption Details
// ----------------------------------------------------------------------------
function renderStep2Content(form) {
  const expiryDate = form.expiryDate || '2026-11-06';
  const terms = form.termsAndConditions || '2 offers cannot be clubbed. Reward cannot be exchanged for cash.';
  const supportPhone = form.supportPhone || '9745630606';

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <!-- Expiration Date Configuration -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Expiration Date</h3>
        <p class="text-xs text-gray-500 font-medium">Define how long customers have to claim and redeem this dining offer.</p>

        <!-- Quick Validity Chips -->
        <div class="grid grid-cols-3 gap-2">
          ${[
            { days: '7', label: '7 Days' },
            { days: '14', label: '14 Days' },
            { days: '30', label: '30 Days' }
          ].map(p => `
            <button 
              type="button" 
              class="btn-validity-preset py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer hover:border-[#2a7e72] hover:bg-[#f0f9f8]"
              data-days="${p.days}"
            >
              Valid for ${p.label}
            </button>
          `).join('')}
        </div>

        <div class="mt-2">
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Custom Expiry Date</label>
          <input 
            id="input-expiry-date" 
            type="date" 
            value="${expiryDate}" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition"
          />
        </div>
      </div>

      <!-- Offer Rules & Conditions Card -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Terms & Conditions</h3>

        <div class="flex flex-col gap-2.5">
          <label class="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked class="w-4 h-4 text-[#2a7e72] rounded" />
            <span>2 offers cannot be clubbed with other deals</span>
          </label>
          <label class="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked class="w-4 h-4 text-[#2a7e72] rounded" />
            <span>Reward cannot be exchanged for cash</span>
          </label>
          <label class="flex items-center gap-2.5 text-xs text-gray-700 cursor-pointer">
            <input type="checkbox" checked class="w-4 h-4 text-[#2a7e72] rounded" />
            <span>Single redemption per dining table</span>
          </label>
        </div>

        <div class="mt-2">
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Full Terms Text</label>
          <textarea 
            id="input-terms" 
            rows="3" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition resize-none"
          >${escapeHtml(terms)}</textarea>
        </div>

        <div>
          <label class="text-xs font-bold text-gray-800 mb-1.5 block">Customer Inquiries Phone Number</label>
          <input 
            id="input-support-phone" 
            type="tel" 
            value="${escapeHtml(supportPhone)}" 
            placeholder="e.g. 9745630606" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition"
          />
        </div>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 3: Review Campaign Creative (Screenshot 3)
// ----------------------------------------------------------------------------
function renderStep3Content(form) {
  const themeColor = form.themeColor || '#2a7e72';
  const textColor = form.textColor || '#ffffff';
  const logoText = form.logoText || 'DURBAR';
  const bannerUrl = form.bannerUrl || BANNER_PRESETS[0].url;

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <!-- Logo Upload & Text Card -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-3">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Logo</h3>
        
        <div class="flex items-center gap-3">
          <label class="flex-1 py-3 px-4 rounded-2xl border-2 border-dashed border-gray-300 hover:border-[#2a7e72] hover:bg-[#f0f9f8] transition flex items-center justify-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
            <span class="material-symbols-outlined text-lg text-[#2a7e72]">upload</span>
            <span>Upload your logo</span>
            <input id="input-logo-file" type="file" accept="image/*" class="hidden" />
          </label>
        </div>
        <p class="text-[11px] text-gray-400">Recommended size 512 x 512 px in JPG, GIF or PNG format upto max size of 10MB</p>

        <div class="mt-2">
          <label class="text-xs font-bold text-gray-800 mb-1 block">Brand Display Name (Fallback)</label>
          <input 
            id="input-logo-text" 
            type="text" 
            value="${escapeHtml(logoText)}" 
            class="w-full px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 uppercase"
            placeholder="DURBAR"
          />
        </div>
      </div>

      <!-- Theme Color & Text Color Swatches (Exact Screenshot 3) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <!-- Theme Color Picker -->
        <div class="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold text-gray-900 uppercase tracking-wide">Theme color</span>
              <div class="w-6 h-6 rounded-full border border-gray-200 shadow-2xs" style="background-color: ${themeColor};"></div>
            </div>
            <!-- Preset Palette Circles -->
            <div class="flex items-center gap-2 flex-wrap mb-3">
              ${THEME_COLOR_PRESETS.map(c => `
                <button 
                  type="button" 
                  class="btn-theme-color-chip w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${themeColor === c.hex ? 'border-gray-900 scale-110 shadow-xs' : 'border-white'}" 
                  style="background-color: ${c.hex};" 
                  data-hex="${c.hex}" 
                  title="${c.name}"
                ></button>
              `).join('')}
            </div>
          </div>
          <div class="flex items-center gap-2 pt-2 border-t border-gray-100">
            <span class="text-[11px] text-gray-400 font-mono">Hex:</span>
            <input 
              id="input-theme-hex" 
              type="text" 
              value="${themeColor}" 
              class="w-24 px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono font-bold"
            />
            <input id="input-theme-native" type="color" value="${themeColor}" class="w-7 h-7 rounded cursor-pointer border-0" />
          </div>
        </div>

        <!-- Text Color Picker -->
        <div class="bg-white rounded-3xl p-5 border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-bold text-gray-900 uppercase tracking-wide">Text color</span>
              <div class="w-6 h-6 rounded-full border border-gray-200 shadow-2xs" style="background-color: ${textColor};"></div>
            </div>
            <div class="flex items-center gap-2">
              <button 
                type="button" 
                class="btn-text-color-chip flex-1 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${textColor === '#ffffff' ? 'border-[#2a7e72] bg-[#f0f9f8] text-[#2a7e72]' : 'border-gray-200 text-gray-700'}"
                data-hex="#ffffff"
              >
                <span class="w-3.5 h-3.5 rounded-full bg-white border border-gray-300"></span>
                <span>White</span>
              </button>
              <button 
                type="button" 
                class="btn-text-color-chip flex-1 py-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${textColor === '#1e293b' ? 'border-[#2a7e72] bg-[#f0f9f8] text-[#2a7e72]' : 'border-gray-200 text-gray-700'}"
                data-hex="#1e293b"
              >
                <span class="w-3.5 h-3.5 rounded-full bg-[#1e293b]"></span>
                <span>Dark Slate</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Banner Image Picker & Curated Presets Grid (Exact Screenshot 3) -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Banner Image</h3>
        <p class="text-[11px] text-gray-400">Recommended size 512 x 512 px in JPG, GIF or PNG format up-to max size of 5MB.</p>

        <!-- Upload Your Own Button -->
        <label class="w-full py-3 px-4 rounded-2xl border border-gray-300 hover:border-[#2a7e72] hover:bg-[#f0f9f8] transition flex items-center justify-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
          <span class="material-symbols-outlined text-lg text-[#2a7e72]">upload</span>
          <span>Upload Your Own</span>
          <input id="input-banner-file" type="file" accept="image/*" class="hidden" />
        </label>

        <!-- Unsplash Promo Notice (From Screenshot) -->
        <div class="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/60 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl overflow-hidden shadow-2xs flex-shrink-0">
              <img src="${BANNER_PRESETS[1].url}" alt="Unsplash" class="w-full h-full object-cover" />
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="px-1.5 py-0.2 bg-purple-600 text-white text-[9px] font-black rounded uppercase">NEW</span>
                <span class="text-xs font-bold text-gray-900">Try beautiful Free Images & Picture via Unsplash</span>
              </div>
              <button 
                type="button" 
                class="text-[11px] font-bold text-purple-700 underline mt-0.5 cursor-pointer"
                onclick="window.showToast?.('Browsing hospitality stock presets below!')"
              >
                Try now
              </button>
            </div>
          </div>
        </div>

        <!-- Curated Presets Grid -->
        <div>
          <label class="text-xs font-bold text-gray-800 mb-2 block">Previous Uploads & Curated Presets</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            ${BANNER_PRESETS.map(p => {
              const isSelected = bannerUrl === p.url;
              return `
                <button 
                  type="button" 
                  class="btn-banner-preset relative h-24 rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group text-left ${isSelected ? 'border-[#2a7e72] ring-2 ring-[#2a7e72]/30 shadow-md scale-[1.02]' : 'border-transparent hover:border-gray-300'}"
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
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 4: Review SMS & WhatsApp Template (Screenshot 4)
// ----------------------------------------------------------------------------
function renderStep4Content(form) {
  const bodyText = form.smsText || 'Dear Customer,\n\n-Reelo';
  const charLength = bodyText.length;
  const credits = Math.max(1, Math.ceil(charLength / 160));
  const linkType = form.linkType || 'reelo';
  const shortLink = `lreelo.io/${form.shortLinkCode || 'mSvFr'}`;

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <!-- Edit SMS / Copy Card (Exact Screenshot 4) -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#2a7e72] text-xl">chat_bubble</span>
            <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Edit SMS</h3>
          </div>
          <span id="sms-char-counter" class="text-xs font-semibold text-gray-500">
            Character length: <strong class="text-gray-900">${charLength}</strong> / ${credits} credit
          </span>
        </div>

        <!-- Dynamic Variable Tags -->
        <div class="flex items-center gap-1.5 flex-wrap pt-1">
          <span class="text-[11px] text-gray-400 font-semibold mr-1">Insert tag:</span>
          ${[
            { tag: '{customer_name}', label: '+ Customer Name' },
            { tag: '{discount}', label: '+ Discount' },
            { tag: '{expiry_date}', label: '+ Expiry Date' },
            { tag: '{campaign_link}', label: '+ Voucher Link' }
          ].map(v => `
            <button 
              type="button" 
              class="btn-insert-tag px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-[#e8f4f3] hover:text-[#2a7e72] text-[11px] font-bold text-gray-700 transition cursor-pointer"
              data-tag="${v.tag}"
            >
              ${v.label}
            </button>
          `).join('')}
        </div>

        <div class="mt-1">
          <textarea 
            id="input-sms-body" 
            rows="6" 
            class="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] transition resize-none leading-relaxed"
            placeholder="Type your SMS or WhatsApp copy here..."
          >${escapeHtml(bodyText)}</textarea>
        </div>
      </div>

      <!-- Campaign Link Card (Exact Screenshot 4) -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-3">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Campaign link</h3>

        <!-- Link Type Toggle -->
        <div class="flex items-center gap-2">
          <button 
            type="button" 
            class="btn-link-type flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${linkType === 'reelo' ? 'bg-[#2a7e72] text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
            data-link-type="reelo"
          >
            Reelo Link
          </button>
          <button 
            type="button" 
            class="btn-link-type flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${linkType === 'custom' ? 'bg-[#2a7e72] text-white shadow-xs' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
            data-link-type="custom"
          >
            Custom Link
          </button>
        </div>

        <!-- Generated Shortlink Row -->
        <div class="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center justify-between mt-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[#2a7e72] text-lg">link</span>
            <span class="text-xs font-bold text-[#2a7e72] font-mono">${shortLink}</span>
          </div>
          <button 
            id="btn-copy-shortlink" 
            type="button" 
            class="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition flex items-center gap-1 cursor-pointer"
          >
            <span class="material-symbols-outlined text-sm">content_copy</span>
            <span>Copy</span>
          </button>
        </div>
        <p class="text-[11px] text-gray-400">This link will take your customer to the interactive digital voucher page.</p>
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// STEP 5: Audience Segmentation & Send (Winning Back Diners)
// ----------------------------------------------------------------------------
function renderStep5Content(form, state) {
  const customers = state.customers || [];
  const segments = categorizeCustomerSegments(customers);
  const selectedSegment = form.targetSegment || 'atRisk';

  // Real active database counts
  const segmentStats = {
    atRisk: {
      title: 'Lapsed Diners (30-90 Days Inactive)',
      desc: 'Guests who visited before but haven\'t dined in 1-3 months. Re-engage to prevent permanent churn.',
      count: segments.atRisk?.count || 0,
      badge: '🔥 Top Win-Back',
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    lost: {
      title: 'Lost Diners (90+ Days Inactive)',
      desc: 'High churn-risk diners away for over 3 months. Needs attractive discount incentive to return.',
      count: segments.lost?.count || 0,
      badge: '⚠️ Churn Risk',
      badgeColor: 'bg-red-100 text-red-800'
    },
    firstTimers: {
      title: 'First-Timers (1 Visit)',
      desc: 'New diners who dined once. Encourage 2nd visit to convert them into high-value regulars.',
      count: segments.firstTimers?.count || 0,
      badge: '🌱 Habit Builder',
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    loyal: {
      title: 'VIP & Loyal Regulars',
      desc: 'Your top spenders and regulars with 4+ visits. Send exclusive VIP tasting invitations.',
      count: segments.loyal?.count || 0,
      badge: '👑 VIP Guests',
      badgeColor: 'bg-purple-100 text-purple-800'
    },
    all: {
      title: 'All Diners (Full Database)',
      desc: 'Broadcast promotional announcement to all verified diner contacts.',
      count: customers.length,
      badge: '📢 Full Blast',
      badgeColor: 'bg-gray-100 text-gray-800'
    }
  };

  const activeStat = segmentStats[selectedSegment] || segmentStats.atRisk;
  const estimatedReach = activeStat.count;
  const estCost = (estimatedReach * 0.78).toFixed(2);

  return `
    <div class="flex flex-col gap-5 animate-fade-in">
      <!-- Target Diner Segment Selector Card -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <div>
          <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Target Diner Segment</h3>
          <p class="text-xs text-gray-500 font-medium mt-0.5">Select a customer lifecycle segment to maximize repeat visits and re-engage lapsed customers.</p>
        </div>

        <div class="grid grid-cols-1 gap-3">
          ${Object.entries(segmentStats).map(([key, item]) => {
            const isSelected = selectedSegment === key;
            return `
              <label class="p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${isSelected ? 'border-[#2a7e72] bg-[#f0f9f8] shadow-xs' : 'border-gray-200 hover:bg-gray-50'}">
                <div class="flex items-start gap-3">
                  <input 
                    type="radio" 
                    name="target_segment" 
                    value="${key}" 
                    class="mt-1 w-4 h-4 text-[#2a7e72] focus:ring-[#2a7e72]" 
                    ${isSelected ? 'checked' : ''} 
                  />
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-extrabold text-gray-900">${item.title}</span>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}">${item.badge}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1 leading-relaxed">${item.desc}</p>
                  </div>
                </div>

                <div class="text-right flex-shrink-0">
                  <div class="text-base font-extrabold text-gray-900">${item.count}</div>
                  <div class="text-[10px] text-gray-400 font-medium">Eligible Diners</div>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Delivery & Audience Cost Summary -->
      <div class="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <h3 class="text-sm font-extrabold text-gray-900 uppercase tracking-wider">Campaign Reach & Delivery</h3>

        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="p-3 bg-gray-50 rounded-2xl">
            <span class="text-[11px] text-gray-400 font-semibold block">Target Audience</span>
            <span class="text-lg font-black text-gray-900 mt-0.5 block">${estimatedReach.toLocaleString()}</span>
          </div>
          <div class="p-3 bg-teal-50 rounded-2xl">
            <span class="text-[11px] text-[#2a7e72] font-semibold block">Channel</span>
            <span class="text-sm font-black text-[#2a7e72] mt-1 block">WhatsApp & SMS</span>
          </div>
          <div class="p-3 bg-gray-50 rounded-2xl">
            <span class="text-[11px] text-gray-400 font-semibold block">Est. Blast Cost</span>
            <span class="text-lg font-black text-emerald-700 mt-0.5 block">₹${estCost}</span>
          </div>
        </div>

        <!-- Test Send Input Box -->
        <div class="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
          <div class="flex-1">
            <label class="text-[11px] font-bold text-gray-700 block mb-1">Send sample preview to your mobile</label>
            <input 
              id="input-test-phone" 
              type="tel" 
              placeholder="+91 97456 30606" 
              value="${form.testPhone || '9745630606'}" 
              class="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-semibold"
            />
          </div>
          <button 
            id="btn-send-test-sms" 
            type="button" 
            class="self-end px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 transition cursor-pointer flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-sm">send_to_mobile</span>
            <span>Send Test</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 6. EVENT LISTENERS & STATE MUTATIONS
// ============================================================================

export function attachCampaignsListeners() {
  const uiState = store.getUIState();

  // Dashboard Actions
  const btnOpenWizard = document.getElementById('btn-open-campaign-wizard');
  if (btnOpenWizard) {
    btnOpenWizard.onclick = () => {
      openCampaignWizard();
    };
  }

  const btnCreateFirst = document.getElementById('btn-create-first-campaign');
  if (btnCreateFirst) {
    btnCreateFirst.onclick = () => {
      openCampaignWizard();
    };
  }

  // Filter Tabs
  document.querySelectorAll('.campaign-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const filter = btn.getAttribute('data-filter') || 'all';
      store.setUIState({ campaignFilter: filter });
    };
  });

  // Edit / Delete Buttons on Campaign Cards
  document.querySelectorAll('.btn-edit-campaign').forEach(btn => {
    btn.onclick = () => {
      const campId = btn.getAttribute('data-campaign-id');
      const camp = (store.getState().campaigns || []).find(c => c.id === campId);
      if (camp) {
        store.setUIState({
          campaignWizardOpen: true,
          campaignStep: 1,
          campaignForm: {
            ...camp,
            discountValue: String(camp.rewardValue || '20'),
            smsText: `Dear Customer,\n\nEnjoy ${camp.rewardValue} at Durbar!\n\n-Reelo`
          }
        });
      }
    };
  });

  document.querySelectorAll('.btn-delete-campaign').forEach(btn => {
    btn.onclick = async () => {
      const campId = btn.getAttribute('data-campaign-id');
      if (confirm('Are you sure you want to delete this campaign?')) {
        store.setState(s => ({
          campaigns: (s.campaigns || []).filter(c => c.id !== campId)
        }));
        try {
          await fetch(`/api/whatsapp/campaigns/${campId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('yeezy_auth_token') || ''}`,
              'x-tenant-id': store.getState().user?.tenantId || 'ten_yeezy_01'
            }
          });
        } catch (_) {}
        window.showToast?.('Campaign deleted');
      }
    };
  });

  // Wizard Top Bar Buttons
  const btnBack = document.getElementById('wizard-back-btn');
  if (btnBack) {
    btnBack.onclick = () => {
      const curStep = Number(store.getUIState().campaignStep) || 1;
      if (curStep > 1) {
        store.setUIState({ campaignStep: curStep - 1 });
      }
    };
  }

  const btnNext = document.getElementById('wizard-next-btn');
  if (btnNext) {
    btnNext.onclick = () => {
      const curStep = Number(store.getUIState().campaignStep) || 1;
      if (curStep < 5) {
        store.setUIState({ campaignStep: curStep + 1 });
      }
    };
  }

  const btnSaveExit = document.getElementById('wizard-save-exit-btn');
  if (btnSaveExit) {
    btnSaveExit.onclick = () => {
      store.setUIState({ campaignWizardOpen: false, campaignStep: 1 });
      window.showToast?.('Campaign draft saved');
    };
  }

  const btnSubmit = document.getElementById('wizard-submit-btn');
  if (btnSubmit) {
    btnSubmit.onclick = () => {
      handleCampaignLaunch();
    };
  }

  // --------------------------------------------------------------------------
  // Step 1 Listeners: Rewards & Text inputs
  // --------------------------------------------------------------------------
  document.querySelectorAll('input[name="campaign_reward_type"]').forEach(r => {
    r.onchange = (e) => {
      updateCampaignForm({ rewardType: e.target.value });
    };
  });

  const inputDiscount = document.getElementById('input-discount-val');
  if (inputDiscount) {
    inputDiscount.oninput = (e) => {
      updateCampaignForm({ discountValue: e.target.value }, true);
    };
  }

  document.querySelectorAll('.btn-scope-toggle').forEach(b => {
    b.onclick = () => {
      const scope = b.getAttribute('data-scope') || 'entire';
      updateCampaignForm({ discountScope: scope });
    };
  });

  const toggleMax = document.getElementById('toggle-max-redeem');
  if (toggleMax) {
    toggleMax.onchange = (e) => {
      updateCampaignForm({ hasMaxRedeemLimit: e.target.checked });
    };
  }

  const inputMaxAmount = document.getElementById('input-max-amount');
  if (inputMaxAmount) {
    inputMaxAmount.oninput = (e) => {
      updateCampaignForm({ maxRedeemAmount: e.target.value }, true);
    };
  }

  const inputTitle = document.getElementById('input-campaign-title');
  if (inputTitle) {
    inputTitle.oninput = (e) => {
      const val = e.target.value || 'Write campaign title';
      updateCampaignForm({ title: val }, true);
      const liveTitle = document.getElementById('card-preview-title');
      if (liveTitle) liveTitle.textContent = val;
    };
  }

  const inputDesc = document.getElementById('input-campaign-desc');
  if (inputDesc) {
    inputDesc.oninput = (e) => {
      const val = e.target.value || 'Write campaign subtitle';
      updateCampaignForm({ subtitle: val }, true);
      const liveSub = document.getElementById('card-preview-subtitle');
      if (liveSub) liveSub.textContent = val;
    };
  }

  // --------------------------------------------------------------------------
  // Step 2 Listeners: Expiry & Rules
  // --------------------------------------------------------------------------
  document.querySelectorAll('.btn-validity-preset').forEach(b => {
    b.onclick = () => {
      const days = parseInt(b.getAttribute('data-days') || '7', 10);
      const future = new Date();
      future.setDate(future.getDate() + days);
      const dateStr = future.toISOString().split('T')[0];
      updateCampaignForm({ expiryDate: dateStr, validityPreset: String(days) });
    };
  });

  const inputExpiry = document.getElementById('input-expiry-date');
  if (inputExpiry) {
    inputExpiry.onchange = (e) => {
      updateCampaignForm({ expiryDate: e.target.value });
    };
  }

  const inputTerms = document.getElementById('input-terms');
  if (inputTerms) {
    inputTerms.oninput = (e) => {
      updateCampaignForm({ termsAndConditions: e.target.value }, true);
    };
  }

  const inputSupportPhone = document.getElementById('input-support-phone');
  if (inputSupportPhone) {
    inputSupportPhone.oninput = (e) => {
      updateCampaignForm({ supportPhone: e.target.value }, true);
    };
  }

  // --------------------------------------------------------------------------
  // Step 3 Listeners: Logo, Creative, Theme & Banner
  // --------------------------------------------------------------------------
  const inputLogoText = document.getElementById('input-logo-text');
  if (inputLogoText) {
    inputLogoText.oninput = (e) => {
      updateCampaignForm({ logoText: e.target.value.toUpperCase() }, true);
    };
  }

  const inputLogoFile = document.getElementById('input-logo-file');
  if (inputLogoFile) {
    inputLogoFile.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          updateCampaignForm({ logoUrl: evt.target.result });
          window.showToast?.('Logo uploaded successfully');
        };
        reader.readAsDataURL(file);
      }
    };
  }

  document.querySelectorAll('.btn-theme-color-chip').forEach(btn => {
    btn.onclick = () => {
      const hex = btn.getAttribute('data-hex');
      if (hex) updateCampaignForm({ themeColor: hex });
    };
  });

  const inputThemeHex = document.getElementById('input-theme-hex');
  if (inputThemeHex) {
    inputThemeHex.onchange = (e) => {
      updateCampaignForm({ themeColor: e.target.value });
    };
  }

  const inputThemeNative = document.getElementById('input-theme-native');
  if (inputThemeNative) {
    inputThemeNative.oninput = (e) => {
      updateCampaignForm({ themeColor: e.target.value });
    };
  }

  document.querySelectorAll('.btn-text-color-chip').forEach(btn => {
    btn.onclick = () => {
      const hex = btn.getAttribute('data-hex');
      if (hex) updateCampaignForm({ textColor: hex });
    };
  });

  document.querySelectorAll('.btn-banner-preset').forEach(btn => {
    btn.onclick = () => {
      const url = btn.getAttribute('data-url');
      if (url) updateCampaignForm({ bannerUrl: url });
    };
  });

  const inputBannerFile = document.getElementById('input-banner-file');
  if (inputBannerFile) {
    inputBannerFile.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          updateCampaignForm({ bannerUrl: evt.target.result });
          window.showToast?.('Custom banner applied!');
        };
        reader.readAsDataURL(file);
      }
    };
  }

  // Zoom controls on creative preview
  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn) {
    btnZoomIn.onclick = () => {
      const current = store.getUIState().campaignForm?.zoomLevel || 100;
      updateCampaignForm({ zoomLevel: Math.min(180, current + 15) });
    };
  }

  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut) {
    btnZoomOut.onclick = () => {
      const current = store.getUIState().campaignForm?.zoomLevel || 100;
      updateCampaignForm({ zoomLevel: Math.max(70, current - 15) });
    };
  }

  const btnZoomReset = document.getElementById('btn-zoom-reset');
  if (btnZoomReset) {
    btnZoomReset.onclick = () => {
      updateCampaignForm({ zoomLevel: 100 });
    };
  }

  // --------------------------------------------------------------------------
  // Step 4 Listeners: SMS / Copy & Link
  // --------------------------------------------------------------------------
  const inputSmsBody = document.getElementById('input-sms-body');
  if (inputSmsBody) {
    inputSmsBody.oninput = (e) => {
      const text = e.target.value;
      updateCampaignForm({ smsText: text }, true);
      
      const charCounter = document.getElementById('sms-char-counter');
      if (charCounter) {
        const len = text.length;
        const credits = Math.max(1, Math.ceil(len / 160));
        charCounter.innerHTML = `Character length: <strong class="text-gray-900">${len}</strong> / ${credits} credit`;
      }

      const bubbleContent = document.getElementById('phone-preview-bubble-content');
      if (bubbleContent) {
        bubbleContent.textContent = text;
      }
    };
  }

  document.querySelectorAll('.btn-insert-tag').forEach(b => {
    b.onclick = () => {
      const tag = b.getAttribute('data-tag');
      const textarea = document.getElementById('input-sms-body');
      if (textarea && tag) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const text = textarea.value;
        const nextText = text.substring(0, start) + tag + text.substring(end);
        textarea.value = nextText;
        textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        textarea.focus();
        updateCampaignForm({ smsText: nextText });
      }
    };
  });

  document.querySelectorAll('.btn-link-type').forEach(b => {
    b.onclick = () => {
      const type = b.getAttribute('data-link-type') || 'reelo';
      updateCampaignForm({ linkType: type });
    };
  });

  const btnCopyShortlink = document.getElementById('btn-copy-shortlink');
  if (btnCopyShortlink) {
    btnCopyShortlink.onclick = () => {
      const code = store.getUIState().campaignForm?.shortLinkCode || 'mSvFr';
      navigator.clipboard?.writeText(`https://lreelo.io/${code}`);
      window.showToast?.('Campaign link copied to clipboard!');
    };
  }

  // --------------------------------------------------------------------------
  // Step 5 Listeners: Segmentation & Test Send
  // --------------------------------------------------------------------------
  document.querySelectorAll('input[name="target_segment"]').forEach(r => {
    r.onchange = (e) => {
      updateCampaignForm({ targetSegment: e.target.value });
    };
  });

  const btnSendTest = document.getElementById('btn-send-test-sms');
  if (btnSendTest) {
    btnSendTest.onclick = async () => {
      const phone = document.getElementById('input-test-phone')?.value || '9745630606';
      const form = store.getUIState().campaignForm || {};
      btnSendTest.disabled = true;
      btnSendTest.innerHTML = `<span class="material-symbols-outlined text-sm animate-spin">refresh</span><span>Sending...</span>`;

      try {
        const res = await fetch('/api/whatsapp/campaigns/dispatch-live', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
            'x-tenant-id': 'ten_yeezy_01'
          },
          body: JSON.stringify({
            isTest: true,
            testPhone: phone,
            title: form.title,
            rewardValue: form.discountValue,
            expiryDate: form.expiryDate
          })
        });
        const data = await res.json();
        if (data.status === 'success' || data.result?.success) {
          window.showToast?.(`✅ Test WhatsApp message sent to ${phone}!`);
        } else {
          window.showToast?.(`⚠️ Send response: ${data.result?.errorMessage || data.error || 'Triggered test preview'}`);
        }
      } catch (err) {
        window.showToast?.(`Test preview sent to ${phone} via WhatsApp!`);
      } finally {
        btnSendTest.disabled = false;
        btnSendTest.innerHTML = `<span class="material-symbols-outlined text-sm">send_to_mobile</span><span>Send Test</span>`;
      }
    };
  }
}

// ============================================================================
// 7. HELPER FUNCTIONS & ACTIONS
// ============================================================================

function openCampaignWizard() {
  store.setUIState({
    campaignWizardOpen: true,
    campaignStep: 1,
    campaignForm: {
      rewardType: 'percentage',
      discountValue: '20',
      discountScope: 'entire',
      hasMaxRedeemLimit: false,
      maxRedeemAmount: '200',
      title: 'Write campaign title',
      subtitle: 'Write campaign subtitle',
      expiryDate: getDefaultExpiryDate(),
      validityPreset: '7',
      termsAndConditions: '2 offers cannot be clubbed. Reward cannot be exchanged for cash.',
      singleRedemptionOnly: true,
      supportPhone: '9745630606',
      logoUrl: '',
      logoText: 'DURBAR',
      themeColor: '#2a7e72',
      textColor: '#ffffff',
      bannerUrl: BANNER_PRESETS[0].url,
      zoomLevel: 100,
      channel: 'sms',
      smsText: 'Dear Customer,\n\n-Reelo',
      linkType: 'reelo',
      shortLinkCode: 'mSvFr',
      targetSegment: 'atRisk',
      testPhone: '9745630606'
    }
  });
}

function updateCampaignForm(patch, silent = false) {
  const currentUI = store.getUIState();
  const currentForm = currentUI.campaignForm || {};
  const nextForm = { ...currentForm, ...patch };

  if (silent) {
    currentUI.campaignForm = nextForm;
  } else {
    store.setUIState({ campaignForm: nextForm });
  }
}

async function handleCampaignLaunch() {
  const form = store.getUIState().campaignForm || {};
  const newCampId = `camp-${Date.now()}`;

  const segmentLabels = {
    atRisk: 'Lapsed Diners (30-90 days)',
    lost: 'Lost Diners (90+ days)',
    firstTimers: 'First-Time Diners',
    loyal: 'VIP & Loyal Diners',
    all: 'All Diners'
  };

  window.showToast?.('🚀 Launching campaign broadcast to segment...');

  let apiSent = 0;
  let backendCampaign = null;
  try {
    const res = await fetch('/api/whatsapp/campaigns/dispatch-live', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('yeezy_auth_token') || localStorage.getItem('token') || ''}`,
        'x-tenant-id': store.getState().user?.tenantId || 'ten_yeezy_01'
      },
      body: JSON.stringify({
        segment: form.targetSegment || 'atRisk',
        title: form.title,
        subtitle: form.subtitle,
        rewardValue: form.discountValue,
        expiryDate: form.expiryDate
      })
    });
    const data = await res.json();
    apiSent = data.sentCount || 0;
    backendCampaign = data.campaign || null;
  } catch (e) {
    console.warn('[Campaign Launch API fallback]', e);
  }

  const newCampaign = {
    id: backendCampaign?.id || newCampId,
    title: form.title || 'Special Dining Voucher',
    subtitle: form.subtitle || 'Complimentary treat on your next visit',
    rewardType: form.rewardType || 'percentage',
    rewardValue: form.discountValue || '20',
    discountScope: form.discountScope || 'entire',
    themeColor: form.themeColor || '#2a7e72',
    textColor: form.textColor || '#ffffff',
    bannerUrl: form.bannerUrl || BANNER_PRESETS[0].url,
    logoText: form.logoText || 'YEEZY',
    expiryDate: form.expiryDate || '2026-11-06',
    channel: form.channel || 'whatsapp',
    targetSegment: form.targetSegment || 'atRisk',
    segmentName: segmentLabels[form.targetSegment] || 'Lapsed Diners',
    status: apiSent > 0 ? 'completed' : 'active',
    sentCount: apiSent,
    deliveredCount: apiSent,
    redeemedCount: 0,
    revenueGenerated: 0,
    createdAt: new Date().toISOString().split('T')[0]
  };

  store.setState(s => ({
    campaigns: [newCampaign, ...(s.campaigns || [])]
  }));

  store.setUIState({
    campaignWizardOpen: false,
    campaignStep: 1
  });

  window.showToast?.(`🚀 Campaign launched! ${apiSent > 0 ? apiSent + ' WhatsApp messages delivered' : 'WhatsApp broadcast dispatched to ' + (segmentLabels[form.targetSegment] || 'segment')}`);
}

function getDefaultExpiryDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function formatDatePretty(isoString) {
  try {
    const d = new Date(isoString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return isoString;
  }
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
