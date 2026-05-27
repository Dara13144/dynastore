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

const DEFAULT_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 120000];

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
    return (
      data ?? ({
        id: 1,
        coins_per_usd: 1,
        tx_ttl_min: 5,
        tus_max_net_retries: 50,
        tus_retry_delays_ms: DEFAULT_RETRY_DELAYS,
        tus_backoff_base_ms: 3000,
        tus_backoff_step_ms: 2000,
        tus_backoff_cap_ms: 30000,
      } as NonNullable<typeof data>)
    );
  });

const retryDelaysSchema = z
  .array(z.number().int().min(0).max(600_000))
  .min(1)
  .max(20);

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        coins_per_usd: z.number().int().min(1).max(100000),
        tx_ttl_min: z.number().int().min(1).max(60),
        tus_max_net_retries: z.number().int().min(0).max(500),
        tus_retry_delays_ms: retryDelaysSchema,
        tus_backoff_base_ms: z.number().int().min(0).max(600_000),
        tus_backoff_step_ms: z.number().int().min(0).max(600_000),
        tus_backoff_cap_ms: z.number().int().min(0).max(600_000),
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
    const fields: Array<keyof typeof data> = [
      "coins_per_usd",
      "tx_ttl_min",
      "tus_max_net_retries",
      "tus_retry_delays_ms",
      "tus_backoff_base_ms",
      "tus_backoff_step_ms",
      "tus_backoff_cap_ms",
    ];
    const auditRows = fields
      .map((f) => {
        const oldVal = prev ? (prev as Record<string, unknown>)[f] : null;
        const newVal = (data as Record<string, unknown>)[f] ?? null;
        const oldStr = oldVal == null ? null : JSON.stringify(oldVal);
        const newStr = newVal == null ? null : JSON.stringify(newVal);
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

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    // System totals
    const [walletsRes, usersRes, gamesRes, topupsAggRes] = await Promise.all([
      supabaseAdmin.from("wallets").select("balance"),
      supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }),
      supabaseAdmin.from("games").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("topup_requests")
        .select("amount_usd, coins")
        .eq("status", "approved"),
    ]);

    const totalCoins = (walletsRes.data ?? []).reduce((s, w) => s + (w.balance ?? 0), 0);
    const totalUsers = usersRes.count ?? 0;
    const totalGames = gamesRes.count ?? 0;
    const topupsApproved = topupsAggRes.data ?? [];
    const totalToppedUsd = topupsApproved.reduce((s, t) => s + Number(t.amount_usd ?? 0), 0);
    const totalToppedCoins = topupsApproved.reduce((s, t) => s + (t.coins ?? 0), 0);

    // Recent approved top-ups (balance added)
    const { data: recentTopups } = await supabaseAdmin
      .from("topup_requests")
      .select("id, user_id, amount_usd, coins, status, created_at, reviewed_at")
      .eq("status", "approved")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(20);

    // Recent purchases
    const { data: recentPurchases } = await supabaseAdmin
      .from("library")
      .select("id, user_id, game_id, created_at")
      .eq("kind", "owned")
      .order("created_at", { ascending: false })
      .limit(20);

    const userIds = Array.from(
      new Set([
        ...(recentTopups ?? []).map((r) => r.user_id),
        ...(recentPurchases ?? []).map((r) => r.user_id),
      ]),
    );
    const gameIds = Array.from(new Set((recentPurchases ?? []).map((r) => r.game_id)));

    const [{ data: profs }, { data: gms }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", userIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
      gameIds.length
        ? supabaseAdmin.from("games").select("id, title, price_coins").in("id", gameIds)
        : Promise.resolve({ data: [] as { id: string; title: string; price_coins: number }[] }),
    ]);
    const nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));
    const gameMap = new Map((gms ?? []).map((g) => [g.id, g]));

    const totalRevenueCoins = (recentPurchases ?? []).reduce(
      (s, p) => s + (gameMap.get(p.game_id)?.price_coins ?? 0),
      0,
    );

    // Monthly sales (last 6 months) — sum approved topups USD per month
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);
    const { data: monthlyTopups } = await supabaseAdmin
      .from("topup_requests")
      .select("amount_usd, reviewed_at, created_at")
      .eq("status", "approved")
      .gte("created_at", sixMonthsAgo.toISOString());
    const monthBuckets: { key: string; label: string; usd: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(sixMonthsAgo);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthBuckets.push({
        key,
        label: d.toLocaleString("en", { month: "short" }),
        usd: 0,
      });
    }
    for (const t of monthlyTopups ?? []) {
      const when = new Date(t.reviewed_at ?? t.created_at);
      const k = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}`;
      const b = monthBuckets.find((x) => x.key === k);
      if (b) b.usd += Number(t.amount_usd ?? 0);
    }

    // Category breakdown — count of purchases by game category
    const { data: allLib } = await supabaseAdmin
      .from("library")
      .select("game_id")
      .eq("kind", "owned");
    const libGameIds = Array.from(new Set((allLib ?? []).map((l) => l.game_id)));
    const { data: catGames } = libGameIds.length
      ? await supabaseAdmin.from("games").select("id, category").in("id", libGameIds)
      : { data: [] as { id: string; category: string }[] };
    const catMap = new Map((catGames ?? []).map((g) => [g.id, g.category]));
    const categoryCounts: Record<string, number> = {};
    for (const l of allLib ?? []) {
      const c = catMap.get(l.game_id) ?? "other";
      categoryCounts[c] = (categoryCounts[c] ?? 0) + 1;
    }
    const totalCatCount = Object.values(categoryCounts).reduce((s, n) => s + n, 0) || 1;
    const categories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / totalCatCount) * 100) }))
      .sort((a, b) => b.count - a.count);

    // 30-day stats
    const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ count: newUsers30 }, { count: newPurchases30 }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .gte("created_at", thirtyAgo),
      supabaseAdmin
        .from("library")
        .select("id", { count: "exact", head: true })
        .eq("kind", "owned")
        .gte("created_at", thirtyAgo),
    ]);
    const totalPurchasesAllRes = await supabaseAdmin
      .from("library")
      .select("id", { count: "exact", head: true })
      .eq("kind", "owned");

    return {
      totals: {
        totalCoins,
        totalUsers,
        totalGames,
        totalToppedUsd,
        totalToppedCoins,
        totalPurchases: totalPurchasesAllRes.count ?? 0,
        newUsers30: newUsers30 ?? 0,
        newPurchases30: newPurchases30 ?? 0,
      },
      monthlySales: monthBuckets.map((b) => ({ month: b.label, usd: Math.round(b.usd * 100) / 100 })),
      categories,
      recentTopups: (recentTopups ?? []).map((r) => ({
        ...r,
        user_name: nameMap.get(r.user_id) ?? "User",
      })),
      recentPurchases: (recentPurchases ?? []).map((p) => ({
        ...p,
        user_name: nameMap.get(p.user_id) ?? "User",
        game_title: gameMap.get(p.game_id)?.title ?? p.game_id,
        price_coins: gameMap.get(p.game_id)?.price_coins ?? 0,
      })),
      recentPurchasesRevenueCoins: totalRevenueCoins,
    };
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
