// In-Memory Double-Entry Ledger and POS Data Store with File Persistence
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class POSDataStore {
  constructor() {
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

    // Initialize Tenants if missing
    if (!data.tenants || !Array.isArray(data.tenants)) {
      data.tenants = [
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
        }
      ];
    }

    // Initialize Users (Super Admin and Restaurant Owners)
    if (!data.users || !Array.isArray(data.users)) {
      data.users = [
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
    }

    // Fallback tenant object
    if (!data.tenant) {
      data.tenant = data.tenants[0];
    }

    if (!data.outlets) {
      data.outlets = [
        { id: 'out_01', restID: 'PP_DEL_101', tenantId: 'ten_yeezy_01', name: 'Downtown Bistro', address: '124 Market St, Suite 100', active: true, appKey: 'sec_live_9a8f42bc71', reeloKey: '89146762-bc2a-4be4-ba5f-8c0aef3a358e', isMarketplaceConnected: false },
        { id: 'out_02', restID: 'PP_BLR_202', tenantId: 'ten_yeezy_01', name: 'Westside Grill', address: '852 West Ave', active: true, appKey: 'sec_live_3b7e81cc12', reeloKey: '4f29a081-37cd-4c8e-bf91-11d9d4a8e23b', isMarketplaceConnected: false },
        { id: 'out_03', restID: 'PP_MUM_303', tenantId: 'ten_smokehouse_02', name: 'Airport Hub', address: 'Terminal 2, Gate 14', active: true, appKey: 'sec_live_5d1a99bb84', reeloKey: 'a87b1c34-92e1-45fe-8910-c4e9f5632190', isMarketplaceConnected: false }
      ];
    } else {
      // Ensure all loaded outlets have unique reeloKey and tenantId
      data.outlets.forEach((o, idx) => {
        if (!o.reeloKey) {
          o.reeloKey = idx === 0 ? '89146762-bc2a-4be4-ba5f-8c0aef3a358e' : randomUUID();
        }
        if (!o.tenantId) {
          o.tenantId = 'ten_yeezy_01';
        }
      });
    }

    if (!data.loyaltyProgram) {
      data.loyaltyProgram = {
        id: 'prog_01',
        name: 'Yeezy Rewards',
        title: 'Yeezy Rewards',
        subtitle: 'Get rewarded on every purchase',
        isActive: true,
        type: 'amount_spent',
        spendRate: 100,
        pointsRate: 10,
        pointValueInr: 1.0,
        minBillToEarn: 100,
        minBillToRedeem: 200,
        maxDiscountPercentage: 50.0,
        maxPointsPerBill: 5000,
        welcomeBonus: 100,
        rewardTiers: [
          { id: 'tier-1', points: 500, title: 'Get a free coffee or dessert', rewardType: 'item' },
          { id: 'tier-2', points: 1000, title: "You're special. Get ₹125 off", rewardType: 'discount_amount' },
          { id: 'tier-3', points: 1500, title: 'VIP Celebration: Flat 15% OFF entire bill', rewardType: 'discount_percentage' }
        ]
      };
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

    if (!data.customers) {
      data.customers = [];
    }

    if (!data.loyaltyLedger) {
      data.loyaltyLedger = [];
    }

    if (!data.redemptionSessions) {
      data.redemptionSessions = {};
    }

    if (!data.orders) {
      data.orders = [];
    }

    if (!data.webhookLogs) {
      data.webhookLogs = [];
    }

    this.persist(data);
    return data;
  }
  // Authenticate user by username/email & password
  authenticate(identifier, password) {
    if (!identifier || !password) return null;
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();
    const user = this.data.users.find(u => {
      const matchEmail = u.email && u.email.toLowerCase() === cleanId;
      const matchUsername = (cleanId === 'admin' && u.role === 'SUPER_ADMIN') ||
                            (cleanId === 'alex' && u.id === 'usr_owner_01');
      return (matchEmail || matchUsername) && u.password === cleanPass;
    });
    if (!user) return null;

    let tenant = null;
    if (user.tenantId) {
      tenant = this.data.tenants.find(t => t.id === user.tenantId);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role, // 'SUPER_ADMIN' | 'RESTAURANT_OWNER'
      avatar: user.avatar,
      tenantId: user.tenantId || null,
      tenantName: tenant ? tenant.name : 'Yeezy Global Admin',
      primaryRestID: tenant ? tenant.primaryRestID : 'PP_DEL_101',
      assignedOutlets: this.data.outlets
    };
  }

  // Super Admin: Create new restaurant and owner
  createRestaurantTenant({ brandName, ownerName, ownerEmail, password, primaryOutletName, petpoojaRestID }) {
    const cleanEmail = ownerEmail.trim().toLowerCase();
    const existing = this.data.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      throw new Error(`A user with email ${cleanEmail} already exists`);
    }

    const tenantId = `ten_${Date.now()}`;
    const userId = `usr_${Date.now()}`;
    const outletId = `out_${Date.now()}`;
    const restID = petpoojaRestID || `PP_${brandName.replace(/\s+/g, '').toUpperCase().slice(0, 3)}_${Math.floor(100 + Math.random() * 900)}`;

    const newTenant = {
      id: tenantId,
      name: brandName,
      brandName: brandName,
      ownerId: userId,
      ownerName,
      ownerEmail: cleanEmail,
      plan: 'GROWTH',
      active: true,
      createdAt: new Date().toISOString(),
      primaryRestID: restID,
      outletsCount: 1,
      totalDiners: 0,
      lifetimeSales: 0
    };

    const newOwner = {
      id: userId,
      name: ownerName,
      email: cleanEmail,
      password: password || 'owner123',
      role: 'RESTAURANT_OWNER',
      tenantId,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(ownerName)}`
    };

    const newReeloKey = randomUUID();
    const newOutlet = {
      id: outletId,
      restID,
      tenantId,
      name: primaryOutletName || `${brandName} Flagship`,
      address: 'Main Commercial Hub',
      active: true,
      appKey: `sec_live_${Math.random().toString(36).substr(2, 10)}`,
      reeloKey: newReeloKey,
      isMarketplaceConnected: false
    };

    this.data.tenants.unshift(newTenant);
    this.data.users.push(newOwner);
    this.data.outlets.push(newOutlet);
    this.persist();

    return {
      tenant: newTenant,
      owner: {
        id: newOwner.id,
        name: newOwner.name,
        email: newOwner.email,
        role: newOwner.role
      },
      outlet: newOutlet
    };
  }

  persist(data = this.data) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write db.json:', err);
    }
  }

  // Find customer by phone or create if new
  getOrCreateCustomer(phone, name = 'Valued Guest') {
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    let customer = this.data.customers.find(c => c.phone.slice(-10) === cleanPhone);

    if (!customer) {
      customer = {
        id: `cust_${Date.now()}`,
        name: name || `Guest (${cleanPhone.slice(-4)})`,
        phone: cleanPhone,
        email: `${cleanPhone}@guest.yeezy.app`,
        tier: 'New',
        pointsBalance: this.data.loyaltyProgram.welcomeBonus || 0,
        lifetimeSpend: 0,
        visits: 0,
        favoriteDish: 'Chef Special',
        lastVisit: 'Just now',
        joinedDate: new Date().toISOString().slice(0, 10)
      };
      this.data.customers.push(customer);

      if (customer.pointsBalance > 0) {
        this.data.loyaltyLedger.push({
          id: `ledg_${Date.now()}`,
          customerId: customer.id,
          type: 'BONUS_WELCOME',
          pointsDelta: customer.pointsBalance,
          balanceAfter: customer.pointsBalance,
          orderId: null,
          reason: 'Welcome bonus upon first POS bill registration',
          createdAt: new Date().toISOString()
        });
      }

      this.persist();
    }

    return customer;
  }

  // Update customer tier based on lifetime spend
  updateCustomerTier(customer) {
    if (customer.lifetimeSpend >= 15000) {
      customer.tier = 'VIP';
    } else if (customer.lifetimeSpend >= 5000) {
      customer.tier = 'Frequent';
    } else if (customer.visits === 1) {
      customer.tier = 'New';
    } else {
      customer.tier = 'Regular';
    }
  }

  // Record an append-only transaction in double-entry ledger
  recordLedgerEntry({ customerId, type, pointsDelta, orderId = null, reason = '' }) {
    const customer = this.data.customers.find(c => c.id === customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    const newBalance = Math.max(0, customer.pointsBalance + pointsDelta);
    customer.pointsBalance = newBalance;

    const entry = {
      id: `ledg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      customerId,
      type, // 'EARN_PURCHASE' | 'REDEEM_BURN' | 'REVERSAL_VOID' | 'MANUAL_ADJUST' | 'BONUS_WELCOME'
      pointsDelta,
      balanceAfter: newBalance,
      orderId,
      reason,
      createdAt: new Date().toISOString()
    };

    this.data.loyaltyLedger.unshift(entry);
    this.persist();
    return entry;
  }

  // Log POS Webhook
  logWebhook({ eventType, restID, orderId, payload, status, response, errorMessage = null }) {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      eventType,
      restID,
      orderId,
      status, // 'SUCCESS' | 'FAILED' | 'REJECTED'
      payload,
      response,
      errorMessage
    };

    this.data.webhookLogs.unshift(logEntry);
    if (this.data.webhookLogs.length > 200) {
      this.data.webhookLogs = this.data.webhookLogs.slice(0, 200);
    }
    this.persist();
    return logEntry;
  }

  // Wipe all transactional and guest data to 0
  resetToZero() {
    this.data.customers = [];
    this.data.loyaltyLedger = [];
    this.data.orders = [];
    this.data.redemptionSessions = {};
    this.data.webhookLogs = [];
    if (this.data.tenants && Array.isArray(this.data.tenants)) {
      this.data.tenants.forEach(t => {
        t.totalDiners = 0;
        t.lifetimeSales = 0;
      });
    }
    this.persist();
    return this.data;
  }
}

export const posStore = new POSDataStore();
