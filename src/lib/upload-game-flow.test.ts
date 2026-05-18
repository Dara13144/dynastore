import { describe, it, expect, vi } from "vitest";
import { runUploadFlow, effectiveMaxBytes, type UploadStage } from "./upload-game-flow";

// Build a fake File without buffering real bytes — we only ever read `.size`,
// `.name`, and `.type` in the flow under test.
function fakeFile(name: string, sizeBytes: number, type = "application/zip"): File {
  const f = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(f, "size", { value: sizeBytes, configurable: true });
  return f;
}

/**
 * Simulated TUS uploader: emits N progress ticks then resolves with no error,
 * exactly as tus-js-client's onProgress + onSuccess would.
 */
function simulatedTusUploader(opts: { ticks?: number; failAt?: number } = {}) {
  const { ticks = 5, failAt } = opts;
  return vi.fn(
    async (
      _path: string,
      file: File,
      cbs: { onProgress: (sent: number, total: number) => void },
    ) => {
      for (let i = 1; i <= ticks; i++) {
        const sent = Math.floor((file.size * i) / ticks);
        cbs.onProgress(sent, file.size);
        if (failAt === i) {
          return { error: new Error("tus: connection lost") };
        }
      }
      return { error: null };
    },
  );
}

const directUploader = vi.fn(async () => ({ error: null }));

describe("runUploadFlow — TUS upload near bucket limit", () => {
  it("transitions preparing → uploading → processing → done for a near-limit file", async () => {
    // Bucket limit: 1 GB. File: 999 MB (just under the limit).
    const bucketLimitBytes = 1024 * 1024 * 1024;
    const file = fakeFile("big-game.zip", 999 * 1024 * 1024);

    const stages: UploadStage[] = [];
    const progress: number[] = [];
    const resumable = simulatedTusUploader({ ticks: 4 });
    const submit = vi.fn(async () => {
      // Simulate a small DB-insert latency so "processing" is observable.
      await new Promise((r) => setTimeout(r, 5));
    });

    const result = await runUploadFlow({
      gameId: "g_near_limit",
      file,
      bucketLimitBytes,
      uploader: { direct: directUploader, resumable },
      submit,
      onStage: (s) => stages.push(s),
      onProgress: (p) => progress.push(Math.round(p.pct)),
    });

    expect(result.ok).toBe(true);
    expect(result.stage).toBe("done");
    expect(result.path).toMatch(/^g_near_limit\/\d+_big-game\.zip$/);

    // Stage machine ran in the exact documented order.
    expect(stages).toEqual(["preparing", "uploading", "processing", "done"]);

    // Resumable (TUS) path was used — direct uploader was NOT.
    expect(resumable).toHaveBeenCalledTimes(1);
    expect(directUploader).not.toHaveBeenCalled();

    // submit() was invoked with the uploaded path and exact byte size.
    expect(submit).toHaveBeenCalledWith({
      gameId: "g_near_limit",
      path: result.path,
      size: file.size,
    });

    // Progress climbed monotonically and ended at 100%.
    expect(progress[0]).toBe(0);
    expect(progress[progress.length - 1]).toBe(100);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
    }
  });

  it("blocks BEFORE TUS starts when the file exceeds the live bucket limit", async () => {
    const bucketLimitBytes = 100 * 1024 * 1024; // 100 MB cap
    const file = fakeFile("too-big.zip", 500 * 1024 * 1024); // 500 MB

    const stages: UploadStage[] = [];
    const resumable = simulatedTusUploader();

    const result = await runUploadFlow({
      gameId: "g_over",
      file,
      bucketLimitBytes,
      uploader: { direct: directUploader, resumable },
      submit: vi.fn(),
      onStage: (s) => stages.push(s),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("error");
    expect(result.error).toContain("ដែនកំណត់");
    expect(stages).toEqual(["error"]);
    expect(resumable).not.toHaveBeenCalled();
  });

  it("ends in error stage if TUS fails mid-upload (no processing transition)", async () => {
    const bucketLimitBytes = 1024 * 1024 * 1024;
    const file = fakeFile("flaky.zip", 800 * 1024 * 1024);

    const stages: UploadStage[] = [];
    const resumable = simulatedTusUploader({ ticks: 5, failAt: 3 });
    const submit = vi.fn();

    const result = await runUploadFlow({
      gameId: "g_flaky",
      file,
      bucketLimitBytes,
      uploader: { direct: vi.fn(), resumable },
      submit,
      onStage: (s) => stages.push(s),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("error");
    expect(result.error).toContain("connection lost");
    expect(stages).toEqual(["preparing", "uploading", "error"]);
    expect(submit).not.toHaveBeenCalled();
  });

  it("rolls back to error stage when submit() throws during processing", async () => {
    const bucketLimitBytes = 1024 * 1024 * 1024;
    const file = fakeFile("ok.zip", 500 * 1024 * 1024);

    const stages: UploadStage[] = [];
    const resumable = simulatedTusUploader();
    const submit = vi.fn(async () => {
      throw new Error("DB insert failed: unique_violation");
    });

    const result = await runUploadFlow({
      gameId: "g_db_fail",
      file,
      bucketLimitBytes,
      uploader: { direct: vi.fn(), resumable },
      submit,
      onStage: (s) => stages.push(s),
    });

    expect(result.ok).toBe(false);
    expect(result.stage).toBe("error");
    expect(result.error).toContain("unique_violation");
    expect(stages).toEqual(["preparing", "uploading", "processing", "error"]);
  });

  it("uses the direct (non-TUS) uploader for files at/under the 1MB threshold", async () => {
    const file = fakeFile("tiny.zip", 1 * 1024 * 1024);
    const direct = vi.fn(async () => ({ error: null }));
    const resumable = simulatedTusUploader();

    const result = await runUploadFlow({
      gameId: "g_small",
      file,
      bucketLimitBytes: 1024 * 1024 * 1024,
      uploader: { direct, resumable },
      submit: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(direct).toHaveBeenCalledTimes(1);
    expect(resumable).not.toHaveBeenCalled();
  });

  it("uses the TUS resumable uploader for files just over the 1MB threshold", async () => {
    const file = fakeFile("medium.zip", 1.5 * 1024 * 1024);
    const direct = vi.fn(async () => ({ error: null }));
    const resumable = simulatedTusUploader();

    const result = await runUploadFlow({
      gameId: "g_med",
      file,
      bucketLimitBytes: 1024 * 1024 * 1024,
      uploader: { direct, resumable },
      submit: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(direct).not.toHaveBeenCalled();
    expect(resumable).toHaveBeenCalledTimes(1);
  });

  it("effectiveMaxBytes clamps to the smaller of bucket limit and static MAX", () => {
    expect(effectiveMaxBytes(null)).toBeGreaterThan(0);
    expect(effectiveMaxBytes(0)).toBeGreaterThan(0);
    expect(effectiveMaxBytes(5 * 1024 * 1024 * 1024)).toBe(5 * 1024 * 1024 * 1024);
  });
});
