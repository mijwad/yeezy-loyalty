// Refill Credits Modal Component with co-located event handling
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';

export function renderRefillModal() {
  return `
    <div id="refillModalOverlay" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div 
        class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-100 animate-in zoom-in-95 duration-200"
        onclick="event.stopPropagation()"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-2xl text-[#00897B]">paid</span>
            <h3 class="text-xl font-bold text-slate-900">Refill Communication Credits</h3>
          </div>
          <button id="btn-close-refill-modal" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center" type="button">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <p class="text-xs text-slate-500 mb-6">
          Credits power your automated SMS notifications and verified WhatsApp loyalty messages.
        </p>

        <!-- Credit Packages -->
        <div class="space-y-3 mb-6">
          <label class="refill-option block p-4 rounded-2xl border-2 border-[#00897B] bg-teal-50/50 cursor-pointer transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <input type="radio" name="refillPackage" value="1000" checked class="text-[#00897B] focus:ring-[#00897B]">
                <div>
                  <div class="text-sm font-extrabold text-slate-900">1,000 Credits</div>
                  <div class="text-[11px] text-slate-500">Popular for mid-size bistros</div>
                </div>
              </div>
              <span class="text-sm font-black text-[#00897B]">₹799</span>
            </div>
          </label>

          <label class="refill-option block p-4 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <input type="radio" name="refillPackage" value="2500" class="text-[#00897B] focus:ring-[#00897B]">
                <div>
                  <div class="text-sm font-extrabold text-slate-900">2,500 Credits</div>
                  <div class="text-[11px] text-slate-500">Save 20% on bulk message tier</div>
                </div>
              </div>
              <span class="text-sm font-black text-slate-900">₹1,599</span>
            </div>
          </label>

          <label class="refill-option block p-4 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <input type="radio" name="refillPackage" value="5000" class="text-[#00897B] focus:ring-[#00897B]">
                <div>
                  <div class="text-sm font-extrabold text-slate-900">5,000 Credits</div>
                  <div class="text-[11px] text-slate-500">Multi-outlet high volume package</div>
                </div>
              </div>
              <span class="text-sm font-black text-slate-900">₹2,899</span>
            </div>
          </label>
        </div>

        <button 
          id="btn-confirm-refill" 
          type="button" 
          class="w-full py-3.5 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-extrabold text-sm transition shadow-md active:scale-95"
        >
          Confirm & Add Credits
        </button>
      </div>
    </div>
  `;
}

export function attachRefillModalListeners() {
  const closeBtn = document.getElementById('btn-close-refill-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const overlay = document.getElementById('refillModalOverlay');
  if (overlay) {
    overlay.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const confirmBtn = document.getElementById('btn-confirm-refill');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const selectedPkg = document.querySelector('input[name="refillPackage"]:checked');
      const amount = selectedPkg ? parseInt(selectedPkg.value, 10) : 1000;
      store.setState(s => ({
        ...s,
        creditsBalance: {
          ...s.creditsBalance,
          sms: s.creditsBalance.sms + amount,
          email: s.creditsBalance.email + amount,
          whatsappUtility: s.creditsBalance.whatsappUtility + amount,
          whatsappMarketing: s.creditsBalance.whatsappMarketing + amount
        }
      }));
      store.setUIState({ activeModal: null });
      showToast(`Successfully added ${amount} messaging credits to your wallet!`);
    };
  }
}
