import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? {
      id: 1, coins_per_usd: 1, tx_ttl_min: 5,
      bakong_account_id: "", bakong_merchant_name: "", bakong_merchant_city: "", bakong_merchant_phone: "",
    };
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    coins_per_usd: z.number().int().min(1).max(100000),
    tx_ttl_min: z.number().int().min(1).max(60),
    bakong_account_id: z.string().max(200).nullable().optional(),
    bakong_merchant_name: z.string().max(100).nullable().optional(),
    bakong_merchant_city: z.string().max(100).nullable().optional(),
    bakong_merchant_phone: z.string().max(50).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("app_settings").upsert({ id: 1, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetUserBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    user_id: z.string().uuid(),
    new_balance: z.number().int().min(0).max(10_000_000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: bal, error } = await supabaseAdmin.rpc("admin_set_balance", {
      _user_id: data.user_id, _new_balance: data.new_balance,
    });
    if (error) throw new Error(error.message);
    return { balance: Number(bal) };
  });

export const listMyTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("md5, amount_usd, coins, status, created_at, expires_at, paid_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAllTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("id, user_id, md5, amount_usd, coins, status, created_at, expires_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
