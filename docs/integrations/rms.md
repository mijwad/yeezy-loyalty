# RMS (Restaurant Management System) Integration Guide

## Overview

RMS is a custom restaurant POS system with built-in loyalty integration support. This guide walks you through integrating RMS with Yeezy Loyalty Platform.

**Integration Type:** Webhook-based  
**Authentication:** HMAC-SHA256 signature verification  
**Real-time:** Yes - customer lookup, points redemption, auto points earning  
**Multi-outlet:** Supported

## Prerequisites

- RMS Admin Panel access
- Yeezy Loyalty restaurant account
- RMS configured with `restaurant_id` and `store_id`

## Step-by-Step Setup

### 1. Create Restaurant in Yeezy Loyalty

```bash
curl -X POST "https://api.yeezy-loyalty.com/api/v1/auth/register-restaurant" \
  -H "Content-Type: application/json" \
  -d '{
    "brandName": "My Restaurant Chain",
    "ownerName": "John Doe",
    "ownerEmail": "john@myrestaurant.com",
    "password": "securepassword123"
  }'
```

### 2. Create Outlet for RMS

```bash
curl -X POST "https://api.yeezy-loyalty.com/api/marketplace/outlets" \
  -H "Authorization: Bearer <your_session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Outlet",
    "address": "123 Main St, Delhi",
    "posSystem": "rms",
    "restId": "REST_001",
    "posConfig": {
      "storeId": "POS_STORE_001"
    }
  }'
```

**Response includes:**
- `appKey` - Your webhook secret (save this!)
- `reeloKey` - Unique identifier for this outlet

### 3. Connect to Marketplace

```bash
curl -X POST "https://api.yeezy-loyalty.com/api/marketplace/outlets/<outlet_id>/connect" \
  -H "Authorization: Bearer <your_session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "posSystem": "rms",
    "webhookSecret": "<appKey_from_step_2>",
    "posConfig": {
      "storeId": "POS_STORE_001"
    }
  }'
```

**Response includes:**
- `webhookUrl` - Configure this in RMS dashboard
- `integrationGuide` - Detailed setup instructions

### 4. Configure RMS Admin Panel

1. Log in to **RMS Admin Panel**
2. Go to **Settings** → **Integrations** → **Loyalty**
3. Add new loyalty provider: **"Yeezy Loyalty"**
4. Configure:
   - **API Base URL:** `https://api.yeezy-loyalty.com`
   - **Webhook URL:** `https://api.yeezy-loyalty.com/pos/rms/loyalty/inquire`
   - **Restaurant ID:** Your tenant ID (e.g., `ten_abc123`)
   - **Store ID:** Your outlet's `storeId` (e.g., `POS_STORE_001`)
   - **Webhook Secret:** Use the `appKey` from step 2
5. Save and click **"Test Connection"**
6. Enable loyalty on billing screen

### 5. Test the Integration

```bash
curl -X POST "https://api.yeezy-loyalty.com/api/marketplace/webhook-test/rms" \
  -H "Authorization: Bearer <your_session_token>"
```

## Webhook Events

### Customer Lookup (Inquire)
**Endpoint:** `POST /pos/rms/loyalty/inquire`

**Request:**
```json
{
  "restaurant_id": "ten_abc123",
  "store_id": "POS_STORE_001",
  "customer_phone": "+919876543210",
  "customer_name": "John Doe",
  "bill_amount": 1500,
  "discountable_amount": 1400,
  "order_id": "ORD-12345",
  "table_no": "T-5",
  "server_name": "Waiter Name",
  "items": [...]
}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": "mem_...",
    "name": "John Doe",
    "phone": "+919876543210",
    "tier": "Gold",
    "visits": 8,
    "points_balance": 1250,
    "points_value_inr": 1250
  },
  "bill_context": {
    "order_id": "ORD-12345",
    "table_no": "T-5",
    "bill_amount": 1500,
    "discountable_amount": 1400,
    "min_bill_amount_required": 300,
    "max_discount_cap_inr": 280,
    "estimated_points_to_earn": 75
  },
  "redemption_offer": {
    "session_token": "red_sess_...",
    "is_eligible": true,
    "max_redeemable_points": 280,
    "max_discount_amount": 280,
    "requires_otp": false,
    "message": "John Doe has 1250 points available. Maximum eligible discount is ₹280."
  },
  "available_points": 1250,
  "loyalty_rewards": [...],
  "redemption_options": [...]
}
```

### Points Lock (Redemption)
**Endpoint:** `POST /pos/rms/loyalty/lock`

**Request:**
```json
{
  "session_token": "red_sess_...",
  "option_id": "OPT_200_OFF",
  "points_to_redeem": 200
}
```

**Response:**
```json
{
  "success": true,
  "session_token": "red_sess_...",
  "selected_option": { "id": "OPT_200_OFF", "pointsToBurn": 200, "discountInr": 200 },
  "points_locked": 200,
  "discount_applied_inr": 200,
  "net_payable_after_discount": 1300,
  "message": "₹200.00 discount applied to bill (holding 200 points)."
}
```

### Order Settlement (Save)
**Endpoint:** `POST /pos/rms/orders/save`

**Request:**
```json
{
  "restaurant_id": "ten_abc123",
  "store_id": "POS_STORE_001",
  "order_id": "ORD-12345",
  "bill_number": "BILL-67890",
  "table_no": "T-5",
  "server_name": "Waiter Name",
  "customer": { "phone": "+919876543210", "name": "John Doe" },
  "financials": {
    "subtotal": 140000,
    "tax": 25200,
    "service_charge": 7000,
    "loyalty_discount": 20000,
    "net_paid": 152200,
    "payment_mode": "CARD"
  },
  "order_type": "DINE_IN",
  "paid_at": "2024-01-15T14:30:00Z",
  "reservation_id": "red_sess_...",
  "items": [...]
}
```

**Response:**
```json
{
  "success": true,
  "order_id": "ORD-12345",
  "bill_no": "BILL-67890",
  "customer": {
    "name": "John Doe",
    "phone": "+919876543210",
    "tier": "Gold",
    "points_earned": 75,
    "points_burned": 200,
    "new_balance": 1125
  },
  "simulated_notification": {
    "channel": "WHATSAPP_UTILITY",
    "recipient": "+919876543210",
    "sent": true,
    "message": "Hello John Doe! 🎉 Thank you for dining with us..."
  }
}
```

### Order Cancellation
**Endpoint:** `POST /pos/rms/orders/cancel`

**Request:**
```json
{
  "restaurant_id": "ten_abc123",
  "store_id": "POS_STORE_001",
  "order_id": "ORD-12345",
  "reason": "Customer cancelled"
}
```

## Signature Verification

RMS sends HMAC-SHA256 signature in `X-RMS-Signature` header.

```javascript
const crypto = require('crypto');

function verifyRMSWebhook(req, secret) {
  const signature = req.headers['x-rms-signature'] || 
                    req.headers['x-signature'] || 
                    req.headers['x-hmac-sha256'];
  
  if (!signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhook/rms/loyalty/inquire', (req, res) => {
  if (!verifyRMSWebhook(req, process.env.RMS_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Forward to Yeezy Loyalty
  forwardToYeezy(req.body);
});
```

## RMS SDK Integration (Alternative)

If you prefer direct API integration instead of webhooks, use the Public API v1:

### API Key Authentication
```bash
curl -X GET "https://api.yeezy-loyalty.com/v1/ping" \
  -H "Authorization: Bearer lk_live_<your_api_key>"
```

### Customer Lookup
```bash
curl -X GET "https://api.yeezy-loyalty.com/v1/customers/lookup?phone=+919876543210&bill_paise=150000" \
  -H "Authorization: Bearer lk_live_<your_api_key>"
```

### Report Paid Order (Earn Points)
```bash
curl -X POST "https://api.yeezy-loyalty.com/v1/orders" \
  -H "Authorization: Bearer lk_live_<your_api_key>" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: ORDER-12345-paid" \
  -d '{
    "order_id": "ORD-12345",
    "phone": "+919876543210",
    "subtotal_paise": 140000,
    "order_type": "dine_in",
    "reservation_id": "red_sess_..."
  }'
```

## Loyalty Program Configuration

Default configuration (customizable per restaurant):

```json
{
  "point_value_paise": 100,
  "earn": {
    "base_rate_bps": 500,
    "big_bill": { "enabled": true, "threshold_paise": 50000, "bonus_points": 25 },
    "streak": { "enabled": true, "within_days": 7, "bonus_points": 10 }
  },
  "redeem": {
    "min_points": 50,
    "min_bill_paise": 30000,
    "max_percent_of_bill": 20,
    "stackable_with_discounts": false
  },
  "tiers": [
    { "name": "Silver", "min_visits": 0, "multiplier": 1.0 },
    { "name": "Gold", "min_visits": 5, "multiplier": 1.25 },
    { "name": "Platinum", "min_visits": 12, "multiplier": 1.5 }
  ]
}
```

## Multi-Outlet Support

For multi-outlet RMS setups:

1. Create separate outlets in Yeezy Loyalty for each RMS store
2. Each outlet gets its own `storeId` and webhook secret
3. Configure RMS to route requests based on `store_id`
4. Webhook URLs will be:
   - Outlet 1: `https://api.yeezy-loyalty.com/pos/rms/loyalty/inquire` (with store_id: POS_STORE_001)
   - Outlet 2: `https://api.yeezy-loyalty.com/pos/rms/loyalty/inquire` (with store_id: POS_STORE_002)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid signature" | Check webhook secret matches in both RMS and Yeezy |
| "Outlet not found" | Verify `store_id` and `restaurant_id` match exactly |
| "Program not found" | Ensure loyalty program is active in Yeezy Dashboard |
| Points not earning | Check `order_type` is in allowed list (`dine_in`, `takeaway`) |
| Multi-outlet confusion | Ensure each RMS store maps to correct Yeezy outlet |

## Support

- **Email:** integrations@yeezy-loyalty.com
- **Documentation:** https://docs.yeezy-loyalty.com/integrations/rms
- **Status Page:** https://status.yeezy-loyalty.com