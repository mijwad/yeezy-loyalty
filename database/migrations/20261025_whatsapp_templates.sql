-- ============================================================================
-- YEEZY LOYALTY PLATFORM: WHATSAPP TEMPLATE & CAMPAIGN TABLES
-- Multi-tenant WhatsApp Business Cloud API Integration
-- Compatible with PostgreSQL 14+ / Supabase / Neon / AWS RDS Aurora
-- ============================================================================

-- 1. ENUMS FOR WHATSAPP TEMPLATES
DO $$ BEGIN
    CREATE TYPE wa_template_category AS ENUM (
        'UTILITY',
        'MARKETING',
        'AUTHENTICATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_template_status AS ENUM (
        'DRAFT',
        'PENDING',
        'APPROVED',
        'REJECTED',
        'DISABLED',
        'DELETED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_campaign_status AS ENUM (
        'DRAFT',
        'SCHEDULED',
        'SENDING',
        'COMPLETED',
        'PAUSED',
        'CANCELLED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_message_status AS ENUM (
        'QUEUED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'OPT_OUT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE wa_account_status AS ENUM (
        'DISCONNECTED',
        'CONNECTING',
        'CONNECTED',
        'ERROR',
        'SUSPENDED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. WHATSAPP BUSINESS ACCOUNTS (Per Restaurant/Tenant)
CREATE TABLE IF NOT EXISTS public.wa_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Meta Business Account Info
    waba_id VARCHAR(100) NOT NULL,
    phone_number_id VARCHAR(100) NOT NULL,
    display_phone_number VARCHAR(30),
    verified_name VARCHAR(255),

    -- Credentials (encrypted at rest in production)
    access_token TEXT NOT NULL,
    webhook_secret VARCHAR(255),

    -- Account Status
    status wa_account_status NOT NULL DEFAULT 'DISCONNECTED',
    quality_rating VARCHAR(20), -- GREEN, YELLOW, RED
    messaging_limit_tier VARCHAR(20), -- TIER_1K, TIER_10K, TIER_100K, TIER_UNLIMITED

    -- Embedded Signup Tracking
    embedded_signup_code VARCHAR(255),
    embedded_signup_state VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_wa_accounts_tenant UNIQUE (tenant_id),
    CONSTRAINT uq_wa_accounts_phone_number UNIQUE (phone_number_id)
);

-- 3. WHATSAPP MESSAGE TEMPLATES (Synced with Meta)
CREATE TABLE IF NOT EXISTS public.wa_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Template Identity
    name VARCHAR(100) NOT NULL, -- e.g. 'loyalty_first_purchase'
    language VARCHAR(10) NOT NULL DEFAULT 'en_US', -- en_US, hi_IN, etc.
    category wa_template_category NOT NULL DEFAULT 'UTILITY',

    -- Template Components
    header_text VARCHAR(160), -- Optional header (max 160 chars)
    body_text TEXT NOT NULL, -- Required body (max 1024 chars)
    footer_text VARCHAR(60), -- Optional footer (max 60 chars)

    -- Buttons (JSON array)
    buttons JSONB DEFAULT '[]'::jsonb, -- QUICK_REPLY, URL, PHONE_NUMBER, CATALOG

    -- Variable Definitions
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    /*
     * [
     *   {"index": 1, "name": "customer_name", "sample": "Rohan", "type": "customer.name"},
     *   {"index": 2, "name": "restaurant_name", "sample": "Smoke House Deli", "type": "restaurant.name"},
     *   {"index": 3, "name": "points_earned", "sample": "100", "type": "loyalty.points_earned"},
     *   {"index": 4, "name": "points_balance", "sample": "350", "type": "loyalty.points_balance"}
     * ]
     */

    -- Meta Sync Status
    meta_template_id VARCHAR(100), -- Meta's template ID after approval
    meta_status wa_template_status NOT NULL DEFAULT 'DRAFT',
    meta_rejection_reason TEXT,
    last_synced_at TIMESTAMPTZ,

    -- Event Mapping (which internal events use this template)
    event_type VARCHAR(50), -- FIRST_PURCHASE, REPEAT_PURCHASE, POINTS_REMINDER, etc.
    is_system_template BOOLEAN NOT NULL DEFAULT FALSE, -- Protected system templates

    -- Metadata
    description TEXT,
    created_by UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_wa_templates_tenant_name UNIQUE (tenant_id, name, language)
);

-- 4. CUSTOMER SEGMENTS (Preset + Custom)
CREATE TABLE IF NOT EXISTS public.segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_preset BOOLEAN NOT NULL DEFAULT FALSE,
    preset_type VARCHAR(50), -- 'frequent', 'lapsed', 'lost', 'new', 'high_spenders', 'birthday_week'

    -- Custom Rules (JSON for flexible segmentation)
    rules JSONB DEFAULT '{}'::jsonb,
    /*
     * {
     *   "min_visits": 4,
     *   "max_days_since_last_visit": 30,
     *   "min_lifetime_spend": 5000,
     *   "rfm_segments": ["VIP", "REGULAR"],
     *   "has_birthday_this_week": true
     * }
     */

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    CONSTRAINT uq_segments_tenant_name UNIQUE (tenant_id, name)
);

-- 5. WHATSAPP CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,
    description TEXT,

    -- Template & Segment
    template_id UUID NOT NULL REFERENCES public.wa_templates(id) ON DELETE RESTRICT,
    segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL,

    -- Variable Mapping (campaign-specific variable overrides)
    variable_mapping JSONB DEFAULT '{}'::jsonb,
    /*
     * {
     *   "1": "customer.name",
     *   "2": "restaurant.name",
     *   "3": "loyalty.points_earned",
     *   "4": "loyalty.points_balance"
     * }
     */

    -- Scheduling & Frequency Capping
    status wa_campaign_status NOT NULL DEFAULT 'DRAFT',
    scheduled_at TIMESTAMPTZ,
    frequency_cap_days INT NOT NULL DEFAULT 7,

    -- Execution Tracking
    total_audience INT NOT NULL DEFAULT 0,
    total_sent INT NOT NULL DEFAULT 0,
    total_delivered INT NOT NULL DEFAULT 0,
    total_read INT NOT NULL DEFAULT 0,
    total_failed INT NOT NULL DEFAULT 0,
    total_opt_outs INT NOT NULL DEFAULT 0,

    -- Attribution
    attributed_revenue_paise BIGINT NOT NULL DEFAULT 0,
    actual_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,

    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.tenant_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. CAMPAIGN MESSAGE LOG (Per-recipient delivery tracking)
CREATE TABLE IF NOT EXISTS public.campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

    phone_e164 VARCHAR(30) NOT NULL,
    wa_message_id VARCHAR(100), -- Meta's message ID

    status wa_message_status NOT NULL DEFAULT 'QUEUED',
    error_code VARCHAR(50),
    error_message TEXT,

    cost NUMERIC(10, 4) NOT NULL DEFAULT 0.00, -- Cost per message in INR

    queued_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ
);

-- 7. WHATSAPP MESSAGE LOG (All inbound/outbound messages for audit)
CREATE TABLE IF NOT EXISTS public.wa_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,

    direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
    message_type VARCHAR(30) NOT NULL, -- 'template', 'text', 'image', 'interactive', 'order'

    wa_message_id VARCHAR(100),
    template_name VARCHAR(100),
    template_language VARCHAR(10),

    -- For inbound
    from_phone_e164 VARCHAR(30),
    body_text TEXT,

    -- For outbound
    to_phone_e164 VARCHAR(30),
    status VARCHAR(30), -- sent, delivered, read, failed
    error_code VARCHAR(50),
    error_message TEXT,

    -- Cost tracking
    cost NUMERIC(10, 4) NOT NULL DEFAULT 0.00,
    conversation_id VARCHAR(100), -- Meta's conversation ID for billing

    -- Metadata
    raw_payload JSONB,
    idempotency_key VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- wa_accounts
CREATE INDEX IF NOT EXISTS idx_wa_accounts_tenant ON public.wa_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_accounts_status ON public.wa_accounts(status);

-- wa_templates
CREATE INDEX IF NOT EXISTS idx_wa_templates_tenant ON public.wa_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_event ON public.wa_templates(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_wa_templates_meta_status ON public.wa_templates(meta_status);

-- segments
CREATE INDEX IF NOT EXISTS idx_segments_tenant ON public.segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segments_preset ON public.segments(tenant_id, is_preset);

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.campaigns(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.campaigns(scheduled_at) WHERE status = 'SCHEDULED';

-- campaign_messages
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON public.campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_customer ON public.campaign_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_status ON public.campaign_messages(status);

-- wa_message_log
CREATE INDEX IF NOT EXISTS idx_wa_message_log_tenant ON public.wa_message_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_message_log_customer ON public.wa_message_log(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_message_log_idempotency ON public.wa_message_log(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wa_message_log_conversation ON public.wa_message_log(conversation_id) WHERE conversation_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.wa_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_message_log ENABLE ROW LEVEL SECURITY;

-- Helper function (reuse existing)
-- public.current_restaurant_id() or public.current_tenant_id() should be available

-- wa_accounts RLS
DROP POLICY IF EXISTS "wa_accounts_tenant_isolation" ON public.wa_accounts;
CREATE POLICY "wa_accounts_tenant_isolation" ON public.wa_accounts
    FOR ALL
    USING (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    );

-- wa_templates RLS
DROP POLICY IF EXISTS "wa_templates_tenant_isolation" ON public.wa_templates;
CREATE POLICY "wa_templates_tenant_isolation" ON public.wa_templates
    FOR ALL
    USING (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    );

-- segments RLS
DROP POLICY IF EXISTS "segments_tenant_isolation" ON public.segments;
CREATE POLICY "segments_tenant_isolation" ON public.segments
    FOR ALL
    USING (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    );

-- campaigns RLS
DROP POLICY IF EXISTS "campaigns_tenant_isolation" ON public.campaigns;
CREATE POLICY "campaigns_tenant_isolation" ON public.campaigns
    FOR ALL
    USING (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    );

-- campaign_messages RLS
DROP POLICY IF EXISTS "campaign_messages_tenant_isolation" ON public.campaign_messages;
CREATE POLICY "campaign_messages_tenant_isolation" ON public.campaign_messages
    FOR ALL
    USING (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    );

-- wa_message_log RLS
DROP POLICY IF EXISTS "wa_message_log_tenant_isolation" ON public.wa_message_log;
CREATE POLICY "wa_message_log_tenant_isolation" ON public.wa_message_log
    FOR ALL
    USING (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        OR current_user = 'service_role'
        OR public.current_tenant_id() IS NULL
    );

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER set_timestamp_wa_accounts BEFORE UPDATE ON public.wa_accounts FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_wa_templates BEFORE UPDATE ON public.wa_templates FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_segments BEFORE UPDATE ON public.segments FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();
CREATE TRIGGER set_timestamp_campaigns BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();

-- ============================================================================
-- DEFAULT PRESET SEGMENTS (Insert for new tenants via application logic)
-- ============================================================================
-- These are created programmatically when a tenant is onboarded

-- ============================================================================
-- NOTES
-- ============================================================================
/*
TEMPLATE CATEGORIES:
- UTILITY: Transactional, account updates, order confirmations (lower cost, higher delivery rate)
- MARKETING: Promotions, offers, win-back (higher cost, requires opt-in)
- AUTHENTICATION: OTP, verification codes

LOYALTY EVENT TEMPLATES (6 System Templates):
1. FIRST_PURCHASE -> loyalty_first_purchase (UTILITY)
2. REPEAT_PURCHASE -> loyalty_repeat_purchase (UTILITY)
3. POINTS_REMINDER -> loyalty_points_reminder (UTILITY/MARKETING)
4. POINTS_EXPIRING -> loyalty_points_expiry (UTILITY)
5. REWARD_REDEEMED -> loyalty_reward_redeemed (UTILITY)
6. CUSTOMER_WINBACK -> loyalty_winback_offer (MARKETING)

VARIABLE TYPE MAPPING:
- customer.name -> Customer's full name
- customer.phone -> Customer's phone (E.164)
- customer.visits -> Visit count
- customer.tier -> Current tier name
- restaurant.name -> Restaurant/outlet name
- loyalty.points_earned -> Points earned in transaction
- loyalty.points_balance -> Current points balance
- loyalty.points_expiring -> Points expiring soon
- loyalty.expiry_date -> Expiry date (formatted)
- loyalty.reward_name -> Redeemed reward name
- loyalty.points_used -> Points spent on redemption
- offer.details -> Win-back offer description
- offer.expiry_date -> Offer validity date
*/