## Goal
Replace the manual "upload slip → admin approves" flow with automatic verification using the Bakong Open API, so coins are credited the moment payment lands.

## How it works
1. User opens TopupModal, enters USD amount.
2. Server generates a **unique KHQR** for that exact amount (so each transaction has a unique MD5 hash) and returns: `qr_payload`, `md5`, `expires_at`, `coins`.
3. User scans with any Cambodian bank app and pays.
4. Frontend polls a `verifyTopup` server function every 3s (up to TTL, default 5 min).
5. Server calls Bakong API `POST /v1/check_transaction_by_md5` with `BAKONG_DEVELOPER_TOKEN`. If `responseCode === 0` and amount matches → credit wallet atomically, mark request `approved`, send Telegram notice.
6. If TTL expires without payment → request marked `expired` (no credit).

## Changes

### Database (migration)
- Add columns to `topup_requests`: `md5 text unique`, `qr_payload text`, `expires_at timestamptz`, `bakong_verified_at timestamptz`, `bakong_response jsonb`.
- Make `slip_path` nullable (no longer required for auto flow).
- Add `'expired'` to `topup_status` enum.
- New RPC `credit_topup_atomic(_request_id uuid)` — claims pending row, credits wallet, logs balance_change, returns new balance. Idempotent via row status check.

### Server functions (`src/lib/topup.functions.ts`)
- `createBakongTopup({ amount_usd })` — generates dynamic KHQR (amount-bound), computes MD5, inserts pending row, returns `{ id, qr_payload, md5, expires_at, coins }`.
- `verifyBakongTopup({ id })` — looks up row, calls Bakong API, on success calls `credit_topup_atomic`, returns `{ status, new_balance }`.
- Keep existing manual `createTopupRequest` / admin approve+reject for backward compatibility (admin can still manually approve old uploads).

### Helper (`src/lib/bakong.server.ts`)
- `buildKhqr(amount, billNumber)` — builds EMVCo KHQR string with CRC16, using existing BAKONG_* env vars.
- `md5Of(payload)` — node crypto md5 hex.
- `checkTransactionByMd5(md5)` — fetch `https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5` with bearer token.

### Frontend (`src/components/TopupModal.tsx`)
- New "Pay with Bakong (auto)" tab as default; existing "Upload slip" stays as fallback tab.
- Auto tab: enter amount → show QR (rendered from payload via `qrcode` lib) + countdown → poll `verifyBakongTopup` every 3s → on success show "✅ +N coins credited" and close.

## Out of scope
- Webhook from Bakong (their public API is poll-only for merchant tier).
- Refunds / partial payments.

## Secrets
All required secrets already exist (`BAKONG_DEVELOPER_TOKEN`, `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_NAME`, `BAKONG_MERCHANT_CITY`, `BAKONG_MERCHANT_PHONE`, `BAKONG_ACQUIRING_BANK`). No new secrets needed.

Approve to proceed.