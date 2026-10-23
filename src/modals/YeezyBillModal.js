// Yeezy Bill Native POS Configuration Modal
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { apiUrl } from '../config/api.js';

let isSimulatingBill = false;

export function renderYeezyBillModal(state) {
  const { activeOutlet, yeezyBillSettings = {} } = state;
  const terminalId = yeezyBillSettings.terminalId || 'YB-TERM-0941';
  const autoRedeem = yeezyBillSettings.autoRedeemPoints ?? true;
  const printPoints = yeezyBillSettings.printPointsOnBill ?? true;
  const whatsappReceipt = yeezyBillSettings.enableWhatsAppReceipt ?? true;
  const offlineMode = yeezyBillSettings.offlineMode ?? true;
  const autoKds = yeezyBillSettings.autoPrintKds ?? true;

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div class="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 font-sans">
        
        <!-- Modal Top Bar -->
        <div class="px-7 pt-6 pb-4 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-xl shadow-inner">
              <span class="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-black tracking-tight">Yeezy Bill POS Configuration</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Native Live
                </span>
              </div>
              <p class="text-xs text-purple-200/80">Proprietary zero-latency cloud billing & KDS bridge</p>
            </div>
          </div>
          <button 
            id="btn-close-yeezy-bill-modal" 
            type="button" 
            class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          
          <!-- Terminal Status Card -->
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Terminal & Outlet Info</span>
              <span class="text-[11px] font-bold text-primary">v2.8.4 Enterprise</span>
            </div>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="bg-white p-3 rounded-xl border border-slate-200">
                <span class="text-[10px] text-slate-400 block font-bold">Terminal ID</span>
                <span class="font-mono font-bold text-slate-900 text-xs mt-0.5 block">${terminalId}</span>
              </div>
              <div class="bg-white p-3 rounded-xl border border-slate-200">
                <span class="text-[10px] text-slate-400 block font-bold">Assigned Outlet</span>
                <span class="font-bold text-slate-900 text-xs mt-0.5 block truncate">${activeOutlet}</span>
              </div>
              <div class="bg-white p-3 rounded-xl border border-slate-200">
                <span class="text-[10px] text-slate-400 block font-bold">Engine Latency</span>
                <span class="font-bold text-emerald-600 text-xs mt-0.5 block flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> &lt; 5ms (Local Sync)
                </span>
              </div>
              <div class="bg-white p-3 rounded-xl border border-slate-200">
                <span class="text-[10px] text-slate-400 block font-bold">Points Engine</span>
                <span class="font-bold text-slate-900 text-xs mt-0.5 block">10% Points (Auto-credit)</span>
              </div>
            </div>
          </div>

          <!-- Feature Toggles -->
          <div class="space-y-3">
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block">Billing Checkout Settings</span>

            <!-- Toggle 1 -->
            <label class="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 transition cursor-pointer bg-white">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-purple-600 text-xl mt-0.5">wallet</span>
                <div>
                  <div class="font-bold text-slate-900">Auto-prompt Loyalty Discounts at Checkout</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">When cashier types customer phone number, available loyalty points and ₹ off vouchers pop up automatically on the terminal.</div>
                </div>
              </div>
              <input type="checkbox" id="toggle-yb-auto-redeem" class="mt-1 w-4 h-4 accent-purple-600 rounded" ${autoRedeem ? 'checked' : ''}>
            </label>

            <!-- Toggle 2 -->
            <label class="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 transition cursor-pointer bg-white">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-purple-600 text-xl mt-0.5">print</span>
                <div>
                  <div class="font-bold text-slate-900">Print Loyalty Balance on Thermal Bill</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">Automatically prints diner's total points, points earned on this meal, and next tier unlock at the bottom of printed receipt.</div>
                </div>
              </div>
              <input type="checkbox" id="toggle-yb-print-points" class="mt-1 w-4 h-4 accent-purple-600 rounded" ${printPoints ? 'checked' : ''}>
            </label>

            <!-- Toggle 3 -->
            <label class="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 transition cursor-pointer bg-white">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-purple-600 text-xl mt-0.5">chat</span>
                <div>
                  <div class="font-bold text-slate-900">Instant WhatsApp E-Bill & Loyalty Stamp</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">Sends a high-resolution interactive digital receipt with loyalty point stamps to customer's WhatsApp upon bill settlement.</div>
                </div>
              </div>
              <input type="checkbox" id="toggle-yb-whatsapp" class="mt-1 w-4 h-4 accent-purple-600 rounded" ${whatsappReceipt ? 'checked' : ''}>
            </label>

            <!-- Toggle 4 -->
            <label class="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 transition cursor-pointer bg-white">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-purple-600 text-xl mt-0.5">wifi_off</span>
                <div>
                  <div class="font-bold text-slate-900">Offline Resilience Cache</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">If internet connection is lost, stores punches locally on terminal and auto-syncs when online.</div>
                </div>
              </div>
              <input type="checkbox" id="toggle-yb-offline" class="mt-1 w-4 h-4 accent-purple-600 rounded" ${offlineMode ? 'checked' : ''}>
            </label>
          </div>



        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button 
            id="btn-yb-close-footer" 
            type="button" 
            class="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition"
          >
            Close
          </button>
          <button 
            id="btn-yb-save-settings" 
            type="button" 
            class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white font-bold transition shadow-md flex items-center gap-1.5 active:scale-95"
          >
            <span class="material-symbols-outlined text-sm">check</span>
            <span>Save Settings</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

export function attachYeezyBillModalListeners() {
  const closeBtn = document.getElementById('btn-close-yeezy-bill-modal');
  const footerCloseBtn = document.getElementById('btn-yb-close-footer');
  const saveBtn = document.getElementById('btn-yb-save-settings');

  const closeModal = () => store.setUIState({ activeModal: null });

  if (closeBtn) closeBtn.onclick = closeModal;
  if (footerCloseBtn) footerCloseBtn.onclick = closeModal;

  if (saveBtn) {
    saveBtn.onclick = () => {
      const autoRedeem = document.getElementById('toggle-yb-auto-redeem')?.checked ?? true;
      const printPoints = document.getElementById('toggle-yb-print-points')?.checked ?? true;
      const whatsappReceipt = document.getElementById('toggle-yb-whatsapp')?.checked ?? true;
      const offlineMode = document.getElementById('toggle-yb-offline')?.checked ?? true;

      store.updateYeezyBillSettings({
        autoRedeemPoints: autoRedeem,
        printPointsOnBill: printPoints,
        enableWhatsAppReceipt: whatsappReceipt,
        offlineMode: offlineMode
      });

      showToast('Yeezy Bill POS settings saved successfully!');
      closeModal();
    };
  }
}
