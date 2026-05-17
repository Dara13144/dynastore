// Bakong payment callback / webhook.
//
// Security model:
//   1. Caller MUST send `x-webhook-secret: <BAKONG_WEBHOOK_SECRET>`
//      (or `Authorization: Bearer <secret>`).
//   2. Replay protection: every delivery is logged in
//      `bakong_webhook_events`. A unique constraint on `hash` rejects
//      duplicates with HTTP 200 + { code: "duplicate" } so the caller
//      stops retrying.
//   3. Optional freshness window: if the payload (or `x-webhook-timestamp`
//      header) carries a timestamp, deliveries older than
//      BAKONG_WEBHOOK_MAX_AGE_SECONDS (default 600s) are rejected.
//   4. We re-verify the txn against Bakong's official API (md5 lookup),
//      so a leaked secret cannot forge a credit.
//   5. Credit is applied via `credit_topup_atomic` RPC (idempotent).
//
// Response envelope (always JSON):
//   { ok: boolean, code: string, message: string, ...extra }
//
// Codes:
//   ok                  — credited or already-final, see `status`
//   duplicate           — same hash already processed
//   pending             — Bakong has not seen the txn yet (HTTP 202)
//   expired_request     — topup expired before payment
//   stale_delivery      — webhook older than allowed window
//   invalid_json        — body is not valid JSON
//   invalid_payload     — required fields missing
//   unauthorized        — bad/missing secret
//   not_found           — topup_request not resolved
//   missing_md5         — row has no md5 stored
//   webhook_not_configured — BAKONG_WEBHOOK_SECRET unset on server
//   server_error        — unexpected failure
//
// Body shape (flexible):
//   { md5, id, hash, delivery_id?, timestamp? }   (any of id|md5|hash)

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkTransactionByMd5 } from "@/lib/bakong.server";
import { notifyTelegram, formatUserById } from "@/lib/telegram.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-webhook-secret, x-webhook-timestamp, x-delivery-id, Authorization",
} as const;

type Envelope = {
  ok: boolean;
  code: string;
  message: string;
  [k: string]: unknown;
};

function json(body: Envelope, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

const DEFAULT_MAX_AGE_S = 600;

function parseTimestamp(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e12 ? v : v * 1000;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n > 1e12 ? n : n * 1000;
    const d = Date.parse(v);
    return Number.isFinite(d) ? d : null;
  }
  return null;
}

async function logDelivery(input: {
  delivery_id: string | null;
  md5: string | null;
  hash: string | null;
  topup_request_id: string | null;
  outcome: string;
  status_code: number;
  payload: unknown;
}) {
  try {
    await supabaseAdmin.from("bakong_webhook_events").insert({
      delivery_id: input.delivery_id,
      md5: input.md5,
      hash: input.hash,
      topup_request_id: input.topup_request_id,
      outcome: input.outcome,
      status_code: input.status_code,
      payload: input.payload as never,
    });
  } catch (e) {
    // unique-violation on `hash` is expected on duplicates; ignore.
    if ((e as { code?: string } | undefined)?.code !== "23505") {
      console.warn("[bakong-webhook] logDelivery failed", e);
    }
  }
}

export const Route = createFileRoute("/api/public/bakong-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const secret = process.env.BAKONG_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[bakong-webhook] BAKONG_WEBHOOK_SECRET not configured");
          return json(
            {
              ok: false,
              code: "webhook_not_configured",
              message: "Server is missing BAKONG_WEBHOOK_SECRET.",
            },
            503,
          );
        }
        const provided =
          request.headers.get("x-webhook-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (provided !== secret) {
          return json(
            { ok: false, code: "unauthorized", message: "Invalid or missing x-webhook-secret." },
            401,
          );
        }

        let payload: {
          md5?: string;
          id?: string;
          hash?: string;
          delivery_id?: string;
          timestamp?: string | number;
        };
        try {
          payload = await request.json();
        } catch {
          return json(
            { ok: false, code: "invalid_json", message: "Request body must be JSON." },
            400,
          );
        }

        const deliveryId = payload.delivery_id ?? request.headers.get("x-delivery-id") ?? null;

        // Freshness window
        const maxAgeS = Number(process.env.BAKONG_WEBHOOK_MAX_AGE_SECONDS ?? DEFAULT_MAX_AGE_S);
        const ts =
          parseTimestamp(payload.timestamp) ??
          parseTimestamp(request.headers.get("x-webhook-timestamp"));
        if (ts && Number.isFinite(maxAgeS) && maxAgeS > 0) {
          const age = (Date.now() - ts) / 1000;
          if (age > maxAgeS) {
            await logDelivery({
              delivery_id: deliveryId,
              md5: payload.md5 ?? null,
              hash: payload.hash ?? null,
              topup_request_id: payload.id ?? null,
              outcome: "stale_delivery",
              status_code: 408,
              payload,
            });
            return json(
              {
                ok: false,
                code: "stale_delivery",
                message: `Delivery is ${Math.round(age)}s old, max ${maxAgeS}s.`,
              },
              408,
            );
          }
        }

        if (!payload.id && !payload.md5 && !payload.hash) {
          return json(
            { ok: false, code: "invalid_payload", message: "Provide one of: id, md5, hash." },
            422,
          );
        }

        // Replay guard via hash uniqueness (when caller supplies hash up-front).
        if (payload.hash) {
          const { data: prior } = await supabaseAdmin
            .from("bakong_webhook_events")
            .select("id, outcome, topup_request_id, status_code")
            .eq("hash", payload.hash)
            .maybeSingle();
          if (prior) {
            return json(
              {
                ok: true,
                code: "duplicate",
                message: "Webhook hash already processed; ignoring replay.",
                prior_outcome: prior.outcome,
                topup_request_id: prior.topup_request_id,
              },
              200,
            );
          }
        }

        // Resolve topup_requests row.
        type Row = {
          id: string;
          user_id: string;
          status: string;
          md5: string | null;
          amount_usd: number;
          coins: number;
          expires_at: string | null;
        };
        let row: Row | null = null;
        if (payload.id) {
          const { data } = await supabaseAdmin
            .from("topup_requests")
            .select("id, user_id, status, md5, amount_usd, coins, expires_at")
            .eq("id", payload.id)
            .maybeSingle();
          row = (data ?? null) as Row | null;
        } else if (payload.md5) {
          const { data } = await supabaseAdmin
            .from("topup_requests")
            .select("id, user_id, status, md5, amount_usd, coins, expires_at")
            .eq("md5", payload.md5)
            .maybeSingle();
          row = (data ?? null) as Row | null;
        }
        if (!row) {
          await logDelivery({
            delivery_id: deliveryId,
            md5: payload.md5 ?? null,
            hash: payload.hash ?? null,
            topup_request_id: null,
            outcome: "not_found",
            status_code: 404,
            payload,
          });
          return json(
            { ok: false, code: "not_found", message: "No topup_request matched id/md5." },
            404,
          );
        }

        // Terminal states — log + idempotent reply.
        if (row.status === "approved") {
          const { data: w } = await supabaseAdmin
            .from("wallets")
            .select("balance")
            .eq("user_id", row.user_id)
            .maybeSingle();
          await logDelivery({
            delivery_id: deliveryId,
            md5: row.md5,
            hash: payload.hash ?? null,
            topup_request_id: row.id,
            outcome: "already_approved",
            status_code: 200,
            payload,
          });
          return json({
            ok: true,
            code: "already_approved",
            message: "Topup was already credited.",
            status: "approved",
            credited: 0,
            new_balance: Number(w?.balance ?? 0),
            topup_request_id: row.id,
          });
        }
        if (row.status === "rejected" || row.status === "expired") {
          await logDelivery({
            delivery_id: deliveryId,
            md5: row.md5,
            hash: payload.hash ?? null,
            topup_request_id: row.id,
            outcome: `already_${row.status}`,
            status_code: 200,
            payload,
          });
          return json({
            ok: true,
            code: `already_${row.status}`,
            message: `Topup is already ${row.status}; not credited.`,
            status: row.status,
            credited: 0,
            new_balance: 0,
            topup_request_id: row.id,
          });
        }
        if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
          await supabaseAdmin
            .from("topup_requests")
            .update({ status: "expired", reviewed_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("status", "pending");
          await logDelivery({
            delivery_id: deliveryId,
            md5: row.md5,
            hash: payload.hash ?? null,
            topup_request_id: row.id,
            outcome: "expired_request",
            status_code: 410,
            payload,
          });
          return json(
            {
              ok: false,
              code: "expired_request",
              message: "Topup expired before payment was confirmed.",
              status: "expired",
              credited: 0,
              new_balance: 0,
              topup_request_id: row.id,
            },
            410,
          );
        }
        if (!row.md5) {
          await logDelivery({
            delivery_id: deliveryId,
            md5: null,
            hash: payload.hash ?? null,
            topup_request_id: row.id,
            outcome: "missing_md5",
            status_code: 422,
            payload,
          });
          return json(
            { ok: false, code: "missing_md5", message: "Topup row has no md5; cannot verify." },
            422,
          );
        }

        // Authoritative check.
        let check;
        try {
          check = await checkTransactionByMd5(row.md5);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          console.error("[bakong-webhook] checkTransactionByMd5 failed", msg);
          await logDelivery({
            delivery_id: deliveryId,
            md5: row.md5,
            hash: payload.hash ?? null,
            topup_request_id: row.id,
            outcome: "upstream_error",
            status_code: 502,
            payload,
          });
          return json(
            { ok: false, code: "upstream_error", message: `Bakong API error: ${msg}` },
            502,
          );
        }

        if (check.responseCode !== 0 || !check.data) {
          await logDelivery({
            delivery_id: deliveryId,
            md5: row.md5,
            hash: payload.hash ?? null,
            topup_request_id: row.id,
            outcome: "pending",
            status_code: 202,
            payload,
          });
          return json(
            {
              ok: false,
              code: "pending",
              message: "Bakong has not yet confirmed this transaction. Retry later.",
              status: "pending",
              credited: 0,
              new_balance: 0,
              topup_request_id: row.id,
            },
            202,
          );
        }

        // Second-chance duplicate check using the *authoritative* hash from Bakong.
        const realHash = String(check.data.hash);
        const { data: priorByRealHash } = await supabaseAdmin
          .from("bakong_webhook_events")
          .select("id, outcome, topup_request_id")
          .eq("hash", realHash)
          .maybeSingle();
        if (priorByRealHash) {
          return json({
            ok: true,
            code: "duplicate",
            message: "Bakong transaction hash already processed; ignoring replay.",
            prior_outcome: priorByRealHash.outcome,
            topup_request_id: priorByRealHash.topup_request_id,
          });
        }

        const paid = Number(check.data.amount ?? 0);
        if (paid && Math.abs(paid - Number(row.amount_usd)) > 0.01) {
          console.warn("[bakong-webhook] amount mismatch", {
            id: row.id,
            expected: row.amount_usd,
            paid,
          });
        }

        const { data: credit, error: cErr } = await supabaseAdmin.rpc("credit_topup_atomic", {
          _request_id: row.id,
          _bakong_response: JSON.parse(JSON.stringify(check)),
        });
        if (cErr) {
          console.error("[bakong-webhook] credit_topup_atomic failed", cErr);
          await logDelivery({
            delivery_id: deliveryId,
            md5: row.md5,
            hash: realHash,
            topup_request_id: row.id,
            outcome: "server_error",
            status_code: 500,
            payload,
          });
          return json({ ok: false, code: "server_error", message: cErr.message }, 500);
        }
        const result = Array.isArray(credit) ? credit[0] : credit;

        if (result?.ok && Number(result?.credited) > 0) {
          const who = await formatUserById(row.user_id);
          await notifyTelegram(
            `⚡ <b>Bakong Webhook Approved</b>\n👤 ${who}\n💵 $${Number(row.amount_usd).toFixed(2)} → <b>+${Number(row.coins).toLocaleString()} coins</b>\n💼 New balance: ${Number(result.new_balance).toLocaleString()}\n🔗 hash <code>${realHash}</code>\n🆔 <code>${row.id}</code>`,
            "topup_approved",
          );
        }

        await logDelivery({
          delivery_id: deliveryId,
          md5: row.md5,
          hash: realHash,
          topup_request_id: row.id,
          outcome: result?.ok ? "credited" : (result?.status ?? "no_change"),
          status_code: 200,
          payload,
        });

        return json({
          ok: true,
          code: result?.ok ? "credited" : "no_change",
          message: result?.ok
            ? "Topup credited successfully."
            : "Topup was not in a creditable state.",
          status: result?.status ?? "approved",
          credited: Number(result?.credited ?? 0),
          new_balance: Number(result?.new_balance ?? 0),
          topup_request_id: row.id,
          hash: realHash,
        });
      },
    },
  },
});
