# Refactor Plan: Yeezy Loyalty Platform

**Target Architecture:** Multi-Tenant Loyalty SaaS (Next.js App Router, Supabase/Postgres, Strict TypeScript)  
**Guiding Principle:** Incremental, non-destructive refactoring. Never break existing builds, tests, or live deployments.

---

## Deployment Target & Express Cutover Plan

### Deployment Target
- **Primary SaaS Frontend & Serverless Edge/API:** Next.js (App Router) on **Vercel**.
- **Alternative / Self-Hosted Web Service:** Next.js standalone container on **Render** (`PORT: 10000`).
- **Database, Auth & RPC Engine:** **Supabase PostgreSQL 15+** with Row-Level Security (RLS) and stored procedures.

### Express Server Retirement & Cutover Plan
1. **Stage 1 (Co-existence):** Mount the new `/v1` public API endpoints and database RPC services alongside the existing Express app. Legacy POS routes (`/api/v1/pos/...` and `/api/v1/loyalty/...`) remain operational as reverse-proxies / adapters pointing to the canonical engine.
2. **Stage 2 (SDK & POS Migration):** External POS clients (Yeezy RMS, test simulators) adopt `@yourbrand/loyalty-sdk` or target `/v1/*` with API keys (`lk_live_...`).
3. **Stage 3 (Dashboard Cutover):** Next.js App Router dashboard replaces the legacy Vite SPA.
4. **Stage 4 (Decommissioning):** Remove `server/index.js`, `server/app.js`, and legacy Express dependencies (`express`, `cors`). Full cutover to native Next.js API routes.

---

## Secrets Rotation Manifest (Phase 0.5)

The following credentials have been present in code, repository history, or default configuration and **MUST BE ROTATED**:
1. **Supabase Anon / Publishable Key:** `sb_publishable_l3VJygSx_AxtavnHQnF4Ow_Jg8mANyl` (exposed in `server/db/supabase.js`, `render.yaml`, `.env`). Rotate in Supabase Dashboard → Settings → API.
2. **Supabase Service Role Key:** Any existing service role key must be revoked and regenerated; ensure the new service role key is placed exclusively in private server environment variables (`SUPABASE_SERVICE_ROLE_KEY`) and never bundled to the client.
3. **Default Admin / Owner Passwords:** `admin123` and `owner123` (exposed in `server/data/db.json` and `server/db/store.js`). Replace with salted bcrypt hashes or migrate to Supabase Auth.
4. **Petpooja / POS Mock Secret Live Keys:** `sec_live_9a8f42bc71`, `sec_live_3b7e81cc12`, `sec_live_5d1a99bb84` (exposed in `db.json`). Invalidate and issue fresh `lk_live_` cryptographic keys.

---

## Phase-by-Phase Implementation Roadmap

### Phase 0.5: Emergency Security & Vulnerability Hardening (Immediate Action)
*Goal: Eliminate critical authorization and authentication vulnerabilities in existing server code.*

- [ ] **Step 0.5.1: Close `x-tenant-id` Impersonation Vulnerability (`server/middleware/auth.js`)**
  - Remove the unauthenticated fallback where callers can supply arbitrary `x-tenant-id` headers without a valid session.
  - Require valid authentication. Super Admin can only switch tenants with an explicit verified session; all other requests are strictly scoped to `session.user.tenantId`.
- [ ] **Step 0.5.2: Eliminate Plaintext Passwords (`server/db/store.js`)**
  - Install `bcryptjs`.
  - Hash all passwords on tenant/user creation and when loading default seed users. Compare with `bcrypt.compareSync()`.
- [ ] **Step 0.5.3: Remove Hardcoded Keys & Enforce Environment Variables (`server/db/supabase.js`, `render.yaml`)**
  - Remove hardcoded fallback strings for `SUPABASE_KEY` and `SUPABASE_URL`.
  - Throw a clear startup configuration error if required environment variables are absent in production.

---

### Phase 1: Database Infrastructure, Backup, RPC Functions & Migrations
*Goal: Establish bulletproof Supabase migrations with Postgres RPC functions for all point operations and import legacy data.*

- [ ] **Step 1.1: Local Data Backup & Pre-Migration Snapshot**
  - Create timestamped backup of `server/data/db.json` to `server/data/db.json.bak`.
- [ ] **Step 1.2: Complete Database Migration (`supabase/migrations/20261024_init_production_schema.sql`)**
  - Tables:
    - `loyalty_programs`: Restaurant config, presets, guardrails.
    - `loyalty_members`: Diner profiles, phone E.164, tiers, lifetime spend, visits.
    - `loyalty_ledger`: Append-only transactional ledger with FIFO remaining balance.
    - `redemption_reservations`: Two-phase reservation tracking (`reservation_id`, `points`, `discount_paise`, `status`, `expires_at`).
    - `api_keys`: SHA-256 hash, prefix `lk_live_` / `lk_test_`, last4, scopes, `last_used_at`, `revoked_at`.
    - `idempotency_keys`: `restaurant_id`, `idempotency_key`, `request_hash`, `response_status`, `response_body`, `expires_at`.
    - `audit_log`: `restaurant_id`, `actor_type`, `action`, `metadata`, `created_at`.
    - `loyalty_multiplier_rules` & `loyalty_referrals`.
  - Composite indexes on `(restaurant_id, phone_e164)`, `(restaurant_id, member_id, created_at DESC)`, `(expires_at)` for ledger FIFO sweeps, and `(key_hash)` for API keys.
  - Row-Level Security (RLS) on all tables with tenant isolation policies.
- [ ] **Step 1.3: Atomic Postgres Stored Functions (RPC with `SELECT ... FOR UPDATE`)**
  - Create transactional SQL functions callable via Supabase RPC:
    - `fn_loyalty_reserve_points(p_restaurant_id, p_phone, p_points, p_bill_paise, p_ttl_seconds)`: Row-locks member row, subtracts active reservations from available balance, returns reservation UUID and discount paise.
    - `fn_loyalty_commit_points(p_restaurant_id, p_reservation_id, p_order_id)`: Finalizes reservation, locks member row, creates append-only ledger deduction, updates member visit and spend.
    - `fn_loyalty_release_points(p_restaurant_id, p_reservation_id)`: Releases reservation back to available balance. Zero ledger impact.
    - `fn_loyalty_earn_points(p_restaurant_id, p_order_id, p_phone, p_subtotal_paise, p_order_type)`: Calculates points, tier multipliers, streak bonus, row-locks member, appends ledger entry, increments visits.
    - `fn_loyalty_refund_order(p_restaurant_id, p_order_id, p_refund_paise)`: Calculates proportional reversal, row-locks member, appends reversal entry.
- [ ] **Step 1.4: One-Time Migration Script (`scripts/migrate-db-to-postgres.ts`)**
  - Reads `db.json`. Maps legacy hardcoded UUIDs (`00000000-0000-0000-0000-000000000001`) to real restaurant IDs.
  - Imports tenants, members, and ledger entries with row-count verification report.
- [ ] **Step 1.5: Pilot API Key Seed Script (`scripts/seed-pilot-api-keys.ts`)**
  - Issues initial `lk_live_` and `lk_test_` keys for pilot restaurants before dashboard UI is completed. Outputs keys once securely to stdout.

---

### Phase 2: Canonical Shared Contract & Typed SDK
*Goal: Author the single source of truth for all POS integrations and provide a generator script.*

- [ ] **Step 2.1: OpenAPI 3.1 Specification (`openapi.yaml`)**
  - Define all v1 endpoints: `GET /v1/ping`, `GET /v1/program`, `GET /v1/customers/lookup`, `PUT /v1/customers/{phone}`, `POST /v1/redemptions/reserve`, `POST /v1/redemptions/{id}/commit`, `POST /v1/redemptions/{id}/release`, `POST /v1/orders`, `POST /v1/orders/{id}/refund`, `POST /v1/referrals`.
  - Machine-readable error schema: `{ "error": { "code": "...", "message": "...", "details": {} } }`.
- [ ] **Step 2.2: SDK Generation Script (`scripts/generate-sdk.sh` / `npm run generate:sdk`)**
  - Script for the POS repository to generate its typed client directly from `openapi.yaml` without publishing to npm registry.

---

### Phase 3: Public API v1 Implementation
*Goal: Implement the shared contract endpoints with shared-store rate limiting, idempotency, and cryptographic API keys.*

- [ ] **Step 3.1: Cryptographic API Key Verification (`lib/auth/keys.ts`)**
  - Parse `Authorization: Bearer lk_...`. Compute SHA-256 hash.
  - Query Postgres `api_keys` table. Derive `restaurant_id` ONLY from the verified key.
  - Verify scopes (`customers:read`, `points:earn`, `points:redeem`). Record `last_used_at` asynchronously.
- [ ] **Step 3.2: Shared-Store Idempotency & Rate Limiting (`lib/auth/idempotency.ts`)**
  - Intercept write requests with `Idempotency-Key` header.
  - Store and replay responses from Postgres `idempotency_keys` table (no in-memory maps).
  - Rate-limit per key via Postgres token-bucket with `Retry-After` header. Add `Request-ID` to all responses.
- [ ] **Step 3.3: API v1 Route Handlers**
  - Implement `/v1/ping`, `/v1/program`, `/v1/customers/lookup` (calculating balance minus active reservations), `/v1/customers/{phone}`, `/v1/redemptions/reserve`, `/v1/redemptions/{id}/commit`, `/v1/redemptions/{id}/release`, `/v1/orders`, `/v1/orders/{id}/refund`, `/v1/referrals`.
  - Call Postgres RPC functions created in Step 1.3.

---

### Phase 4: POS Adapter Layer
*Goal: Abstract POS-specific payloads behind the canonical event model.*

- [ ] **Step 4.1: Adapter Interface (`lib/pos-adapters/adapter.interface.ts`)**
  - `normalizeOrder()`, `normalizeCustomer()`, `verifySignature()`.
- [ ] **Step 4.2: Generic REST Adapter (`lib/pos-adapters/generic-rest/`)**
  - Direct 1:1 mapping to API v1 contract for Yeezy RMS and native systems.
- [ ] **Step 4.3: Petpooja Adapter Stub (`lib/pos-adapters/petpooja/`)**
  - Clean TypeScript stub with typed placeholders and `TODO` markers. No invented endpoints.

---

### Phase 5: Owner Dashboard Refactor (Tailwind + shadcn/ui + Supabase Auth)
*Goal: Modernize owner user experience with responsive, accessible, mobile-first design.*

- [ ] **Step 5.1: Supabase Auth Integration for Dashboard**
  - Dashboard users authenticate via Supabase Auth (email/password or magic link).
  - Sessions strictly resolve owner's `restaurant_id`.
- [ ] **Step 5.2: API Key Management View**
  - "Create API Key" modal with Show Once dialog.
  - Key table: Name, Prefix, Last 4, Created Date, Last Used timestamp, and Revoke action.
- [ ] **Step 5.3: Program Configurator, ROI Simulator & Live Ledger Views**
  - Sliders with instant ROI feedback and guardrail warnings.
  - Server-side paginated member table and FIFO ledger viewer.

---

### Phase 6: Production Verification & Quality Assurance
*Goal: Validate complete system against tests, linters, and type safety.*

- [ ] **Step 6.1: Unit & Integration Tests (Local Supabase)**
  - All 14 engine unit tests retained.
  - Integration tests for auth failures, idempotency replay, concurrency on reserve/redeem, and **cross-tenant leak prevention** (verifying key A cannot access restaurant B).
- [ ] **Step 6.2: CI & Documentation Verification**
  - `tsc --noEmit` validation (0 errors).
  - ESLint and Prettier formatting checks.
  - Updated `README.md` with local development guide and environment setup.
  - Interactive API documentation page (`/docs`) rendering `openapi.yaml`.
