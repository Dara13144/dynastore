import { validateGameFileUrl } from "./validate-game-file";

/**
 * Resolve the URL the Download button should open for a given stored
 * `file_path` value. External http(s) links are validated (non-empty,
 * http/https only, allowed file extension) before being returned. In-bucket
 * paths are resolved through a signed URL from Storage.
 *
 * The Storage signer is injected so this is fully testable without the real
 * supabase client.
 */
export type SignedUrlSigner = (
  path: string,
  expiresInSeconds: number,
  options?: { download?: boolean },
) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>;

export type ResolveDownloadResult =
  | { ok: true; url: string; external: boolean }
  | { ok: false; error: string };

export const EXTERNAL_URL_RE = /^https?:\/\//i;

export function isExternalDownload(filePath: string): boolean {
  return EXTERNAL_URL_RE.test(filePath);
}

export async function resolveDownloadUrl(
  filePath: string | null | undefined,
  signer: SignedUrlSigner,
  opts: { expiresInSeconds?: number; forceDownload?: boolean } = {},
): Promise<ResolveDownloadResult> {
  if (!filePath) return { ok: false, error: "មិនទាន់មានឯកសារ" };
  if (isExternalDownload(filePath)) {
    const err = validateGameFileUrl(filePath);
    if (err) return { ok: false, error: err };
    return { ok: true, url: filePath, external: true };
  }
  const { data, error } = await signer(
    filePath,
    opts.expiresInSeconds ?? 300,
    opts.forceDownload ? { download: true } : undefined,
  );
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "មិនអាចបង្កើតតំណទាញយកបាន" };
  }
  return { ok: true, url: data.signedUrl, external: false };
}
