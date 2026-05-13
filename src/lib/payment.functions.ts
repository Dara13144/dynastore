import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyTelegram, formatUserById } from "@/lib/telegram.server";

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
    const ok = row?.ok ?? false;
    const balance = row?.new_balance ?? 0;
    const message = row?.message ?? "";

    if (ok && message === "purchased") {
      const [{ data: game }, who] = await Promise.all([
        supabaseAdmin.from("games").select("title, price_coins").eq("id", data.gameId).maybeSingle(),
        formatUserById(userId),
      ]);
      await notifyTelegram(
        `🎮 <b>Game Purchased</b>\n👤 ${who}\n🕹️ ${game?.title ?? data.gameId}\n💰 -${Number(game?.price_coins ?? 0).toLocaleString()} coins\n💼 Balance: ${Number(balance).toLocaleString()}`,
      );
    }

    return { ok, balance, message };
  });
