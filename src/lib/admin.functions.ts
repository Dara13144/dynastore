import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { id: 1, coins_per_usd: 1, tx_ttl_min: 5 };
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        coins_per_usd: z.number().int().min(1).max(100000),
        tx_ttl_min: z.number().int().min(1).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: prev } = await supabaseAdmin
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const fields: Array<keyof typeof data> = ["coins_per_usd", "tx_ttl_min"];
    const auditRows = fields
      .map((f) => {
        const oldVal = prev ? (prev as Record<string, unknown>)[f] : null;
        const newVal = (data as Record<string, unknown>)[f] ?? null;
        const oldStr = oldVal == null ? null : String(oldVal);
        const newStr = newVal == null ? null : String(newVal);
        return {
          field: String(f),
          old_value: oldStr,
          new_value: newStr,
          changed_by: context.userId,
        };
      })
      .filter((r) => r.old_value !== r.new_value);
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ id: 1, ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    if (auditRows.length) {
      await supabaseAdmin.from("app_settings_audit").insert(auditRows);
    }
    return { ok: true, changes: auditRows.length };
  });

export const listSettingsAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("app_settings_audit")
      .select("id, changed_by, field, old_value, new_value, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((rows ?? []).map((r) => r.changed_by)));
    const { data: profs } = ids.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", ids)
      : { data: [] as { user_id: string; display_name: string }[] };
    const map = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));
    return (rows ?? []).map((r) => ({ ...r, changed_by_name: map.get(r.changed_by) ?? "Admin" }));
  });

export const adminSetUserBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        new_balance: z.number().int().min(0).max(10_000_000),
        reason: z.string().trim().max(200).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: bal, error } = await supabaseAdmin.rpc("admin_set_balance", {
      _user_id: data.user_id,
      _new_balance: data.new_balance,
      _reason: data.reason ?? null,
    });
    if (error) throw new Error(error.message);
    return { balance: Number(bal) };
  });

export const listBalanceChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("balance_changes")
      .select("id, user_id, changed_by, old_balance, new_balance, reason, created_at")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const adminIds = Array.from(new Set((rows ?? []).map((r) => r.changed_by)));
    const { data: admins } = adminIds.length
      ? await supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", adminIds)
      : { data: [] as { user_id: string; display_name: string }[] };
    const nameMap = new Map((admins ?? []).map((a) => [a.user_id, a.display_name]));
    return (rows ?? []).map((r) => ({
      ...r,
      changed_by_name: nameMap.get(r.changed_by) ?? "Admin",
    }));
  });

export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        user_id: z.string().uuid(),
        is_admin: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId && !data.is_admin) {
      throw new Error("មិនអាចដកសិទ្ធិខ្លួនឯងបានទេ");
    }
    if (data.is_admin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true, is_admin: data.is_admin };
  });
