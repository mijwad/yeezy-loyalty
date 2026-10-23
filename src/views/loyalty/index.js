// Activate Loyalty / Choose Program Type View Module
import { store } from '../../state/store.js';

export function renderActivateLoyalty(state) {
  const { loyaltyProgram } = state;

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <!-- Top Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Choose Loyalty Type</h2>
            ${loyaltyProgram.isActive ? `
              <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ● Active Program: ${loyaltyProgram.title}
              </span>
            ` : ''}
          </div>
          <p class="text-gray-500 text-xs md:text-sm mt-1">
            Find your ideal loyalty program and customize it to match your restaurant brand!
          </p>
        </div>

        <a 
          href="#configurator" 
          class="inline-flex items-center gap-2 px-5 py-2.5 bg-[#008489] hover:bg-[#006e72] text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95"
        >
          <span class="material-symbols-outlined text-base">edit</span>
          Open Program Configurator
        </a>
      </div>

      <!-- Loyalty Type Cards Grid -->
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mt-2">
        
        <!-- CARD 1: Cashback -->
        <div class="bg-[#edf9f7] rounded-3xl p-6 md:p-8 flex flex-col justify-between border border-[#ddf2ef] shadow-sm hover:shadow-md transition">
          <div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-[#009b86] flex items-center justify-center text-white shadow-sm">
                <span class="material-symbols-outlined text-xl">payments</span>
              </div>
              <h3 class="text-xl font-bold text-gray-900">Cashback</h3>
            </div>
            <p class="text-gray-700 text-xs md:text-sm mt-3 leading-relaxed">
              Customers receive a percentage of their purchase amount as cashback into their dining wallet.
            </p>
            <div class="mt-4 p-3 rounded-xl bg-white/70 border border-[#ddf2ef] text-xs text-gray-700">
              <div class="font-bold text-[#009b86] mb-1">Example: "The Nini's Club"</div>
              <div>5% cashback on bills above ₹500, redeemable on subsequent dining visits.</div>
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-[#ddf2ef]/80">
            <button 
              type="button"
              class="w-full py-2.5 px-4 rounded-xl border-2 border-[#009b86] text-[#009b86] hover:bg-[#009b86] hover:text-white font-bold text-xs transition"
              onclick="window.showToast('Selected Cashback loyalty model!')"
            >
              Select Cashback Model
            </button>
          </div>
        </div>

        <!-- CARD 2: Amount Spent (Featured / Default) -->
        <div class="bg-gradient-to-b from-[#f5f3ff] to-white rounded-3xl p-6 md:p-8 flex flex-col justify-between border-2 border-primary-container shadow-md hover:shadow-lg transition relative overflow-hidden">
          <div class="absolute top-3 right-3 bg-primary text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm">
            Recommended
          </div>
          <div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-sm">
                <span class="material-symbols-outlined text-xl">receipt_long</span>
              </div>
              <div>
                <h3 class="text-xl font-bold text-gray-900">Amount Spent</h3>
                <span class="text-[11px] text-primary font-bold">Points Based Loyalty</span>
              </div>
            </div>
            <p class="text-gray-700 text-xs md:text-sm mt-3 leading-relaxed">
              Customers earn points for every rupee spent, which they can accumulate and redeem for food items, percentage discounts, or vouchers.
            </p>
            <div class="mt-4 p-3 rounded-xl bg-purple-50/80 border border-purple-100 text-xs text-gray-700">
              <div class="font-bold text-primary mb-1">Example: "GAUTAMS O DINE Rewards"</div>
              <div>₹100 Spent = 10 Points. Free dessert at 500 pts, Flat 15% OFF at 1,500 pts.</div>
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-purple-100 flex flex-col gap-2">
            <button 
              id="btn-open-amount-spent-modal" 
              type="button" 
              class="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs transition shadow-md flex items-center justify-center gap-1.5 active:scale-95"
            >
              <span class="material-symbols-outlined text-sm">visibility</span>
              Preview & Configure Amount Spent
            </button>
            <a 
              href="#configurator" 
              class="w-full py-2 px-4 rounded-xl text-center text-xs font-bold text-primary hover:underline"
            >
              Skip to Full Editor →
            </a>
          </div>
        </div>

        <!-- CARD 3: Visits Based -->
        <div class="bg-[#fffbeb] rounded-3xl p-6 md:p-8 flex flex-col justify-between border border-[#fef3c7] shadow-sm hover:shadow-md transition">
          <div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center text-white shadow-sm">
                <span class="material-symbols-outlined text-xl">local_activity</span>
              </div>
              <h3 class="text-xl font-bold text-gray-900">Visit / Punch Card</h3>
            </div>
            <p class="text-gray-700 text-xs md:text-sm mt-3 leading-relaxed">
              Guests earn a digital punch/stamp each time they dine. Reward unlocks after every 5th or 10th dining visit.
            </p>
            <div class="mt-4 p-3 rounded-xl bg-white/70 border border-[#fef3c7] text-xs text-gray-700">
              <div class="font-bold text-amber-700 mb-1">Example: "Diner Stamp Club"</div>
              <div>Get 1 stamp per visit with bill &gt; ₹300. 5th visit: 50% OFF appetizer. 10th visit: Free entree!</div>
            </div>
          </div>
          <div class="mt-6 pt-4 border-t border-[#fef3c7]">
            <button 
              type="button"
              class="w-full py-2.5 px-4 rounded-xl border-2 border-amber-600 text-amber-700 hover:bg-amber-600 hover:text-white font-bold text-xs transition"
              onclick="window.showToast('Selected Visit Stamp model!')"
            >
              Select Visit Model
            </button>
          </div>
        </div>

      </section>
    </div>
  `;
}

export function attachActivateLoyaltyListeners() {
  const openBtn = document.getElementById('btn-open-amount-spent-modal');
  if (openBtn) {
    openBtn.onclick = () => {
      store.setUIState({ activeModal: 'amountSpent' });
    };
  }
}
