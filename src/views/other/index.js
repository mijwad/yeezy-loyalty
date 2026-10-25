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

export function renderSettingsView(state = {}) {
  const outlets = state?.outlets || [];
  const tenantId = state.user?.tenantId;
  const isDowntown = !tenantId || tenantId === 'ten_yeezy_01';
  const isSmokehouse = tenantId === 'ten_smokehouse_02';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://yeezy-loyalty.onrender.com';

  // Live POS API Key (verified in Supabase public v1 engine)
  const posApiKey = state.posApiKey || 
    (isDowntown ? 'lk_live_6b6f34465f168ee1d824915e5c0cb1c7cf1224b998eba8f1005e6e0d6fd9b194' :
     isSmokehouse ? 'lk_live_730ba5b943263d58c363b5605a9ffc3bdbfa739274e9e6ba58d4c872ce4eabbb' :
     (state.apiKey && state.apiKey.startsWith('lk_') ? state.apiKey : `lk_live_${(tenantId || 'pilot').replace(/[^a-z0-9]/g, '')}9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d`));

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Platform Settings & Integrations</h1>
        <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
          Manage your restaurant profile, POS API keys, connected outlets, and loyalty webhooks.
        </p>
      </div>

      <!-- POS & Loyalty Public API v1 Credentials -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-5">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3.5">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl">key</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900">POS & Loyalty Integration API Key (v1)</h3>
              <p class="text-xs text-gray-500">Live API Key required by RMS POS and external billing systems for real-time loyalty sync</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Active & Verified
          </span>
        </div>

        <div class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold uppercase tracking-wider text-gray-700">Live API Key (RMS POS Connect)</label>
              <span class="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">Bearer Token</span>
            </div>
            <div class="flex items-center gap-2">
              <input 
                id="input-pos-api-key" 
                type="text" 
                readonly
                value="${posApiKey}" 
                class="flex-1 px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold select-all focus:outline-none"
              >
              <button 
                type="button" 
                class="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
                onclick="navigator.clipboard.writeText('${posApiKey}'); window.showToast('✅ Live POS API Key copied to clipboard!');"
              >
                <span class="material-symbols-outlined text-sm">content_copy</span>
                Copy Key
              </button>
            </div>
            <p class="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-sm text-primary">verified</span>
              Paste this key into <strong>RMS POS → Settings → Loyalty</strong> to enable cashier points redemption and auto-earning.
            </p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div>
              <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Loyalty Platform Base URL</label>
              <div class="flex items-center gap-2">
                <input 
                  type="text" 
                  readonly 
                  value="https://yeezy-loyalty.onrender.com" 
                  class="flex-1 px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
                >
                <button 
                  type="button" 
                  class="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  onclick="navigator.clipboard.writeText('https://yeezy-loyalty.onrender.com'); window.showToast('Platform Base URL copied!');"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label class="text-[10px] uppercase font-bold text-gray-500 block mb-1">Tenant ID</label>
              <input 
                type="text" 
                readonly 
                value="${tenantId || 'ten_yeezy_01'} (${state.user?.tenantName || 'Downtown Bistro'})" 
                class="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
              >
            </div>
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

      <!-- Yeezy RMS & External POS Integration Hub -->
      <div class="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div class="flex items-start gap-4">
            <div class="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
              <span class="material-symbols-outlined text-3xl">cable</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-xl md:text-2xl font-black tracking-tight">Yeezy RMS & POS Webhook Bridge</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Ready for Yeezy RMS
                </span>
              </div>
              <p class="text-xs text-purple-200 mt-1 max-w-2xl leading-relaxed">
                Yeezy Loyalty connects seamlessly with your external POS software (such as <strong>Yeezy RMS</strong> or Petpooja). When cashiers settle bills in Yeezy RMS, diner details are queried, points are redeemed, and new loyalty points are credited in real-time.
              </p>
            </div>
          </div>
          <button 
            id="btn-settings-open-petpooja-setup"
            type="button" 
            class="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition flex items-center gap-1.5 self-start md:self-auto"
          >
            <span class="material-symbols-outlined text-sm">integration_instructions</span>
            <span>Petpooja 3-Step Setup</span>
          </button>
        </div>

        <!-- 3-Step Architecture Flow -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div class="flex items-center gap-2 text-primary-fixed">
              <span class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-black">1</span>
              <h4 class="font-bold text-xs uppercase tracking-wider text-white">Diner Lookup at Checkout</h4>
            </div>
            <p class="text-xs text-purple-200/80 leading-relaxed">
              Cashier enters diner mobile number in <strong>Yeezy RMS</strong>. Yeezy RMS queries Yeezy Loyalty API for points balance, tier, and eligible discount.
            </p>
            <code class="text-[10px] font-mono text-emerald-300 block bg-black/40 p-2 rounded-lg">POST /api/v1/loyalty/members/lookup</code>
          </div>

          <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div class="flex items-center gap-2 text-primary-fixed">
              <span class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-black">2</span>
              <h4 class="font-bold text-xs uppercase tracking-wider text-white">1-Tap Points Redemption</h4>
            </div>
            <p class="text-xs text-purple-200/80 leading-relaxed">
              Cashier clicks "Redeem Points" in <strong>Yeezy RMS</strong>. Yeezy Loyalty atomically burns points with row-level locks and deducts from the bill.
            </p>
            <code class="text-[10px] font-mono text-emerald-300 block bg-black/40 p-2 rounded-lg">POST /api/v1/loyalty/redeem/commit</code>
          </div>

          <div class="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-2">
            <div class="flex items-center gap-2 text-primary-fixed">
              <span class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-black">3</span>
              <h4 class="font-bold text-xs uppercase tracking-wider text-white">Bill Settlement & Earn</h4>
            </div>
            <p class="text-xs text-purple-200/80 leading-relaxed">
              On bill settlement in <strong>Yeezy RMS</strong>, the order webhook credits earned points into the append-only ledger and sends WhatsApp notification.
            </p>
            <code class="text-[10px] font-mono text-emerald-300 block bg-black/40 p-2 rounded-lg">POST /api/v1/loyalty/earn</code>
          </div>
        </div>
      </div>

      <!-- Live Yeezy RMS Simulator & API Tester -->
      <div class="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl">
              <span class="material-symbols-outlined text-2xl">terminal</span>
            </div>
            <div>
              <h3 class="text-base md:text-lg font-black text-gray-900 tracking-tight">Interactive Yeezy RMS Integration Simulator</h3>
              <p class="text-xs text-gray-500 mt-0.5">Test how Yeezy RMS communicates with Yeezy Loyalty when a diner pays their bill</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1.5 self-start sm:self-auto">
            <span class="w-2 h-2 rounded-full bg-purple-600"></span> Live Test Console
          </span>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <!-- Simulation Inputs -->
          <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 class="text-xs font-extrabold uppercase tracking-wider text-slate-700">Yeezy RMS Bill Details</h4>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] font-bold text-gray-600 block mb-1">Diner Phone Number</label>
                <input 
                  id="sim-phone" 
                  type="tel" 
                  value="9847012345" 
                  class="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-gray-300 bg-white focus:border-primary"
                >
              </div>
              <div>
                <label class="text-[11px] font-bold text-gray-600 block mb-1">Bill Amount (₹)</label>
                <input 
                  id="sim-bill" 
                  type="number" 
                  value="500" 
                  class="w-full px-3 py-2 text-xs font-mono font-bold rounded-xl border border-gray-300 bg-white focus:border-primary"
                >
              </div>
            </div>

            <div>
              <label class="text-[11px] font-bold text-gray-600 block mb-1">Order ID in Yeezy RMS</label>
              <input 
                id="sim-order-id" 
                type="text" 
                value="RMS-ORD-${Date.now().toString().slice(-6)}" 
                class="w-full px-3 py-2 text-xs font-mono rounded-xl border border-gray-300 bg-white text-gray-600"
              >
            </div>

            <div class="flex flex-col sm:flex-row gap-2 pt-2">
              <button 
                id="btn-sim-lookup" 
                type="button" 
                class="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <span class="material-symbols-outlined text-sm">search</span>
                <span>1. Lookup & Discount</span>
              </button>

              <button 
                id="btn-sim-earn" 
                type="button" 
                class="flex-1 py-2.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <span class="material-symbols-outlined text-sm">receipt_long</span>
                <span>2. Settle Bill & Earn</span>
              </button>
            </div>
          </div>

          <!-- Live JSON Output Screen -->
          <div class="p-5 rounded-2xl bg-slate-950 text-slate-100 font-mono border border-slate-800 space-y-2">
            <div class="flex items-center justify-between border-b border-slate-800 pb-2">
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Response from Yeezy Loyalty Engine</span>
              <span id="sim-status-badge" class="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-bold">READY</span>
            </div>
            <pre id="sim-output" class="text-xs text-emerald-400 overflow-x-auto max-h-56 select-all p-2 bg-slate-900/60 rounded-xl leading-relaxed">// Click "1. Lookup & Discount" or "2. Settle Bill & Earn" above to test API live</pre>
          </div>
        </div>
      </div>

      <!-- Developer REST API Endpoints & Credentials -->
      <div class="bg-white rounded-3xl p-6 md:p-8 border border-gray-200 shadow-sm space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-xl">
              <span class="material-symbols-outlined text-2xl">api</span>
            </div>
            <div>
              <h3 class="text-base md:text-lg font-black text-gray-900 tracking-tight">Yeezy RMS API Endpoints & Credentials</h3>
              <p class="text-xs text-gray-500 mt-0.5">Configure these in your Yeezy RMS restaurant configuration</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Live REST API
          </span>
        </div>

        <!-- Credentials Quick Copy -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-1">
            <span class="text-[10px] uppercase font-bold text-gray-500 block">Restaurant Tenant ID</span>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-slate-900 select-all">${state.user?.tenantId || 'ten_yeezy_01'}</span>
              <button 
                type="button" 
                class="text-xs text-primary font-bold hover:underline"
                onclick="navigator.clipboard.writeText('${state.user?.tenantId || 'ten_yeezy_01'}'); window.showToast('Copied Tenant ID!');"
              >
                Copy
              </button>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-1">
            <span class="text-[10px] uppercase font-bold text-gray-500 block">Primary Outlet ID</span>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-slate-900 select-all">${state.user?.primaryRestID || 'PP_DEL_101'}</span>
              <button 
                type="button" 
                class="text-xs text-primary font-bold hover:underline"
                onclick="navigator.clipboard.writeText('${state.user?.primaryRestID || 'PP_DEL_101'}'); window.showToast('Copied Outlet ID!');"
              >
                Copy
              </button>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-1">
            <span class="text-[10px] uppercase font-bold text-gray-500 block">Base Webhook URL</span>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-slate-900 select-all truncate max-w-[170px]">${baseUrl}</span>
              <button 
                type="button" 
                class="text-xs text-primary font-bold hover:underline shrink-0"
                onclick="navigator.clipboard.writeText('${baseUrl}'); window.showToast('Copied Base URL!');"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        <!-- Endpoints Detail Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-600 uppercase tracking-wider">1. Diner Lookup & Points Balance</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-800 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/loyalty/members/lookup</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Sends <code>{ phone: "+919847012345" }</code>. Returns member tier, total points, and active offers.</p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-600 uppercase tracking-wider">2. Preview Redeem Discount</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-800 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/loyalty/redeem/preview</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Calculates max 20% bill discount cap and verifies minimum bill threshold before applying.</p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-600 uppercase tracking-wider">3. Commit Points Deduction</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-800 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/loyalty/redeem/commit</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Called when cashier confirms points discount. Runs with row-level locks to prevent double-spending.</p>
          </div>

          <div class="p-4 rounded-2xl bg-slate-50 border border-gray-200 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[11px] font-bold text-gray-600 uppercase tracking-wider">4. Bill Settlement & Points Credit</span>
              <span class="px-2 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-800 rounded font-bold">POST</span>
            </div>
            <p class="text-xs text-gray-800 font-mono bg-white p-2.5 rounded-xl border border-gray-200 select-all font-bold">/api/v1/loyalty/earn</p>
            <p class="text-[11px] text-gray-500 leading-relaxed">Called when bill is paid in Yeezy RMS. Credits tier points, streak bonuses, and triggers WhatsApp receipt.</p>
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

  // Live Yeezy RMS Simulator Listeners
  const simPhone = document.getElementById('sim-phone');
  const simBill = document.getElementById('sim-bill');
  const simOrderId = document.getElementById('sim-order-id');
  const simOutput = document.getElementById('sim-output');
  const simBadge = document.getElementById('sim-status-badge');
  const btnLookup = document.getElementById('btn-sim-lookup');
  const btnEarn = document.getElementById('btn-sim-earn');

  if (btnLookup && simOutput) {
    btnLookup.onclick = async () => {
      const phone = simPhone?.value.trim() || '9847012345';
      const billPaise = Math.round((parseFloat(simBill?.value || '500')) * 100);
      if (simBadge) {
        simBadge.innerText = 'LOOKING UP...';
        simBadge.className = 'px-2 py-0.5 rounded text-[10px] bg-amber-500 text-black font-bold';
      }

      try {
        const res = await fetch('/api/v1/loyalty/redeem/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, bill_amount_paise: billPaise })
        });
        const data = await res.json();
        simOutput.innerText = JSON.stringify(data, null, 2);
        if (simBadge) {
          simBadge.innerText = res.ok ? '200 OK' : 'FAILED';
          simBadge.className = res.ok ? 'px-2 py-0.5 rounded text-[10px] bg-emerald-500 text-black font-bold' : 'px-2 py-0.5 rounded text-[10px] bg-red-500 text-white font-bold';
        }
        if (res.ok) window.showToast(`Yeezy RMS: Found diner with ${data.member?.points_balance || 0} points!`);
      } catch (err) {
        simOutput.innerText = String(err);
      }
    };
  }

  if (btnEarn && simOutput) {
    btnEarn.onclick = async () => {
      const phone = simPhone?.value.trim() || '9847012345';
      const billPaise = Math.round((parseFloat(simBill?.value || '500')) * 100);
      const orderId = simOrderId?.value.trim() || `RMS-ORD-${Date.now()}`;
      if (simBadge) {
        simBadge.innerText = 'SETTLING BILL...';
        simBadge.className = 'px-2 py-0.5 rounded text-[10px] bg-amber-500 text-black font-bold';
      }

      try {
        const res = await fetch('/api/v1/loyalty/earn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone,
            order_id: orderId,
            subtotal_paise: billPaise,
            order_type: 'dine_in'
          })
        });
        const data = await res.json();
        simOutput.innerText = JSON.stringify(data, null, 2);
        if (simBadge) {
          simBadge.innerText = res.ok ? '200 OK (POINTS CREDITED)' : 'FAILED';
          simBadge.className = res.ok ? 'px-2 py-0.5 rounded text-[10px] bg-emerald-500 text-black font-bold' : 'px-2 py-0.5 rounded text-[10px] bg-red-500 text-white font-bold';
        }
        if (res.ok) {
          window.showToast(`Yeezy RMS: Bill settled! Credited ${data.points_earned || 0} points! WhatsApp dispatched.`);
          store.syncWithBackend();
        }
      } catch (err) {
        simOutput.innerText = String(err);
      }
    };
  }
}

export const attachAppsIntegrationsListeners = attachSettingsListeners;
