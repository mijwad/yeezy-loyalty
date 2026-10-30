// Meta App Review & WhatsApp Cloud API Testing Console
// Designed for recording Video 1 (whatsapp_business_messaging) and Video 2 (whatsapp_business_management)

import { store } from '../../state/store.js';
import { apiUrl } from '../../config/api.js';

let activeReviewTab = 'send_message'; // 'send_message' | 'create_template' | 'credentials'
let lastSendResult = null;
let lastTemplateResult = null;
let connectionStatus = null;
let isCheckingStatus = false;

export function renderMetaAppReviewView(state) {
  return `
    <div class="px-4 md:px-8 py-6 max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in pb-20 select-none">
      
      <!-- Top Header -->
      <div class="bg-white p-6 md:p-8 rounded-3xl border border-gray-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600">
              <span class="material-symbols-outlined text-lg">videocam</span>
            </span>
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-700">Meta for Developers App Review</span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
              Video Recording Studio
            </span>
          </div>
          <h1 class="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight mt-1">
            Meta WhatsApp API Testing & Review Console
          </h1>
          <p class="text-xs md:text-sm text-gray-500 mt-1 max-w-2xl font-medium">
            Use this interactive studio to make live API calls and record the 2 required videos for Meta App Review approval.
          </p>
        </div>

        <!-- Tab Selector -->
        <div class="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-2xl self-start md:self-auto flex-wrap">
          <button 
            type="button" 
            class="meta-review-tab-btn px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeReviewTab === 'send_message' ? 'bg-[#2a7e72] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}"
            data-tab="send_message"
          >
            📹 Video 1: Send Message
          </button>
          <button 
            type="button" 
            class="meta-review-tab-btn px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeReviewTab === 'create_template' ? 'bg-[#2a7e72] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}"
            data-tab="create_template"
          >
            📹 Video 2: Create Template
          </button>
          <button 
            type="button" 
            class="meta-review-tab-btn px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${activeReviewTab === 'credentials' ? 'bg-[#2a7e72] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}"
            data-tab="credentials"
          >
            🔑 Meta Credentials
          </button>
        </div>
      </div>

      <!-- Tab Content Area -->
      ${activeReviewTab === 'send_message' ? renderSendMessageConsole() : ''}
      ${activeReviewTab === 'create_template' ? renderCreateTemplateConsole() : ''}
      ${activeReviewTab === 'credentials' ? renderCredentialsConsole() : ''}

    </div>
  `;
}

// ============================================================================
// CONSOLE 1: Video 1 - whatsapp_business_messaging
// ============================================================================

function renderSendMessageConsole() {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
      
      <!-- Left: Form & Instructions -->
      <div class="lg:col-span-7 bg-white rounded-3xl p-6 md:p-8 border border-gray-200/80 shadow-xs flex flex-col gap-5">
        
        <!-- Meta Reviewer Guidance Alert Box -->
        <div class="p-4 rounded-2xl bg-teal-50/90 border border-teal-200/80 text-xs text-teal-950 leading-relaxed flex items-start gap-3">
          <span class="material-symbols-outlined text-[#2a7e72] text-xl shrink-0 mt-0.5">info</span>
          <div>
            <strong class="text-[#2a7e72] block text-sm mb-1">How to record Video 1 for Meta Review:</strong>
            <ol class="list-decimal ml-4 space-y-1 text-xs text-gray-700">
              <li>Place this browser window on the <strong>LEFT half</strong> of your monitor screen.</li>
              <li>Open <strong>WhatsApp Web</strong> on the <strong>RIGHT half</strong> (logged into your test phone number).</li>
              <li>Enter your phone number below and click <strong>"Send Live WhatsApp Message"</strong>.</li>
              <li>Show the message arriving immediately on WhatsApp Web on the right side!</li>
            </ol>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div>
            <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
              Recipient WhatsApp Mobile Number
            </label>
            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">+</span>
              <input 
                id="meta-send-phone" 
                type="tel" 
                value="919745630606" 
                placeholder="919745630606 (Include Country Code without +)" 
                class="w-full pl-8 pr-4 py-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72]"
              />
            </div>
            <p class="text-[11px] text-gray-400 mt-1">E.164 format with country code (e.g. 91 for India, 1 for US).</p>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
              Template to Dispatch
            </label>
            <select 
              id="meta-send-template-select" 
              class="w-full px-4 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] cursor-pointer"
            >
              <option value="bee_first_purchase" selected>bee_first_purchase (Active Utility - First Purchase Welcome)</option>
              <option value="bee_subsequent_purc">bee_subsequent_purc (Active Utility - Subsequent Purchase Reward)</option>
              <option value="bee_points_reminder">bee_points_reminder (Active Utility - Points Balance Reminder)</option>
              <option value="bee_points_expiry">bee_points_expiry (Active Utility - Points Expiry Notice)</option>
              <option value="hello_world">hello_world (Meta Pre-Approved Sandbox Template)</option>
            </select>
          </div>

          <button 
            id="btn-meta-send-live" 
            type="button" 
            class="w-full py-4 bg-[#2a7e72] hover:bg-[#23685e] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg active:scale-[0.99]"
          >
            <span class="material-symbols-outlined text-xl">send</span>
            <span>Send Live WhatsApp Message via Meta Cloud API</span>
          </button>
        </div>
      </div>

      <!-- Right: Live API Response Inspector -->
      <div class="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-gray-700 text-lg">terminal</span>
            <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Meta Graph API Response</h3>
          </div>
          <span class="text-[10px] font-mono text-gray-400">POST /v21.0/{phone_id}/messages</span>
        </div>

        <div id="meta-send-response-box" class="p-4 rounded-2xl bg-[#0f172a] text-gray-200 font-mono text-xs leading-relaxed min-h-[220px] overflow-x-auto whitespace-pre">
${lastSendResult ? JSON.stringify(lastSendResult, null, 2) : `// Waiting for test message dispatch...
// Click "Send Live WhatsApp Message" to execute live call.
// The real Meta message_id (wamid) will appear here.`}
        </div>

        ${lastSendResult?.status === 'success' ? `
          <div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <span class="material-symbols-outlined text-emerald-600 text-base">check_circle</span>
            <span>Message sent! Check recipient WhatsApp window now.</span>
          </div>
        ` : ''}
      </div>

    </div>
  `;
}

// ============================================================================
// CONSOLE 2: Video 2 - whatsapp_business_management
// ============================================================================

function renderCreateTemplateConsole() {
  return `
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
      
      <!-- Left: Template Creation Form -->
      <div class="lg:col-span-7 bg-white rounded-3xl p-6 md:p-8 border border-gray-200/80 shadow-xs flex flex-col gap-5">
        
        <!-- Meta Reviewer Guidance Alert Box -->
        <div class="p-4 rounded-2xl bg-purple-50/90 border border-purple-200/80 text-xs text-purple-950 leading-relaxed flex items-start gap-3">
          <span class="material-symbols-outlined text-purple-600 text-xl shrink-0 mt-0.5">info</span>
          <div>
            <strong class="text-purple-700 block text-sm mb-1">How to record Video 2 for Meta Review:</strong>
            <ol class="list-decimal ml-4 space-y-1 text-xs text-gray-700">
              <li>Record your full screen showing this Yeezy Loyalty template form.</li>
              <li>Fill in the Template Name, Category, and Body text with a variable like <code>{{1}}</code>.</li>
              <li>Click <strong>"Submit Template to Meta Graph API"</strong>.</li>
              <li>Show the successful HTTP 201 response with <strong>Meta Template ID</strong> on the right!</li>
            </ol>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
                Template Name
              </label>
              <input 
                id="meta-template-name" 
                type="text" 
                value="durbar_dining_voucher_${Math.floor(Date.now() / 1000).toString().slice(-4)}" 
                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-mono font-bold text-gray-900"
                placeholder="e.g. durbar_dining_voucher"
              />
              <span class="text-[10px] text-gray-400 mt-1 block">Lowercase letters, numbers, and underscores only.</span>
            </div>

            <div>
              <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
                Category
              </label>
              <select 
                id="meta-template-category" 
                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 cursor-pointer"
              >
                <option value="MARKETING" selected>MARKETING (Offers, promos, updates)</option>
                <option value="UTILITY">UTILITY (Receipts, account alerts, OTPs)</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
              Header Text (Optional)
            </label>
            <input 
              id="meta-template-header" 
              type="text" 
              value="Durbar Loyalty Reward" 
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900"
              placeholder="e.g. Durbar Special Treat"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
              Body Text (Use {{1}} for dynamic customer name)
            </label>
            <textarea 
              id="meta-template-body" 
              rows="4" 
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 font-medium leading-relaxed resize-none"
            >Hello {{1}}, thank you for dining with us at Durbar! Show this digital loyalty pass on your next visit to claim your treat.</textarea>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
                Example value for {{1}}
              </label>
              <input 
                id="meta-template-example" 
                type="text" 
                value="Alex Rivera" 
                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900"
              />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
                Quick Reply Button Label
              </label>
              <input 
                id="meta-template-button" 
                type="text" 
                value="View My Rewards Pass" 
                class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-900"
              />
            </div>
          </div>

          <button 
            id="btn-meta-create-template" 
            type="button" 
            class="w-full py-4 bg-[#7e22ce] hover:bg-[#6b21a8] text-white font-extrabold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg active:scale-[0.99]"
          >
            <span class="material-symbols-outlined text-xl">add_circle</span>
            <span>Submit Template to Meta Graph API</span>
          </button>
        </div>
      </div>

      <!-- Right: Live Submission Response -->
      <div class="lg:col-span-5 bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-gray-100 pb-3">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-gray-700 text-lg">terminal</span>
            <h3 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Meta Template Submission Response</h3>
          </div>
          <span class="text-[10px] font-mono text-gray-400">POST /{waba_id}/message_templates</span>
        </div>

        <div id="meta-template-response-box" class="p-4 rounded-2xl bg-[#0f172a] text-gray-200 font-mono text-xs leading-relaxed min-h-[260px] overflow-x-auto whitespace-pre">
${lastTemplateResult ? JSON.stringify(lastTemplateResult, null, 2) : `// Waiting for template creation...
// Fill the form and click "Submit Template to Meta Graph API".
// The real Meta Template ID and status will appear here.`}
        </div>

        ${lastTemplateResult?.status === 'success' ? `
          <div class="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-semibold flex items-center gap-2">
            <span class="material-symbols-outlined text-purple-600 text-base">verified</span>
            <span>Template successfully submitted to Meta! Status: ${lastTemplateResult.result?.status}</span>
          </div>
        ` : ''}
      </div>

    </div>
  `;
}

// ============================================================================
// CONSOLE 3: Meta API Credentials Configuration
// ============================================================================

function renderCredentialsConsole() {
  const currentToken = process.env.META_ACCESS_TOKEN || '';

  return `
    <div class="max-w-3xl mx-auto bg-white rounded-3xl p-6 md:p-8 border border-gray-200/80 shadow-xs flex flex-col gap-5 animate-fade-in">
      <div class="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 class="text-lg font-black text-gray-900">Meta Cloud API Credentials</h2>
          <p class="text-xs text-gray-500 font-medium mt-0.5">
            Configure your Meta for Developers App credentials to enable live API message dispatch.
          </p>
        </div>
        <button 
          id="btn-meta-check-status" 
          type="button" 
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-800 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
        >
          <span class="material-symbols-outlined text-sm">refresh</span>
          <span>Check Status</span>
        </button>
      </div>

      <div class="flex flex-col gap-4">
        <div>
          <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
            Meta Access Token (System User Token or 24-Hour Temp Token)
          </label>
          <textarea 
            id="input-meta-token" 
            rows="3" 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-mono text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2a7e72]/30 focus:border-[#2a7e72] leading-tight"
            placeholder="Paste your EAAb... Meta access token here"
          ></textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
              Phone Number ID
            </label>
            <input 
              id="input-meta-phone-id" 
              type="text" 
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-mono text-xs font-bold text-gray-900"
              placeholder="e.g. 104859201948291"
            />
          </div>

          <div>
            <label class="text-xs font-bold text-gray-800 uppercase tracking-wider block mb-1.5">
              WhatsApp Business Account ID (WABA ID)
            </label>
            <input 
              id="input-meta-waba-id" 
              type="text" 
              class="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-mono text-xs font-bold text-gray-900"
              placeholder="e.g. 102948201948201"
            />
          </div>
        </div>

        <button 
          id="btn-meta-save-credentials" 
          type="button" 
          class="w-full py-3.5 bg-[#2a7e72] hover:bg-[#23685e] text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
        >
          Save & Verify Meta API Credentials
        </button>
      </div>
    </div>
  `;
}

// ============================================================================
// EVENT LISTENERS & API DISPATCH
// ============================================================================

export function attachMetaAppReviewListeners() {
  document.querySelectorAll('.meta-review-tab-btn').forEach(btn => {
    btn.onclick = () => {
      const tab = btn.getAttribute('data-tab');
      if (tab) {
        activeReviewTab = tab;
        const mainViewEl = document.getElementById('main-content-view');
        if (mainViewEl) {
          mainViewEl.innerHTML = renderMetaAppReviewView(store.getState());
          attachMetaAppReviewListeners();
        }
      }
    };
  });

  // Action: Send Live Message (Video 1)
  const btnSendLive = document.getElementById('btn-meta-send-live');
  if (btnSendLive) {
    btnSendLive.onclick = async () => {
      const phoneInput = document.getElementById('meta-send-phone');
      const templateSelect = document.getElementById('meta-send-template-select');
      const recipientPhone = phoneInput?.value?.trim();
      const templateName = templateSelect?.value || 'hello_world';

      if (!recipientPhone) {
        window.showToast?.('Please enter recipient WhatsApp phone number');
        return;
      }

      btnSendLive.disabled = true;
      btnSendLive.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">refresh</span> Dispatching via Meta...';

      try {
        const res = await fetch(`${apiUrl}/api/whatsapp/meta-review/send-message`, {
          method: 'POST',
          headers: store.getAuthHeaders(),
          body: JSON.stringify({ recipientPhone, templateName })
        });
        const data = await res.json();
        lastSendResult = data;

        const box = document.getElementById('meta-send-response-box');
        if (box) {
          box.textContent = JSON.stringify(data, null, 2);
        }

        if (data.status === 'success') {
          window.showToast?.('✅ WhatsApp message sent! Check your phone.');
        } else {
          window.showToast?.(`❌ Meta Error: ${data.error || 'Failed to send'}`);
        }
      } catch (err) {
        lastSendResult = { status: 'error', error: err.message };
        const box = document.getElementById('meta-send-response-box');
        if (box) box.textContent = JSON.stringify({ error: err.message }, null, 2);
        window.showToast?.('Network error contacting backend');
      } finally {
        btnSendLive.disabled = false;
        btnSendLive.innerHTML = '<span class="material-symbols-outlined text-xl">send</span><span>Send Live WhatsApp Message via Meta Cloud API</span>';
      }
    };
  }

  // Action: Create Template (Video 2)
  const btnCreateTemplate = document.getElementById('btn-meta-create-template');
  if (btnCreateTemplate) {
    btnCreateTemplate.onclick = async () => {
      const name = document.getElementById('meta-template-name')?.value?.trim();
      const category = document.getElementById('meta-template-category')?.value || 'MARKETING';
      const headerText = document.getElementById('meta-template-header')?.value?.trim();
      const body = document.getElementById('meta-template-body')?.value?.trim();
      const example = document.getElementById('meta-template-example')?.value?.trim() || 'Alex';
      const buttonText = document.getElementById('meta-template-button')?.value?.trim();

      if (!name || !body) {
        window.showToast?.('Template name and body are required');
        return;
      }

      btnCreateTemplate.disabled = true;
      btnCreateTemplate.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">refresh</span> Submitting to Meta Graph API...';

      try {
        const payload = {
          name,
          category,
          language: 'en_US',
          headerText,
          body,
          exampleValues: [example],
          buttons: buttonText ? [{ type: 'QUICK_REPLY', text: buttonText }] : []
        };

        const res = await fetch(`${apiUrl}/api/whatsapp/meta-review/create-template`, {
          method: 'POST',
          headers: store.getAuthHeaders(),
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        lastTemplateResult = data;

        const box = document.getElementById('meta-template-response-box');
        if (box) {
          box.textContent = JSON.stringify(data, null, 2);
        }

        if (data.status === 'success') {
          window.showToast?.('✅ Template created on Meta WABA!');
        } else {
          window.showToast?.(`❌ Meta Error: ${data.error || 'Submission failed'}`);
        }
      } catch (err) {
        lastTemplateResult = { status: 'error', error: err.message };
        const box = document.getElementById('meta-template-response-box');
        if (box) box.textContent = JSON.stringify({ error: err.message }, null, 2);
        window.showToast?.('Network error submitting template');
      } finally {
        btnCreateTemplate.disabled = false;
        btnCreateTemplate.innerHTML = '<span class="material-symbols-outlined text-xl">add_circle</span><span>Submit Template to Meta Graph API</span>';
      }
    };
  }

  // Action: Save Credentials
  const btnSaveCreds = document.getElementById('btn-meta-save-credentials');
  if (btnSaveCreds) {
    btnSaveCreds.onclick = async () => {
      const accessToken = document.getElementById('input-meta-token')?.value?.trim();
      const phoneNumberId = document.getElementById('input-meta-phone-id')?.value?.trim();
      const wabaId = document.getElementById('input-meta-waba-id')?.value?.trim();

      try {
        const res = await fetch(`${apiUrl}/api/whatsapp/meta-review/save-credentials`, {
          method: 'POST',
          headers: store.getAuthHeaders(),
          body: JSON.stringify({ accessToken, phoneNumberId, wabaId })
        });
        const data = await res.json();
        window.showToast?.('Credentials updated! You can now test messaging and templates.');
      } catch (err) {
        window.showToast?.('Failed to save credentials: ' + err.message);
      }
    };
  }
}
