-- ============================================================================
-- PETPOOJA ATOMIC REDEEM RPC (CASHBACK PATH)
-- Migration: 20261105_petpooja_atomic_redeem.sql
-- Atomically reserves loyalty points and stages petpooja_redemptions (HELD).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_petpooja_redeem(
    p_restaurant_id TEXT,
    p_outlet_id UUID,
    p_phone TEXT,
    p_invoice_no TEXT,
    p_points INT,
    p_bill_paise BIGINT,
    p_ttl_seconds INT DEFAULT 10800
) RETURNS JSONB AS $$
DECLARE
    v_member_id UUID;
    v_existing_redemption RECORD;
    v_reserve_res JSONB;
    v_reservation_id UUID;
    v_discount_paise BIGINT;
    v_expires_at TIMESTAMPTZ;
    v_redemption_id UUID;
BEGIN
    -- 1. Input validations
    IF p_restaurant_id IS NULL OR p_restaurant_id = '' THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_RESTAURANT', 'message', 'Restaurant ID is required'));
    END IF;

    IF p_outlet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_OUTLET', 'message', 'Outlet ID is required'));
    END IF;

    IF p_phone IS NULL OR p_phone = '' THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_PHONE', 'message', 'Phone is required'));
    END IF;

    IF p_invoice_no IS NULL OR p_invoice_no = '' THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_INVOICE', 'message', 'Invoice number is required'));
    END IF;

    IF p_points IS NULL OR p_points <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_POINTS', 'message', 'Requested points must be a positive integer'));
    END IF;

    IF p_bill_paise IS NULL OR p_bill_paise <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'INVALID_BILL_AMOUNT', 'message', 'Bill amount must be greater than zero'));
    END IF;

    -- 2. Lock member first to maintain unified lock ordering (Member -> Reservation)
    SELECT id INTO v_member_id
    FROM public.loyalty_members
    WHERE restaurant_id = p_restaurant_id AND phone_e164 = p_phone
    FOR UPDATE;

    IF v_member_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', jsonb_build_object('code', 'MEMBER_NOT_FOUND', 'message', 'Member not found for phone'));
    END IF;

    -- 3. Check for existing active redemption on (outlet_id, invoice_no)
    SELECT id, member_id, phone_e164, points_burned, discount_amount_paise, reservation_id, status
    INTO v_existing_redemption
    FROM public.petpooja_redemptions
    WHERE outlet_id = p_outlet_id
      AND invoice_no = p_invoice_no
      AND status IN ('PENDING_OTP', 'HELD')
    FOR UPDATE;

    IF v_existing_redemption.id IS NOT NULL THEN
        -- Case A: Idempotent retry (same phone and same points)
        IF v_existing_redemption.phone_e164 = p_phone AND v_existing_redemption.points_burned = p_points THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'reservation_id', v_existing_redemption.reservation_id,
                'points', v_existing_redemption.points_burned,
                'discount_paise', v_existing_redemption.discount_amount_paise,
                'redemption_id', v_existing_redemption.id
            );
        ELSE
            -- Case B: Different points or phone -> release old hold and cancel old redemption row
            IF v_existing_redemption.reservation_id IS NOT NULL THEN
                PERFORM public.fn_loyalty_release_points(p_restaurant_id, v_existing_redemption.reservation_id);
            END IF;

            UPDATE public.petpooja_redemptions
            SET status = 'CANCELLED',
                updated_at = NOW()
            WHERE id = v_existing_redemption.id;
        END IF;
    END IF;

    -- 4. Delegate validation & point reservation to fn_loyalty_reserve_points
    v_reserve_res := public.fn_loyalty_reserve_points(p_restaurant_id, p_phone, p_points, p_bill_paise, p_ttl_seconds);

    IF (v_reserve_res->>'success')::BOOLEAN IS NOT TRUE THEN
        RETURN v_reserve_res;
    END IF;

    v_reservation_id := (v_reserve_res->>'reservation_id')::UUID;
    v_discount_paise := (v_reserve_res->>'discount_paise')::BIGINT;
    v_expires_at := (v_reserve_res->>'expires_at')::TIMESTAMPTZ;

    -- 5. Insert new petpooja_redemptions row
    BEGIN
        INSERT INTO public.petpooja_redemptions (
            restaurant_id,
            outlet_id,
            member_id,
            phone_e164,
            invoice_no,
            kind,
            status,
            points_burned,
            discount_amount_paise,
            reservation_id,
            expires_at
        ) VALUES (
            p_restaurant_id,
            p_outlet_id,
            v_member_id,
            p_phone,
            p_invoice_no,
            'CASHBACK',
            'HELD',
            p_points,
            v_discount_paise,
            v_reservation_id,
            v_expires_at
        ) RETURNING id INTO v_redemption_id;
    EXCEPTION WHEN unique_violation THEN
        -- Handle parallel cross-member collision on same invoice: release newly created reservation
        PERFORM public.fn_loyalty_release_points(p_restaurant_id, v_reservation_id);
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'ACTIVE_REDEMPTION_EXISTS',
                'message', 'An active redemption already exists for this invoice'
            )
        );
    END;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'reservation_id', v_reservation_id,
        'points', p_points,
        'discount_paise', v_discount_paise,
        'redemption_id', v_redemption_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.fn_petpooja_redeem(TEXT, UUID, TEXT, TEXT, INT, BIGINT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_petpooja_redeem(TEXT, UUID, TEXT, TEXT, INT, BIGINT, INT) TO service_role;
