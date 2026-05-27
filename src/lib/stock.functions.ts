import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const requireAdmin = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("forbidden");
};

// Public: stock counts per game (anyone can see availability)
export const getStockCounts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("stock_items")
    .select("game_id, status");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  (data ?? []).forEach((r) => {
    if (r.status === "available") counts[r.game_id] = (counts[r.game_id] ?? 0) + 1;
  });
  return { counts };
});

// Buyer: list of delivered items for current user
export const getMyDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("stock_items")
      .select("id, game_id, content, assigned_at")
      .order("assigned_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });

// Admin: list all stock for a game
export const adminListStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ gameId: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("stock_items")
      .select("id, content, status, assigned_to, assigned_at, created_at")
      .eq("game_id", data.gameId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });

// Admin: bulk add stock — one item per non-empty line
export const adminAddStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        gameId: z.string().min(1).max(64),
        contents: z.string().min(1).max(200_000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const lines = data.contents
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return { inserted: 0 };
    const rows = lines.map((content) => ({
      game_id: data.gameId,
      content,
      status: "available",
    }));
    const { error } = await supabaseAdmin.from("stock_items").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

// Admin: delete a stock item
export const adminDeleteStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.from("stock_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
