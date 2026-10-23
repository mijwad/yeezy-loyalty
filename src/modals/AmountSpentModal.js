// Amount Spent Modal Component matching Stitch exact layout & carousel
import { store } from '../state/store.js';

export function renderAmountSpentModal(currentSlide = 0) {
  const slides = [
    {
      channel: 'WhatsApp',
      icon: 'call',
      iconColor: 'text-[#00796B]',
      headline: 'WhatsApp VIP Notification',
      sender: 'Downtown Bistro • Verified Business',
      time: 'Just now',
      message: 'Hello Marcus! 🎉 Thank you for dining with us today. You have earned 284 Yeezy loyalty points on bill #9021. Your total balance is now 4,200 points.',
      cta: 'View My Rewards & Redeem'
    },
    {
      channel: 'SMS',
      icon: 'chat_bubble',
      iconColor: 'text-[#2563EB]',
      headline: 'SMS Instant Notification',
      sender: 'DWNTWN',
      time: '1 min ago',
      message: 'Downtown Bistro: Marcus, you earned 284 points on your order of ₹2,840. Total points: 4,200 pts. Check rewards: bit.ly/dwntwn-loyalty',
      cta: 'bit.ly/dwntwn-loyalty'
    },
    {
      channel: 'Email',
      icon: 'mail',
      iconColor: 'text-[#EA580C]',
      headline: 'Email Dining Statement',
      sender: 'loyalty@downtownbistro.com',
      time: '5 mins ago',
      message: 'Your dining statement is ready! You have unlocked Tier 2: ₹125 OFF Dining Voucher. Use it on your next reservation with code YEEZY125.',
      cta: 'Claim Voucher Now'
    }
  ];

  const slide = slides[currentSlide % slides.length];

  return `
    <div 
      id="amountSpentModalOverlay" 
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-[4px] flex items-center justify-center p-4 sm:p-6 transition-opacity duration-200 animate-fade-in"
    >
      <div 
        class="relative bg-white w-full max-w-[1020px] rounded-[28px] shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[560px] border border-gray-100 animate-in zoom-in-95 duration-200"
        onclick="event.stopPropagation()"
      >
        <!-- Top-Right Close Button -->
        <button 
          id="btn-close-amount-spent-modal" 
          aria-label="Close modal" 
          class="absolute top-5 right-5 z-30 w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center transition shadow-sm"
          type="button"
        >
          <span class="material-symbols-outlined text-lg">close</span>
        </button>

        <!-- Left Column: Headline and CTA -->
        <div class="w-full md:w-[46%] p-8 sm:p-12 lg:p-14 flex flex-col justify-between z-10 bg-white">
          <div>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed/40 text-primary text-xs font-bold mb-4">
              <span class="material-symbols-outlined text-sm">stars</span>
              Amount Spent Loyalty
            </div>
            <h2 class="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-[1.15]">
              Reward diners automatically on every purchase.
            </h2>
            <p class="mt-4 text-sm sm:text-base text-gray-600 leading-relaxed">
              Your customers receive loyalty messages via SMS, WhatsApp & Email the moment their bill is printed. Drive recurring visits with zero staff intervention.
            </p>
          </div>

          <div class="pt-8">
            <button 
              id="btn-proceed-to-configurator"
              class="w-full sm:w-auto px-8 py-3.5 bg-[#00796B] hover:bg-[#00695C] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm tracking-wide flex items-center justify-center gap-2" 
              type="button"
            >
              <span>Setup Amount Spent Program</span>
              <span class="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>

        <!-- Right Column: Interactive Phone Mockup Carousel -->
        <div class="w-full md:w-[54%] bg-gradient-to-br from-[#EDE9FE] via-[#F3E8FF] to-[#FAF5FF] p-8 flex flex-col items-center justify-center relative overflow-hidden">
          
          <!-- Carousel Navigation Arrows -->
          <button 
            id="carousel-prev-btn"
            class="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-md flex items-center justify-center transition z-20"
            type="button"
          >
            <span class="material-symbols-outlined text-xl">chevron_left</span>
          </button>

          <button 
            id="carousel-next-btn"
            class="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white text-gray-700 shadow-md flex items-center justify-center transition z-20"
            type="button"
          >
            <span class="material-symbols-outlined text-xl">chevron_right</span>
          </button>

          <!-- Smartphone Shell Mockup -->
          <div class="w-[300px] h-[480px] bg-slate-900 rounded-[38px] p-3 shadow-2xl ring-1 ring-slate-800/50 flex flex-col relative transform hover:scale-[1.01] transition duration-300">
            <!-- Screen Notch / Speaker -->
            <div class="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
              <div class="w-3 h-3 rounded-full bg-slate-700 mr-2"></div>
              <div class="w-8 h-1.5 rounded-full bg-slate-700"></div>
            </div>

            <!-- Screen Content -->
            <div class="flex-1 bg-white rounded-[28px] overflow-hidden flex flex-col justify-between p-4 relative shadow-inner">
              <!-- Top bar with channel badge -->
              <div class="flex items-center justify-between pb-3 border-b border-gray-100">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-lg ${slide.iconColor}">${slide.icon}</span>
                  <span class="text-xs font-bold text-gray-900">${slide.channel}</span>
                </div>
                <span class="text-[10px] text-gray-400 font-medium">${slide.time}</span>
              </div>

              <!-- Message Bubble -->
              <div class="my-auto py-2">
                <div class="bg-gray-50 border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                  <div class="flex items-center gap-1 text-[11px] font-bold text-gray-800">
                    <span class="material-symbols-outlined text-emerald-600 text-sm">verified</span>
                    <span>${slide.sender}</span>
                  </div>
                  <p class="text-xs text-gray-700 leading-relaxed">
                    ${slide.message}
                  </p>
                  <div class="mt-2 pt-2 border-t border-gray-200">
                    <div class="w-full text-center py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-xs">
                      ${slide.cta}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom Indicator -->
              <div class="text-center">
                <span class="text-[10px] text-gray-400 font-semibold">Slide ${(currentSlide % 3) + 1} of 3</span>
              </div>
            </div>
          </div>

          <!-- Carousel Dots -->
          <div class="flex items-center gap-2 mt-4 z-10">
            ${slides.map((_, i) => `
              <button 
                data-slide-index="${i}" 
                class="carousel-dot-btn w-2.5 h-2.5 rounded-full transition-all ${i === (currentSlide % 3) ? 'w-6 bg-primary' : 'bg-gray-300 hover:bg-gray-400'}"
                type="button"
              ></button>
            `).join('')}
          </div>

        </div>
      </div>
    </div>
  `;
}

export function attachAmountSpentModalListeners() {
  const closeBtn = document.getElementById('btn-close-amount-spent-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const overlay = document.getElementById('amountSpentModalOverlay');
  if (overlay) {
    overlay.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const prevBtn = document.getElementById('carousel-prev-btn');
  const nextBtn = document.getElementById('carousel-next-btn');
  if (prevBtn) {
    prevBtn.onclick = () => {
      store.setUIState(ui => ({
        ...ui,
        amountSpentSlide: (ui.amountSpentSlide - 1 + 3) % 3
      }));
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      store.setUIState(ui => ({
        ...ui,
        amountSpentSlide: (ui.amountSpentSlide + 1) % 3
      }));
    };
  }

  document.querySelectorAll('.carousel-dot-btn').forEach(dot => {
    dot.onclick = () => {
      const idx = parseInt(dot.getAttribute('data-slide-index'), 10);
      store.setUIState({ amountSpentSlide: idx });
    };
  });

  const proceedBtn = document.getElementById('btn-proceed-to-configurator');
  if (proceedBtn) {
    proceedBtn.onclick = () => {
      store.setUIState({ activeModal: null });
      window.location.hash = '#configurator';
    };
  }
}
