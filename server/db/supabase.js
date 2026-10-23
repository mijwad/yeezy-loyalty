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

// Async helper to push a customer to Supabase
export async function syncCustomerToSupabase(customer) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('customers')
      .upsert({
        id: customer.id,
        phone: customer.phone,
        name: customer.name,
        email: customer.email,
        tier: customer.tier || 'New',
        points_balance: customer.pointsBalance || 0,
        lifetime_spend: customer.lifetimeSpend || 0,
        visits_count: customer.visits || 0,
        updated_at: new Date().toISOString()
      }, { onConflict: 'phone' });

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
        id: order.orderId,
        pos_order_id: order.orderId,
        bill_number: order.billNo,
        customer_phone: order.customerPhone,
        customer_name: order.customerName,
        subtotal: order.financials?.subtotal || 0,
        gross_amount: order.financials?.grossAmount || 0,
        loyalty_discount: order.financials?.loyaltyDiscount || 0,
        net_paid: order.financials?.netPaid || 0,
        points_earned: order.pointsEarned || 0,
        points_burned: order.pointsBurned || 0,
        settled_at: order.settledAt || new Date().toISOString()
      }, { onConflict: 'pos_order_id' });

    if (error) console.warn('[Supabase Order Sync Notice]', error.message);
    return data;
  } catch (err) {
    console.warn('[Supabase Sync Catch]', err.message);
    return null;
  }
}
