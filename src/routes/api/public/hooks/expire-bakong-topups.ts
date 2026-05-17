// Sweeps pending Bakong topup requests whose expires_at has passed and marks
// them 'expired'. Called by pg_cron every minute. Client poll loops read the
// new status and stop on their next tick.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export const Route = createFileRoute("/api/public/hooks/expire-bakong-topups")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async () => {
        const now = new Date().toISOString();
        const { data, error } = await supabaseAdmin
          .from("topup_requests")
          .update({ status: "expired", reviewed_at: now })
          .eq("status", "pending")
          .not("expires_at", "is", null)
          .lt("expires_at", now)
          .select("id");
        if (error) {
          console.error("[expire-bakong-topups] failed", error);
          return json({ ok: false, error: error.message }, 500);
        }
        const count = data?.length ?? 0;
        if (count > 0) console.info(`[expire-bakong-topups] expired ${count} request(s)`);
        return json({ ok: true, expired: count, at: now });
      },
    },
  },
});
