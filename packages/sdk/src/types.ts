/**
 * Canonical Types for Yeezy Loyalty Platform API v1
 * Generated directly from openapi.yaml
 * All monetary amounts are integer paise (₹1 = 100 paise).
 */

export interface LoyaltyError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class LoyaltyApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: Record<string, any>;

  constructor(status: number, error: LoyaltyError) {
    super(error.message);
    this.name = 'LoyaltyApiError';
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

export interface ProgramSummaryResponse {
  restaurant_id: string;
  restaurant_name: string;
  is_active: boolean;
  point_value_paise: number;
  earn_base_rate_bps: number;
}

export interface CustomerProfile {
  id: string;
  phone_e164: string;
  name: string | null;
  tier: string;
  available_points: number;
  active_reservations_points: number;
  lifetime_spend_paise: number;
  visit_count: number;
}

export interface CustomerLookupResponse {
  found: boolean;
  customer?: CustomerProfile;
  redemption_eligibility?: {
    eligible: boolean;
    max_points_allowed: number;
    max_discount_paise: number;
    ineligible_reason?: string;
  };
}

export interface CustomerUpsertInput {
  name?: string;
  birthday?: string;
  anniversary?: string;
}

export interface ReservationInput {
  phone: string;
  points: number;
  bill_paise: number;
  ttl_seconds?: number;
}

export interface ReservationResponse {
  success: boolean;
  reservation_id: string;
  points_reserved: number;
  discount_paise: number;
  expires_at: string;
  remaining_available_balance: number;
}

export interface CommitResponse {
  success: boolean;
  reservation_id: string;
  order_id: string;
  redeemed_points: number;
  discount_paise: number;
  new_balance: number;
  idempotent?: boolean;
}

export interface OrderIngestInput {
  order_id: string;
  phone: string;
  subtotal_paise: number;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  reservation_id?: string;
  discount_paise?: number;
  metadata?: Record<string, any>;
}

export interface OrderProcessResponse {
  success: boolean;
  order_id: string;
  points_earned: number;
  reservation_committed: boolean;
  new_balance: number;
  tier: string;
  visit_count: number;
}

export interface RefundResponse {
  success: boolean;
  order_id: string;
  points_reversed: number;
  new_balance: number;
}
