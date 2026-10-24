-- ============================================================================
-- POS INTEGRATION TABLES
-- Supports multi-POS adapter pattern with webhook logging and redemption sessions
-- ============================================================================

-- Outlets table (if not exists)
CREATE TABLE IF NOT EXISTS public.outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    rest_id VARCHAR(64) UNIQUE,
    name VARCHAR(256) NOT NULL,
    address TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    app_key VARCHAR(128),
    pos_system VARCHAR(32) NOT NULL DEFAULT 'PETPOOJA',
    pos_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_marketplace_connected BOOLEAN NOT NULL DEFAULT false,
    marketplace_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all columns exist on outlets if table was created in an earlier migration
DO $$ BEGIN
    ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS rest_id VARCHAR(64);
    ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS app_key VARCHAR(128);
    ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS pos_system VARCHAR(32) DEFAULT 'PETPOOJA';
    ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS pos_config JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS is_marketplace_connected BOOLEAN DEFAULT false;
    ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS marketplace_connected_at TIMESTAMPTZ;
    ALTER TABLE public.outlets ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_outlets_tenant ON public.outlets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_outlets_rest_id ON public.outlets (rest_id);

-- Redemption Sessions (for POS lock/hold flow with 15-min TTL)
CREATE TABLE IF NOT EXISTS public.redemption_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(64) NOT NULL UNIQUE,
    restaurant_id TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE RESTRICT,
    member_phone VARCHAR(20) NOT NULL,
    reservation_id UUID REFERENCES public.redemption_reservations(id),
    order_id VARCHAR(128),
    table_no VARCHAR(32),
    server_name VARCHAR(128),
    bill_amount_paise BIGINT NOT NULL CHECK (bill_amount_paise >= 0),
    discountable_amount_paise BIGINT NOT NULL CHECK (discountable_amount_paise >= 0),
    max_redeemable_points INT NOT NULL DEFAULT 0,
    max_discount_paise BIGINT NOT NULL DEFAULT 0,
    point_value_paise INT NOT NULL DEFAULT 100,
    selected_option_id VARCHAR(64),
    points_locked INT NOT NULL DEFAULT 0,
    discount_amount_paise BIGINT NOT NULL DEFAULT 0,
    available_options JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'OFFERED', -- OFFERED, LOCKED_PENDING_PAYMENT, COMPLETED_SETTLED, EXPIRED, CANCELLED
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redemption_sessions_token ON public.redemption_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_redemption_sessions_member ON public.redemption_sessions (restaurant_id, member_id, status);
CREATE INDEX IF NOT EXISTS idx_redemption_sessions_expiry ON public.redemption_sessions (expires_at) WHERE status IN ('OFFERED', 'LOCKED_PENDING_PAYMENT');

-- Webhook Logs (audit trail for all POS webhooks)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    pos_system VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    request_payload JSONB NOT NULL,
    response_payload JSONB,
    status VARCHAR(16) NOT NULL, -- SUCCESS, ERROR, PARTIAL
    error_message TEXT,
    processing_time_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_restaurant ON public.webhook_logs (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_pos_system ON public.webhook_logs (pos_system, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON public.webhook_logs (event_type);

-- Enable RLS on new tables
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
    CREATE POLICY tenant_isolation_outlets ON public.outlets
        FOR ALL USING (tenant_id::text = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_redemption_sessions ON public.redemption_sessions
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_webhook_logs ON public.webhook_logs
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Function to clean up expired redemption sessions
CREATE OR REPLACE FUNCTION public.fn_cleanup_expired_redemption_sessions() RETURNS INT AS $$
DECLARE
    v_count INT;
BEGIN
    -- Mark expired sessions
    UPDATE public.redemption_sessions
    SET status = 'EXPIRED', updated_at = NOW()
    WHERE status IN ('OFFERED', 'LOCKED_PENDING_PAYMENT')
      AND expires_at < NOW();

    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- Also release any linked reservations
    UPDATE public.redemption_reservations
    SET status = 'released', released_at = NOW(), updated_at = NOW()
    WHERE status = 'reserved'
      AND expires_at < NOW()
      AND id IN (
          SELECT reservation_id FROM public.redemption_sessions
          WHERE status = 'EXPIRED' AND reservation_id IS NOT NULL
      );

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.fn_cleanup_expired_redemption_sessions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cleanup_expired_redemption_sessions() TO service_role;

-- Function to get outlet by POS system identifier
CREATE OR REPLACE FUNCTION public.fn_get_outlet_by_pos_id(
    p_pos_system VARCHAR,
    p_rest_id VARCHAR
) RETURNS TABLE (
    id UUID,
    tenant_id TEXT,
    rest_id VARCHAR,
    name VARCHAR,
    pos_system VARCHAR,
    pos_config JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT o.id, o.tenant_id, o.rest_id, o.name, o.pos_system, o.pos_config
    FROM public.outlets o
    WHERE o.rest_id = p_rest_id
      AND o.pos_system = p_pos_system
      AND o.active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.fn_get_outlet_by_pos_id(VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_get_outlet_by_pos_id(VARCHAR, VARCHAR) TO service_role;