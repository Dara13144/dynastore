import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadBucketLimit,
  readCachedLimit,
  writeCachedLimit,
  effectiveMaxBytesFromCache,
  BUCKET_LIMIT_CACHE_KEY,
  BUCKET_LIMIT_CACHE_TTL_MS,
  type StorageLike,
} from "./bucket-limit-cache";
import { runUploadFlow, type UploadStage } from "./upload-game-flow";

function memoryStorage(): StorageLike & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

function fakeFile(name: string, sizeBytes: number): File {
  const f = new File([new Uint8Array(0)], name, { type: "application/zip" });
  Object.defineProperty(f, "size", { value: sizeBytes, configurable: true });
  return f;
}

describe("bucket-limit-cache integration with upload flow", () => {
  let storage: ReturnType<typeof memoryStorage>;
  const ONE_GB = 1024 * 1024 * 1024;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("first run: cache miss → calls fetcher and persists the limit", async () => {
    const fetcher = vi.fn(async () => ({ limitBytes: 5 * ONE_GB }));

    const result = await loadBucketLimit(storage, fetcher);

    expect(result).toEqual({ limitBytes: 5 * ONE_GB, source: "network" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(storage.getItem(BUCKET_LIMIT_CACHE_KEY)!);
    expect(persisted.limitBytes).toBe(5 * ONE_GB);
    expect(typeof persisted.at).toBe("number");
  });

  it("second run: cache hit → fetcher is NOT called and cached value is used", async () => {
    const fetcher = vi.fn(async () => ({ limitBytes: 5 * ONE_GB }));

    // First run populates the cache.
    await loadBucketLimit(storage, fetcher);
    fetcher.mockClear();

    // Second run within TTL should be a pure cache hit.
    const second = await loadBucketLimit(storage, fetcher);

    expect(second).toEqual({ limitBytes: 5 * ONE_GB, source: "cache" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("expired cache: refetches after TTL", async () => {
    const fetcher = vi.fn(async () => ({ limitBytes: 2 * ONE_GB }));
    const t0 = 1_000_000;

    await loadBucketLimit(storage, fetcher, t0);
    fetcher.mockClear();

    const later = t0 + BUCKET_LIMIT_CACHE_TTL_MS + 1;
    const result = await loadBucketLimit(storage, fetcher, later);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.source).toBe("network");
  });

  it("corrupt cache entry is ignored, fetcher runs", async () => {
    storage.setItem(BUCKET_LIMIT_CACHE_KEY, "{not json");
    const fetcher = vi.fn(async () => ({ limitBytes: ONE_GB }));

    const result = await loadBucketLimit(storage, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ limitBytes: ONE_GB, source: "network" });
  });

  it("upload uses cached effective limit on the SECOND run — fetcher never re-fires", async () => {
    // --- Run 1: live fetch caches a 1 GB bucket limit ---
    const fetcher = vi.fn(async () => ({ limitBytes: ONE_GB }));
    const first = await loadBucketLimit(storage, fetcher);
    expect(first.source).toBe("network");

    // --- Run 2: simulate a fresh page mount — only read from cache ---
    const fetcher2 = vi.fn(async () => {
      throw new Error("network should not be hit on second mount");
    });
    const second = await loadBucketLimit(storage, fetcher2);
    expect(second.source).toBe("cache");
    expect(second.limitBytes).toBe(ONE_GB);
    expect(fetcher2).not.toHaveBeenCalled();

    const cachedLimit = effectiveMaxBytesFromCache(storage);
    expect(cachedLimit).toBe(ONE_GB);

    // 800 MB file: under the cached 1 GB limit — upload proceeds end-to-end.
    {
      const stages: UploadStage[] = [];
      const resumable = vi.fn(async () => ({ error: null }));
      const submit = vi.fn(async () => {});
      const result = await runUploadFlow({
        gameId: "g_ok",
        file: fakeFile("ok.zip", 800 * 1024 * 1024),
        bucketLimitBytes: cachedLimit,
        uploader: { direct: vi.fn(), resumable },
        submit,
        onStage: (s) => stages.push(s),
      });
      expect(result.ok).toBe(true);
      expect(stages).toEqual(["preparing", "uploading", "processing", "done"]);
      expect(resumable).toHaveBeenCalledTimes(1);
      expect(submit).toHaveBeenCalledTimes(1);
    }

    // 2 GB file: exceeds the cached 1 GB limit — blocked BEFORE TUS starts.
    {
      const stages: UploadStage[] = [];
      const resumable = vi.fn(async () => ({ error: null }));
      const submit = vi.fn();
      const result = await runUploadFlow({
        gameId: "g_too_big",
        file: fakeFile("huge.zip", 2 * ONE_GB),
        bucketLimitBytes: cachedLimit,
        uploader: { direct: vi.fn(), resumable },
        submit,
        onStage: (s) => stages.push(s),
      });
      expect(result.ok).toBe(false);
      expect(result.stage).toBe("error");
      expect(stages).toEqual(["error"]);
      expect(resumable).not.toHaveBeenCalled();
      expect(submit).not.toHaveBeenCalled();
    }

    // Confirm the cache was never re-fetched during either upload.
    expect(fetcher2).not.toHaveBeenCalled();
  });

  it("writeCachedLimit + readCachedLimit roundtrip preserves null (unlimited bucket)", () => {
    writeCachedLimit(storage, null);
    expect(readCachedLimit(storage)).toBeNull();
    // Unlimited bucket → effective max equals static MAX.
    expect(effectiveMaxBytesFromCache(storage)).toBeGreaterThan(0);
  });
});
