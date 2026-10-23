// Floating Toast Notification System

export function showToast(message, type = 'success') {
  const existing = document.getElementById('yeezy-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'yeezy-toast';
  toast.className = `fixed bottom-5 right-5 z-[9999] px-5 py-3 rounded-2xl shadow-2xl text-white text-xs font-bold flex items-center gap-2.5 animate-bounce transition-all ${
    type === 'error' ? 'bg-red-600' : 'bg-[#008384]'
  }`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-base">${type === 'error' ? 'error' : 'check_circle'}</span>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Ensure global accessibility for inline event handlers
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}
