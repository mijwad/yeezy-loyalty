// Reusable Info Tooltip with Lightbulb icon and sleek dark hover card
export function renderInfoTooltip(text, align = 'right') {
  const alignClass = align === 'left' ? 'left-0' : 'right-0';
  const arrowClass = align === 'left' ? 'left-2' : 'right-2';

  return `
    <div class="relative group/info inline-flex items-center">
      <button 
        type="button" 
        class="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-help focus:outline-none"
        aria-label="Info explanation"
        tabindex="0"
      >
        <span class="material-symbols-outlined text-[16px] leading-none select-none">info</span>
      </button>

      <!-- Tooltip Box on Hover -->
      <div class="absolute ${alignClass} top-full mt-2 w-64 p-3.5 bg-[#18181b] text-white rounded-2xl shadow-2xl border border-slate-700/80 z-50 opacity-0 pointer-events-none group-hover/info:opacity-100 group-hover/info:pointer-events-auto transition-all duration-200 transform translate-y-1 group-hover/info:translate-y-0 text-left">
        <!-- Arrow pointing up -->
        <div class="absolute -top-1.5 ${arrowClass} w-3 h-3 bg-[#18181b] border-t border-l border-slate-700/80 rotate-45"></div>
        
        <div class="flex items-start gap-2.5 relative z-10">
          <div class="w-6 h-6 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0 mt-0.5">
            <span class="material-symbols-outlined text-amber-400 text-sm">lightbulb</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed font-normal">
            ${text}
          </p>
        </div>
      </div>
    </div>
  `;
}
