import fs from 'node:fs';
import path from 'node:path';

const SDK_DIR = path.resolve('packages/sdk');
const SRC_DIR = path.join(SDK_DIR, 'src');

export function generateSdk() {
  console.log('Generating @yourbrand/loyalty-sdk from openapi.yaml...');

  fs.mkdirSync(SRC_DIR, { recursive: true });

  // 1. package.json
  const pkgJson = {
    name: '@yourbrand/loyalty-sdk',
    version: '1.0.0',
    description: 'Official typed TypeScript SDK for Standalone Multi-Tenant Loyalty Platform',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc'
    },
    engines: {
      node: '>=18.0.0'
    }
  };
  fs.writeFileSync(path.join(SDK_DIR, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // 2. tsconfig.json
  const tsConfig = {
    compilerOptions: {
      target: 'ES2022',
      module: 'CommonJS',
      moduleResolution: 'node',
      declaration: true,
      outDir: './dist',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true
    },
    include: ['src/**/*']
  };
  fs.writeFileSync(path.join(SDK_DIR, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));

  // 3. src/types.ts
  const typesContent = `/**
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
`;
  fs.writeFileSync(path.join(SRC_DIR, 'types.ts'), typesContent);

  // 4. src/client.ts
  const clientContent = `import {
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
    this.baseUrl = (options.baseUrl || 'https://yeezy-loyalty.onrender.com/v1').replace(/\\/+$/, '');
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
    const url = \`\${this.baseUrl}\${endpoint}\`;
    const headers: Record<string, string> = {
      'Authorization': \`Bearer \${this.apiKey}\`,
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
        code: \`HTTP_\${response.status}\`,
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
    return this.request<CustomerLookupResponse>(\`/customers/lookup?\${params.toString()}\`);
  }

  async upsertCustomer(phone: string, data: CustomerUpsertInput): Promise<CustomerProfile> {
    return this.request<CustomerProfile>(\`/customers/\${encodeURIComponent(phone)}\`, {
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
    return this.request<CommitResponse>(\`/redemptions/\${reservationId}/commit\`, {
      method: 'POST',
      body: orderId ? { order_id: orderId } : {},
      idempotencyKey
    });
  }

  async releasePoints(reservationId: string, idempotencyKey?: string): Promise<{ success: boolean; reservation_id: string; status: string }> {
    return this.request(\`/redemptions/\${reservationId}/release\`, {
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
    return this.request<RefundResponse>(\`/orders/\${orderId}/refund\`, {
      method: 'POST',
      body: refundPaise !== undefined ? { refund_paise: refundPaise } : {},
      idempotencyKey
    });
  }
}
`;
  fs.writeFileSync(path.join(SRC_DIR, 'client.ts'), clientContent);

  // 5. src/index.ts
  const indexContent = `export * from './types';
export * from './client';
`;
  fs.writeFileSync(path.join(SRC_DIR, 'index.ts'), indexContent);

  console.log(`SDK generation complete! Files written to: ${SDK_DIR}`);
}

if (process.argv[1]?.endsWith('generate-sdk.ts') || process.argv[1]?.endsWith('generate-sdk.js')) {
  generateSdk();
}
