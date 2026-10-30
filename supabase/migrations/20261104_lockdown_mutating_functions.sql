-- ============================================================================
-- LOCKDOWN MUTATING PUBLIC FUNCTIONS
-- Migration: 20261104_lockdown_mutating_functions.sql
-- Scoped to service_role only. Revokes anon, authenticated, and public execute.
-- ============================================================================

-- 1. increment_counter (arbitrary table counter updater)
REVOKE ALL ON FUNCTION public.increment_counter(TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_counter(TEXT, TEXT, UUID) TO service_role;

-- 2. fn_seed_default_segments (seeds default segment rules)
REVOKE ALL ON FUNCTION public.fn_seed_default_segments(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_seed_default_segments(TEXT) TO service_role;

-- 3. fn_sync_campaign_attributed_revenue (updates campaign revenue attribution)
REVOKE ALL ON FUNCTION public.fn_sync_campaign_attributed_revenue(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_sync_campaign_attributed_revenue(UUID) TO service_role;

-- 4. Provide explicit fn_loyalty_expire_points canonical alias pointing to fn_expire_points
CREATE OR REPLACE FUNCTION public.fn_loyalty_expire_points(
    p_restaurant_id TEXT,
    p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
BEGIN
    RETURN public.fn_expire_points(p_restaurant_id, p_now);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.fn_loyalty_expire_points(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_expire_points(TEXT, TIMESTAMPTZ) TO service_role;
