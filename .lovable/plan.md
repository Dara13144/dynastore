## Goal

Replace the current `/admin` page with a new sidebar-based admin layout matching the AkiraStore Admin screenshots, while keeping all existing data, RLS, and business logic intact (games, stock_items, topup_requests, wallets, user_roles, settings).

## New layout

```text
┌─────────────────┬──────────────────────────────────────────┐
│ DYNASTORE Admin │   Dashboard / Products / Orders / ...   │
│  • Dashboard    │                                          │
│  • Products     │   <Active tab content>                   │
│  • Orders       │                                          │
│  • Wallets      │                                          │
│  • Settings     │                                          │
│                 │                                          │
│ ← Back to store │                                          │
└─────────────────┴──────────────────────────────────────────┘
```

- Left sidebar (collapsible on mobile) using existing shadcn `Sidebar` primitives.
- Header strip removed; page title sits at top of each tab content area.
- "Back to store" link pinned to bottom of sidebar.

## Pages

### 1. Dashboard
- Four stat cards: Revenue (7d), Orders count, Products count, Customers count.
- Recent orders panel: last 5 approved topups + bakong orders.
- Top products panel: top 5 games by `library.kind='owned'` count.

### 2. Products & Account Stock
- Search bar + category filter + product count badge.
- Table rows for each game: image, title, tagline, category, "X / cap Y" stock display, price, **Stock / Edit / Delete** buttons.
- "Stock" expands an inline panel with:
  - Left: textarea "Add accounts (one per line)" + green **Add to stock** button. Each line becomes a row in `stock_items` with `status='available'` and the pasted text in `content`.
  - Right: list of currently available `stock_items` for that game with a delete icon.
- "Add product" button opens the New Product form (name, tagline, price, stock cap, category, cover emoji, image upload, featured checkbox, description, Create / Cancel).
- Stock cap: new `stock_cap` integer column on `games` — admin can edit the cap inline.

### 3. Orders
- Single table: Order ID, Customer (name + email), Method, Date, Total, Status badge.
- Source: `topup_requests` (Bakong/Wallet) joined with `profiles`; status badges PAID / PENDING / REFUNDED match existing statuses (approved/pending/rejected).

### 4. Wallets
- Table of users: avatar, name, email, balance, "Set balance" button (uses existing `admin_set_balance` RPC).
- Search by name/email.

### 5. Settings
- Existing settings (Bakong account id, coins per usd, tx TTL, TUS knobs) in a single clean card.

## DB changes (1 migration)

- `ALTER TABLE public.games ADD COLUMN tagline text` (nullable).
- `ALTER TABLE public.games ADD COLUMN stock_cap integer NOT NULL DEFAULT 0`.
- `ALTER TABLE public.games ADD COLUMN featured boolean NOT NULL DEFAULT false`.
- `ALTER TABLE public.games ADD COLUMN cover_emoji text`.
- No new tables — `stock_items` already exists and powers credentials delivery.

## Server functions (new in `src/lib/admin.functions.ts`)

All protected by `requireSupabaseAuth` + admin check via `has_role`:
- `getAdminDashboard` → stats + recent orders + top products.
- `listAdminProducts` / `upsertProduct` / `deleteProduct`.
- `addStockBulk({ game_id, lines })` → inserts N `stock_items` rows.
- `deleteStockItem({ id })`.
- `listAdminOrders` → topup_requests + profiles.
- `listAdminWallets` / `adminSetBalance` (wraps existing RPC).

## Files

- New: `src/routes/admin.tsx` (rewritten), `src/components/admin/AdminSidebar.tsx`, `src/components/admin/{DashboardTab,ProductsTab,OrdersTab,WalletsTab,SettingsTab}.tsx`, `src/lib/admin.functions.ts`.
- Delete: old admin subtab components that no longer apply (games, users, topups, content, tutorials, logs, uploads, diagnostics) — superseded by the 5 new tabs. Existing helpers (TUS upload, etc.) stay if still referenced.
- Keep: `/admin/khqr-debug` route untouched.

## Out of scope (ask later if needed)

- Tutorials / Content / Upload audit / Diagnostics / Download logs tabs — being removed in this redesign. If you want any of these kept, tell me which.
- The old "ProductsTab images, screenshots, video, file upload" flow is simplified to just cover image + description in the new form.

Reply **approve** to proceed, or tell me what to change.