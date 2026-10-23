-- ============================================================================
-- YEEZY LOYALTY PLATFORM - ENTERPRISE MULTI-TENANT DATABASE SCHEMA
-- Compatible with PostgreSQL 14+ / Supabase / Neon / AWS RDS Aurora
-- Includes: Super Admin, Multi-Brand Tenants, Outlets, Customers, 
--           Double-Entry Loyalty Ledger, POS Integrations (Petpooja), 
--           Order & Bill Ingestion, Discount Engine, and Webhook Logs.
-- ============================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS & DOMAINS
-- ============================================================================

CREATE TYPE super_admin_role AS ENUM (
    'SUPER_ADMIN',
    'SUPPORT_AGENT',
    'FINANCE_AUDITOR',
    'SYSTEM_ENGINEER'
);

CREATE TYPE tenant_status AS ENUM (
    'PENDING_ONBOARDING',
    'ACTIVE',
    'SUSPENDED',
    'CANCELLED'
);

CREATE TYPE outlet_status AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'MAINTENANCE'
);

CREATE TYPE user_tenant_role AS ENUM (
    'BRAND_OWNER',
    'BRAND_MANAGER',
    'OUTLET_MANAGER',
    'CASHIER',
    'MARKETING_LEAD'
);

CREATE TYPE loyalty_program_type AS ENUM (
    'AMOUNT_SPENT_POINTS',     -- e.g. 10% earned as points on spend
    'CASHBACK_PERCENTAGE',     -- e.g. 5% cashback to wallet
    'VISIT_STAMPS',            -- e.g. 1 stamp per visit, 5th visit free dessert
    'TIERED_VIP'               -- Silver, Gold, Platinum based on 12-month spend
);

CREATE TYPE discount_type AS ENUM (
    'POINTS_TO_CASH',          -- 100 points = ₹100 discount
    'PERCENTAGE_OF_BILL',      -- e.g. 10% off bill
    'FLAT_AMOUNT',             -- e.g. ₹150 off
    'FREE_ITEM'                -- Free dessert or coffee coupon
);

CREATE TYPE pos_system_type AS ENUM (
    'PETPOOJA',
    'POSIST',
    'URBANPIPER',
    'DOTPE',
    'PINELABS',
    'TOAST',
    'SQUARE',
    'CUSTOM_WEBHOOK'
);

CREATE TYPE pos_sync_status AS ENUM (
    'PENDING',
    'CONNECTED',
    'DISCONNECTED',
    'AUTHENTICATION_ERROR',
    'PAUSED'
);

CREATE TYPE order_status AS ENUM (
    'DRAFT',                   -- Bill open on POS
    'PENDING_PAYMENT',
    'PAID_SETTLED',            -- Bill settled and paid on POS
    'VOIDED_CANCELLED',        -- Bill voided on POS
    'REFUNDED'
);

CREATE TYPE redemption_status AS ENUM (
    'QUOTED',                  -- Discount calculated, presented to cashier
    'LOCKED_PENDING_PAYMENT',  -- Points locked while customer pays remaining bill
    'REDEEMED_CONFIRMED',      -- Bill settled, points burned
    'REVERSED_UNLOCKED',       -- Order cancelled or abandoned, points returned
    'EXPIRED'
);

CREATE TYPE ledger_entry_type AS ENUM (
    'EARN_BILL_SETTLEMENT',    -- Points earned on paying bill
    'BURN_DISCOUNT_REDEMPTION',-- Points spent to get bill discount
    'BONUS_SIGNUP',            -- Welcome points on registration
    'BONUS_BIRTHDAY',          -- Birthday celebratory points
    'BONUS_REFERRAL',          -- Referral bonus
    'MANUAL_CREDIT_ADMIN',     -- Manually adjusted by manager
    'MANUAL_DEBIT_ADMIN',      -- Manually deducted by manager
    'REVERSAL_ORDER_CANCELLED',-- Order voided on POS, points restored/deducted
    'POINTS_EXPIRATION'        -- Points expired after validity period
);

CREATE TYPE channel_type AS ENUM (
    'WHATSAPP',
    'SMS',
    'EMAIL'
);

CREATE TYPE credit_transaction_type AS ENUM (
    'TOPUP_PURCHASE',
    'USAGE_DEDUCTION',
    'PROMOTIONAL_CREDIT',
    'REFUND_CREDIT'
);

-- ============================================================================
-- 2. SUPER ADMIN & PLATFORM GOVERNANCE
-- ============================================================================

-- Platform super administrators (controls all restaurant brands and multi-tenancy)
CREATE TABLE super_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(120) NOT NULL,
    email citext UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    role super_admin_role NOT NULL DEFAULT 'SUPER_ADMIN',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    two_factor_secret VARCHAR(128),
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Global platform audit log (tracks all super admin actions across any brand)
CREATE TABLE super_admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    super_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g. 'SUSPEND_TENANT', 'INJECT_CREDITS', 'RESET_POS_KEY'
    target_tenant_id UUID,
    ip_address INET,
    user_agent TEXT,
    payload_before JSONB,
    payload_after JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. MULTI-TENANT ORGANIZATIONS (BRANDS) & OUTLETS
-- ============================================================================

-- Restaurant Brands / Companies (Tenant)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g. 'yeezy-burgers', 'smoke-house-deli'
    name VARCHAR(150) NOT NULL,
    logo_url TEXT,
    legal_entity_name VARCHAR(200),
    tax_gstin VARCHAR(30),
    status tenant_status NOT NULL DEFAULT 'ACTIVE',
    billing_plan VARCHAR(50) NOT NULL DEFAULT 'PRO_GROWTH', -- STARTER, PRO_GROWTH, ENTERPRISE
    subscription_renews_at TIMESTAMPTZ,
    primary_contact_name VARCHAR(120),
    primary_contact_email citext NOT NULL,
    primary_contact_phone VARCHAR(20) NOT NULL,
    
    -- Messaging Credit Balances (Brand Level)
    sms_credits_balance INT NOT NULL DEFAULT 100 CHECK (sms_credits_balance >= 0),
    email_credits_balance INT NOT NULL DEFAULT 100 CHECK (email_credits_balance >= 0),
    whatsapp_utility_credits INT NOT NULL DEFAULT 100 CHECK (whatsapp_utility_credits >= 0),
    whatsapp_marketing_credits INT NOT NULL DEFAULT 100 CHECK (whatsapp_marketing_credits >= 0),
    auto_refill_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_refill_threshold INT DEFAULT 50,
    auto_refill_pack_size INT DEFAULT 1000,
    
    -- Global Configuration & Currency
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Physical Restaurant Outlets / Branches belonging to a Brand
CREATE TABLE outlets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL, -- e.g. 'DELHI-CP-01', 'MUMBAI-BKC-02'
    name VARCHAR(150) NOT NULL, -- e.g. 'Smoke House Deli - Connaught Place'
    status outlet_status NOT NULL DEFAULT 'ACTIVE',
    phone VARCHAR(20),
    email citext,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    
    -- Table QR Code & Self-Checkin settings
    qr_code_token VARCHAR(64) UNIQUE,
    table_count INT DEFAULT 20,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (tenant_id, code)
);

-- Brand Staff, Managers, and Cashiers
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL, -- NULL means all outlets (Brand Manager)
    full_name VARCHAR(120) NOT NULL,
    email citext NOT NULL,
    phone_number VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role user_tenant_role NOT NULL DEFAULT 'OUTLET_MANAGER',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pos_pin_hash VARCHAR(128), -- Fast 4-digit PIN for cashier POS terminal authorization
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (tenant_id, email)
);

-- ============================================================================
-- 4. POS INTEGRATION ENGINE (PETPOOJA & OTHER POS)
-- ============================================================================

-- POS Integration Configurations per Outlet or per Tenant
CREATE TABLE pos_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    pos_type pos_system_type NOT NULL DEFAULT 'PETPOOJA',
    sync_status pos_sync_status NOT NULL DEFAULT 'CONNECTED',
    
    -- Petpooja Specific Identifiers
    -- In Petpooja, restID (Restaurant ID) maps to an outlet in Petpooja's database
    petpooja_rest_id VARCHAR(100) NOT NULL, 
    petpooja_app_key VARCHAR(255),
    petpooja_app_secret VARCHAR(255),
    petpooja_access_token TEXT,
    
    -- Generic API / Webhook Auth for POS
    pos_api_base_url TEXT,
    webhook_secret_key VARCHAR(255) NOT NULL, -- Used to verify HMAC signature from Petpooja
    inbound_webhook_url TEXT,                 -- Unique endpoint URL given to Petpooja
    
    -- Feature Toggles for this POS node
    allow_points_redemption BOOLEAN NOT NULL DEFAULT TRUE,
    allow_points_accrual BOOLEAN NOT NULL DEFAULT TRUE,
    require_otp_for_redemption BOOLEAN NOT NULL DEFAULT FALSE,
    min_bill_amount_for_redemption DECIMAL(12, 2) NOT NULL DEFAULT 100.00,
    max_bill_percentage_discount DECIMAL(5, 2) NOT NULL DEFAULT 50.00, -- Maximum 50% discount from loyalty
    
    last_sync_heartbeat_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb, -- Store POS menu tax categories, tender types, server details
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (outlet_id, pos_type),
    UNIQUE (pos_type, petpooja_rest_id)
);

-- Raw POS Webhook Ingestion Log (Guarantees Auditability, Idempotency & Replayability)
CREATE TABLE pos_webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pos_integration_id UUID REFERENCES pos_integrations(id) ON DELETE SET NULL,
    pos_type pos_system_type NOT NULL,
    event_type VARCHAR(100) NOT NULL, -- e.g. 'FETCH_CUSTOMER', 'CALCULATE_DISCOUNT', 'SAVE_ORDER', 'ORDER_CANCELLED'
    idempotency_key VARCHAR(255) UNIQUE, -- Unique Hash of (pos_type, order_id, event_type)
    headers JSONB,
    payload JSONB NOT NULL,
    response_status INT,
    response_body JSONB,
    processing_time_ms INT,
    error_message TEXT,
    is_processed_successfully BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. LOYALTY RULES & PROGRAM CONFIGURATOR
-- ============================================================================

-- Loyalty Program Blueprint for a Brand
CREATE TABLE loyalty_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    program_name VARCHAR(150) NOT NULL DEFAULT 'Vanguard Rewards',
    program_type loyalty_program_type NOT NULL DEFAULT 'AMOUNT_SPENT_POINTS',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Earn Rules: e.g. Spend ₹100 = Earn 10 Points (Ratio: 0.10)
    spend_amount_unit DECIMAL(12, 2) NOT NULL DEFAULT 100.00,
    points_earned_per_unit DECIMAL(12, 2) NOT NULL DEFAULT 10.00,
    
    -- Burn / Discount Rules: e.g. 1 Point = ₹1.00 Discount in Petpooja bill
    point_redemption_value_in_cash DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
    min_points_to_burn INT NOT NULL DEFAULT 50, -- Minimum balance needed to redeem
    max_points_burn_per_bill INT DEFAULT 1000,   -- Cap per transaction (NULL = unlimited)
    
    -- Expiry Rules
    points_expiry_months INT NOT NULL DEFAULT 12, -- Points expire after 12 months
    send_expiry_reminder_days INT NOT NULL DEFAULT 30,
    
    -- Onboarding Incentives
    welcome_bonus_points INT NOT NULL DEFAULT 50,
    birthday_bonus_points INT NOT NULL DEFAULT 100,
    referral_bonus_points INT NOT NULL DEFAULT 100,
    
    -- Excluded from loyalty (e.g. alcohol, tobacco, delivery charges, packaging)
    exclude_taxes_from_accrual BOOLEAN NOT NULL DEFAULT TRUE,
    exclude_discounted_items BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (tenant_id)
);

-- VIP Tiers (Silver, Gold, Platinum)
CREATE TABLE loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loyalty_program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
    tier_name VARCHAR(60) NOT NULL, -- 'Silver', 'Gold', 'Black Card VIP'
    tier_level INT NOT NULL,        -- 1 (base), 2, 3
    min_annual_spend DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    points_multiplier DECIMAL(4, 2) NOT NULL DEFAULT 1.00, -- e.g. Gold gets 1.5x points
    perks_description TEXT,
    card_badge_color VARCHAR(30) DEFAULT '#7C3AED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (loyalty_program_id, tier_level),
    UNIQUE (loyalty_program_id, tier_name)
);

-- ============================================================================
-- 6. CUSTOMER PROFILES & MEMBERSHIP
-- ============================================================================

-- Customers are linked per Tenant Brand (Mobile number is unique within Brand)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    current_tier_id UUID REFERENCES loyalty_tiers(id) ON DELETE SET NULL,
    first_outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL, -- Where they first dined
    
    -- Identity (Phone is primary lookup key for Petpooja POS)
    phone_number VARCHAR(20) NOT NULL,
    country_code VARCHAR(5) NOT NULL DEFAULT '+91',
    full_name VARCHAR(120),
    email citext,
    gender VARCHAR(20),
    date_of_birth DATE,
    anniversary_date DATE,
    
    -- Current Balances (Cached, source of truth is double-entry ledger)
    points_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (points_balance >= 0),
    lifetime_points_earned DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    lifetime_points_redeemed DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    lifetime_spend DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    total_visits_count INT NOT NULL DEFAULT 0,
    
    -- Recency, Frequency, Monetary (RFM) Segmentation
    first_visit_at TIMESTAMPTZ,
    last_visit_at TIMESTAMPTZ,
    rfm_segment VARCHAR(50) DEFAULT 'NEW_GUEST', -- 'VIP', 'REGULAR', 'SLIPPING_AWAY', 'LOST'
    
    -- Consent & Communication
    is_whatsapp_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
    is_sms_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE, -- Fraud protection flag
    
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (tenant_id, phone_number)
);

-- ============================================================================
-- 7. ORDERS, BILLING & DISCOUNT REDEMPTION (PETPOOJA SYNC)
-- ============================================================================

-- Restaurant Orders Ingested from Petpooja / POS
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- POS Native References
    pos_system pos_system_type NOT NULL DEFAULT 'PETPOOJA',
    pos_order_id VARCHAR(100) NOT NULL,      -- Petpooja 'orderid' or 'clientorderid'
    pos_bill_no VARCHAR(100) NOT NULL,       -- Printed Bill Number on POS
    table_no VARCHAR(50),
    server_name VARCHAR(100),                -- Waiter / Captain name
    order_type VARCHAR(50) DEFAULT 'DINE_IN',-- 'DINE_IN', 'TAKEAWAY', 'DELIVERY'
    
    -- Financial Breakdown (INR)
    subtotal_amount DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    service_charge DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    gross_bill_amount DECIMAL(12, 2) NOT NULL,
    
    -- Discounts Applied
    loyalty_discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Amount shaved off via points
    other_discounts_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,  -- Promo codes / Manager comps
    total_discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    -- Final Net Paid by Diner
    net_payable_amount DECIMAL(12, 2) NOT NULL,
    payment_mode VARCHAR(50), -- 'CASH', 'CREDIT_CARD', 'UPI', 'SPLIT'
    
    -- Loyalty Computation Results
    eligible_spend_for_points DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    points_earned_on_bill DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    points_redeemed_on_bill DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    
    status order_status NOT NULL DEFAULT 'PAID_SETTLED',
    pos_created_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE (outlet_id, pos_system, pos_order_id)
);

-- Detailed item lines (useful for basket analysis and dish-specific rewards)
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    pos_item_id VARCHAR(100),
    item_name VARCHAR(200) NOT NULL,
    category_name VARCHAR(100),
    quantity DECIMAL(8, 2) NOT NULL DEFAULT 1.00,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
    is_discountable BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Point Redemption Claims (Locks points when POS requests discount; Settles on bill print)
CREATE TABLE loyalty_redemption_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    outlet_id UUID NOT NULL REFERENCES outlets(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    
    pos_session_token VARCHAR(120) NOT NULL UNIQUE, -- Token exchanged with Petpooja
    bill_amount_snapshot DECIMAL(12, 2) NOT NULL,
    
    points_requested DECIMAL(12, 2) NOT NULL,
    discount_amount_offered DECIMAL(12, 2) NOT NULL,
    
    -- Optional OTP for Anti-Fraud Verification
    otp_code VARCHAR(10),
    otp_expires_at TIMESTAMPTZ,
    is_otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
    
    status redemption_status NOT NULL DEFAULT 'QUOTED',
    locked_at TIMESTAMPTZ,
    redeemed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL, -- e.g. 15 minutes lock window
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. IMMUTABLE DOUBLE-ENTRY LOYALTY LEDGER
-- ============================================================================

-- Every single point earned or burned is recorded here. Never edited, only appended.
CREATE TABLE loyalty_ledger_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    redemption_session_id UUID REFERENCES loyalty_redemption_sessions(id) ON DELETE SET NULL,
    
    entry_type ledger_entry_type NOT NULL,
    points_delta DECIMAL(12, 2) NOT NULL, -- Positive for earn, Negative for burn
    balance_after DECIMAL(12, 2) NOT NULL, -- Snapshot of balance after applying delta
    
    idempotency_key VARCHAR(255) UNIQUE NOT NULL, -- Prevents duplicate crediting on network retries
    description VARCHAR(255) NOT NULL,           -- e.g. 'Earned on Bill #PP-98124 at Connaught Place'
    
    -- Expiration tracking for earned points
    expires_at TIMESTAMPTZ,
    is_expired BOOLEAN NOT NULL DEFAULT FALSE,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. MESSAGING & NOTIFICATION CREDITS AUDIT
-- ============================================================================

-- Audit trail for SMS/WhatsApp/Email credits spent or purchased
CREATE TABLE tenant_credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    channel channel_type NOT NULL,
    transaction_type credit_transaction_type NOT NULL,
    credits_delta INT NOT NULL, -- +1000 for topup, -1 for sent WhatsApp message
    balance_after INT NOT NULL,
    reference_id VARCHAR(100), -- Campaign ID or Order ID
    description VARCHAR(255) NOT NULL,
    created_by_super_admin_id UUID REFERENCES super_admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. INDEXES FOR ULTRA-LOW-LATENCY POS LOOKUP (< 50ms)
-- ============================================================================

-- Customer lookup during billing by phone number
CREATE INDEX idx_customers_tenant_phone ON customers(tenant_id, phone_number);

-- Petpooja Outlet Lookup during inbound webhooks
CREATE INDEX idx_pos_integrations_petpooja ON pos_integrations(pos_type, petpooja_rest_id);

-- Order lookup by POS Bill number
CREATE INDEX idx_orders_outlet_pos_bill ON orders(outlet_id, pos_bill_no);

-- Ledger transactions for customer timeline
CREATE INDEX idx_ledger_customer_created ON loyalty_ledger_transactions(customer_id, created_at DESC);

-- Webhook log index for deduplication and debugging
CREATE INDEX idx_pos_logs_idempotency ON pos_webhook_logs(idempotency_key);
CREATE INDEX idx_pos_logs_created ON pos_webhook_logs(created_at DESC);

-- Redemption Session lookup
CREATE INDEX idx_redemption_token ON loyalty_redemption_sessions(pos_session_token);
CREATE INDEX idx_redemption_status_expiry ON loyalty_redemption_sessions(status, expires_at);

-- ============================================================================
-- 11. AUTOMATIC TRIGGERS & BALANCE INTEGRITY
-- ============================================================================

-- Function: Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers
CREATE TRIGGER set_timestamp_tenants BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_outlets BEFORE UPDATE ON outlets FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_customers BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_pos_integrations BEFORE UPDATE ON pos_integrations FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_orders BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();
CREATE TRIGGER set_timestamp_loyalty_programs BEFORE UPDATE ON loyalty_programs FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================================================
-- 12. INITIAL SEED DATA (SUPER ADMIN & DEMO BRAND)
-- ============================================================================

-- Insert default Super Admin (Password should be hashed using bcrypt in production)
INSERT INTO super_admins (id, full_name, email, password_hash, role)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Yeezy Super Admin',
    'superadmin@yeezyloyalty.com',
    '$2a$12$K8yR2u3V2GvC.wX1g3j7nOZ0NqkHl.L4W4L8Y1G6I3h8g5o3K8K2y', -- demo hash
    'SUPER_ADMIN'
) ON CONFLICT (email) DO NOTHING;
