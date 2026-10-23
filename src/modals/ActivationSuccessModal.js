// Activation Success Celebration Modal Component with co-located event handling
import { store } from '../state/store.js';

export function renderActivationSuccessModal(programName) {
  return `
    <div id="activationSuccessModalOverlay" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div 
        class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 border border-slate-100 text-center animate-in zoom-in-95 duration-300"
        onclick="event.stopPropagation()"
      >
        <div class="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
          <span class="material-symbols-outlined text-5xl">celebration</span>
        </div>
        <h3 class="text-2xl font-black text-slate-900 tracking-tight">Loyalty Program Activated!</h3>
        <p class="text-xs text-slate-500 mt-2 leading-relaxed">
          <strong>${programName}</strong> is now live for all dine-in and takeaway guests. Points will automatically credit to customers upon bill settlement.
        </p>

        <div class="my-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-left space-y-2">
          <div class="flex items-center gap-2 text-emerald-800 font-bold">
            <span class="material-symbols-outlined text-base">check_circle</span>
            POS Webhook Connected
          </div>
          <div class="flex items-center gap-2 text-emerald-800 font-bold">
            <span class="material-symbols-outlined text-base">check_circle</span>
            WhatsApp & SMS Triggers Active
          </div>
          <div class="flex items-center gap-2 text-emerald-800 font-bold">
            <span class="material-symbols-outlined text-base">check_circle</span>
            Reward Vouchers Ready to Redeem
          </div>
        </div>

        <button 
          id="btn-close-activation-success" 
          type="button" 
          class="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition shadow-md"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  `;
}

export function attachActivationSuccessModalListeners() {
  const closeBtn = document.getElementById('btn-close-activation-success');
  if (closeBtn) {
    closeBtn.onclick = () => {
      store.setUIState({ activeModal: null });
      window.location.hash = '#dashboard';
    };
  }
}
