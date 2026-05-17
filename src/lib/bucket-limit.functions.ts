import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Read the `game-files` bucket's configured `file_size_limit` (bytes).
 * Returns `null` if the bucket has no explicit limit (unlimited / server default).
 */
export const getGameFilesBucketLimit = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ limitBytes: number | null }> => {
    const { data, error } = await supabaseAdmin.storage.getBucket("game-files");
    if (error || !data) {
      // Don't hard-fail the admin page if storage is unreachable; let the
      // client fall back to its static MAX and surface real errors at upload time.
      return { limitBytes: null };
    }
    const raw = (data as { file_size_limit?: number | null }).file_size_limit;
    return { limitBytes: typeof raw === "number" && raw > 0 ? raw : null };
  },
);
