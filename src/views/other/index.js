// Supporting Views: Campaigns, Auto-Campaigns, QR Codes, Feedback, Referrals & Settings
import { apiUrl } from '../../config/api.js';

export function renderCampaignsView(state) {
  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Broadcast Campaigns</h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
            Launch one-time promotional WhatsApp & SMS blasts to targeted diner segments.
          </p>
        </div>
        <button 
          type="button" 
          class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 self-start sm:self-auto"
          onclick="window.showToast('Campaign builder modal opened!')"
        >
          <span class="material-symbols-outlined text-base">add</span>
          New Campaign
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">WhatsApp Blast</span>
              <span class="text-xs font-bold text-emerald-600">Delivered</span>
            </div>
            <h3 class="text-base font-bold text-gray-900 mt-3">Weekend Chef's Truffle Special</h3>
            <p class="text-xs text-gray-500 mt-1">Sent to 428 VIP Diners • 34% clicked reserve table</p>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span>Delivered: 428</span>
            <span class="font-bold text-primary">₹18,400 Sales Generated</span>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-blue-700 bg-blue-100 px-2.5 py-0.5 rounded-full">SMS Flash Offer</span>
              <span class="text-xs font-bold text-emerald-600">Delivered</span>
            </div>
            <h3 class="text-base font-bold text-gray-900 mt-3">Thursday Dinner Double Points</h3>
            <p class="text-xs text-gray-500 mt-1">Sent to 1,240 Regular Diners • 18 redemptions</p>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span>Delivered: 1,234</span>
            <span class="font-bold text-primary">₹24,900 Sales Generated</span>
          </div>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-full">Win-Back Blast</span>
              <span class="text-xs font-bold text-amber-600">Scheduled</span>
            </div>
            <h3 class="text-base font-bold text-gray-900 mt-3">We Miss You - 15% OFF</h3>
            <p class="text-xs text-gray-500 mt-1">Scheduled for Tomorrow 06:00 PM • 184 At Risk Diners</p>
          </div>
          <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
            <span>Target: 184</span>
            <span class="font-bold text-slate-800">Pending Send</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderAutoCampaignsView(state) {
  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Automated Trigger Campaigns</h1>
        <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
          Set up evergreen triggers that automatically engage customers based on visits, birthdays, and inactivity.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-amber-500 text-2xl">cake</span>
              <h3 class="text-base font-bold text-gray-900">Birthday Treat Voucher</h3>
            </div>
            <p class="text-xs text-gray-600 mt-2 leading-relaxed">
              Sends an automated WhatsApp greetings voucher (Free Dessert) 2 days before customer's birthday.
            </p>
            <div class="mt-3 flex items-center gap-3 text-xs text-emerald-700 font-bold">
              <span>● 84 treats claimed this month</span>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-purple-600 text-2xl">waving_hand</span>
              <h3 class="text-base font-bold text-gray-900">Welcome Sequence</h3>
            </div>
            <p class="text-xs text-gray-600 mt-2 leading-relaxed">
              Triggers instant 100 bonus points SMS message when a new guest scans table QR code or pays first bill.
            </p>
            <div class="mt-3 flex items-center gap-3 text-xs text-emerald-700 font-bold">
              <span>● 988 new signups welcomed</span>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-red-500 text-2xl">history</span>
              <h3 class="text-base font-bold text-gray-900">30-Day Inactivity Win-Back</h3>
            </div>
            <p class="text-xs text-gray-600 mt-2 leading-relaxed">
              Automated message sent after 30 days of no visits with reminder of unredeemed loyalty points.
            </p>
            <div class="mt-3 flex items-center gap-3 text-xs text-emerald-700 font-bold">
              <span>● 28% win-back rate</span>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-teal-600 text-2xl">workspace_premium</span>
              <h3 class="text-base font-bold text-gray-900">VIP Tier Upgrade Celebration</h3>
            </div>
            <p class="text-xs text-gray-600 mt-2 leading-relaxed">
              Notifies diner with exclusive digital congratulations card when they cross ₹25,000 spend.
            </p>
            <div class="mt-3 flex items-center gap-3 text-xs text-emerald-700 font-bold">
              <span>● 428 VIPs enrolled</span>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
        </div>
      </div>
    </div>
  `;
}

export function renderQRCodesView(state) {
  const { activeOutlet } = state;

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Dining Table QR Codes</h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
            Place branded table tent QR codes for guest self check-in, points claims, and digital menu viewing.
          </p>
        </div>
        <button 
          type="button" 
          class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 self-start sm:self-auto"
          onclick="window.showToast('Generating printable table tent PDF...')"
        >
          <span class="material-symbols-outlined text-base">print</span>
          Download Printable Tent Cards (PDF)
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <!-- QR Card Mockup -->
        <div class="bg-white rounded-3xl p-8 border border-gray-200 shadow-xl flex flex-col items-center text-center max-w-sm mx-auto">
          <div class="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-2xl mb-4 shadow-md">
            Y
          </div>
          <h2 class="text-xl font-black text-gray-900">${activeOutlet}</h2>
          <p class="text-xs text-gray-500 mt-1">Scan to earn loyalty points on today's meal</p>

          <!-- QR Box -->
          <div class="p-6 bg-slate-50 border-2 border-dashed border-gray-300 rounded-3xl my-6 flex flex-col items-center">
            <svg class="w-48 h-48 text-slate-800" viewBox="0 0 100 100" fill="currentColor">
              <path d="M0,0 h30 v30 h-30 z M10,10 h10 v10 h-10 z M70,0 h30 v30 h-30 z M80,10 h10 v10 h-10 z M0,70 h30 v30 h-30 z M10,80 h10 v10 h-10 z M40,10 h10 v10 h-10 z M60,10 h10 v10 h-10 z M40,30 h10 v10 h-10 z M10,40 h10 v10 h-10 z M30,40 h10 v10 h-10 z M60,40 h10 v10 h-10 z M80,40 h10 v10 h-10 z M40,50 h10 v10 h-10 z M70,50 h10 v10 h-10 z M90,50 h10 v10 h-10 z M40,70 h10 v10 h-10 z M60,70 h10 v10 h-10 z M80,70 h10 v10 h-10 z M50,80 h10 v10 h-10 z M70,90 h10 v10 h-10 z M90,90 h10 v10 h-10 z" />
            </svg>
            <span class="text-[10px] font-bold text-gray-400 mt-2">Table #12 • Downtown Bistro</span>
          </div>

          <div class="w-full p-3 rounded-2xl bg-purple-50 border border-purple-100 text-xs text-purple-900 font-bold">
            ✨ Instant 100 Welcome Points on First Scan!
          </div>
        </div>

        <!-- QR Options -->
        <div class="space-y-4">
          <div class="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Table Range Configuration</h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Starting Table #</label>
                <input type="number" value="1" class="w-full px-3 py-2 text-xs border rounded-xl font-bold">
              </div>
              <div>
                <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Ending Table #</label>
                <input type="number" value="25" class="w-full px-3 py-2 text-xs border rounded-xl font-bold">
              </div>
            </div>
          </div>

          <div class="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
            <h3 class="text-sm font-bold text-gray-900">Scanning Action Destination</h3>
            <div class="space-y-2 text-xs">
              <label class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 cursor-pointer">
                <input type="radio" name="qrDest" checked class="text-primary focus:ring-primary">
                <span class="font-bold text-gray-800">Digital Loyalty Registration + Points Wallet</span>
              </label>
              <label class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 cursor-pointer">
                <input type="radio" name="qrDest" class="text-primary focus:ring-primary">
                <span class="font-bold text-gray-800">Digital Food Menu + Instant Table Ordering</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderFeedbackView() {
  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Guest Dining Reviews & Feedback</h1>
        <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
          Real-time satisfaction sentiment collected automatically via post-dining WhatsApp prompts.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Average Rating</span>
          <div class="text-3xl font-black text-amber-500 mt-2 flex items-center gap-1">
            4.8 <span class="material-symbols-outlined text-2xl fill">star</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Based on 642 verified dining reviews</p>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Net Promoter Score (NPS)</span>
          <div class="text-3xl font-black text-emerald-600 mt-2">+74</div>
          <p class="text-xs text-emerald-600 font-bold mt-1">World-class hospitality benchmark</p>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Food Quality Sentiment</span>
          <div class="text-3xl font-black text-primary mt-2">96%</div>
          <p class="text-xs text-gray-500 mt-1">Top rated: Truffle Tagliolini</p>
        </div>
        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Service Speed</span>
          <div class="text-3xl font-black text-blue-600 mt-2">92%</div>
          <p class="text-xs text-gray-500 mt-1">Average table turnaround 52 min</p>
        </div>
      </div>

      <!-- Reviews Feed -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <h3 class="text-sm font-bold text-gray-900">Recent Guest Reviews</h3>
        <div class="space-y-3">
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center shrink-0">
              MC
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-bold text-sm text-gray-900">Marcus Chen</span>
                  <span class="text-xs text-gray-400 ml-2">Yesterday (Dinner Rush)</span>
                </div>
                <div class="flex text-amber-500">
                  ★★★★★
                </div>
              </div>
              <p class="text-xs text-gray-700 mt-1">"The Truffle Tagliolini was prepared to absolute perfection. Loving the new Yeezy loyalty program, earned 284 points directly on my WhatsApp!"</p>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-4">
            <div class="w-10 h-10 rounded-full bg-secondary text-white font-bold text-xs flex items-center justify-center shrink-0">
              ER
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-bold text-sm text-gray-900">Elena Rostova</span>
                  <span class="text-xs text-gray-400 ml-2">3 days ago</span>
                </div>
                <div class="flex text-amber-500">
                  ★★★★★
                </div>
              </div>
              <p class="text-xs text-gray-700 mt-1">"Seamless voucher redemption for our anniversary dinner. The staff recognized our VIP status immediately. 10/10 dining experience."</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderReferralsView() {
  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Diner Referral Program</h1>
        <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
          Turn your happiest customers into active restaurant ambassadors with automated referral incentives.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Referral Reward for Inviter</span>
          <div class="text-2xl font-black text-primary mt-2">₹200 Voucher</div>
          <p class="text-xs text-gray-500 mt-1">Credited once friend completes first meal</p>
        </div>
        <div class="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Welcome Gift for Friend</span>
          <div class="text-2xl font-black text-emerald-600 mt-2">Flat 15% OFF</div>
          <p class="text-xs text-gray-500 mt-1">Valid on first dining visit</p>
        </div>
        <div class="p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">New Diners Acquired</span>
          <div class="text-2xl font-black text-purple-700 mt-2">312 Guests</div>
          <p class="text-xs text-emerald-600 font-bold mt-1">₹482,000 in referral revenue</p>
        </div>
      </div>
    </div>
  `;
}

export function renderSettingsView(state) {
  const { apiKey, projectId, outlets } = state;

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Platform Settings & Integrations</h1>
        <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
          Manage your restaurant profile, API keys, POS connections, and messaging gateways.
        </p>
      </div>

      <!-- Stitch & API Key Section -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-2xl">key</span>
            <div>
              <h3 class="text-base font-bold text-gray-900">Stitch API Credentials</h3>
              <p class="text-xs text-gray-500">Your secure token for design syncing and Stitch MCP runtime</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Connected
          </span>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Your Stitch API Key</label>
            <div class="flex items-center gap-2">
              <input 
                id="input-stitch-api-key" 
                type="text" 
                value="${apiKey}" 
                class="flex-1 px-3.5 py-2 text-xs font-mono bg-slate-50 border rounded-xl"
              >
              <button 
                type="button" 
                class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                onclick="navigator.clipboard.writeText('${apiKey}'); window.showToast('API Key copied to clipboard!');"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Stitch Project ID</label>
            <input 
              type="text" 
              readonly 
              value="${projectId} (Yeezy Restaurant Loyalty Platform)" 
              class="w-full px-3.5 py-2 text-xs font-mono bg-slate-50 border rounded-xl text-gray-600"
            >
          </div>
        </div>
      </div>

      <!-- Restaurant Outlets -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-slate-700 text-2xl">storefront</span>
            <div>
              <h3 class="text-base font-bold text-gray-900">Connected Outlets</h3>
              <p class="text-xs text-gray-500">Dining locations where Yeezy Loyalty is deployed</p>
            </div>
          </div>
          <button 
            type="button" 
            class="px-3.5 py-1.5 rounded-xl border border-primary text-primary hover:bg-primary-fixed/20 text-xs font-bold transition"
            onclick="window.showToast('Add outlet dialog opened')"
          >
            + Add Outlet
          </button>
        </div>

        <div class="space-y-3">
          ${outlets.map(o => `
            <div class="p-3.5 rounded-xl border border-gray-200 flex items-center justify-between">
              <div>
                <div class="font-bold text-xs text-gray-900">${o.name}</div>
                <div class="text-[11px] text-gray-500">${o.address}</div>
              </div>
              <span class="text-xs font-bold ${o.name === state.activeOutlet ? 'text-primary bg-primary-fixed/30 px-2.5 py-1 rounded-full' : 'text-gray-400'}">
                ${o.name === state.activeOutlet ? 'Current Active Outlet' : 'Connected'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Petpooja Marketplace Integration (Exact Reelo 3-Step Setup) -->
      <div class="bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-3xl p-6 md:p-8 border-2 border-emerald-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div class="flex items-start gap-4">
          <div class="w-14 h-14 rounded-2xl bg-[#00c59e] text-white flex items-center justify-center font-black text-2xl shadow-md shrink-0">
            <span class="material-symbols-outlined text-3xl">storefront</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-black text-slate-900 tracking-tight">Petpooja Marketplace Integration (Reelo Flow)</h3>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${state.isPetpoojaIntegrated ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-[#00c59e]/20 text-[#00876c] border border-[#00c59e]/30'} flex items-center gap-1">
                ${state.isPetpoojaIntegrated ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Connected (PP_DEL_101)' : '3 Simple Steps'}
              </span>
            </div>
            <p class="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
              ${state.isPetpoojaIntegrated 
                ? 'Your Petpooja POS is actively connected. Real-time cashier inquiries, discount locks, and order sync webhooks are live.'
                : 'Copy your unique integration key, navigate to Petpooja POS Marketplace ➔ Loyalty Programs ➔ Enter Key and click "Complete Integration".'
              }
            </p>
          </div>
        </div>

        <button 
          id="btn-settings-open-petpooja-setup"
          type="button" 
          class="px-6 py-3 rounded-2xl ${state.isPetpoojaIntegrated ? 'bg-slate-900 hover:bg-black' : 'bg-[#00c59e] hover:bg-[#00b08d]'} text-white font-extrabold text-xs transition shadow-md flex items-center gap-2 shrink-0 active:scale-95"
        >
          <span class="material-symbols-outlined text-sm">${state.isPetpoojaIntegrated ? 'check_circle' : 'integration_instructions'}</span>
          <span>${state.isPetpoojaIntegrated ? 'View Connected Status' : 'Open 3-Step Petpooja Setup'}</span>
        </button>
      </div>

      <!-- Live Petpooja POS Engine & Webhook Simulator -->
      <div class="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 text-white shadow-xl space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-xl border border-teal-500/30">
              ⚡
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base md:text-lg font-black tracking-tight">Petpooja POS Live Engine & Simulator</h3>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Port 4000 Online
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">Test live cashier inquiry, points lock, and double-entry order settlement webhooks</p>
            </div>
          </div>
          <button 
            id="btn-view-webhook-logs" 
            type="button" 
            class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold border border-slate-600 transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span class="material-symbols-outlined text-sm">terminal</span>
            Fetch Recent Logs
          </button>
        </div>

        <!-- Interactive POS Simulator Form -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="text-[11px] font-bold text-slate-300 block mb-1">Diner Phone Number</label>
            <input 
              id="pos-sim-phone" 
              type="text" 
              value="9876543210" 
              class="w-full px-3 py-2 text-xs font-mono bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-teal-400"
            >
          </div>
          <div>
            <label class="text-[11px] font-bold text-slate-300 block mb-1">Bill Subtotal (₹)</label>
            <input 
              id="pos-sim-amount" 
              type="number" 
              value="1450" 
              class="w-full px-3 py-2 text-xs font-mono bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-teal-400"
            >
          </div>
          <div>
            <label class="text-[11px] font-bold text-slate-300 block mb-1">Discount Applied (₹)</label>
            <input 
              id="pos-sim-discount" 
              type="number" 
              value="0" 
              class="w-full px-3 py-2 text-xs font-mono bg-slate-800 border border-slate-700 rounded-xl text-emerald-400 font-bold"
              readonly
            >
          </div>
          <div>
            <label class="text-[11px] font-bold text-slate-300 block mb-1">Net Payable (₹)</label>
            <input 
              id="pos-sim-net" 
              type="number" 
              value="1523" 
              class="w-full px-3 py-2 text-xs font-mono bg-slate-800 border border-slate-700 rounded-xl text-white font-bold"
              readonly
            >
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <button 
            id="btn-pos-test-inquire" 
            type="button" 
            class="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-sm">search</span>
            Check Petpooja Loyalty (Inquire)
          </button>
          <button 
            id="btn-pos-fire-order" 
            type="button" 
            class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md flex items-center gap-1.5"
          >
            <span class="material-symbols-outlined text-sm">receipt_long</span>
            <span id="pos-btn-settle-label">Settle & Print Bill (Save Order)</span>
          </button>
        </div>

        <!-- Dynamic Available Discounts Box (rendered when cashier presses Inquire) -->
        <div id="pos-discounts-box" class="hidden p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-teal-400 text-lg">local_activity</span>
              <span class="text-xs font-black text-white" id="pos-customer-banner">Available Loyalty Discounts</span>
            </div>
            <span class="text-[11px] text-teal-300 font-bold" id="pos-earn-preview">+145 pts will be earned</span>
          </div>
          <div id="pos-options-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <!-- Dynamically populated discount cards -->
          </div>
        </div>

        <!-- Response Terminal Display -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>POS Webhook Payload & Engine Response:</span>
            <span id="pos-terminal-status" class="text-teal-400">Ready</span>
          </div>
          <pre id="pos-terminal-output" class="p-4 rounded-2xl bg-black/70 border border-slate-700 text-emerald-400 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-56 select-all">// Click "Check Petpooja Loyalty (Inquire)" to inspect available customer discounts and redemption options</pre>
        </div>
      </div>

      <!-- Danger Zone / Data Management -->
      <div class="bg-red-50/60 rounded-2xl p-6 border border-red-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-red-200 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-red-600 text-2xl">warning</span>
            <div>
              <h3 class="text-base font-bold text-red-900">Platform Data Reset</h3>
              <p class="text-xs text-red-600">Reset all customers, loyalty points ledger, and orders to 0</p>
            </div>
          </div>
          <button 
            id="btn-settings-reset-zero"
            type="button" 
            class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition shadow-sm"
          >
            Reset All Data to 0
          </button>
        </div>
        <p class="text-xs text-gray-600">
          This will wipe all active diners, points transactions, and sales metrics so you can test starting fresh from 0.
        </p>
      </div>

    </div>
  `;
}

export function attachSettingsListeners() {
  const openPetpoojaSetupBtn = document.getElementById('btn-settings-open-petpooja-setup');
  if (openPetpoojaSetupBtn) {
    openPetpoojaSetupBtn.onclick = () => {
      store.setUIState({ activeModal: 'petpoojaIntegration' });
    };
  }

  const resetBtn = document.getElementById('btn-settings-reset-zero');
  if (resetBtn) {
    resetBtn.onclick = async () => {
      if (confirm('Are you sure you want to reset all customers, points, and orders to 0?')) {
        await store.resetAllDataToZero();
        showToast('All platform data reset to 0');
      }
    };
  }

  const terminal = document.getElementById('pos-terminal-output');
  const termStatus = document.getElementById('pos-terminal-status');
  const discountsBox = document.getElementById('pos-discounts-box');
  const optionsGrid = document.getElementById('pos-options-grid');
  const custBanner = document.getElementById('pos-customer-banner');
  const earnPreview = document.getElementById('pos-earn-preview');
  const discountInput = document.getElementById('pos-sim-discount');
  const netInput = document.getElementById('pos-sim-net');
  const settleLabel = document.getElementById('pos-btn-settle-label');

  let activeSessionToken = null;

  const btnInquire = document.getElementById('btn-pos-test-inquire');
  if (btnInquire) {
    btnInquire.onclick = async () => {
      const phone = document.getElementById('pos-sim-phone')?.value || '9876543210';
      const amount = parseFloat(document.getElementById('pos-sim-amount')?.value) || 1450;
      if (termStatus) termStatus.innerText = 'Calling Petpooja Inquire API...';

      try {
        const res = await fetch(apiUrl('/api/v1/pos/petpooja/loyalty/inquire'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restID: 'PP_DEL_101',
            customer_phone: phone,
            bill_amount: amount,
            discountable_amount: amount,
            order_id: `ORD-${Date.now().toString().slice(-6)}`,
            table_no: 'T-12',
            server_name: 'Vikas'
          })
        });
        const data = await res.json();
        activeSessionToken = data.redemption_offer?.session_token;

        if (terminal) terminal.innerText = JSON.stringify(data, null, 2);
        if (termStatus) termStatus.innerText = 'Inquiry Response 200 OK';

        if (custBanner) {
          custBanner.innerText = `${data.customer.name} (${data.customer.tier}) • ${data.customer.points_balance} Points Available (₹${data.customer.points_value_inr})`;
        }
        if (earnPreview && data.bill_context?.estimated_points_to_earn) {
          earnPreview.innerText = `+${data.bill_context.estimated_points_to_earn} pts will be earned on this bill`;
        }

        // Render clickable discount buttons
        if (optionsGrid && data.redemption_options) {
          optionsGrid.innerHTML = data.redemption_options.map(opt => `
            <div class="p-3 rounded-xl border ${opt.eligible ? 'border-teal-500/50 bg-teal-950/40 hover:border-teal-400 cursor-pointer' : 'border-slate-700 bg-slate-900/60 opacity-60'} flex flex-col justify-between transition-all">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-black ${opt.eligible ? 'text-teal-300' : 'text-slate-400'}">${opt.label}</span>
                  ${opt.isRecommended ? '<span class="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-teal-400 text-slate-950">Recommended</span>' : ''}
                </div>
                <p class="text-[11px] text-slate-400">${opt.description}</p>
              </div>
              <button 
                type="button" 
                data-option-id="${opt.id}"
                data-discount="${opt.discountInr || 0}"
                class="btn-apply-discount mt-3 w-full py-1.5 rounded-lg text-[11px] font-bold ${opt.eligible ? 'bg-teal-500 hover:bg-teal-400 text-slate-950 shadow-sm' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}"
                ${!opt.eligible ? 'disabled' : ''}
              >
                ${opt.eligible ? `Apply ₹${opt.discountInr} Discount` : 'Points Ineligible'}
              </button>
            </div>
          `).join('');

          if (discountsBox) discountsBox.classList.remove('hidden');

          // Wire up discount selection buttons
          document.querySelectorAll('.btn-apply-discount').forEach(btn => {
            btn.onclick = async (e) => {
              const optId = btn.getAttribute('data-option-id');
              const disc = parseFloat(btn.getAttribute('data-discount')) || 0;

              if (activeSessionToken) {
                try {
                  const lockRes = await fetch(apiUrl('/api/v1/pos/petpooja/loyalty/lock'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      session_token: activeSessionToken,
                      option_id: optId
                    })
                  });
                  const lockData = await lockRes.json();
                  if (terminal) terminal.innerText = JSON.stringify(lockData, null, 2);
                  if (termStatus) termStatus.innerText = `Discount Locked (Session ${activeSessionToken.slice(-6)})`;

                  if (discountInput) discountInput.value = lockData.discount_applied_inr;
                  const gross = Math.round(amount * 1.05);
                  const net = Math.max(0, gross - lockData.discount_applied_inr);
                  if (netInput) netInput.value = net;
                  if (settleLabel) settleLabel.innerText = `Settle & Print Bill (Pay ₹${net})`;

                  window.showToast(`Applied ₹${lockData.discount_applied_inr} discount to Petpooja bill!`);
                } catch (err) {
                  console.error(err);
                }
              }
            };
          });
        }

        window.showToast(`Points balance: ${data.customer.points_balance} pts (Eligible discount: ₹${data.redemption_offer.max_discount_amount})`);
      } catch (err) {
        if (terminal) terminal.innerText = `Error contacting engine: ${err.message}`;
        if (termStatus) termStatus.innerText = 'Error';
      }
    };
  }

  const btnOrder = document.getElementById('btn-pos-fire-order');
  if (btnOrder) {
    btnOrder.onclick = async () => {
      const phone = document.getElementById('pos-sim-phone')?.value || '9876543210';
      const amount = parseFloat(document.getElementById('pos-sim-amount')?.value) || 1450;
      const discount = parseFloat(document.getElementById('pos-sim-discount')?.value) || 0;
      const orderId = `PP-ORD-${Date.now().toString().slice(-5)}`;

      if (termStatus) termStatus.innerText = 'Ingesting Petpooja Order...';

      try {
        const res = await fetch(apiUrl('/api/v1/pos/petpooja/orders/save'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restID: 'PP_DEL_101',
            order_id: orderId,
            bill_no: `BILL/${orderId}`,
            table_no: 'T-12',
            server_name: 'Vikas',
            customer: { phone, name: 'Valued Guest' },
            financials: {
              subtotal: amount,
              tax: Math.round(amount * 0.05),
              gross_amount: Math.round(amount * 1.05),
              loyalty_discount: discount,
              net_paid: Math.max(0, Math.round(amount * 1.05) - discount),
              payment_mode: 'UPI'
            },
            redemption_session_token: activeSessionToken,
            items: [
              { item_id: 'ITEM_101', name: 'Truffle Tagliatelle', qty: 2, price: 450 },
              { item_id: 'ITEM_204', name: 'Sparkling Lemonade', qty: 1, price: 150 }
            ]
          })
        });
        const data = await res.json();
        if (terminal) terminal.innerText = JSON.stringify(data, null, 2);
        if (termStatus) termStatus.innerText = 'Order Ingested & Ledger Written';
        window.showToast(`Order settled! ${data.customer.points_earned} points earned, new balance: ${data.customer.new_balance} pts`);
      } catch (err) {
        if (terminal) terminal.innerText = `Error contacting engine: ${err.message}`;
        if (termStatus) termStatus.innerText = 'Error';
      }
    };
  }

  const btnLogs = document.getElementById('btn-view-webhook-logs');
  if (btnLogs) {
    btnLogs.onclick = async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/pos/webhook-logs'));
        const data = await res.json();
        if (terminal) terminal.innerText = JSON.stringify(data.logs.slice(0, 5), null, 2);
        if (termStatus) termStatus.innerText = `Showing last ${Math.min(5, data.count)} webhook events`;
        window.showToast(`Retrieved ${data.count} POS webhook logs`);
      } catch (err) {
        if (terminal) terminal.innerText = `Error fetching logs: ${err.message}`;
      }
    };
  }
}

