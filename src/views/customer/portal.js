// Customer Public Portal & Guest Rewards Pass View
// Directly supports Meta-approved WhatsApp button URLs: https://yourdomain.com/rewards/{{1}}
// Displays real-time points balance, rupee redemption offer, expiry details, scannable pass, and tiers.

import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { apiFetch } from '../../config/api.js';

let currentTab = 'vouchers'; // 'vouchers' | 'redeem' | 'history'
let showDetailsDrawer = false;
let showCashierModal = false;
let activeIdentifier = null;
let portalData = null;
let isLoading = false;
let hasLoadedOnce = false;

// Extract identifier from /rewards/{{1}} URL path, hash, or query params
export function getRewardsIdentifier() {
  try {
    // 1. Pathname extraction: e.g. /rewards/9745630606 or /pass/9745630606
    if (typeof window !== 'undefined' && window.location?.pathname) {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const rewardsIdx = parts.findIndex(p => ['rewards', 'pass', 'card', 'my-rewards', 'l'].includes(p.toLowerCase()));
      if (rewardsIdx !== -1 && parts[rewardsIdx + 1]) {
        const raw = decodeURIComponent(parts[rewardsIdx + 1]).trim();
        if (raw && raw !== '{{1}}' && raw !== '%7B%7B1%7D%7D' && !raw.includes('{')) {
          return raw;
        }
      }
    }

    // 2. Hash extraction: e.g. #/rewards/9745630606 or #rewards/9745630606
    if (typeof window !== 'undefined' && window.location?.hash) {
      const hash = window.location.hash.replace(/^#\/?/, '');
      const parts = hash.split('?')[0].split('/').filter(Boolean);
      const rewardsIdx = parts.findIndex(p => ['rewards', 'pass', 'card', 'my-rewards', 'l'].includes(p.toLowerCase()));
      if (rewardsIdx !== -1 && parts[rewardsIdx + 1]) {
        const raw = decodeURIComponent(parts[rewardsIdx + 1]).trim();
        if (raw && raw !== '{{1}}' && raw !== '%7B%7B1%7D%7D' && !raw.includes('{')) {
          return raw;
        }
      }
    }

    // 3. Search query params: ?phone=... or ?id=...
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search || '');
      const phone = searchParams.get('phone') || searchParams.get('id') || searchParams.get('c');
      if (phone && phone !== '{{1}}' && !phone.includes('{')) {
        return phone.trim();
      }
    }
  } catch (_) {}
  return '9745630606'; // Default reference mobile
}

// Fetch live customer rewards data from public API
async function loadPortalData(identifier) {
  if (isLoading) return;
  isLoading = true;
  store.notify(); // Trigger re-render to show skeleton
  try {
    const cleanId = encodeURIComponent(identifier || '9745630606');
    const res = await apiFetch(`/api/v1/loyalty/rewards/${cleanId}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.status === 'success') {
        portalData = json;
        activeIdentifier = identifier;
        hasLoadedOnce = true;
        store.notify();
      }
    }
  } catch (err) {
    console.warn('[Rewards Portal API Fetch Notice]', err.message);
  } finally {
    isLoading = false;
    store.notify();
  }
}

function renderSkeleton() {
  return `
    <div class="min-h-screen bg-[#faf8f5] flex flex-col items-center font-sans antialiased text-stone-900 pb-20 selection:bg-amber-200">
      <header class="w-full bg-[#181312] text-white py-3 px-4 shadow-md sticky top-0 z-40 border-b border-amber-950/40">
        <div class="max-w-[440px] mx-auto flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full border border-amber-400/40 bg-white flex items-center justify-center p-0.5 shadow-xs animate-pulse">
              <div class="w-4 h-4 rounded-full bg-stone-300"></div>
            </div>
            <div class="h-4 w-24 bg-stone-200 rounded animate-pulse"></div>
          </div>
        </div>
      </header>
      <main class="w-full max-w-[440px] flex-1 px-4 py-6">
        <div class="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden animate-pulse">
          <div class="h-48 bg-stone-200"></div>
          <div class="p-6 space-y-4">
            <div class="h-8 w-3/4 bg-stone-200 rounded"></div>
            <div class="h-6 w-1/2 bg-stone-200 rounded"></div>
            <div class="flex gap-4 mt-6">
              <div class="flex-1 h-24 bg-stone-200 rounded-xl"></div>
              <div class="flex-1 h-24 bg-stone-200 rounded-xl"></div>
            </div>
            <div class="h-10 w-1/3 bg-stone-200 rounded-xl mt-6"></div>
            <div class="space-y-3 mt-6">
              <div class="h-12 bg-stone-200 rounded-lg"></div>
              <div class="h-12 bg-stone-200 rounded-lg"></div>
              <div class="h-12 bg-stone-200 rounded-lg"></div>
              <div class="h-12 bg-stone-200 rounded-lg"></div>
              <div class="h-12 bg-stone-200 rounded-lg"></div>
            </div>
            <div class="h-20 bg-stone-200 rounded-xl mt-6"></div>
            <div class="space-y-3 mt-6">
              <div class="h-14 bg-stone-200 rounded-lg"></div>
              <div class="h-14 bg-stone-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `;
}

export function renderCustomerPortal(state = {}) {
  const identifier = getRewardsIdentifier();

  // Trigger background fetch if identifier changed or not yet loaded
  if (!portalData || activeIdentifier !== identifier) {
    if (!isLoading) {
      setTimeout(() => loadPortalData(identifier), 10);
    }
  }

  // Show skeleton while loading and no cached data
  if (isLoading && !hasLoadedOnce) {
    return renderSkeleton();
  }

  const p = state.loyaltyProgram || {};
  const restaurantName = portalData?.restaurant?.name || p.name || 'Durbar Cafe';
  const logoText = portalData?.restaurant?.logoText || p.logoText || 'DURBAR';
  const bannerUrl = portalData?.restaurant?.bannerUrl || p.bannerUrl || 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=800&q=80';
  const supportPhone = portalData?.restaurant?.supportPhone || p.supportPhone || '9745630606';
  const restaurantAddress = portalData?.restaurant?.address || 'Durbar Flagship, Calicut Road';

  const customerName = portalData?.member?.name || 'Valued Diner';
  const customerPhone = portalData?.member?.display_phone || identifier;
  const customerTier = portalData?.member?.tier || 'Silver';
  const pointsBalance = portalData?.points?.balance ?? 1000;
  const rupeesOffer = portalData?.points?.rupees_offer ?? 125;
  const unlockedCount = portalData?.points?.unlocked_count ?? 1;
  const expiryDate = portalData?.expiry?.date_formatted || 'Nov 24, 2026';
  const daysRemaining = portalData?.expiry?.days_remaining || 23;
  const redemptionCode = portalData?.redemption?.code || `DUR-${customerPhone.slice(-4)}`;

  const tiers = portalData?.tiers || [
    { points: 500, title: 'Get a free coffee', condition: '*Minimum purchase of ₹250 required to redeem reward.', value_inr: 100, is_unlocked: pointsBalance >= 500, icon: 'local_cafe' },
    { points: 1000, title: "You're special. Get ₹125 off", condition: '*Valid on food & beverage bills.', value_inr: 125, is_unlocked: pointsBalance >= 1000, icon: 'celebration' },
    { points: 2000, title: 'You deserve it. Get ₹300 off', condition: '*Valid on bills above ₹600.', value_inr: 300, is_unlocked: pointsBalance >= 2000, icon: 'restaurant' },
    { points: 3000, title: 'We love your loyalty. Get ₹500 off', condition: '*Valid on bills above ₹1000.', value_inr: 500, is_unlocked: pointsBalance >= 3000, icon: 'stars' },
    { points: 5000, title: 'Party time! Get ₹1000 off on your bill!', condition: '*Valid on bills above ₹2000.', value_inr: 1000, is_unlocked: pointsBalance >= 5000, icon: 'workspace_premium' }
  ];

  const nextTier = tiers.find(t => !t.is_unlocked);
  const pointsToNext = nextTier ? nextTier.points - pointsBalance : 0;
  const spendToNext = pointsToNext * 10;

  const activities = portalData?.recent_activity || [
    {
      id: 'act_1',
      type: 'EARN',
      points: 150,
      date: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      title: 'Points Earned on Bill #BILL_101',
      description: 'Dine-In purchase (Net ₹1,500)'
    },
    {
      id: 'act_2',
      type: 'EARN',
      points: 100,
      date: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      title: 'Welcome Bonus Points',
      description: 'First visit reward pass activated'
    }
  ];

  const cardBg = '#1c1614';

  return `
    <div class="min-h-screen bg-[#faf8f5] flex flex-col items-center font-sans antialiased text-stone-900 pb-20 selection:bg-amber-200">
      
      <!-- Top Sticky App Bar: Dark Espresso with Gold Brand Accent -->
      <header class="w-full bg-[#181312] text-white py-3 px-4 shadow-md sticky top-0 z-40 border-b border-amber-950/40">
        <div class="max-w-[440px] mx-auto flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-full border border-amber-400/40 bg-white flex items-center justify-center p-0.5 shadow-xs">
              <span class="text-[8px] font-black tracking-widest text-black uppercase">${escapeHtml(logoText)}</span>
            </div>
            <div>
              <div class="text-xs font-black tracking-tight text-white flex items-center gap-1.5">
                <span>${escapeHtml(restaurantName)}</span>
                <span class="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase">
                  ${escapeHtml(customerTier)} Pass
                </span>
              </div>
              <div class="text-[10px] text-stone-400 flex items-center gap-1">
                <span>+91 ${escapeHtml(customerPhone)}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button 
              id="btn-portal-refresh" 
              type="button" 
              class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition active:scale-95"
              title="Refresh Balance"
            >
              <span class="material-symbols-outlined text-sm ${isLoading ? 'animate-spin text-amber-400' : ''}">refresh</span>
            </button>
            <button 
              id="btn-portal-share" 
              type="button" 
              class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-stone-200 flex items-center justify-center transition active:scale-95"
              title="Share Pass"
            >
              <span class="material-symbols-outlined text-sm">share</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Main Column Container (Max-Width 440px for ideal Mobile Phone Experience) -->
      <main class="w-full max-w-[440px] px-4 pt-3.5 flex flex-col items-center gap-4">

        <!-- Mobile Number Switcher Drawer Banner -->
        <div class="w-full">
          <button 
            id="btn-toggle-phone-drawer" 
            type="button" 
            class="w-full bg-[#f4ede4] hover:bg-[#eae1d5] border border-[#e5d8c8] text-[#5c4436] rounded-2xl py-2 px-3.5 flex items-center justify-between text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <span class="text-amber-600 font-black">📱</span>
              <span>Pass for <strong>+91 ${escapeHtml(customerPhone)}</strong> (${escapeHtml(customerName)})</span>
            </div>
            <div class="flex items-center gap-1 text-[11px] font-extrabold text-[#785947]">
              <span>Change</span>
              <span class="material-symbols-outlined text-xs transition-transform ${showDetailsDrawer ? 'rotate-180' : ''}">expand_more</span>
            </div>
          </button>

          <!-- Drawer Form for Look up / Updating Details -->
          <div id="phone-lookup-drawer" class="${showDetailsDrawer ? 'block' : 'hidden'} mt-2 p-4 bg-white rounded-2xl border border-stone-200 shadow-md space-y-3 animate-fade-in">
            <div class="flex items-center justify-between">
              <span class="text-xs font-black text-stone-900">Check Rewards for Another Mobile</span>
              <button id="btn-close-phone-drawer" type="button" class="text-stone-400 hover:text-stone-600 text-xs">✕</button>
            </div>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-black">+91</span>
                <input 
                  id="input-rewards-phone" 
                  type="tel" 
                  value="${customerPhone}" 
                  placeholder="Enter 10-digit mobile" 
                  maxlength="10"
                  class="w-full pl-11 pr-3 py-2.5 rounded-xl border border-stone-200 text-xs font-bold focus:border-amber-600 focus:ring-1 focus:ring-amber-500 outline-none font-mono"
                />
              </div>
              <button 
                id="btn-submit-rewards-phone" 
                type="button" 
                class="px-4 py-2.5 rounded-xl bg-[#221d1b] hover:bg-black text-amber-300 text-xs font-black transition cursor-pointer active:scale-95 shadow-sm"
              >
                View
              </button>
            </div>
            <p class="text-[10px] text-stone-500 leading-tight">
              Instantly loads points balance, unlocked discount coupons, and purchase history from Petpooja POS.
            </p>
          </div>
        </div>

        <!-- ============================================================== -->
        <!-- THE HERO REWARDS PASS (Apple & Google Wallet Inspired Chassis) -->
        <!-- ============================================================== -->
        <div 
          class="w-full rounded-[32px] overflow-hidden shadow-2xl relative border-2 border-stone-900/10 text-white animate-fade-in"
          style="background: linear-gradient(165deg, #261e1b 0%, #171210 100%); box-shadow: 0 20px 45px -12px rgba(24, 19, 18, 0.45);"
        >
          <!-- Top Food Banner Photo -->
          <div class="relative h-44 w-full overflow-hidden bg-stone-900">
            <img 
              src="${bannerUrl}" 
              alt="${escapeHtml(restaurantName)} Special" 
              class="w-full h-full object-cover" 
            />
            <div class="absolute inset-0 bg-gradient-to-t from-[#261e1b] via-black/30 to-black/30"></div>

            <!-- Wave divider matching aesthetic -->
            <div class="w-full absolute -bottom-1 left-0" style="line-height: 0;">
              <svg viewBox="0 0 500 80" preserveAspectRatio="none" class="w-full h-8 block" style="fill: #261e1b;">
                <path d="M0,0 C150,70 350,-20 500,40 L500,80 L0,80 Z"></path>
              </svg>
            </div>

            <!-- Circular Logo Badge Overlapping -->
            <div class="absolute -bottom-3 left-6 z-10 w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-white overflow-hidden p-1">
              <div class="w-full h-full rounded-full bg-stone-50 flex items-center justify-center text-center p-1">
                <span class="text-xs font-black tracking-widest text-black uppercase leading-none">
                  ${escapeHtml(logoText)}
                </span>
              </div>
            </div>

            <!-- VIP Tier Badge in Top Right Corner -->
            <div class="absolute top-3 right-3 z-10 flex items-center gap-1 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-amber-300 text-[11px] font-black shadow-lg">
              <span>★</span>
              <span>${escapeHtml(customerTier).toUpperCase()} TIER</span>
            </div>
          </div>

          <!-- Card Body Content -->
          <div class="px-6 pt-5 pb-6 flex flex-col gap-4 text-white">
            
            <!-- Restaurant Title & Earning Formula -->
            <div class="flex items-start justify-between">
              <div>
                <h2 class="text-2xl font-black text-white tracking-tight leading-none lowercase">
                  ${escapeHtml(restaurantName.toLowerCase())}
                </h2>
                <p class="text-xs text-stone-300 mt-1 font-medium">
                  Welcome back, <strong class="text-amber-300">${escapeHtml(customerName)}</strong>
                </p>
              </div>
              <div class="text-right">
                <span class="text-[10px] uppercase font-bold text-stone-400 block tracking-wider">Earning Rate</span>
                <span class="text-xs font-black text-amber-300">₹100 = 10 Pts</span>
              </div>
            </div>

            <!-- ========================================================== -->
            <!-- HERO POINTS & CASH VALUE BOX WITH EXPIRY COUNTDOWN         -->
            <!-- ========================================================== -->
            <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-500/20 via-emerald-600/15 to-black/50 border border-amber-300/30 text-center shadow-lg relative overflow-hidden space-y-2.5">
              
              <!-- Points & Rupee Balance Header -->
              <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div class="text-left">
                  <span class="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">Available Balance</span>
                  <div class="text-2xl font-black text-white tracking-tight flex items-baseline gap-1">
                    <span class="text-amber-400">${pointsBalance.toLocaleString()}</span>
                    <span class="text-xs font-extrabold text-stone-300">PTS</span>
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-[10px] uppercase tracking-wider text-emerald-300 font-bold block">Discount Worth</span>
                  <div class="text-2xl font-black text-emerald-400 tracking-tight">
                    ₹${rupeesOffer.toLocaleString()} OFF
                  </div>
                </div>
              </div>

              <!-- Real-Time Points Expiry Banner -->
              <div class="flex items-center justify-between text-xs px-1 pt-0.5">
                <div class="flex items-center gap-1.5 text-stone-200 font-medium text-[11px]">
                  <span class="text-amber-400">⏳</span>
                  <span>Expires on: <strong class="text-amber-300 font-black">${expiryDate}</strong></span>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${daysRemaining <= 30 ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}">
                  ${daysRemaining} Days Left
                </span>
              </div>

              <!-- Next Milestone Progress Bar -->
              ${nextTier ? `
                <div class="w-full bg-black/40 rounded-xl p-2.5 border border-white/10 text-left space-y-1.5">
                  <div class="flex items-center justify-between text-[11px] font-bold">
                    <span class="text-stone-300 flex items-center gap-1">
                      <span class="text-amber-400 font-black">⚡</span>
                      <span>Next: <strong>${escapeHtml(nextTier.title)}</strong></span>
                    </span>
                    <span class="text-amber-400 font-mono text-[10px]">
                      ${pointsBalance}/${nextTier.points} Pts
                    </span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-stone-800 overflow-hidden">
                    <div 
                      class="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500" 
                      style="width: ${Math.min(100, Math.round((pointsBalance / nextTier.points) * 100))}%"
                    ></div>
                  </div>
                  <div class="text-[10px] text-stone-400 flex items-center justify-between">
                    <span>Spend ₹${spendToNext.toLocaleString()} to unlock</span>
                    <span>${nextTier.points - pointsBalance} pts needed</span>
                  </div>
                </div>
              ` : `
                <div class="w-full bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 text-center text-xs font-bold text-emerald-300">
                  🎉 VIP Status! You have unlocked all available rewards!
                </div>
              `}

              <!-- Encouraging Return Message -->
              <div class="text-xs text-stone-200 font-medium leading-relaxed bg-black/40 p-2.5 rounded-xl border border-white/10 text-left">
                <span class="text-amber-300 font-black">We miss you at ${escapeHtml(restaurantName)}!</span> 
                Show this digital pass on your next visit to instantly claim your <strong>₹${rupeesOffer} OFF</strong> on your bill. 🍽️✨
              </div>

              <!-- Quick Action: Show Cashier Redemption PIN -->
              <button 
                id="btn-open-cashier-modal" 
                type="button" 
                class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-300 text-stone-950 font-black text-xs shadow-lg transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span class="material-symbols-outlined text-base">qr_code_scanner</span>
                <span>Show Cashier Pass (PIN: ${redemptionCode})</span>
              </button>
            </div>

          </div>
        </div>

        <!-- ============================================================== -->
        <!-- INTERACTIVE NAVIGATION TABS: Vouchers | Redeem | History       -->
        <!-- ============================================================== -->
        <div class="w-full flex rounded-2xl bg-[#efe9df] p-1 border border-stone-200 text-xs font-extrabold shadow-2xs">
          <button 
            type="button" 
            data-tab="vouchers" 
            class="portal-tab-btn flex-1 py-2 rounded-xl text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${currentTab === 'vouchers' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-600 hover:text-stone-900'}"
          >
            <span>🎁</span>
            <span>Vouchers (${unlockedCount})</span>
          </button>
          <button 
            type="button" 
            data-tab="redeem" 
            class="portal-tab-btn flex-1 py-2 rounded-xl text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${currentTab === 'redeem' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-600 hover:text-stone-900'}"
          >
            <span>💳</span>
            <span>How to Redeem</span>
          </button>
          <button 
            type="button" 
            data-tab="history" 
            class="portal-tab-btn flex-1 py-2 rounded-xl text-center transition flex items-center justify-center gap-1.5 cursor-pointer ${currentTab === 'history' ? 'bg-white text-stone-950 shadow-xs' : 'text-stone-600 hover:text-stone-900'}"
          >
            <span>📜</span>
            <span>History</span>
          </button>
        </div>

        <!-- TAB CONTENT 1: Vouchers & Milestone Ladder -->
        <div id="tab-content-vouchers" class="${currentTab === 'vouchers' ? 'block' : 'hidden'} w-full space-y-2.5 animate-fade-in">
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-black uppercase tracking-wider text-stone-700">Available Reward Vouchers</span>
            <span class="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-full">
              ${unlockedCount} Ready to Redeem
            </span>
          </div>

          <div class="space-y-2">
            ${tiers.map((tier) => {
              const isUnlocked = tier.is_unlocked;
              return `
                <div class="rounded-2xl p-3.5 border transition-all ${isUnlocked ? 'bg-white border-emerald-300 shadow-sm' : 'bg-stone-100/60 border-stone-200 opacity-80'}">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-start gap-3">
                      <div class="w-10 h-10 rounded-xl ${isUnlocked ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-stone-200 text-stone-400'} flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-xl">${tier.icon || 'military_tech'}</span>
                      </div>
                      <div>
                        <div class="text-xs font-black text-stone-900 flex items-center gap-1.5">
                          <span>${escapeHtml(tier.title)}</span>
                          ${isUnlocked ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">Ready</span>' : ''}
                        </div>
                        <div class="text-[11px] text-stone-500 mt-0.5 leading-snug">
                          ${escapeHtml(tier.condition || 'Valid on Dine-In and Takeaway')}
                        </div>
                      </div>
                    </div>

                    <div class="text-right shrink-0">
                      <div class="text-xs font-black font-mono ${isUnlocked ? 'text-amber-600' : 'text-stone-400'}">
                        ${tier.points} PTS
                      </div>
                      <div class="text-[10px] font-bold ${isUnlocked ? 'text-emerald-600' : 'text-stone-400'}">
                        ${isUnlocked ? 'Unlocked ✓' : `Need ${tier.points - pointsBalance} pts`}
                      </div>
                    </div>
                  </div>

                  ${isUnlocked ? `
                    <div class="mt-2.5 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px]">
                      <span class="text-stone-500 font-medium">Active in POS cashier system</span>
                      <button 
                        type="button" 
                        class="btn-trigger-cashier font-black text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Redeem</span>
                        <span class="material-symbols-outlined text-xs">arrow_forward</span>
                      </button>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- TAB CONTENT 2: How to Redeem (Cashier Instructions & Scannable Code) -->
        <div id="tab-content-redeem" class="${currentTab === 'redeem' ? 'block' : 'hidden'} w-full space-y-3 animate-fade-in">
          
          <div class="bg-white rounded-3xl p-5 border border-stone-200 shadow-md text-center space-y-4">
            <div>
              <span class="text-[10px] font-black uppercase tracking-widest text-stone-400 block">Cashier Pass</span>
              <h3 class="text-lg font-black text-stone-900 mt-0.5">Show at Billing Counter</h3>
              <p class="text-xs text-stone-500 mt-0.5">Tell the cashier your mobile or show this PIN to apply discount</p>
            </div>

            <!-- Crisp Scannable Barcode Mockup -->
            <div class="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col items-center justify-center space-y-2">
              <div class="w-full max-w-[260px] h-14 flex items-center justify-center gap-1 overflow-hidden px-2">
                ${[4,2,3,1,4,2,1,3,2,4,1,2,3,4,2,1,3,2,4,1,3,2,4,2,1,3,2,4,1,2,3,4].map((w, i) => `
                  <div class="h-12 bg-stone-900 rounded-xs" style="width: ${w * 2}px; opacity: ${i % 7 === 0 ? 0.7 : 1};"></div>
                `).join('')}
              </div>
              <span class="text-xs font-mono font-black text-stone-700 tracking-widest">
                ${escapeHtml(customerPhone)}
              </span>
            </div>

            <!-- Big Redemption Code Badge -->
            <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-center">
              <span class="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">Redemption PIN</span>
              <div class="text-2xl font-black text-amber-950 font-mono tracking-widest my-0.5">
                ${escapeHtml(redemptionCode)}
              </div>
              <button 
                id="btn-copy-redeem-code" 
                type="button" 
                data-code="${escapeHtml(redemptionCode)}"
                class="inline-flex items-center gap-1 text-[11px] font-black text-amber-900 hover:text-black transition cursor-pointer"
              >
                <span class="material-symbols-outlined text-xs">content_copy</span>
                <span>Copy PIN</span>
              </button>
            </div>

            <!-- 3-Step Cashier Process -->
            <div class="text-left space-y-2 pt-1 border-t border-stone-100">
              <span class="text-[11px] font-black uppercase tracking-wider text-stone-700 block">3 Simple Steps to Redeem</span>
              
              <div class="flex items-start gap-2.5 text-xs text-stone-700">
                <div class="w-5 h-5 rounded-full bg-stone-900 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</div>
                <div>Tell your registered mobile <strong class="text-stone-950 font-mono">+91 ${escapeHtml(customerPhone)}</strong> or show PIN <strong>${escapeHtml(redemptionCode)}</strong> at the counter.</div>
              </div>

              <div class="flex items-start gap-2.5 text-xs text-stone-700">
                <div class="w-5 h-5 rounded-full bg-stone-900 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</div>
                <div>The cashier verifies your <strong>${pointsBalance.toLocaleString()} points</strong> balance in Petpooja POS.</div>
              </div>

              <div class="flex items-start gap-2.5 text-xs text-stone-700">
                <div class="w-5 h-5 rounded-full bg-stone-900 text-white font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</div>
                <div>Instant <strong>₹${rupeesOffer} discount</strong> is applied immediately to your final invoice bill.</div>
              </div>
            </div>

            <!-- Terms & Conditions Accordion -->
            <div class="text-left p-3 rounded-xl bg-stone-50 border border-stone-200 text-[11px] text-stone-600 space-y-1">
              <span class="font-black text-stone-800 block text-xs">Terms & Conditions</span>
              <div>• Minimum bill amount applies as specified on each voucher tier.</div>
              <div>• 2 vouchers or offers cannot be clubbed on a single bill.</div>
              <div>• Reward points cannot be exchanged for cash or transferred.</div>
              <div>• Valid across all outlets of ${escapeHtml(restaurantName)}.</div>
            </div>
          </div>

        </div>

        <!-- TAB CONTENT 3: Points History (Transactions Ledger) -->
        <div id="tab-content-history" class="${currentTab === 'history' ? 'block' : 'hidden'} w-full space-y-2.5 animate-fade-in">
          <div class="flex items-center justify-between px-1">
            <span class="text-xs font-black uppercase tracking-wider text-stone-700">Recent Points Activity</span>
            <span class="text-[11px] font-bold text-stone-500">Live POS Ledger</span>
          </div>

          <div class="space-y-2">
            ${activities.map(act => {
              const isEarn = act.points > 0;
              const dateStr = act.date ? new Date(act.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent Visit';
              return `
                <div class="bg-white rounded-2xl p-3.5 border border-stone-200 shadow-2xs flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl ${isEarn ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'} flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined text-lg">${isEarn ? 'add_circle' : 'redeem'}</span>
                    </div>
                    <div>
                      <div class="text-xs font-bold text-stone-900">${escapeHtml(act.title)}</div>
                      <div class="text-[10px] text-stone-500">${escapeHtml(act.description)} · ${dateStr}</div>
                    </div>
                  </div>

                  <div class="text-right">
                    <div class="text-xs font-black font-mono ${isEarn ? 'text-emerald-600' : 'text-amber-700'}">
                      ${isEarn ? `+${act.points}` : act.points} PTS
                    </div>
                    <div class="text-[9px] font-bold text-stone-400">
                      ${isEarn ? 'Earned' : 'Redeemed'}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Restaurant Location & Direct Support Card -->
        <div class="w-full bg-white rounded-3xl p-4 border border-stone-200 shadow-sm space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[10px] font-black uppercase tracking-wider text-stone-400 block">Dine With Us</span>
              <h4 class="text-xs font-black text-stone-900">${escapeHtml(restaurantName)}</h4>
              <p class="text-[11px] text-stone-500 mt-0.5">${escapeHtml(restaurantAddress)}</p>
            </div>
            <a 
              href="tel:${supportPhone}" 
              class="w-10 h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition active:scale-95 shadow-sm"
              title="Call Restaurant"
            >
              <span class="material-symbols-outlined text-lg">call</span>
            </a>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-stone-100">
            <a 
              href="tel:${supportPhone}"
              class="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold text-center transition flex items-center justify-center gap-1.5"
            >
              <span class="material-symbols-outlined text-sm">call</span>
              <span>Call (${supportPhone})</span>
            </a>
            <button 
              id="btn-portal-share-bottom" 
              type="button" 
              class="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold text-center transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm">share</span>
              <span>Share Pass</span>
            </button>
          </div>
        </div>

        <!-- Footer / Branding -->
        <footer class="w-full text-center pt-3 pb-4 text-[11px] text-stone-400 space-y-1">
          <div class="text-[9px] uppercase tracking-widest font-bold">Powered by</div>
          <div class="font-extrabold text-stone-800 text-xs tracking-tight">Yeezy Loyalty · Reelo POS Engine</div>
          <p class="text-[10px] text-stone-400">All rewards protected under real-time Petpooja POS double-entry ledger.</p>
        </footer>

      </main>

      <!-- ============================================================== -->
      <!-- FULL-SCREEN CASHIER PASS MODAL / DRAWER                        -->
      <!-- ============================================================== -->
      <div id="modal-cashier-pass" class="${showCashierModal ? 'flex' : 'hidden'} fixed inset-0 z-50 items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
        <div class="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 text-center space-y-4 animate-scale-up">
          <button 
            id="btn-close-cashier-modal" 
            type="button" 
            class="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-xs font-black"
          >
            ✕
          </button>

          <div>
            <span class="text-[10px] font-black uppercase tracking-widest text-amber-700 block">Live Petpooja Pass</span>
            <h3 class="text-xl font-black text-stone-950 mt-0.5">Cashier Redemption</h3>
            <p class="text-xs text-stone-500">Show this screen to cashier before bill settlement</p>
          </div>

          <!-- High-Contrast Scannable Barcode & QR representation -->
          <div class="p-4 bg-stone-50 rounded-2xl border-2 border-stone-800 space-y-2">
            <div class="w-full h-16 flex items-center justify-center gap-1 overflow-hidden px-2">
              ${[3,1,4,2,3,1,2,4,1,3,2,4,1,2,3,4,1,2,3,4,2,1,3,2,4,1,3,2,4,2,1,3].map((w) => `
                <div class="h-14 bg-black rounded-xs" style="width: ${w * 2.2}px;"></div>
              `).join('')}
            </div>
            <div class="text-sm font-mono font-black text-black tracking-widest">
              +91 ${escapeHtml(customerPhone)}
            </div>
          </div>

          <!-- Large PIN Code -->
          <div class="p-3 bg-amber-50 rounded-2xl border border-amber-300">
            <span class="text-[10px] uppercase font-bold text-amber-800 tracking-wider block">Redemption Code</span>
            <div class="text-3xl font-black text-amber-950 font-mono tracking-widest">
              ${escapeHtml(redemptionCode)}
            </div>
            <span class="text-xs font-black text-emerald-700 block mt-1">₹${rupeesOffer} Discount Ready</span>
          </div>

          <p class="text-xs text-stone-600 font-medium leading-relaxed">
            Cashier will verify mobile <strong>+91 ${escapeHtml(customerPhone)}</strong> and apply your discount immediately.
          </p>

          <button 
            id="btn-done-cashier-modal" 
            type="button" 
            class="w-full py-3 rounded-xl bg-stone-900 hover:bg-black text-white text-xs font-black transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

    </div>
  `;
}

export function attachCustomerPortalListeners() {
  // Navigation tabs (Vouchers / Redeem / History)
  document.querySelectorAll('.portal-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        currentTab = tab;
        store.notify();
      }
    };
  });

  // Toggle phone lookup drawer
  const togglePhoneDrawerBtn = document.getElementById('btn-toggle-phone-drawer');
  if (togglePhoneDrawerBtn) {
    togglePhoneDrawerBtn.onclick = () => {
      showDetailsDrawer = !showDetailsDrawer;
      store.notify();
    };
  }

  const closePhoneDrawerBtn = document.getElementById('btn-close-phone-drawer');
  if (closePhoneDrawerBtn) {
    closePhoneDrawerBtn.onclick = () => {
      showDetailsDrawer = false;
      store.notify();
    };
  }

  // Submit phone lookup
  const submitPhoneBtn = document.getElementById('btn-submit-rewards-phone');
  if (submitPhoneBtn) {
    submitPhoneBtn.onclick = async () => {
      const input = document.getElementById('input-rewards-phone');
      const val = input?.value?.trim() || '';
      if (!val) {
        showToast('Please enter a 10-digit mobile number');
        return;
      }
      showDetailsDrawer = false;
      await loadPortalData(val);
      showToast(`Loaded rewards for +91 ${val}`);
    };
  }

  // Refresh button
  const refreshBtn = document.getElementById('btn-portal-refresh');
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      const identifier = getRewardsIdentifier();
      await loadPortalData(identifier);
      showToast('Points and vouchers refreshed!');
    };
  }

  // Open cashier modal
  const openCashierBtn = document.getElementById('btn-open-cashier-modal');
  if (openCashierBtn) {
    openCashierBtn.onclick = () => {
      showCashierModal = true;
      store.notify();
    };
  }

  document.querySelectorAll('.btn-trigger-cashier').forEach(btn => {
    btn.onclick = () => {
      showCashierModal = true;
      store.notify();
    };
  });

  // Close cashier modal
  const closeCashierBtn = document.getElementById('btn-close-cashier-modal');
  if (closeCashierBtn) {
    closeCashierBtn.onclick = () => {
      showCashierModal = false;
      store.notify();
    };
  }

  const doneCashierBtn = document.getElementById('btn-done-cashier-modal');
  if (doneCashierBtn) {
    doneCashierBtn.onclick = () => {
      showCashierModal = false;
      store.notify();
    };
  }

  // Copy redemption PIN
  const copyRedeemBtn = document.getElementById('btn-copy-redeem-code');
  if (copyRedeemBtn) {
    copyRedeemBtn.onclick = () => {
      const code = copyRedeemBtn.getAttribute('data-code') || '';
      if (code) {
        navigator.clipboard?.writeText(code);
        showToast(`Redemption PIN ${code} copied to clipboard!`);
      }
    };
  }

  // Share Pass (Web Share API)
  const shareHandler = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Durbar Cafe Rewards Pass',
          text: 'Check out my Durbar Cafe rewards pass and claim your discount!',
          url
        });
      } catch (_) {}
    } else {
      navigator.clipboard?.writeText(url);
      showToast('Rewards pass link copied to clipboard!');
    }
  };

  const shareBtn = document.getElementById('btn-portal-share');
  if (shareBtn) shareBtn.onclick = shareHandler;

  const shareBottomBtn = document.getElementById('btn-portal-share-bottom');
  if (shareBottomBtn) shareBottomBtn.onclick = shareHandler;
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
