import {
  LoyaltyApiError,
  ProgramSummaryResponse,
  CustomerProfile,
  CustomerLookupResponse,
  CustomerUpsertInput,
  ReservationInput,
  ReservationResponse,
  CommitResponse,
  OrderIngestInput,
  OrderProcessResponse,
  RefundResponse
} from './types';

export interface LoyaltyClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}

export class LoyaltyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: LoyaltyClientOptions) {
    if (!options.apiKey) {
      throw new Error('API key (lk_live_... or lk_test_...) is required');
    }
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl || 'https://yeezy-loyalty.onrender.com/v1').replace(/\/+$/, '');
    this.fetchImpl = options.fetch || globalThis.fetch.bind(globalThis);
  }

  private async request<T>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      idempotencyKey?: string;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };

    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const response = await this.fetchImpl(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const err = json?.error || {
        code: `HTTP_${response.status}`,
        message: response.statusText || 'Unknown error'
      };
      throw new LoyaltyApiError(response.status, err);
    }

    return json as T;
  }

  async ping(): Promise<ProgramSummaryResponse> {
    return this.request<ProgramSummaryResponse>('/ping');
  }

  async getProgram(): Promise<any> {
    return this.request('/program');
  }

  async lookupCustomer(phone: string, billPaise?: number): Promise<CustomerLookupResponse> {
    const params = new URLSearchParams({ phone });
    if (billPaise !== undefined) {
      params.append('bill_paise', billPaise.toString());
    }
    return this.request<CustomerLookupResponse>(`/customers/lookup?${params.toString()}`);
  }

  async upsertCustomer(phone: string, data: CustomerUpsertInput): Promise<CustomerProfile> {
    return this.request<CustomerProfile>(`/customers/${encodeURIComponent(phone)}`, {
      method: 'PUT',
      body: data
    });
  }

  async reservePoints(input: ReservationInput, idempotencyKey?: string): Promise<ReservationResponse> {
    return this.request<ReservationResponse>('/redemptions/reserve', {
      method: 'POST',
      body: input,
      idempotencyKey
    });
  }

  async commitPoints(reservationId: string, orderId?: string, idempotencyKey?: string): Promise<CommitResponse> {
    return this.request<CommitResponse>(`/redemptions/${reservationId}/commit`, {
      method: 'POST',
      body: orderId ? { order_id: orderId } : {},
      idempotencyKey
    });
  }

  async releasePoints(reservationId: string, idempotencyKey?: string): Promise<{ success: boolean; reservation_id: string; status: string }> {
    return this.request(`/redemptions/${reservationId}/release`, {
      method: 'POST',
      idempotencyKey
    });
  }

  async processOrder(input: OrderIngestInput, idempotencyKey?: string): Promise<OrderProcessResponse> {
    return this.request<OrderProcessResponse>('/orders', {
      method: 'POST',
      body: input,
      idempotencyKey
    });
  }

  async refundOrder(orderId: string, refundPaise?: number, idempotencyKey?: string): Promise<RefundResponse> {
    return this.request<RefundResponse>(`/orders/${orderId}/refund`, {
      method: 'POST',
      body: refundPaise !== undefined ? { refund_paise: refundPaise } : {},
      idempotencyKey
    });
  }
}
