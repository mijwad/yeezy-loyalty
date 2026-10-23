// Auto-Refill Settings Modal Component with co-located event handling
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';

export function renderAutoRefillModal(state) {
  const { creditsBalance } = state;

  return `
    <div id="autoRefillModalOverlay" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div 
        class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-100 animate-in zoom-in-95 duration-200"
        onclick="event.stopPropagation()"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-2xl text-[#009688]">bolt</span>
            <h3 class="text-xl font-bold text-slate-900">Auto-Refill Settings</h3>
          </div>
          <button id="btn-close-auto-refill-modal" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center" type="button">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <p class="text-xs text-slate-500 mb-6">
          Never miss an automated loyalty SMS or WhatsApp during busy dinner rush hours by auto-replenishing credits.
        </p>

        <div class="space-y-4 mb-6">
          <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div>
              <span class="text-xs font-bold text-slate-900 block">Enable Auto-Refill</span>
              <span class="text-[11px] text-slate-500">Automatically charges saved payment method</span>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input id="toggle-auto-refill-enabled" type="checkbox" ${creditsBalance.autoRefillEnabled ? 'checked' : ''} class="sr-only peer">
              <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009688]"></div>
            </label>
          </div>

          <div>
            <label class="text-[10px] uppercase font-bold text-slate-500 block mb-1">When Balance Drops Below:</label>
            <select id="select-auto-refill-threshold" class="w-full px-3 py-2 text-xs font-bold border rounded-xl bg-white">
              <option value="20" ${creditsBalance.autoRefillThreshold === 20 ? 'selected' : ''}>20 Credits</option>
              <option value="50" ${creditsBalance.autoRefillThreshold === 50 ? 'selected' : ''}>50 Credits</option>
              <option value="100" ${creditsBalance.autoRefillThreshold === 100 ? 'selected' : ''}>100 Credits</option>
            </select>
          </div>

          <div>
            <label class="text-[10px] uppercase font-bold text-slate-500 block mb-1">Auto-Add Amount:</label>
            <select id="select-auto-refill-amount" class="w-full px-3 py-2 text-xs font-bold border rounded-xl bg-white">
              <option value="500" ${creditsBalance.autoRefillAmount === 500 ? 'selected' : ''}>500 Credits (₹420)</option>
              <option value="1000" ${creditsBalance.autoRefillAmount === 1000 ? 'selected' : ''}>1,000 Credits (₹799)</option>
              <option value="2500" ${creditsBalance.autoRefillAmount === 2500 ? 'selected' : ''}>2,500 Credits (₹1,599)</option>
            </select>
          </div>
        </div>

        <button 
          id="btn-save-auto-refill" 
          type="button" 
          class="w-full py-3.5 rounded-xl bg-[#009688] hover:bg-[#00796B] text-white font-extrabold text-sm transition shadow-md active:scale-95"
        >
          Save Settings
        </button>
      </div>
    </div>
  `;
}

export function attachAutoRefillModalListeners() {
  const closeBtn = document.getElementById('btn-close-auto-refill-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const overlay = document.getElementById('autoRefillModalOverlay');
  if (overlay) {
    overlay.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const saveBtn = document.getElementById('btn-save-auto-refill');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const toggle = document.getElementById('toggle-auto-refill-enabled');
      const threshold = document.getElementById('select-auto-refill-threshold');
      const amount = document.getElementById('select-auto-refill-amount');

      store.setState(s => ({
        ...s,
        creditsBalance: {
          ...s.creditsBalance,
          autoRefillEnabled: toggle ? toggle.checked : false,
          autoRefillThreshold: threshold ? parseInt(threshold.value, 10) : s.creditsBalance.autoRefillThreshold,
          autoRefillAmount: amount ? parseInt(amount.value, 10) : s.creditsBalance.autoRefillAmount
        }
      }));
      store.setUIState({ activeModal: null });
      showToast('Auto-refill settings saved successfully.');
    };
  }
}
