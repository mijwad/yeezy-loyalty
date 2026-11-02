// Change Password Modal Component for Restaurant Owners and Admins
import { store } from '../state/store.js';
import { showToast } from '../utils/toast.js';
import { apiFetch } from '../config/api.js';

export function renderChangePasswordModal(user = {}) {
  const email = user.email || store.getState().user?.email || 'owner@restaurant.com';
  const tenantName = user.tenantName || store.getState().user?.tenantName || 'Restaurant Account';

  return `
    <div id="modal-change-password-backdrop" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-scale-up">
        
        <!-- Header -->
        <div class="px-6 pt-6 pb-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white relative">
          <button 
            type="button" 
            id="btn-close-change-pwd"
            class="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
            aria-label="Close modal"
          >
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
          
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
              <span class="material-symbols-outlined text-2xl">lock_reset</span>
            </div>
            <div>
              <h3 class="text-lg font-black tracking-tight text-white">Change Password</h3>
              <p class="text-xs text-purple-200">Secure owner credential update</p>
            </div>
          </div>

          <!-- Account badge -->
          <div class="mt-4 px-3 py-2 rounded-xl bg-white/10 border border-white/10 flex items-center justify-between text-xs">
            <div class="truncate">
              <span class="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Account</span>
              <span class="font-bold text-white font-mono truncate">${email}</span>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
              ${tenantName}
            </span>
          </div>
        </div>

        <!-- Form Body -->
        <div class="p-6 space-y-4">
          <!-- Alert Box -->
          <div id="change-pwd-alert" class="hidden p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <span class="material-symbols-outlined text-base shrink-0 mt-0.5">error</span>
            <span id="change-pwd-alert-msg" class="leading-tight font-medium"></span>
          </div>

          <form id="form-change-password" class="space-y-4" novalidate>
            <!-- Current Password -->
            <div>
              <label for="input-current-password" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Current Password
              </label>
              <div class="relative">
                <input 
                  type="password" 
                  id="input-current-password" 
                  required
                  placeholder="Enter current password"
                  autocomplete="current-password"
                  class="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white text-slate-900 transition placeholder-slate-400 font-mono"
                >
                <button 
                  type="button" 
                  class="btn-toggle-pwd absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  data-target="input-current-password"
                  tabindex="-1"
                >
                  <span class="material-symbols-outlined text-lg">visibility</span>
                </button>
              </div>
            </div>

            <!-- New Password -->
            <div>
              <div class="flex items-center justify-between mb-1">
                <label for="input-new-password" class="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  New Password
                </label>
                <span class="text-[10px] text-slate-400 font-medium">Min 8 characters</span>
              </div>
              <div class="relative">
                <input 
                  type="password" 
                  id="input-new-password" 
                  required
                  minlength="8"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                  class="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white text-slate-900 transition placeholder-slate-400 font-mono"
                >
                <button 
                  type="button" 
                  class="btn-toggle-pwd absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  data-target="input-new-password"
                  tabindex="-1"
                >
                  <span class="material-symbols-outlined text-lg">visibility</span>
                </button>
              </div>
            </div>

            <!-- Confirm New Password -->
            <div>
              <label for="input-confirm-password" class="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Confirm New Password
              </label>
              <div class="relative">
                <input 
                  type="password" 
                  id="input-confirm-password" 
                  required
                  minlength="8"
                  placeholder="Re-type new password"
                  autocomplete="new-password"
                  class="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white text-slate-900 transition placeholder-slate-400 font-mono"
                >
                <button 
                  type="button" 
                  class="btn-toggle-pwd absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  data-target="input-confirm-password"
                  tabindex="-1"
                >
                  <span class="material-symbols-outlined text-lg">visibility</span>
                </button>
              </div>
            </div>

            <!-- Database Synchronization Note -->
            <div class="p-3 rounded-xl bg-purple-50/70 border border-purple-100 flex items-start gap-2.5 text-[11px] text-purple-900">
              <span class="material-symbols-outlined text-base text-purple-600 shrink-0 mt-0.5">verified_user</span>
              <p class="leading-relaxed">
                Your new password will be hashed with <strong>10-round salted bcrypt</strong> and synchronized live to the <strong>Supabase Cloud PostgreSQL</strong> database.
              </p>
            </div>

            <!-- Action Buttons -->
            <div class="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button 
                type="button" 
                id="btn-cancel-change-pwd"
                class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                id="btn-submit-change-pwd"
                class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs shadow-md shadow-primary/20 transition flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
              >
                <span class="material-symbols-outlined text-sm">save</span>
                <span id="btn-submit-change-pwd-text">Update Password</span>
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  `;
}

export function attachChangePasswordModalListeners() {
  const backdrop = document.getElementById('modal-change-password-backdrop');
  const closeBtn = document.getElementById('btn-close-change-pwd');
  const cancelBtn = document.getElementById('btn-cancel-change-pwd');
  const form = document.getElementById('form-change-password');
  const alertBox = document.getElementById('change-pwd-alert');
  const alertMsg = document.getElementById('change-pwd-alert-msg');
  const submitBtn = document.getElementById('btn-submit-change-pwd');
  const submitBtnText = document.getElementById('btn-submit-change-pwd-text');

  const closeModal = () => {
    store.setUIState({ activeModal: null });
  };

  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  if (backdrop) {
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal();
    };
  }

  // Wire password visibility toggles
  document.querySelectorAll('.btn-toggle-pwd').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = btn.querySelector('.material-symbols-outlined');
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        if (icon) {
          icon.textContent = isPassword ? 'visibility_off' : 'visibility';
        }
      }
    };
  });

  const showAlert = (msg) => {
    if (alertBox && alertMsg) {
      alertMsg.textContent = msg;
      alertBox.classList.remove('hidden');
    }
  };

  const hideAlert = () => {
    if (alertBox) alertBox.classList.add('hidden');
  };

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      hideAlert();

      const currentPassword = document.getElementById('input-current-password')?.value || '';
      const newPassword = document.getElementById('input-new-password')?.value || '';
      const confirmPassword = document.getElementById('input-confirm-password')?.value || '';

      if (!currentPassword) {
        showAlert('Please enter your current password.');
        return;
      }

      if (!newPassword) {
        showAlert('Please enter a new password.');
        return;
      }

      if (newPassword.length < 8) {
        showAlert('New password must be at least 8 characters long.');
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert('New passwords do not match. Please re-check.');
        return;
      }

      if (currentPassword === newPassword) {
        showAlert('New password must be different from your current password.');
        return;
      }

      // Submit to backend
      if (submitBtn) submitBtn.disabled = true;
      if (submitBtnText) submitBtnText.textContent = 'Updating Database...';

      try {
        const res = await apiFetch('/api/v1/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: currentPassword.trim(),
            newPassword: newPassword.trim()
          })
        });

        const data = await res.json();

        if (res.ok && data.status === 'success') {
          showToast('✅ Password updated successfully in database!');
          closeModal();
        } else {
          showAlert(data.message || 'Failed to update password. Please check your current password.');
        }
      } catch (err) {
        console.error('[Change Password Error]', err);
        showAlert('Network error connecting to server. Please try again.');
      } finally {
        if (submitBtn) submitBtn.disabled = false;
        if (submitBtnText) submitBtnText.textContent = 'Update Password';
      }
    };
  }
}
