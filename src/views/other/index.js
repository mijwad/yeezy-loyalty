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

      <!-- POS & Webhook Integration Endpoints Card -->
      <div class="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl">
              <span class="material-symbols-outlined text-2xl">cable</span>
            </div>
            <div>
              <h3 class="text-base md:text-lg font-black text-gray-900 tracking-tight">POS Integration Endpoints</h3>
              <p class="text-xs text-gray-500 mt-0.5">Use these URLs to connect your physical POS billing terminal (Petpooja, POSist, or custom RMS)</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Live & Ready
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">1. Loyalty Inquiry Endpoint</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-700 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/pos/loyalty/inquire</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Looks up customer points balance and available discount vouchers when cashier enters mobile number.</p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">2. Points Lock / Apply Voucher</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-700 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/pos/loyalty/lock</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Locks points when cashier selects voucher and returns net discounted bill total.</p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">3. Order Settlement / Ledger Save</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-700 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/pos/orders/save</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Called when cashier settles bill. Credits 10% points, burns redeemed points, and logs to ledger.</p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">4. Bill Void / Cancellation</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-700 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/pos/orders/cancel</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Reverses earned and burned points if a bill is cancelled or voided by restaurant manager.</p>
          </div>
        </div>
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
}


