// Bucket file_size_limit caching helpers — mirror the cache contract used by
// the admin page so the limit survives reloads and avoids hitting the server
// on every mount.
import { MAX_GAME_FILE_BYTES } from "./validate-game-file";

export const BUCKET_LIMIT_CACHE_KEY = "admin:game-files:limitBytes";
export const BUCKET_LIMIT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CacheEntry {
  limitBytes: number | null;
  at: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readCachedLimit(
  storage: StorageLike,
  now: number = Date.now(),
): number | null {
  try {
    const raw = storage.getItem(BUCKET_LIMIT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (now - parsed.at > BUCKET_LIMIT_CACHE_TTL_MS) return null;
    return parsed.limitBytes;
  } catch {
    return null;
  }
}

export function writeCachedLimit(
  storage: StorageLike,
  limitBytes: number | null,
  now: number = Date.now(),
): void {
  try {
    storage.setItem(
      BUCKET_LIMIT_CACHE_KEY,
      JSON.stringify({ limitBytes, at: now } satisfies CacheEntry),
    );
  } catch {
    /* quota / disabled storage — caller can refetch on next mount */
  }
}

/**
 * Resolve the bucket file_size_limit, preferring a fresh cache entry over the
 * network. The fetcher is only invoked when the cache is missing or stale.
 * Result is written back to the cache so the next mount is offline-friendly.
 */
export async function loadBucketLimit(
  storage: StorageLike,
  fetcher: () => Promise<{ limitBytes: number | null }>,
  now: number = Date.now(),
): Promise<{ limitBytes: number | null; source: "cache" | "network" }> {
  const cached = readCachedLimit(storage, now);
  if (cached !== null) return { limitBytes: cached, source: "cache" };
  const fresh = await fetcher();
  writeCachedLimit(storage, fresh.limitBytes, now);
  return { limitBytes: fresh.limitBytes, source: "network" };
}

export function effectiveMaxBytesFromCache(
  storage: StorageLike,
  now: number = Date.now(),
): number {
  const cached = readCachedLimit(storage, now);
  return cached && cached > 0 ? Math.min(MAX_GAME_FILE_BYTES, cached) : MAX_GAME_FILE_BYTES;
}
