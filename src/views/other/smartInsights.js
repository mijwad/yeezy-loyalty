// Smart Insights View - AI-powered analytics dashboard
export function renderSmartInsightsView(state) {
  const { customers, todayStats, creditsBalance } = state;
  const totalRevenue = customers.reduce((sum, c) => sum + c.numericSpend, 0);
  const vipCustomers = customers.filter(c => c.tier === 'VIP');
  const atRiskCustomers = customers.filter(c => c.tier === 'At Risk');

  return `
    <div class="px-4 md:px-margin py-space-lg flex flex-col gap-space-lg max-w-7xl mx-auto animate-fade-in pb-16">
      <div>
        <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-3xl">insights</span>
          Smart Insights
        </h1>
        <p class="text-xs md:text-sm text-gray-500 mt-1 font-medium">
          AI-powered analytics and actionable recommendations for your restaurant loyalty program.
        </p>
      </div>

      <!-- AI Recommendation Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Revenue Insight -->
        <div class="bg-gradient-to-br from-purple-50 to-white rounded-2xl p-6 border border-purple-200 shadow-sm">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <span class="material-symbols-outlined text-primary text-xl">auto_awesome</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-primary">AI Insight</span>
          </div>
          <h3 class="text-base font-bold text-gray-900">Revenue Opportunity Detected</h3>
          <p class="text-xs text-gray-600 mt-2 leading-relaxed">
            Your VIP segment (${vipCustomers.length} diners) generates <strong class="text-primary">₹${vipCustomers.reduce((s,c) => s + c.numericSpend, 0).toLocaleString()}</strong> in lifetime revenue. 
            Increasing VIP visit frequency by just 1 visit/month could add <strong>₹${Math.round(vipCustomers.length * 2500).toLocaleString()}</strong> in monthly revenue.
          </p>
          <button type="button" class="mt-4 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition shadow-sm" onclick="window.showToast('VIP engagement campaign created!')">
            Create VIP Campaign
          </button>
        </div>

        <!-- Churn Prevention -->
        <div class="bg-gradient-to-br from-red-50 to-white rounded-2xl p-6 border border-red-200 shadow-sm">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-red-600 text-xl">warning</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Action Required</span>
          </div>
          <h3 class="text-base font-bold text-gray-900">Churn Risk Alert</h3>
          <p class="text-xs text-gray-600 mt-2 leading-relaxed">
            <strong>${atRiskCustomers.length} customer${atRiskCustomers.length !== 1 ? 's' : ''}</strong> haven't visited in 30+ days with 
            <strong class="text-red-600">${atRiskCustomers.reduce((s,c) => s + c.numericPoints, 0).toLocaleString()} unredeemed points</strong>. 
            Sending a personalized win-back message now could recover an estimated ₹${Math.round(atRiskCustomers.length * 1800).toLocaleString()} in revenue.
          </p>
          <button type="button" class="mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition shadow-sm" onclick="window.showToast('Win-back messages sent to ${atRiskCustomers.length} at-risk diners!')">
            Send Win-Back Now
          </button>
        </div>

        <!-- Credits Insight -->
        <div class="bg-gradient-to-br from-teal-50 to-white rounded-2xl p-6 border border-teal-200 shadow-sm">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-teal-700 text-xl">bolt</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">Optimization</span>
          </div>
          <h3 class="text-base font-bold text-gray-900">Messaging Credits Health</h3>
          <p class="text-xs text-gray-600 mt-2 leading-relaxed">
            You have <strong>${creditsBalance.sms} SMS</strong>, <strong>${creditsBalance.whatsappUtility} WhatsApp</strong>, and <strong>${creditsBalance.email} Email</strong> credits remaining. 
            ${(creditsBalance.sms + creditsBalance.whatsappUtility) < 200 
              ? 'Your credits are running low! Consider topping up to avoid disruption in automated notifications.' 
              : 'Credits are healthy for the next 2 weeks of automated campaigns.'}
          </p>
          <a href="#dashboard" class="mt-4 inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition shadow-sm">
            <span class="material-symbols-outlined text-sm">paid</span>
            View Credits Dashboard
          </a>
        </div>

        <!-- Peak Hours Insight -->
        <div class="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-6 border border-amber-200 shadow-sm">
          <div class="flex items-start justify-between mb-3">
            <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-amber-700 text-xl">schedule</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Trend</span>
          </div>
          <h3 class="text-base font-bold text-gray-900">Peak Dining Hours Analysis</h3>
          <p class="text-xs text-gray-600 mt-2 leading-relaxed">
            Your busiest loyalty engagement windows are <strong>12:30 PM – 2:00 PM</strong> (lunch) and <strong>7:30 PM – 9:30 PM</strong> (dinner). 
            Scheduling campaigns 2 hours before peak times increases open rates by <strong class="text-amber-700">42%</strong>.
          </p>
          <button type="button" class="mt-4 px-4 py-2 rounded-xl border-2 border-amber-600 text-amber-700 text-xs font-bold hover:bg-amber-600 hover:text-white transition" onclick="window.showToast('Campaign scheduling optimized for peak hours!')">
            Optimize Campaign Timing
          </button>
        </div>
      </div>

      <!-- Weekly Performance Summary -->
      <div class="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h3 class="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-lg">monitoring</span>
          This Week's Performance Summary
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="p-4 bg-gray-50 rounded-xl text-center">
            <div class="text-2xl font-black text-gray-900">${todayStats.orders * 7}</div>
            <div class="text-[10px] font-bold text-gray-500 uppercase mt-1">Total Orders</div>
            <div class="text-[10px] font-bold text-emerald-600 mt-1">+14% vs last week</div>
          </div>
          <div class="p-4 bg-gray-50 rounded-xl text-center">
            <div class="text-2xl font-black text-gray-900">₹${(todayStats.sales * 7).toLocaleString()}</div>
            <div class="text-[10px] font-bold text-gray-500 uppercase mt-1">Weekly Revenue</div>
            <div class="text-[10px] font-bold text-emerald-600 mt-1">+18% vs last week</div>
          </div>
          <div class="p-4 bg-gray-50 rounded-xl text-center">
            <div class="text-2xl font-black text-gray-900">${todayStats.rewardsRedeemed * 7}</div>
            <div class="text-[10px] font-bold text-gray-500 uppercase mt-1">Rewards Claimed</div>
            <div class="text-[10px] font-bold text-emerald-600 mt-1">+22% vs last week</div>
          </div>
          <div class="p-4 bg-gray-50 rounded-xl text-center">
            <div class="text-2xl font-black text-primary">${todayStats.loyaltyRoi}</div>
            <div class="text-[10px] font-bold text-gray-500 uppercase mt-1">Loyalty ROI</div>
            <div class="text-[10px] font-bold text-emerald-600 mt-1">Industry-leading</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
