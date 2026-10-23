# Refactor Plan: Yeezy Loyalty Platform

**Target Architecture:** Multi-Tenant Loyalty SaaS (Next.js App Router, Supabase PostgreSQL 15+, Strict TypeScript)  
**Guiding Principle:** Incremental, non-destructive refactoring. Never break existing builds, tests, or live deployments.

---

## Deployment Target & Express Cutover Plan

### 1. Selected Deployment Target
- **Primary Platform:** **Next.js (App Router) on Vercel** backed by **Supabase PostgreSQL 15+** (with Row-Level Security and stored procedures).
- **Edge CDN & Functions:** Vercel Serverless Functions (`nodejs22.x`) for thin route handlers under `/app/api/v1`.
- **Database & State:** Supabase PostgreSQL with connection pooling (Transaction Mode via PgBouncer on port `6543`, Session Mode on `5432`).

### 2. Four-Stage Express Retirement Plan
1. **Stage 1 (Co-existence & Stored Procedures):**
   - Deploy Supabase RPC functions and migrations.
   - Mount canonical `/app/api/v1/*` routes in Next.js alongside legacy Express endpoints.
   - Legacy routes (`/api/v1/loyalty/*` and `/api/v1/pos/*`) in `server/routes/` are rewired to call the Postgres RPC functions internally, eliminating `db.json` file writes.
2. **Stage 2 (POS & Client SDK Cutover):**
   - Publish `openapi.yaml` and provide the client generator script for external POS repos (Yeezy RMS).
   - External POS traffic cuts over to `/v1/*` authenticated with `lk_live_` API keys.
3. **Stage 3 (Dashboard UI Cutover):**
   - Replace legacy Vanilla JS SPA with Next.js App Router (`/app/(dashboard)/*`) using `shadcn/ui` + Tailwind + Supabase Auth.
4. **Stage 4 (Decommissioning & Cleanup):**
   - Remove `server/index.js`, `server/app.js`, `server/db/store.js`, and legacy Express dependencies (`express`, `cors`).
   - Pure Next.js application codebase.

### 3. Emergency Rollback Plan
- **Git Tag:** Before any destructive cutover, tag the working release as `v1.0.0-express-lts`.
- **Vercel Instant Rollback:** In the Vercel Dashboard $\rightarrow$ Deployments, one-click "Rollback to `v1.0.0-express-lts`" instantly reverts all edge routes to the previous production deployment within 5 seconds without redeploying code.
- **Database Non-Destructive Migrations:** Database migrations will add new tables (`api_keys`, `redemption_reservations`, `idempotency_keys`) and functions without dropping existing legacy columns until Stage 4 is verified.

---

## Shared Contract Specifications & Amendments

1. **Two-Phase Redemption Lifecycle:**
   - `POST /v1/redemptions/reserve`: Holds points for a bill with a 15-minute TTL. Available balance for lookup and reservation is strictly:
     $$\text{Available Balance} = \sum(\text{ledger.remaining}) - \sum(\text{active reservations where status} = \text{'reserved'} \land \text{expires\_at} > \text{NOW()})$$
   - `POST /v1/redemptions/{id}/commit`:
     - **Idempotency:** Re-committing an already committed reservation is a no-op that returns the original success payload.
     - **Expired Rejection:** If reservation is expired (`status = 'expired'` or `expires_at < NOW()`) and grace window has passed, return `409 Conflict` with error code `RESERVATION_EXPIRED`.
   - `POST /v1/redemptions/{id}/release`: Releases points back to available balance immediately if a bill is modified or cancelled. Zero ledger impact.
2. **Order Reporting with Reservation Commit Grace Window:**
   - `POST /v1/orders`: Accepts `external_order_id`, `phone`, `subtotal_paise`, `discount_paise`, `order_type`, and optional `reservation_id`.
   - **Late Settlement Grace Window (24 Hours):** If `reservation_id` is passed with an order but the 15-minute TTL has expired:
     - If the expiration occurred within a **24-hour grace window** AND member balance is still sufficient, automatically commit the reservation idempotently and log the deduction.
     - If points have since been spent elsewhere or exceed 24 hours, process the order earn but flag the reservation for **manual review** in `audit_log` with code `RESERVATION_GRACE_EXCEEDED`.
3. **Standard Machine-Readable Error Shape:**
   ```json
   {
     "error": {
       "code": "MIN_BILL_NOT_MET",
       "message": "Bill total is below the minimum required for point redemption",
       "details": {}
     }
   }
   ```
   *Standard error codes:* `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMIT_EXCEEDED`, `MEMBER_NOT_FOUND`, `MIN_BILL_NOT_MET`, `BELOW_MIN_POINTS`, `RESERVATION_NOT_FOUND`, `RESERVATION_EXPIRED`, `IDEMPOTENCY_CONFLICT`, `INTERNAL_ERROR`.

---

## Secrets Rotation Manifest (Phase 0.5)

The following credentials were identified during audit and **MUST BE ROTATED**:
1. **Supabase Anon / Publishable Key:** `sb_publishable_l3VJygSx_AxtavnHQnF4Ow_Jg8mANyl` (Rotate in Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ API).
2. **Supabase Service Role Key:** Generate a fresh service role key in Supabase Dashboard. Store exclusively in private server environment variables (`SUPABASE_SERVICE_ROLE_KEY`).
3. **Seed Passwords:** `admin123` and `owner123` have been hashed with bcrypt in storage; update to unique passwords on first login.
4. **Mock Petpooja API Keys:** `sec_live_9a8f42bc71`, `sec_live_3b7e81cc12`, `sec_live_5d1a99bb84` (will be revoked and superseded by cryptographic `lk_live_` API keys).

---

## Phase-by-Phase Implementation Roadmap

### Phase 0.5: Emergency Security & Vulnerability Hardening (COMPLETED)
- [x] **Step 0.5.1: Close `x-tenant-id` Impersonation Vulnerability (`server/middleware/auth.js`)**
  - Unauthenticated requests have `req.tenantId = null` strictly.
  - Restaurant owners are locked to `session.user.tenantId`. Header spoofing is blocked.
- [x] **Step 0.5.2: Eliminate Plaintext Passwords (`server/db/store.js` & `server/data/db.json`)**
  - Salted 10-round bcrypt hashes for all users. Passwords verified via `bcrypt.compareSync()`.
- [x] **Step 0.5.3: Remove Hardcoded Keys & Enforce Environment Variables (`server/db/supabase.js`, `render.yaml`)**
  - Removed fallback strings. Added `.gitignore` protection for backup files.

---

### Phase 1: Database Infrastructure, Backup, RPC Functions & Migrations
*Rules: `db.json` backup kept OUTSIDE git. Import must NOT carry plaintext passwords. Run migrations on local Supabase first and wait for approval before touching production. RPC functions executable ONLY by `service_role` (revoke from `public`, `anon`, `authenticated`, fixed `search_path = public`). RLS enabled in the same migration as each table. Add a scheduled reservation-expiry job.*

- [ ] **Step 1.1: Local Data Backup (Outside Git)**
  - Back up `server/data/db.json` to `server/data/db.json.bak` (ignored in `.gitignore`).
  - Verify `.gitignore` prevents committing `.bak` files.
- [ ] **Step 1.2: Complete Database Migration (`supabase/migrations/20261024_init_production_schema.sql`)**
  - Tables created with RLS enabled in the same script:
    - `loyalty_programs`: Restaurant config, presets, guardrails.
    - `loyalty_members`: Member profile, phone E.164, tier, lifetime spend, visits.
    - `loyalty_ledger`: Append-only transactional ledger with FIFO remaining balance.
    - `redemption_reservations`: Two-phase reservations (`reservation_id`, `points`, `discount_paise`, `status`, `expires_at`).
    - `api_keys`: SHA-256 hash, prefix `lk_live_` / `lk_test_`, last4, scopes, `last_used_at`, `revoked_at`.
    - `idempotency_keys`: `restaurant_id`, `idempotency_key`, `request_hash`, `response_status`, `response_body`, `expires_at`.
    - `rate_limit_buckets`: Shared-store rate limit tracking table (`bucket_key`, `tokens`, `last_refill_at`).
    - `audit_log`: `restaurant_id`, `actor_type`, `action`, `metadata`, `created_at`.
    - `loyalty_multiplier_rules` & `loyalty_referrals`.
  - Composite indexes: `(restaurant_id, phone_e164)`, `(restaurant_id, member_id, created_at DESC)`, `(expires_at)` on ledger for FIFO sweeps, `(key_hash)` on `api_keys`.
  - RLS policies enabled per table with tenant isolation (`restaurant_id = current_setting('app.current_restaurant_id', true)`).
- [ ] **Step 1.3: Secure Postgres Stored Functions (RPC with `SELECT ... FOR UPDATE`)**
  - Security configuration on all functions:
    - `SECURITY DEFINER`
    - `SET search_path = public, pg_temp`
    - `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;`
    - `GRANT EXECUTE ON FUNCTION ... TO service_role;`
  - Functions:
    - `fn_loyalty_reserve_points(p_restaurant_id, p_phone, p_points, p_bill_paise, p_ttl_seconds)`: Row-locks member row, subtracts active reservations from available balance, inserts into `redemption_reservations`, returns reservation UUID and discount paise.
    - `fn_loyalty_commit_points(p_restaurant_id, p_reservation_id, p_order_id)`: Idempotent. Row-locks member, updates reservation status, appends ledger deduction row, returns success. Returns `RESERVATION_EXPIRED` if past grace.
    - `fn_loyalty_release_points(p_restaurant_id, p_reservation_id)`: Transitions reservation to `released`. Zero ledger impact.
    - `fn_loyalty_earn_points(p_restaurant_id, p_order_id, p_phone, p_subtotal_paise, p_order_type)`: Calculates points, row-locks member, appends ledger entry, increments visits and lifetime spend.
    - `fn_loyalty_refund_order(p_restaurant_id, p_order_id, p_refund_paise)`: Calculates proportional reversal, row-locks member, appends reversal entry.
    - `fn_check_rate_limit(p_key, p_cost, p_capacity, p_refill_per_sec)`: Token-bucket algorithm in Postgres returning allowed boolean and reset seconds.
- [ ] **Step 1.4: Scheduled Reservation Expiry Job**
  - Migration script to set up periodic reservation cleanup (via `pg_cron` or Supabase Edge Functions / Vercel cron):
    - Updates `redemption_reservations` to `status = 'expired'` WHERE `status = 'reserved' AND expires_at < NOW()`.
- [ ] **Step 1.5: One-Time Clean Data Import Script (`scripts/migrate-db-to-postgres.ts`)**
  - Reads `server/data/db.json.bak`.
  - Maps legacy hardcoded UUIDs (`00000000-0000-0000-0000-000000000001`) to real restaurant IDs.
  - Inserts ONLY bcrypt `passwordHash` (never plaintext).
  - Verifies row counts between `db.json` and Postgres, outputting a verification report.
  - Runs against local Supabase first; stops for user approval before touching production.
- [ ] **Step 1.6: Pilot API Key Seed Script (`scripts/seed-pilot-api-keys.ts`)**
  - Issues initial `lk_live_` and `lk_test_` keys for pilot restaurants before dashboard UI is completed. Outputs plaintext keys once to stdout with SHA-256 stored in DB.

---

### Phase 2: Canonical Shared Contract & Typed SDK
*Goal: Author single source of truth for both repos and provide SDK generation script without npm registry publishing.*

- [ ] **Step 2.1: OpenAPI 3.1 Specification (`openapi.yaml`)**
  - Full schema for `/v1/ping`, `/v1/program`, `/v1/customers/lookup`, `/v1/customers/{phone}`, `/v1/redemptions/reserve`, `/v1/redemptions/{id}/commit`, `/v1/redemptions/{id}/release`, `/v1/orders`, `/v1/orders/{id}/refund`, `/v1/referrals`.
  - Includes `reservation_id` in `POST /v1/orders` with 24-hour grace window documentation.
  - Includes `RESERVATION_EXPIRED` error response on `/commit`.
- [ ] **Step 2.2: Local SDK Generation Script (`scripts/generate-sdk.sh` / `npm run generate:sdk`)**
  - Generates typed TypeScript client `@yourbrand/loyalty-sdk` directly into `packages/sdk/` for import by POS repositories. No registry publishing.

---

### Phase 3: Public API v1 Implementation
*Goal: Implement shared contract endpoints with API key auth, shared rate limiting, and two-phase redemptions.*

- [ ] **Step 3.1: Cryptographic API Key Verification (`lib/auth/keys.ts`)**
  - Verifies Bearer `lk_live_` / `lk_test_` by SHA-256 hashing.
  - Derives `restaurant_id` ONLY from the verified API key.
  - Checks scopes (`customers:read`, `points:earn`, `points:redeem`). Updates `last_used_at`.
- [ ] **Step 3.2: Shared Postgres Rate Limiting & Idempotency (`lib/auth/idempotency.ts`)**
  - Intercepts `Idempotency-Key` header; stores and replays responses from `idempotency_keys` table.
  - Rate-limits per key via `fn_check_rate_limit()` in Postgres. Injects `Request-ID` and `Retry-After`.
- [ ] **Step 3.3: API v1 Route Handlers (`app/api/v1/`)**
  - Implements all v1 endpoints calling the RPC functions from Step 1.3.
  - Deducts active reservations from available balance on `/lookup` and `/reserve`.

---

### Phase 4: Canonical POS Adapter Layer
*Goal: Abstract POS-specific payloads behind the canonical event model.*

- [ ] **Step 4.1: POS Adapter Interface (`lib/pos-adapters/adapter.interface.ts`)**
  - `normalizeOrder()`, `normalizeCustomer()`, `verifySignature()`.
- [ ] **Step 4.2: Generic REST Adapter (`lib/pos-adapters/generic-rest/`)**
  - Native 1:1 mapping to API v1 contract for Yeezy RMS.
- [ ] **Step 4.3: Petpooja Adapter Stub (`lib/pos-adapters/petpooja/`)**
  - Clean TypeScript stub with typed placeholders and `TODO` markers. No invented endpoints.

---

### Phase 5: Owner Dashboard Refactor (Tailwind + shadcn/ui + Supabase Auth)
*Goal: Modernize owner dashboard with responsive design, API key management, and Supabase Auth.*

- [ ] **Step 5.1: Supabase Auth for Dashboard**
  - Dashboard users authenticate via Supabase Auth; session resolves owner's `restaurant_id`.
- [ ] **Step 5.2: API Key Management View (`app/(dashboard)/integrations/`)**
  - Create API Key with Show Once modal. Key list with prefix, last4, last used, and revoke button.
- [ ] **Step 5.3: Program Configurator, ROI Simulator & Live Ledger Views**
  - Sliders with instant ROI feedback. Server-side paginated member table and FIFO ledger viewer.

---

### Phase 6: Production Verification & Quality Assurance
*Goal: Validate complete system against tests, linters, and type safety.*

- [ ] **Step 6.1: Unit & Integration Tests (Local Supabase)**
  - All 14 engine unit tests pass.
  - Integration tests for auth failures, idempotency replay, concurrency on reserve/redeem, and **cross-tenant leak prevention** (verifying key A cannot access restaurant B).
- [ ] **Step 6.2: CI & Documentation Verification**
  - `tsc --noEmit` validation (0 errors).
  - ESLint and Prettier formatting checks.
  - Interactive API documentation page (`/docs`) rendering `openapi.yaml`.
