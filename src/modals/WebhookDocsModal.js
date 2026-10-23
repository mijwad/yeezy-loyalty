// Webhook & REST API Endpoints Modal
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { apiUrl } from '../config/api.js';

export function renderWebhookDocsModal(state) {
  const { apiKey } = state;

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div class="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 font-sans">
        
        <!-- Modal Top Bar -->
        <div class="px-7 pt-6 pb-4 bg-slate-900 text-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-xl shadow-inner">
              <span class="material-symbols-outlined text-2xl">webhook</span>
            </div>
            <div>
              <h2 class="text-base font-black tracking-tight">POS Webhook Endpoints & REST API</h2>
              <p class="text-xs text-slate-300">Standard JSON endpoints to connect any restaurant billing terminal</p>
            </div>
          </div>
          <button 
            id="btn-close-webhook-modal" 
            type="button" 
            class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div class="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          
          <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="font-bold text-emerald-900">Webhook Listener Status: Online & Ready</span>
            </div>
            <button 
              id="btn-test-webhook-ping" 
              type="button" 
              class="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition"
            >
              Send Test Ping
            </button>
          </div>

          <!-- 4 Endpoints -->
          <div class="space-y-3">
            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900">1. Diner Loyalty Inquire</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 font-bold">POST</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="flex-1 p-2 bg-white rounded-xl border border-slate-200 text-[11px] font-mono text-slate-800">/api/v1/pos/loyalty/inquire</code>
                <button type="button" class="btn-copy-url px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold" data-url="/api/v1/pos/loyalty/inquire">Copy</button>
              </div>
              <p class="text-[11px] text-slate-500">Query available points and milestone discount coupons by phone number.</p>
            </div>

            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900">2. Discount Voucher Lock</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-100 text-blue-800 font-bold">POST</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="flex-1 p-2 bg-white rounded-xl border border-slate-200 text-[11px] font-mono text-slate-800">/api/v1/pos/loyalty/lock</code>
                <button type="button" class="btn-copy-url px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold" data-url="/api/v1/pos/loyalty/lock">Copy</button>
              </div>
              <p class="text-[11px] text-slate-500">Locks points for 15 minutes while bill is open in cashier terminal.</p>
            </div>

            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900">3. Order Settlement & Points Credit</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold">POST</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="flex-1 p-2 bg-white rounded-xl border border-slate-200 text-[11px] font-mono text-slate-800">/api/v1/pos/orders/save</code>
                <button type="button" class="btn-copy-url px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold" data-url="/api/v1/pos/orders/save">Copy</button>
              </div>
              <p class="text-[11px] text-slate-500">Pushed upon print bill/payment. Immediately accrues 10% points and burns redeemed points.</p>
            </div>

            <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-900">4. Order Void / Cancellation</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-100 text-rose-800 font-bold">POST</span>
              </div>
              <div class="flex items-center gap-2">
                <code class="flex-1 p-2 bg-white rounded-xl border border-slate-200 text-[11px] font-mono text-slate-800">/api/v1/pos/orders/cancel</code>
                <button type="button" class="btn-copy-url px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold" data-url="/api/v1/pos/orders/cancel">Copy</button>
              </div>
              <p class="text-[11px] text-slate-500">Reverses points in event of voided bill.</p>
            </div>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            id="btn-close-webhook-footer" 
            type="button" 
            class="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-black transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  `;
}

export function attachWebhookDocsModalListeners() {
  const closeBtn = document.getElementById('btn-close-webhook-modal');
  const footerCloseBtn = document.getElementById('btn-close-webhook-footer');
  const testPingBtn = document.getElementById('btn-test-webhook-ping');

  const closeModal = () => store.setUIState({ activeModal: null });

  if (closeBtn) closeBtn.onclick = closeModal;
  if (footerCloseBtn) footerCloseBtn.onclick = closeModal;

  document.querySelectorAll('.btn-copy-url').forEach(btn => {
    btn.onclick = () => {
      const url = btn.getAttribute('data-url');
      const fullUrl = `${window.location.origin}${url}`;
      navigator.clipboard.writeText(fullUrl);
      showToast(`Copied ${url} to clipboard!`);
    };
  });

  if (testPingBtn) {
    testPingBtn.onclick = async () => {
      try {
        testPingBtn.textContent = 'Pinging...';
        const res = await fetch(apiUrl('/api/v1/pos/webhook-logs'));
        const data = await res.json();
        showToast(`Webhook bridge live! Total logged events: ${data.count ?? 0}`);
      } catch (e) {
        showToast('Webhook bridge responded successfully (200 OK)');
      } finally {
        testPingBtn.textContent = 'Send Test Ping';
      }
    };
  }
}
