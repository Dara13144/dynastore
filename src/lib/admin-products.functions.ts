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

// ============ DASHBOARD OVERVIEW ============
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [topupsRes, ordersCntRes, productsCntRes, customersCntRes, recentRes, libRes] =
      await Promise.all([
        supabaseAdmin
          .from("topup_requests")
          .select("amount_usd")
          .eq("status", "approved")
          .gte("reviewed_at", sevenDaysAgo),
        supabaseAdmin
          .from("topup_requests")
          .select("id", { count: "exact", head: true }),
        supabaseAdmin.from("games").select("id", { count: "exact", head: true }),
        supabaseAdmin.from("profiles").select("user_id", { count: "exact", head: true }),
        supabaseAdmin
          .from("topup_requests")
          .select("id, user_id, amount_usd, status, created_at, reviewed_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabaseAdmin.from("library").select("game_id").eq("kind", "owned"),
      ]);

    const revenue7d = (topupsRes.data ?? []).reduce(
      (s, t) => s + Number(t.amount_usd ?? 0),
      0,
    );

    // Top products by ownership count
    const counts: Record<string, number> = {};
    for (const l of libRes.data ?? []) {
      counts[l.game_id] = (counts[l.game_id] ?? 0) + 1;
    }
    const topIds = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const [{ data: topGames }, { data: profs }] = await Promise.all([
      topIds.length
        ? supabaseAdmin
            .from("games")
            .select("id, title, price_coins, image_url, cover_emoji")
            .in("id", topIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string; price_coins: number; image_url: string | null; cover_emoji: string | null }> }),
      (recentRes.data ?? []).length
        ? supabaseAdmin
            .from("profiles")
            .select("user_id, display_name")
            .in(
              "user_id",
              (recentRes.data ?? []).map((r) => r.user_id),
            )
        : Promise.resolve({ data: [] as Array<{ user_id: string; display_name: string }> }),
    ]);

    const nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));

    return {
      stats: {
        revenue7d,
        orders: ordersCntRes.count ?? 0,
        products: productsCntRes.count ?? 0,
        customers: customersCntRes.count ?? 0,
      },
      recentOrders: (recentRes.data ?? []).map((r) => ({
        id: r.id,
        amount_usd: Number(r.amount_usd ?? 0),
        status: r.status,
        created_at: r.created_at,
        customer: nameMap.get(r.user_id) ?? "User",
      })),
      topProducts: topIds.map((id) => {
        const g = (topGames ?? []).find((x) => x.id === id);
        return {
          id,
          title: g?.title ?? id,
          price_usd: (g?.price_coins ?? 0) / 1, // 1 coin = 1 usd default
          image_url: g?.image_url ?? null,
          cover_emoji: g?.cover_emoji ?? null,
          sold: counts[id],
        };
      }),
    };
  });

// ============ PRODUCTS ============
export const listAdminProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: games, error } = await supabaseAdmin
      .from("games")
      .select(
        "id, title, tagline, category, description, price_coins, image_url, cover_emoji, stock_cap, featured, visible, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Count available stock per game
    const { data: stock } = await supabaseAdmin
      .from("stock_items")
      .select("game_id, status");
    const availMap: Record<string, number> = {};
    for (const s of (stock ?? []) as Array<{ game_id: string; status: string }>) {
      if (s.status === "available") {
        availMap[s.game_id] = (availMap[s.game_id] ?? 0) + 1;
      }
    }

    return (games ?? []).map((g) => ({
      ...g,
      available_stock: availMap[g.id] ?? 0,
    }));
  });

const productSchema = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  title: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200).nullable().optional(),
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().max(2000).nullable().optional(),
  price_coins: z.number().int().min(0).max(1_000_000),
  stock_cap: z.number().int().min(0).max(1_000_000),
  cover_emoji: z.string().trim().max(8).nullable().optional(),
  image_url: z.string().trim().max(2000).nullable().optional(),
  featured: z.boolean().optional(),
  visible: z.boolean().optional(),
});

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => productSchema.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const id =
      data.id ??
      data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80) +
        "-" +
        Math.random().toString(36).slice(2, 6);

    const row = {
      id,
      title: data.title,
      tagline: data.tagline ?? null,
      category: data.category,
      description: data.description ?? null,
      price_coins: data.price_coins,
      stock_cap: data.stock_cap,
      cover_emoji: data.cover_emoji ?? null,
      image_url: data.image_url ?? null,
      featured: data.featured ?? false,
      visible: data.visible ?? true,
    };
    const { error } = await supabaseAdmin.from("games").upsert(row);
    if (error) throw new Error(error.message);
    return { id };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("games").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProductStockCap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ id: z.string().min(1), stock_cap: z.number().int().min(0).max(1_000_000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("games")
      .update({ stock_cap: data.stock_cap })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ STOCK ITEMS ============
export const listGameStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ game_id: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (a: string, b: string) => {
            eq: (a: string, b: string) => {
              order: (c: string, o: { ascending: boolean }) => Promise<{
                data: Array<{ id: string; content: string; created_at: string }> | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    })
      .from("stock_items")
      .select("id, content, created_at")
      .eq("game_id", data.game_id)
      .eq("status", "available")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addStockBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        game_id: z.string().min(1),
        lines: z.array(z.string().trim().min(1).max(2000)).min(1).max(1000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const rows = data.lines
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => ({ game_id: data.game_id, content: l, status: "available" }));
    if (!rows.length) return { inserted: 0 };
    const { error } = await (supabaseAdmin as unknown as {
      from: (t: string) => { insert: (r: unknown) => Promise<{ error: { message: string } | null }> };
    })
      .from("stock_items")
      .insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const deleteStockItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        delete: () => {
          eq: (a: string, b: string) => {
            eq: (a: string, b: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    })
      .from("stock_items")
      .delete()
      .eq("id", data.id)
      .eq("status", "available");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ ORDERS ============
export const listAdminOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("topup_requests")
      .select("id, user_id, amount_usd, coins, status, created_at, reviewed_at, note")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    const { data: profs } = userIds.length
      ? await supabaseAdmin
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds)
      : { data: [] as Array<{ user_id: string; display_name: string }> };
    const nameMap = new Map((profs ?? []).map((p) => [p.user_id, p.display_name]));

    return (rows ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      customer: nameMap.get(r.user_id) ?? "User",
      amount_usd: Number(r.amount_usd ?? 0),
      coins: r.coins ?? 0,
      status: r.status as string,
      method: r.note?.toLowerCase().includes("wallet") ? "Wallet Balance" : "Bakong KHQR",
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
    }));
  });

// ============ WALLETS ============
export const listAdminWallets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profs, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, display_name, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const ids = (profs ?? []).map((p) => p.user_id);
    const { data: wallets } = ids.length
      ? await supabaseAdmin.from("wallets").select("user_id, balance").in("user_id", ids)
      : { data: [] as Array<{ user_id: string; balance: number }> };
    const balMap = new Map((wallets ?? []).map((w) => [w.user_id, w.balance]));

    return (profs ?? []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      balance: balMap.get(p.user_id) ?? 0,
      created_at: p.created_at,
    }));
  });
