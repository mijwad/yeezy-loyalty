-- ============================================================================
-- FIX: fn_loyalty_earn_points Idempotency Branch Bug
-- Migration: 20261031_fix_earn_points_idempotency.sql
--
-- In fn_loyalty_earn_points, use dedicated v_existing_ledger and v_existing_member
-- variables in the idempotency branch so v_existing_ledger.points is returned accurately.
-- ============================================================================

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
    v_existing_member RECORD;
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
    SELECT * INTO v_existing_ledger
    FROM public.loyalty_ledger
    WHERE restaurant_id = p_restaurant_id AND order_id = p_order_id AND type = 'earn_base'
    LIMIT 1;

    IF v_existing_ledger.id IS NOT NULL THEN
        SELECT * INTO v_existing_member 
        FROM public.loyalty_members 
        WHERE id = v_existing_ledger.member_id;

        v_new_balance := public.fn_loyalty_get_available_balance(p_restaurant_id, v_existing_member.id);

        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'order_id', p_order_id,
            'points_earned', v_existing_ledger.points,
            'new_balance', v_new_balance,
            'tier', v_existing_member.tier
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
