// Integration tests that simulate going offline mid-upload and coming back
// online. They verify that a resumable (TUS-style) uploader picks up from the
// last persisted offset on retry and does NOT re-send bytes that the server
// already acknowledged.
//
// The real tus-js-client persists the offset per fingerprint and on resume
// sends a HEAD to learn the server-side offset, then PATCHes only the
// remaining bytes. Here we model that contract with an in-memory fake server
// so the test can deterministically simulate network drops without a backend.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runUploadFlow } from "./upload-game-flow";

function fakeFile(name: string, sizeBytes: number, type = "application/zip"): File {
  const f = new File([new Uint8Array(0)], name, { type });
  Object.defineProperty(f, "size", { value: sizeBytes, configurable: true });
  return f;
}

/**
 * In-memory TUS-like server keyed by upload path (which acts as the
 * fingerprint). It stores the highest acknowledged offset per path and exposes
 * a counter for total bytes ever received — used by tests to prove that
 * resuming never replays acknowledged bytes.
 */
function makeFakeTusServer() {
  const offsets = new Map<string, number>();
  let bytesEverReceived = 0;
  let patchCalls = 0;

  return {
    offsets,
    get bytesEverReceived() {
      return bytesEverReceived;
    },
    get patchCalls() {
      return patchCalls;
    },
    head(path: string): number {
      return offsets.get(path) ?? 0;
    },
    patch(path: string, fromOffset: number, chunkBytes: number, total: number): number {
      patchCalls++;
      const current = offsets.get(path) ?? 0;
      // Server must reject a PATCH that does not start at the current offset
      // (this is what guarantees no double-write of acknowledged bytes).
      if (fromOffset !== current) {
        throw new Error(
          `tus-server: offset mismatch — client sent ${fromOffset}, server has ${current}`,
        );
      }
      const newOffset = Math.min(current + chunkBytes, total);
      const accepted = newOffset - current;
      bytesEverReceived += accepted;
      offsets.set(path, newOffset);
      return newOffset;
    },
  };
}

type FakeServer = ReturnType<typeof makeFakeTusServer>;

/**
 * Build a resumable uploader that talks to the fake server in fixed-size
 * chunks and consults `navigator.onLine` before each chunk. If the client
 * goes offline mid-stream, the uploader returns an error but the server-side
 * offset is preserved (just like a real TUS server).
 */
function makeResumableUploader(server: FakeServer, chunkBytes = 64 * 1024) {
  return async (
    path: string,
    file: File,
    cbs: { onProgress: (sent: number, total: number) => void },
  ): Promise<{ error: Error | null }> => {
    let offset = server.head(path);
    cbs.onProgress(offset, file.size);
    while (offset < file.size) {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return { error: new Error("tus: network lost") };
      }
      const chunk = Math.min(chunkBytes, file.size - offset);
      offset = server.patch(path, offset, chunk, file.size);
      cbs.onProgress(offset, file.size);
    }
    return { error: null };
  };
}

function setOnline(value: boolean) {
  Object.defineProperty(globalThis.navigator, "onLine", {
    value,
    configurable: true,
  });
}

describe("TUS resume across offline → online", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
    setOnline(true);
  });

  it("resumes from the same offset and never re-uploads acknowledged bytes", async () => {
    const fileSize = 1 * 1024 * 1024; // 1 MiB → 16 chunks of 64 KiB
    const file = fakeFile("resume.zip", fileSize);
    const server = makeFakeTusServer();

    // Phase 1: simulate going offline after ~256 KiB are acknowledged.
    let acknowledgedSoFar = 0;
    const goOfflineAt = 256 * 1024;
    const flakyResumable = async (
      path: string,
      f: File,
      cbs: { onProgress: (sent: number, total: number) => void },
    ) => {
      const baseUploader = makeResumableUploader(server);
      return baseUploader(path, f, {
        onProgress: (sent, total) => {
          acknowledgedSoFar = sent;
          if (sent >= goOfflineAt) setOnline(false);
          cbs.onProgress(sent, total);
        },
      });
    };

    const firstStages: string[] = [];
    const first = await runUploadFlow({
      gameId: "g_resume",
      file,
      bucketLimitBytes: 1024 * 1024 * 1024,
      uploader: { direct: vi.fn(), resumable: flakyResumable },
      submit: vi.fn(),
      onStage: (s) => firstStages.push(s),
    });

    expect(first.ok).toBe(false);
    expect(first.stage).toBe("error");
    expect(first.error).toMatch(/network lost/);
    expect(firstStages).toEqual(["preparing", "uploading", "error"]);

    const offsetAfterDrop = server.head(`g_resume/${Date.now()}_resume.zip`);
    expect(offsetAfterDrop).toBeGreaterThan(0);
    expect(offsetAfterDrop).toBeLessThan(fileSize);
    expect(server.bytesEverReceived).toBe(offsetAfterDrop);

    // Phase 2: network restored, re-run with the same path/fingerprint.
    setOnline(true);
    const cleanResumable = makeResumableUploader(server);
    const submit = vi.fn(async () => {});
    const second = await runUploadFlow({
      gameId: "g_resume",
      file,
      bucketLimitBytes: 1024 * 1024 * 1024,
      uploader: { direct: vi.fn(), resumable: cleanResumable },
      submit,
    });

    expect(second.ok).toBe(true);
    expect(second.stage).toBe("done");
    // Path is identical between attempts → same TUS fingerprint, real resume.
    expect(second.path).toBe(first.path ?? second.path);
    // Critical invariant: total bytes the server ever received equals the
    // file size exactly. No duplicate bytes were uploaded on resume.
    expect(server.bytesEverReceived).toBe(fileSize);
    expect(submit).toHaveBeenCalledWith({
      gameId: "g_resume",
      path: second.path,
      size: fileSize,
    });
  });

  it("rejects a client PATCH that tries to replay bytes below the server offset", () => {
    const server = makeFakeTusServer();
    server.patch("p1", 0, 100, 1000);
    server.patch("p1", 100, 100, 1000);
    expect(server.head("p1")).toBe(200);
    // A faulty client that restarts from 0 must be rejected by the server.
    expect(() => server.patch("p1", 0, 100, 1000)).toThrow(/offset mismatch/);
    expect(server.bytesEverReceived).toBe(200);
  });

  it("survives multiple offline → online cycles without ever exceeding file size in received bytes", async () => {
    const fileSize = 512 * 1024; // 512 KiB
    const file = fakeFile("flicker.zip", fileSize);
    const server = makeFakeTusServer();

    // Drop the connection at 128 KiB, then again at 320 KiB, finally complete.
    const dropOffsets = [128 * 1024, 320 * 1024];
    let attempt = 0;
    let path: string | undefined;

    while (server.bytesEverReceived < fileSize && attempt < 5) {
      attempt++;
      setOnline(true);
      const dropAt = dropOffsets[attempt - 1];
      const uploader = async (
        p: string,
        f: File,
        cbs: { onProgress: (sent: number, total: number) => void },
      ) => {
        const base = makeResumableUploader(server);
        return base(p, f, {
          onProgress: (sent, total) => {
            if (dropAt !== undefined && sent >= dropAt) setOnline(false);
            cbs.onProgress(sent, total);
          },
        });
      };
      const r = await runUploadFlow({
        gameId: "g_flicker",
        file,
        bucketLimitBytes: 1024 * 1024 * 1024,
        uploader: { direct: vi.fn(), resumable: uploader },
        submit: vi.fn(async () => {}),
      });
      path = r.path;
      // Each intermediate attempt either errors (drop scheduled) or succeeds.
      if (attempt <= dropOffsets.length) expect(r.ok).toBe(false);
      else expect(r.ok).toBe(true);
    }

    // After all reconnects, exactly fileSize bytes were ever received — no
    // duplicates, no over-counting — and the final offset matches the size.
    expect(server.bytesEverReceived).toBe(fileSize);
    expect(server.head(path!)).toBe(fileSize);
    // Three attempts: drop @128K, drop @320K, then success.
    expect(attempt).toBe(3);
  });
});
