// POS Billing Screen & Cashier Terminal Module
// Implements Section 6 Billing screen with diner lookup, 1-tap redeem, thermal receipt & i18n
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { t } from '../../../lib/loyalty/i18n.js';
import { apiUrl } from '../../config/api.js';

let currentLang = 'en';
let activeMember = null;
let currentPreview = null;
let billPaise = 40000; // Default ₹400
let orderType = 'dine_in';
let hasConflictingDiscounts = false;
let appliedDiscountPaise = 0;
let pointsToRedeem = 0;

export function renderBillingScreen(state) {
  const currentBillInr = (billPaise / 100).toFixed(0);
  const netBillPaise = Math.max(0, billPaise - appliedDiscountPaise);
  const netBillInr = (netBillPaise / 100).toFixed(0);

  return `
    <div class="px-4 md:px-margin py-space-md max-w-7xl mx-auto flex flex-col gap-6 animate-fade-in select-none pb-20">
      
      <!-- Top Action Bar with Language Toggle & Cashier Status -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-3xl border border-outline-variant/30 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black shadow-sm">
            <span class="material-symbols-outlined text-2xl">point_of_sale</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Cashier Billing Terminal</h1>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wider">Live POS</span>
            </div>
            <p class="text-xs text-gray-500 font-medium mt-0.5">
              ${currentLang === 'ml' ? 'ഉപഭോക്താവിന്റെ മൊബൈൽ നമ്പർ നൽകി പോയിന്റുകൾ ഉപയോഗിക്കുക' : 'Enter diner phone number to apply points or credit rewards'}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 self-start sm:self-auto">
          <!-- Language Toggle Switcher -->
          <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-bold">
            <button 
              id="btn-lang-en" 
              type="button" 
              class="px-3 py-1.5 rounded-lg transition ${currentLang === 'en' ? 'bg-white text-primary shadow-xs font-black' : 'text-slate-600 hover:text-black'}"
            >
              English
            </button>
            <button 
              id="btn-lang-ml" 
              type="button" 
              class="px-3 py-1.5 rounded-lg transition ${currentLang === 'ml' ? 'bg-primary text-white shadow-xs font-black' : 'text-slate-600 hover:text-black'}"
            >
              മലയാളം
            </button>
          </div>

          <a 
            href="#customer-portal" 
            target="_blank"
            class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-sm">open_in_new</span>
            <span>${currentLang === 'ml' ? 'കസ്റ്റമർ ലിങ്ക്' : 'Customer View'}</span>
          </a>
        </div>
      </div>

      <!-- Main Grid: Left Billing Terminal + Right Live Bill & Receipt -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <!-- Left: Diner Lookup & Redemption Actions (7 cols) -->
        <div class="lg:col-span-7 flex flex-col gap-6">
          
          <!-- Phone Lookup Card -->
          <div class="bg-white rounded-3xl p-6 border border-outline-variant/30 shadow-xs space-y-4">
            <label class="block text-xs font-black text-gray-700 uppercase tracking-wider">
              ${t('phone_input_label', currentLang)}
            </label>
            
            <div class="flex flex-col sm:flex-row gap-2">
              <div class="relative flex-1">
                <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">+91</span>
                <input 
                  id="billing-phone-input" 
                  type="tel" 
                  placeholder="98470 12345" 
                  value="${activeMember ? activeMember.phone_e164.replace('+91', '') : '9847012345'}"
                  class="w-full pl-12 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-base font-bold text-gray-900 focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
                />
              </div>
              <button 
                id="btn-lookup-diner" 
                type="button" 
                class="px-6 py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-extrabold text-sm transition shadow-sm flex items-center justify-center gap-2 active:scale-95 shrink-0"
              >
                <span class="material-symbols-outlined text-base">search</span>
                <span>${t('lookup_customer', currentLang)}</span>
              </button>
            </div>

            <!-- Quick Demo Diners -->
            <div class="flex items-center gap-2 pt-1 overflow-x-auto pb-1 text-xs">
              <span class="text-gray-400 font-semibold text-[11px] shrink-0">Sample Diners:</span>
              <button type="button" class="btn-sample-phone px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold shrink-0" data-phone="9847012345">Rahul (+91 98470 12345)</button>
              <button type="button" class="btn-sample-phone px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold shrink-0" data-phone="9847055555">Ananya (+91 98470 55555)</button>
              <button type="button" class="btn-sample-phone px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold shrink-0" data-phone="9847033333">Vishnu (+91 98470 33333)</button>
            </div>
          </div>

          <!-- Diner Details & Redemption Status Deck -->
          ${activeMember ? `
            <div class="bg-white rounded-3xl p-6 border border-outline-variant/30 shadow-xs space-y-6">
              
              <!-- Member Profile Strip -->
              <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-2xl bg-primary-container text-white flex items-center justify-center font-black text-lg">
                    ${activeMember.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 class="text-base font-extrabold text-gray-900 leading-tight">${activeMember.name}</h3>
                    <p class="text-xs font-semibold text-gray-500 font-mono mt-0.5">${activeMember.phone_e164}</p>
                  </div>
                </div>

                <div class="flex flex-col items-end">
                  <span class="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    activeMember.tier === 'Platinum' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                    activeMember.tier === 'Gold' ? 'bg-yellow-100 text-yellow-900 border border-yellow-300' :
                    'bg-slate-100 text-slate-800 border border-slate-300'
                  }">
                    ${activeMember.tier === 'Platinum' ? '🏆 Platinum (1.5x)' : activeMember.tier === 'Gold' ? '⭐ Gold (1.25x)' : '🥈 Silver (1.0x)'}
                  </span>
                  <span class="text-[11px] text-gray-500 font-medium mt-1">${activeMember.visit_count} ${currentLang === 'ml' ? 'സന്ദർശനങ്ങൾ' : 'Visits'}</span>
                </div>
              </div>

              <!-- Points Balance Stat -->
              <div class="grid grid-cols-2 gap-4">
                <div class="p-4 rounded-2xl bg-purple-50/70 border border-purple-100">
                  <span class="text-[11px] font-black uppercase text-purple-700 tracking-wider block">${t('points_balance', currentLang)}</span>
                  <div class="text-2xl font-black text-purple-950 mt-1">${activeMember.points_balance || 0} <span class="text-xs font-bold text-purple-700">Pts</span></div>
                  <span class="text-[11px] text-purple-600 font-semibold mt-0.5 block">Worth ₹${((activeMember.points_balance || 0) * 1).toFixed(0)}</span>
                </div>

                <div class="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <span class="text-[11px] font-black uppercase text-emerald-700 tracking-wider block">${t('redeemable_value', currentLang)}</span>
                  <div id="stat-redeemable-val" class="text-2xl font-black text-emerald-950 mt-1">₹${currentPreview && currentPreview.allowed ? (currentPreview.max_discount_paise / 100).toFixed(0) : '0'}</div>
                  <span class="text-[11px] text-emerald-600 font-semibold mt-0.5 block">Max 20% cap on bill</span>
                </div>
              </div>

              <!-- Redemption Eligibility Assessment Box -->
              <div id="redemption-assessment-box" class="p-5 rounded-2xl ${currentPreview && currentPreview.allowed ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' : 'bg-amber-50 border border-amber-200 text-amber-950'} transition-all">
                ${currentPreview && currentPreview.allowed ? `
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div class="flex items-center gap-1.5 font-black text-sm">
                        <span class="material-symbols-outlined text-base">check_circle</span>
                        <span>${t('redeem_available', currentLang, { amount: (currentPreview.max_discount_paise / 100).toFixed(0) })}</span>
                      </div>
                      <p class="text-xs text-emerald-100 font-medium mt-1">
                        Burn ${currentPreview.redeem_points} points for an instant ₹${(currentPreview.discount_paise / 100).toFixed(0)} bill discount.
                      </p>
                    </div>

                    ${appliedDiscountPaise > 0 ? `
                      <button 
                        id="btn-remove-redeem"
                        type="button" 
                        class="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs transition flex items-center justify-center gap-1 shrink-0"
                      >
                        <span class="material-symbols-outlined text-sm">cancel</span>
                        <span>Remove Discount</span>
                      </button>
                    ` : `
                      <button 
                        id="btn-apply-redeem" 
                        type="button" 
                        class="px-5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 font-black text-xs transition shadow-md flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                      >
                        <span class="material-symbols-outlined text-sm">redeem</span>
                        <span>${t('one_tap_apply', currentLang)}</span>
                      </button>
                    `}
                  </div>
                ` : `
                  <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">info</span>
                    <div>
                      <h4 class="font-bold text-xs uppercase tracking-wider text-amber-800">
                        ${currentPreview?.error_code || 'CANNOT_REDEEM_NOW'}
                      </h4>
                      <p class="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                        ${currentPreview?.error_message || 'Redemption prerequisites not met for this bill.'}
                      </p>
                    </div>
                  </div>
                `}
              </div>

            </div>
          ` : `
            <div class="bg-white rounded-3xl p-8 border border-dashed border-gray-300 text-center space-y-3">
              <div class="w-14 h-14 rounded-full bg-slate-100 text-gray-400 mx-auto flex items-center justify-center">
                <span class="material-symbols-outlined text-3xl">person_search</span>
              </div>
              <h3 class="text-sm font-bold text-gray-700">No Customer Selected</h3>
              <p class="text-xs text-gray-500 max-w-sm mx-auto">
                Enter diner's mobile number above or tap one of the sample customers to load loyalty rewards profile.
              </p>
            </div>
          `}
        </div>

        <!-- Right: Current Bill, Discount Settlement & Thermal Receipt (5 cols) -->
        <div class="lg:col-span-5 flex flex-col gap-6">
          
          <!-- Live Bill Card -->
          <div class="bg-white rounded-3xl p-6 border border-outline-variant/30 shadow-xs space-y-5">
            <h3 class="text-base font-extrabold text-gray-900 flex items-center justify-between">
              <span>Current Order Bill</span>
              <span class="text-xs font-mono font-bold text-gray-500">ORD-#${Date.now().toString().slice(-4)}</span>
            </h3>

            <!-- Bill Controls -->
            <div class="space-y-3">
              <div>
                <label class="block text-[11px] font-bold text-gray-500 uppercase mb-1">Gross Bill Amount (₹)</label>
                <div class="relative">
                  <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold">₹</span>
                  <input 
                    id="input-bill-amount" 
                    type="number" 
                    value="${currentBillInr}" 
                    step="10"
                    class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-base font-extrabold text-gray-900 outline-none focus:border-primary focus:bg-white transition"
                  />
                </div>
              </div>

              <!-- Quick Bill Presets to test Acceptance Tests 1, 2, 4, 5 -->
              <div class="flex items-center gap-2 pt-1 text-xs">
                <span class="text-gray-400 text-[10px] font-bold">Presets:</span>
                <button type="button" class="btn-bill-preset px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-[11px]" data-amount="200">₹200 (Test 1)</button>
                <button type="button" class="btn-bill-preset px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-[11px]" data-amount="250">₹250 (Test 5)</button>
                <button type="button" class="btn-bill-preset px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-[11px]" data-amount="400">₹400 (Test 4)</button>
                <button type="button" class="btn-bill-preset px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-[11px]" data-amount="520">₹520 (Test 2)</button>
              </div>

              <!-- Order Type & Coupon Stacking Toggle -->
              <div class="pt-2 border-t border-gray-100 space-y-2">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-gray-600 font-semibold">Order Type:</span>
                  <select id="select-order-type" class="px-2.5 py-1 rounded-lg bg-slate-50 border text-xs font-bold text-gray-800">
                    <option value="dine_in" ${orderType === 'dine_in' ? 'selected' : ''}>Dine In</option>
                    <option value="takeaway" ${orderType === 'takeaway' ? 'selected' : ''}>Takeaway</option>
                    <option value="delivery" ${orderType === 'delivery' ? 'selected' : ''}>Delivery (Restricted)</option>
                  </select>
                </div>

                <label class="flex items-center gap-2 cursor-pointer pt-1">
                  <input id="cb-stackable" type="checkbox" ${hasConflictingDiscounts ? 'checked' : ''} class="rounded text-primary focus:ring-primary w-4 h-4">
                  <span class="text-[11px] font-semibold text-gray-600">Simulate existing coupon discount (non-stackable)</span>
                </label>
              </div>
            </div>

            <!-- Bill Breakdown Summary -->
            <div class="pt-4 border-t border-gray-100 space-y-2 text-xs">
              <div class="flex justify-between text-gray-500 font-semibold">
                <span>Subtotal (Eligible Spend)</span>
                <span id="bill-subtotal-val" class="font-mono font-bold">₹${currentBillInr}</span>
              </div>
              <div id="bill-discount-row" class="${appliedDiscountPaise > 0 ? 'flex' : 'hidden'} justify-between text-emerald-600 font-bold">
                <span id="bill-discount-label">Loyalty Discount (${pointsToRedeem} Pts Burned)</span>
                <span id="bill-discount-val" class="font-mono">- ₹${(appliedDiscountPaise / 100).toFixed(0)}</span>
              </div>
              <div class="flex justify-between items-center text-sm font-black text-gray-900 pt-2 border-t border-gray-100">
                <span>Net Payable Bill</span>
                <span id="bill-net-val" class="text-lg font-black text-primary font-mono">₹${netBillInr}</span>
              </div>
            </div>

            <!-- Tender & Print Receipt Buttons -->
            <div class="pt-2 flex flex-col gap-2">
              <button 
                id="btn-settle-order" 
                type="button" 
                class="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-sm transition shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <span class="material-symbols-outlined text-base">check</span>
                <span>Settle Order & Credit Rewards</span>
              </button>

              <button 
                id="btn-preview-thermal-receipt" 
                type="button" 
                class="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <span class="material-symbols-outlined text-sm">print</span>
                <span>Preview Thermal Printer Receipt</span>
              </button>
            </div>
          </div>

          <!-- Thermal Receipt ASCII Preview Modal Box -->
          <div id="receipt-modal-box" class="hidden bg-slate-900 text-emerald-400 p-5 rounded-3xl font-mono text-xs shadow-xl space-y-3">
            <div class="flex items-center justify-between text-gray-400 border-b border-gray-800 pb-2">
              <span class="text-[10px] uppercase font-bold tracking-widest text-emerald-400">ESC/POS Thermal Print</span>
              <button id="btn-close-receipt-box" type="button" class="hover:text-white">✕</button>
            </div>
            <pre id="receipt-ascii-content" class="leading-relaxed overflow-x-auto whitespace-pre font-mono text-[11px]"></pre>
            <button 
              type="button" 
              class="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs transition"
              onclick="window.print()"
            >
              Print to Thermal Printer
            </button>
          </div>

        </div>

      </div>

    </div>
  `;
}

export function attachBillingScreenListeners() {
  // Language switcher
  const btnEn = document.getElementById('btn-lang-en');
  const btnMl = document.getElementById('btn-lang-ml');
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

  // Quick sample phone buttons
  document.querySelectorAll('.btn-sample-phone').forEach(btn => {
    btn.onclick = () => {
      const phoneInput = document.getElementById('billing-phone-input');
      if (phoneInput) {
        phoneInput.value = btn.getAttribute('data-phone');
        triggerLookup(btn.getAttribute('data-phone'));
      }
    };
  });

  // Phone lookup action
  const lookupBtn = document.getElementById('btn-lookup-diner');
  if (lookupBtn) {
    lookupBtn.onclick = () => {
      const phoneInput = document.getElementById('billing-phone-input');
      if (phoneInput && phoneInput.value) {
        triggerLookup(phoneInput.value);
      }
    };
  }

  // Bill amount input listener (smooth in-place updates)
  const billInput = document.getElementById('input-bill-amount');
  if (billInput) {
    billInput.oninput = (e) => {
      const val = parseFloat(e.target.value) || 0;
      billPaise = Math.round(val * 100);
      recalculatePreview();
    };
  }

  // Preset bill buttons
  document.querySelectorAll('.btn-bill-preset').forEach(btn => {
    btn.onclick = () => {
      const amt = parseFloat(btn.getAttribute('data-amount')) || 200;
      billPaise = Math.round(amt * 100);
      appliedDiscountPaise = 0;
      pointsToRedeem = 0;
      if (billInput) billInput.value = amt;
      recalculatePreview();
    };
  });

  // Order type dropdown
  const orderTypeSelect = document.getElementById('select-order-type');
  if (orderTypeSelect) {
    orderTypeSelect.onchange = (e) => {
      orderType = e.target.value;
      recalculatePreview();
    };
  }

  // Coupon stacking checkbox
  const stackableCb = document.getElementById('cb-stackable');
  if (stackableCb) {
    stackableCb.onchange = (e) => {
      hasConflictingDiscounts = e.target.checked;
      recalculatePreview();
    };
  }

  // 1-Tap Apply Redeem
  const applyRedeemBtn = document.getElementById('btn-apply-redeem');
  if (applyRedeemBtn && currentPreview && currentPreview.allowed) {
    applyRedeemBtn.onclick = () => {
      appliedDiscountPaise = currentPreview.discount_paise;
      pointsToRedeem = currentPreview.redeem_points;
      showToast(t('redeem_success', currentLang, {
        points: pointsToRedeem,
        amount: (appliedDiscountPaise / 100).toFixed(0)
      }));
      store.notify();
    };
  }

  // Remove discount
  const removeRedeemBtn = document.getElementById('btn-remove-redeem');
  if (removeRedeemBtn) {
    removeRedeemBtn.onclick = () => {
      appliedDiscountPaise = 0;
      pointsToRedeem = 0;
      showToast('Discount removed');
      store.notify();
    };
  }

  // Settle Order
  const settleBtn = document.getElementById('btn-settle-order');
  if (settleBtn) {
    settleBtn.onclick = async () => {
      if (!activeMember) {
        showToast('Please look up a diner first');
        return;
      }

      const orderId = `ORD-${Date.now().toString().slice(-6)}`;
      const subtotalPaise = billPaise;

      try {
        // If discount applied, commit redemption first
        if (pointsToRedeem > 0) {
          await fetch(apiUrl('/api/loyalty/redeem/commit'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              order_id: orderId,
              member_phone: activeMember.phone_e164,
              bill_paise: billPaise,
              requested_points: pointsToRedeem,
              order_type: orderType
            })
          });
        }

        // Call Earn API
        const earnRes = await fetch(apiUrl('/api/loyalty/earn'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
            member_phone: activeMember.phone_e164,
            subtotal_paise: subtotalPaise,
            discounts_paise: appliedDiscountPaise,
            order_type: orderType
          })
        });
        const earnData = await earnRes.json();

        showToast(`Bill settled! Earned +${earnData.earn?.total_points_earned || 0} loyalty points.`);
        
        // Refresh diner status
        await triggerLookup(activeMember.phone_e164);
        
        // Show receipt
        loadThermalReceipt(orderId);
      } catch (err) {
        showToast(`Settlement error: ${err.message}`);
      }
    };
  }

  // Thermal Receipt Preview Button
  const previewReceiptBtn = document.getElementById('btn-preview-thermal-receipt');
  if (previewReceiptBtn) {
    previewReceiptBtn.onclick = () => {
      loadThermalReceipt(`ORD-DEMO`);
    };
  }

  const closeReceiptBtn = document.getElementById('btn-close-receipt-box');
  if (closeReceiptBtn) {
    closeReceiptBtn.onclick = () => {
      const box = document.getElementById('receipt-modal-box');
      if (box) box.classList.add('hidden');
    };
  }
}

async function triggerLookup(phone) {
  try {
    const res = await fetch(apiUrl('/api/loyalty/members/lookup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        bill_paise: billPaise,
        order_type: orderType
      })
    });
    const data = await res.json();
    if (data.status === 'success') {
      activeMember = {
        ...data.member,
        points_balance: data.points_balance
      };
      currentPreview = data.redeem_preview;
      appliedDiscountPaise = 0;
      pointsToRedeem = 0;
      store.notify();
    } else {
      showToast(data.message || 'Lookup failed');
    }
  } catch (err) {
    showToast(`Lookup failed: ${err.message}`);
  }
}

async function recalculatePreview() {
  const currentBillInr = (billPaise / 100).toFixed(0);
  const netBillPaise = Math.max(0, billPaise - appliedDiscountPaise);
  const netBillInr = (netBillPaise / 100).toFixed(0);

  const subtotalEl = document.getElementById('bill-subtotal-val');
  if (subtotalEl) subtotalEl.textContent = `₹${currentBillInr}`;

  const netEl = document.getElementById('bill-net-val');
  if (netEl) netEl.textContent = `₹${netBillInr}`;

  const discountRow = document.getElementById('bill-discount-row');
  const discountLabel = document.getElementById('bill-discount-label');
  const discountVal = document.getElementById('bill-discount-val');
  if (discountRow) {
    if (appliedDiscountPaise > 0) {
      discountRow.className = 'flex justify-between text-emerald-600 font-bold';
      if (discountLabel) discountLabel.textContent = `Loyalty Discount (${pointsToRedeem} Pts Burned)`;
      if (discountVal) discountVal.textContent = `- ₹${(appliedDiscountPaise / 100).toFixed(0)}`;
    } else {
      discountRow.className = 'hidden justify-between text-emerald-600 font-bold';
    }
  }

  if (!activeMember) return;
  try {
    const res = await fetch(apiUrl('/api/loyalty/redeem/preview'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_phone: activeMember.phone_e164,
        bill_paise: billPaise,
        order_type: orderType,
        has_conflicting_discounts: hasConflictingDiscounts
      })
    });
    const data = await res.json();
    currentPreview = data;

    const statRedeemableEl = document.getElementById('stat-redeemable-val');
    if (statRedeemableEl) {
      statRedeemableEl.textContent = `₹${data.allowed ? (data.max_discount_paise / 100).toFixed(0) : '0'}`;
    }

    const assessBox = document.getElementById('redemption-assessment-box');
    if (assessBox) {
      if (data.allowed) {
        assessBox.className = 'p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md transition-all';
        assessBox.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-1.5 font-black text-sm">
                <span class="material-symbols-outlined text-base">check_circle</span>
                <span>${t('redeem_available', currentLang, { amount: (data.max_discount_paise / 100).toFixed(0) })}</span>
              </div>
              <p class="text-xs text-emerald-100 font-medium mt-1">
                Burn ${data.redeem_points} points for an instant ₹${(data.discount_paise / 100).toFixed(0)} bill discount.
              </p>
            </div>
            ${appliedDiscountPaise > 0 ? `
              <button id="btn-remove-redeem" type="button" class="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs transition flex items-center justify-center gap-1 shrink-0">
                <span class="material-symbols-outlined text-sm">cancel</span>
                <span>Remove Discount</span>
              </button>
            ` : `
              <button id="btn-apply-redeem" type="button" class="px-5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 font-black text-xs transition shadow-md flex items-center justify-center gap-1.5 shrink-0 active:scale-95">
                <span class="material-symbols-outlined text-sm">redeem</span>
                <span>${t('one_tap_apply', currentLang)}</span>
              </button>
            `}
          </div>
        `;
        const applyBtn = document.getElementById('btn-apply-redeem');
        if (applyBtn) {
          applyBtn.onclick = () => {
            appliedDiscountPaise = data.discount_paise;
            pointsToRedeem = data.redeem_points;
            showToast(t('redeem_success', currentLang, { points: pointsToRedeem, amount: (appliedDiscountPaise / 100).toFixed(0) }));
            recalculatePreview();
          };
        }
        const removeBtn = document.getElementById('btn-remove-redeem');
        if (removeBtn) {
          removeBtn.onclick = () => {
            appliedDiscountPaise = 0;
            pointsToRedeem = 0;
            showToast('Discount removed');
            recalculatePreview();
          };
        }
      } else {
        assessBox.className = 'p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 transition-all';
        assessBox.innerHTML = `
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-amber-600 text-xl shrink-0 mt-0.5">info</span>
            <div>
              <h4 class="font-bold text-xs uppercase tracking-wider text-amber-800">${data.error_code || 'CANNOT_REDEEM_NOW'}</h4>
              <p class="text-xs text-amber-900 mt-1 font-medium leading-relaxed">${data.error_message || 'Redemption prerequisites not met for this bill.'}</p>
            </div>
          </div>
        `;
      }
    }
  } catch (err) {
    console.warn('Recalculate preview error', err);
  }
}

async function loadThermalReceipt(orderId) {
  try {
    const res = await fetch(apiUrl(`/api/loyalty/receipt/${orderId}?lang=${currentLang}`));
    const receiptText = await res.text();
    const box = document.getElementById('receipt-modal-box');
    const content = document.getElementById('receipt-ascii-content');
    if (box && content) {
      content.textContent = receiptText;
      box.classList.remove('hidden');
    }
  } catch (err) {
    showToast('Failed to generate thermal receipt');
  }
}
