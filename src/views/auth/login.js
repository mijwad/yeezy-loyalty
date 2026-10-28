// Professional Enterprise Login View Module
// Styled like Microsoft/Google/AWS enterprise login pages
import { store } from '../../state/store.js';
import { showToast } from '../../utils/toast.js';
import { apiFetch } from '../../config/api.js';

export function renderLoginView() {
  return `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 antialiased">
      <div class="w-full max-w-md">
        <!-- Header with Logo -->
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-600 mx-auto mb-4">
            <svg class="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">Yeezy Loyalty Platform</h1>
          <p class="text-sm text-gray-500 mt-1">Enterprise multi-brand restaurant loyalty software</p>
        </div>

        <!-- Login Card -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 sm:p-10">
          <!-- Alert/Error Message Container -->
          <div id="login-alert" class="hidden mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2" role="alert">
            <svg class="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <span id="login-alert-message"></span>
          </div>

          <!-- Login Form -->
          <form id="login-form" class="space-y-5" novalidate>
            <!-- Identifier Field -->
            <div>
              <label for="login-identifier" class="block text-sm font-medium text-gray-700 mb-1.5">
                Email, Username, or Restaurant Name
              </label>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                <input
                  type="text"
                  id="login-identifier"
                  name="identifier"
                  required
                  autocomplete="username"
                  placeholder="e.g. name@restaurant.com, username, or restaurant name"
                  class="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900 placeholder-gray-400"
                  aria-describedby="identifier-hint"
                >
              </div>
              <p id="identifier-hint" class="mt-1.5 text-xs text-gray-500">
                Sign in with your email, username, or restaurant name
              </p>
            </div>

            <!-- Password Field -->
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label for="login-password" class="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <button
                  type="button"
                  id="toggle-password"
                  class="text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
                  aria-label="Show password"
                >
                  Show
                </button>
              </div>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <input
                  type="password"
                  id="login-password"
                  name="password"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="w-full pl-10 pr-12 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors bg-white text-gray-900 placeholder-gray-400"
                >
                <button
                  type="button"
                  id="toggle-password-visibility"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label="Toggle password visibility"
                >
                  <svg id="password-eye-open" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                  </svg>
                  <svg id="password-eye-closed" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L3 3m15.87 15.87l-3.59-3.59"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Remember Me & Forgot Password -->
            <div class="flex items-center justify-between">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  id="login-remember"
                  name="rememberMe"
                  class="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                <span class="text-sm text-gray-600">Remember me</span>
              </label>
              <button
                type="button"
                id="btn-forgot-password"
                class="text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
              >
                Forgot password?
              </button>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              id="btn-submit-login"
              class="w-full py-3 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span id="btn-login-text">Sign in</span>
              <svg id="btn-login-spinner" class="w-5 h-5 hidden animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            </button>

            <!-- Demo Credentials (Development Only) -->
            <div id="demo-credentials" class="hidden p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
              <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">Demo Credentials (Development)</p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-fill="superadmin"
                  class="px-3 py-2 text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <span class="font-semibold text-gray-900">Super Admin</span>
                  <br><span class="text-gray-500">admin@yeezy.com / admin123</span>
                </button>
                <button
                  type="button"
                  data-fill="owner"
                  class="px-3 py-2 text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <span class="font-semibold text-gray-900">Restaurant Owner</span>
                  <br><span class="text-gray-500">alex.rivera@downtownbistro.com / owner123</span>
                </button>
              </div>
            </div>
          </form>

          <!-- Forgot Password Form (Hidden by default) -->
          <form id="forgot-password-form" class="hidden space-y-5">
            <div class="text-center mb-6">
              <h2 class="text-lg font-semibold text-gray-900">Reset your password</h2>
              <p class="text-sm text-gray-500 mt-1">Enter your email and we'll send you a reset link</p>
            </div>
            <div>
              <label for="forgot-email" class="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <div class="relative">
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <input
                  type="email"
                  id="forgot-email"
                  name="email"
                  required
                  autocomplete="email"
                  placeholder="name@restaurant.com"
                  class="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                >
              </div>
            </div>
            <button
              type="submit"
              id="btn-submit-forgot"
              class="w-full py-3 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Send reset link</span>
              <svg class="w-5 h-5 hidden animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
            </button>
            <div class="text-center">
              <button
                type="button"
                id="btn-back-to-login"
                class="text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
              >
                ← Back to sign in
              </button>
            </div>
          </form>

          <!-- Forgot Password Success State (Hidden by default) -->
          <div id="forgot-success" class="hidden text-center py-8">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 class="text-lg font-semibold text-gray-900">Check your email</h2>
            <p class="text-sm text-gray-500 mt-1">If an account exists, you'll receive a password reset link shortly.</p>
            <button
              type="button"
              id="btn-back-to-login-from-success"
              class="mt-6 text-sm text-primary-600 hover:text-primary-700 font-medium focus:outline-none focus:underline"
            >
              ← Back to sign in
            </button>
          </div>

          <!-- Footer -->
          <div class="mt-8 pt-6 border-t border-gray-100 text-center">
            <p class="text-xs text-gray-400">
              Each restaurant operates in a fully isolated, secure tenant environment.
            </p>
            <p class="text-xs text-gray-400 mt-1">
              Need help? Contact <a href="mailto:support@yeezy.app" class="text-primary-600 hover:underline">support@yeezy.app</a>
            </p>
          </div>
        </div>

        <!-- Version Info -->
        <p class="text-center text-xs text-gray-400 mt-6">v1.0.0 · Enterprise Edition</p>
      </div>
    </div>
  `;
}

export function attachLoginListeners() {
  const loginForm = document.getElementById('login-form');
  const forgotForm = document.getElementById('forgot-password-form');
  const identifierInput = document.getElementById('login-identifier');
  const passwordInput = document.getElementById('login-password');
  const submitLoginBtn = document.getElementById('btn-submit-login');
  const loginAlert = document.getElementById('login-alert');
  const loginAlertMessage = document.getElementById('login-alert-message');
  const togglePasswordBtn = document.getElementById('toggle-password-visibility');
  const forgotPasswordBtn = document.getElementById('btn-forgot-password');
  const backToLoginBtn = document.getElementById('btn-back-to-login');
  const backToLoginFromSuccessBtn = document.getElementById('btn-back-to-login-from-success');
  const forgotSubmitBtn = document.getElementById('btn-submit-forgot');
  const forgotEmailInput = document.getElementById('forgot-email');
  const demoButtons = document.querySelectorAll('[data-fill]');

  // Demo credential fill buttons (only show in development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const demoContainer = document.getElementById('demo-credentials');
    if (demoContainer) demoContainer.classList.remove('hidden');

    demoButtons.forEach(btn => {
      btn.onclick = () => {
        if (btn.dataset.fill === 'superadmin') {
          identifierInput.value = 'admin@yeezy.com';
          passwordInput.value = 'admin123';
        } else if (btn.dataset.fill === 'owner') {
          identifierInput.value = 'alex.rivera@downtownbistro.com';
          passwordInput.value = 'owner123';
        }
        identifierInput.focus();
        showToast('Demo credentials filled', 'info');
      };
    });
  }

  // Password visibility toggle
  if (togglePasswordBtn) {
    togglePasswordBtn.onclick = () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      document.getElementById('password-eye-open').classList.toggle('hidden', type === 'text');
      document.getElementById('password-eye-closed').classList.toggle('hidden', type === 'password');
      togglePasswordBtn.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');
    };
  }

  // Show/hide password link (alternative)
  const showPasswordLink = document.getElementById('toggle-password');
  if (showPasswordLink) {
    showPasswordLink.onclick = () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      showPasswordLink.textContent = type === 'password' ? 'Show' : 'Hide';
      document.getElementById('password-eye-open').classList.toggle('hidden', type === 'text');
      document.getElementById('password-eye-closed').classList.toggle('hidden', type === 'password');
    };
  }

  // Forgot password flow
  const showForgotForm = () => {
    loginForm.classList.add('hidden');
    document.getElementById('forgot-password-form').classList.remove('hidden');
    document.getElementById('forgot-success').classList.add('hidden');
    forgotEmailInput?.focus();
    hideAlert();
  };

  const showLoginForm = () => {
    loginForm.classList.remove('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('forgot-success').classList.add('hidden');
    identifierInput?.focus();
    hideAlert();
  };

  const showForgotSuccess = () => {
    loginForm.classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('forgot-success').classList.remove('hidden');
    hideAlert();
  };

  if (forgotPasswordBtn) forgotPasswordBtn.onclick = showForgotForm;
  if (backToLoginBtn) backToLoginBtn.onclick = showLoginForm;
  if (backToLoginFromSuccessBtn) backToLoginFromSuccessBtn.onclick = showLoginForm;

  // Hide alert
  function hideAlert() {
    loginAlert.classList.add('hidden');
  }

  function showAlert(message) {
    loginAlertMessage.textContent = message;
    loginAlert.classList.remove('hidden');
  }

  // Handle Login Submission
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();

      const identifier = identifierInput?.value.trim();
      const password = passwordInput?.value;
      const rememberMe = document.getElementById('login-remember')?.checked || false;

      if (!identifier || !password) {
        showAlert('Please enter both identifier and password');
        return;
      }

      // Disable form
      setLoadingState(true);
      hideAlert();

      // If backend is sleeping on Render free tier, notify user after 2.5s
      const wakeTimer = setTimeout(() => {
        if (submitLoginBtn && submitLoginBtn.disabled) {
          document.getElementById('btn-login-text').textContent = 'Waking backend server...';
        }
      }, 2500);

      try {
        const res = await apiFetch('/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password, rememberMe })
        });

        let data;
        try {
          data = await res.json();
        } catch {
          data = { status: 'error', message: `Server returned status ${res.status}` };
        }

        if (res.ok && data.status === 'success') {
          // Store token and user
          localStorage.setItem('yeezy_auth_token', data.token);
          if (data.refreshToken) {
            localStorage.setItem('yeezy_refresh_token', data.refreshToken);
          }
          localStorage.setItem('yeezy_auth_user', JSON.stringify(data.user));

          // Initialize store state
          await store.loginUser(data.user, data.token);

          showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`);

          // Redirect based on role
          if (data.user.role === 'SUPER_ADMIN') {
            window.location.hash = '#super-admin';
          } else {
            window.location.hash = '#dashboard';
          }
        } else {
          showAlert(data.message || 'Invalid credentials. Please try again.');
          setLoadingState(false);
        }
      } catch (err) {
        console.error('[Login Error]', err);
        showAlert('Error connecting to server. Please try again in a few seconds.');
        setLoadingState(false);
      } finally {
        clearTimeout(wakeTimer);
      }
    };
  }

  // Handle Forgot Password Submission
  if (forgotForm) {
    forgotForm.onsubmit = async (e) => {
      e.preventDefault();

      const email = forgotEmailInput?.value.trim();

      if (!email) {
        showAlert('Please enter your email address');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert('Please enter a valid email address');
        return;
      }

      setForgotLoadingState(true);
      hideAlert();

      try {
        const res = await apiFetch('/api/v1/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        let data;
        try {
          data = await res.json();
        } catch {
          data = { status: 'error', message: `Server returned status ${res.status}` };
        }

        if (res.ok && data.status === 'success') {
          showForgotSuccess();
        } else {
          showAlert(data.message || 'Failed to send reset link. Please try again.');
          setForgotLoadingState(false);
        }
      } catch (err) {
        console.error('[Forgot Password Error]', err);
        showAlert('Error connecting to server. Please try again.');
        setForgotLoadingState(false);
      }
    };
  }

  // Loading state helpers
  function setLoadingState(loading) {
    if (submitLoginBtn) {
      submitLoginBtn.disabled = loading;
      document.getElementById('btn-login-text').textContent = loading ? 'Signing in...' : 'Sign in';
      document.getElementById('btn-login-spinner').classList.toggle('hidden', !loading);
    }
    if (identifierInput) identifierInput.disabled = loading;
    if (passwordInput) passwordInput.disabled = loading;
    const rememberCheckbox = document.getElementById('login-remember');
    if (rememberCheckbox) rememberCheckbox.disabled = loading;
  }

  function setForgotLoadingState(loading) {
    if (forgotSubmitBtn) {
      forgotSubmitBtn.disabled = loading;
      forgotSubmitBtn.querySelector('span').textContent = loading ? 'Sending...' : 'Send reset link';
      forgotSubmitBtn.querySelector('svg').classList.toggle('hidden', !loading);
    }
    if (forgotEmailInput) forgotEmailInput.disabled = loading;
  }
}