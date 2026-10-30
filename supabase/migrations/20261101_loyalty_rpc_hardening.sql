-- ============================================================================
-- LOYALTY RPC HARDENING & CONCURRENCY RESILIENCE
-- Migration: 20261101_loyalty_rpc_hardening.sql
-- Target: PostgreSQL 15+ / Supabase
--
-- 1. Partial unique index on loyalty_ledger for earn_base idempotency.
-- 2. Member row-locking BEFORE idempotency check in fn_loyalty_earn_points.
-- 3. Validation of reservation member match and returning redemption_commit + needs_review.
-- 4. Consistent 0-point small subtotal handling while counting visits.
-- 5. Exception handling for unique_violation race conditions.
-- 6. Precise error code distinction in fn_loyalty_reserve_points (INSUFFICIENT_BALANCE vs BELOW_MIN_POINTS).
-- 7. Strict permission revocation from PUBLIC/anon/authenticated and grant to service_role.
-- ============================================================================

-- 1. Partial Unique Index on loyalty_ledger
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_ledger_order_earn 
    ON public.loyalty_ledger (restaurant_id, order_id, type) 
    WHERE order_id IS NOT NULL AND type = 'earn_base';


-- 2. Hardened fn_loyalty_reserve_points (Separates INSUFFICIENT_BALANCE from BELOW_MIN_POINTS)
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

    -- Case A: Member balance is strictly below program minimum required to redeem
    IF v_available_pts < v_min_points THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'BELOW_MIN_POINTS', 'message', format('Minimum %s points required to redeem', v_min_points)));
    END IF;

    -- Case B: Member balance meets program min, but cannot cover requested points
    IF p_points > v_available_pts THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INSUFFICIENT_BALANCE', 'message', format('Insufficient available points. Requested %s, available %s', p_points, v_available_pts)));
    END IF;

    -- 5. Calculate maximum allowable discount on this bill
    v_max_redeem_pts := FLOOR((p_bill_paise * (v_max_pct / 100.0)) / v_point_val)::INT;
    IF p_points > v_max_redeem_pts THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'EXCEEDS_MAX_REDEEM_PERCENT', 'message', 'Requested points exceed allowed redemption cap for bill'));
    END IF;

    v_points_to_reserve := p_points;
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


-- 3. Hardened fn_loyalty_earn_points
CREATE OR REPLACE FUNCTION public.fn_loyalty_earn_points(
    p_restaurant_id TEXT,
    p_order_id TEXT,
    p_phone TEXT,
    p_subtotal_paise BIGINT,
    p_order_type TEXT DEFAULT 'dine_in',
    p_reservation_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_existing_ledger RECORD;
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
    -- 1. Create member if brand-new, then acquire ROW LOCK (FOR UPDATE) BEFORE idempotency check (3a)
    INSERT INTO public.loyalty_members (restaurant_id, phone_e164, name, tier)
    VALUES (p_restaurant_id, p_phone, 'Guest', 'Silver')
    ON CONFLICT (restaurant_id, phone_e164) DO NOTHING;

    SELECT * INTO v_member
    FROM public.loyalty_members
    WHERE restaurant_id = p_restaurant_id AND phone_e164 = p_phone
    FOR UPDATE;

    -- 2. Process linked redemption reservation if provided (3c)
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

    -- 3. Idempotency Check AFTER acquiring member row lock (3a)
    SELECT * INTO v_existing_ledger
    FROM public.loyalty_ledger
    WHERE restaurant_id = p_restaurant_id AND order_id = p_order_id AND type = 'earn_base'
    LIMIT 1;

    IF v_existing_ledger.id IS NOT NULL THEN
        v_new_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_member.id);

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'order_id', p_order_id,
            'points_earned', v_existing_ledger.points,
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

    -- 5. Compute Points (3d: small subtotals e.g. 500 paise or 0 paise earn 0 points, non-negative)
    IF p_subtotal_paise > 0 THEN
        v_base_points := FLOOR(((p_subtotal_paise / 100.0) * (v_base_bps / 10000.0)) * v_tier_multiplier)::INT;
    ELSE
        v_base_points := 0;
    END IF;
    v_total_earned := GREATEST(0, v_base_points);
    v_expires_at := NOW() + (v_points_expiry_days || ' days')::INTERVAL;

    -- 6. Insert Append-Only Ledger Entry (Only if points > 0)
    IF v_total_earned > 0 THEN
        BEGIN
            INSERT INTO public.loyalty_ledger (
                restaurant_id, member_id, order_id, type, points, remaining, expires_at, meta
            ) VALUES (
                p_restaurant_id, v_member.id, p_order_id, 'earn_base', v_total_earned, v_total_earned, v_expires_at,
                jsonb_build_object('subtotal_paise', p_subtotal_paise, 'order_type', p_order_type, 'tier_at_time', v_member.tier)
            ) RETURNING id INTO v_ledger_id;
        EXCEPTION WHEN unique_violation THEN
            -- Concurrency race won by another transaction for this order_id
            SELECT * INTO v_existing_ledger
            FROM public.loyalty_ledger
            WHERE restaurant_id = p_restaurant_id AND order_id = p_order_id AND type = 'earn_base'
            LIMIT 1;

            v_new_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_member.id);

            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'order_id', p_order_id,
                'points_earned', v_existing_ledger.points,
                'new_balance', v_new_balance,
                'tier', v_member.tier,
                'redemption_commit', v_reservation_result,
                'needs_review', v_reservation_failed
            );
        END;
    END IF;

    -- 7. Update Member Profile (3d: always count visit and update lifetime spend)
    v_new_visits := v_member.visit_count + 1;
    v_new_spend := v_member.lifetime_spend_paise + GREATEST(0, p_subtotal_paise);

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
        'visit_count', v_new_visits,
        'redemption_commit', v_reservation_result,
        'needs_review', v_reservation_failed
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;


-- 4. Permissions (4): Revoke execute from PUBLIC/anon/authenticated and grant strictly to service_role
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
