# Codebase Audit Report: Yeezy Loyalty Platform

**Date:** 2026-10-24  
**Auditor:** Senior Staff Engineer  
**Repository:** `mijwad/yeezy-loyalty`  
**Status:** Audit Completed (Phase 0) — No code modifications executed.

---

## 1. Executive Summary

The **Yeezy Loyalty Platform** is designed as a standalone, multi-tenant SaaS loyalty points engine for restaurants (with a Kerala/India regional focus). Its mission is to serve as the single source of truth for loyalty rules, point accruals, FIFO ledgers, and redemption calculations across external POS systems (e.g., **Yeezy RMS**, **Petpooja**, custom POS).

While the core mathematical loyalty engine (`lib/loyalty/engine.ts`) is pure, robust, and supported by 14 passing unit tests, the rest of the application exhibits significant architectural fragmentation:
1. **Stack Disconnect:** The codebase was initiated as a hybrid Express.js backend + Vite Vanilla JS single-page application, whereas the target production specification dictates a Next.js (App Router) + Supabase (Postgres, RLS) + TypeScript architecture with a generated client SDK.
2. **Dual-Store Divergence:** Backend persistence is currently split between an ephemeral in-memory JSON file store (`server/data/db.json` via `server/db/store.js`) and fire-and-forget Supabase sync adapters (`server/db/supabase.js`) that use hardcoded fallback UUIDs.
3. **Missing Canonical Shared Contract:** There is no OpenAPI 3.1 specification (`openapi.yaml`), no generated typed client SDK (`@yourbrand/loyalty-sdk`), and no two-phase redemption (`/v1/redemptions/reserve` $\rightarrow$ `commit` / `release`).
4. **Security Vulnerabilities:** Plaintext credentials, unauthenticated tenant header overrides, missing cryptographic API key hashing (`lk_live_...`), and lack of Postgres-enforced row-level security (RLS) on API routes.

---

## 2. Current Architecture vs. Target Architecture

| Component | Current Implementation | Target Specification (Phase 1–6) |
| :--- | :--- | :--- |
| **Framework** | Express 5.x + Vite Vanilla JS SPA | Next.js App Router (`/app`, `/app/api/v1`) |
| **Language & Typing** | Mixed ESM JS and `.ts` with `esbuild` pre-compilation | 100% Strict TypeScript (`strict: true`, no `any`) |
| **Database** | In-memory `db.json` with async Supabase sync | Supabase PostgreSQL with strict RLS on all tables |
| **Public API** | Ad-hoc routes under `/api/v1/loyalty` & `/api/v1/pos` | Public API v1 matching shared contract (`/v1/*`) |
| **POS Integration** | Coupled Petpooja routes with mock marketplace | Canonical Adapter Pattern (`/lib/pos-adapters/*`) |
| **Contract & SDK** | None (handwritten fetch calls in UI) | OpenAPI 3.1 (`openapi.yaml`) + Generated `@yourbrand/loyalty-sdk` |
| **Redemption Model** | Immediate preview and commit | Two-phase redemption (`reserve` with 15-min TTL $\rightarrow$ `commit` / `release`) |
| **Idempotency** | Partial in-memory order set check | Postgres `idempotency_keys` table replaying exact responses |
| **UI Design System** | Vanilla JS `innerHTML` templates + Tailwind CDN | Tailwind + `shadcn/ui` + React Hook Form + Zod |

---

## 3. What Works (Production-Ready Assets)

1. **Pure Loyalty Business Logic (`lib/loyalty/engine.ts`):**
   - 100% deterministic, pure calculation functions without I/O.
   - Comprehensive test suite in `lib/loyalty/engine.test.ts` (14 passing tests covering Acceptance Tests 1–13 + Kerala phone normalization).
   - Accurate integer paise arithmetic (no floats for money).
   - Tier progression logic (`Silver`, `Gold`, `Platinum`).
   - Streak bonuses, big-bill multipliers, and winback windows.
   - Append-only reversal calculation for order refunds.
2. **ROI Simulator Engine (`lib/loyalty/roi.ts`):**
   - Implements closed-form financial formula: cost, incremental gross profit, net ROI, and break-even customer visit lift.
3. **Zod Validation & Guardrails (`lib/loyalty/config.ts`):**
   - Strict validation of program configs with preset templates (*Conservative 3%*, *Standard 5%*, *Aggressive 7%*).
   - Enforces `max_effective_earn_rate_bps` guardrail (rejection/warning if tier multiplier $\times$ base earn rate exceeds 800 bps).
4. **Bi-lingual Dictionary (`lib/loyalty/i18n.ts`):**
   - Complete Malayalam (`ml`) and English (`en`) translation strings for receipts, notifications, and customer portal.
5. **WhatsApp Notification Stub (`lib/loyalty/whatsapp.ts`):**
   - Pluggable provider interface with template formatting.

---

## 4. What Is Broken or Duplicated

### 4.1. Dual Database Divergence & Data Loss Risk
- `server/db/store.js` reads and writes to `server/data/db.json`. In serverless deployments (Vercel) or container restarts (Render free tier), `db.json` is wiped or is read-only (`EROFS`).
- `server/db/supabase.js` attempts fire-and-forget background synchronization to Supabase tables, but uses hardcoded UUIDs:
  ```javascript
  const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const DEFAULT_OUTLET_ID = '00000000-0000-0000-0000-000000000002';
  ```
  Consequently, real tenant data does not isolate properly in Supabase.

### 4.2. Inconsistent Route Duplication for POS
- **`server/routes/pos.js`:** Contains legacy Petpooja mock endpoints (`/api/v1/pos/loyalty/inquire`, `/api/v1/pos/orders/save`) that hardcode point calculations (`10%`, ₹10 = 1 pt) using floats.
- **`server/routes/loyalty.js`:** Contains the new paise-based loyalty endpoints (`/api/v1/loyalty/earn`, `/redeem/preview`, `/redeem/commit`).
- The two routers have duplicate endpoints with conflicting business logic and conflicting payload schemas.

### 4.3. Missing Two-Phase Redemption
- Current endpoints: `POST /api/v1/loyalty/redeem/preview` and `POST /api/v1/loyalty/redeem/commit`.
- The shared contract requires:
  - `POST /v1/redemptions/reserve`: Holds points with a 15-minute TTL, returning `reservation_id` and `discount_paise`.
  - `POST /v1/redemptions/{id}/commit`: Finalizes redemption upon bill settlement.
  - `POST /v1/redemptions/{id}/release`: Releases points back to customer if bill is edited or voided.
- Currently, if a bill is modified in the POS after redemption commit, points can be permanently lost without manual ledger reversals.

### 4.4. Absence of Contract & Client SDK
- There is no OpenAPI 3.1 specification (`openapi.yaml`).
- There is no typed client SDK (`@yourbrand/loyalty-sdk`). Both frontend and POS callers must handwrite raw fetch requests.

---

## 5. Security Vulnerabilities & Compliance Holes

| Severity | Issue | Location | Risk |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | Unauthenticated Tenant Impersonation | `server/middleware/auth.js:31-35` | Any caller can pass `x-tenant-id` header without credentials and access another restaurant's data. |
| **CRITICAL** | Plaintext Passwords | `server/data/db.json` & `server/db/store.js` | Admin and owner passwords (`admin123`, `owner123`) stored in plaintext without bcrypt/argon2 hashing. |
| **HIGH** | Exposed Publishable Key Fallback | `server/db/supabase.js:7` | Hardcoded fallback keys in source code. |
| **HIGH** | Missing Cryptographic API Key System | `server/routes/` | No `lk_live_...` / `lk_test_...` API keys with SHA-256 storage, visible prefix + last4, and scoped permissions (`customers:read`, `points:earn`, etc.). |
| **HIGH** | In-Memory Concurrency Locks | `server/db/store.js:22` | Mutex locks (`this.rowLocks = new Map()`) only protect a single Node instance. In multi-instance or serverless deployments, race conditions on points redemption can occur. |
| **MEDIUM** | In-Memory Rate Limiting | `server/routes/loyalty.js:21` | IP rate-limiting map is wiped on server restart and bypassed across distributed instances. |

---

## 6. Missing Tables, Columns & Indexes

The current migration file (`database/migrations/20261024_loyalty_spec.sql`) provides the basic tables (`loyalty_programs`, `loyalty_members`, `loyalty_ledger`, `loyalty_referrals`, `loyalty_multiplier_rules`), but lacks the critical operational infrastructure required by the contract:

1. **`api_keys` Table (Missing):**
   - Needed columns: `id`, `restaurant_id`, `name`, `key_prefix` (e.g., `lk_live_a1b2`), `key_hash` (SHA-256), `last4`, `scopes` (array), `is_test`, `last_used_at`, `expires_at`, `revoked_at`, `created_at`.
   - Missing index on `(key_hash)` for instant authorization lookup.
2. **`idempotency_keys` Table (Missing):**
   - Needed columns: `id`, `restaurant_id`, `idempotency_key`, `request_path`, `request_hash`, `response_status`, `response_body`, `created_at`, `expires_at`.
   - Missing unique index on `(restaurant_id, idempotency_key)`.
3. **`redemption_reservations` Table (Missing):**
   - Needed columns: `id` (UUID), `restaurant_id`, `member_id`, `points`, `discount_paise`, `status` (`reserved`, `committed`, `released`, `expired`), `expires_at`, `created_at`.
   - Missing index on `(restaurant_id, member_id, status)` and `(expires_at)` for TTL sweeps.
4. **`audit_log` Table (Missing):**
   - Needed columns: `id`, `restaurant_id`, `actor_type`, `actor_id`, `action`, `entity_type`, `entity_id`, `metadata`, `created_at`.
5. **Missing Indexes on Existing Tables:**
   - `loyalty_ledger (restaurant_id, member_id, created_at DESC)` for ledger history.
   - `loyalty_ledger (restaurant_id, expires_at)` WHERE `remaining > 0` for FIFO expiration queries.
   - `loyalty_members (restaurant_id, phone_e164)` unique composite index.

---

## 7. UI Inconsistencies & Dead Code

1. **Play CDN Dependency:** `index.html` loads Tailwind via `<script src="https://cdn.tailwindcss.com"></script>` with an in-browser config script. This produces console warnings and prevents dead-CSS elimination.
2. **DOM-Replacement Rendering:** `src/main.js` re-renders full HTML strings via `mainViewEl.innerHTML = mainContentHtml`, which led to input focus drops and flickering during polling intervals.
3. **Redundant Legacy Modals:** Modals such as `PetpoojaIntegrationModal.js`, `AddPosModal.js`, and `CustomerDrawerModal.js` contain legacy mock data that diverges from the pure loyalty schema.
4. **Framework Mismatch:** The existing UI is built in Vanilla JS modules (`src/views/*`), lacking React component lifecycle, TypeScript safety, and accessibility primitives (`shadcn/ui`).

---

## 8. Summary of Findings

| Category | Health Rating | Urgent Action Required |
| :--- | :---: | :--- |
| **Core Calculation Engine** | 🟢 Excellent | Preserve `lib/loyalty/engine.ts` and test suite. |
| **Database & Persistence** | 🔴 Critical | Migrate from `db.json` to Supabase PostgreSQL with RLS. |
| **API Contract & Standards** | 🔴 Critical | Write `openapi.yaml`, generate SDK, implement two-phase redemptions. |
| **Security & Authentication** | 🔴 Critical | Replace plaintext credentials & unauthenticated headers with SHA-256 API keys. |
| **POS Adapter Architecture** | 🟡 Needs Work | Consolidate `server/routes/pos.js` into canonical `/lib/pos-adapters/`. |
| **Dashboard UI** | 🟡 Needs Work | Refactor to Next.js App Router with Tailwind + shadcn/ui. |
