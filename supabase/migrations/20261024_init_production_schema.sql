-- ============================================================================
-- YEEZY LOYALTY PLATFORM: PRODUCTION MULTI-TENANT SCHEMA & RPC ENGINE
-- Target: PostgreSQL 15+ / Supabase (with Strict Row-Level Security)
-- 
-- Rules:
-- 1. All money in integer paise (₹1 = 100 paise). Points are integers.
-- 2. Two-phase redemption: reserve (15m TTL) -> commit / release.
-- 3. Available balance = sum(ledger.remaining) - sum(active reservations).
-- 4. Shared-store rate limiting via rate_limit_buckets.
-- 5. RPC functions run with SECURITY DEFINER, search_path = public, pg_temp.
-- 6. RPC functions granted ONLY to service_role; revoked from public/anon/authenticated.
-- 7. RLS enabled on every table in this same migration.
-- ============================================================================

-- Extensions (optional in PG13+ as gen_random_uuid is native)
DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Ensure Supabase roles exist for portable execution across local and managed instances
DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
END $$;

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

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

DO $$ BEGIN
    CREATE TYPE redemption_reservation_status AS ENUM (
        'reserved',
        'committed',
        'released',
        'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- Clean up empty prototype tables if present from earlier experiments
DROP TABLE IF EXISTS public.loyalty_redemption_sessions CASCADE;
DROP TABLE IF EXISTS public.loyalty_ledger_transactions CASCADE;
DROP TABLE IF EXISTS public.loyalty_tiers CASCADE;
DROP TABLE IF EXISTS public.loyalty_programs CASCADE;

-- 2.1 LOYALTY PROGRAMS (One per restaurant tenant)
CREATE TABLE IF NOT EXISTS public.loyalty_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL UNIQUE,
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
        "winback": {
            "enabled": true,
            "inactive_days": 21,
            "multiplier": 2.0,
            "valid_days": 7
        },
        "guardrail": {
            "max_effective_earn_rate_bps": 800
        }
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 LOYALTY MEMBERS
CREATE TABLE IF NOT EXISTS public.loyalty_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    phone_e164 VARCHAR(20) NOT NULL,
    name TEXT,
    tier VARCHAR(32) NOT NULL DEFAULT 'Silver',
    visit_count INT NOT NULL DEFAULT 0,
    lifetime_spend_paise BIGINT NOT NULL DEFAULT 0,
    last_visit_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    referred_by_member_id UUID REFERENCES public.loyalty_members(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_loyalty_members_restaurant_phone UNIQUE (restaurant_id, phone_e164)
);

-- 2.3 LOYALTY LEDGER (Strictly Append-Only)
CREATE TABLE IF NOT EXISTS public.loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE RESTRICT,
    order_id VARCHAR(128),
    type loyalty_ledger_entry_type NOT NULL,
    points INT NOT NULL,
    remaining INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 REDEMPTION RESERVATIONS (Two-Phase Redemption with 15-min TTL)
CREATE TABLE IF NOT EXISTS public.redemption_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE RESTRICT,
    phone_e164 VARCHAR(20) NOT NULL,
    points INT NOT NULL CHECK (points > 0),
    discount_paise BIGINT NOT NULL CHECK (discount_paise > 0),
    bill_amount_paise BIGINT NOT NULL CHECK (bill_amount_paise > 0),
    status redemption_reservation_status NOT NULL DEFAULT 'reserved',
    expires_at TIMESTAMPTZ NOT NULL,
    committed_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    order_id VARCHAR(128),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 API KEYS (Cryptographic SHA-256 Storage, Show Once)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    name VARCHAR(128) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    last4 VARCHAR(4) NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT ARRAY['customers:read', 'customers:write', 'points:earn', 'points:redeem']::TEXT[],
    is_test BOOLEAN NOT NULL DEFAULT false,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 IDEMPOTENCY KEYS (Shared Postgres Table for Replay Protection)
CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    idempotency_key VARCHAR(256) NOT NULL,
    request_path VARCHAR(256) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_idempotency_restaurant_key UNIQUE (restaurant_id, idempotency_key)
);

-- 2.7 RATE LIMIT BUCKETS (Shared Token Bucket)
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
    bucket_key VARCHAR(128) PRIMARY KEY,
    tokens NUMERIC NOT NULL,
    last_refill_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.8 AUDIT LOG
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(128),
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64),
    entity_id VARCHAR(128),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.9 MULTIPLIER RULES & REFERRALS
CREATE TABLE IF NOT EXISTS public.loyalty_multiplier_rules (
    id VARCHAR(64) NOT NULL,
    restaurant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    start_time TIME,
    end_time TIME,
    days_of_week INT[],
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (restaurant_id, id)
);

CREATE TABLE IF NOT EXISTS public.loyalty_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    referrer_member_id UUID NOT NULL REFERENCES public.loyalty_members(id),
    referee_member_id UUID NOT NULL REFERENCES public.loyalty_members(id),
    referral_code VARCHAR(32) NOT NULL,
    status loyalty_referral_status NOT NULL DEFAULT 'pending',
    qualifying_order_id VARCHAR(128),
    qualifying_bill_paise BIGINT,
    qualified_at TIMESTAMPTZ,
    referrer_reward_points INT NOT NULL DEFAULT 0,
    referee_reward_points INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Idempotency unique partial index on ledger
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_ledger_order_type 
ON public.loyalty_ledger (restaurant_id, order_id, type) 
WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_members_phone 
ON public.loyalty_members (restaurant_id, phone_e164);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_history 
ON public.loyalty_ledger (restaurant_id, member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_fifo_expiry 
ON public.loyalty_ledger (restaurant_id, member_id, expires_at) 
WHERE remaining > 0;

CREATE INDEX IF NOT EXISTS idx_redemptions_active 
ON public.redemption_reservations (restaurant_id, member_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_redemptions_expiry_scan 
ON public.redemption_reservations (expires_at) 
WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_api_keys_hash 
ON public.api_keys (key_hash) 
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup 
ON public.idempotency_keys (restaurant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_audit_log_restaurant 
ON public.audit_log (restaurant_id, created_at DESC);

-- ============================================================================
-- 4. ROW-LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_multiplier_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_referrals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_restaurant_id() RETURNS TEXT AS $$
    SELECT NULLIF(current_setting('app.current_restaurant_id', true), '');
$$ LANGUAGE sql STABLE;

-- Tenant Isolation Policies
DO $$ BEGIN
    CREATE POLICY tenant_isolation_loyalty_programs ON public.loyalty_programs
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_loyalty_members ON public.loyalty_members
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_loyalty_ledger ON public.loyalty_ledger
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_redemption_reservations ON public.redemption_reservations
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_api_keys ON public.api_keys
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_idempotency_keys ON public.idempotency_keys
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_audit_log ON public.audit_log
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================================
-- 5. RPC STORED PROCEDURES (Atomic Row-Locked Point Operations)
-- ============================================================================

-- 5.1 Helper: Calculate Available Balance Subtracting Active Reservations
CREATE OR REPLACE FUNCTION public.fn_loyalty_get_available_balance(
    p_restaurant_id TEXT,
    p_member_id UUID
) RETURNS INT AS $$
DECLARE
    v_total_points INT := 0;
    v_active_reserved INT := 0;
BEGIN
    -- Sum of unexpired remaining points from ledger
    SELECT COALESCE(SUM(remaining), 0) INTO v_total_points
    FROM public.loyalty_ledger
    WHERE restaurant_id = p_restaurant_id
      AND member_id = p_member_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > NOW());

    -- Sum of active reservations holding points
    SELECT COALESCE(SUM(points), 0) INTO v_active_reserved
    FROM public.redemption_reservations
    WHERE restaurant_id = p_restaurant_id
      AND member_id = p_member_id
      AND status = 'reserved'
      AND expires_at > NOW();

    RETURN GREATEST(0, v_total_points - v_active_reserved);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.2 Two-Phase Redemption: Reserve Points (15-min TTL)
CREATE OR REPLACE FUNCTION public.fn_loyalty_reserve_points(
    p_restaurant_id TEXT,
    p_phone TEXT,
    p_points INT,
    p_bill_paise BIGINT,
    p_ttl_seconds INT DEFAULT 900
) RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
    v_program_config JSONB;
    v_is_active BOOLEAN;
    v_min_points INT;
    v_min_bill BIGINT;
    v_max_pct NUMERIC;
    v_point_val INT;
    v_available_pts INT;
    v_max_redeem_pts INT;
    v_points_to_reserve INT;
    v_discount_paise BIGINT;
    v_reservation_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Row-lock member row to prevent concurrent race conditions
    SELECT id INTO v_member_id
    FROM public.loyalty_members
    WHERE restaurant_id = p_restaurant_id AND phone_e164 = p_phone
    FOR UPDATE;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'MEMBER_NOT_FOUND', 'message', 'Member not found for phone'));
    END IF;

    -- 2. Fetch program configuration
    SELECT is_active, config INTO v_is_active, v_program_config
    FROM public.loyalty_programs
    WHERE restaurant_id = p_restaurant_id;

    IF v_is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'PROGRAM_INACTIVE', 'message', 'Loyalty program is not active for this restaurant'));
    END IF;

    v_min_points := COALESCE((v_program_config->'redeem'->>'min_points')::INT, 50);
    v_min_bill := COALESCE((v_program_config->'redeem'->>'min_bill_paise')::BIGINT, 30000);
    v_max_pct := COALESCE((v_program_config->'redeem'->>'max_percent_of_bill')::NUMERIC, 20);
    v_point_val := COALESCE((v_program_config->>'point_value_paise')::INT, 100);

    -- 3. Verify minimum bill requirement
    IF p_bill_paise < v_min_bill THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'MIN_BILL_NOT_MET', 'message', format('Minimum bill of ₹%s required to redeem points', v_min_bill / 100)));
    END IF;

    -- 4. Calculate available balance subtracting active reservations
    v_available_pts := public.fn_loyalty_get_available_balance(p_restaurant_id, v_member_id);

    IF v_available_pts < v_min_points THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'BELOW_MIN_POINTS', 'message', format('Minimum %s points required to redeem', v_min_points)));
    END IF;

    -- 5. Calculate maximum allowable discount on this bill
    v_max_redeem_pts := FLOOR((p_bill_paise * (v_max_pct / 100.0)) / v_point_val)::INT;
    v_points_to_reserve := LEAST(p_points, v_available_pts, v_max_redeem_pts);

    IF v_points_to_reserve <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'EXCEEDS_MAX_REDEEM_PERCENT', 'message', 'Requested points exceed allowed redemption cap for bill'));
    END IF;

    v_discount_paise := v_points_to_reserve * v_point_val;
    v_expires_at := NOW() + (p_ttl_seconds || ' seconds')::INTERVAL;
    v_reservation_id := gen_random_uuid();

    -- 6. Insert reservation hold
    INSERT INTO public.redemption_reservations (
        id, restaurant_id, member_id, phone_e164, points, discount_paise, bill_amount_paise, status, expires_at
    ) VALUES (
        v_reservation_id, p_restaurant_id, v_member_id, p_phone, v_points_to_reserve, v_discount_paise, p_bill_paise, 'reserved', v_expires_at
    );

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'points_reserved', v_points_to_reserve,
        'discount_paise', v_discount_paise,
        'discount_inr', v_discount_paise / 100,
        'remaining_available_balance', v_available_pts - v_points_to_reserve,
        'expires_at', v_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.3 Commit Points Redemption (Idempotent with 24h Expiration Grace Support)
CREATE OR REPLACE FUNCTION public.fn_loyalty_commit_points(
    p_restaurant_id TEXT,
    p_reservation_id UUID,
    p_order_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_res RECORD;
    v_pts_needed INT;
    v_cur_ledger RECORD;
    v_take INT;
    v_remaining_balance INT;
BEGIN
    -- 1. Row-lock reservation
    SELECT * INTO v_res
    FROM public.redemption_reservations
    WHERE id = p_reservation_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF v_res IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_NOT_FOUND', 'message', 'Reservation ID not found'));
    END IF;

    -- 2. Idempotency Check: Already committed
    IF v_res.status = 'committed' THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'reservation_id', v_res.id,
            'order_id', v_res.order_id,
            'redeemed_points', v_res.points,
            'discount_paise', v_res.discount_paise
        );
    END IF;

    -- 3. Release check
    IF v_res.status = 'released' THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_RELEASED', 'message', 'Reservation was already released'));
    END IF;

    -- 4. Expiry Check with 24-Hour Settlement Grace Window
    IF v_res.expires_at < NOW() THEN
        -- If expired more than 24 hours ago, strictly reject
        IF v_res.expires_at < (NOW() - interval '24 hours') THEN
            UPDATE public.redemption_reservations SET status = 'expired', updated_at = NOW() WHERE id = v_res.id;
            RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_EXPIRED', 'message', 'Reservation has expired past the 24-hour settlement grace window'));
        END IF;

        -- Check if member still has enough available points
        IF public.fn_loyalty_get_available_balance(p_restaurant_id, v_res.member_id) < v_res.points THEN
            UPDATE public.redemption_reservations SET status = 'expired', updated_at = NOW() WHERE id = v_res.id;
            RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_EXPIRED', 'message', 'Reservation expired and points are no longer available in member balance'));
        END IF;
    END IF;

    -- 5. Row-lock member
    PERFORM id FROM public.loyalty_members WHERE id = v_res.member_id FOR UPDATE;

    -- 6. FIFO Ledger Deduction
    v_pts_needed := v_res.points;
    FOR v_cur_ledger IN
        SELECT id, remaining
        FROM public.loyalty_ledger
        WHERE restaurant_id = p_restaurant_id
          AND member_id = v_res.member_id
          AND remaining > 0
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at ASC
        FOR UPDATE
    LOOP
        v_take := LEAST(v_pts_needed, v_cur_ledger.remaining);
        UPDATE public.loyalty_ledger SET remaining = remaining - v_take WHERE id = v_cur_ledger.id;
        v_pts_needed := v_pts_needed - v_take;
        EXIT WHEN v_pts_needed <= 0;
    END LOOP;

    -- 7. Append negative redemption row to ledger
    INSERT INTO public.loyalty_ledger (
        restaurant_id, member_id, order_id, type, points, remaining, expires_at, meta
    ) VALUES (
        p_restaurant_id, v_res.member_id, p_order_id, 'redeem', -v_res.points, 0, NULL,
        jsonb_build_object('reservation_id', v_res.id, 'discount_paise', v_res.discount_paise, 'bill_amount_paise', v_res.bill_amount_paise)
    );

    -- 8. Finalize reservation
    UPDATE public.redemption_reservations
    SET status = 'committed',
        order_id = p_order_id,
        committed_at = NOW(),
        updated_at = NOW()
    WHERE id = v_res.id;

    v_remaining_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_res.member_id);

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_res.id,
        'order_id', p_order_id,
        'redeemed_points', v_res.points,
        'discount_paise', v_res.discount_paise,
        'new_balance', v_remaining_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.4 Release Points Reservation
CREATE OR REPLACE FUNCTION public.fn_loyalty_release_points(
    p_restaurant_id TEXT,
    p_reservation_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_res RECORD;
BEGIN
    SELECT * INTO v_res
    FROM public.redemption_reservations
    WHERE id = p_reservation_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    IF v_res IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_NOT_FOUND', 'message', 'Reservation not found'));
    END IF;

    IF v_res.status = 'released' THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'released');
    END IF;

    IF v_res.status = 'committed' THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'CANNOT_RELEASE_COMMITTED', 'message', 'Cannot release an already committed reservation. Use refund endpoint instead.'));
    END IF;

    UPDATE public.redemption_reservations
    SET status = 'released', released_at = NOW(), updated_at = NOW()
    WHERE id = v_res.id;

    RETURN jsonb_build_object('success', true, 'reservation_id', v_res.id, 'status', 'released');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.5 Earn Points on Order Settlement (Idempotent per order_id)
CREATE OR REPLACE FUNCTION public.fn_loyalty_earn_points(
    p_restaurant_id TEXT,
    p_order_id TEXT,
    p_phone TEXT,
    p_subtotal_paise BIGINT,
    p_order_type TEXT DEFAULT 'dine_in',
    p_reservation_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_member RECORD;
    v_program RECORD;
    v_base_bps INT;
    v_points_expiry_days INT;
    v_tier_multiplier NUMERIC := 1.0;
    v_base_points INT;
    v_total_earned INT := 0;
    v_ledger_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_new_visits INT;
    v_new_spend BIGINT;
    v_new_tier VARCHAR(32);
    v_new_balance INT;
    v_reservation_result JSONB;
BEGIN
    -- 1. If reservation_id is provided, commit it first
    IF p_reservation_id IS NOT NULL THEN
        v_reservation_result := public.fn_loyalty_commit_points(p_restaurant_id, p_reservation_id, p_order_id);
    END IF;

    -- 2. Idempotency Check: Already earned for this order
    SELECT * INTO v_member
    FROM public.loyalty_ledger
    WHERE restaurant_id = p_restaurant_id AND order_id = p_order_id AND type = 'earn_base'
    LIMIT 1;

    IF v_member.id IS NOT NULL THEN
        SELECT * INTO v_member FROM public.loyalty_members WHERE id = v_member.member_id;
        v_new_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_member.id);
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'order_id', p_order_id,
            'points_earned', v_member.points,
            'new_balance', v_new_balance,
            'tier', v_member.tier
        );
    END IF;

    -- 3. Row-lock or get member
    SELECT * INTO v_member
    FROM public.loyalty_members
    WHERE restaurant_id = p_restaurant_id AND phone_e164 = p_phone
    FOR UPDATE;

    IF v_member.id IS NULL THEN
        INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
        VALUES (p_restaurant_id, p_phone, 'Guest', 'Silver')
        RETURNING * INTO v_member;
    END IF;

    -- 4. Program Configuration
    SELECT * INTO v_program FROM public.loyalty_programs WHERE restaurant_id = p_restaurant_id;
    v_base_bps := COALESCE((v_program.config->'earn'->>'base_rate_bps')::INT, 500);
    v_points_expiry_days := COALESCE((v_program.config->'earn'->>'points_expiry_days')::INT, 90);

    -- Tier Multiplier
    IF v_member.tier = 'Gold' THEN
        v_tier_multiplier := 1.25;
    ELSIF v_member.tier = 'Platinum' THEN
        v_tier_multiplier := 1.5;
    ELSE
        v_tier_multiplier := 1.0;
    END IF;

    -- 5. Compute Points
    v_base_points := FLOOR(((p_subtotal_paise / 100.0) * (v_base_bps / 10000.0)) * v_tier_multiplier)::INT;
    v_total_earned := v_base_points;
    v_expires_at := NOW() + (v_points_expiry_days || ' days')::INTERVAL;

    -- 6. Insert Append-Only Ledger Entry
    INSERT INTO public.loyalty_ledger (
        restaurant_id, member_id, order_id, type, points, remaining, expires_at, meta
    ) VALUES (
        p_restaurant_id, v_member.id, p_order_id, 'earn_base', v_total_earned, v_total_earned, v_expires_at,
        jsonb_build_object('subtotal_paise', p_subtotal_paise, 'order_type', p_order_type, 'tier_at_time', v_member.tier)
    ) RETURNING id INTO v_ledger_id;

    -- 7. Update Member Profile
    v_new_visits := v_member.visit_count + 1;
    v_new_spend := v_member.lifetime_spend_paise + p_subtotal_paise;

    -- Tier evaluation
    IF v_new_visits >= 12 THEN
        v_new_tier := 'Platinum';
    ELSIF v_new_visits >= 5 THEN
        v_new_tier := 'Gold';
    ELSE
        v_new_tier := 'Silver';
    END IF;

    UPDATE public.loyalty_members
    SET visit_count = v_new_visits,
        lifetime_spend_paise = v_new_spend,
        last_visit_at = NOW(),
        tier = v_new_tier,
        updated_at = NOW()
    WHERE id = v_member.id;

    v_new_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_member.id);

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'points_earned', v_total_earned,
        'new_balance', v_new_balance,
        'tier', v_new_tier,
        'visit_count', v_new_visits
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.6 Shared-Store Token Bucket Rate Limiter
CREATE OR REPLACE FUNCTION public.fn_check_rate_limit(
    p_key TEXT,
    p_cost INT DEFAULT 1,
    p_capacity INT DEFAULT 60,
    p_refill_per_sec NUMERIC DEFAULT 1.0
) RETURNS JSONB AS $$
DECLARE
    v_bucket RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_elapsed_sec NUMERIC;
    v_refill_tokens NUMERIC;
    v_new_tokens NUMERIC;
    v_allowed BOOLEAN := false;
    v_retry_after INT := 0;
BEGIN
    SELECT * INTO v_bucket
    FROM public.rate_limit_buckets
    WHERE bucket_key = p_key
    FOR UPDATE;

    IF v_bucket IS NULL THEN
        v_new_tokens := GREATEST(0, p_capacity - p_cost);
        INSERT INTO public.rate_limit_buckets (bucket_key, tokens, last_refill_at, updated_at)
        VALUES (p_key, v_new_tokens, v_now, v_now);
        RETURN jsonb_build_object('allowed', true, 'remaining', v_new_tokens);
    END IF;

    -- Calculate token refill
    v_elapsed_sec := EXTRACT(EPOCH FROM (v_now - v_bucket.last_refill_at));
    v_refill_tokens := v_elapsed_sec * p_refill_per_sec;
    v_new_tokens := LEAST(p_capacity::NUMERIC, v_bucket.tokens + v_refill_tokens);

    IF v_new_tokens >= p_cost THEN
        v_new_tokens := v_new_tokens - p_cost;
        v_allowed := true;
    ELSE
        v_allowed := false;
        v_retry_after := CEIL((p_cost - v_new_tokens) / p_refill_per_sec)::INT;
    END IF;

    UPDATE public.rate_limit_buckets
    SET tokens = v_new_tokens, last_refill_at = v_now, updated_at = v_now
    WHERE bucket_key = p_key;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'remaining', FLOOR(v_new_tokens)::INT,
        'retry_after', v_retry_after
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5.7 Scheduled Job: Expire Stale Reservations
CREATE OR REPLACE FUNCTION public.fn_expire_stale_reservations() RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    UPDATE public.redemption_reservations
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'reserved' AND expires_at < NOW();
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- ============================================================================
-- 6. STRICT PERMISSIONS (Revoke from Public, Grant ONLY to service_role)
-- ============================================================================

REVOKE ALL ON FUNCTION public.fn_loyalty_get_available_balance(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_get_available_balance(TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.fn_loyalty_reserve_points(TEXT, TEXT, INT, BIGINT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_reserve_points(TEXT, TEXT, INT, BIGINT, INT) TO service_role;

REVOKE ALL ON FUNCTION public.fn_loyalty_commit_points(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_commit_points(TEXT, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fn_loyalty_release_points(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_release_points(TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.fn_loyalty_earn_points(TEXT, TEXT, TEXT, BIGINT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_earn_points(TEXT, TEXT, TEXT, BIGINT, TEXT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.fn_check_rate_limit(TEXT, INT, INT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_rate_limit(TEXT, INT, INT, NUMERIC) TO service_role;

REVOKE ALL ON FUNCTION public.fn_expire_stale_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_stale_reservations() TO service_role;
