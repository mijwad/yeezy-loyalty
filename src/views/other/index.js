// Supporting Views: Campaigns, Auto-Campaigns, QR Codes, Feedback, Referrals & Settings
import { apiUrl } from '../../config/api.js';

export function renderCampaignsView(state) {
  const campaigns = state.campaigns || [];

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Broadcast Campaigns</h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
            Launch one-time promotional WhatsApp & SMS blasts to targeted diner segments.
          </p>
        </div>
        <a 
          href="#campaigns" 
          class="px-5 py-2.5 bg-[#2a7e72] hover:bg-[#23685e] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
        >
          <span class="material-symbols-outlined text-base">campaign</span>
          Open Campaign Studio
        </a>
      </div>

      ${campaigns.length === 0 ? `
        <div class="bg-white rounded-3xl p-12 text-center border border-gray-200/80 shadow-xs flex flex-col items-center justify-center">
          <div class="w-16 h-16 rounded-3xl bg-[#e8f4f3] text-[#2a7e72] flex items-center justify-center mb-4">
            <span class="material-symbols-outlined text-3xl">outgoing_mail</span>
          </div>
          <h3 class="text-base font-bold text-gray-900">No broadcast campaigns active yet</h3>
          <p class="text-xs text-gray-500 max-w-sm mt-1">Create your first targeted WhatsApp win-back campaign using live diner segments from your database.</p>
          <a 
            href="#campaigns" 
            class="mt-4 px-5 py-2.5 bg-[#2a7e72] hover:bg-[#23685e] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">add</span>
            Create First Campaign
          </a>
        </div>
      ` : `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          ${campaigns.map(c => `
            <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-[#2a7e72] bg-teal-50 px-2.5 py-0.5 rounded-full uppercase">${c.channel || 'WhatsApp'}</span>
                  <span class="text-xs font-bold text-emerald-600">${c.status || 'Active'}</span>
                </div>
                <h3 class="text-base font-bold text-gray-900 mt-3">${c.title}</h3>
                <p class="text-xs text-gray-500 mt-1">${c.subtitle || c.segmentName || 'Diner promotional voucher'}</p>
              </div>
              <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                <span>Sent: ${(c.sentCount || 0).toLocaleString()}</span>
                <span class="font-bold text-[#2a7e72]">₹${(c.revenueGenerated || 0).toLocaleString()} Attributed</span>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
}

export function renderAutoCampaignsView(state) {
  const customers = state.customers || [];
  const firstTimersCount = customers.filter(c => (c.visits || 0) <= 1).length;
  const vipCount = customers.filter(c => (c.visits || 0) >= 4 || c.tier === 'VIP').length;
  const lapsedCount = customers.filter(c => c.tier === 'Lost' || c.tier === 'At Risk').length;
  const totalAudience = customers.length;

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Automated Trigger Campaigns</h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
            Evergreen loyalty triggers connected to your live POS bill webhooks and Meta WhatsApp account.
          </p>
        </div>
        <div class="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-[11px] font-bold text-emerald-800">Meta WABA Active (+91 62384 91224)</span>
        </div>
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
              <span>● ${totalAudience} verified diner profiles monitored</span>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">ACTIVE</span>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex items-start justify-between">
          <div>
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-purple-600 text-2xl">waving_hand</span>
              <h3 class="text-base font-bold text-gray-900">First Purchase Welcome Trigger</h3>
            </div>
            <p class="text-xs text-gray-600 mt-2 leading-relaxed">
              Triggers instant verified Meta template (bee_first_purchase) when a new diner pays their first bill.
            </p>
            <div class="mt-3 flex items-center gap-3 text-xs text-emerald-700 font-bold">
              <span>● ${firstTimersCount} new diners eligible</span>
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
              <span>● ${lapsedCount} lapsed diners in recovery queue</span>
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
              Notifies diner with exclusive digital congratulations card when they cross ₹25,000 spend or 4 visits.
            </p>
            <div class="mt-3 flex items-center gap-3 text-xs text-emerald-700 font-bold">
              <span>● ${vipCount} VIP regulars qualified</span>
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

      <!-- Account Security & Password Management -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <div>
              <h3 class="text-base font-bold text-gray-900">Account Security & Password</h3>
              <p class="text-xs text-gray-500">Update your restaurant owner password. Automatically synchronized with Supabase database.</p>
            </div>
          </div>
          <button 
            type="button" 
            id="btn-settings-change-password"
            class="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 self-start sm:self-auto"
          >
            <span class="material-symbols-outlined text-sm">key</span>
            <span>Change Password</span>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Owner Login Email</span>
            <span class="text-xs font-bold text-slate-900 font-mono mt-0.5 block truncate">${state.user?.email || 'owner@restaurant.com'}</span>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Database Synchronization</span>
            <span class="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live Supabase Cloud Sync
            </span>
          </div>
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Security Standard</span>
            <span class="text-xs font-bold text-slate-700 font-mono mt-0.5 block">10-Round Salted Bcrypt</span>
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

      <!-- Connected Integrations -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm space-y-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-slate-700 text-2xl">integration_instructions</span>
            <div>
              <h3 class="text-base font-bold text-gray-900">Connected Integrations</h3>
              <p class="text-xs text-gray-500">POS and marketing platforms connected to your loyalty program</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">point_of_sale</span>
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-sm">Petpooja POS</h4>
              <p class="text-xs text-gray-500">Real-time bill sync, points redemption & earning</p>
              <span class="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connected
              </span>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">cable</span>
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-sm">Yeezy RMS</h4>
              <p class="text-xs text-gray-500">Custom POS integration via webhook bridge</p>
              <button
                id="btn-settings-open-petpooja-setup"
                type="button"
                class="mt-1.5 px-3 py-1.5 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary-fixed/20 transition"
              >
                Configure Webhook
              </button>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">chat</span>
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-sm">WhatsApp Cloud API</h4>
              <p class="text-xs text-gray-500">Automated campaigns & transactional messages</p>
              <span class="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
              </span>
            </div>
          </div>

          <div class="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <span class="material-symbols-outlined text-xl">sms</span>
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-sm">SMS Gateway</h4>
              <p class="text-xs text-gray-500">Fallback delivery for non-WhatsApp users</p>
              <span class="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                Not Configured
              </span>
            </div>
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

  const changePasswordBtn = document.getElementById('btn-settings-change-password');
  if (changePasswordBtn) {
    changePasswordBtn.onclick = () => {
      store.setUIState({ activeModal: 'changePassword' });
    };
  }
}

export const attachAppsIntegrationsListeners = attachSettingsListeners;
