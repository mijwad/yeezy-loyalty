// Messaging Credits Balance Deck Component
import { store } from '../../state/store.js';

export function renderCreditsCard(creditsBalance) {
  return `
    <div class="w-full flex flex-col gap-space-md">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-2xl text-on-surface">paid</span>
          <h3 class="text-xl md:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-1.5">
            Your Credits Balance 
            <span class="material-symbols-outlined text-base text-outline cursor-help" title="Credits are used for sending automated WhatsApp, SMS, and Email campaigns">info</span>
          </h3>
        </div>
        <div class="flex items-center gap-3">
          <button 
            id="btn-auto-refill-modal" 
            type="button" 
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container-lowest border-2 border-[#009688] text-[#00796B] font-bold text-xs hover:bg-[#E0F2F1] transition-colors shadow-sm active:scale-95"
          >
            <span class="material-symbols-outlined text-base">bolt</span> 
            Auto Refill Credits
          </button>
          <button 
            id="btn-refill-credits-modal" 
            type="button" 
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#00897B] hover:bg-[#00796B] text-white font-bold text-xs transition-colors shadow-sm active:scale-95"
          >
            <span class="material-symbols-outlined text-base">shopping_cart</span> 
            Refill Credits
          </button>
        </div>
      </div>

      <div class="p-space-lg rounded-2xl bg-surface-container-low/60 border border-outline-variant/30 shadow-sm">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
          <!-- SMS Credits -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/20 shadow-sm flex flex-col justify-between min-h-[108px] hover:shadow transition">
            <span class="text-3xl font-extrabold text-on-surface">${creditsBalance.sms}</span>
            <div class="flex items-center gap-1.5 text-xs font-bold text-on-surface mt-2">
              <span class="material-symbols-outlined text-[#2563EB] text-lg">chat_bubble</span>
              <span>SMS Credits</span>
            </div>
          </div>

          <!-- Email Credits -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/20 shadow-sm flex flex-col justify-between min-h-[108px] hover:shadow transition">
            <span class="text-3xl font-extrabold text-on-surface">${creditsBalance.email}</span>
            <div class="flex items-center gap-1.5 text-xs font-bold text-on-surface mt-2">
              <span class="material-symbols-outlined text-[#EA580C] text-lg">mail</span>
              <span>Email Credits</span>
            </div>
          </div>

          <!-- WhatsApp Utility -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/20 shadow-sm flex flex-col justify-between min-h-[108px] hover:shadow transition">
            <span class="text-3xl font-extrabold text-on-surface">${creditsBalance.whatsappUtility}</span>
            <div class="flex items-center gap-1.5 text-xs font-bold text-on-surface mt-2">
              <span class="material-symbols-outlined text-[#00796B] text-lg">call</span>
              <span class="text-on-surface underline decoration-dashed decoration-secondary/40 cursor-pointer">Whatsapp Utility</span>
            </div>
          </div>

          <!-- WhatsApp Marketing -->
          <div class="bg-surface-container-lowest rounded-xl p-space-md border border-outline-variant/20 shadow-sm flex flex-col justify-between min-h-[108px] hover:shadow transition">
            <span class="text-3xl font-extrabold text-on-surface">${creditsBalance.whatsappMarketing}</span>
            <div class="flex items-center gap-1.5 text-xs font-bold text-on-surface mt-2">
              <span class="material-symbols-outlined text-[#DB2777] text-lg">call</span>
              <span class="text-on-surface underline decoration-dashed decoration-secondary/40 cursor-pointer">Whatsapp Marketing</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function attachCreditsListeners() {
  const refillBtn = document.getElementById('btn-refill-credits-modal');
  if (refillBtn) {
    refillBtn.onclick = () => {
      store.setUIState({ activeModal: 'refill' });
    };
  }

  const autoRefillBtn = document.getElementById('btn-auto-refill-modal');
  if (autoRefillBtn) {
    autoRefillBtn.onclick = () => {
      store.setUIState({ activeModal: 'autoRefill' });
    };
  }
}
