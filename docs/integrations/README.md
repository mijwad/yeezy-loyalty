# Yeezy Loyalty - POS Integration Guides

This directory contains integration guides for connecting various POS systems to the Yeezy Loyalty Platform.

## Supported POS Systems

| POS System | Integration Type | Status | Guide |
|------------|------------------|--------|-------|
| **Petpooja** | Webhook | ✅ Production Ready | [petpooja.md](./petpooja.md) |
| **RMS** | Webhook | ✅ Production Ready | [rms.md](./rms.md) |
| **Toast** | API | 🚧 Coming Soon | [toast.md](./toast.md) |
| **Square** | API | 🚧 Coming Soon | [square.md](./square.md) |
| **Custom POS** | REST API v1 | ✅ Production Ready | [custom-api.md](./custom-api.md) |

## Quick Start

### 1. Create Restaurant Account
```bash
POST /api/v1/auth/register-restaurant
{
  "brandName": "My Restaurant",
  "ownerName": "John Doe",
  "ownerEmail": "john@myrestaurant.com",
  "password": "securepassword123"
}
```

### 2. Create Outlet for POS
```bash
POST /api/marketplace/outlets
Authorization: Bearer <token>
{
  "name": "Main Outlet",
  "address": "123 Main St, City",
  "posSystem": "petpooja",
  "restId": "PP_DEL_101"
}
```

### 3. Connect to Marketplace
```bash
POST /api/marketplace/outlets/:outletId/connect
Authorization: Bearer <token>
{
  "posSystem": "petpooja",
  "webhookSecret": "your_webhook_secret_here"
}
```

### 4. Generate API Key (for Custom API integration)
```bash
POST /api/marketplace/api-keys
Authorization: Bearer <token>
{
  "name": "Production API Key",
  "scopes": ["customers:read", "customers:write", "points:earn", "points:redeem"]
}
```

### 5. Get Integration Guide
```bash
GET /api/marketplace/integration-guide/petpooja
Authorization: Bearer <token>
```

## Integration Patterns

### Webhook Integration (Petpooja, RMS)
- POS sends webhook events to Yeezy Loyalty endpoints
- Webhook signature verification for security
- Real-time customer lookup and points redemption
- Automatic points earning on order settlement

### API Integration (Custom, Toast, Square)
- Direct REST API calls from POS to Yeezy Loyalty
- API key authentication (Bearer token)
- Idempotency keys for duplicate protection
- Full control over integration flow

## Authentication

### Dashboard Users (Session Token)
```http
Authorization: Bearer yzy_tok_<session_token>
```

### POS API Keys (Service-to-Service)
```http
Authorization: Bearer lk_live_<api_key>
```

### Webhook Signature Verification
```http
X-Petpooja-Signature: <hmac_sha256>
X-RMS-Signature: <hmac_sha256>
```

## Webhook Endpoints

| Event | Petpooja | RMS | Custom API |
|-------|----------|-----|------------|
| Customer Lookup | `POST /pos/petpooja/loyalty/inquire` | `POST /pos/rms/loyalty/inquire` | `GET /v1/customers/lookup` |
| Points Lock | `POST /pos/petpooja/loyalty/lock` | `POST /pos/rms/loyalty/lock` | `POST /v1/redemptions/reserve` |
| Order Save | `POST /pos/petpooja/orders/save` | `POST /pos/rms/orders/save` | `POST /v1/orders` |
| Order Cancel | `POST /pos/petpooja/orders/cancel` | `POST /pos/rms/orders/cancel` | `POST /v1/orders/:id/refund` |

## Testing Your Integration

### Test Webhook Configuration
```bash
POST /api/marketplace/webhook-test/petpooja
Authorization: Bearer <token>
```

### Test API Key
```bash
GET /v1/ping
Authorization: Bearer lk_live_<api_key>
```

## Production Deployment Checklist

- [ ] Supabase database configured
- [ ] Environment variables set (see `.env.production.example`)
- [ ] Webhook secrets configured for each POS
- [ ] SSL/TLS certificates valid
- [ ] Rate limiting configured
- [ ] Monitoring and alerting set up
- [ ] Backup and disaster recovery plan
- [ ] API keys rotated regularly
- [ ] Webhook secrets rotated regularly

## Support

For integration support, contact: integrations@yeezy-loyalty.com