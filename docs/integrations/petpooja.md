# Petpooja Integration Guide

## Overview

Petpooja is India's leading restaurant POS and management platform. This guide walks you through integrating Petpooja with Yeezy Loyalty Platform.

**Integration Type:** Webhook-based  
**Authentication:** HMAC-SHA256 signature verification  
**Real-time:** Yes - customer lookup, points redemption, auto points earning

## Prerequisites

- Active Petpooja Partner account
- Yeezy Loyalty restaurant account
- Outlet configured in Petpooja with `restID`

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

### 2. Create Outlet for Petpooja

```bash
curl -X POST "https://api.yeezy-loyalty.com/api/marketplace/outlets" \
  -H "Authorization: Bearer <your_session_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Outlet",
    "address": "123 Main St, Delhi",
    "posSystem": "petpooja",
    "restId": "PP_DEL_101"
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
    "posSystem": "petpooja",
    "webhookSecret": "<appKey_from_step_2>"
  }'
```

**Response includes:**
- `webhookUrl` - Configure this in Petpooja dashboard
- `integrationGuide` - Detailed setup instructions

### 4. Configure Petpooja Dashboard

1. Log in to **Petpooja Partner Dashboard**
2. Go to **Integrations** → **Loyalty Programs** → **Add New**
3. Select **"Yeezy Loyalty"** or **"Custom Webhook"**
4. Configure:
   - **Webhook URL:** `https://api.yeezy-loyalty.com/pos/petpooja/loyalty/inquire`
   - **Webhook Secret:** Use the `appKey` from step 2
   - **RestID:** Your outlet's `restId` (e.g., `PP_DEL_101`)
5. Save and click **"Test Connection"**
6. Enable **"Loyalty Points"** in billing screen settings

### 5. Test the Integration

```bash
curl -X POST "https://api.yeezy-loyalty.com/api/marketplace/webhook-test/petpooja" \
  -H "Authorization: Bearer <your_session_token>"
```

## Webhook Events

### Customer Lookup (Inquire)
**Endpoint:** `POST /pos/petpooja/loyalty/inquire`

**Request:**
```json
{
  "restID": "PP_DEL_101",
  "customer_phone": "+919876543210",
  "customer_name": "John Doe",
  "bill_amount": 1500,
  "discountable_amount": 1400,
  "order_id": "ORD-12345",
  "table_no": "T-5",
  "server_name": "Waiter Name"
}
```

**Response:**
```json
{
  "status": "success",
  "outlet": { "name": "Main Outlet", "restID": "PP_DEL_101" },
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
    "message": "John Doe has 1250 points available. Maximum eligible discount is ₹280."
  },
  "available_points": 1250,
  "redemption_options": [...]
}
```

### Points Lock (Redemption)
**Endpoint:** `POST /pos/petpooja/loyalty/lock`

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
**Endpoint:** `POST /pos/petpooja/orders/save`

**Request:**
```json
{
  "restID": "PP_DEL_101",
  "order_id": "ORD-12345",
  "bill_number": "BILL-67890",
  "table_no": "T-5",
  "server_name": "Waiter Name",
  "customer": { "phone": "+919876543210", "name": "John Doe" },
  "financials": {
    "subtotal": 1400,
    "discount": 200,
    "tax": 252,
    "service_charge": 70,
    "net_paid": 1522,
    "loyalty_discount": 200,
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
**Endpoint:** `POST /pos/petpooja/orders/cancel`

**Request:**
```json
{
  "restID": "PP_DEL_101",
  "order_id": "ORD-12345",
  "reason": "Customer cancelled"
}
```

## Signature Verification

Petpooja sends HMAC-SHA256 signature in `X-Petpooja-Signature` header.

```javascript
const crypto = require('crypto');

function verifyPetpoojaWebhook(req, secret) {
  const signature = req.headers['x-petpooja-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhook/petpooja/loyalty/inquire', (req, res) => {
  if (!verifyPetpoojaWebhook(req, process.env.PETPOOJA_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  // Forward to Yeezy Loyalty
  forwardToYeezy(req.body);
});
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

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid signature" | Check webhook secret matches in both Petpooja and Yeezy |
| "Outlet not found" | Verify `restID` matches exactly in both systems |
| "Program not found" | Ensure loyalty program is active in Yeezy Dashboard |
| Points not earning | Check `order_type` is in allowed list (`dine_in`, `takeaway`) |

## Support

- **Email:** integrations@yeezy-loyalty.com
- **Documentation:** https://docs.yeezy-loyalty.com/integrations/petpooja
- **Status Page:** https://status.yeezy-loyalty.com