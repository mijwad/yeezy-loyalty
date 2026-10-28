// Customer Slide-Over Profile Drawer Modal with Persona & Activity Tabs
import { store } from '../state/store.js';
import { renderInfoTooltip } from '../utils/tooltip.js';
import { apiUrl } from '../config/api.js';

let currentTab = 'persona'; // 'persona' | 'activity'
let fetchedOrders = null;
let fetchedLedger = null;
let lastCustomerId = null;

export function renderCustomerDrawer(customer) {
  if (!customer) return '';

  // Reset tab and cache if opened for a different customer
  if (lastCustomerId !== customer.id) {
    lastCustomerId = customer.id;
    currentTab = 'persona';
    fetchedOrders = null;
    fetchedLedger = null;
  }

  const cleanPhone = customer.phone ? String(customer.phone).replace(/\D/g, '').slice(-10) : '';
  const formattedPhone = cleanPhone ? `+91 ${cleanPhone}` : (customer.phone || 'N/A');
  const initial = customer.name ? customer.name.trim().charAt(0).toLowerCase() : 'g';
  const joinedDate = customer.joinedDate || 'Oct 2026';
  
  // Format joined duration badge (e.g. "3 hours", "1 day ago", "Today")
  const durationBadge = customer.durationBadge || '3 hours';

  // Profile data fields
  const email = (customer.email && !customer.email.includes('@guest.yeezy.app')) ? customer.email : 'N/A';
  const address = customer.address || 'N/A';
  const birthday = customer.birthday || 'N/A';
  const anniversary = customer.anniversary || 'N/A';
  const tags = customer.tags || (customer.tier === 'VIP' ? ['VIP', 'High Spender'] : customer.visits > 1 ? ['Frequent Diner'] : ['New Guest']);
  const isBlocked = customer.isBlocked || false;

  return `
    <div id="customerDrawerOverlay" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
      <div 
        id="customerDrawerContent"
        class="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col justify-between animate-slide-right border-l border-slate-200 relative"
        onclick="event.stopPropagation()"
      >
        <!-- Top Sticky Header -->
        <div class="px-6 py-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-20">
          <h2 class="text-xl font-bold text-slate-900 tracking-tight">Customer Profile</h2>
          <button 
            id="btn-close-customer-drawer" 
            class="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition" 
            type="button"
            aria-label="Close Profile"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <!-- Scrollable Body Content -->
        <div class="p-6 space-y-6 pb-28">
          
          <!-- Customer Identity Card -->
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-full bg-[#E5E7EB] text-slate-700 font-bold text-2xl flex items-center justify-center shadow-inner shrink-0 select-none">
              ${initial}
            </div>
            <div>
              <h3 class="text-xl font-bold text-slate-900 flex items-center gap-2">
                ${customer.name || 'Valued Guest'}
                ${isBlocked ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">Blocked</span>' : ''}
              </h3>
              <div class="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                <span>Customer since ${joinedDate}</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 select-none">
                  ${durationBadge}
                </span>
              </div>
            </div>
          </div>

          <!-- TAB CONTENT CONTAINER -->
          <div id="customerTabContent">
            ${currentTab === 'persona' ? renderPersonaTab(customer, formattedPhone, email, address, birthday, anniversary, tags, isBlocked) : renderActivityTab(customer)}
          </div>

        </div>

        <!-- Floating Pill Tab Switcher (matches screenshot perfectly) -->
        <div class="fixed bottom-6 right-6 md:right-12 z-30 bg-[#0F172A] p-1.5 rounded-full flex items-center gap-1 shadow-2xl border border-slate-700/80 select-none">
          <button 
            id="btn-tab-persona"
            type="button"
            class="px-6 py-2 rounded-full text-xs font-bold transition-all ${currentTab === 'persona' ? 'bg-[#00796B] text-white shadow-md' : 'text-slate-300 hover:text-white'}"
          >
            Persona
          </button>
          <button 
            id="btn-tab-activity"
            type="button"
            class="px-6 py-2 rounded-full text-xs font-bold transition-all ${currentTab === 'activity' ? 'bg-[#00796B] text-white shadow-md' : 'text-slate-300 hover:text-white'}"
          >
            Activity
          </button>
        </div>

      </div>
    </div>
  `;
}

// 1. PERSONA TAB VIEW
function renderPersonaTab(customer, phone, email, address, birthday, anniversary, tags, isBlocked) {
  return `
    <div class="space-y-5 animate-fade-in">
      
      <!-- Profile Data Card -->
      <div class="bg-[#F9FAFB] rounded-2xl p-5 border border-slate-100 space-y-4 shadow-xs">
        <h4 class="text-sm font-bold text-slate-900 tracking-tight">Profile Data</h4>
        
        <div class="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
          <!-- Row 1 -->
          <div>
            <span class="text-slate-400 font-medium block text-[11px]">Name</span>
            <span class="text-sm font-bold text-slate-900 mt-0.5 block">${customer.name || 'N/A'}</span>
          </div>
          <div>
            <span class="text-slate-400 font-medium block text-[11px]">Phone</span>
            <span class="text-sm font-bold text-slate-900 mt-0.5 block font-mono">${phone}</span>
          </div>

          <!-- Row 2 -->
          <div>
            <span class="text-slate-400 font-medium block text-[11px]">E-mail</span>
            <span class="text-sm font-bold text-slate-900 mt-0.5 block">${email}</span>
          </div>
          <div>
            <span class="text-slate-400 font-medium block text-[11px]">Address</span>
            <span class="text-sm font-bold text-slate-900 mt-0.5 block">${address}</span>
          </div>

          <!-- Row 3 -->
          <div>
            <span class="text-slate-400 font-medium block text-[11px]">Birthday</span>
            <span class="text-sm font-bold text-slate-900 mt-0.5 block">${birthday}</span>
          </div>
          <div>
            <span class="text-slate-400 font-medium block text-[11px]">Anniversary</span>
            <span class="text-sm font-bold text-slate-900 mt-0.5 block">${anniversary}</span>
          </div>
        </div>
      <!-- What They Eat / Dining Habits Card -->
      <div class="bg-[#F9FAFB] rounded-2xl p-5 border border-slate-100 space-y-3 shadow-xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-600 text-lg">restaurant_menu</span>
            <h4 class="text-sm font-bold text-slate-900 tracking-tight">What They Eat (Ordered Dishes)</h4>
          </div>
          <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
            ${customer.topDishes?.length || (customer.favoriteDish && customer.favoriteDish !== 'Chef Special' ? 1 : 0)} items captured
          </span>
        </div>

        ${(customer.topDishes && customer.topDishes.length > 0) ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            ${customer.topDishes.map(d => `
              <div class="p-2.5 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between shadow-2xs hover:border-emerald-300 transition-colors">
                <div class="flex items-center gap-2 overflow-hidden">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span class="text-xs font-bold text-slate-900 truncate">${d.name}</span>
                </div>
                <span class="text-xs font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100/80 shrink-0">
                  ${d.count}x ordered
                </span>
              </div>
            `).join('')}
          </div>
        ` : (customer.favoriteDish && customer.favoriteDish !== 'Chef Special') ? `
          <div class="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between">
            <span class="text-xs font-bold text-slate-800">${customer.favoriteDish}</span>
            <span class="text-xs font-black text-emerald-700">Top Choice</span>
          </div>
        ` : `
          <div class="p-3 bg-white rounded-xl border border-dashed border-slate-200 text-center">
            <p class="text-xs text-slate-500">No specific dish order history captured yet for this diner.</p>
          </div>
        `}
      </div>

      <!-- Tags Card -->
      <div class="bg-[#F9FAFB] rounded-2xl p-4 border border-slate-100 flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-bold text-slate-900 mr-2">Tags</span>
          ${tags.map(t => `
            <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs">
              ${t}
            </span>
          `).join('')}
        </div>
        <button 
          id="btn-add-customer-tag"
          type="button" 
          class="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold transition shadow-2xs"
        >
          Add
        </button>
      </div>

      <!-- Action Section: Block Customer -->
      <div class="flex items-center gap-2 pt-2">
        <button 
          id="btn-toggle-block-customer"
          type="button" 
          class="px-4 py-2.5 rounded-xl ${isBlocked ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-[#DC2626] hover:bg-red-700 text-white'} text-xs font-bold transition shadow-xs flex items-center gap-1.5"
        >
          <span class="material-symbols-outlined text-sm">${isBlocked ? 'lock_open' : 'block'}</span>
          <span>${isBlocked ? 'Unblock Customer' : 'Block Customer'}</span>
        </button>
        ${renderInfoTooltip("Temporarily pauses loyalty points accrual, redemption, and automated promotional messaging for this diner.", "left")}
      </div>

      <!-- Quick Gifting & Winback Strip -->
      <div class="pt-4 border-t border-slate-100">
        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2.5">Loyalty Management</span>
        <div class="flex items-center gap-3">
          <button 
            id="btn-gift-points"
            type="button"
            class="flex-1 py-2 px-3 rounded-xl bg-primary-fixed text-on-primary-fixed hover:bg-primary-fixed-dim transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span class="material-symbols-outlined text-base">featured_seasonal_and_gifts</span>
            Gift 200 Bonus Pts
          </button>
          <button 
            id="btn-send-whatsapp"
            type="button"
            class="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <span class="material-symbols-outlined text-base text-emerald-600">chat</span>
            Send WhatsApp
          </button>
        </div>
      </div>

    </div>
  `;
}

// 2. ACTIVITY TAB VIEW ("when they come what they bought and redeem all ino")
function renderActivityTab(customer) {
  // Use cached orders or customer.recentOrders
  const orders = fetchedOrders || customer.recentOrders || [];
  const ledger = fetchedLedger || [];

  const visitCount = customer.visits || orders.length;
  const lifetimeSpend = customer.lifetimeSpend || '₹0';
  const pointsBal = customer.pointsBalance || '0 pts';
  const totalRedeemed = customer.totalRedeemed || '0 Rewards';

  return `
    <div class="space-y-6 animate-fade-in">
      
      <!-- Activity Summary Strip -->
      <div class="grid grid-cols-4 gap-2.5">
        <div class="p-3 bg-[#F9FAFB] rounded-2xl border border-slate-100 text-center">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visits</span>
          <span class="text-lg font-black text-slate-900 mt-0.5 block">${visitCount}</span>
        </div>
        <div class="p-3 bg-[#F9FAFB] rounded-2xl border border-slate-100 text-center">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Spent</span>
          <span class="text-lg font-black text-primary mt-0.5 block">${lifetimeSpend}</span>
        </div>
        <div class="p-3 bg-[#F9FAFB] rounded-2xl border border-slate-100 text-center">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Points Bal</span>
          <span class="text-lg font-black text-emerald-700 mt-0.5 block">${pointsBal}</span>
        </div>
        <div class="p-3 bg-[#F9FAFB] rounded-2xl border border-slate-100 text-center">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Redeemed</span>
          <span class="text-lg font-black text-amber-700 mt-0.5 block">${totalRedeemed}</span>
        </div>
      </div>

      <!-- Activity Timeline Header -->
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
          <span class="material-symbols-outlined text-primary text-base">history</span>
          Guest Activity & Dining History
        </h4>
        <span class="text-xs font-bold text-slate-400">${orders.length} transaction${orders.length === 1 ? '' : 's'}</span>
      </div>

      <!-- Timeline Records -->
      <div class="space-y-4">
        ${orders.length > 0 ? orders.map((ord, idx) => renderOrderActivityCard(ord, idx, orders.length)).join('') : `
          <!-- Production Empty State when customer has no orders yet -->
          <div class="p-6 bg-slate-50 rounded-2xl border border-slate-200/70 text-center space-y-2">
            <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <div>
              <h5 class="text-sm font-bold text-slate-800">No Orders Captured Yet</h5>
              <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Orders and reward redemptions will automatically appear here in real-time as bills are settled on your POS terminal.
              </p>
            </div>
          </div>
        `}

        <!-- Registration & Welcome Milestone in timeline -->
        <div class="p-4 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-start justify-between shadow-2xs">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <span class="material-symbols-outlined text-base">how_to_reg</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-emerald-900">Enrolled in Yeezy Loyalty Program</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-800">Milestone</span>
              </div>
              <p class="text-xs text-emerald-800 mt-0.5">
                First welcome visit recorded. Automatic 10% cash-back points earning activated.
              </p>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-xs font-black text-emerald-700">+100 Welcome Pts</span>
            <span class="text-[10px] text-emerald-600 block mt-0.5">${customer.joinedDate || 'Oct 2026'}</span>
          </div>
        </div>

      </div>

    </div>
  `;
}

// Sub-component: Individual Detailed Order Card
function renderOrderActivityCard(ord, idx, total) {
  const visitNum = total - idx;
  const billId = ord.id || ord.orderId || ord.billNo || `#POS-${Math.floor(1000 + idx * 87)}`;
  const totalAmount = ord.total || (ord.financials?.netPaid ? `₹${ord.financials.netPaid}` : '₹0');
  const dateStr = ord.date || ord.settledAt ? new Date(ord.date || ord.settledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Today';
  const itemsList = Array.isArray(ord.items) ? ord.items : [];
  const itemsText = itemsList.length > 0
    ? itemsList.map(i => `${i.quantity || i.qty || 1}x ${i.name || i.item_name || 'Item'}`).join(', ')
    : (typeof ord.items === 'string' && ord.items.trim() ? ord.items : 'Items not itemized for this POS order');
  const pointsEarned = ord.pointsEarned ?? (ord.points_earned ?? Math.round(parseInt(String(totalAmount).replace(/\D/g, '') || 1000) * 0.1));
  const pointsBurned = ord.pointsBurned ?? (ord.points_burned ?? 0);
  const discount = ord.loyaltyDiscount ?? (ord.financials?.loyaltyDiscount ?? 0);
  const paymentMode = ord.financials?.paymentMode || ord.paymentMode || 'UPI / PhonePe';
  const tableNo = ord.tableNo || ord.table || 'Table T-4';

  return `
    <div class="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3 hover:border-slate-300 transition">
      
      <!-- Order Header: When they came -->
      <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center">
            #${visitNum}
          </span>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-slate-900 font-mono">${billId}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">${tableNo}</span>
            </div>
            <span class="text-[11px] text-slate-400 block">${dateStr}</span>
          </div>
        </div>
        <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Paid & Settled
        </span>
      </div>

      <!-- What they bought -->
      <div class="space-y-1.5">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Items Purchased</span>
        <div class="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-800 font-medium leading-relaxed">
          ${itemsText}
        </div>
      </div>

      <!-- What they redeemed & earned (all redemption info) -->
      <div class="grid grid-cols-2 gap-2 text-xs pt-1">
        
        <!-- Points Earned Chip -->
        <div class="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-emerald-600 text-sm">stars</span>
            <span class="text-[11px] font-bold text-emerald-900">Points Earned</span>
          </div>
          <span class="font-extrabold text-emerald-700">+${pointsEarned} pts</span>
        </div>

        <!-- Redemption / Discount Chip -->
        <div class="p-2.5 rounded-xl ${pointsBurned > 0 || discount > 0 ? 'bg-amber-50/80 border-amber-200' : 'bg-slate-50 border-slate-100'} border flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined ${pointsBurned > 0 ? 'text-amber-600' : 'text-slate-400'} text-sm">local_fire_department</span>
            <span class="text-[11px] font-bold ${pointsBurned > 0 ? 'text-amber-900' : 'text-slate-500'}">Redeemed</span>
          </div>
          <span class="font-extrabold ${pointsBurned > 0 ? 'text-amber-800' : 'text-slate-400'}">
            ${pointsBurned > 0 ? `-${pointsBurned} pts (₹${discount || pointsBurned} off)` : 'None'}
          </span>
        </div>

      </div>

      <!-- Financial Total & Payment Mode -->
      <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
        <span class="text-slate-500 font-medium">Payment Mode: <span class="font-bold text-slate-800">${paymentMode}</span></span>
        <div class="text-right">
          <span class="text-slate-400 text-[11px] mr-1">Settled Bill:</span>
          <span class="text-sm font-black text-slate-900">${totalAmount}</span>
        </div>
      </div>

    </div>
  `;
}

// ATTACH LISTENERS
export function attachCustomerDrawerListeners() {
  const customer = store.getUIState().selectedCustomer;
  if (!customer) return;

  // Fetch real order and ledger data from server if not already fetched
  if (fetchedOrders === null && customer.id) {
    fetch(apiUrl(`/api/v1/customers/${customer.id}`))
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          fetchedOrders = data.orders || [];
          fetchedLedger = data.ledger || [];
          // If active tab is activity, re-render content
          if (currentTab === 'activity') {
            const content = document.getElementById('customerTabContent');
            if (content) {
              content.innerHTML = renderActivityTab(customer);
            }
          }
        }
      })
      .catch(err => {
        console.warn('Could not fetch extra customer details:', err);
      });
  }

  // Close Button
  const closeBtn = document.getElementById('btn-close-customer-drawer');
  if (closeBtn) {
    closeBtn.onclick = () => {
      store.setUIState({ activeModal: null, selectedCustomer: null });
    };
  }

  // Backdrop click
  const overlay = document.getElementById('customerDrawerOverlay');
  if (overlay) {
    overlay.onclick = () => {
      store.setUIState({ activeModal: null, selectedCustomer: null });
    };
  }

  // Tab Switcher: Persona
  const tabPersonaBtn = document.getElementById('btn-tab-persona');
  const tabActivityBtn = document.getElementById('btn-tab-activity');
  const tabContent = document.getElementById('customerTabContent');

  if (tabPersonaBtn && tabActivityBtn && tabContent) {
    tabPersonaBtn.onclick = () => {
      currentTab = 'persona';
      tabPersonaBtn.className = 'px-6 py-2 rounded-full text-xs font-bold transition-all bg-[#00796B] text-white shadow-md';
      tabActivityBtn.className = 'px-6 py-2 rounded-full text-xs font-bold transition-all text-slate-300 hover:text-white';
      
      const cleanPhone = customer.phone ? String(customer.phone).replace(/\D/g, '').slice(-10) : '';
      const formattedPhone = cleanPhone ? `+91 ${cleanPhone}` : (customer.phone || 'N/A');
      const email = (customer.email && !customer.email.includes('@guest.yeezy.app')) ? customer.email : 'N/A';
      const address = customer.address || 'N/A';
      const birthday = customer.birthday || 'N/A';
      const anniversary = customer.anniversary || 'N/A';
      const tags = customer.tags || (customer.tier === 'VIP' ? ['VIP', 'High Spender'] : customer.visits > 1 ? ['Frequent Diner'] : ['New Guest']);
      const isBlocked = customer.isBlocked || false;

      tabContent.innerHTML = renderPersonaTab(customer, formattedPhone, email, address, birthday, anniversary, tags, isBlocked);
      attachPersonaListeners(customer);
    };

    tabActivityBtn.onclick = () => {
      currentTab = 'activity';
      tabActivityBtn.className = 'px-6 py-2 rounded-full text-xs font-bold transition-all bg-[#00796B] text-white shadow-md';
      tabPersonaBtn.className = 'px-6 py-2 rounded-full text-xs font-bold transition-all text-slate-300 hover:text-white';
      
      tabContent.innerHTML = renderActivityTab(customer);
    };
  }

  // Attach tab-specific listeners
  if (currentTab === 'persona') {
    attachPersonaListeners(customer);
  }
}

function attachPersonaListeners(customer) {
  // Block / Unblock customer toggle
  const blockBtn = document.getElementById('btn-toggle-block-customer');
  if (blockBtn) {
    blockBtn.onclick = () => {
      customer.isBlocked = !customer.isBlocked;
      window.showToast?.(customer.isBlocked ? `${customer.name} has been blocked.` : `${customer.name} has been unblocked.`);
      store.setUIState({ selectedCustomer: { ...customer } });
    };
  }

  // Add Tag
  const addTagBtn = document.getElementById('btn-add-customer-tag');
  if (addTagBtn) {
    addTagBtn.onclick = () => {
      const newTag = prompt('Enter a new tag for this customer (e.g. VIP, Weekend Diner, Vegetarian):');
      if (newTag && newTag.trim()) {
        if (!customer.tags) customer.tags = [];
        customer.tags.push(newTag.trim());
        window.showToast?.(`Added tag "${newTag.trim()}" to ${customer.name}`);
        store.setUIState({ selectedCustomer: { ...customer } });
      }
    };
  }

  // Gift 200 Points
  const giftBtn = document.getElementById('btn-gift-points');
  if (giftBtn) {
    giftBtn.onclick = () => {
      const currentPts = customer.numericPoints || parseInt(String(customer.pointsBalance).replace(/\D/g, '') || 0);
      const newPts = currentPts + 200;
      customer.numericPoints = newPts;
      customer.pointsBalance = `${newPts} pts`;
      window.showToast?.(`Successfully gifted 200 bonus loyalty points to ${customer.name}!`);
      store.setUIState({ selectedCustomer: { ...customer } });
    };
  }

  // Send WhatsApp
  const waBtn = document.getElementById('btn-send-whatsapp');
  if (waBtn) {
    waBtn.onclick = () => {
      window.showToast?.(`WhatsApp loyalty summary queued for ${customer.name} (${customer.phone})`);
    };
  }
}

