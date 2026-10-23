// Supabase Cloud PostgreSQL Client & Sync Adapter
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mwwfsyyqqnkpvdgtqmyz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_l3VJygSx_AxtavnHQnF4Ow_Jg8mANyl';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000002';

// Async helper to push a customer to Supabase
export async function syncCustomerToSupabase(customer) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('customers')
      .upsert({
        tenant_id: DEFAULT_TENANT_ID,
        phone_number: customer.phone,
        full_name: customer.name,
        email: customer.email,
        points_balance: customer.pointsBalance || 0,
        lifetime_spend: customer.lifetimeSpend || 0,
        total_visits_count: customer.visits || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id,phone_number' });

    if (error) console.warn('[Supabase Customer Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Sync Catch]', err.message);
    return null;
  }
}

// Async helper to push an ingested Petpooja order to Supabase
export async function syncOrderToSupabase(order) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('orders')
      .upsert({
        tenant_id: DEFAULT_TENANT_ID,
        outlet_id: DEFAULT_OUTLET_ID,
        pos_system: 'PETPOOJA',
        pos_order_id: String(order.orderId),
        pos_bill_no: String(order.billNo || order.orderId),
        subtotal_amount: order.financials?.subtotal || 0,
        gross_bill_amount: order.financials?.grossAmount || 0,
        loyalty_discount_amount: order.financials?.loyaltyDiscount || 0,
        net_payable_amount: order.financials?.netPaid || 0,
        points_earned_on_bill: order.pointsEarned || 0,
        points_redeemed_on_bill: order.pointsBurned || 0
      }, { onConflict: 'outlet_id,pos_bill_no' });

    if (error) console.warn('[Supabase Order Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Sync Catch]', err.message);
    return null;
  }
}
