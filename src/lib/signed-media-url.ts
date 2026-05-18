// Helpers for generating signed URLs from either a storage path or an
// existing public/getPublicUrl URL. Used by the admin Copy/Download buttons
// for archive files (private bucket) and preview videos (public bucket
// where we still want a time-limited shareable link).
import { supabase } from "@/integrations/supabase/client";

export const SIGNED_URL_EXPIRES_SEC = 60 * 60; // 1 hour

/**
 * Extract the object path from a Supabase public URL.
 * Returns null if the URL doesn't match the public-object pattern.
 */
export function extractStoragePath(
  urlOrPath: string,
  bucket: string,
): string | null {
  if (!urlOrPath) return null;
  if (!/^https?:\/\//i.test(urlOrPath)) return urlOrPath; // already a path
  const m = urlOrPath.match(
    new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/([^?#]+)`),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

export interface SignedMediaResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export async function createSignedMediaUrl(
  urlOrPath: string,
  bucket: "game-files" | "game-images",
  opts: { download?: boolean } = {},
): Promise<SignedMediaResult> {
  const path = extractStoragePath(urlOrPath, bucket);
  if (!path) {
    return { ok: false, error: "មិនអាចទាញ path ពី URL — តម្លៃនេះមិនមែនជា file ដែលផ្ទុកក្នុង storage" };
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_SEC, {
      download: opts.download ?? false,
    });
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "បរាជ័យក្នុងការបង្កើត signed URL" };
  }
  return { ok: true, url: data.signedUrl };
}
