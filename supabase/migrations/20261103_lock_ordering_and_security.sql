-- ============================================================================
-- LOCK ORDERING, SCHEMA INTEGRITY & SECURITY HARDENING
-- Migration: 20261103_lock_ordering_and_security.sql
-- Target: PostgreSQL 15+ / Supabase
--
-- 1. Change orders.outlet_id foreign key constraint to ON DELETE RESTRICT.
-- 2. Reject negative, zero, and NULL points in fn_loyalty_reserve_points (INVALID_POINTS).
-- 3. Harmonize lock ordering in fn_loyalty_commit_points: lock Member row BEFORE Reservation.
-- 4. Revert tier threshold in SQL to >= 5 matching lib/loyalty/engine.ts.
-- 5. Strict RLS enforcement and privilege revocation across all loyalty tables and functions.
-- ============================================================================

-- 1. Change orders.outlet_id FK to ON DELETE RESTRICT
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'orders'
      AND kcu.column_name = 'outlet_id'
    LIMIT 1;

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_outlet_id_fkey
    FOREIGN KEY (outlet_id) REFERENCES public.outlets(id) ON DELETE RESTRICT;


-- 2. Hardened fn_loyalty_reserve_points: Reject points <= 0 or NULL, and bill <= 0
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
    -- Input Validation: Points must be strictly positive
    IF p_points IS NULL OR p_points <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_POINTS', 'message', 'Requested points must be a positive integer'));
    END IF;

    -- Input Validation: Bill amount must be strictly positive
    IF p_bill_paise IS NULL OR p_bill_paise <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_BILL_AMOUNT', 'message', 'Bill amount must be greater than zero'));
    END IF;

    -- 1. Row-lock member row to prevent concurrent race conditions (Lock order: Member -> Reservation)
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


-- 3. Hardened fn_loyalty_commit_points: Unified Lock Order (Member -> Reservation)
CREATE OR REPLACE FUNCTION public.fn_loyalty_commit_points(
    p_restaurant_id TEXT,
    p_reservation_id UUID,
    p_order_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
    v_res RECORD;
    v_pts_needed INT;
    v_cur_ledger RECORD;
    v_take INT;
    v_unexpired_pts INT := 0;
    v_remaining_balance INT;
BEGIN
    -- 1. Read reservation's member_id WITHOUT acquiring lock
    SELECT member_id INTO v_member_id
    FROM public.redemption_reservations
    WHERE id = p_reservation_id AND restaurant_id = p_restaurant_id;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_NOT_FOUND', 'message', 'Reservation ID not found'));
    END IF;

    -- 2. ROW-LOCK MEMBER FIRST (Enforces global lock hierarchy: Member -> Reservation)
    PERFORM id FROM public.loyalty_members WHERE id = v_member_id FOR UPDATE;

    -- 3. ROW-LOCK RESERVATION SECOND
    SELECT * INTO v_res
    FROM public.redemption_reservations
    WHERE id = p_reservation_id AND restaurant_id = p_restaurant_id
    FOR UPDATE;

    -- 4. Idempotency Check: Already committed
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

    -- 5. Release check
    IF v_res.status = 'released' THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'RESERVATION_RELEASED', 'message', 'Reservation was already released'));
    END IF;

    -- 6. Expiry Check with 24-Hour Settlement Grace Window
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

    -- 7. FIFO Ledger Deduction (Guaranteed never to produce negative remaining)
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

    -- 8. Append negative redemption row to ledger
    INSERT INTO public.loyalty_ledger (
        restaurant_id, member_id, order_id, type, points, remaining, expires_at, meta
    ) VALUES (
        p_restaurant_id, v_res.member_id, p_order_id, 'redeem', -v_res.points, 0, NULL,
        jsonb_build_object('reservation_id', v_res.id, 'discount_paise', v_res.discount_paise, 'bill_amount_paise', v_res.bill_amount_paise)
    );

    -- 9. Finalize reservation
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


-- 4. Revert SQL Tier Threshold to >= 5 matching lib/loyalty/config.ts & engine.ts
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
    -- 1. Create member if brand-new, then acquire ROW LOCK (FOR UPDATE) BEFORE idempotency check (Lock Order: Member -> Reservation)
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
            -- Commit reservation (Lock order already satisfied: member is locked)
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

    -- Tier evaluation: Reverted to >= 5 matching lib/loyalty/config.ts & engine.ts
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


-- 5. RLS & Permissions Enforcement across all 8 Loyalty Tables
ALTER TABLE public.loyalty_earn_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petpooja_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petpooja_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemption_reservations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.loyalty_earn_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.petpooja_rewards FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.petpooja_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.outlets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_ledger FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.redemption_reservations FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.loyalty_earn_events TO service_role;
GRANT ALL ON TABLE public.petpooja_rewards TO service_role;
GRANT ALL ON TABLE public.petpooja_redemptions TO service_role;
GRANT ALL ON TABLE public.orders TO service_role;
GRANT ALL ON TABLE public.outlets TO service_role;
GRANT ALL ON TABLE public.loyalty_members TO service_role;
GRANT ALL ON TABLE public.loyalty_ledger TO service_role;
GRANT ALL ON TABLE public.redemption_reservations TO service_role;

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
