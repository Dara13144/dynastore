import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export const getGameDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      gameId: z.string().min(1).max(64),
      via: z.enum(["direct", "link"]).optional().default("direct"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: owned } = await supabaseAdmin
      .from("library").select("id").eq("user_id", userId).eq("game_id", data.gameId).eq("kind", "owned").maybeSingle();
    if (!owned) throw new Error("not_owned");

    const { data: game } = await supabaseAdmin
      .from("games").select("id, title, file_path, file_size_bytes").eq("id", data.gameId).maybeSingle();
    if (!game?.file_path) throw new Error("file_unavailable");

    // External http(s) file_path: no signed URL, just open the link.
    let url: string;
    if (/^https?:\/\//i.test(game.file_path)) {
      url = game.file_path;
    } else {
      const { data: signed, error } = await supabaseAdmin.storage
        .from("game-files").createSignedUrl(game.file_path, 60 * 10, { download: `${game.title}.zip` });
      if (error || !signed) throw new Error(error?.message || "sign_failed");
      url = signed.signedUrl;
    }

    // Fire-and-forget audit log row. Do not block the download on a log write.
    try {
      const userAgent = getRequestHeader("user-agent") ?? null;
      const ip = getRequestIP({ xForwardedFor: true }) ?? null;
      await supabaseAdmin.from("download_logs").insert({
        user_id: userId,
        game_id: data.gameId,
        via: data.via,
        url,
        file_path: game.file_path,
        user_agent: userAgent,
        ip,
      });
    } catch (e) {
      console.error("download_logs insert failed", e);
    }

    return { url, sizeBytes: game.file_size_bytes ?? null, filePath: game.file_path };
  });
