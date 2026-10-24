# Yeezy Restaurant Loyalty Platform

A modern, high-retention omni-channel loyalty, guest intelligence, and automated marketing platform for restaurants and hospitality operators.

Imported with 100% design fidelity from **Stitch** (Project ID: `11187122990638679098`).

---

## 🚀 Quick Start

### 1. Run Development Server (Frontend)
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 2. Run Backend POS & Loyalty API Server
```bash
npm run server
```
Runs the Express backend engine on **[http://localhost:4000](http://localhost:4000)**.
- Health Check: `GET http://localhost:4000/api/health`
- Petpooja Cashier Inquiry: `POST http://localhost:4000/api/v1/pos/petpooja/loyalty/inquire`
- Petpooja Settle Order: `POST http://localhost:4000/api/v1/pos/petpooja/orders/save`
- Webhook Audit Stream: `GET http://localhost:4000/api/v1/pos/webhook-logs`

### 3. Build for Production
```bash
npm run build
npm run preview
```

---

## 🎨 Design System & Visuals (Stitch Match)

- **Typography**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) geometric grotesque with negative letter-spacing for metric numbers (`800` weight).
- **Icons**: [Material Symbols Outlined](https://fonts.google.com/icons).
- **Color Tokens**:
  - `primary`: `#630ed4` (Violet Anchor)
  - `primary-container`: `#7c3aed` (Electric Violet)
  - `secondary`: `#a43073` / `#fc79bd` (Fuchsia celebration tags)
  - `tertiary`: `#005b3d` / `#10b981` (Crisp Mint metrics)
  - `surface`: `#fbf8fc` (Canvas Neutral)
  - `surface-container-lowest`: `#ffffff` (Elevated White Cards)

---

## 📂 Modular Codebase Architecture

The project has been organized into self-contained feature modules so you can edit, rewrite, and update any page or component with maximum speed and zero side-effects:

```
src/
├── main.js                  # App controller & hash router (mounts active view)
├── style.css                # Global styles & animation tokens
├── state/                   # Centralized State Management
│   ├── store.js             # Reactive store (getState, setState, subscribe, saveState)
│   └── initialData.js       # Mock restaurant, customer & program state
├── utils/                   # Reusable Utilities
│   ├── toast.js             # Global toast notifications
│   └── exportCsv.js         # Instant CSV data exporter
├── layout/                  # Shell / Structural Layout
│   ├── Header.js            # Top bar, outlet picker, live alerts, profile dropdown
│   └── Sidebar.js           # Desktop & mobile navigation drawer
├── views/                   # Independent Page Views (Markup + Listeners co-located)
│   ├── dashboard/           # Dashboard Feature Module
│   │   ├── index.js         # View orchestrator & period filter switcher
│   │   ├── HighlightsRow.js # Today's 4 metrics (Sales, Orders, Customers with 3D avatar, Rewards)
│   │   ├── BarChartCard.js  # 12-week interactive bar visualizer & tab switcher
│   │   ├── CreditsCard.js   # Messaging credits balance deck
│   │   ├── KPIsRow.js       # Store KPIs (Active members, Repeat rate, Points, ROI)
│   │   └── VIPTableCard.js  # Top VIP customers directory table
│   ├── customers/           # Customer Insights Feature Module
│   │   └── index.js         # RFM tabs, search, tier filters, sort, customer table
│   ├── configurator/        # Loyalty Program Configurator Module
│   │   └── index.js         # 5-step wizard, live mobile card preview, tier manager
│   ├── loyalty/             # Loyalty Type Selector
│   │   └── index.js         # Program types: Cashback, Amount Spent, Visit Stamps
│   └── other/               # Supporting Views
│       └── index.js         # Campaigns, Auto-Campaigns, QR Codes, Feedback, Referrals, Settings
└── modals/                  # Modals & Drawers (Self-contained HTML + Event Handlers)
    ├── index.js             # Active modal renderer & listener dispatcher
    ├── AmountSpentModal.js  # Interactive 3-slide phone carousel preview
    ├── RefillCreditsModal.js# Messaging credits refill packages
    ├── AutoRefillModal.js   # Automated balance threshold rules
    ├── BookDemoModal.js     # 1-on-1 demo booking scheduler
    ├── CustomerDrawerModal.js # Slide-over customer profile & history
    └── ActivationSuccessModal.js # Celebration activation dialog
```

---

## 📱 Features & Stitch Screens Imported

### 1. Restaurant Loyalty Dashboard (`#dashboard`)
- **Top Greeting & Time Filter**: "Hi Alex 👋" with dynamic period selector (`Today` vs `Yesterday`) that animates metrics.
- **Today's Highlights**: 4-column metric strip with 3D medallion badges:
  - **Sales**: ₹4,280 (+18.4% growth)
  - **Orders**: 34 completed
  - **Customers**: 0 active diners (with 3D avatar icon)
  - **Rewards Redeemed**: 6 claimed
- **Business Highlights Bar Chart**: 12-week interactive bar chart with tab switcher (`Total Sales`, `Total Orders`, `Total Customers`, `Rewards Redeemed`), peak week highlight tooltip card, and hover tooltips on each bar.
- **Credits Balance Deck**:
  - SMS (100)
  - Email (100)
  - WhatsApp Utility (100)
  - WhatsApp Marketing (100)
  - **Refill Credits Modal**: Add 1,000, 2,500, or 5,000 credits with immediate wallet balance update.
  - **Auto-Refill Modal**: Automatic balance top-up threshold configuration.
- **Stream Performance KPIs**: Active Members (2,840), Repeat Visit Rate (42.8%), Total Points Issued, Loyalty ROI (4.8x).
- **Top Customers & Loyalty VIPs Table**: Interactive guest directory with avatars, visit counts, lifetime spend, points balances, favorite dishes, and click-to-open customer profile drawer.
- **Report Export**: Instant CSV download for Today's highlights report.

### 2. Customer Insights & Profiles (`#customer-insights`)
- **4 Tabbed Views**:
  - `Overview`: High-level diner retention analytics and check averages.
  - `Segmentation`: VIP Spenders, Regular Diners, Slipping Away (At Risk), and New Signups.
  - `Customer Directory`: Live search (by name, email, phone), tier filter pills (All, VIP, Frequent, At Risk), and sort options (Spend, Visits, Points).
  - `Activity Feed`: Real-time dining timeline with points earned and visits logged.
- **Customer Detail Slide-Over Drawer**: Click any customer row to open their full dining profile, lifetime stats, favorite items, and recent receipt history.

### 3. Activate Loyalty Overview (`#loyalty`)
- Choose between **Cashback**, **Amount Spent (Points Based)**, and **Visit Stamp Card** models.
- Reelo-style program cards with examples and CTAs.

### 4. Amount Spent Modal
- Interactive modal with smartphone carousel preview for **WhatsApp**, **SMS**, and **Email** loyalty notifications.

### 5. Multi-Step Program Configurator (`#configurator`)
- **Live Smartphone Preview**: Left-side mobile card that updates in real time as you edit rules.
- **Step 1: Theme & Basic Info**: Customize program title, tagline, color palette (Teal, Violet, Rose, Amber), and spend-to-points ratio (e.g., ₹100 = 10 pts).
- **Step 2: Reward Tiers Editor**: Add, edit, or remove reward tiers (Free items, ₹ Flat discount, % Percentage off).
- **Step 3: Reminders & Expiry**: 30-day win-back reminder toggle and 11-month points expiry warning alerts.
- **Step 4: Delivery Channels**: Official WhatsApp Cloud API, SMS gateway, and Email statements.
- **Step 5: Review & Activate**: Summary review checklist and "Activate Loyalty Program" button triggering celebratory confirmation and switching program state live.

### 6. Companion Hospitality Modules
- **Smart Insights (`#smart-insights`)**: AI-powered analytics with revenue opportunities, churn risk alerts, credits health optimization, and peak dining hours analysis.
- **Broadcast Campaigns (`#campaigns`)**: One-time promotional WhatsApp and SMS blasts.
- **Auto Campaigns (`#auto-campaigns`)**: Evergreen triggers for birthdays, welcome sequence, and win-back alerts.
- **Table QR Codes (`#qr-codes`)**: Printable table tent card generator for guest self check-in and points claim.
- **Guest Feedback (`#feedback`)**: Real-time dining reviews and star ratings.
- **Referral Program (`#referrals`)**: Ambassador incentives and referral rewards.
- **Settings (`#settings`)**: Multi-outlet manager and Stitch API Key integration (`AQ.Ab8RN6...`).

---

## 🗄️ Database Schema & Petpooja POS Integration

The backend architecture is located in the [`database/`](file:///d:/yeezy-loyalty/database/) directory:

- **[schema.sql](file:///d:/yeezy-loyalty/database/schema.sql)**: Production-ready PostgreSQL DDL with Super Admin, multi-tenant brands, outlets, Petpooja integrations, double-entry loyalty ledger, and order ingestion.
- **[schema.prisma](file:///d:/yeezy-loyalty/database/schema.prisma)**: Prisma ORM models for Node.js / TypeScript backends.
- **[ERD_AND_INTEGRATION_GUIDE.md](file:///d:/yeezy-loyalty/database/ERD_AND_INTEGRATION_GUIDE.md)**: Full Entity Relationship Diagram (Mermaid), Petpooja inquiry/redemption/settlement webhook payloads, and discount calculation rules.

---

## ☁️ Deploy to Render (Production in 2 Minutes)

This application is packaged as a **Unified Production Service** (serves both the Vite SPA and the Express POS API from one single service):

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Production release for Render"
git push origin main
```

### 2. Create Web Service on Render
1. Go to **[dashboard.render.com](https://dashboard.render.com)** -> **New +** -> **Web Service**.
2. Select your GitHub repository.
3. Configure the settings:
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** `Free` or `Starter`
4. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render sets this automatically)
5. Click **Create Web Service**!

Render will build the Vite app, compile assets into `dist/`, and launch the Express server.
Your live URL will be: `https://your-service-name.onrender.com`

---

## 🔑 Environment & API Credentials

Configured in [`.env`](file:///d:/yeezy-loyalty/.env):
```env
VITE_STITCH_API_KEY=your_stitch_api_key_here
VITE_STITCH_PROJECT_ID=11187122990638679098
DATABASE_URL=postgresql://postgres:password@localhost:5432/yeezy_loyalty
```
All state and edits are automatically synchronized with browser `localStorage`.

---

## 📱 WhatsApp Business Cloud API Webhook Setup

One multi-tenant webhook endpoint serves the entire Meta app, routing events dynamically to the correct restaurant via `phone_number_id`.

### 1. Environment Variables
Add to your production server or `.env`:
```env
WHATSAPP_VERIFY_TOKEN=your_secure_verify_token
WHATSAPP_APP_SECRET=your_meta_app_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Configure in Meta App Dashboard
1. Go to **Meta for Developers** ➔ **Your App** ➔ **WhatsApp** ➔ **Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL**: `https://yeezy-loyalty.onrender.com/api/whatsapp/webhook` *(or `https://your-domain.com/api/whatsapp/webhook`)*
   - **Verify token**: The value of your `WHATSAPP_VERIFY_TOKEN`
3. Click **Verify and Save**.
4. Under **Webhook fields**, click **Manage** and subscribe to:
   - `messages` *(required for delivery tracking, read receipts, and inbound STOP opt-outs)*
   - `message_template_status_update` *(for template approvals)*
   - `phone_number_quality_update` *(for phone tier quality)*

### 3. Local Handshake Testing
Verify your local or staging server using `curl`:
```bash
curl "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=12345"
```
*Expected response:* HTTP 200 with plain-text body `12345`.

### 4. Automated Signature & Event Test Script
Run the automated test runner to simulate signed status updates and customer `STOP` replies:
```bash
node scripts/test-whatsapp-webhook.js http://localhost:4000/api/whatsapp/webhook <VERIFY_TOKEN> <APP_SECRET>
```


#   y e e z y - l o y a l t y  
 