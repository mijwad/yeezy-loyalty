-- ============================================================================
-- YEEZY LOYALTY PLATFORM: WHATSAPP WEBHOOK TABLES & EVENT IDEMPOTENCY
-- Target: Supabase / PostgreSQL 15+
-- Scoped to restaurant_id with strict RLS
-- ============================================================================

-- 1. WA WEBHOOK EVENTS (Raw Meta event stream, replayable and deduplicated)
CREATE TABLE IF NOT EXISTS public.wa_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(128) UNIQUE, -- Unique event ID or computed sha256 hash to avoid double-processing
    restaurant_id TEXT,
    field VARCHAR(64) NOT NULL, -- 'messages', 'message_template_status_update', 'phone_number_quality_update'
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT true,
    error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_restaurant ON public.wa_webhook_events (restaurant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_webhook_events_field ON public.wa_webhook_events (field, received_at DESC);

-- 2. WA INBOUND MESSAGES (Customer replies to campaigns)
CREATE TABLE IF NOT EXISTS public.wa_inbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    wa_message_id VARCHAR(128) NOT NULL UNIQUE,
    from_phone_e164 VARCHAR(20) NOT NULL,
    text TEXT,
    type VARCHAR(32) NOT NULL DEFAULT 'text',
    raw_message JSONB NOT NULL DEFAULT '{}'::jsonb,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_inbound_messages_restaurant ON public.wa_inbound_messages (restaurant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_inbound_messages_customer ON public.wa_inbound_messages (customer_id);

-- 3. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.wa_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_inbound_messages ENABLE ROW LEVEL SECURITY;

-- RLS: wa_webhook_events
DROP POLICY IF EXISTS rls_wa_webhook_events_tenant ON public.wa_webhook_events;
CREATE POLICY rls_wa_webhook_events_tenant ON public.wa_webhook_events
    FOR ALL
    USING (
        restaurant_id IS NULL 
        OR fn_is_tenant_member(restaurant_id)
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        restaurant_id IS NULL 
        OR fn_is_tenant_member(restaurant_id)
        OR auth.role() = 'service_role'
    );

-- RLS: wa_inbound_messages
DROP POLICY IF EXISTS rls_wa_inbound_messages_tenant ON public.wa_inbound_messages;
CREATE POLICY rls_wa_inbound_messages_tenant ON public.wa_inbound_messages
    FOR ALL
    USING (fn_is_tenant_member(restaurant_id) OR auth.role() = 'service_role')
    WITH CHECK (fn_is_tenant_member(restaurant_id) OR auth.role() = 'service_role');

-- 4. ATOMIC COUNTER INCREMENT HELPER (if not existing)
CREATE OR REPLACE FUNCTION public.increment_counter(
    table_name TEXT,
    column_name TEXT,
    row_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE format('UPDATE public.%I SET %I = COALESCE(%I, 0) + 1, updated_at = NOW() WHERE id = $1', table_name, column_name, column_name)
    USING row_id;
END;
$$;
