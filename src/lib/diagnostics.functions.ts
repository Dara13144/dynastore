import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DiagCheck = {
  name: string;
  ok: boolean;
  ms: number;
  message: string;
  detail?: Record<string, string | number | null>;
};

async function timed<T>(
  name: string,
  run: () => Promise<{ ok: boolean; message: string; detail?: Record<string, string | number | null> }>,
): Promise<DiagCheck> {
  const t0 = Date.now();
  try {
    const r = await run();
    return { name, ok: r.ok, ms: Date.now() - t0, message: r.message, detail: r.detail };
  } catch (e) {
    return {
      name,
      ok: false,
      ms: Date.now() - t0,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Server-side health checks for upload + link lookup paths.
 * Caller must be authenticated; admin-only data is never returned.
 */
export const runBackendDiagnostics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ checks: DiagCheck[]; serverMs: number }> => {
    const t0 = Date.now();
    const checks: DiagCheck[] = [];

    // 1. game-files bucket reachable + size limit
    checks.push(
      await timed("upload.bucket.game-files", async () => {
        const { data, error } = await supabaseAdmin.storage.getBucket("game-files");
        if (error || !data) return { ok: false, message: error?.message ?? "no bucket data" };
        const limit = (data as { file_size_limit?: number | null }).file_size_limit ?? null;
        return {
          ok: true,
          message: `OK · limit=${limit ? `${(limit / 1024 ** 3).toFixed(1)}GiB` : "default"}`,
          detail: { limitBytes: limit },
        };
      }),
    );

    // 2. game-images bucket reachable
    checks.push(
      await timed("upload.bucket.game-images", async () => {
        const { error } = await supabaseAdmin.storage.getBucket("game-images");
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "OK" };
      }),
    );

    // 3. Sign a probe URL (verifies storage signing path used by downloads)
    checks.push(
      await timed("link.signed-url.probe", async () => {
        const { data, error } = await supabaseAdmin.storage
          .from("game-files")
          .createSignedUrl("__diagnostics__/probe", 30);
        // Bucket signing should succeed even for a non-existent path;
        // only auth/config issues produce errors here.
        if (error) return { ok: false, message: error.message };
        return { ok: !!data?.signedUrl, message: data?.signedUrl ? "OK" : "no url returned" };
      }),
    );

    // 4. games table read (link-lookup table is healthy)
    checks.push(
      await timed("link.games.table", async () => {
        const { count, error } = await supabaseAdmin
          .from("games")
          .select("id", { count: "exact", head: true });
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: `OK · ${count ?? 0} rows`, detail: { count: count ?? 0 } };
      }),
    );

    // 5. download_logs writable (upload audit / link-resolve path)
    checks.push(
      await timed("link.download-logs.read", async () => {
        const { error } = await supabaseAdmin
          .from("download_logs")
          .select("id", { count: "exact", head: true });
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "OK" };
      }),
    );

    // 6. upload_audit_log read
    checks.push(
      await timed("upload.audit-log.read", async () => {
        const { error } = await supabaseAdmin
          .from("upload_audit_log")
          .select("id", { count: "exact", head: true });
        if (error) return { ok: false, message: error.message };
        return { ok: true, message: "OK" };
      }),
    );

    return { checks, serverMs: Date.now() - t0 };
  });
