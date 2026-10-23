// Book Demo Modal Component with co-located event handling
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';

export function renderBookDemoModal() {
  return `
    <div id="bookDemoModalOverlay" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div 
        class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-100 animate-in zoom-in-95 duration-200"
        onclick="event.stopPropagation()"
      >
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-2xl text-primary">live_tv</span>
            <h3 class="text-xl font-bold text-slate-900">Book a 1-on-1 Yeezy Platform Demo</h3>
          </div>
          <button id="btn-close-demo-modal" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center" type="button">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <p class="text-xs text-slate-500 mb-6">
          See how leading restaurants generate +32% repeat diner revenue using Yeezy automated omni-channel loyalty programs.
        </p>

        <form id="demo-booking-form" class="space-y-4">
          <div>
            <label class="text-[10px] uppercase font-bold text-slate-500 block mb-1">Your Full Name</label>
            <input required type="text" value="Alex Rivera" class="w-full px-3.5 py-2.5 text-xs font-semibold border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none">
          </div>
          <div>
            <label class="text-[10px] uppercase font-bold text-slate-500 block mb-1">Restaurant / Outlet Name</label>
            <input required type="text" value="Downtown Bistro" class="w-full px-3.5 py-2.5 text-xs font-semibold border rounded-xl focus:ring-2 focus:ring-primary focus:outline-none">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[10px] uppercase font-bold text-slate-500 block mb-1">Preferred Date</label>
              <input required type="date" value="2026-10-23" class="w-full px-3 py-2 text-xs font-semibold border rounded-xl">
            </div>
            <div>
              <label class="text-[10px] uppercase font-bold text-slate-500 block mb-1">Preferred Time</label>
              <select class="w-full px-3 py-2 text-xs font-semibold border rounded-xl">
                <option>02:00 PM IST</option>
                <option>04:30 PM IST</option>
                <option>07:00 PM IST</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-[10px] uppercase font-bold text-slate-500 block mb-1">Phone Number for WhatsApp Invite</label>
            <input required type="tel" value="+91 98201 12345" class="w-full px-3.5 py-2.5 text-xs font-semibold border rounded-xl">
          </div>

          <div class="pt-2">
            <button 
              type="submit" 
              class="w-full py-3.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-extrabold text-sm transition shadow-lg active:scale-95"
            >
              Confirm Demo Reservation
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function attachBookDemoModalListeners() {
  const closeBtn = document.getElementById('btn-close-demo-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const overlay = document.getElementById('bookDemoModalOverlay');
  if (overlay) {
    overlay.onclick = () => {
      store.setUIState({ activeModal: null });
    };
  }

  const form = document.getElementById('demo-booking-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      store.setUIState({ activeModal: null });
      showToast('Demo scheduled successfully! Our restaurant onboarding specialist will WhatsApp you.', 'success');
    };
  }
}
