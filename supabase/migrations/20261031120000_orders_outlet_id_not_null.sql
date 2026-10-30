-- ============================================================================
-- ENFORCE NOT NULL ON ORDERS.OUTLET_ID
-- Migration: 20261031_orders_outlet_id_not_null.sql
--
-- Closes the idempotency bypass where rows with outlet_id = NULL were excluded
-- from the partial unique index uq_orders_outlet_pos_order_id.
-- ============================================================================

-- Backfill any legacy orphaned rows before altering constraint
UPDATE public.orders 
SET outlet_id = (SELECT id FROM public.outlets LIMIT 1) 
WHERE outlet_id IS NULL;

-- Enforce NOT NULL on orders.outlet_id
ALTER TABLE public.orders ALTER COLUMN outlet_id SET NOT NULL;
