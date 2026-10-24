# Custom POS / Direct API Integration Guide

## Overview

For POS systems not natively supported, or for custom integrations, use the **Yeezy Loyalty Public API v1**. This is a RESTful API with API key authentication.

**Integration Type:** Direct REST API  
**Authentication:** Bearer token (API Key)  
**Real-time:** Yes - all operations are synchronous  
**Idempotency:** Required for all write operations

## Base URL

```
https://api.yeezy-loyalty.com/v1
```

## Authentication

### Generate API Key

```bash
curl -X POST "https://api.yeezy-loyalty.com/api/marketplace/api-keys" \
  -H "Authorization: Bearer <your_session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production POS Integration",
    "scopes": ["customers:read", "customers:write", "points:earn", "points:redeem"],
    "expiresInDays": 365
  }'
```

**Response (key shown ONCE only):**
```json
{
  "status": "success",
  "apiKey": {
    "id": "uuid",
    "name": "Production POS Integration",
    "key_prefix": "lk_live_abc123",
    "last4": "def4",
    "scopes": ["customers:read", "customers:write", "points:earn", "points:redeem"],
    "is_test": false,
    "expires_at": "2025-01-15T00:00:00Z",
    "created_at": "2024-01-15T00:00:00Z",
    "key": "lk_live_abc123...def4"  // ONLY SHOWN ONCE!
  }
}
```

### Using the API Key

```http
Authorization: Bearer lk_live_abc123...def4
Idempotency-Key: unique-request-id-123
Content-Type: application/json
```

### Test vs Production Keys

| Prefix | Environment | Use Case |
|--------|-------------|----------|
| `lk_test_` | Sandbox | Development, testing |
| `lk_live_` | Production | Live customer data |

## Required Scopes

| Scope | Endpoints |
|-------|-----------|
| `customers:read` | `GET /v1/customers/lookup`, `GET /v1/ping`, `GET /v1/program` |
| `customers:write` | `PUT /v1/customers/:phone` |
| `points:earn` | `POST /v1/orders`, `POST /v1/orders/:id/refund` |
| `points:redeem` | `POST /v1/redemptions/reserve`, `POST /v1/redemptions/:id/commit`, `POST /v1/redemptions/:id/release` |

## Endpoints

### 1. Verify Connection
```http
GET /v1/ping
```

**Response:**
```json
{
  "restaurant_id": "ten_abc123",
  "restaurant_name": "My Restaurant",
  "is_active": true,
  "point_value_paise": 100,
  "earn_base_rate_bps": 500
}
```

### 2. Get Program Configuration
```http
GET /v1/program
```

**Response:**
```json
{
  "point_value_paise": 100,
  "earn": { "base_rate_bps": 500, ... },
  "redeem": { "min_points": 50, "min_bill_paise": 30000, "max_percent_of_bill": 20 },
  "tiers": [{ "name": "Silver", "min_visits": 0, "multiplier": 1.0 }, ...]
}
```

### 3. Lookup Customer
```http
GET /v1/customers/lookup?phone=+919876543210&bill_paise=150000
```

**Response:**
```json
{
  "found": true,
  "customer": {
    "id": "mem_...",
    "phone_e164": "+919876543210",
    "name": "John Doe",
    "tier": "Gold",
    "available_points": 1250,
    "active_reservations_points": 0,
    "lifetime_spend_paise": 1250000,
    "visit_count": 8
  },
  "redemption_eligibility": {
    "eligible": true,
    "max_points_allowed": 280,
    "max_discount_paise": 28000,
    "ineligible_reason": null
  }
}
```

### 4. Upsert Customer
```http
PUT /v1/customers/+919876543210
```
```json
{
  "name": "John Doe",
  "birthday": "1990-05-15",
  "anniversary": "2020-06-20"
}
```

### 5. Reserve Points (Two-Phase Redemption)
```http
POST /v1/redemptions/reserve
Idempotency-Key: reserve-ORDER-12345-1
```
```json
{
  "phone": "+919876543210",
  "points": 200,
  "bill_paise": 150000,
  "ttl_seconds": 900
}
```

**Response:**
```json
{
  "success": true,
  "reservation_id": "res_...",
  "points_reserved": 200,
  "discount_paise": 20000,
  "expires_at": "2024-01-15T14:45:00Z",
  "expires_in_seconds": 895
}
```

### 6. Commit Redemption
```http
POST /v1/redemptions/res_.../commit
Idempotency-Key: commit-ORDER-12345-1
```
```json
{
  "order_id": "ORDER-12345"
}
```

**Response:**
```json
{
  "success": true,
  "reservation_id": "res_...",
  "points_committed": 200,
  "order_id": "ORDER-12345"
}
```

### 7. Release Redemption (Cancel)
```http
POST /v1/redemptions/res_.../release
Idempotency-Key: release-ORDER-12345-1
```

### 8. Report Paid Order (Earn Points)
```http
POST /v1/orders
Idempotency-Key: ORDER-12345-paid
```
```json
{
  "order_id": "ORDER-12345",
  "phone": "+919876543210",
  "subtotal_paise": 140000,
  "order_type": "dine_in",
  "reservation_id": "res_..."
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "ORDER-12345",
  "points_earned": 75,
  "reservation_committed": true,
  "new_balance": 1125,
  "tier": "Gold",
  "visit_count": 9
}
```

### 9. Refund Order (Reverse Points)
```http
POST /v1/orders/ORDER-12345/refund
Idempotency-Key: refund-ORDER-12345-1
```
```json
{
  "refund_paise": 150000
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "ORDER-12345",
  "points_reversed": 75,
  "new_balance": 1050
}
```

## Error Handling

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Missing required scope |
| `INVALID_API_KEY_FORMAT` | 401 | Key must start with `lk_live_` or `lk_test_` |
| `API_KEY_REVOKED` | 401 | Key has been revoked |
| `API_KEY_EXPIRED` | 401 | Key has expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `CUSTOMER_NOT_FOUND` | 404 | No member found for phone |
| `MIN_BILL_NOT_MET` | 400 | Bill below minimum for redemption |
| `BELOW_MIN_POINTS` | 400 | Insufficient points balance |
| `INSUFFICIENT_POINTS` | 400 | Not enough points for requested redemption |
| `RESERVATION_EXPIRED` | 409 | Reservation TTL expired |
| `IDEMPOTENCY_CONFLICT` | 409 | Duplicate idempotency key |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

## Idempotency

**All write operations require an `Idempotency-Key` header.**

- Use a unique key per business operation (e.g., `ORDER-12345-paid`)
- Keys expire after 24 hours
- Duplicate requests with same key return cached response
- Format: `<operation>-<business_id>-<sequence>`

Examples:
- `ORDER-12345-paid`
- `reserve-ORDER-12345-1`
- `commit-res_abc-ORDER-12345`
- `refund-ORDER-12345-1`

## Rate Limiting

- **Default:** 100 requests/minute per API key
- **Burst:** 200 requests/minute
- **Headers returned:**
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## SDKs

### Node.js
```bash
npm install @yeezy-loyalty/sdk
```

```javascript
import { YeezyLoyaltyClient } from '@yeezy-loyalty/sdk';

const client = new YeezyLoyaltyClient({
  apiKey: 'lk_live_...',
  baseUrl: 'https://api.yeezy-loyalty.com/v1'
});

// Lookup customer
const customer = await client.lookupCustomer('+919876543210', 150000);

// Report paid order
const result = await client.reportOrder({
  orderId: 'ORDER-12345',
  phone: '+919876543210',
  subtotalPaise: 140000,
  orderType: 'dine_in'
});

// Reserve and commit redemption
const reservation = await client.reserveRedemption({
  phone: '+919876543210',
  points: 200,
  billPaise: 150000
});

await client.commitRedemption(reservation.reservationId, 'ORDER-12345');
```

### Python
```bash
pip install yeezy-loyalty
```

```python
from yeezy_loyalty import YeezyLoyaltyClient

client = YeezyLoyaltyClient(
    api_key='lk_live_...',
    base_url='https://api.yeezy-loyalty.com/v1'
)

# Lookup customer
customer = client.lookup_customer('+919876543210', bill_paise=150000)

# Report paid order
result = client.report_order(
    order_id='ORDER-12345',
    phone='+919876543210',
    subtotal_paise=140000,
    order_type='dine_in'
)

# Reserve and commit redemption
reservation = client.reserve_redemption(
    phone='+919876543210',
    points=200,
    bill_paise=150000
)

client.commit_redemption(reservation.reservation_id, 'ORDER-12345')
```

## Webhook Integration (Alternative)

If you prefer webhooks over polling, configure webhook endpoints in your POS to receive:

- `loyalty.points.earned` - Points awarded
- `loyalty.points.redeemed` - Points burned
- `loyalty.customer.tier_changed` - Tier upgrade/downgrade
- `loyalty.redemption.expired` - Reservation expired

Configure webhook URL in your restaurant settings.

## Testing Checklist

- [ ] API key generated with correct scopes
- [ ] `GET /v1/ping` returns success
- [ ] Customer lookup works for existing and new phones
- [ ] Order reporting earns correct points
- [ ] Redemption reserve/commit/release flow works
- [ ] Refund reverses points correctly
- [ ] Idempotency keys prevent duplicate processing
- [ ] Rate limits handled gracefully
- [ ] Error responses parsed correctly
- [ ] Webhook signatures verified (if using webhooks)

## Production Deployment

1. **Use production API keys** (`lk_live_`)
2. **Store keys securely** - environment variables, secret managers
3. **Implement retry logic** with exponential backoff
4. **Monitor webhook delivery** and API latency
5. **Set up alerts** for failed requests
5. **Rotate keys** every 90 days
6. **Use idempotency keys** for all writes

## Support

- **Email:** integrations@yeezy-loyalty.com
- **API Status:** https://status.yeezy-loyalty.com
- **Documentation:** https://docs.yeezy-loyalty.com/api
- **SDK Repo:** https://github.com/yeezy-loyalty/sdk