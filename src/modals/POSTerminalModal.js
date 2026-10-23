// Exact Petpooja POS Billing Screen & Reelo Loyalty Cashier Modal
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { apiUrl } from '../config/api.js';

let terminalState = {
  phone: '9687344309',
  name: 'Anushree M',
  billAmount: 385.00,
  tableNo: 'T-4',
  serverName: 'Vikram (Cashier)',
  showReeloModal: true,
  selectedOptionId: 'OPT_100_OFF',
  appliedDiscount: 0,
  appliedOption: null,
  otpState: 'INITIAL', // 'INITIAL' | 'OTP_SENT' | 'OTP_VERIFIED'
  otpCode: '6421',
  enteredOtp: '',
  availablePoints: 208,
  customerLookup: null,
  isSettling: false,
  settledOrder: null
};

export function renderPOSTerminalModal(state) {
  const { activeOutlet } = state;
  const { 
    phone, 
    name, 
    billAmount, 
    tableNo, 
    serverName,
    showReeloModal, 
    selectedOptionId, 
    appliedDiscount, 
    appliedOption,
    otpState,
    otpCode,
    enteredOtp,
    availablePoints,
    settledOrder 
  } = terminalState;

  // 1. Settled Order Thermal Receipt View
  if (settledOrder) {
    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
        <div class="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden font-mono text-xs flex flex-col text-slate-800">
          
          <!-- Thermal Receipt Header -->
          <div class="bg-slate-900 text-white px-5 py-4 text-center">
            <div class="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-2 text-xl font-bold">✓</div>
            <h3 class="font-bold text-sm tracking-wider uppercase">${activeOutlet}</h3>
            <p class="text-[10px] text-slate-300 font-sans mt-0.5">Petpooja POS • Settlement Complete</p>
          </div>

          <div class="p-5 space-y-3">
            <div class="border-b border-dashed border-slate-300 pb-2 space-y-1 text-[11px]">
              <div class="flex justify-between"><span>Bill No:</span><span class="font-bold">${settledOrder.billNo || settledOrder.orderId}</span></div>
              <div class="flex justify-between"><span>Table / Server:</span><span>${tableNo} • ${serverName}</span></div>
              <div class="flex justify-between"><span>Customer:</span><span class="font-bold">${settledOrder.customerName} (+91 ${settledOrder.customerPhone})</span></div>
              <div class="flex justify-between text-slate-500"><span>Date:</span><span>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
            </div>

            <!-- Items -->
            <div class="space-y-1.5 border-b border-dashed border-slate-300 pb-2 text-[11px]">
              <div class="flex justify-between"><span>2x Dal Roti</span><span>₹120.00</span></div>
              <div class="flex justify-between"><span>1x Full Rice</span><span>₹110.00</span></div>
              <div class="flex justify-between"><span>2x Full Roti</span><span>₹70.00</span></div>
              <div class="flex justify-between"><span>1x Dosa Bhaji</span><span>₹85.00</span></div>
            </div>

            <!-- Financials -->
            <div class="space-y-1.5 border-b border-slate-300 pb-2 text-[11px]">
              <div class="flex justify-between"><span>Gross Subtotal:</span><span>₹${settledOrder.financials.grossAmount.toFixed(2)}</span></div>
              ${settledOrder.financials.loyaltyDiscount > 0 ? `
                <div class="flex justify-between text-emerald-600 font-bold">
                  <span>Reelo Loyalty Discount:</span>
                  <span>-₹${settledOrder.financials.loyaltyDiscount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div class="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                <span>NET PAID:</span>
                <span>₹${settledOrder.financials.netPaid.toFixed(2)}</span>
              </div>
            </div>

            <!-- Loyalty Earn Summary -->
            <div class="bg-amber-50 rounded-lg p-2.5 border border-amber-200 text-[11px] font-sans space-y-1">
              <div class="flex items-center justify-between text-amber-900 font-bold">
                <span>★ Yeezy Loyalty Rewards:</span>
                <span class="text-amber-700">+${settledOrder.pointsEarned} pts earned</span>
              </div>
              <div class="flex justify-between text-slate-600 text-[10px]">
                <span>Points Burned:</span>
                <span class="font-bold text-rose-600">${settledOrder.pointsBurned || 0} pts</span>
              </div>
              <div class="flex justify-between text-slate-600 text-[10px]">
                <span>Updated Balance:</span>
                <span class="font-bold text-slate-900">${settledOrder.newBalance} pts</span>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="p-4 bg-slate-50 border-t border-slate-200 flex gap-2 font-sans">
            <button id="btn-pos-receipt-done" type="button" class="flex-1 py-2 bg-slate-900 hover:bg-black text-white font-bold rounded-lg text-xs transition">
              Done & Return
            </button>
            <button id="btn-pos-receipt-new" type="button" class="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition">
              + New POS Bill
            </button>
          </div>
        </div>
      </div>
    `;
  }

  const grossTotal = billAmount;
  const netPayable = Math.max(0, grossTotal - appliedDiscount);

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      
      <!-- PETPOOJA POS DESKTOP SCREEN (CONTAINER) -->
      <div class="relative w-full max-w-4xl bg-[#edf2f7] rounded-2xl shadow-2xl border border-slate-300 overflow-hidden font-sans my-4 flex flex-col">
        
        <!-- Petpooja Window Top Chrome -->
        <div class="bg-[#1f2937] text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-700 select-none">
          <div class="flex items-center gap-3">
            <span class="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[11px] tracking-wider uppercase">Petpooja POS</span>
            <span class="text-xs font-semibold text-slate-200">${activeOutlet} • POS Terminal #01</span>
            <span class="text-[10px] text-slate-400">| Table: <strong class="text-white">${tableNo}</strong> | Cashier: <strong class="text-white">${serverName}</strong></span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="text-[11px] text-emerald-400 font-bold">Online Sync</span>
            <button id="btn-close-pos-window" type="button" class="ml-3 text-slate-400 hover:text-white p-1">
              <span class="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <!-- Petpooja POS Billing Screen Content -->
        <div class="p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
          
          <!-- Left: Order Items List (Matching Screenshot Background) -->
          <div class="md:col-span-7 bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm">
            <div>
              <div class="flex items-center justify-between pb-3 border-b border-slate-200">
                <span class="font-bold text-xs text-slate-800 uppercase tracking-wider">KOT / Running Order Items</span>
                <span class="text-[11px] font-semibold text-slate-500">Order #PP-4821 • Dine In</span>
              </div>

              <!-- Menu Items as shown in screenshot -->
              <div class="divide-y divide-slate-100 text-xs mt-2">
                <div class="py-2 flex items-center justify-between">
                  <div>
                    <span class="font-bold text-slate-900">Dal Roti</span>
                    <span class="text-[10px] text-slate-500 block">Qty: 2 × ₹60.00</span>
                  </div>
                  <span class="font-bold text-slate-900">₹120.00</span>
                </div>
                <div class="py-2 flex items-center justify-between">
                  <div>
                    <span class="font-bold text-slate-900">Full Rice</span>
                    <span class="text-[10px] text-slate-500 block">Qty: 1 × ₹110.00</span>
                  </div>
                  <span class="font-bold text-slate-900">₹110.00</span>
                </div>
                <div class="py-2 flex items-center justify-between">
                  <div>
                    <span class="font-bold text-slate-900">Full Roti</span>
                    <span class="text-[10px] text-slate-500 block">Qty: 2 × ₹35.00</span>
                  </div>
                  <span class="font-bold text-slate-900">₹70.00</span>
                </div>
                <div class="py-2 flex items-center justify-between">
                  <div>
                    <span class="font-bold text-slate-900">Dosa Bhaji</span>
                    <span class="text-[10px] text-slate-500 block">Qty: 1 × ₹85.00</span>
                  </div>
                  <span class="font-bold text-slate-900">₹85.00</span>
                </div>
              </div>
            </div>

            <!-- Cashier Action Trigger: Reelo Loyalty Discount -->
            <div class="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 p-3 rounded-lg">
              <div>
                <span class="text-[11px] font-bold text-slate-600 block">Loyalty Partner:</span>
                <span class="text-xs font-black text-rose-700">Reelo / Yeezy Connected</span>
              </div>
              <button 
                id="btn-trigger-reelo-modal" 
                type="button" 
                class="px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
              >
                <span class="material-symbols-outlined text-sm">stars</span>
                <span>Open Reelo Loyalty Modal</span>
              </button>
            </div>
          </div>

          <!-- Right: Bill Summary & Tender -->
          <div class="md:col-span-5 bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm">
            <div class="space-y-3">
              <span class="font-bold text-xs text-slate-800 uppercase tracking-wider block border-b border-slate-200 pb-2">
                Customer & Bill Settlement
              </span>

              <!-- Customer info in POS -->
              <div class="bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs space-y-1">
                <div class="flex justify-between">
                  <span class="text-slate-500">Name:</span>
                  <span class="font-bold text-slate-900">${name}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-500">Phone:</span>
                  <span class="font-mono font-bold text-slate-900">+91 ${phone}</span>
                </div>
              </div>

              <!-- Calculation Rows -->
              <div class="space-y-2 text-xs pt-1">
                <div class="flex justify-between text-slate-600">
                  <span>Gross Subtotal:</span>
                  <span>₹${grossTotal.toFixed(2)}</span>
                </div>

                ${appliedDiscount > 0 ? `
                  <div class="flex justify-between text-rose-700 font-bold bg-rose-50 p-2 rounded border border-rose-200">
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs">check_circle</span>
                      Reelo Loyalty Discount:
                    </span>
                    <span>-₹${appliedDiscount.toFixed(2)}</span>
                  </div>
                ` : `
                  <div class="flex justify-between text-slate-400 text-[11px] italic">
                    <span>Loyalty Discount:</span>
                    <span>None applied yet</span>
                  </div>
                `}

                <div class="border-t border-slate-200 pt-2 flex justify-between items-baseline font-bold">
                  <span class="text-slate-900 text-sm">Net Payable:</span>
                  <span class="text-lg font-black text-slate-900">₹${netPayable.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- POS Settle Button -->
            <div class="pt-4 mt-4 border-t border-slate-200">
              <button 
                id="btn-pos-settle-final" 
                type="button" 
                class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm tracking-wide shadow-md transition flex items-center justify-center gap-2"
              >
                <span class="material-symbols-outlined text-lg">receipt_long</span>
                <span>Settle & Print Bill (₹${netPayable.toFixed(2)})</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2. EXACT REELO MODAL (OVERLAY IN PETPOOJA POS) -->
        ${showReeloModal ? `
          <div class="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-3 animate-fade-in z-20">
            <div class="w-full max-w-[480px] bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden font-sans text-slate-800 animate-scale-up">
              
              <!-- Title Bar (Exact: "Reelo" with X close) -->
              <div class="px-4 py-3 flex items-center justify-between border-b border-slate-200">
                <span class="text-sm font-bold text-slate-900 tracking-tight">Reelo</span>
                <button 
                  id="btn-reelo-modal-close" 
                  type="button" 
                  class="text-slate-400 hover:text-slate-700 text-base leading-none p-1 font-bold"
                >
                  ✕
                </button>
              </div>

              <!-- Body Container -->
              <div class="p-4 space-y-3">
                
                <!-- Phone & Points Card (Exact split row with border) -->
                <div class="border border-slate-300 rounded flex items-center divide-x divide-slate-300 bg-white">
                  
                  <!-- Left: Person icon & Phone Number -->
                  <div class="flex items-center gap-2 px-3 py-2 flex-1">
                    <span class="material-symbols-outlined text-slate-500 text-lg">person</span>
                    <input 
                      id="input-reelo-phone" 
                      type="tel" 
                      maxlength="10" 
                      value="${phone}" 
                      placeholder="9687344309"
                      class="w-full font-bold text-xs text-slate-800 tracking-wider focus:outline-none bg-transparent"
                    />
                  </div>

                  <!-- Right: Available Points -->
                  <div class="px-3 py-2 flex items-center justify-between gap-3 min-w-[170px] bg-white">
                    <span class="text-xs text-slate-500">Available Points:</span>
                    <span id="label-reelo-points" class="text-xs font-bold text-slate-900">${availablePoints}</span>
                  </div>
                </div>

                <!-- Red Banner Header (Exact Crimson Red) -->
                <div class="bg-[#b00020] text-white px-3 py-1.5 rounded-t text-xs font-bold tracking-tight">
                  Available Loyalty Rewards:
                </div>

                <!-- Reward Options Box -->
                <div class="bg-white border-x border-b border-slate-300 rounded-b p-3 space-y-3 text-xs -mt-3">
                  
                  <!-- Radio 1: 100 Rs off -->
                  <label class="flex items-center gap-2.5 cursor-pointer py-1 select-none">
                    <input 
                      type="radio" 
                      name="reelo-reward-choice" 
                      value="OPT_100_OFF" 
                      ${selectedOptionId === 'OPT_100_OFF' ? 'checked' : ''}
                      class="w-4 h-4 text-[#b00020] accent-[#b00020] focus:ring-0 cursor-pointer"
                    />
                    <span class="font-bold text-slate-900 text-xs">100₹ off on entire purchase (100)</span>
                  </label>

                  <!-- Radio 2: 200 Rs off (if enough points) -->
                  ${availablePoints >= 200 ? `
                    <label class="flex items-center gap-2.5 cursor-pointer py-1 select-none">
                      <input 
                        type="radio" 
                        name="reelo-reward-choice" 
                        value="OPT_200_OFF" 
                        ${selectedOptionId === 'OPT_200_OFF' ? 'checked' : ''}
                        class="w-4 h-4 text-[#b00020] accent-[#b00020] focus:ring-0 cursor-pointer"
                      />
                      <span class="font-bold text-slate-900 text-xs">200₹ off on entire purchase (200)</span>
                    </label>
                  ` : ''}

                  <!-- OTP Section (Exact: To Redeem : Send OTP) -->
                  <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <span class="text-xs text-slate-600 font-medium">To Redeem :</span>
                    
                    ${otpState === 'INITIAL' ? `
                      <button 
                        id="btn-reelo-send-otp" 
                        type="button" 
                        class="px-3 py-1 rounded bg-[#b00020] hover:bg-[#90001a] text-white font-bold text-xs transition shadow-sm"
                      >
                        Send OTP
                      </button>
                    ` : otpState === 'OTP_SENT' ? `
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] text-emerald-600 font-bold">Sent!</span>
                        <input 
                          id="input-reelo-otp" 
                          type="text" 
                          maxlength="4" 
                          value="${enteredOtp || otpCode}" 
                          class="w-16 px-1.5 py-0.5 text-center font-mono font-bold text-xs border border-slate-300 rounded focus:outline-none"
                        />
                        <button 
                          id="btn-reelo-verify-otp" 
                          type="button" 
                          class="px-2.5 py-1 rounded bg-[#b00020] hover:bg-[#90001a] text-white font-bold text-xs transition"
                        >
                          Verify
                        </button>
                      </div>
                    ` : `
                      <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                        ✓ OTP Verified
                      </span>
                    `}
                  </div>
                </div>

              </div>

              <!-- Footer Bar (Exact: Bill Amount: 385.00 | Cancel | APPLY) -->
              <div class="px-4 py-3 border-t border-slate-200 flex items-center justify-between bg-white">
                <span class="font-bold text-xs text-slate-800">
                  Bill Amount: ${billAmount.toFixed(2)}
                </span>
                <div class="flex items-center gap-2">
                  <button 
                    id="btn-reelo-cancel" 
                    type="button" 
                    class="px-3.5 py-1.5 rounded border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button 
                    id="btn-reelo-apply" 
                    type="button" 
                    class="px-5 py-1.5 rounded bg-[#b00020] hover:bg-[#90001a] text-white font-bold text-xs tracking-wider transition shadow-sm uppercase"
                  >
                    APPLY
                  </button>
                </div>
              </div>

            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}

// Inquire customer points from backend
async function fetchCustomerLoyalty() {
  const phone = terminalState.phone.trim();
  if (!phone || phone.length < 10) return;

  try {
    const res = await fetch(apiUrl('/api/v1/pos/petpooja/loyalty/inquire'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restID: 'PP_DEL_101',
        customer_phone: phone,
        customer_name: terminalState.name,
        bill_amount: terminalState.billAmount
      })
    });
    if (res.ok) {
      const data = await res.json();
      terminalState.availablePoints = data.customer?.points_balance ?? 208;
      terminalState.customerLookup = data;
      store.notify();
    }
  } catch (_) {
    // Local fallback
    terminalState.availablePoints = 208;
    store.notify();
  }
}

export function attachPOSTerminalModalListeners() {
  // Window close button
  const closeWindowBtn = document.getElementById('btn-close-pos-window');
  if (closeWindowBtn) {
    closeWindowBtn.onclick = () => store.setUIState({ activeModal: null });
  }

  // Close Reelo overlay modal
  const closeReeloBtn = document.getElementById('btn-reelo-modal-close');
  const cancelReeloBtn = document.getElementById('btn-reelo-cancel');
  if (closeReeloBtn) {
    closeReeloBtn.onclick = () => {
      terminalState.showReeloModal = false;
      store.notify();
    };
  }
  if (cancelReeloBtn) {
    cancelReeloBtn.onclick = () => {
      terminalState.showReeloModal = false;
      store.notify();
    };
  }

  // Trigger Reelo modal button from Petpooja POS screen
  const triggerReeloBtn = document.getElementById('btn-trigger-reelo-modal');
  if (triggerReeloBtn) {
    triggerReeloBtn.onclick = () => {
      terminalState.showReeloModal = true;
      store.notify();
      fetchCustomerLoyalty();
    };
  }

  // Phone input inside Reelo modal
  const reeloPhoneInput = document.getElementById('input-reelo-phone');
  if (reeloPhoneInput) {
    reeloPhoneInput.oninput = (e) => {
      terminalState.phone = e.target.value.replace(/\D/g, '');
      if (terminalState.phone.length === 10) {
        fetchCustomerLoyalty();
      }
    };
  }

  // Reward radio choice
  document.querySelectorAll('input[name="reelo-reward-choice"]').forEach(radio => {
    radio.onchange = (e) => {
      terminalState.selectedOptionId = e.target.value;
    };
  });

  // Send OTP button
  const sendOtpBtn = document.getElementById('btn-reelo-send-otp');
  if (sendOtpBtn) {
    sendOtpBtn.onclick = () => {
      terminalState.otpState = 'OTP_SENT';
      terminalState.enteredOtp = terminalState.otpCode;
      window.showToast(`OTP Sent to +91 ${terminalState.phone}! Code: ${terminalState.otpCode}`);
      store.notify();
    };
  }

  // Verify OTP button
  const verifyOtpBtn = document.getElementById('btn-reelo-verify-otp');
  if (verifyOtpBtn) {
    verifyOtpBtn.onclick = () => {
      terminalState.otpState = 'OTP_VERIFIED';
      window.showToast('OTP verified successfully!');
      store.notify();
    };
  }

  // APPLY button in Reelo modal
  const applyBtn = document.getElementById('btn-reelo-apply');
  if (applyBtn) {
    applyBtn.onclick = async () => {
      let discount = 100;
      let pointsBurn = 100;

      if (terminalState.selectedOptionId === 'OPT_200_OFF') {
        discount = 200;
        pointsBurn = 200;
      } else if (terminalState.selectedOptionId === 'OPT_50_OFF') {
        discount = 50;
        pointsBurn = 50;
      }

      // Lock points on backend
      try {
        await fetch(apiUrl('/api/v1/pos/petpooja/loyalty/lock'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_token: `sess_${Date.now()}`,
            points_to_redeem: pointsBurn
          })
        });
      } catch (_) {}

      terminalState.appliedDiscount = discount;
      terminalState.appliedOption = terminalState.selectedOptionId;
      terminalState.showReeloModal = false;
      store.notify();
      window.showToast(`₹${discount} Reelo discount applied to Petpooja bill!`);
    };
  }

  // Final Settlement Button on Petpooja POS screen
  const settleFinalBtn = document.getElementById('btn-pos-settle-final');
  if (settleFinalBtn) {
    settleFinalBtn.onclick = async () => {
      const gross = terminalState.billAmount;
      const discount = terminalState.appliedDiscount;
      const netPaid = Math.max(0, gross - discount);
      const pointsBurned = discount; // 1 pt = 1 INR
      const pointsEarned = Math.floor(netPaid * 0.1); // 10% points
      const orderId = `PP-${Date.now().toString().slice(-6)}`;
      const billNo = `BILL/${orderId}`;

      terminalState.isSettling = true;

      // Hit Petpooja Orders Save backend endpoint
      try {
        await fetch(apiUrl('/api/v1/pos/petpooja/orders/save'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restID: 'PP_DEL_101',
            order_id: orderId,
            bill_no: billNo,
            table_no: terminalState.tableNo,
            server_name: terminalState.serverName,
            customer: { phone: terminalState.phone, name: terminalState.name },
            financials: {
              subtotal: gross,
              gross_amount: gross,
              loyalty_discount: discount,
              net_paid: netPaid,
              payment_mode: 'CARD'
            }
          })
        });
      } catch (_) {}

      // Update customer & store stats
      store.setState(prev => {
        const customers = [...prev.customers];
        let cust = customers.find(c => c.phone.slice(-10) === terminalState.phone.slice(-10));

        if (!cust) {
          cust = {
            id: `cust-${Date.now()}`,
            name: terminalState.name,
            email: `${terminalState.phone}@guest.yeezy.app`,
            phone: `+91 ${terminalState.phone}`,
            initials: 'AM',
            avatarBg: 'bg-primary text-on-primary',
            tier: 'Regular',
            tierBadge: 'bg-surface-container-high text-on-surface',
            visits: 1,
            lifetimeSpend: `₹${netPaid.toLocaleString()}`,
            numericSpend: netPaid,
            pointsBalance: `${Math.max(0, terminalState.availablePoints - pointsBurned + pointsEarned)} pts`,
            numericPoints: Math.max(0, terminalState.availablePoints - pointsBurned + pointsEarned),
            favoriteDish: 'Dal Roti & Full Rice',
            lastVisit: 'Today',
            lastVisitDate: new Date().toISOString().slice(0, 10),
            status: 'Active',
            joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            totalRedeemed: pointsBurned > 0 ? '1 Reward' : '0 Rewards',
            recentOrders: [
              { id: orderId, date: 'Just now', items: 'Dal Roti, Full Rice, Dosa Bhaji', total: `₹${netPaid}`, pointsEarned }
            ]
          };
          customers.unshift(cust);
        } else {
          cust.numericSpend += netPaid;
          cust.lifetimeSpend = `₹${cust.numericSpend.toLocaleString()}`;
          cust.visits += 1;
          cust.numericPoints = Math.max(0, cust.numericPoints - pointsBurned + pointsEarned);
          cust.pointsBalance = `${cust.numericPoints.toLocaleString()} pts`;
          cust.lastVisit = 'Today';
        }

        const newTodaySales = prev.todayStats.sales + netPaid;
        const newTodayOrders = prev.todayStats.orders + 1;
        const newPointsIssued = prev.todayStats.pointsIssued + pointsEarned;
        const newRewardsRedeemed = prev.todayStats.rewardsRedeemed + (pointsBurned > 0 ? 1 : 0);

        return {
          ...prev,
          customers,
          todayStats: {
            ...prev.todayStats,
            sales: newTodaySales,
            orders: newTodayOrders,
            pointsIssued: newPointsIssued,
            rewardsRedeemed: newRewardsRedeemed
          }
        };
      });

      terminalState.settledOrder = {
        orderId,
        billNo,
        customerName: terminalState.name,
        customerPhone: terminalState.phone,
        financials: {
          grossAmount: gross,
          loyaltyDiscount: discount,
          netPaid
        },
        pointsBurned,
        pointsEarned,
        newBalance: Math.max(0, terminalState.availablePoints - pointsBurned + pointsEarned)
      };

      terminalState.isSettling = false;
      store.notify();
      window.showToast(`🎉 Bill settled! ₹${discount} discount redeemed & +${pointsEarned} points credited!`);
    };
  }

  // Receipt Done / New Bill Buttons
  const receiptDoneBtn = document.getElementById('btn-pos-receipt-done');
  if (receiptDoneBtn) {
    receiptDoneBtn.onclick = () => {
      terminalState.settledOrder = null;
      terminalState.appliedDiscount = 0;
      terminalState.showReeloModal = true;
      store.setUIState({ activeModal: null });
    };
  }

  const receiptNewBtn = document.getElementById('btn-pos-receipt-new');
  if (receiptNewBtn) {
    receiptNewBtn.onclick = () => {
      terminalState.settledOrder = null;
      terminalState.appliedDiscount = 0;
      terminalState.showReeloModal = true;
      store.notify();
    };
  }
}
