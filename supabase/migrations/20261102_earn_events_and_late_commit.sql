-- ============================================================================
-- IDEMPOTENCY VIA LOYALTY_EARN_EVENTS & LATE COMMIT HARDENING
-- Migration: 20261102_earn_events_and_late_commit.sql
-- Target: PostgreSQL 15+ / Supabase
--
-- 1. Create loyalty_earn_events table with UNIQUE(restaurant_id, order_id)
--    to serve as the dedicated idempotency gate for all order settlements.
-- 2. Update fn_loyalty_earn_points to use loyalty_earn_events, avoiding ledger
--    bloat for 0-point orders while strictly guaranteeing idempotent visits,
--    spend, and tier progression.
-- 3. Hardened fn_loyalty_commit_points: return distinct INSUFFICIENT_AT_LATE_COMMIT
--    when points cannot be covered during the 24h grace window; strictly prevent
--    negative remaining ledger balances.
-- 4. Permissions: Revoke from PUBLIC, anon, authenticated and grant to service_role.
-- ============================================================================

-- 1. Create loyalty_earn_events table
CREATE TABLE IF NOT EXISTS public.loyalty_earn_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    order_id VARCHAR(128) NOT NULL,
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id) ON DELETE CASCADE,
    subtotal_paise BIGINT NOT NULL DEFAULT 0,
    points_earned INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_loyalty_earn_events UNIQUE (restaurant_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_earn_events_member
    ON public.loyalty_earn_events (restaurant_id, member_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.loyalty_earn_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY tenant_isolation_earn_events ON public.loyalty_earn_events
        FOR ALL USING (restaurant_id = public.current_restaurant_id() OR current_setting('role', true) = 'service_role');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Backfill from existing loyalty_ledger
INSERT INTO public.loyalty_earn_events (restaurant_id, order_id, member_id, points_earned, created_at)
SELECT restaurant_id, order_id, member_id, points, created_at
FROM public.loyalty_ledger
WHERE order_id IS NOT NULL AND type = 'earn_base'
ON CONFLICT (restaurant_id, order_id) DO NOTHING;


-- 2. Hardened fn_loyalty_commit_points with INSUFFICIENT_AT_LATE_COMMIT
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
    v_unexpired_pts INT := 0;
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
        IF v_res.expires_at < (NOW() - INTERVAL '24 hours') THEN
            UPDATE public.redemption_reservations SET status = 'expired', updated_at = NOW() WHERE id = v_res.id;
            RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_EXPIRED', 'message', 'Reservation has expired past the 24-hour settlement grace window'));
        END IF;

        -- Check if member still has enough unexpired available points
        IF public.fn_loyalty_get_available_balance(p_restaurant_id, v_res.member_id) < v_res.points THEN
            UPDATE public.redemption_reservations SET status = 'expired', updated_at = NOW() WHERE id = v_res.id;
            RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INSUFFICIENT_AT_LATE_COMMIT', 'message', 'Insufficient available balance to complete late commit within grace window'));
        END IF;
    END IF;

    -- 5. Row-lock member row to serialize points balance modifications
    PERFORM id FROM public.loyalty_members WHERE id = v_res.member_id FOR UPDATE;

    -- Pre-calculate unexpired available points directly in unexpired ledger rows
    SELECT COALESCE(SUM(remaining), 0) INTO v_unexpired_pts
    FROM public.loyalty_ledger
    WHERE restaurant_id = p_restaurant_id
      AND member_id = v_res.member_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > NOW());

    IF v_unexpired_pts < v_res.points THEN
        UPDATE public.redemption_reservations SET status = 'expired', updated_at = NOW() WHERE id = v_res.id;
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INSUFFICIENT_AT_LATE_COMMIT', 'message', 'Insufficient unexpired points in ledger to cover redemption'));
    END IF;

    -- 6. FIFO Ledger Deduction (Guaranteed never to produce negative remaining)
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


-- 3. Hardened fn_loyalty_earn_points with loyalty_earn_events Idempotency Gate
CREATE OR REPLACE FUNCTION public.fn_loyalty_earn_points(
    p_restaurant_id TEXT,
    p_order_id TEXT,
    p_phone TEXT,
    p_subtotal_paise BIGINT,
    p_order_type TEXT DEFAULT 'dine_in',
    p_reservation_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_existing_event RECORD;
    v_member RECORD;
    v_program RECORD;
    v_res RECORD;
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
    v_reservation_result JSONB := NULL;
    v_reservation_failed BOOLEAN := false;
BEGIN
    -- 1. Create member if brand-new, then acquire ROW LOCK (FOR UPDATE) BEFORE idempotency check
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES (p_restaurant_id, p_phone, 'Guest', 'Silver')
    ON CONFLICT (restaurant_id, phone_e164) DO NOTHING;

    SELECT * INTO v_member
    FROM public.loyalty_members
    WHERE restaurant_id = p_restaurant_id AND phone_e164 = p_phone
    FOR UPDATE;

    -- 2. Process linked redemption reservation if provided
    IF p_reservation_id IS NOT NULL THEN
        SELECT * INTO v_res
        FROM public.redemption_reservations
        WHERE id = p_reservation_id AND restaurant_id = p_restaurant_id;

        IF v_res.id IS NULL THEN
            v_reservation_result := jsonb_build_object(
                'success', false,
                'error', jsonb_build_object('code', 'RESERVATION_NOT_FOUND', 'message', 'Reservation ID not found')
            );
            v_reservation_failed := true;
        ELSIF v_res.member_id != v_member.id THEN
            v_reservation_result := jsonb_build_object(
                'success', false,
                'error', jsonb_build_object('code', 'RESERVATION_MEMBER_MISMATCH', 'message', 'Reservation belongs to a different member')
            );
            v_reservation_failed := true;
        ELSE
            -- Commit reservation
            v_reservation_result := public.fn_loyalty_commit_points(p_restaurant_id, p_reservation_id, p_order_id);
            IF (v_reservation_result->>'success')::boolean IS NOT TRUE THEN
                v_reservation_failed := true;
            END IF;
        END IF;
    END IF;

    -- 3. Idempotency Check using loyalty_earn_events
    SELECT * INTO v_existing_event
    FROM public.loyalty_earn_events
    WHERE restaurant_id = p_restaurant_id AND order_id = p_order_id
    LIMIT 1;

    IF v_existing_event.id IS NOT NULL THEN
        v_new_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_member.id);

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'order_id', p_order_id,
            'points_earned', v_existing_event.points_earned,
            'new_balance', v_new_balance,
            'tier', v_member.tier,
            'redemption_commit', v_reservation_result,
            'needs_review', v_reservation_failed
        );
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

    -- 5. Compute Points (0 points for small/zero subtotals)
    IF p_subtotal_paise > 0 THEN
        v_base_points := FLOOR(((p_subtotal_paise / 100.0) * (v_base_bps / 10000.0)) * v_tier_multiplier)::INT;
    ELSE
        v_base_points := 0;
    END IF;
    v_total_earned := GREATEST(0, v_base_points);
    v_expires_at := NOW() + (v_points_expiry_days || ' days')::INTERVAL;

    -- 6. Insert into loyalty_earn_events idempotency table
    BEGIN
        INSERT INTO public.loyalty_earn_events (
            restaurant_id, order_id, member_id, subtotal_paise, points_earned
        ) VALUES (
            p_restaurant_id, p_order_id, v_member.id, p_subtotal_paise, v_total_earned
        );
    EXCEPTION WHEN unique_violation THEN
        -- Concurrency race won by another transaction for this order_id
        SELECT * INTO v_existing_event
        FROM public.loyalty_earn_events
        WHERE restaurant_id = p_restaurant_id AND order_id = p_order_id
        LIMIT 1;

        v_new_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_member.id);

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'order_id', p_order_id,
            'points_earned', v_existing_event.points_earned,
            'new_balance', v_new_balance,
            'tier', v_member.tier,
            'redemption_commit', v_reservation_result,
            'needs_review', v_reservation_failed
        );
    END;

    -- 7. Insert into loyalty_ledger ONLY if points > 0 (prevents 0-point ledger bloat)
    IF v_total_earned > 0 THEN
        INSERT INTO public.loyalty_ledger (
            restaurant_id, member_id, order_id, type, points, remaining, expires_at, meta
        ) VALUES (
            p_restaurant_id, v_member.id, p_order_id, 'earn_base', v_total_earned, v_total_earned, v_expires_at,
            jsonb_build_object('subtotal_paise', p_subtotal_paise, 'order_type', p_order_type, 'tier_at_time', v_member.tier)
        ) RETURNING id INTO v_ledger_id;
    END IF;

    -- 8. Update Member Profile: Increment visits and lifetime spend
    v_new_visits := v_member.visit_count + 1;
    v_new_spend := v_member.lifetime_spend_paise + GREATEST(0, p_subtotal_paise);

    -- Tier evaluation: Silver (visits 1..5), Gold (visits 6..11), Platinum (12+)
    IF v_new_visits >= 12 THEN
        v_new_tier := 'Platinum';
    ELSIF v_new_visits > 5 THEN
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
        'visit_count', v_new_visits,
        'redemption_commit', v_reservation_result,
        'needs_review', v_reservation_failed
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 4. Permissions: Strict grants for service_role only
REVOKE ALL ON TABLE public.loyalty_earn_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.loyalty_earn_events TO service_role;

REVOKE ALL ON FUNCTION public.fn_loyalty_commit_points(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_commit_points(TEXT, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.fn_loyalty_earn_points(TEXT, TEXT, TEXT, BIGINT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_loyalty_earn_points(TEXT, TEXT, TEXT, BIGINT, TEXT, UUID) TO service_role;
