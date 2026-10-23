// 12-Week Interactive Visualizer Bar Chart Card
import { store } from '../../state/store.js';

export function renderBarChartCard(businessHighlights) {
  const activeTabKey = businessHighlights.activeTab || 'sales';
  const activeChart = businessHighlights.tabs[activeTabKey] || businessHighlights.tabs.sales;

  return `
    <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-space-md">
      <div class="flex flex-col gap-space-md">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-space-xs">
            <span class="material-symbols-outlined text-primary text-xl">insights</span>
            <h3 class="font-headline-md text-lg md:text-xl font-bold text-on-surface tracking-tight">Business Highlights</h3>
          </div>
          <div class="flex items-center gap-space-sm flex-wrap">
            <button class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors shadow-sm" type="button">
              <span>Last 12 Weeks</span>
              <span class="text-[11px] text-on-surface-variant font-normal">27, Jul 26 - 21, Oct 26</span>
              <span class="material-symbols-outlined text-sm text-on-surface-variant">expand_more</span>
            </button>
            <button 
              id="btn-chart-fullscreen" 
              class="p-1.5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors shadow-sm" 
              title="Fullscreen view" 
              type="button"
              onclick="window.showToast('Full screen chart mode toggled')"
            >
              <span class="material-symbols-outlined text-base">open_in_full</span>
            </button>
          </div>
        </div>

        <!-- Tab Selectors with Values (Interactive switcher) -->
        <div class="flex items-center gap-space-lg border-b border-outline-variant/30 overflow-x-auto pb-0.5">
          ${['sales', 'orders', 'customers', 'rewards'].map(tabKey => {
            const tab = businessHighlights.tabs[tabKey];
            const isActive = activeTabKey === tabKey;
            return `
              <button 
                type="button"
                data-chart-tab="${tabKey}" 
                class="chart-tab-btn relative pb-3 flex flex-col items-start gap-0.5 text-left transition-all ${isActive ? 'text-on-surface' : 'text-on-surface-variant hover:text-on-surface'}"
              >
                <span class="text-2xl font-black leading-tight tracking-tight">${tab.totalDisplay}</span>
                <span class="text-xs font-bold">${tab.label}</span>
                ${isActive ? '<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 12-Week Bar Chart Area with Peak Tooltip -->
      <div class="relative pt-6 pb-2 px-space-md flex flex-col justify-end min-h-[220px]">
        <!-- Centered Peak Tooltip Card -->
        <div class="absolute top-2 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-outline-variant/40 rounded-xl px-space-md py-space-sm shadow-lg flex items-center gap-space-sm z-10 pointer-events-none">
          <div class="w-9 h-9 rounded-full bg-primary-fixed/50 flex items-center justify-center text-primary shrink-0">
            <span class="material-symbols-outlined text-lg">trending_up</span>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-xs text-on-surface">${activeChart.peakHighlight}</span>
              <span class="inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                ${activeChart.peakGrowth}
              </span>
            </div>
            <span class="text-[11px] text-on-surface-variant font-medium">${activeChart.peakSubtitle}</span>
          </div>
        </div>

        <!-- Bars Container (12 Weeks) -->
        <div class="w-full flex items-end justify-between gap-2 sm:gap-3 h-44 pt-12">
          ${activeChart.bars.map(bar => `
            <div 
              class="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer relative" 
              title="${bar.label}: ${bar.amount}"
            >
              <!-- Hover Value Tooltip -->
              <div class="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold py-0.5 px-1.5 rounded pointer-events-none whitespace-nowrap z-20 shadow-md">
                ${bar.amount}
              </div>

              <div 
                class="w-full max-w-[42px] transition-all rounded-t-xl duration-300 ${bar.isPeak ? 'bg-primary hover:bg-primary/90 shadow-sm' : 'bg-primary-fixed/40 group-hover:bg-primary-fixed'}" 
                style="height: ${bar.value}%;"
              ></div>
              <span class="text-[11px] font-semibold transition-colors ${bar.isPeak ? 'text-primary font-bold' : 'text-on-surface-variant group-hover:text-primary'}">
                ${bar.label}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function attachBarChartListeners() {
  document.querySelectorAll('.chart-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tabKey = btn.getAttribute('data-chart-tab');
      if (tabKey) {
        store.setState(s => ({
          ...s,
          businessHighlights: {
            ...s.businessHighlights,
            activeTab: tabKey
          }
        }));
      }
    };
  });
}
