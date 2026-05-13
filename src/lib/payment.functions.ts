import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const purchaseGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ gameId: z.string().min(1).max(64) }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: result, error } = await supabaseAdmin.rpc("purchase_game_atomic", {
      _user_id: userId, _game_id: data.gameId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    return { ok: row?.ok ?? false, balance: row?.new_balance ?? 0, message: row?.message ?? "" };
  });
