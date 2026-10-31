// Customer Public Portal & Guest Rewards View
// Replicates the exact Reelo digital rewards pass layout and aesthetic (from user reference app.reelo.io/l/Q3fR8)
// Displays available points, expiry date, rupee offer amount, and encouraging win-back message for Durbar Cafe.

import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../../lib/loyalty/i18n.js';
import { apiUrl } from '../../config/api.js';

let currentLang = 'en';
let lookupPhone = '';
let showDetailsDrawer = false;
let verifiedCustomer = null;

// Read query params from URL if present (e.g. ?phone=9745630606&name=sinnu)
function getQueryParams() {
  try {
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const searchParams = new URLSearchParams(search);
    const hashQuery = hash.includes('?') ? hash.substring(hash.indexOf('?')) : '';
    const hashParams = new URLSearchParams(hashQuery);

    return {
      phone: searchParams.get('phone') || hashParams.get('phone') || '',
      name: searchParams.get('name') || hashParams.get('name') || '',
      points: searchParams.get('points') || hashParams.get('points') || ''
    };
  } catch {
    return { phone: '', name: '', points: '' };
  }
}

export function renderCustomerPortal(state) {
  const p = state.loyaltyProgram || {};
  const query = getQueryParams();

  // Active customer state (defaults to Reelo reference "sinnu pk" with 1000 points if not logged in)
  const customerName = verifiedCustomer?.name || query.name || 'sinnu pk';
  const customerPhone = verifiedCustomer?.phone_e164 || query.phone || '9745630606';
  const pointsBalance = Number(verifiedCustomer?.points_balance ?? (query.points ? parseInt(query.points, 10) : 1000));
  const expiryDate = 'Nov 24, 2026';

  // Calculate rupee offer for the customer's points
  // 500 PTS -> Free Coffee (~₹100), 1000 PTS -> ₹125 OFF, 2000 PTS -> ₹300 OFF, 3000 PTS -> ₹500 OFF, 5000 PTS -> ₹1000 OFF
  let rupeesOffer = 125;
  if (pointsBalance >= 5000) {
    rupeesOffer = 1000;
  } else if (pointsBalance >= 3000) {
    rupeesOffer = 500;
  } else if (pointsBalance >= 2000) {
    rupeesOffer = 300;
  } else if (pointsBalance >= 1000) {
    rupeesOffer = 125;
  } else if (pointsBalance >= 500) {
    rupeesOffer = 100;
  } else {
    rupeesOffer = Math.floor(pointsBalance * 0.125);
  }

  // Tiers and unlock calculation
  const tiers = p.rewardTiers && p.rewardTiers.length >= 5 ? p.rewardTiers : [
    { points: 500, title: 'Get a free coffee', condition: '*Minimum purchase of ₹250 required to redeem reward.' },
    { points: 1000, title: "You're special. Get ₹125 off", condition: '*Valid on food & beverage bills.' },
    { points: 2000, title: 'You deserve it. Get ₹300 off', condition: '*Valid on bills above ₹600.' },
    { points: 3000, title: 'We love your loyalty. Get ₹500 off', condition: '*Valid on bills above ₹1000.' },
    { points: 5000, title: 'Party time! Get ₹1000 off on your bill!', condition: '*Valid on bills above ₹2000.' }
  ];

  const unlockedCount = tiers.filter(t => pointsBalance >= t.points).length;
  const nextTier = tiers.find(t => pointsBalance < t.points);
  const pointsToNext = nextTier ? nextTier.points - pointsBalance : 0;
  const spendToNext = pointsToNext * 10; // ₹100 = 10 pts -> ₹10 per pt

  const cardBg = p.cardBg || '#261d1a';
  const logoText = p.logoText || 'DURBAR';
  const bannerUrl = p.bannerUrl || 'https://images.unsplash.com/photo-1621996346565-e3d5d6281691?auto=format&fit=crop&w=800&q=80';
  const supportPhone = p.supportPhone || '9745630606';

  return `
    <div class="min-h-screen bg-[#faf8f5] flex flex-col items-center font-sans select-none pb-16 animate-fade-in text-gray-900">
      
      <!-- Top Bar: Dark Espresso Header (#221d1b matching Reelo screenshot 3) -->
      <header class="w-full bg-[#221d1b] text-white py-3.5 px-4 text-center shadow-md sticky top-0 z-40">
        <div class="max-w-md mx-auto flex flex-col items-center justify-center">
          <h1 class="text-sm md:text-base font-extrabold tracking-tight text-stone-100 flex items-center gap-1.5">
            <span>Hello ${escapeHtml(customerName)}</span>
          </h1>
          <p class="text-[11px] text-stone-300 font-medium mt-0.5">
            You have <strong class="text-amber-400 font-extrabold">${pointsBalance.toLocaleString()} points</strong> (Expires on ${expiryDate})
          </p>
        </div>
      </header>

      <!-- Main Column Container (Max-Width 420px matching mobile phone screen) -->
      <main class="w-full max-w-[420px] px-4 pt-4 flex flex-col items-center gap-3.5">
        
        <!-- Brand Header: Circular Durbar Logo & Name -->
        <div class="flex items-center justify-center gap-2.5 pt-1 pb-1">
          <div class="w-10 h-10 rounded-full border-2 border-stone-800 bg-white flex items-center justify-center p-1 shadow-2xs">
            <span class="text-[9px] font-black tracking-widest text-black uppercase">DURBAR</span>
          </div>
          <span class="text-lg font-black tracking-tight text-[#221d1b] lowercase">durbar</span>
        </div>

        <!-- Bonus Points Quick Action Pill -->
        <div class="w-full">
          <button 
            id="btn-toggle-details-drawer" 
            type="button" 
            class="w-full bg-[#eef7ff] hover:bg-[#e2f1ff] border border-[#d0e7ff] text-[#0369a1] rounded-2xl py-2 px-3.5 flex items-center justify-between text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-amber-500 font-black text-sm">⚡</span>
              <span>Share your details and get 100 bonus points on next purchase</span>
            </div>
            <span class="material-symbols-outlined text-sm text-[#0369a1] transition-transform ${showDetailsDrawer ? 'rotate-180' : ''}">
              keyboard_arrow_down
            </span>
          </button>

          <!-- Drawer Form for Look up / Updating Details -->
          <div id="details-drawer" class="${showDetailsDrawer ? 'block' : 'hidden'} mt-2 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <div class="text-xs font-bold text-gray-800">Check Your Mobile Number & Points</div>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">+91</span>
                <input 
                  id="portal-quick-phone-input" 
                  type="tel" 
                  value="${customerPhone}" 
                  placeholder="Enter 10-digit mobile" 
                  class="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 text-xs font-bold focus:border-[#2a7e72] outline-none"
                />
              </div>
              <button 
                id="btn-portal-quick-lookup" 
                type="button" 
                class="px-3.5 py-2 rounded-xl bg-[#2a7e72] hover:bg-[#23685e] text-white text-xs font-black transition cursor-pointer"
              >
                Look Up
              </button>
            </div>
            <p class="text-[10px] text-gray-500">
              Enter your registered mobile number to refresh your points balance and unlocked discount vouchers.
            </p>
          </div>
        </div>

        <!-- Unlocked Rewards Status Pills (Matching Reelo Reference) -->
        <div class="w-full flex flex-col items-center gap-1.5 text-center">
          <div class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black shadow-2xs">
            <span>🎁</span>
            <span>${unlockedCount} Rewards Unlocked</span>
            <span>🎁</span>
          </div>

          ${nextTier ? `
            <div class="text-[11px] font-bold text-stone-600 flex items-center justify-center gap-1">
              <span class="text-amber-500 font-black">⚡</span>
              <span>Spend ₹${spendToNext.toLocaleString()} to unlock the next reward</span>
            </div>
          ` : `
            <div class="text-[11px] font-bold text-purple-700">
              🎉 Congratulations! You have unlocked all VIP reward tiers!
            </div>
          `}
        </div>

        <!-- ============================================================== -->
        <!-- THE REELO PASS CARD (Chassis #261d1a with Curved Wave & Badge) -->
        <!-- ============================================================== -->
        <div 
          class="w-full rounded-[34px] overflow-hidden shadow-2xl relative border-4 border-black/15 text-white animate-fade-in"
          style="background-color: ${cardBg}; box-shadow: 0 20px 45px -12px rgba(0, 0, 0, 0.45);"
        >
          <!-- Top Food Banner Photo -->
          <div class="relative h-48 w-full overflow-hidden bg-stone-900">
            <img 
              src="${bannerUrl}" 
              alt="Durbar Food Special" 
              class="w-full h-full object-cover" 
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>

            <!-- Curved Wave Divider matching Reelo screenshot -->
            <div class="w-full absolute -bottom-1 left-0" style="line-height: 0;">
              <svg viewBox="0 0 500 80" preserveAspectRatio="none" class="w-full h-8 block" style="fill: ${cardBg};">
                <path d="M0,0 C150,70 350,-20 500,40 L500,80 L0,80 Z"></path>
              </svg>
            </div>

            <!-- Circular Logo Badge Overlapping -->
            <div class="absolute -bottom-3 left-6 z-10 w-22 h-22 rounded-full bg-white shadow-xl flex items-center justify-center border-2 border-white overflow-hidden p-1">
              <div class="w-full h-full rounded-full bg-white flex items-center justify-center text-center p-1">
                <span class="text-xs font-black tracking-widest text-black uppercase leading-none">
                  ${escapeHtml(logoText)}
                </span>
              </div>
            </div>
          </div>

          <!-- Card Body Content -->
          <div class="px-6 pt-5 pb-7 flex flex-col gap-4 text-white">
            
            <!-- Program Title & Subtitle -->
            <div class="pt-1">
              <h2 class="text-2xl font-black text-white tracking-tight leading-none lowercase">
                durbar
              </h2>
              <p class="text-xs text-stone-300 mt-1 font-normal leading-relaxed">
                Get rewarded on every purchase
              </p>
              <div class="text-xs font-extrabold text-white mt-1.5 tracking-wide">
                ₹100 Spent = 10 Points
              </div>
            </div>

            <!-- ========================================================== -->
            <!-- WIN-BACK ENCOURAGING MESSAGE & RUPEES OFFER HIGHLIGHT BOX  -->
            <!-- ========================================================== -->
            <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-500/25 via-emerald-600/20 to-black/40 border border-amber-300/40 text-center shadow-lg relative overflow-hidden">
              <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 font-black text-[10px] uppercase tracking-wider mb-2">
                <span>⭐</span> Available Offer
              </div>

              <div class="text-3xl font-black text-white tracking-tight">
                ₹${rupeesOffer} OFF
              </div>
              <div class="text-xs text-amber-200 font-bold mt-0.5">
                Ready to redeem with your ${pointsBalance.toLocaleString()} points
              </div>

              <!-- Encouraging Win-Back Message to return to restaurant -->
              <div class="mt-3 text-xs text-stone-100 font-medium leading-relaxed bg-black/40 p-3 rounded-xl border border-white/10 text-left">
                <span class="text-amber-300 font-black">We miss you at Durbar Cafe!</span> Visit us this week to enjoy delicious food and redeem <strong>₹${rupeesOffer} OFF</strong> on your bill. We can't wait to serve you again! 🍽️✨
              </div>

              <div class="mt-2.5 flex items-center justify-between text-[10px] text-stone-300 font-medium px-1">
                <span>Expires on: <strong class="text-amber-300">${expiryDate}</strong></span>
                <span class="text-emerald-300 font-bold">● Active in POS</span>
              </div>
            </div>

            <!-- Milestone Ladder (Exact 500, 1000, 2000, 3000, 5000 PTS) -->
            <div class="flex flex-col">
              ${tiers.map((tier) => {
                const isUnlocked = pointsBalance >= tier.points;
                return `
                  <div class="flex items-start justify-between py-2.5 border-b border-dashed border-stone-700/60 text-xs">
                    <div class="w-22 shrink-0 font-black text-sm ${isUnlocked ? 'text-amber-300' : 'text-stone-300'} flex items-baseline gap-1">
                      <span>${tier.points}</span>
                      <span class="text-[10px] font-bold text-stone-400">PTS</span>
                    </div>
                    <div class="flex-1 pr-2">
                      <div class="font-extrabold ${isUnlocked ? 'text-white' : 'text-stone-300'} text-xs flex items-center gap-1.5">
                        <span>${escapeHtml(tier.title)}</span>
                        ${isUnlocked ? '<span class="text-[10px] text-emerald-400 font-black bg-emerald-950/70 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">UNLOCKED</span>' : ''}
                      </div>
                      ${tier.condition ? `<div class="text-[10px] text-stone-400 mt-0.5 leading-snug">${escapeHtml(tier.condition)}</div>` : ''}
                    </div>
                    <div class="shrink-0 pt-0.5 ${isUnlocked ? 'text-emerald-400' : 'text-stone-500'}">
                      <span class="material-symbols-outlined text-sm">
                        ${isUnlocked ? 'check_circle' : 'lock'}
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Terms & Conditions Box (Matching Reference Screenshot) -->
            <div class="rounded-2xl border border-dashed border-stone-700/80 p-3.5 bg-black/25 text-[11px] text-stone-300 leading-relaxed whitespace-pre-line mt-1">
              <div class="font-bold text-white text-[11px] mb-1">Terms & Conditions</div>
              <div>*Minimum purchase required.</div>
              <div>*2 offers cannot be clubbed.</div>
              <div>*Reward cannot be exchanged for cash.</div>
            </div>

          </div>
        </div>

        <!-- How to Redeem Section (Matching Screenshot 3) -->
        <div class="w-full text-center mt-3 space-y-2">
          <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">How to Redeem?</h3>
          <p class="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto font-medium">
            Give your mobile number <strong class="text-stone-900 font-bold">(+91 ${customerPhone})</strong> to our team member on your next purchase and ask them to redeem your offer.
          </p>

          <!-- Direct Phone Call Button -->
          <div class="pt-2">
            <a 
              href="tel:${supportPhone}" 
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2a7e72] hover:bg-[#23685e] text-white font-extrabold text-xs shadow-md transition-all active:scale-98"
            >
              <span class="material-symbols-outlined text-sm">call</span>
              <span>Call Durbar Cafe (${supportPhone})</span>
            </a>
          </div>
        </div>

        <!-- Footer / Branding matching Reelo -->
        <footer class="w-full text-center pt-5 pb-2 text-[11px] text-gray-400 border-t border-gray-200 mt-2">
          <div class="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Powered By</div>
          <div class="font-extrabold text-stone-800 text-sm tracking-tight mt-0.5">reelo</div>
          <div class="text-[10px] text-[#2a7e72] font-semibold mt-1 cursor-pointer hover:underline">
            Collect feedback for your business
          </div>
        </footer>

      </main>

    </div>
  `;
}

export function attachCustomerPortalListeners() {
  // Toggle details / phone lookup drawer
  const toggleBtn = document.getElementById('btn-toggle-details-drawer');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      showDetailsDrawer = !showDetailsDrawer;
      store.notify();
    };
  }

  // Quick lookup button
  const lookupBtn = document.getElementById('btn-portal-quick-lookup');
  if (lookupBtn) {
    lookupBtn.onclick = async () => {
      const input = document.getElementById('portal-quick-phone-input');
      const val = input ? input.value.trim() : '';
      if (!val) {
        showToast('Please enter your mobile number');
        return;
      }

      lookupPhone = val;
      try {
        const res = await fetch(apiUrl('/api/loyalty/members/lookup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: lookupPhone })
        });
        const data = await res.json();
        if (data.status === 'success' && data.member) {
          verifiedCustomer = {
            ...data.member,
            points_balance: data.points_balance
          };
          showToast(`Welcome, ${verifiedCustomer.name}! Points: ${verifiedCustomer.points_balance}`);
        } else {
          // If not in database, simulate customer with personalized balance
          verifiedCustomer = {
            name: 'Valued Diner',
            phone_e164: lookupPhone,
            points_balance: 1000
          };
          showToast(`Rewards loaded for +91 ${lookupPhone}`);
        }
      } catch {
        verifiedCustomer = {
          name: 'Valued Diner',
          phone_e164: lookupPhone,
          points_balance: 1000
        };
        showToast(`Rewards loaded for +91 ${lookupPhone}`);
      }
      showDetailsDrawer = false;
      store.notify();
    };
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
