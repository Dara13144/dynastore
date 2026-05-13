import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Static KHQR payload for DynaStore (Bakong account: ben_sothida@bkr)
export const KHQR_PAYLOAD =
  "00020101021129200016ben_sothida@bkrt5204599953038405802KH5909DynaStore6010Phnom Penh62570310Dyna Store021009740310410111TRX012345670710Cashier-0199170013177868551539963040973";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("forbidden");
}

async function coinsPerUsd(): Promise<number> {
  const { data } = await supabaseAdmin.from("app_settings").select("coins_per_usd").eq("id", 1).maybeSingle();
  return Math.max(1, Number(data?.coins_per_usd ?? 1));
}

// Public: get the static KHQR payload + current rate
export const getTopupConfig = createServerFn({ method: "GET" }).handler(async () => {
  const rate = await coinsPerUsd();
  return { qr: KHQR_PAYLOAD, coins_per_usd: rate };
});

// User: submit a topup request with an uploaded slip
export const createTopupRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    amount_usd: z.number().min(0.5).max(10000),
    slip_path: z.string().min(1).max(500),
    note: z.string().trim().max(300).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const rate = await coinsPerUsd();
    const coins = Math.round(data.amount_usd * rate);
    const { data: row, error } = await supabaseAdmin.from("topup_requests").insert({
      user_id: context.userId,
      amount_usd: data.amount_usd,
      coins,
      slip_path: data.slip_path,
      note: data.note ?? null,
    }).select("id, created_at, status, amount_usd, coins").single();
    if (error) throw new Error(error.message);
    return row;
  });

// User: list own requests
export const listMyTopupRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("topup_requests")
      .select("id, amount_usd, coins, status, created_at, reviewed_at, reject_reason")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// Admin: list all requests
export const adminListTopupRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    status: z.enum(["all","pending","approved","rejected"]).default("pending"),
    limit: z.number().int().min(1).max(500).default(100),
  }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    let q = supabaseAdmin.from("topup_requests")
      .select("id, user_id, amount_usd, coins, status, slip_path, note, created_at, reviewed_at, reviewed_by, reject_reason")
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map(r => r.user_id)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", ids)
      : { data: [] as { user_id: string; display_name: string }[] };
    const map = new Map((profs ?? []).map(p => [p.user_id, p.display_name]));
    // sign slip URLs
    const out = await Promise.all((rows ?? []).map(async (r) => {
      const { data: signed } = await supabaseAdmin.storage.from("topup-slips").createSignedUrl(r.slip_path, 60 * 30);
      return { ...r, user_name: map.get(r.user_id) ?? "—", slip_url: signed?.signedUrl ?? null };
    }));
    return out;
  });

// Admin: approve → credits coins to user wallet via admin_set_balance
export const adminApproveTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: req, error: e1 } = await supabaseAdmin
      .from("topup_requests").select("id, user_id, coins, amount_usd, status").eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!req) throw new Error("not_found");
    if (req.status !== "pending") throw new Error("already_reviewed");

    const { data: wallet } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", req.user_id).maybeSingle();
    const current = Number(wallet?.balance ?? 0);
    const newBalance = current + Number(req.coins);
    const { data: bal, error: e2 } = await supabaseAdmin.rpc("admin_set_balance", {
      _user_id: req.user_id, _new_balance: newBalance, _reason: `Topup approved: $${req.amount_usd} (+${req.coins})`,
    });
    if (e2) throw new Error(e2.message);
    const { error: e3 } = await supabaseAdmin.from("topup_requests").update({
      status: "approved", reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (e3) throw new Error(e3.message);
    return { ok: true, new_balance: Number(bal), credited: Number(req.coins) };
  });

// Admin: reject
export const adminRejectTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    reason: z.string().trim().min(1).max(300),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("topup_requests").update({
      status: "rejected", reviewed_by: context.userId, reviewed_at: new Date().toISOString(),
      reject_reason: data.reason,
    }).eq("id", data.id).eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
