# Petpooja POS Loyalty Integration: Architecture Readiness Audit & Implementation Plan

**Auditor:** Senior Backend Architect  
**Repository:** `mijwad/yeezy-loyalty` (bee.loyalty platform)  
**Target POS Integration:** Petpooja Third-Party Loyalty API (Inbound Webhook Specification)  
**Date:** October 2026  
**Document Status:** Complete Readiness Audit Report  

---

## 1. Executive Summary & Verdict

### Verdict: **NEEDS REFACTOR FIRST (Ready with Targeted Structural Adapter)**

> [!IMPORTANT]
> **Summary Justification:**  
> The mathematical core in [`lib/loyalty/engine.ts`](file:///d:/yeezy-loyalty/lib/loyalty/engine.ts) and the underlying Supabase PostgreSQL transactional ledger RPCs in [`supabase/migrations/20261024_init_production_schema.sql`](file:///d:/yeezy-loyalty/supabase/migrations/20261024_init_production_schema.sql) are production-grade (14/14 passing tests, strict integer paise arithmetic, row-locked reservation holds, and FIFO point allocation).
> 
> However, the existing POS integration layer in [`server/pos/PetpoojaAdapter.js`](file:///d:/yeezy-loyalty/server/pos/PetpoojaAdapter.js) and [`server/routes/posUnified.js`](file:///d:/yeezy-loyalty/server/routes/posUnified.js) was built against a **fictional, non-compliant webhook specification** (expecting routes `/pos/petpooja/loyalty/inquire`, `/lock`, `/orders/save` with custom HMAC headers, proprietary JSON payloads, and session tokens). It does **not** implement Petpooja's actual 4-endpoint Third-Party Loyalty API contract.
> 
> Furthermore, several critical primitives are missing:
> 1. The `outlets` table lacks `eatery_branch_code` (Petpooja's primary outlet key).
> 2. There is no `petpooja_rewards` table in the database to define Petpooja reward IDs, `discount_type` (1=percent, 2=fixed, 3=free item), or `pos_item_id`.
> 3. There is zero OTP infrastructure (no generation, hashing, expiry, rate limiting, or dispatch).
> 4. Petpooja POS client requires HTTP 200 with `{ "status": false, "message": "..." }` on business failures; throwing standard HTTP 4xx/5xx errors crashes the POS terminal modal.
>
> **Actionable Path Forward:** Do not touch or modify the existing public `/v1/*` routes or core calculation engine. Implement a clean, dedicated adapter under `/integrations/petpooja/*` (with backward-compatible alias `/pos/petpooja/*`) that translates Petpooja's inbound requests directly into our hardened database services.

---

## 2. Deep-Dive Codebase Investigation (Evidence-Based)

### 2.1 Stack and Structure
- **Framework & Runtime:** Node.js 20+ with native ESM (`"type": "module"` in [`package.json`](file:///d:/yeezy-loyalty/package.json)). Web framework is Express 5.3.0 (`express: ^5.3.0` in [`server/app.js`](file:///d:/yeezy-loyalty/server/app.js)).
- **Database:** Supabase PostgreSQL 15+ accessed via `@supabase/supabase-js: ^2.118.0` in [`server/db/supabase.js`](file:///d:/yeezy-loyalty/server/db/supabase.js).
- **ORM / Query Layer:** There is **no active ORM**. The Prisma schema inside `database/` is uncompiled legacy code. All database interactions occur via PostgREST queries and PostgreSQL stored functions (RPCs) executed via `supabaseAdmin` with the `service_role` secret.
- **Dual-Store Architecture (Technical Debt):** The codebase maintains two conflicting data stores:
  1. Primary PostgreSQL database in Supabase (ACID ledger, row-locks, RPCs).
  2. Legacy file/in-memory store in [`server/db/store.js`](file:///d:/yeezy-loyalty/server/db/store.js) writing to [`server/data/db.json`](file:///d:/yeezy-loyalty/server/data/db.json), utilized by [`server/routes/pos.js`](file:///d:/yeezy-loyalty/server/routes/pos.js).
- **Hosting & Deployment:**
  - Standalone Node.js listener in [`server/index.js`](file:///d:/yeezy-loyalty/server/index.js) (configured for Render via [`render.yaml`](file:///d:/yeezy-loyalty/render.yaml)).
  - Serverless entrypoint in [`api/index.js`](file:///d:/yeezy-loyalty/api/index.js) (configured for Vercel via [`vercel.json`](file:///d:/yeezy-loyalty/vercel.json)).
- **Route Organization & Versioning:** Fractured into 4 overlapping router paths mounted in [`server/app.js`](file:///d:/yeezy-loyalty/server/app.js):
  - `/v1/*` ([`server/routes/v1Public.js`](file:///d:/yeezy-loyalty/server/routes/v1Public.js)) — Clean canonical REST API with Bearer token authentication (`lk_live_*`), rate limiting, and idempotency.
  - `/pos/*` & `/api/v1/pos/*` ([`server/routes/pos.js`](file:///d:/yeezy-loyalty/server/routes/pos.js)) — Legacy in-memory POS mock router with hardcoded pilot keys.
  - `/pos/:posSystem/*` & `/api/v1/pos/:posSystem/*` ([`server/routes/posUnified.js`](file:///d:/yeezy-loyalty/server/routes/posUnified.js)) — Unified adapter router with HMAC verification.
  - `/api/v1/loyalty/*` ([`server/routes/loyalty.js`](file:///d:/yeezy-loyalty/server/routes/loyalty.js)) — Internal admin dashboard routes.

### 2.2 Domain Model & Multi-Tenancy
- **Tenancy:** Modeled via `restaurant_id` (TEXT, e.g. `'ten_yeezy_01'`). Isolation is enforced via application logic (`req.restaurantId` derived from API keys or auth tokens).
- **Row-Level Security (RLS):** Enabled on all PostgreSQL tables in [`supabase/migrations/20261024_init_production_schema.sql`](file:///d:/yeezy-loyalty/supabase/migrations/20261024_init_production_schema.sql). However, because backend Express services query via `supabaseAdmin` (using the PostgreSQL `service_role` secret), PostgREST **bypasses RLS**. Multi-tenant isolation is strictly guarded by the application injecting `p_restaurant_id` into queries and RPCs.
- **Outlets:** Modeled in `public.outlets` ([`supabase/migrations/20261026_pos_integration_tables.sql`](file:///d:/yeezy-loyalty/supabase/migrations/20261026_pos_integration_tables.sql)). Contains `tenant_id`, `rest_id`, `name`, `pos_system`, but **lacks `eatery_branch_code`**, which is Petpooja's primary outlet routing identifier.
- **Customers:** Modeled in `public.loyalty_members`. Keyed by `(restaurant_id, phone_e164)`. Stores metadata: `tier`, `visit_count`, `total_spend_paise`, `current_streak`, `last_visit_at`.
- **Points Ledger:** Modeled in `public.loyalty_ledger`. Points are **never stored as a mutable balance column**. It is an append-only transactional ledger supporting entry types: `earn_base`, `earn_bonus_big_bill`, `earn_bonus_streak`, `earn_referral`, `earn_birthday`, `earn_review`, `earn_winback`, `redeem`, `expire`, `reversal`, and `manual_adjust`.
- **Available Balance Calculation:** Dynamically computed by PostgreSQL function [`fn_loyalty_get_available_balance()`](file:///d:/yeezy-loyalty/supabase/migrations/20261024_init_production_schema.sql#L378-L396):
  $$\text{Available Balance} = \sum(\text{ledger.remaining where unexpired}) - \sum(\text{active unexpired reservations})$$
- **Rewards Catalog:** **Completely absent from database**. Reward options are hardcoded mock objects inside [`server/routes/posUnified.js:700-791`](file:///d:/yeezy-loyalty/server/routes/posUnified.js#L700-L791). There is no table defining Petpooja reward IDs, `discount_type` values (1=percent, 2=fixed, 3=free item), or `pos_item_id`.
- **Redemptions:** Two-phase reservation model in `public.redemption_reservations`:
  - `fn_loyalty_reserve_points`: Row-locks member, verifies balance, creates hold with 15-minute TTL.
  - `fn_loyalty_commit_points`: Deducts points FIFO from oldest unexpired `remaining` ledger rows and marks reservation `committed`.
  - `fn_loyalty_release_points`: Cancels hold and restores unreserved balance.

### 2.3 Existing Loyalty Logic
- **Pure Engine ([`lib/loyalty/engine.ts`](file:///d:/yeezy-loyalty/lib/loyalty/engine.ts)):**
  - All monetary values are integer paise (`₹1 = 100 paise`). Points are whole integers.
  - `calculateEarn()` (line 140): Implements base earn rate (bps), tier multiplier (Silver 1.0x, Gold 1.25x, Platinum 1.5x), promotional multiplier rules (happy hours, festivals), big-bill bonus, streak bonus, and referral bonus.
  - `previewRedeem()` (line 297): Validates minimum bill threshold, minimum points balance, maximum discount cap percentage (e.g. 20%), and converts points to paise via `point_value_paise`.
  - `normalizePhone()` (line 24): Cleans and formats phone numbers to standard E.164 (`+91...`).
- **Reusability Assessment:**
  - Logic in `lib/loyalty/engine.ts` is pure, side-effect-free, and thoroughly tested (14/14 tests in [`lib/loyalty/engine.test.ts`](file:///d:/yeezy-loyalty/lib/loyalty/engine.test.ts)).
  - PostgreSQL RPCs in `supabase/migrations/` encapsulate atomic mutations cleanly.
  - However, route handlers in `server/routes/posUnified.js` and `server/routes/pos.js` are tangled with mock arrays, in-memory store lookups, and incorrect Petpooja webhook assumptions.

---

## 3. Petpooja 4-Endpoint Gap Analysis Table

Petpooja requires the loyalty provider to host **4 specific endpoints** in **their exact payload format**:

| Petpooja Endpoint | Status in bee.loyalty | Existing Code Reference | What is Missing / What Needs to Change |
| :--- | :---: | :--- | :--- |
| **1. Send Order**<br/>`POST`<br/>Earn points on settled bill | 🔴 **Missing** | [`server/routes/posUnified.js:360`](file:///d:/yeezy-loyalty/server/routes/posUnified.js#L360) (handles custom `/orders/save`) | 1. URL path must match Petpooja config.<br/>2. Auth must validate `token` in request body instead of HMAC header.<br/>3. Resolve outlet from `data.Restaurant.eateryBranchCode`.<br/>4. Normalize `data.Customer.phone`.<br/>5. Calculate earn points on `core_total - discount_total` (in integer paise), filtering out Swiggy/Zomato (`orderFrom != 'POS'`).<br/>6. Reconcile with pre-order redemption via `invoice_no` / `orderID`.<br/>7. Return Petpooja response: `{ "status": true/false, "message": "..." }`. |
| **2. Get Rewards**<br/>`POST`<br/>Query points & eligible rewards | 🔴 **Missing** | [`server/routes/posUnified.js:56`](file:///d:/yeezy-loyalty/server/routes/posUnified.js#L56) (handles custom `/loyalty/inquire`) | 1. Accepts `{ token, number, eateryBranchCode, bill_amount }`.<br/>2. Resolve tenant by `eateryBranchCode`.<br/>3. Lookup or auto-create customer by normalized phone.<br/>4. Generate `normal_rewards` list containing `id`, `name`, `points`, `discount_type` (1=percent, 2=fixed, 3=free item), and `pos_item_id`.<br/>5. Return Petpooja response shape `{ status, otp_required, reward_information: { normal_rewards, name, phone, balance_points, redeemable_points } }`. |
| **3. Redeem / Send OTP**<br/>`POST`<br/>Initiate burn or dispatch OTP | 🔴 **Missing** | [`server/routes/posUnified.js:243`](file:///d:/yeezy-loyalty/server/routes/posUnified.js#L243) (handles custom `/loyalty/lock`) | 1. Accepts `{ token, number, reward_points, points, invoice_amount, invoice_no, eateryBranchCode }`.<br/>2. If outlet has `otp_required = true`: generate 4-digit OTP, store SHA-256 hash with 5-minute TTL, dispatch via SMS/WhatsApp, return `{ status: true, message: "OTP sent to customer" }`.<br/>3. If `otp_required = false`: create a 15-minute reservation hold or commit directly linked to `invoice_no`.<br/>4. Return `{ status: true, message, reward_name, reward_type }`. |
| **4. Verify OTP / Redeem**<br/>`POST`<br/>Verify OTP & finalize redemption | 🔴 **Missing** | None exists | 1. Accepts same payload as Endpoint 3 plus `otp`.<br/>2. Verify OTP against active pending redemption session for `(phone, eateryBranchCode, invoice_no)`.<br/>3. Check expiry and max attempt limit (max 3 failed attempts).<br/>4. Row-lock balance and lock points under `invoice_no`.<br/>5. Return `{ status: true, message, reward_name, reward_type }` (or `{ status: false, message: "Invalid OTP" }`). |

---

## 4. Reliability, Safety & Operational Gaps

### 4.1 Customer Lookup & Phone Normalization
- **Current State:** [`lib/loyalty/engine.ts:normalizePhone()`](file:///d:/yeezy-loyalty/lib/loyalty/engine.ts#L24-L46) correctly handles `+91`, `0091`, leading `0`, spaces, and dashes.
- **Identified Gaps:**
  - Cashiers frequently enter dummy numbers (e.g., `9999999999`, `0000000000`, `1111111111`) or leave phone blank. Ingesting dummy numbers aggregates hundreds of random walk-in diners into a single member profile, corrupting balance and analytics.
  - **Fix:** Maintain a phone blacklist (`0000000000`, `9999999999`, `1234567890`) in the adapter; reject redemption and quietly skip point accrual on dummy numbers.

### 4.2 Outlet & Tenant Resolution (`eateryBranchCode` vs `restID`)
- **Current State:** [`server/pos/PetpoojaAdapter.js:getOutletByRestID()`](file:///d:/yeezy-loyalty/server/pos/PetpoojaAdapter.js#L312-L328) resolves outlets via `rest_id = restID`.
- **Identified Gaps:**
  - In Petpooja, `restID` often represents the parent group/brand account, while `eateryBranchCode` is the physical outlet identifier.
  - Petpooja passes `eateryBranchCode` on all 4 endpoints (`Get Rewards`, `Redeem`, `Verify OTP`, and inside `Restaurant.eateryBranchCode` on `Send Order`).
  - The `outlets` table has NO `eatery_branch_code` column.
  - **Fix:** Add `eatery_branch_code VARCHAR(64)` with a unique index to `public.outlets`. Resolve `restaurant_id` primarily by `eateryBranchCode`, falling back to `rest_id`.

### 4.3 Reward Model & Free Item (`pos_item_id`) Mapping
- **Petpooja Specification Requirements:**
  - `normal_rewards`: Array of rewards presented on the cashier terminal.
  - `discount_type`:
    - `1`: Percentage discount (e.g., 10% off).
    - `2`: Fixed currency discount (e.g., ₹100 off).
    - `3`: Free Item (e.g., Free Cold Coffee / Free Brownie).
  - `pos_item_id`: For `discount_type = 3`, Petpooja requires the POS item menu ID so Petpooja can automatically punch that specific dish into the KOT/bill.
- **Current State:**
  - bee.loyalty only has cashback rules (points $\rightarrow$ paise) in `engine.ts` and hardcoded mocks in JavaScript.
  - There is no database table defining active rewards, item mappings, or `pos_item_id` values.
  - **Fix:** Create a `petpooja_rewards` table storing `petpooja_reward_id`, `name`, `points_required`, `discount_type`, `discount_value`, `pos_item_id`, and `min_bill_amount_paise`.

### 4.4 OTP Lifecycle & Messaging Provider Support
- **Current State:**
  - No OTP generation, storage, or verification exists in the backend.
  - [`server/whatsapp/metaClient.js`](file:///d:/yeezy-loyalty/server/whatsapp/metaClient.js) implements Meta Graph API v21.0 for WhatsApp utility templates.
  - SMS is completely unconfigured.
- **Identified Gaps:**
  - For outlets requiring OTP on redemptions (`otp_required = true`):
    1. Cryptographically secure 4-digit OTP generation (`crypto.randomInt(1000, 9999)`).
    2. Secure storage (SHA-256 hash) with 5-minute TTL and max 3 verification attempts.
    3. Dispatch via WhatsApp Cloud API or Indian DLT-compliant SMS gateway.
    4. Support outlet-level toggle `otp_required: false` for frictionless cashier operation.

### 4.5 Redemption-to-Order Reconciliation & Race Conditions
- **The Core POS Problem:**
  - In Petpooja, redemption occurs **before** the bill is paid (during bill editing).
  - The cashier triggers `Redeem` or `Verify OTP`. Petpooja sends `invoice_no` and `points`.
  - The loyalty engine must lock the points so the customer cannot concurrently spend them elsewhere.
  - Minutes later, the bill is settled, and Petpooja calls `Send Order` containing `orderID`.
- **What If the Order Never Settles (Bill Voided / Abandoned)?**
  - **Petpooja has NO order cancellation endpoint in their Third-Party Loyalty API specification!**
  - If points are burned immediately on `Redeem`, and the customer walks out or cancels their order, the customer's points are permanently lost.
- **Resolution Architecture:**
  1. When `Redeem` / `Verify OTP` succeeds, bee.loyalty creates a `petpooja_redemptions` record with `status = 'HELD'` and a 20-minute expiration TTL. The points are placed in a reservation hold (preventing double-spend).
  2. When `Send Order` arrives: match by `invoice_no` or `(outlet_id, customer_phone, date)`. Commit the redemption to `loyalty_ledger` (`type = 'redeem'`) and mark `status = 'SETTLED'`.
  3. A scheduled background worker (or lazy sweep on query) automatically releases any `HELD` redemptions older than 20 minutes back to the customer's balance (`status = 'EXPIRED_RELEASED'`).

### 4.6 Accrual Spend Base (`core_total` vs `total` & Aggregators)
- **Petpooja Order Financial Payload:**
  - `core_total`: Net food & beverage subtotal before taxes and service charges.
  - `total`: Gross bill total including CGST, SGST, packaging, delivery charges, and service charges.
  - `discount_total`: Total discounts applied on POS.
  - `orderFrom`: Indicates channel (`POS`, `Zomato`, `Swiggy`).
- **Loyalty Accrual Rules:**
  - Points must **never** be earned on government taxes, packaging charges, or delivery fees.
  - Eligible Spend Base = `max(0, core_total - discount_total)`.
  - **Aggregator Exclusion:** Orders from Zomato or Swiggy (`orderFrom !== 'POS'`) should be skipped for loyalty accrual unless explicitly enabled per outlet.

---

## 5. Security, Authentication & Operations

### 5.1 Partner Token Architecture
- **Petpooja Specification:** Every inbound request carries a single partner token in the JSON body: `{ "token": "..." }`.
- **Security Vulnerability in Existing Code:**
  - In [`PetpoojaAdapter.js:34-36`](file:///d:/yeezy-loyalty/server/pos/PetpoojaAdapter.js#L34-L36): `"Webhook secret not configured, skipping verification; Allow in dev, block in prod"`. This is an open authentication bypass.
  - Hardcoded pilot keys exist in [`server/routes/pos.js:9-15`](file:///d:/yeezy-loyalty/server/routes/pos.js#L9-L15).
- **Hardened Architecture:**
  - Configure `PETPOOJA_PARTNER_TOKEN` in environment variables.
  - Verify `req.body.token` using constant-time string comparison (`crypto.timingSafeEqual`).
  - Identify outlets strictly by `eateryBranchCode`. Petpooja cannot impersonate an outlet unless the outlet has been registered in bee.loyalty with that `eateryBranchCode`.

### 5.2 Error Response Handling
- **Crucial Petpooja Protocol Constraint:**
  - Petpooja POS client expects HTTP 200 with `{ "status": false, "message": "Reason for rejection" }` for all business failures (e.g., customer not found, insufficient points, expired OTP, below minimum bill).
  - If our API returns standard HTTP 400, 404, 409, or 500 error codes, the Petpooja POS terminal crashes with an unhandled network error or generic "Server Error" modal.
  - **The Petpooja adapter must trap all business exceptions and format them as HTTP 200 `{ "status": false, "message": err.message }`**, reserving HTTP 500 strictly for catastrophic infrastructure downtime.

### 5.3 Audit Logging & Inbound Telemetry
- All raw inbound Petpooja requests, headers, execution latency, and generated responses must be inserted into `webhook_logs` (`pos_system = 'PETPOOJA'`) for immediate operational debugging during restaurant onboarding.

---

## 6. Proposed Implementation Plan

### 6.1 Database Migration Schema Sketch

```sql
-- ============================================================================
-- PETPOOJA POS INTEGRATION SCHEMA EXTENSIONS
-- Migration: supabase/migrations/20261030_petpooja_schema.sql
-- ============================================================================

-- 1. Extend outlets table to support Petpooja eateryBranchCode
ALTER TABLE public.outlets 
    ADD COLUMN IF NOT EXISTS eatery_branch_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS petpooja_token VARCHAR(128),
    ADD COLUMN IF NOT EXISTS otp_required BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS ignore_aggregators BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_outlets_petpooja_branch 
    ON public.outlets (eatery_branch_code) 
    WHERE pos_system = 'PETPOOJA' AND eatery_branch_code IS NOT NULL;

-- 2. Petpooja Reward Catalog
CREATE TABLE IF NOT EXISTS public.petpooja_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    outlet_id UUID REFERENCES public.outlets(id) ON DELETE CASCADE,
    petpooja_reward_id VARCHAR(64) NOT NULL, -- e.g. 'REW_100_OFF', 'REW_FREE_DESSERT'
    name VARCHAR(256) NOT NULL,
    points_required INT NOT NULL CHECK (points_required > 0),
    discount_type INT NOT NULL CHECK (discount_type IN (1, 2, 3)), -- 1=percent, 2=fixed, 3=free item
    discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0, -- e.g. 15.00 (% off) or 100.00 (₹ off)
    pos_item_id VARCHAR(64), -- Petpooja menu item ID for free item (discount_type = 3)
    min_bill_amount_paise BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_petpooja_rewards_outlet_reward UNIQUE (restaurant_id, petpooja_reward_id)
);

-- 3. Petpooja Redemptions & Pre-Order Staging Table
CREATE TABLE IF NOT EXISTS public.petpooja_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id TEXT NOT NULL,
    outlet_id UUID NOT NULL REFERENCES public.outlets(id),
    member_id UUID NOT NULL REFERENCES public.loyalty_members(id),
    phone_e164 VARCHAR(20) NOT NULL,
    invoice_no VARCHAR(128) NOT NULL,
    reward_id VARCHAR(64),
    points_burned INT NOT NULL CHECK (points_burned >= 0),
    discount_amount_paise BIGINT NOT NULL DEFAULT 0,
    discount_type INT NOT NULL DEFAULT 2,
    reward_name VARCHAR(256),
    status VARCHAR(32) NOT NULL DEFAULT 'HELD', -- HELD, SETTLED, EXPIRED_RELEASED, CANCELLED
    reservation_id UUID REFERENCES public.redemption_reservations(id),
    otp_hash VARCHAR(64),
    otp_expires_at TIMESTAMPTZ,
    otp_attempts INT NOT NULL DEFAULT 0,
    settled_order_id VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '20 minutes')
);

CREATE INDEX IF NOT EXISTS idx_petpooja_redemptions_lookup 
    ON public.petpooja_redemptions (outlet_id, invoice_no, status);
CREATE INDEX IF NOT EXISTS idx_petpooja_redemptions_ttl 
    ON public.petpooja_redemptions (expires_at) 
    WHERE status = 'HELD';

-- Enable RLS
ALTER TABLE public.petpooja_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petpooja_redemptions ENABLE ROW LEVEL SECURITY;
```

---

### 6.2 New Isolated Module Layout

To prevent pollution of the canonical `/v1/*` public API, all Petpooja routes will be encapsulated in a dedicated adapter folder:

```
server/
  integrations/
    petpooja/
      petpoojaRouter.js      # Express router hosting the 4 official endpoints
      petpoojaAuth.js        # Validates req.body.token and resolves eateryBranchCode
      petpoojaService.js     # Business logic: lookup, rewards, OTP, holds, earn
      petpoojaSchemas.js     # Zod schema validation for Petpooja payloads
      otpService.js          # Cryptographic OTP generator, hasher, and rate limiter
```

#### Mounting in `server/app.js`:
```javascript
import { petpoojaRouter } from './integrations/petpooja/petpoojaRouter.js';

// Dedicated Petpooja Inbound Adapter (No HMAC headers, authenticates via body.token)
app.use('/integrations/petpooja', petpoojaRouter);
// Compatible alias for legacy route setups
app.use('/pos/petpooja', petpoojaRouter);
```

---

### 6.3 Endpoint Mappings & Implementation Specs

#### 1. Endpoint: `POST /integrations/petpooja/getRewards`
- **Request Validation:** `{ token: string, number: string, eateryBranchCode: string, bill_amount: number }`
- **Logic:**
  1. Authenticate `token` against `process.env.PETPOOJA_PARTNER_TOKEN`.
  2. Resolve outlet via `eatery_branch_code = req.body.eateryBranchCode`.
  3. Clean phone via `normalizePhone(number)`.
  4. Fetch or auto-provision `loyalty_members` row.
  5. Fetch available points via `fn_loyalty_get_available_balance`.
  6. Query active rewards from `petpooja_rewards` for this restaurant/outlet where `min_bill_amount_paise <= (bill_amount * 100)`.
  7. Filter rewards where `points_required <= balance_points`. Also include standard cashback milestone reward if enabled in program config.
- **Response Shape (Strict Petpooja Format):**
  ```json
  {
    "status": true,
    "otp_required": false,
    "reward_information": {
      "name": "Rahul Nair",
      "phone": "9847012345",
      "balance_points": 350,
      "redeemable_points": 350,
      "normal_rewards": [
        {
          "id": "REW_100_OFF",
          "name": "₹100 Off Bill (100 pts)",
          "points": 100,
          "discount_type": 2,
          "pos_item_id": ""
        },
        {
          "id": "REW_FREE_BROWNIE",
          "name": "Free Chocolate Brownie (200 pts)",
          "points": 200,
          "discount_type": 3,
          "pos_item_id": "PP_ITEM_BROW_01"
        }
      ]
    }
  }
  ```

#### 2. Endpoint: `POST /integrations/petpooja/redeemRewards` (Send OTP or Direct Hold)
- **Request Validation:** `{ token, number, reward_points, points, invoice_amount, invoice_no, eateryBranchCode }`
- **Logic:**
  1. Authenticate token & resolve outlet.
  2. If `outlet.otp_required === true`:
     - Generate secure 4-digit OTP (`crypto.randomInt(1000, 9999)`).
     - Store SHA-256 hash in `petpooja_redemptions` with `status = 'PENDING_OTP'`, `expires_at = NOW() + 5 min`.
     - Dispatch OTP via `MetaWhatsAppClient` or SMS gateway.
     - Return: `{ "status": true, "message": "OTP has been sent to customer phone", "reward_name": "...", "reward_type": "2" }`.
  3. If `outlet.otp_required === false`:
     - Call `fn_loyalty_reserve_points` (reserving points for 20 minutes).
     - Insert `petpooja_redemptions` row with `status = 'HELD'`, linking `reservation_id` and `invoice_no`.
     - Return: `{ "status": true, "message": "Reward applied to bill", "reward_name": "...", "reward_type": "2" }`.

#### 3. Endpoint: `POST /integrations/petpooja/verifyOTP`
- **Request Validation:** `{ token, number, reward_points, points, invoice_amount, invoice_no, eateryBranchCode, otp }`
- **Logic:**
  1. Lookup pending redemption for `(outlet_id, invoice_no, status = 'PENDING_OTP')`.
  2. If not found or expired (`expires_at < NOW()`): return `{ "status": false, "message": "OTP expired. Please request a new OTP." }`.
  3. If `otp_attempts >= 3`: return `{ "status": false, "message": "Too many invalid attempts. Redemption locked." }`.
  4. Compare `crypto.createHash('sha256').update(otp).digest('hex')` with stored hash using `timingSafeEqual`.
  5. If match: call `fn_loyalty_reserve_points`, transition status to `'HELD'`, and return:
     `{ "status": true, "message": "OTP verified successfully. Reward applied.", "reward_name": "...", "reward_type": "2" }`.

#### 4. Endpoint: `POST /integrations/petpooja/saveOrder`
- **Request Validation:** `{ token, data: { Restaurant, Customer, Order, OrderItem, Tax, Discount } }`
- **Logic:**
  1. Authenticate `token` & resolve outlet by `data.Restaurant.eateryBranchCode`.
  2. Idempotency Check: query `orders` table by `(restaurant_id, order_id = Order.orderID)`. If already ingested, return `{ "status": true, "message": "Order already recorded" }`.
  3. Filter Aggregators: check `Order.orderFrom`. If `orderFrom.toUpperCase() !== 'POS'` and `outlet.ignore_aggregators === true`:
     Insert order record for telemetry, skip points calculation, return `{ "status": true, "message": "Order saved (Aggregator order skipped for loyalty)" }`.
  4. Check for linked redemption: lookup `petpooja_redemptions` for `(outlet_id, invoice_no = Order.orderID or invoice_no)` with `status = 'HELD'`.
     - If found: commit reservation via `fn_loyalty_commit_points`, mark redemption `'SETTLED'`.
  5. Calculate net eligible spend:
     `netSpendPaise = Math.round(max(0, parseFloat(Order.core_total) - parseFloat(Order.discount_total || 0)) * 100)`.
  6. Award loyalty points via `fn_loyalty_earn_points`:
     Pass `p_restaurant_id`, `p_order_id = Order.orderID`, `p_phone = normalizePhone(Customer.phone)`, `p_subtotal_paise = netSpendPaise`.
  7. Return Petpooja response:
     ```json
     {
       "status": true,
       "message": "Order processed successfully. Points credited."
     }
     ```

---

## 7. Ordered Implementation Task List

| # | Task Description | Scope & Files | Effort | Dependencies |
| :-: | :--- | :--- | :-: | :--- |
| **T1** | **Database Schema Migration**<br/>Add `eatery_branch_code`, `petpooja_rewards`, and `petpooja_redemptions` tables. | `supabase/migrations/20261030_petpooja_schema.sql` | **S** | None |
| **T2** | **Petpooja Auth & Outlet Resolver Middleware**<br/>Constant-time token verification (`req.body.token`) and caching `eateryBranchCode` $\rightarrow$ `outlet_id`. | `server/integrations/petpooja/petpoojaAuth.js` | **S** | T1 |
| **T3** | **OTP Generation & Verification Service**<br/>Secure OTP generation, SHA-256 hashing, 5-minute TTL, max attempt throttling, and Meta WhatsApp Cloud API integration. | `server/integrations/petpooja/otpService.js` | **M** | T1 |
| **T4** | **`Get Rewards` Endpoint Handler**<br/>Customer balance lookup and mapping active rewards catalog to Petpooja `normal_rewards` format. | `server/integrations/petpooja/petpoojaService.js` | **M** | T1, T2 |
| **T5** | **`Redeem` & `Verify OTP` Endpoint Handlers**<br/>Handling both OTP dispatch and non-OTP reservation holds; linking to `invoice_no`. | `server/integrations/petpooja/petpoojaService.js` | **M** | T2, T3 |
| **T6** | **`Send Order` Settlement Handler**<br/>Accrual on `core_total - discount_total`, aggregator exclusion, and reconciling pre-order redemption. | `server/integrations/petpooja/petpoojaService.js` | **L** | T1, T4, T5 |
| **T7** | **Auto-Release TTL Background Worker**<br/>Periodic cleanup function releasing orphaned `HELD` redemptions older than 20 minutes back to customer balance. | `supabase/migrations/` + `cron` | **S** | T1 |
| **T8** | **Comprehensive Integration Tests**<br/>End-to-end tests validating all 4 endpoints against realistic Petpooja mock payloads without touching external servers. | `scripts/test-petpooja-integration.ts` | **M** | T1–T6 |

*Effort Guide: S = 2–4 hours, M = 1 day, L = 2 days.*

---

## 8. Risks, Assumptions & Open Questions for Petpooja

Before completing the integration and turning on live merchant traffic, the following critical operational questions must be confirmed with the Petpooja Technical Integrations team:

1. **`invoice_no` vs `orderID` Consistency:**
   - *Question:* During bill creation, Petpooja sends `invoice_no` in the `Redeem` call. When the order is settled and `Send Order` is called, is `invoice_no` guaranteed to match `Order.orderID`, or does Petpooja generate a new `orderID` (e.g. KOT ID vs Tax Invoice Number)?
   - *Risk:* If they differ, the system cannot link the points burned during redemption to the finalized order without matching on `(eateryBranchCode, phone, timestamp)`.

2. **Retry Policy & Timeout Limits:**
   - *Question:* What is Petpooja's HTTP timeout on `Get Rewards` and `Redeem`? (Standard POS timeout is 3000ms). If bee.loyalty takes 2500ms due to database cold start, does Petpooja retry, and if so, what is the backoff policy?

3. **Bill Void / Cancellation Notification:**
   - *Question:* Does Petpooja have any webhook callback when a bill is cancelled or voided post-tender, or must cancellations be handled exclusively through Petpooja's generic menu/order webhooks?

4. **Sandbox / Staging Environment:**
   - *Question:* Does Petpooja provide a cloud staging simulator, or must all integration testing be conducted against a live physical Petpooja desktop POS terminal running in test mode?

5. **Aggregator (`orderFrom`) Behavior:**
   - *Question:* Does Petpooja call `Send Order` for Zomato and Swiggy online delivery orders that land on the POS? If so, does Petpooja expect the loyalty provider to return `{ status: true }` even if zero loyalty points are earned?

---

## 9. Conclusion
The repository possesses an exceptionally clean mathematical core and an ACID-safe PostgreSQL ledger. The only work required is replacing the legacy, non-compliant POS adapter with an isolated, specification-compliant Petpooja adapter following the architecture detailed in Section 6. Once implemented, bee.loyalty will function seamlessly as an enterprise-grade loyalty partner for Petpooja restaurants.
