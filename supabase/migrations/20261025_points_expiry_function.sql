-- ============================================================================
-- POINTS EXPIRY FUNCTION (Daily Cron Job)
-- Expires earn ledger entries based on their expires_at timestamp
-- ============================================================================

-- Function to expire points for a specific restaurant (can be called by pg_cron per tenant)
CREATE OR REPLACE FUNCTION public.fn_expire_points(
    p_restaurant_id TEXT,
    p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_expired_count INT := 0;
    v_total_points_expired INT := 0;
    v_ledger RECORD;
    v_expire_entry JSONB;
BEGIN
    -- Find all unexpired earn entries with expires_at in the past
    FOR v_ledger IN
        SELECT id, restaurant_id, member_id, remaining, points, type, expires_at, meta
        FROM public.loyalty_ledger
        WHERE restaurant_id = p_restaurant_id
          AND remaining > 0
          AND expires_at IS NOT NULL
          AND expires_at < p_now
          AND type LIKE 'earn_%'
        FOR UPDATE
    LOOP
        -- Create expiry ledger entry
        v_expire_entry := jsonb_build_object(
            'source_entry_id', v_ledger.id,
            'original_type', v_ledger.type,
            'expired_at', p_now,
            'original_points', v_ledger.points,
            'points_expired', v_ledger.remaining
        );

        INSERT INTO public.loyalty_ledger (
            restaurant_id, member_id, order_id, type, points, remaining, expires_at, meta, created_at
        ) VALUES (
            v_ledger.restaurant_id,
            v_ledger.member_id,
            NULL,
            'expire',
            -v_ledger.remaining,
            0,
            NULL,
            v_expire_entry,
            p_now
        );

        -- Update original entry remaining to 0
        UPDATE public.loyalty_ledger
        SET remaining = 0
        WHERE id = v_ledger.id;

        v_expired_count := v_expired_count + 1;
        v_total_points_expired := v_total_points_expired + v_ledger.remaining;
    END LOOP;

    RETURN jsonb_build_object(
        'expired_entries', v_expired_count,
        'total_points_expired', v_total_points_expired,
        'processed_at', p_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Function to expire points for ALL restaurants (for global cron)
CREATE OR REPLACE FUNCTION public.fn_expire_all_points(
    p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
    v_restaurant RECORD;
    v_total_expired INT := 0;
    v_total_points INT := 0;
    v_result JSONB;
BEGIN
    FOR v_restaurant IN
        SELECT restaurant_id FROM public.loyalty_programs WHERE is_active = true
    LOOP
        v_result := public.fn_expire_points(v_restaurant.restaurant_id, p_now);
        v_total_expired := v_total_expired + (v_result->>'expired_entries')::INT;
        v_total_points := v_total_points + (v_result->>'total_points_expired')::INT;
    END LOOP;

    RETURN jsonb_build_object(
        'restaurants_processed', (SELECT COUNT(*) FROM public.loyalty_programs WHERE is_active = true),
        'total_expired_entries', v_total_expired,
        'total_points_expired', v_total_points,
        'processed_at', p_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Grant execute to service_role only
REVOKE ALL ON FUNCTION public.fn_expire_points(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_points(TEXT, TIMESTAMPTZ) TO service_role;

REVOKE ALL ON FUNCTION public.fn_expire_all_points(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_expire_all_points(TIMESTAMPTZ) TO service_role;

-- ============================================================================
-- PG_CRON SCHEDULES (Uncomment and run in Supabase dashboard after enabling pg_cron extension)
-- ============================================================================

-- Enable pg_cron extension (run once)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily point expiry at 2 AM UTC for all restaurants
-- SELECT cron.schedule('daily-points-expiry', '0 2 * * *', $$ SELECT public.fn_expire_all_points(); $$);

-- Schedule stale reservation cleanup every 15 minutes
-- SELECT cron.schedule('cleanup-stale-reservations', '*/15 * * * *', $$ SELECT public.fn_cleanup_expired_redemption_sessions(); $$);

-- Schedule daily reservation cleanup at 3 AM UTC (backup)
-- SELECT cron.schedule('daily-reservation-cleanup', '0 3 * * *', $$ SELECT public.fn_expire_stale_reservations(); $$);