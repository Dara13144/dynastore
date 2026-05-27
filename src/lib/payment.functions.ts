import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { notifyTelegram, notifyTelegramPhotoFromUrl, formatUserById } from "@/lib/telegram.server";

export const purchaseGame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      gameId: z.string().min(1).max(64),
      qty: z.number().int().min(1).max(50).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const qty = data.qty ?? 1;

    const { data: result, error } = await supabaseAdmin.rpc("purchase_game_atomic_qty", {
      _user_id: userId,
      _game_id: data.gameId,
      _qty: qty,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(result) ? result[0] : result;
    const ok = (row as { ok?: boolean })?.ok ?? false;
    const balance = (row as { new_balance?: number })?.new_balance ?? 0;
    const message = (row as { message?: string })?.message ?? "";
    const contents =
      ((row as { delivered_contents?: string[] | null })?.delivered_contents ?? []) || [];

    // Back-compat: surface first content as `deliveredContent`
    const deliveredContent = contents.length > 0 ? contents.join("\n") : null;

    if (ok && message === "purchased") {
      const [{ data: game }, who] = await Promise.all([
        supabaseAdmin
          .from("games")
          .select("title, price_coins, image_url")
          .eq("id", data.gameId)
          .maybeSingle(),
        formatUserById(userId),
      ]);
      const unit = Number(game?.price_coins ?? 0);
      const total = unit * qty;
      const caption = `🛒 <b>Product Purchased</b>\n👤 ${who}\n📦 ${game?.title ?? data.gameId}\n🔢 Qty: ${qty}\n💰 -$${total.toLocaleString()}\n💼 Balance: $${Number(balance).toLocaleString()}\n✅ Auto-delivered ${contents.length} account(s)`;
      if (game?.image_url) {
        await notifyTelegramPhotoFromUrl(game.image_url, caption, "purchase");
      } else {
        await notifyTelegram(caption, "purchase");
      }
    }

    return { ok, balance, message, deliveredContent, deliveredContents: contents, qty };
  });
