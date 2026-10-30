-- ============================================================================
-- PETPOOJA POS LOYALTY INTEGRATION SCHEMA
-- Migration: 20261030_petpooja_schema.sql
-- Target: PostgreSQL 15+ / Supabase
--
-- Amendments from Integration Readiness Report Section 6.1:
-- 1. outlets: eatery_branch_code, otp_required, ignore_aggregators. No per-outlet token.
-- 2. petpooja_rewards: petpooja_reward_id BIGINT GENERATED ALWAYS AS IDENTITY.
--    Enforces pos_item_id when discount_type = 3 (Free Item).
-- 3. petpooja_redemptions: support for kind ('REWARD', 'CASHBACK'), status lifecycle,
--    otp tracking, 3-hour hold TTL (expires_at default NOW() + 3 hours),
--    partial unique index on (outlet_id, invoice_no) for active bills.
-- 4. orders: ensure table and UNIQUE (outlet_id, pos_order_id) for POS idempotency.
-- 5. webhook_logs: extend with outlet_id and endpoint.
-- 6. RLS: enabled on all new tables. Note: service_role client used by backend
--    bypasses RLS, so tenant isolation relies strictly on the adapter resolving
--    restaurant_id from the outlet mapped via eateryBranchCode, never from client payload.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. OUTLETS EXTENSIONS
-- ----------------------------------------------------------------------------
ALTER TABLE public.outlets 
    ADD COLUMN IF NOT EXISTS eatery_branch_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS otp_required BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ignore_aggregators BOOLEAN NOT NULL DEFAULT true;

-- Unique routing index per Petpooja branch code
CREATE UNIQUE INDEX IF NOT EXISTS uq_outlets_petpooja_branch 
    ON public.outlets (eatery_branch_code) 
    WHERE pos_system = 'PETPOOJA' AND eatery_branch_code IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. PETPOOJA REWARDS CATALOG
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.petpooja_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Petpooja's 'reward_points' identifier on POS is integer-based
    petpooja_reward_id BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    restaurant_id TEXT NOT NULL,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    points_required INT NOT NULL CHECK (points_required > 0),
    discount_type INT NOT NULL CHECK (discount_type IN (1, 2, 3)), -- 1=percent, 2=fixed, 3=free item
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,              -- e.g. 15.00 (%) or 100.00 (₹)
    pos_item_id VARCHAR(64),                                      -- Petpooja Item Menu ID (mandatory for type 3)
    min_bill_amount_paise BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Enforce that discount_type = 3 (Free Item) MUST have a valid pos_item_id
    CONSTRAINT chk_free_item_pos_item_id CHECK (
        discount_type != 3 OR (pos_item_id IS NOT NULL AND length(trim(pos_item_id)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_petpooja_rewards_tenant 
    ON public.petpooja_rewards (restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_petpooja_rewards_outlet 
    ON public.petpooja_rewards (outlet_id) 
    WHERE outlet_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 3. PETPOOJA REDEMPTIONS & PRE-ORDER STAGING
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.petpooja_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE RESTRICT,
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE RESTRICT,
    phone_e164 VARCHAR(20) NOT NULL,
    invoice_no VARCHAR(128) NOT NULL,
    kind VARCHAR(16) NOT NULL CHECK (kind IN ('REWARD', 'CASHBACK')),
    status VARCHAR(32) NOT NULL DEFAULT 'HELD' CHECK (status IN ('PENDING_OTP', 'HELD', 'SETTLED', 'EXPIRED_RELEASED', 'CANCELLED')),
    reward_id BIGINT,                                             -- Refers to petpooja_reward_id when kind = 'REWARD'
    points_burned INT NOT NULL CHECK (points_burned >= 0),
    discount_amount_paise BIGINT NOT NULL DEFAULT 0,
    reward_name VARCHAR(256),
    reservation_id UUID REFERENCES public.redemption_reservations(id) ON DELETE SET NULL,
    otp_hash VARCHAR(64),                                         -- SHA-256 hash of OTP
    otp_expires_at TIMESTAMPTZ,
    otp_attempts INT NOT NULL DEFAULT 0,
    otp_sent_count INT NOT NULL DEFAULT 1,
    settled_order_id VARCHAR(128),
    late_settled BOOLEAN NOT NULL DEFAULT false,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Hold TTL defaults to 3 hours to accommodate long table sittings pre-settlement
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 hours')
);

-- Partial unique index ensures at most ONE active redemption hold per bill/invoice
CREATE UNIQUE INDEX IF NOT EXISTS uq_petpooja_active_redemption_bill 
    ON public.petpooja_redemptions (outlet_id, invoice_no) 
    WHERE status IN ('PENDING_OTP', 'HELD');

-- Index for the background/lazy expiration sweep of orphaned holds
CREATE INDEX IF NOT EXISTS idx_petpooja_redemptions_expiry_sweep 
    ON public.petpooja_redemptions (expires_at) 
    WHERE status = 'HELD';

CREATE INDEX IF NOT EXISTS idx_petpooja_redemptions_lookup 
    ON public.petpooja_redemptions (outlet_id, invoice_no, status);
CREATE INDEX IF NOT EXISTS idx_petpooja_redemptions_member 
    ON public.petpooja_redemptions (restaurant_id, member_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- 4. ORDERS TABLE & POS IDEMPOTENCY
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT,
    tenant_id TEXT,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
    customer_id UUID,
    pos_system VARCHAR(32) NOT NULL DEFAULT 'PETPOOJA',
    pos_order_id VARCHAR(128),
    pos_bill_no VARCHAR(128),
    table_no VARCHAR(50),
    server_name VARCHAR(100),
    order_type VARCHAR(50) DEFAULT 'DINE_IN',
    subtotal_amount NUMERIC(12, 2) DEFAULT 0,
    tax_amount NUMERIC(12, 2) DEFAULT 0,
    service_charge NUMERIC(12, 2) DEFAULT 0,
    gross_bill_amount NUMERIC(12, 2) DEFAULT 0,
    loyalty_discount_amount NUMERIC(12, 2) DEFAULT 0,
    total_discount_amount NUMERIC(12, 2) DEFAULT 0,
    net_payable_amount NUMERIC(12, 2) DEFAULT 0,
    points_earned_on_bill INT DEFAULT 0,
    points_redeemed_on_bill INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'PAID_SETTLED',
    pos_created_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all required columns exist if orders table was initialized in an earlier script
DO $$ BEGIN
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS restaurant_id TEXT;
    UPDATE public.orders SET restaurant_id = tenant_id::text WHERE restaurant_id IS NULL AND tenant_id IS NOT NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id);
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_order_id VARCHAR(128);
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_bill_no VARCHAR(128);
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pos_system VARCHAR(32) DEFAULT 'PETPOOJA';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Idempotency constraint: identical POS order ID at the same outlet must never be duplicated
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_outlet_pos_order_id 
    ON public.orders (outlet_id, pos_order_id) 
    WHERE outlet_id IS NOT NULL AND pos_order_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 5. WEBHOOK LOGS EXTENSIONS
-- ----------------------------------------------------------------------------
-- NOTE: Security requirement: Sensitive payload fields like 'token' and 'otp'
-- MUST be redacted by application code before insertion into webhook_logs.
DO $$ BEGIN
    ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES public.outlets(id);
    ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS endpoint VARCHAR(128);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_outlet_endpoint 
    ON public.webhook_logs (outlet_id, endpoint, created_at DESC) 
    WHERE outlet_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
-- Security Note:
-- The backend Express application queries Supabase using supabaseAdmin with the
-- 'service_role' secret, which by design bypasses Row Level Security.
-- Strict tenant isolation therefore relies upon the integration adapter resolving
-- the trusted restaurant_id from the database outlet record mapped via eateryBranchCode,
-- and NEVER trusting or accepting a restaurant_id passed directly in the client payload.

ALTER TABLE public.petpooja_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petpooja_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_petpooja_rewards ON public.petpooja_rewards
        FOR ALL USING (
            restaurant_id = public.current_restaurant_id() 
            OR current_setting('role', true) = 'service_role'
        );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_petpooja_redemptions ON public.petpooja_redemptions
        FOR ALL USING (
            restaurant_id = public.current_restaurant_id() 
            OR current_setting('role', true) = 'service_role'
        );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_orders ON public.orders
        FOR ALL USING (
            restaurant_id = public.current_restaurant_id() 
            OR tenant_id::text = public.current_restaurant_id() 
            OR current_setting('role', true) = 'service_role'
        );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================================
-- ROLLBACK SECTION (Commented for audit and rollback operations)
-- ============================================================================
/*
-- 1. Drop RLS Policies
DROP POLICY IF EXISTS tenant_isolation_orders ON public.orders;
DROP POLICY IF EXISTS tenant_isolation_petpooja_redemptions ON public.petpooja_redemptions;
DROP POLICY IF EXISTS tenant_isolation_petpooja_rewards ON public.petpooja_rewards;

-- 2. Drop Webhook Log extensions
DROP INDEX IF EXISTS public.idx_webhook_logs_outlet_endpoint;
ALTER TABLE public.webhook_logs DROP COLUMN IF EXISTS endpoint;
ALTER TABLE public.webhook_logs DROP COLUMN IF EXISTS outlet_id;

-- 3. Drop Orders Idempotency & Table (if exclusively created for Petpooja)
DROP INDEX IF EXISTS public.uq_orders_outlet_pos_order_id;

-- 4. Drop Redemptions Table & Indexes
DROP INDEX IF EXISTS public.idx_petpooja_redemptions_member;
DROP INDEX IF EXISTS public.idx_petpooja_redemptions_lookup;
DROP INDEX IF EXISTS public.idx_petpooja_redemptions_expiry_sweep;
DROP INDEX IF EXISTS public.uq_petpooja_active_redemption_bill;
DROP TABLE IF EXISTS public.petpooja_redemptions CASCADE;

-- 5. Drop Rewards Catalog Table & Indexes
DROP INDEX IF EXISTS public.idx_petpooja_rewards_outlet;
DROP INDEX IF EXISTS public.idx_petpooja_rewards_tenant;
DROP TABLE IF EXISTS public.petpooja_rewards CASCADE;

-- 6. Drop Outlets Extensions
DROP INDEX IF EXISTS public.uq_outlets_petpooja_branch;
ALTER TABLE public.outlets DROP COLUMN IF EXISTS ignore_aggregators;
ALTER TABLE public.outlets DROP COLUMN IF EXISTS otp_required;
ALTER TABLE public.outlets DROP COLUMN IF EXISTS eatery_branch_code;
*/
