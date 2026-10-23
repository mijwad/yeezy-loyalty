-- ============================================================================
-- YEEZY LOYALTY PLATFORM: KERALA RESTAURANT MULTI-TENANT LOYALTY SPEC MIGRATION
-- Compatible with PostgreSQL 14+ / Supabase (with Row-Level Security)
-- All money amounts in integer paise (₹1 = 100 paise).
-- Phone numbers in E.164 (+91 standard).
-- Append-only ledger with FIFO expiry tracking.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE loyalty_ledger_entry_type AS ENUM (
        'earn_base',
        'earn_bonus_big_bill',
        'earn_bonus_streak',
        'earn_referral',
        'earn_birthday',
        'earn_review',
        'earn_winback',
        'redeem',
        'expire',
        'reversal',
        'manual_adjust'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE loyalty_referral_status AS ENUM (
        'pending',
        'qualified',
        'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. LOYALTY PROGRAMS (One per restaurant)
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{
        "point_value_paise": 100,
        "earn": {
            "base_rate_bps": 500,
            "eligible_amount": "subtotal_after_discount_excl_tax_and_service_charge",
            "big_bill": { "enabled": true, "threshold_paise": 50000, "bonus_points": 25 },
            "streak": { "enabled": true, "within_days": 7, "bonus_points": 10 },
            "bonus_points_expiry_days": 30,
            "points_expiry_days": 90
        },
        "tiers": [
            { "name": "Silver", "min_visits": 0, "multiplier": 1.0 },
            { "name": "Gold", "min_visits": 5, "multiplier": 1.25 },
            { "name": "Platinum", "min_visits": 12, "multiplier": 1.5 }
        ],
        "redeem": {
            "min_points": 50,
            "min_bill_paise": 30000,
            "max_percent_of_bill": 20,
            "stackable_with_discounts": false,
            "allowed_order_types": ["dine_in", "takeaway"]
        },
        "referral": {
            "enabled": true,
            "referrer_points": 50,
            "referee_points": 50,
            "qualify_min_first_bill_paise": 30000,
            "max_referrals_per_month": 10
        },
        "winback": { "enabled": true, "inactive_days": 21, "multiplier": 2.0, "valid_days": 7 },
        "guardrail": { "max_effective_earn_rate_bps": 800 }
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_loyalty_programs_restaurant UNIQUE (restaurant_id)
);

-- 3. LOYALTY MEMBERS
CREATE TABLE IF NOT EXISTS public.loyalty_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    phone_e164 VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Valued Guest',
    tier VARCHAR(64) NOT NULL DEFAULT 'Silver',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_visit_at TIMESTAMPTZ NULL,
    visit_count INT NOT NULL DEFAULT 0,
    lifetime_spend_paise BIGINT NOT NULL DEFAULT 0,
    referred_by_member_id UUID NULL REFERENCES public.loyalty_members(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_loyalty_members_restaurant_phone UNIQUE (restaurant_id, phone_e164)
);

-- 4. LOYALTY LEDGER (Append-only)
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
    order_id VARCHAR(128) NULL,
    type loyalty_ledger_entry_type NOT NULL,
    points INT NOT NULL,
    remaining INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NULL,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Partial unique constraint: Every earn/redeem is idempotent per order_id and type
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_ledger_order_type 
ON public.loyalty_ledger (restaurant_id, order_id, type) 
WHERE order_id IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_member ON public.loyalty_ledger (member_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_expiry ON public.loyalty_ledger (expires_at) WHERE remaining > 0;
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_restaurant ON public.loyalty_ledger (restaurant_id);

-- 5. LOYALTY REFERRALS
CREATE TABLE IF NOT EXISTS public.loyalty_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    referrer_member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
    referee_member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
    status loyalty_referral_status NOT NULL DEFAULT 'pending',
    qualified_order_id VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_loyalty_referrals_referee UNIQUE (restaurant_id, referee_member_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_referrals_referrer ON public.loyalty_referrals (restaurant_id, referrer_member_id, status);

-- 6. MULTIPLIER RULES (Slow-Slot / Kerala Festivals like Onam, Eid, Vishu)
CREATE TABLE IF NOT EXISTS public.loyalty_multiplier_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    name VARCHAR(255) NOT NULL,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    days_of_week INT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
    start_time TIME NOT NULL DEFAULT '00:00:00',
    end_time TIME NOT NULL DEFAULT '23:59:59',
    start_date DATE NULL,
    end_date DATE NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_loyalty_multiplier_rules_restaurant ON public.loyalty_multiplier_rules (restaurant_id, is_active);

-- 7. CAMPAIGN LOG (Win-Back / WhatsApp Reminders)
CREATE TABLE IF NOT EXISTS public.loyalty_campaign_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    channel VARCHAR(32) NOT NULL DEFAULT 'WHATSAPP',
    converted_order_id VARCHAR(128) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_loyalty_campaign_log_member ON public.loyalty_campaign_log (restaurant_id, member_id, sent_at DESC);

-- ============================================================================
-- 8. ROW-LEVEL SECURITY (RLS) POLICIES
-- Multi-Tenant Security: Restrict queries by restaurant_id
-- ============================================================================

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_multiplier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_campaign_log ENABLE ROW LEVEL SECURITY;

-- Helper policy function: match JWT claim or session tenant header
CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::jsonb ->> 'restaurant_id',
        current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id',
        current_setting('app.current_restaurant_id', true)
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Loyalty Programs RLS
DROP POLICY IF EXISTS "loyalty_programs_tenant_isolation" ON public.loyalty_programs;
CREATE POLICY "loyalty_programs_tenant_isolation" ON public.loyalty_programs
    FOR ALL
    USING (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    )
    WITH CHECK (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    );

-- Loyalty Members RLS
DROP POLICY IF EXISTS "loyalty_members_tenant_isolation" ON public.loyalty_members;
CREATE POLICY "loyalty_members_tenant_isolation" ON public.loyalty_members
    FOR ALL
    USING (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    )
    WITH CHECK (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    );

-- Loyalty Ledger RLS
DROP POLICY IF EXISTS "loyalty_ledger_tenant_isolation" ON public.loyalty_ledger;
CREATE POLICY "loyalty_ledger_tenant_isolation" ON public.loyalty_ledger
    FOR ALL
    USING (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    )
    WITH CHECK (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    );

-- Loyalty Referrals RLS
DROP POLICY IF EXISTS "loyalty_referrals_tenant_isolation" ON public.loyalty_referrals;
CREATE POLICY "loyalty_referrals_tenant_isolation" ON public.loyalty_referrals
    FOR ALL
    USING (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    )
    WITH CHECK (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    );

-- Loyalty Multiplier Rules RLS
DROP POLICY IF EXISTS "loyalty_multiplier_rules_tenant_isolation" ON public.loyalty_multiplier_rules;
CREATE POLICY "loyalty_multiplier_rules_tenant_isolation" ON public.loyalty_multiplier_rules
    FOR ALL
    USING (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    )
    WITH CHECK (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    );

-- Loyalty Campaign Log RLS
DROP POLICY IF EXISTS "loyalty_campaign_log_tenant_isolation" ON public.loyalty_campaign_log;
CREATE POLICY "loyalty_campaign_log_tenant_isolation" ON public.loyalty_campaign_log
    FOR ALL
    USING (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    )
    WITH CHECK (
        restaurant_id = public.current_restaurant_id() 
        OR current_user = 'service_role' 
        OR public.current_restaurant_id() IS NULL
    );
