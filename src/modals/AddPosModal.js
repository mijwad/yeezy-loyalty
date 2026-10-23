// Modal to add ANY POS platform as a card
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';

export function renderAddPosModal(state) {
  const { activeOutlet, outlets = [] } = state;

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div class="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8 font-sans">
        
        <!-- Modal Top Bar -->
        <div class="px-7 pt-6 pb-4 bg-gradient-to-r from-slate-900 via-primary to-slate-900 text-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white font-black text-xl shadow-inner">
              <span class="material-symbols-outlined text-2xl">add_business</span>
            </div>
            <div>
              <h2 class="text-base font-black tracking-tight">Connect New POS Platform</h2>
              <p class="text-xs text-white/80">Add any billing terminal, cloud RMS, or aggregator as a live card</p>
            </div>
          </div>
          <button 
            id="btn-close-add-pos-modal" 
            type="button" 
            class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div class="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700">
          
          <!-- Preset quick buttons -->
          <div>
            <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 block mb-2">
              Popular POS Platforms (Click to Prefill)
            </label>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="preset-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-primary/10 hover:border-primary/40 text-slate-800 font-bold transition flex items-center gap-1.5 text-xs" data-name="CaptainBiz POS" data-tagline="Cloud Billing & GST Accounting" data-icon="receipt" data-color="emerald">
                <span>CaptainBiz</span>
              </button>
              <button type="button" class="preset-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-primary/10 hover:border-primary/40 text-slate-800 font-bold transition flex items-center gap-1.5 text-xs" data-name="SlickPOS" data-tagline="Restaurant Billing & Kitchen Display" data-icon="table_restaurant" data-color="blue">
                <span>SlickPOS</span>
              </button>
              <button type="button" class="preset-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-primary/10 hover:border-primary/40 text-slate-800 font-bold transition flex items-center gap-1.5 text-xs" data-name="Torfus POS" data-tagline="Next-gen Restaurant Management" data-icon="store" data-color="purple">
                <span>Torfus</span>
              </button>
              <button type="button" class="preset-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-primary/10 hover:border-primary/40 text-slate-800 font-bold transition flex items-center gap-1.5 text-xs" data-name="Square POS" data-tagline="Modern Card Reader & Terminal" data-icon="credit_card" data-color="slate">
                <span>Square</span>
              </button>
              <button type="button" class="preset-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-primary/10 hover:border-primary/40 text-slate-800 font-bold transition flex items-center gap-1.5 text-xs" data-name="Toast POS" data-tagline="Restaurant Management & Handhelds" data-icon="local_dining" data-color="amber">
                <span>Toast</span>
              </button>
              <button type="button" class="preset-pos-btn px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-primary/10 hover:border-primary/40 text-slate-800 font-bold transition flex items-center gap-1.5 text-xs" data-name="Custom POS Terminal" data-tagline="Proprietary In-House Billing System" data-icon="developer_board" data-color="indigo">
                <span>+ Custom RMS</span>
              </button>
            </div>
          </div>

          <!-- Platform Name -->
          <div>
            <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block mb-1">POS Platform Name *</label>
            <input 
              id="input-pos-name" 
              type="text" 
              placeholder="e.g. CaptainBiz POS, Shawarma POS, Yeezy Bill Terminal 2" 
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-primary bg-slate-50/50"
            />
          </div>

          <!-- Tagline / Subtitle -->
          <div>
            <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block mb-1">Tagline or Description</label>
            <input 
              id="input-pos-tagline" 
              type="text" 
              placeholder="e.g. Cloud Billing Machine & Real-Time Kitchen Display" 
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-700 focus:outline-none focus:border-primary bg-slate-50/50"
            />
          </div>

          <!-- Grid: Category & Outlet -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block mb-1">Category</label>
              <select id="select-pos-category" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-primary">
                <option value="pos">POS Billing Terminal</option>
                <option value="aggregator">Food Aggregator / Online</option>
                <option value="kiosk">Self-Ordering Kiosk</option>
                <option value="api">Custom Webhook API</option>
              </select>
            </div>

            <div>
              <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block mb-1">Assigned Outlet</label>
              <select id="select-pos-outlet" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:border-primary">
                ${outlets.map(o => `<option value="${o.name}" ${o.name === activeOutlet ? 'selected' : ''}>${o.name}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Terminal ID / POS Identifier -->
          <div>
            <label class="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block mb-1">POS Outlet / Terminal Identifier</label>
            <input 
              id="input-pos-terminal-id" 
              type="text" 
              placeholder="e.g. CB_DEL_401, TERM_02, REST_992" 
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-primary bg-slate-50/50"
            />
          </div>

          <!-- Integration Mode & Webhook Endpoint -->
          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span class="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 block">Integration Sync Mode</span>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pos-mode" value="webhook" checked class="accent-primary" />
                <span class="font-bold text-slate-800">REST Webhook Adapter</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="pos-mode" value="direct" class="accent-primary" />
                <span class="font-bold text-slate-800">Direct Terminal Link</span>
              </label>
            </div>
            <p class="text-[11px] text-slate-500 leading-relaxed">
              Yeezy automatically provides webhooks to receive bills from this platform at <span class="font-mono text-primary font-bold">/api/v1/pos/orders/save</span>.
            </p>
          </div>

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button 
            id="btn-cancel-add-pos" 
            type="button" 
            class="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button 
            id="btn-save-new-pos" 
            type="button" 
            class="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition shadow-md flex items-center gap-1.5 active:scale-95"
          >
            <span class="material-symbols-outlined text-sm">add_circle</span>
            <span>Add POS Card</span>
          </button>
        </div>

      </div>
    </div>
  `;
}

export function attachAddPosModalListeners() {
  const closeBtn = document.getElementById('btn-close-add-pos-modal');
  const cancelBtn = document.getElementById('btn-cancel-add-pos');
  const saveBtn = document.getElementById('btn-save-new-pos');
  const nameInput = document.getElementById('input-pos-name');
  const taglineInput = document.getElementById('input-pos-tagline');
  const terminalInput = document.getElementById('input-pos-terminal-id');

  const closeModal = () => store.setUIState({ activeModal: null });

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;

  // Preset buttons
  document.querySelectorAll('.preset-pos-btn').forEach(btn => {
    btn.onclick = () => {
      const name = btn.getAttribute('data-name');
      const tagline = btn.getAttribute('data-tagline');
      if (nameInput) nameInput.value = name;
      if (taglineInput) taglineInput.value = tagline;
      if (terminalInput) {
        const shortCode = name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        terminalInput.value = `${shortCode}_TERM_${Math.floor(100 + Math.random() * 900)}`;
      }
    };
  });

  if (saveBtn) {
    saveBtn.onclick = () => {
      const name = nameInput?.value.trim();
      if (!name) {
        showToast('Please enter a POS platform name');
        nameInput?.focus();
        return;
      }

      const tagline = taglineInput?.value.trim() || 'Custom Restaurant POS System';
      const category = document.getElementById('select-pos-category')?.value || 'pos';
      const outlet = document.getElementById('select-pos-outlet')?.value || store.getState().activeOutlet;
      const terminalId = terminalInput?.value.trim() || `POS_${Math.floor(100 + Math.random() * 900)}`;

      const newId = `pos_custom_${Date.now()}`;
      const newCard = {
        id: newId,
        name: name,
        slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        tagline: tagline,
        category: category,
        categoryLabel: category === 'pos' ? 'POS Billing Terminal' : category === 'aggregator' ? 'Food Aggregator' : 'Custom Terminal',
        badge: 'Custom POS',
        icon: 'point_of_sale',
        iconBg: 'bg-gradient-to-tr from-slate-700 to-primary',
        iconColor: 'text-white',
        accentColor: '#0a7d74',
        isLive: true,
        statusText: `Connected (${terminalId})`,
        description: `Directly integrated with ${outlet}. Automatic order settlement, diner loyalty query, and bill ledger recording active.`,
        tags: ['Custom Webhook', 'Real-Time Sync', 'Auto-Punch'],
        outlet: `${outlet} (${terminalId})`,
        isDefault: false
      };

      store.addPosIntegration(newCard);
      showToast(`${name} card added and connected successfully!`);
      closeModal();
    };
  }
}
