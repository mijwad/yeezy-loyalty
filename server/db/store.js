// In-Memory Double-Entry Ledger and POS Data Store with File Persistence
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { DEFAULT_LOYALTY_CONFIG, validateLoyaltyConfig } from '../../lib/loyalty/config.js';
import { normalizePhone, calculateLedgerBalance, evaluateTier } from '../../lib/loyalty/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists (handled safely in read-only serverless environments)
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  // Read-only serverless filesystem fallback
}

class POSDataStore {
  constructor() {
    this.sessions = {};
    this.rowLocks = new Map(); // Concurrency locks per member ID or phone
    this.data = this.loadInitialData();
  }

  loadInitialData() {
    let data = null;
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        data = JSON.parse(raw);
      } catch (err) {
        console.error('Error reading db.json, generating default data:', err);
      }
    }

    if (!data) {
      data = {};
    }

    if (!data.tenants || !Array.isArray(data.tenants)) {
      data.tenants = [];
    }
    const defaultTenants = [
      {
        id: 'ten_yeezy_01',
        name: 'Downtown Bistro Group',
        brandName: 'Downtown Bistro',
        ownerId: 'usr_owner_01',
        ownerName: 'Alex Rivera',
        ownerEmail: 'alex.rivera@downtownbistro.com',
        plan: 'ENTERPRISE',
        active: true,
        createdAt: '2026-01-10T10:00:00Z',
        primaryRestID: 'PP_DEL_101',
        outletsCount: 1,
        totalDiners: 0,
        lifetimeSales: 0
      },
      {
        id: 'ten_smokehouse_02',
        name: 'Smoke House Deli',
        brandName: 'Smoke House Deli',
        ownerId: 'usr_owner_02',
        ownerName: 'Riyaz Amlani',
        ownerEmail: 'riyaz@smokehousedeli.in',
        plan: 'GROWTH',
        active: true,
        createdAt: '2026-02-15T10:00:00Z',
        primaryRestID: 'PP_MUM_303',
        outletsCount: 1,
        totalDiners: 0,
        lifetimeSales: 0
      }
    ];
    defaultTenants.forEach(dt => {
      if (!data.tenants.some(t => t.id === dt.id)) {
        data.tenants.push(dt);
      }
    });

    // Initialize Users
    if (!data.users || !Array.isArray(data.users)) {
      data.users = [];
    }
    const defaultUsers = [
      {
        id: 'usr_super_01',
        name: 'Master Super Admin',
        email: 'admin@yeezy.com',
        password: 'admin123',
        role: 'SUPER_ADMIN',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'
      },
      {
        id: 'usr_owner_01',
        name: 'Alex Rivera',
        email: 'alex.rivera@downtownbistro.com',
        password: 'owner123',
        role: 'RESTAURANT_OWNER',
        tenantId: 'ten_yeezy_01',
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDPpV2wxw7i8SswByK1AqA_9McvWIk_klOo56Mqrga1PI0CEw0fTKSqVwyxbrIgPKYg69ZUQ1S3q7NMu5Aj6DJ026ke_Us2wN53ZRe5J2t0IjzPF7oRAMjNUxtS68SVby7B23Q3wjaEZANCRikHN0nga7Qjgvj66aE3Eu_Ee2P27BJ38n5Se6Rc6gFfErhrGdi9oNKjsegbnlGejUYcelstKMKxah37AADbD_20vqtcTdA3guZfx_z3eQ'
      },
      {
        id: 'usr_owner_02',
        name: 'Riyaz Amlani',
        email: 'riyaz@smokehousedeli.in',
        password: 'owner123',
        role: 'RESTAURANT_OWNER',
        tenantId: 'ten_smokehouse_02',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&q=80'
      }
    ];
    defaultUsers.forEach(du => {
      if (!data.users.some(u => u.email === du.email)) {
        data.users.push(du);
      }
    });

    if (!data.tenant) {
      data.tenant = data.tenants[0];
    }

    if (!data.outlets) {
      data.outlets = [
        { id: 'out_01', restID: 'PP_DEL_101', tenantId: 'ten_yeezy_01', name: 'Downtown Bistro', address: '124 Market St, Suite 100', active: true, appKey: 'sec_live_9a8f42bc71', reeloKey: '89146762-bc2a-4be4-ba5f-8c0aef3a358e', isMarketplaceConnected: false },
        { id: 'out_02', restID: 'PP_BLR_202', tenantId: 'ten_yeezy_01', name: 'Westside Grill', address: '852 West Ave', active: true, appKey: 'sec_live_3b7e81cc12', reeloKey: '4f29a081-37cd-4c8e-bf91-11d9d4a8e23b', isMarketplaceConnected: false },
        { id: 'out_03', restID: 'PP_MUM_303', tenantId: 'ten_smokehouse_02', name: 'Airport Hub', address: 'Terminal 2, Gate 14', active: true, appKey: 'sec_live_5d1a99bb84', reeloKey: 'a87b1c34-92e1-45fe-8910-c4e9f5632190', isMarketplaceConnected: false }
      ];
    }

    // 1. LOYALTY PROGRAMS (one per restaurant)
    if (!data.loyaltyPrograms || typeof data.loyaltyPrograms !== 'object') {
      data.loyaltyPrograms = {};
    }
    const defaultRestId = 'ten_yeezy_01';
    if (!data.loyaltyPrograms[defaultRestId]) {
      data.loyaltyPrograms[defaultRestId] = {
        id: 'prog_yeezy_01',
        restaurant_id: defaultRestId,
        is_active: true,
        config: DEFAULT_LOYALTY_CONFIG,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-10-24T00:00:00Z'
      };
    }
    // Backward compatibility for existing code reading posStore.data.loyaltyProgram
    if (!data.loyaltyProgram) {
      data.loyaltyProgram = data.loyaltyPrograms[defaultRestId].config;
    }

    // 2. LOYALTY MEMBERS
    if (!data.loyaltyMembers || !Array.isArray(data.loyaltyMembers)) {
      data.loyaltyMembers = [];
    }

    // 3. LOYALTY LEDGER (append-only)
    if (!data.loyaltyLedger || !Array.isArray(data.loyaltyLedger)) {
      data.loyaltyLedger = [];
    }

    // 4. LOYALTY REFERRALS
    if (!data.loyaltyReferrals || !Array.isArray(data.loyaltyReferrals)) {
      data.loyaltyReferrals = [];
    }

    // 5. LOYALTY MULTIPLIER RULES (Kerala slow-slot and festival templates)
    if (!data.loyaltyMultiplierRules || !Array.isArray(data.loyaltyMultiplierRules) || data.loyaltyMultiplierRules.length === 0) {
      data.loyaltyMultiplierRules = [
        {
          id: 'rule_onam',
          restaurant_id: defaultRestId,
          name: 'Onam Grand Sadhya (2.0x)',
          multiplier: 2.0,
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          start_time: '11:00:00',
          end_time: '16:00:00',
          start_date: null,
          end_date: null,
          is_active: true
        },
        {
          id: 'rule_vishu',
          restaurant_id: defaultRestId,
          name: 'Vishu Kaineettam Special (1.5x)',
          multiplier: 1.5,
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          start_time: '11:00:00',
          end_time: '23:00:00',
          start_date: null,
          end_date: null,
          is_active: true
        },
        {
          id: 'rule_eid',
          restaurant_id: defaultRestId,
          name: 'Eid Mubarak Feast (1.75x)',
          multiplier: 1.75,
          days_of_week: [0, 1, 2, 3, 4, 5, 6],
          start_time: '18:00:00',
          end_time: '23:30:00',
          start_date: null,
          end_date: null,
          is_active: true
        },
        {
          id: 'rule_happy_hours',
          restaurant_id: defaultRestId,
          name: 'Weekday Afternoon Slow-Slot (1.5x)',
          multiplier: 1.5,
          days_of_week: [1, 2, 3, 4],
          start_time: '14:00:00',
          end_time: '18:00:00',
          start_date: null,
          end_date: null,
          is_active: true
        },
        {
          id: 'rule_sunday_sadhya',
          restaurant_id: defaultRestId,
          name: 'Sunday Family Sadhya (1.25x)',
          multiplier: 1.25,
          days_of_week: [0],
          start_time: '12:00:00',
          end_time: '16:30:00',
          start_date: null,
          end_date: null,
          is_active: true
        }
      ];
    }

    // 6. LOYALTY CAMPAIGN LOG
    if (!data.loyaltyCampaignLog || !Array.isArray(data.loyaltyCampaignLog)) {
      data.loyaltyCampaignLog = [];
    }

    if (!data.creditsBalance) {
      data.creditsBalance = {
        sms: 100,
        email: 100,
        whatsappUtility: 100,
        whatsappMarketing: 100,
        autoRefillEnabled: false,
        autoRefillThreshold: 20,
        autoRefillAmount: 500
      };
    }

    if (!data.customers) data.customers = [];
    if (!data.redemptionSessions) data.redemptionSessions = {};
    if (!data.orders) data.orders = [];
    if (!data.webhookLogs) data.webhookLogs = [];

    this.persist(data);
    return data;
  }

  // Row-level lock per member for DB transaction simulation (ensures strict concurrency serialization)
  async withMemberLock(lockKey, callback) {
    while (this.rowLocks.has(lockKey)) {
      await this.rowLocks.get(lockKey);
    }

    let releaseLock;
    const lockPromise = new Promise(resolve => {
      releaseLock = resolve;
    });
    this.rowLocks.set(lockKey, lockPromise);

    try {
      return await callback();
    } finally {
      this.rowLocks.delete(lockKey);
      releaseLock();
    }
  }

  // Session Management
  createSession(user) {
    const token = `yzy_tok_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session = {
      token,
      userId: user.id,
      tenantId: user.tenantId,
      user,
      createdAt: Date.now()
    };
    this.sessions[token] = session;
    return token;
  }

  getSession(token) {
    if (!token) return null;
    return this.sessions[token] || null;
  }

  destroySession(token) {
    if (token && this.sessions[token]) {
      delete this.sessions[token];
      return true;
    }
    return false;
  }

  authenticate(identifier, password) {
    if (!identifier || !password) return null;
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();
    const user = this.data.users.find(u => {
      const matchEmail = u.email && u.email.toLowerCase() === cleanId;
      const emailPrefix = u.email ? u.email.split('@')[0].toLowerCase() : '';
      const matchUsername = (cleanId === 'admin' && u.role === 'SUPER_ADMIN') ||
                            (cleanId === 'alex' && u.id === 'usr_owner_01') ||
                            (cleanId === 'riyaz' && u.id === 'usr_owner_02') ||
                            (emailPrefix && emailPrefix === cleanId);
      return (matchEmail || matchUsername) && u.password === cleanPass;
    });
    if (!user) return null;

    let tenant = null;
    if (user.tenantId) {
      tenant = this.data.tenants.find(t => t.id === user.tenantId);
    }
    const assignedOutlets = this.data.outlets.filter(o => !user.tenantId || o.tenantId === user.tenantId);
    const sanitizedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      tenantId: user.tenantId || null,
      tenantName: tenant ? tenant.name : 'Yeezy Global Admin',
      primaryRestID: tenant ? tenant.primaryRestID : (assignedOutlets[0]?.restID || 'PP_DEL_101'),
      assignedOutlets
    };
    const token = this.createSession(sanitizedUser);
    return {
      user: sanitizedUser,
      token
    };
  }

  persist(data = this.data) {
    try {
      if (fs.existsSync(DATA_DIR)) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
      }
    } catch (err) {
      // Serverless or read-only environment
    }
  }

  createRestaurantTenant({ brandName, ownerName, ownerEmail, password, primaryOutletName, petpoojaRestID }) {
    if (!brandName || !ownerName || !ownerEmail) {
      throw new Error('brandName, ownerName, and ownerEmail are required');
    }

    const cleanEmail = ownerEmail.trim().toLowerCase();

    // Check if user with email already exists
    if (this.data.users && this.data.users.some(u => u.email && u.email.toLowerCase() === cleanEmail)) {
      throw new Error(`An account with email '${cleanEmail}' already exists`);
    }

    // Generate unique IDs
    const tenantSlug = brandName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15) || 'rest';
    const tenantId = `ten_${tenantSlug}_${Date.now().toString(36)}`;
    const restId = petpoojaRestID ? petpoojaRestID.trim().toUpperCase() : `PP_${tenantSlug.slice(0, 4).toUpperCase()}_${Math.floor(100 + Math.random() * 900)}`;

    const tenant = {
      id: tenantId,
      name: brandName.trim(),
      brandName: brandName.trim(),
      ownerId: `usr_${Date.now().toString(36)}`,
      ownerName: ownerName.trim(),
      ownerEmail: cleanEmail,
      plan: 'ENTERPRISE',
      active: true,
      createdAt: new Date().toISOString(),
      primaryRestID: restId,
      outletsCount: 1,
      totalDiners: 0,
      lifetimeSales: 0
    };

    const user = {
      id: tenant.ownerId,
      name: ownerName.trim(),
      email: cleanEmail,
      password: (password || 'owner123').trim(),
      role: 'RESTAURANT_OWNER',
      tenantId: tenant.id,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(ownerName.trim())}`
    };

    const outlet = {
      id: `out_${Date.now().toString(36)}`,
      restID: restId,
      tenantId: tenant.id,
      name: primaryOutletName ? primaryOutletName.trim() : `${brandName.trim()} Main Outlet`,
      address: 'Kerala, India',
      active: true,
      appKey: `sec_live_${randomUUID().slice(0, 10)}`,
      reeloKey: randomUUID(),
      isMarketplaceConnected: false
    };

    // Ensure collections exist
    if (!this.data.tenants) this.data.tenants = [];
    if (!this.data.users) this.data.users = [];
    if (!this.data.outlets) this.data.outlets = [];

    this.data.tenants.push(tenant);
    this.data.users.push(user);
    this.data.outlets.push(outlet);

    // Initialize default loyalty program for this restaurant tenant
    this.getLoyaltyProgram(tenant.id);

    this.persist();

    return {
      tenant,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId
      },
      outlet
    };
  }

  resetToZero() {
    this.data.customers = [];
    this.data.orders = [];
    this.data.loyaltyMembers = {};
    this.data.loyaltyLedger = [];
    this.data.loyaltyReferrals = [];
    this.data.webhookLogs = [];
    if (this.data.tenants) {
      this.data.tenants.forEach(t => {
        t.totalDiners = 0;
        t.lifetimeSales = 0;
      });
    }
    this.persist();
    return true;
  }

  // ==========================================
  // LOYALTY MODULE CORE STORE METHODS
  // ==========================================

  // 1. Get or create loyalty program for a restaurant
  getLoyaltyProgram(restaurantId = 'ten_yeezy_01') {
    const restId = restaurantId || 'ten_yeezy_01';
    if (!this.data.loyaltyPrograms[restId]) {
      this.data.loyaltyPrograms[restId] = {
        id: `prog_${Date.now()}`,
        restaurant_id: restId,
        is_active: true,
        config: DEFAULT_LOYALTY_CONFIG,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.persist();
    }
    return this.data.loyaltyPrograms[restId];
  }

  // 2. Update loyalty program with Zod validation
  updateLoyaltyProgram(restaurantId, updates) {
    const restId = restaurantId || 'ten_yeezy_01';
    const current = this.getLoyaltyProgram(restId);
    const mergedConfig = {
      ...current.config,
      ...updates
    };

    const validation = validateLoyaltyConfig(mergedConfig);
    if (!validation.isValid) {
      throw new Error(`Config validation failed: ${validation.errors?.join('; ')}`);
    }

    current.config = validation.data;
    current.updated_at = new Date().toISOString();
    // Also update legacy pointer
    this.data.loyaltyProgram = validation.data;
    this.persist();

    return {
      program: current,
      warning: validation.warning
    };
  }

  // 3. Member lookup or creation (scoped by restaurant_id + phone_e164)
  getOrCreateLoyaltyMember(restaurantId, phone, name = 'Valued Guest') {
    const restId = restaurantId || 'ten_yeezy_01';
    const phoneE164 = normalizePhone(phone);
    if (!phoneE164) {
      throw new Error('Valid phone number required');
    }

    let member = this.data.loyaltyMembers.find(m => m.restaurant_id === restId && m.phone_e164 === phoneE164);
    if (!member) {
      member = {
        id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        restaurant_id: restId,
        phone_e164: phoneE164,
        name: name || 'Valued Guest',
        tier: 'Silver',
        joined_at: new Date().toISOString(),
        last_visit_at: null,
        visit_count: 0,
        lifetime_spend_paise: 0,
        referred_by_member_id: null
      };
      this.data.loyaltyMembers.push(member);
      this.persist();
    }

    return member;
  }

  getLoyaltyMemberById(memberId) {
    return this.data.loyaltyMembers.find(m => m.id === memberId) || null;
  }

  // 4. Calculate member points balance from append-only ledger
  getMemberBalance(restaurantId, memberId) {
    const memberEntries = this.data.loyaltyLedger.filter(
      e => e.restaurant_id === restaurantId && e.member_id === memberId
    );
    return calculateLedgerBalance(memberEntries);
  }

  // 5. Active earn rows with remaining > 0 (for FIFO redemption)
  getActiveEarnEntries(restaurantId, memberId) {
    return this.data.loyaltyLedger
      .filter(e => e.restaurant_id === restaurantId && e.member_id === memberId && e.remaining > 0 && e.points > 0)
      .sort((a, b) => {
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      });
  }

  // 6. Append-only ledger writer with unique constraint (restaurant_id, order_id, type)
  appendLoyaltyLedgerEntry(entry) {
    if (entry.order_id) {
      const exists = this.data.loyaltyLedger.find(
        e => e.restaurant_id === entry.restaurant_id && e.order_id === entry.order_id && e.type === entry.type
      );
      if (exists) {
        return { isDuplicate: true, entry: exists };
      }
    }

    const fullEntry = {
      id: entry.id || `led_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      restaurant_id: entry.restaurant_id,
      member_id: entry.member_id,
      order_id: entry.order_id || null,
      type: entry.type,
      points: entry.points,
      remaining: entry.remaining !== undefined ? entry.remaining : (entry.points > 0 ? entry.points : 0),
      expires_at: entry.expires_at || null,
      meta: entry.meta || {},
      created_at: entry.created_at || new Date().toISOString()
    };

    this.data.loyaltyLedger.push(fullEntry);
    this.persist();

    return { isDuplicate: false, entry: fullEntry };
  }

  // Decrement remaining on an existing earn entry during FIFO redemption
  decrementEntryRemaining(entryId, amountToDeduct) {
    const entry = this.data.loyaltyLedger.find(e => e.id === entryId);
    if (entry && entry.remaining > 0) {
      entry.remaining = Math.max(0, entry.remaining - amountToDeduct);
      this.persist();
    }
  }

  // 7. Multiplier rules (Kerala festivals and slow-slot happy hours)
  getMultiplierRules(restaurantId = 'ten_yeezy_01') {
    return this.data.loyaltyMultiplierRules.filter(r => r.restaurant_id === restaurantId && r.is_active);
  }

  saveMultiplierRule(rule) {
    const existingIndex = this.data.loyaltyMultiplierRules.findIndex(r => r.id === rule.id);
    if (existingIndex >= 0) {
      this.data.loyaltyMultiplierRules[existingIndex] = {
        ...this.data.loyaltyMultiplierRules[existingIndex],
        ...rule
      };
    } else {
      this.data.loyaltyMultiplierRules.push({
        id: rule.id || `rule_${Date.now()}`,
        restaurant_id: rule.restaurant_id || 'ten_yeezy_01',
        is_active: true,
        ...rule
      });
    }
    this.persist();
    return rule;
  }

  // 8. Referrals
  createReferral(restaurantId, referrerMemberId, refereeMemberId) {
    if (referrerMemberId === refereeMemberId) {
      throw new Error('Self-referrals are not permitted');
    }

    // Check unique referee constraint
    const existing = this.data.loyaltyReferrals.find(
      r => r.restaurant_id === restaurantId && r.referee_member_id === refereeMemberId
    );
    if (existing) {
      return existing;
    }

    const referral = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      restaurant_id: restaurantId,
      referrer_member_id: referrerMemberId,
      referee_member_id: refereeMemberId,
      status: 'pending',
      qualified_order_id: null,
      created_at: new Date().toISOString()
    };

    this.data.loyaltyReferrals.push(referral);
    this.persist();
    return referral;
  }

  getReferralsForReferrer(restaurantId, referrerMemberId) {
    return this.data.loyaltyReferrals.filter(
      r => r.restaurant_id === restaurantId && r.referrer_member_id === referrerMemberId
    );
  }

  getQualifiedReferralsThisMonth(restaurantId, referrerMemberId) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return this.data.loyaltyReferrals.filter(
      r => r.restaurant_id === restaurantId &&
           r.referrer_member_id === referrerMemberId &&
           r.status === 'qualified' &&
           new Date(r.created_at) >= startOfMonth
    ).length;
  }

  // 9. Campaign Log (Winback / WhatsApp sends)
  logCampaign(restaurantId, memberId, type, channel = 'WHATSAPP', convertedOrderId = null) {
    const entry = {
      id: `camp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      restaurant_id: restaurantId,
      member_id: memberId,
      type,
      sent_at: new Date().toISOString(),
      channel,
      converted_order_id: convertedOrderId,
      created_at: new Date().toISOString()
    };
    this.data.loyaltyCampaignLog.push(entry);
    this.persist();
    return entry;
  }

  getLastCampaignForMember(restaurantId, memberId) {
    const campaigns = this.data.loyaltyCampaignLog
      .filter(c => c.restaurant_id === restaurantId && c.member_id === memberId)
      .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
    return campaigns[0] || null;
  }

  // 10. Expiry runner
  expireOldPoints(restaurantId = 'ten_yeezy_01', now = new Date()) {
    const nowTime = now.getTime();
    const expiredLedger = [];

    this.data.loyaltyLedger.forEach(entry => {
      if (entry.restaurant_id === restaurantId && entry.remaining > 0 && entry.expires_at) {
        if (new Date(entry.expires_at).getTime() < nowTime) {
          const expiredPoints = entry.remaining;
          entry.remaining = 0;

          const expireRow = {
            id: `led_exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            restaurant_id: restaurantId,
            member_id: entry.member_id,
            order_id: null,
            type: 'expire',
            points: -expiredPoints,
            remaining: 0,
            expires_at: null,
            meta: {
              source_entry_id: entry.id,
              original_type: entry.type
            },
            created_at: now.toISOString()
          };
          this.data.loyaltyLedger.push(expireRow);
          expiredLedger.push(expireRow);
        }
      }
    });

    if (expiredLedger.length > 0) {
      this.persist();
    }
    return expiredLedger;
  }

  // Legacy helper
  getOrCreateCustomer(phone, name = 'Valued Guest', tenantId = null) {
    return this.getOrCreateLoyaltyMember(tenantId, phone, name);
  }

  recordLedgerEntry(params) {
    return this.appendLoyaltyLedgerEntry({
      restaurant_id: params.tenantId || 'ten_yeezy_01',
      member_id: params.customerId,
      order_id: params.orderId,
      type: params.type.toLowerCase().includes('earn') ? 'earn_base' : 'redeem',
      points: params.pointsDelta,
      remaining: params.pointsDelta > 0 ? params.pointsDelta : 0,
      expires_at: null,
      meta: { reason: params.reason }
    });
  }

  logWebhook(entry) {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.data.webhookLogs.unshift(logEntry);
    if (this.data.webhookLogs.length > 200) {
      this.data.webhookLogs = this.data.webhookLogs.slice(0, 200);
    }
    this.persist();
    return logEntry;
  }
}

export const posStore = new POSDataStore();
