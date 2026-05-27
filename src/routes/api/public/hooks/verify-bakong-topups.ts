// Auto-verifies pending Bakong topups against the NBC Bakong API and credits
// the wallet via the credit_topup_atomic RPC when paid. Called by pg_cron
// every minute. Idempotent: only acts on rows still in 'pending' status.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkTransactionByMd5, BakongApiError } from "@/lib/bakong.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, Authorization",
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// Cap per-tick work so a slow Bakong API or large backlog can't blow the
// request budget. pg_cron runs us again the next minute.
const MAX_PER_TICK = 25;

export const Route = createFileRoute("/api/public/hooks/verify-bakong-topups")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async () => {
        // pg_cron's minimum interval is 1 minute, but we want md5 checks
        // every 5 seconds. Loop 12 times per invocation with a 5s sleep
        // between ticks, giving an effective ~5s server-side polling rate.
        const TICKS = 12;
        const TICK_INTERVAL_MS = 5000;
        const startedAt = new Date().toISOString();
        const totals = { checked: 0, approved: 0, pending: 0, errors: 0 };

        for (let tick = 0; tick < TICKS; tick++) {
          if (tick > 0) await new Promise((r) => setTimeout(r, TICK_INTERVAL_MS));
          const tickResult = await runVerifyTick();
          totals.checked += tickResult.checked;
          totals.approved += tickResult.approved;
          totals.pending = tickResult.pending; // last-tick snapshot
          totals.errors += tickResult.errors;
        }

        return json({ ok: true, at: startedAt, ticks: TICKS, ...totals });
      },
    },
  },
});

async function runVerifyTick() {
  const nowIso = new Date().toISOString();

  // Pending, not expired, have an md5 to check.
  const { data: rows, error } = await supabaseAdmin
    .from("topup_requests")
    .select("id, user_id, amount_usd, coins, md5, expires_at")
    .eq("status", "pending")
    .not("md5", "is", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_TICK);

  let checked = 0;
  let approved = 0;
  let stillPending = 0;
  let errors = 0;

  if (error) {
    console.error("[verify-bakong-topups] select failed", error);
    return { checked, approved, pending: stillPending, errors: errors + 1 };
  }

  for (const row of rows ?? []) {
    checked++;
    try {
      const check = await checkTransactionByMd5(row.md5 as string);
      if (check?.responseCode !== 0 || !check?.data) {
        stillPending++;
        continue;
      }
      const paid = Number(check.data.amount ?? 0);
      if (paid && Math.abs(paid - Number(row.amount_usd)) > 0.01) {
        console.warn("[verify-bakong-topups] amount mismatch", {
          id: row.id,
          expected: row.amount_usd,
          paid,
        });
      }
      const { data: credit, error: cErr } = await supabaseAdmin.rpc(
        "credit_topup_atomic",
        {
          _request_id: row.id,
          _bakong_response: JSON.parse(JSON.stringify(check)),
        },
      );
      if (cErr) {
        errors++;
        console.error("[verify-bakong-topups] credit failed", {
          id: row.id,
          error: cErr.message,
        });
        continue;
      }
      const result = Array.isArray(credit) ? credit[0] : credit;
      if (result?.ok && Number(result.credited) > 0) {
        approved++;
        console.info("[verify-bakong-topups] credited", {
          id: row.id,
          user_id: row.user_id,
          credited: result.credited,
          new_balance: result.new_balance,
        });
      } else {
        stillPending++;
      }
    } catch (e) {
      errors++;
      if (e instanceof BakongApiError) {
        console.warn("[verify-bakong-topups] bakong error", {
          id: row.id,
          kind: e.kind,
          status: e.status,
        });
      } else {
        console.error("[verify-bakong-topups] unexpected error", {
          id: row.id,
          message: (e as Error).message,
        });
      }
    }
  }

  return { checked, approved, pending: stillPending, errors };
}

