import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const getAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("id, md5, user_id, amount_usd, coins, status, created_at, paid_at, expires_at, bakong_ref")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return { transactions: data ?? [] };
  });

export const lookupTransactionByMd5 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ md5: z.string().min(8).max(128) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const md5 = data.md5.trim();

    const { data: row, error } = await supabaseAdmin
      .from("transactions")
      .select("id, md5, user_id, amount_usd, coins, status, created_at, paid_at, expires_at, bakong_ref, qr_payload")
      .eq("md5", md5)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) return { found: false as const, md5 };

    const now = Date.now();
    const expiresMs = new Date(row.expires_at).getTime();
    const isExpired = row.status === "pending" && expiresMs <= now;

    return {
      found: true as const,
      md5,
      transaction: {
        id: row.id,
        md5: row.md5,
        userId: row.user_id,
        status: row.status,
        amountUsd: Number(row.amount_usd),
        coins: row.coins,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        paidAt: row.paid_at,
        bakongRef: row.bakong_ref,
        qrPayloadPreview: row.qr_payload ? `${row.qr_payload.slice(0, 48)}…(${row.qr_payload.length} chars)` : null,
        isPendingExpired: isExpired,
        secondsUntilExpiry: Math.round((expiresMs - now) / 1000),
      },
    };
  });
