import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getStockCounts = createServerFn({ method: "GET" })
  .inputValidator((i) =>
    z.object({ gameIds: z.array(z.string().min(1).max(64)).max(500).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    let query = supabaseAdmin
      .from("stock_items")
      .select("game_id")
      .eq("status", "available");
    if (data.gameIds && data.gameIds.length) {
      query = query.in("game_id", data.gameIds);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const r of rows ?? []) {
      const gid = (r as { game_id: string }).game_id;
      counts[gid] = (counts[gid] ?? 0) + 1;
    }
    return { counts };
  });
