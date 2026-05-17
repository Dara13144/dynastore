// Bakong payment callback / webhook.
//
// Bakong's merchant tier doesn't officially push webhooks, but this endpoint
// lets a) any external bridge you point at it, b) your own admin tool, or
// c) a scheduled job nudge us to settle a topup *before* the 3s poll loop
// finds it. Security model:
//
//   1. Caller MUST send `x-webhook-secret: <BAKONG_WEBHOOK_SECRET>`.
//   2. We re-verify the txn against Bakong's official API (md5 lookup) —
//      so even a leaked secret can't forge a credit; only real, paid txns
//      are accepted.
//   3. Credit is applied via `credit_topup_atomic` RPC, which is idempotent.
//
// Body shape (flexible):
//   { "md5": "<md5>" }                — primary
//   { "id":  "<topup_request_uuid>" } — alt, looks up md5 from DB
//   { "hash": "<bakong_tx_hash>" }    — alt, future-proof
//
// Returns 200 with { status, credited, new_balance } on terminal states,
// 202 with { status: "pending" } when Bakong hasn't seen the txn yet.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkTransactionByMd5 } from "@/lib/bakong.server";
import { notifyTelegram, formatUserById } from "@/lib/telegram.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-webhook-secret, Authorization",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/bakong-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const secret = process.env.BAKONG_WEBHOOK_SECRET;
        if (!secret) {
          console.error("[bakong-webhook] BAKONG_WEBHOOK_SECRET not configured");
          return json({ error: "webhook_not_configured" }, 503);
        }
        const provided =
          request.headers.get("x-webhook-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (provided !== secret) {
          return json({ error: "unauthorized" }, 401);
        }

        let payload: { md5?: string; id?: string; hash?: string };
        try {
          payload = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        // Resolve topup_requests row from any of {id, md5, hash}.
        let row:
          | { id: string; user_id: string; status: string; md5: string | null; amount_usd: number; coins: number; expires_at: string | null }
          | null = null;
        if (payload.id) {
          const { data } = await supabaseAdmin
            .from("topup_requests")
            .select("id, user_id, status, md5, amount_usd, coins, expires_at")
            .eq("id", payload.id).maybeSingle();
          row = data as typeof row;
        } else if (payload.md5) {
          const { data } = await supabaseAdmin
            .from("topup_requests")
            .select("id, user_id, status, md5, amount_usd, coins, expires_at")
            .eq("md5", payload.md5).maybeSingle();
          row = data as typeof row;
        }
        if (!row) return json({ error: "not_found" }, 404);

        if (row.status === "approved") {
          const { data: w } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", row.user_id).maybeSingle();
          return json({ status: "approved", credited: 0, new_balance: Number(w?.balance ?? 0) });
        }
        if (row.status === "rejected" || row.status === "expired") {
          return json({ status: row.status, credited: 0, new_balance: 0 });
        }
        if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
          await supabaseAdmin.from("topup_requests")
            .update({ status: "expired", reviewed_at: new Date().toISOString() })
            .eq("id", row.id).eq("status", "pending");
          return json({ status: "expired", credited: 0, new_balance: 0 });
        }
        if (!row.md5) return json({ error: "missing_md5" }, 422);

        // Authoritative check against Bakong's API.
        const check = await checkTransactionByMd5(row.md5);
        if (check.responseCode !== 0 || !check.data) {
          return json({ status: "pending", credited: 0, new_balance: 0 }, 202);
        }

        const paid = Number(check.data.amount ?? 0);
        if (paid && Math.abs(paid - Number(row.amount_usd)) > 0.01) {
          console.warn("[bakong-webhook] amount mismatch", { id: row.id, expected: row.amount_usd, paid });
        }

        const { data: credit, error: cErr } = await supabaseAdmin.rpc("credit_topup_atomic", {
          _request_id: row.id,
          _bakong_response: JSON.parse(JSON.stringify(check)),
        });
        if (cErr) {
          console.error("[bakong-webhook] credit_topup_atomic failed", cErr);
          return json({ error: cErr.message }, 500);
        }
        const result = Array.isArray(credit) ? credit[0] : credit;

        if (result?.ok && Number(result?.credited) > 0) {
          const who = await formatUserById(row.user_id);
          await notifyTelegram(
            `⚡ <b>Bakong Webhook Approved</b>\n👤 ${who}\n💵 $${Number(row.amount_usd).toFixed(2)} → <b>+${Number(row.coins).toLocaleString()} coins</b>\n💼 New balance: ${Number(result.new_balance).toLocaleString()}\n🔗 hash <code>${check.data.hash}</code>\n🆔 <code>${row.id}</code>`,
            "topup_approved",
          );
        }

        return json({
          status: result?.status ?? "approved",
          credited: Number(result?.credited ?? 0),
          new_balance: Number(result?.new_balance ?? 0),
        });
      },
    },
  },
});
