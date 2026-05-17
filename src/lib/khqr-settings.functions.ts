import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildKhqr, getEffectiveBakongAccountId } from "@/lib/bakong.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

// Bakong account ID format: "<handle>@<bank>" e.g. "ben_sothida@bkrt"
const ACCOUNT_ID_RE = /^[a-zA-Z0-9._-]{2,40}@[a-zA-Z0-9]{2,16}$/;

export const getKhqrSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("bakong_account_id, updated_at")
      .eq("id", 1)
      .maybeSingle();
    const dbValue = (data?.bakong_account_id ?? "").trim() || null;
    const envValue = (process.env.BAKONG_ACCOUNT_ID ?? "").trim() || null;
    const effective = await getEffectiveBakongAccountId();
    return {
      dbValue,
      envValue,
      effective,
      source: dbValue ? "database" : envValue ? "environment" : "default",
      updatedAt: data?.updated_at ?? null,
    } as const;
  });

export const setKhqrAccountId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        // empty string clears the override and reverts to env fallback
        accountId: z.string().max(60),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const next = data.accountId.trim();
    if (next && !ACCOUNT_ID_RE.test(next)) {
      throw new Error("invalid_account_id_format");
    }

    const { data: prev } = await supabaseAdmin
      .from("app_settings")
      .select("bakong_account_id")
      .eq("id", 1)
      .maybeSingle();
    const oldValue = prev?.bakong_account_id ?? null;
    const newValue = next || null;

    const { error } = await supabaseAdmin
      .from("app_settings")
      .update({ bakong_account_id: newValue, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);

    // best-effort audit row
    try {
      await supabaseAdmin.from("app_settings_audit").insert({
        field: "bakong_account_id",
        old_value: oldValue,
        new_value: newValue,
        changed_by: context.userId,
      });
    } catch {
      /* audit table may not allow inserts via RLS in some setups */
    }

    const effective = await getEffectiveBakongAccountId();
    return { ok: true, effective } as const;
  });

/** Build a sample KHQR payload using a candidate account ID (no DB write). */
export const previewKhqr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        accountId: z.string().max(60).optional(),
        amountUsd: z.number().min(0.01).max(10000).default(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const candidate = (data.accountId ?? "").trim();
    if (candidate && !ACCOUNT_ID_RE.test(candidate)) {
      throw new Error("invalid_account_id_format");
    }
    const accountId = candidate || (await getEffectiveBakongAccountId());
    const billNumber = `PREVIEW${Date.now().toString(36).toUpperCase()}`;
    const payload = buildKhqr(data.amountUsd, billNumber, accountId);
    return { payload, accountId, billNumber } as const;
  });
