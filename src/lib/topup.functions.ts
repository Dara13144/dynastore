import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("forbidden");
}

async function loadCoinsPerUsd() {
  const { data } = await supabaseAdmin.from("app_settings").select("coins_per_usd").eq("id", 1).maybeSingle();
  return data?.coins_per_usd ?? 1;
}

export const submitManualTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    amountUsd: z.number().min(1).max(10000),
    receiptPath: z.string().min(3).max(300),
    note: z.string().trim().max(500).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.receiptPath.startsWith(`${userId}/`)) throw new Error("invalid_receipt_path");
    const coinsPerUsd = await loadCoinsPerUsd();
    const coins = Math.round(data.amountUsd * coinsPerUsd);
    const { data: row, error } = await supabaseAdmin
      .from("manual_topups")
      .insert({ user_id: userId, amount_usd: data.amountUsd, coins, receipt_path: data.receiptPath, note: data.note ?? null })
      .select("id, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyManualTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("manual_topups")
      .select("id, amount_usd, coins, status, note, reject_reason, created_at, reviewed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminListManualTopups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("manual_topups")
      .select("id, user_id, amount_usd, coins, receipt_path, note, status, reject_reason, created_at, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", ids)
      : { data: [] as { user_id: string; display_name: string }[] };
    const map = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));
    return (rows ?? []).map((r) => ({ ...r, user_name: map.get(r.user_id) ?? "User" }));
  });

export const adminGetReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ receiptPath: z.string().min(3).max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: signed, error } = await supabaseAdmin.storage
      .from("topup-receipts").createSignedUrl(data.receiptPath, 60 * 10);
    if (error || !signed) throw new Error(error?.message || "sign_failed");
    return { url: signed.signedUrl };
  });

export const adminApproveManualTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: r, error } = await supabaseAdmin.rpc("approve_manual_topup", { _id: data.id, _admin: context.userId });
    if (error) throw new Error(error.message);
    const row = Array.isArray(r) ? r[0] : r;
    return { ok: row?.ok ?? false, balance: row?.new_balance ?? 0, message: row?.message ?? "" };
  });

export const adminRejectManualTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), reason: z.string().trim().max(300).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: ok, error } = await supabaseAdmin.rpc("reject_manual_topup", {
      _id: data.id, _admin: context.userId, _reason: data.reason ?? "",
    });
    if (error) throw new Error(error.message);
    return { ok: !!ok };
  });
