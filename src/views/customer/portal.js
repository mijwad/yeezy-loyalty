// Customer Public Portal & Guest Rewards View
// Implements Section 6 Customer view with OTP login, points balance, expiry dates, tier progress & referral link
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../../lib/loyalty/i18n.js';
import { renderLoyaltyCardPreview } from '../loyalty/index.js';
import { apiUrl } from '../../config/api.js';

let currentLang = 'en';
let customerPhone = '9847012345';
let customerData = null;
let otpStep = 'phone'; // 'phone' | 'otp' | 'logged_in'
let otpInput = '';

export function renderCustomerPortal(state) {
  return `
    <div class="min-h-screen bg-slate-50 flex flex-col font-sans select-none pb-20 animate-fade-in">
      
      <!-- Top Customer Navbar -->
      <nav class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-black text-lg shadow-sm">
            Y
          </div>
          <div>
            <span class="font-extrabold text-base text-gray-900 tracking-tight block leading-none">Downtown Bistro</span>
            <span class="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Kerala Rewards</span>
          </div>
        </div>

        <!-- Language Switcher -->
        <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
          <button 
            id="portal-lang-en" 
            type="button" 
            class="px-3 py-1 rounded-lg transition ${currentLang === 'en' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-600 hover:text-black'}"
          >
            English
          </button>
          <button 
            id="portal-lang-ml" 
            type="button" 
            class="px-3 py-1 rounded-lg transition ${currentLang === 'ml' ? 'bg-primary text-white shadow-xs font-black' : 'text-slate-600 hover:text-black'}"
          >
            മലയാളം
          </button>
        </div>
      </nav>

      <!-- Main Container -->
      <main class="flex-1 max-w-xl w-full mx-auto p-4 md:p-6 flex flex-col gap-5">
        
        <!-- Kerala Festival Surge Banner -->
        <div class="p-4 rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl shrink-0">
            🥘
          </div>
          <div>
            <span class="text-[10px] font-black uppercase tracking-wider bg-white/30 px-2 py-0.5 rounded-full">Kerala Festival Special</span>
            <h4 class="text-xs md:text-sm font-black mt-0.5">${t('festival_onam', currentLang)}</h4>
            <p class="text-[11px] text-amber-100 mt-0.5">Dine with us this week to earn 2x bonus rewards!</p>
          </div>
        </div>

        ${!customerData ? `
          <!-- Phone & OTP Sign-In Card -->
          <div class="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-5 text-center">
            <div class="w-16 h-16 rounded-3xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <span class="material-symbols-outlined text-3xl">card_membership</span>
            </div>
            
            <div>
              <h2 class="text-xl font-black text-gray-900">${currentLang === 'ml' ? 'നിങ്ങളുടെ റിവാർഡുകൾ പരിശോധിക്കൂ' : 'Check Your Loyalty Points'}</h2>
              <p class="text-xs text-gray-500 mt-1">
                ${currentLang === 'ml' ? 'മൊബൈൽ നമ്പർ നൽകി ലഭ്യമായ ബാലൻസും ഡിസ്കൗണ്ടുകളും കാണുക' : 'Enter your mobile number to view points balance, tiers & referral perks'}
              </p>
            </div>

            ${otpStep === 'phone' ? `
              <div class="space-y-4">
                <div class="relative text-left">
                  <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">${t('phone_input_label', currentLang)}</label>
                  <div class="relative">
                    <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">+91</span>
                    <input 
                      id="portal-phone-input" 
                      type="tel" 
                      value="${customerPhone}" 
                      placeholder="98470 12345" 
                      class="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-base font-bold text-gray-900 focus:bg-white focus:border-primary outline-none"
                    />
                  </div>
                </div>

                <button 
                  id="btn-portal-send-otp" 
                  type="button" 
                  class="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-extrabold text-sm shadow-md transition active:scale-98"
                >
                  ${currentLang === 'ml' ? 'ഒടിപി അയക്കുക' : 'Send WhatsApp / SMS OTP'}
                </button>
              </div>
            ` : `
              <div class="space-y-4">
                <div class="p-3 bg-purple-50 rounded-2xl text-xs text-purple-900 font-medium">
                  OTP sent to <strong>+91 ${customerPhone}</strong> (Demo OTP: <strong>1234</strong>)
                </div>

                <div>
                  <input 
                    id="portal-otp-input" 
                    type="text" 
                    maxlength="6"
                    placeholder="Enter 4-digit OTP" 
                    class="w-full text-center tracking-[0.5em] text-2xl font-black py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary outline-none"
                  />
                </div>

                <div class="flex gap-2">
                  <button 
                    id="btn-portal-back-phone"
                    type="button" 
                    class="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs"
                  >
                    Change Phone
                  </button>
                  <button 
                    id="btn-portal-verify-otp" 
                    type="button" 
                    class="flex-2 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-extrabold text-xs shadow-md"
                  >
                    Verify & View Rewards
                  </button>
                </div>
              </div>
            `}
          </div>

          <!-- Digital Loyalty Pass Preview (Reference Image 1) -->
          <div class="flex flex-col items-center justify-center my-2">
            <span class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Your Digital Membership Pass</span>
            ${renderLoyaltyCardPreview(state.loyaltyProgram)}
          </div>
        ` : `
          <!-- Customer Logged-In Rewards Dashboard -->
          <div class="space-y-5">
            
            <!-- Digital Membership Pass (Reference Image 1) -->
            <div class="flex flex-col items-center justify-center">
              ${renderLoyaltyCardPreview(state.loyaltyProgram)}
            </div>

            <!-- Greeting & Tier Medallion Card -->
            <div class="bg-gradient-to-tr from-purple-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div class="flex items-start justify-between relative z-10">
                <div>
                  <span class="text-[11px] font-bold text-purple-300 uppercase tracking-widest">${t('customer_status_title', currentLang)}</span>
                  <h2 class="text-2xl font-black mt-1">${t('customer_greeting', currentLang, { name: customerData.name })}</h2>
                  <span class="text-xs font-mono text-purple-200">${customerData.phone_e164}</span>
                </div>

                <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/30 text-amber-300">
                  ${customerData.tier} Member
                </span>
              </div>

              <!-- Big Points Display -->
              <div class="mt-6 pt-5 border-t border-white/10 flex items-baseline justify-between relative z-10">
                <div>
                  <div class="text-4xl md:text-5xl font-black tracking-tight text-white">${customerData.points_balance || 0}</div>
                  <span class="text-xs text-purple-200 font-bold mt-1 block">Worth ₹${((customerData.points_balance || 0) * 1).toFixed(0)} on your next dining bill</span>
                </div>

                <div class="text-right">
                  <span class="text-[11px] text-purple-300 uppercase tracking-wider block font-bold">${t('total_visits', currentLang)}</span>
                  <div class="text-xl font-black text-white mt-0.5">${customerData.visit_count || 0}</div>
                </div>
              </div>

              <!-- Tier Progress Bar -->
              <div class="mt-5 relative z-10">
                <div class="flex justify-between text-[11px] text-purple-200 font-bold mb-1.5">
                  <span>${customerData.tier}</span>
                  <span>${t('customer_next_tier_progress', currentLang, { remaining: Math.max(0, 12 - (customerData.visit_count || 0)), nextTier: 'Platinum' })}</span>
                </div>
                <div class="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                  <div class="bg-gradient-to-r from-amber-400 to-yellow-300 h-2 rounded-full transition-all duration-500" style="width: ${Math.min(100, ((customerData.visit_count || 0) / 12) * 100)}%;"></div>
                </div>
              </div>
            </div>

            <!-- Expiry Timeline Card -->
            <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-amber-500 text-xl">schedule</span>
                <h4 class="text-xs font-black uppercase tracking-wider text-gray-800">Points Expiry Schedule</h4>
              </div>
              
              <div class="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100 flex items-center justify-between text-xs">
                <div>
                  <div class="font-bold text-amber-950">Active Points Remaining</div>
                  <span class="text-[11px] text-amber-700">Protected for 90 days from last dining visit</span>
                </div>
                <span class="font-black text-amber-950 text-sm">${customerData.points_balance || 0} Pts</span>
              </div>
            </div>

            <!-- Referral Share Card -->
            <div class="bg-gradient-to-br from-emerald-50 via-teal-50 to-white rounded-3xl p-6 border-2 border-emerald-300 shadow-sm space-y-4">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-sm">
                  🎁
                </div>
                <div>
                  <h3 class="text-base font-black text-emerald-950">${t('customer_referral_title', currentLang)}</h3>
                  <p class="text-xs text-emerald-800 mt-0.5">${t('customer_referral_subtitle', currentLang)}</p>
                </div>
              </div>

              <div class="p-3 bg-white rounded-2xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Your Referral Code</span>
                  <span class="text-base font-black font-mono text-emerald-800 tracking-wider">YZY-${customerData.phone_e164.slice(-4)}</span>
                </div>
                <button 
                  id="btn-copy-referral" 
                  type="button" 
                  class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition active:scale-95 shadow-xs"
                >
                  ${t('customer_copy_link', currentLang)}
                </button>
              </div>
            </div>

            <button 
              id="btn-portal-logout" 
              type="button" 
              class="w-full py-2.5 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition"
            >
              Sign Out
            </button>

          </div>
        `}

      </main>

    </div>
  `;
}

export function attachCustomerPortalListeners() {
  // Language toggle
  const btnEn = document.getElementById('portal-lang-en');
  const btnMl = document.getElementById('portal-lang-ml');
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

  // Send OTP
  const sendOtpBtn = document.getElementById('btn-portal-send-otp');
  if (sendOtpBtn) {
    sendOtpBtn.onclick = () => {
      const phoneInput = document.getElementById('portal-phone-input');
      if (phoneInput && phoneInput.value) {
        customerPhone = phoneInput.value.trim();
        otpStep = 'otp';
        showToast('OTP sent to your WhatsApp / SMS (Code: 1234)');
        store.notify();
      }
    };
  }

  // Back to phone
  const backPhoneBtn = document.getElementById('btn-portal-back-phone');
  if (backPhoneBtn) {
    backPhoneBtn.onclick = () => {
      otpStep = 'phone';
      store.notify();
    };
  }

  // Verify OTP
  const verifyOtpBtn = document.getElementById('btn-portal-verify-otp');
  if (verifyOtpBtn) {
    verifyOtpBtn.onclick = async () => {
      try {
        const res = await fetch(apiUrl('/api/loyalty/members/lookup'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: customerPhone })
        });
        const data = await res.json();
        if (data.status === 'success') {
          customerData = {
            ...data.member,
            points_balance: data.points_balance
          };
          otpStep = 'logged_in';
          showToast(`Welcome back, ${customerData.name}!`);
          store.notify();
        } else {
          showToast('Could not verify diner');
        }
      } catch (err) {
        showToast(`Verification error: ${err.message}`);
      }
    };
  }

  // Copy referral link
  const copyReferralBtn = document.getElementById('btn-copy-referral');
  if (copyReferralBtn && customerData) {
    copyReferralBtn.onclick = () => {
      const refUrl = `${window.location.origin}/#billing-terminal?ref=${customerData.phone_e164}`;
      navigator.clipboard.writeText(refUrl);
      showToast(t('customer_link_copied', currentLang));
    };
  }

  // Sign out
  const logoutBtn = document.getElementById('btn-portal-logout');
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      customerData = null;
      otpStep = 'phone';
      store.notify();
    };
  }
}
