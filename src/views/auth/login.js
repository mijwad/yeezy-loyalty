// Production Multi-Tenant Auth Screen View Module
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { apiFetch, apiUrl } from '../../config/api.js';

let authMode = 'login'; // 'login' | 'register'

export function renderLoginView() {
  return `
    <div class="min-h-screen bg-gradient-to-br from-[#12052b] via-[#1a0e38] to-[#0a0319] flex items-center justify-center p-4 sm:p-6 antialiased">
      <div class="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/20 animate-fade-in relative overflow-hidden">
        
        <!-- Ambient background glow -->
        <div class="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-primary/20 blur-2xl pointer-events-none"></div>
        <div class="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-teal-500/20 blur-2xl pointer-events-none"></div>

        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center mb-6 relative z-10">
          <div class="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-2xl shadow-lg mb-3">
            Y
          </div>
          <h1 class="text-2xl font-black text-gray-900 tracking-tight">Yeezy Loyalty Platform</h1>
          <p class="text-xs text-gray-500 mt-1 font-medium">Enterprise multi-brand restaurant loyalty software</p>
        </div>

        <!-- Auth Mode Switcher Pills -->
        <div class="mb-6 p-1 bg-slate-100 rounded-xl grid grid-cols-2 gap-1 relative z-10 select-none">
          <button 
            id="tab-mode-login" 
            type="button" 
            class="py-2 rounded-lg text-xs font-bold transition-all ${authMode === 'login' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}"
          >
            Sign In
          </button>
          <button 
            id="tab-mode-register" 
            type="button" 
            class="py-2 rounded-lg text-xs font-bold transition-all ${authMode === 'register' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}"
          >
            Register Restaurant
          </button>
        </div>

        ${authMode === 'login' ? renderLoginForm() : renderRegisterForm()}

        <!-- Footer notes -->
        <div class="mt-6 pt-5 border-t border-gray-100 text-center relative z-10">
          <p class="text-[11px] text-gray-400">
            Each restaurant operates in a fully isolated, secure tenant environment.
          </p>
        </div>

      </div>
    </div>
  `;
}

function renderLoginForm() {
  return `
    <form id="login-form" class="space-y-4 relative z-10">
      <div>
        <label class="text-xs font-bold text-gray-700 block mb-1.5">Username or Email</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">person</span>
          <input 
            id="login-username" 
            type="text" 
            required 
            autocomplete="username"
            placeholder="admin or name@restaurant.com" 
            class="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium text-gray-900"
          >
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="text-xs font-bold text-gray-700">Password</label>
          <a href="javascript:void(0)" class="text-[11px] text-primary hover:underline font-bold" onclick="window.showToast('Please contact platform administrator for password recovery')">Forgot?</a>
        </div>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
          <input 
            id="login-password" 
            type="password" 
            required 
            autocomplete="current-password"
            placeholder="••••••••" 
            class="w-full pl-10 pr-4 py-3 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium text-gray-900"
          >
        </div>
      </div>

      <!-- Quick Demo Credentials -->
      <div class="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
        <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Demo Fill</p>
        <div class="grid grid-cols-2 gap-1.5">
          <button 
            type="button" 
            id="btn-fill-superadmin" 
            class="px-2.5 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 hover:border-primary/50 hover:bg-primary/5 text-slate-700 rounded-lg transition text-left flex items-center justify-between"
          >
            <span>👑 Super Admin</span>
            <span class="text-[10px] text-slate-400">Fill</span>
          </button>
          <button 
            type="button" 
            id="btn-fill-owner" 
            class="px-2.5 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 hover:border-primary/50 hover:bg-primary/5 text-slate-700 rounded-lg transition text-left flex items-center justify-between"
          >
            <span>🏪 Restaurant</span>
            <span class="text-[10px] text-slate-400">Fill</span>
          </button>
        </div>
      </div>

      <div class="pt-1">
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
  `;
}

function renderRegisterForm() {
  return `
    <form id="register-restaurant-form" class="space-y-3.5 relative z-10">
      <div>
        <label class="text-xs font-bold text-gray-700 block mb-1">Restaurant / Brand Name</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">restaurant</span>
          <input 
            id="reg-brand-name" 
            type="text" 
            required 
            placeholder="e.g. Copper Chimney Bistro" 
            class="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium text-gray-900"
          >
        </div>
      </div>

      <div>
        <label class="text-xs font-bold text-gray-700 block mb-1">Owner / Operator Full Name</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">badge</span>
          <input 
            id="reg-owner-name" 
            type="text" 
            required 
            placeholder="e.g. Vikram Sharma" 
            class="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium text-gray-900"
          >
        </div>
      </div>

      <div>
        <label class="text-xs font-bold text-gray-700 block mb-1">Business Email Address</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">mail</span>
          <input 
            id="reg-owner-email" 
            type="email" 
            required 
            placeholder="vikram@copperchimney.com" 
            class="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium text-gray-900"
          >
        </div>
      </div>

      <div>
        <label class="text-xs font-bold text-gray-700 block mb-1">Account Password</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
          <input 
            id="reg-password" 
            type="password" 
            required 
            placeholder="Create password" 
            class="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 transition font-medium text-gray-900"
          >
        </div>
      </div>

      <div class="pt-2">
        <button 
          id="btn-submit-register" 
          type="submit" 
          class="w-full py-3.5 px-4 rounded-xl bg-[#00796B] hover:bg-[#00695C] text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 active:scale-98"
        >
          <span>Create Restaurant & Sign In</span>
          <span class="material-symbols-outlined text-base">check_circle</span>
        </button>
      </div>
    </form>
  `;
}

export function attachLoginListeners() {
  const tabLogin = document.getElementById('tab-mode-login');
  const tabRegister = document.getElementById('tab-mode-register');

  if (tabLogin && tabRegister) {
    tabLogin.onclick = () => {
      authMode = 'login';
      store.notify();
    };
    tabRegister.onclick = () => {
      authMode = 'register';
      store.notify();
    };
  }

  // Quick demo fill buttons
  const btnFillSuperAdmin = document.getElementById('btn-fill-superadmin');
  const btnFillOwner = document.getElementById('btn-fill-owner');

  if (btnFillSuperAdmin) {
    btnFillSuperAdmin.onclick = () => {
      const usernameInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');
      if (usernameInput) usernameInput.value = 'admin@yeezy.com';
      if (passwordInput) passwordInput.value = 'admin123';
      showToast('Filled Super Admin demo credentials', 'info');
    };
  }

  if (btnFillOwner) {
    btnFillOwner.onclick = () => {
      const usernameInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');
      if (usernameInput) usernameInput.value = 'alex.rivera@downtownbistro.com';
      if (passwordInput) passwordInput.value = 'owner123';
      showToast('Filled Downtown Bistro Owner demo credentials', 'info');
    };
  }

  // Handle Login submission
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('login-username');
  const passwordInput = document.getElementById('login-password');
  const submitLoginBtn = document.getElementById('btn-submit-login');

  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const identifier = usernameInput?.value.trim();
      const password = passwordInput?.value.trim();

      if (!identifier || !password) return;

      if (submitLoginBtn) {
        submitLoginBtn.disabled = true;
        submitLoginBtn.innerHTML = `<span>Authenticating...</span>`;
      }

      // If backend is sleeping on Render free tier, notify user after 2.5s
      const wakeTimer = setTimeout(() => {
        if (submitLoginBtn && submitLoginBtn.disabled) {
          submitLoginBtn.innerHTML = `<span>Waking backend server...</span>`;
        }
      }, 2500);

      try {
        const res = await apiFetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: identifier, username: identifier, password })
        });
        
        let data;
        try {
          data = await res.json();
        } catch {
          data = { status: 'error', message: `Server returned status ${res.status}` };
        }

        if (res.ok && data.status === 'success') {
          // Cleanly initialize store state strictly for this authenticated tenant
          await store.loginUser(data.user, data.token);

          showToast(`Welcome back, ${data.user.name.split(' ')[0]}! (${data.user.role === 'SUPER_ADMIN' ? 'Super Admin' : data.user.tenantName || 'Restaurant Owner'})`);

          if (data.user.role === 'SUPER_ADMIN') {
            window.location.hash = '#super-admin';
          } else {
            window.location.hash = '#dashboard';
          }
        } else {
          showToast(data.message || 'Invalid username/email or password', 'error');
          if (submitLoginBtn) {
            submitLoginBtn.disabled = false;
            submitLoginBtn.innerHTML = `<span>Sign In to Yeezy</span><span class="material-symbols-outlined text-base">arrow_forward</span>`;
          }
        }
      } catch (err) {
        console.error('[Login Error]', err);
        showToast('Error connecting to backend authentication server. Please retry in a few seconds.', 'error');
        if (submitLoginBtn) {
          submitLoginBtn.disabled = false;
          submitLoginBtn.innerHTML = `<span>Sign In to Yeezy</span><span class="material-symbols-outlined text-base">arrow_forward</span>`;
        }
      } finally {
        clearTimeout(wakeTimer);
      }
    };
  }

  // Handle Registration submission
  const registerForm = document.getElementById('register-restaurant-form');
  const brandNameInput = document.getElementById('reg-brand-name');
  const ownerNameInput = document.getElementById('reg-owner-name');
  const ownerEmailInput = document.getElementById('reg-owner-email');
  const regPasswordInput = document.getElementById('reg-password');
  const submitRegisterBtn = document.getElementById('btn-submit-register');

  if (registerForm) {
    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      const brandName = brandNameInput?.value.trim();
      const ownerName = ownerNameInput?.value.trim();
      const ownerEmail = ownerEmailInput?.value.trim();
      const password = regPasswordInput?.value.trim();

      if (!brandName || !ownerName || !ownerEmail || !password) return;

      if (submitRegisterBtn) {
        submitRegisterBtn.disabled = true;
        submitRegisterBtn.innerHTML = `<span>Provisioning Restaurant...</span>`;
      }

      const wakeTimer = setTimeout(() => {
        if (submitRegisterBtn && submitRegisterBtn.disabled) {
          submitRegisterBtn.innerHTML = `<span>Waking backend server...</span>`;
        }
      }, 2500);

      try {
        const res = await apiFetch('/api/v1/auth/register-restaurant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandName, ownerName, ownerEmail, password })
        });
        
        let data;
        try {
          data = await res.json();
        } catch {
          data = { status: 'error', message: `Server returned status ${res.status}` };
        }

        if (res.ok && data.status === 'success') {
          // Initialize brand new restaurant state
          await store.loginUser(data.user, data.token);

          showToast(`🎉 Restaurant "${brandName}" successfully created! Welcome, ${ownerName.split(' ')[0]}.`);
          window.location.hash = '#dashboard';
        } else {
          showToast(data.message || 'Failed to register restaurant', 'error');
          if (submitRegisterBtn) {
            submitRegisterBtn.disabled = false;
            submitRegisterBtn.innerHTML = `<span>Create Restaurant & Sign In</span><span class="material-symbols-outlined text-base">check_circle</span>`;
          }
        }
      } catch (err) {
        console.error('[Register Error]', err);
        showToast('Network error during restaurant registration. Please retry in a few seconds.', 'error');
        if (submitRegisterBtn) {
          submitRegisterBtn.disabled = false;
          submitRegisterBtn.innerHTML = `<span>Create Restaurant & Sign In</span><span class="material-symbols-outlined text-base">check_circle</span>`;
        }
      } finally {
        clearTimeout(wakeTimer);
      }
    };
  }
}
