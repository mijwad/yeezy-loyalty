// Login Screen View Module
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { apiUrl } from '../../config/api.js';

export function renderLoginView() {
  return `
    <div class="min-h-screen bg-gradient-to-br from-[#12052b] via-[#1a0e38] to-[#0a0319] flex items-center justify-center p-4 sm:p-6 antialiased">
      <div class="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/20 animate-fade-in relative overflow-hidden">
        
        <!-- Ambient background glow -->
        <div class="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-primary/20 blur-2xl pointer-events-none"></div>
        <div class="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-teal-500/20 blur-2xl pointer-events-none"></div>

        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center mb-8 relative z-10">
          <div class="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-2xl shadow-lg mb-3">
            Y
          </div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">Yeezy Loyalty Platform</h1>
          <p class="text-xs text-gray-500 mt-1 font-medium">Sign in to your restaurant operator or super admin account</p>
        </div>

        <!-- Quick 1-Click Demo Login Switcher -->
        <div class="mb-6 p-3.5 rounded-2xl bg-purple-50/80 border border-purple-100 relative z-10">
          <span class="text-[10px] uppercase font-black text-primary tracking-wider block mb-2 text-center">
            ⚡ Quick Demo 1-Click Credentials
          </span>
          <div class="grid grid-cols-2 gap-2">
            <button 
              id="btn-quick-admin" 
              type="button" 
              class="py-2 px-2.5 rounded-xl bg-white border border-purple-200 hover:border-primary text-gray-800 text-[11px] font-bold transition shadow-xs flex flex-col items-center"
            >
              <span class="text-amber-600 font-extrabold flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">shield_person</span> Super Admin
              </span>
              <span class="text-[9px] text-gray-400 mt-0.5">admin@yeezy.com</span>
            </button>

            <button 
              id="btn-quick-owner" 
              type="button" 
              class="py-2 px-2.5 rounded-xl bg-white border border-purple-200 hover:border-primary text-gray-800 text-[11px] font-bold transition shadow-xs flex flex-col items-center"
            >
              <span class="text-teal-700 font-extrabold flex items-center gap-1">
                <span class="material-symbols-outlined text-xs">storefront</span> Restaurant Owner
              </span>
              <span class="text-[9px] text-gray-400 mt-0.5">alex.rivera@...</span>
            </button>
          </div>
        </div>

        <!-- Login Form -->
        <form id="login-form" class="space-y-4 relative z-10">
          <div>
            <label class="text-xs font-bold text-gray-700 block mb-1.5">Email Address</label>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">mail</span>
              <input 
                id="login-email" 
                type="email" 
                required 
                value="alex.rivera@downtownbistro.com" 
                placeholder="name@restaurant.com" 
                class="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium"
              >
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold text-gray-700">Password</label>
              <a href="javascript:void(0)" class="text-[11px] text-primary hover:underline font-bold" onclick="window.showToast('Please contact Super Admin for password recovery')">Forgot?</a>
            </div>
            <div class="relative">
              <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
              <input 
                id="login-password" 
                type="password" 
                required 
                value="owner123" 
                placeholder="••••••••" 
                class="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium"
              >
            </div>
          </div>

          <div class="pt-2">
            <button 
              id="btn-submit-login" 
              type="submit" 
              class="w-full py-3.5 px-4 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-primary/25 flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Sign In to Yeezy</span>
              <span class="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </form>

        <!-- Footer notes -->
        <div class="mt-6 pt-5 border-t border-gray-100 text-center relative z-10">
          <p class="text-[11px] text-gray-500">
            Restaurant Owner accounts are provisioned exclusively by the platform <strong class="text-gray-800">Super Admin</strong>.
          </p>
        </div>

      </div>
    </div>
  `;
}

export function attachLoginListeners() {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const submitBtn = document.getElementById('btn-submit-login');

  const quickAdmin = document.getElementById('btn-quick-admin');
  if (quickAdmin) {
    quickAdmin.onclick = () => {
      if (emailInput) emailInput.value = 'admin@yeezy.com';
      if (passwordInput) passwordInput.value = 'admin123';
      showToast('Filled Super Admin demo credentials');
    };
  }

  const quickOwner = document.getElementById('btn-quick-owner');
  if (quickOwner) {
    quickOwner.onclick = () => {
      if (emailInput) emailInput.value = 'alex.rivera@downtownbistro.com';
      if (passwordInput) passwordInput.value = 'owner123';
      showToast('Filled Restaurant Owner demo credentials');
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = emailInput?.value.trim();
      const password = passwordInput?.value.trim();

      if (!email || !password) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Authenticating...</span>`;
      }

      try {
        const res = await fetch(apiUrl('/api/v1/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          // Update store state with logged in user
          store.setState(s => ({
            ...s,
            user: {
              ...s.user,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              tenantId: data.user.tenantId,
              tenantName: data.user.tenantName,
              avatar: data.user.avatar || s.user.avatar
            },
            activeOutlet: data.user.primaryRestID === 'PP_DEL_101' ? 'Downtown Bistro' : (data.user.tenantName || 'Downtown Bistro')
          }));

          // Persist token in localStorage
          localStorage.setItem('yeezy_auth_token', data.token);
          localStorage.setItem('yeezy_auth_user', JSON.stringify(data.user));

          showToast(`Welcome back, ${data.user.name.split(' ')[0]}! (${data.user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Restaurant Owner'})`);

          // Redirect to appropriate view
          if (data.user.role === 'SUPER_ADMIN') {
            window.location.hash = '#super-admin';
          } else {
            window.location.hash = '#dashboard';
          }
        } else {
          showToast(data.message || 'Invalid credentials', 'error');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Sign In to Yeezy</span><span class="material-symbols-outlined text-base">arrow_forward</span>`;
          }
        }
      } catch (err) {
        console.error(err);
        showToast('Error connecting to backend authentication server', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Sign In to Yeezy</span><span class="material-symbols-outlined text-base">arrow_forward</span>`;
        }
      }
    };
  }
}
