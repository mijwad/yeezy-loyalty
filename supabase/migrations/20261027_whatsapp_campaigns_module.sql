-- ============================================================================
-- YEEZY LOYALTY PLATFORM: WHATSAPP CAMPAIGN MODULE
-- Target: Supabase / PostgreSQL 15+ with strict Row-Level Security (RLS)
-- Multi-Tenant: All tables strictly scoped by restaurant_id
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. CUSTOMERS TABLE (Create if missing or extend existing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    name TEXT,
    email TEXT,
    whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true,
    opt_in_at TIMESTAMPTZ DEFAULT NOW(),
    opt_out_at TIMESTAMPTZ,
    last_visit_at TIMESTAMPTZ,
    visit_count INT NOT NULL DEFAULT 0,
    total_spend BIGINT NOT NULL DEFAULT 0, -- in integer paise
    birthday DATE,
    anniversary DATE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customers_restaurant_phone UNIQUE (restaurant_id, phone)
);

-- Ensure columns exist on customers if table already existed
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS restaurant_id TEXT;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'tenant_id') THEN
    UPDATE public.customers SET restaurant_id = tenant_id WHERE restaurant_id IS NULL;
  END IF;
END $$;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opt_in_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS last_visit_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS visit_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS total_spend BIGINT NOT NULL DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS anniversary DATE;

CREATE INDEX IF NOT EXISTS idx_customers_restaurant_opt_in ON public.customers (restaurant_id, whatsapp_opt_in, opt_out_at);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_visits ON public.customers (restaurant_id, visit_count, last_visit_at);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_spend ON public.customers (restaurant_id, total_spend DESC);

-- Also add WhatsApp opt-in fields to loyalty_members for bidirectional compatibility
ALTER TABLE public.loyalty_members ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.loyalty_members ADD COLUMN IF NOT EXISTS opt_in_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.loyalty_members ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;

-- ============================================================================
-- 3. WHATSAPP ACCOUNTS (One per restaurant, Meta Embedded Signup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wa_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    phone_number_id VARCHAR(64) NOT NULL,
    waba_id VARCHAR(64) NOT NULL,
    display_phone_number VARCHAR(32),
    verified_name VARCHAR(128),
    access_token TEXT NOT NULL, -- Encrypted at rest
    status VARCHAR(32) NOT NULL DEFAULT 'CONNECTED', -- CONNECTED, DISCONNECTED, RESTRICTED, UNVERIFIED
    quality_rating VARCHAR(32) NOT NULL DEFAULT 'GREEN', -- GREEN, YELLOW, RED, UNKNOWN
    messaging_limit_tier VARCHAR(32) NOT NULL DEFAULT 'TIER_250', -- TIER_250, TIER_1K, TIER_10K, TIER_100K, UNLIMITED
    webhook_secret VARCHAR(128),
    meta_app_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wa_accounts_restaurant UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_wa_accounts_phone_id ON public.wa_accounts (phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wa_accounts_waba_id ON public.wa_accounts (waba_id);

-- ============================================================================
-- 4. WHATSAPP TEMPLATES (Meta Cloud API Message Templates)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.wa_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    name VARCHAR(128) NOT NULL,
    language VARCHAR(16) NOT NULL DEFAULT 'en_US',
    category VARCHAR(32) NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    header_type VARCHAR(16) DEFAULT 'NONE', -- NONE, TEXT, IMAGE, DOCUMENT, VIDEO
    header_text TEXT,
    body TEXT NOT NULL,
    footer_text TEXT,
    buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    variables JSONB NOT NULL DEFAULT '[]'::jsonb, -- e.g. [{"index": 1, "name": "customer_name", "sample": "Rohan"}]
    meta_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (meta_status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED')),
    meta_template_id VARCHAR(128),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wa_templates_restaurant_name_lang UNIQUE (restaurant_id, name, language)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_restaurant_status ON public.wa_templates (restaurant_id, meta_status);

-- ============================================================================
-- 5. SEGMENTS (Audience Segmentation Engine)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_preset BOOLEAN NOT NULL DEFAULT false,
    preset_type VARCHAR(64), -- 'frequent', 'lapsed', 'lost', 'new', 'high_spenders', 'birthday_week', 'custom'
    rules JSONB NOT NULL DEFAULT '{"combinator": "AND", "conditions": []}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_segments_restaurant_name UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_segments_restaurant ON public.segments (restaurant_id);

-- ============================================================================
-- 6. CAMPAIGNS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    name VARCHAR(128) NOT NULL,
    segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,
    template_id UUID NOT NULL REFERENCES public.wa_templates(id) ON DELETE RESTRICT,
    variable_mapping JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"1": "customer.name", "2": "20% OFF", "3": "Sunday"}
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_audience INT NOT NULL DEFAULT 0,
    total_sent INT NOT NULL DEFAULT 0,
    total_delivered INT NOT NULL DEFAULT 0,
    total_read INT NOT NULL DEFAULT 0,
    total_failed INT NOT NULL DEFAULT 0,
    total_opt_outs INT NOT NULL DEFAULT 0,
    total_replies INT NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000, -- In INR
    actual_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    attributed_revenue_paise BIGINT NOT NULL DEFAULT 0, -- 7-day order attribution in paise
    frequency_cap_days INT NOT NULL DEFAULT 7,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_restaurant_status ON public.campaigns (restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON public.campaigns (status, scheduled_at);

-- ============================================================================
-- 7. CAMPAIGN MESSAGES (Delivery Log, Tracking & Attributed Revenue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    phone_e164 VARCHAR(20) NOT NULL,
    wa_message_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed', 'skipped')),
    error_code VARCHAR(64),
    error_message TEXT,
    cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    opt_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_campaign_customer UNIQUE (campaign_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_messages_wa_id ON public.campaign_messages (wa_message_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_customer ON public.campaign_messages (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_status ON public.campaign_messages (campaign_id, status);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- Scoped to restaurant_id for authenticated restaurant users and service_role
-- ============================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;

-- Helper to check tenant permission from JWT
CREATE OR REPLACE FUNCTION public.fn_is_tenant_member(p_restaurant_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT 
        (current_setting('request.jwt.claim.restaurant_id', true) = p_restaurant_id)
        OR (current_setting('request.jwt.claim.tenant_id', true) = p_restaurant_id)
        OR (current_setting('request.jwt.claim.role', true) = 'service_role')
        OR (auth.role() = 'service_role');
$$;

-- RLS: customers
DROP POLICY IF EXISTS rls_customers_tenant ON public.customers;
CREATE POLICY rls_customers_tenant ON public.customers
    FOR ALL
    USING (fn_is_tenant_member(restaurant_id))
    WITH CHECK (fn_is_tenant_member(restaurant_id));

-- RLS: wa_accounts (Sensitive credentials protected)
DROP POLICY IF EXISTS rls_wa_accounts_tenant ON public.wa_accounts;
CREATE POLICY rls_wa_accounts_tenant ON public.wa_accounts
    FOR ALL
    USING (fn_is_tenant_member(restaurant_id))
    WITH CHECK (fn_is_tenant_member(restaurant_id));

-- RLS: wa_templates
DROP POLICY IF EXISTS rls_wa_templates_tenant ON public.wa_templates;
CREATE POLICY rls_wa_templates_tenant ON public.wa_templates
    FOR ALL
    USING (fn_is_tenant_member(restaurant_id))
    WITH CHECK (fn_is_tenant_member(restaurant_id));

-- RLS: segments
DROP POLICY IF EXISTS rls_segments_tenant ON public.segments;
CREATE POLICY rls_segments_tenant ON public.segments
    FOR ALL
    USING (fn_is_tenant_member(restaurant_id))
    WITH CHECK (fn_is_tenant_member(restaurant_id));

-- RLS: campaigns
DROP POLICY IF EXISTS rls_campaigns_tenant ON public.campaigns;
CREATE POLICY rls_campaigns_tenant ON public.campaigns
    FOR ALL
    USING (fn_is_tenant_member(restaurant_id))
    WITH CHECK (fn_is_tenant_member(restaurant_id));

-- RLS: campaign_messages
DROP POLICY IF EXISTS rls_campaign_messages_tenant ON public.campaign_messages;
CREATE POLICY rls_campaign_messages_tenant ON public.campaign_messages
    FOR ALL
    USING (fn_is_tenant_member(restaurant_id))
    WITH CHECK (fn_is_tenant_member(restaurant_id));

-- ============================================================================
-- 9. SEGMENT EVALUATION & AUDIENCE PREVIEW RPC
-- Live query that filters opt-outs and enforces 7-day frequency capping
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_eval_segment_audience(
    p_restaurant_id TEXT,
    p_preset_type TEXT DEFAULT NULL,
    p_custom_rules JSONB DEFAULT NULL,
    p_frequency_cap_days INT DEFAULT 7
)
RETURNS TABLE (
    total_count BIGINT,
    eligible_count BIGINT,
    opted_out_count BIGINT,
    frequency_capped_count BIGINT,
    sample_customers JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_freq_cutoff TIMESTAMPTZ := NOW() - (p_frequency_cap_days || ' days')::INTERVAL;
    v_high_spend_threshold BIGINT := 0;
BEGIN
    -- Determine 90th percentile spend for 'high_spenders'
    IF p_preset_type = 'high_spenders' THEN
        SELECT COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY total_spend), 0)::BIGINT
        INTO v_high_spend_threshold
        FROM public.customers
        WHERE restaurant_id = p_restaurant_id;
    END IF;

    RETURN QUERY
    WITH raw_matches AS (
        SELECT 
            c.id,
            c.name,
            c.phone,
            c.visit_count,
            c.total_spend,
            c.last_visit_at,
            c.whatsapp_opt_in,
            c.opt_out_at,
            -- Check frequency cap: received marketing message within p_frequency_cap_days
            EXISTS (
                SELECT 1 
                FROM public.campaign_messages cm
                WHERE cm.customer_id = c.id
                  AND cm.restaurant_id = p_restaurant_id
                  AND cm.status IN ('queued', 'sent', 'delivered', 'read')
                  AND cm.created_at >= v_freq_cutoff
            ) AS is_frequency_capped
        FROM public.customers c
        WHERE c.restaurant_id = p_restaurant_id
          AND (
              -- 1. PRESET: Frequent customers (>= 4 visits in last 30 days)
              (p_preset_type = 'frequent' AND c.visit_count >= 4 AND c.last_visit_at >= (NOW() - INTERVAL '30 days'))
              OR
              -- 2. PRESET: Lapsed customers (last visit 30 to 90 days ago)
              (p_preset_type = 'lapsed' AND c.last_visit_at < (NOW() - INTERVAL '30 days') AND c.last_visit_at >= (NOW() - INTERVAL '90 days'))
              OR
              -- 3. PRESET: Lost customers (no visit in > 90 days)
              (p_preset_type = 'lost' AND (c.last_visit_at IS NULL OR c.last_visit_at < (NOW() - INTERVAL '90 days')))
              OR
              -- 4. PRESET: New customers (exactly 1 visit in last 30 days)
              (p_preset_type = 'new' AND c.visit_count = 1 AND c.last_visit_at >= (NOW() - INTERVAL '30 days'))
              OR
              -- 5. PRESET: High spenders (top 10% spend)
              (p_preset_type = 'high_spenders' AND c.total_spend >= v_high_spend_threshold AND c.total_spend > 0)
              OR
              -- 6. PRESET: Birthday/Anniversary this week
              (p_preset_type = 'birthday_week' AND (
                  (c.birthday IS NOT NULL AND to_char(c.birthday, 'MM-DD') BETWEEN to_char(NOW(), 'MM-DD') AND to_char(NOW() + INTERVAL '7 days', 'MM-DD'))
                  OR (c.anniversary IS NOT NULL AND to_char(c.anniversary, 'MM-DD') BETWEEN to_char(NOW(), 'MM-DD') AND to_char(NOW() + INTERVAL '7 days', 'MM-DD'))
              ))
              OR
              -- All / Custom Fallback if no preset
              (p_preset_type IS NULL OR p_preset_type = 'all' OR p_preset_type = 'custom')
          )
    ),
    summary AS (
        SELECT 
            COUNT(*)::BIGINT AS total_matched,
            COUNT(*) FILTER (WHERE whatsapp_opt_in = true AND opt_out_at IS NULL AND NOT is_frequency_capped)::BIGINT AS eligible,
            COUNT(*) FILTER (WHERE whatsapp_opt_in = false OR opt_out_at IS NOT NULL)::BIGINT AS opted_out,
            COUNT(*) FILTER (WHERE whatsapp_opt_in = true AND opt_out_at IS NULL AND is_frequency_capped)::BIGINT AS freq_capped,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'id', id,
                        'name', COALESCE(name, 'Guest'),
                        'phone', SUBSTRING(phone FROM 1 FOR 6) || 'XXXX' || SUBSTRING(phone FROM LENGTH(phone)-1),
                        'visit_count', visit_count,
                        'total_spend_inr', ROUND(total_spend / 100.0, 2),
                        'last_visit', last_visit_at
                    )
                ) FILTER (WHERE whatsapp_opt_in = true AND opt_out_at IS NULL AND NOT is_frequency_capped),
                '[]'::jsonb
            ) AS samples
        FROM (
            SELECT * FROM raw_matches LIMIT 10
        ) s
    )
    SELECT 
        s.total_matched,
        s.eligible,
        s.opted_out,
        s.freq_capped,
        s.samples
    FROM summary s;
END;
$$;

-- ============================================================================
-- 10. REVENUE ATTRIBUTION CALCULATION (7-Day Conversion Window)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_campaign_attributed_revenue(
    p_campaign_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_restaurant_id TEXT;
    v_sent_at TIMESTAMPTZ;
    v_total_revenue BIGINT := 0;
BEGIN
    SELECT restaurant_id, sent_at 
    INTO v_restaurant_id, v_sent_at
    FROM public.campaigns
    WHERE id = p_campaign_id;

    IF v_sent_at IS NULL THEN
        RETURN 0;
    END IF;

    -- Calculate spend of recipients within 7 days of campaign dispatch
    -- Scanned from customer spend updates or POS orders
    SELECT COALESCE(SUM(c.total_spend), 0)
    INTO v_total_revenue
    FROM public.campaign_messages cm
    JOIN public.customers c ON c.id = cm.customer_id
    WHERE cm.campaign_id = p_campaign_id
      AND cm.status IN ('delivered', 'read')
      AND c.last_visit_at >= v_sent_at
      AND c.last_visit_at <= (v_sent_at + INTERVAL '7 days');

    UPDATE public.campaigns
    SET attributed_revenue_paise = v_total_revenue,
        updated_at = NOW()
    WHERE id = p_campaign_id;

    RETURN v_total_revenue;
END;
$$;

-- ============================================================================
-- 11. SEED DEFAULT PRESET SEGMENTS FUNCTION
-- Called when a new restaurant registers or onboards
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_seed_default_segments(p_restaurant_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.segments (restaurant_id, name, description, is_preset, preset_type, rules)
    VALUES
        (p_restaurant_id, 'Frequent Guests', 'Visited 4+ times in the last 30 days', true, 'frequent', '{"preset": "frequent", "min_visits": 4, "within_days": 30}'::jsonb),
        (p_restaurant_id, 'Lapsed Diners', 'Last visit was between 30 and 90 days ago', true, 'lapsed', '{"preset": "lapsed", "min_days": 30, "max_days": 90}'::jsonb),
        (p_restaurant_id, 'Lost Diners', 'No visit for over 90 days', true, 'lost', '{"preset": "lost", "min_days": 90}'::jsonb),
        (p_restaurant_id, 'New Diners', 'Joined with exactly 1 visit in the last 30 days', true, 'new', '{"preset": "new", "visit_count": 1, "within_days": 30}'::jsonb),
        (p_restaurant_id, 'High Spenders', 'Top 10% highest spenders of all time', true, 'high_spenders', '{"preset": "high_spenders", "percentile": 90}'::jsonb),
        (p_restaurant_id, 'Celebration This Week', 'Birthdays or anniversaries coming up in the next 7 days', true, 'birthday_week', '{"preset": "birthday_week", "within_days": 7}'::jsonb)
    ON CONFLICT (restaurant_id, name) DO NOTHING;
END;
$$;
