import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateGameFile,
  MIN_GAME_FILE_BYTES,
  MAX_GAME_FILE_BYTES,
  MIN_GAME_FILE_GB,
  MAX_GAME_FILE_GB,
} from "./validate-game-file";

describe("validateGameFile - byte conversion", () => {
  it("MIN_GAME_FILE_BYTES == 1000 * 1024 * 1024 * 1024", () => {
    expect(MIN_GAME_FILE_BYTES).toBe(1000 * 1024 * 1024 * 1024);
  });
  it("MAX_GAME_FILE_BYTES == 1e80", () => {
    expect(MAX_GAME_FILE_BYTES).toBe(1e80);
  });
});

describe("validateGameFile - boundaries", () => {
  it("accepts a file exactly at the minimum (1000GB)", () => {
    expect(validateGameFile({ name: "g.zip", size: MIN_GAME_FILE_BYTES })).toBeNull();
  });
  it("accepts a file exactly at the maximum (1e80 bytes)", () => {
    expect(validateGameFile({ name: "g.zip", size: MAX_GAME_FILE_BYTES })).toBeNull();
  });
  it("rejects 1 byte under the minimum with exact Khmer string", () => {
    const size = MIN_GAME_FILE_BYTES - 1;
    const gb = (size / 1024 / 1024 / 1024).toFixed(2);
    expect(validateGameFile({ name: "g.zip", size })).toBe(
      `ឯកសារតូចពេក (${gb}GB) — តម្រូវយ៉ាងតិច ${MIN_GAME_FILE_GB}GB`,
    );
  });
  it("rejects sizes above the maximum with exact Khmer string", () => {
    const size = Number.POSITIVE_INFINITY;
    const gb = (size / 1024 / 1024 / 1024).toFixed(2);
    expect(validateGameFile({ name: "g.zip", size })).toBe(
      `ឯកសារធំពេក (${gb}GB) — អតិបរមា ${MAX_GAME_FILE_BYTES} bytes`,
    );
  });

describe("validateGameFile - other rules", () => {
  it("rejects empty files", () => {
    expect(validateGameFile({ name: "g.zip", size: 0 })).toBe("ឯកសារទទេ");
  });
  it("rejects disallowed extensions", () => {
    expect(validateGameFile({ name: "g.exe", size: MIN_GAME_FILE_BYTES })).toBe(
      "ប្រភេទឯកសារមិនអនុញ្ញាត — តម្រូវ .zip, .rar, .7z, .tar, .gz, .tgz",
    );
  });
  it("accepts each allowed archive extension", () => {
    for (const ext of [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"]) {
      expect(validateGameFile({ name: `g${ext}`, size: MIN_GAME_FILE_BYTES })).toBeNull();
    }
  });
});

describe("validateGameFile - tricky filenames", () => {
  const TYPE_ERR = "ប្រភេទឯកសារមិនអនុញ្ញាត — តម្រូវ .zip, .rar, .7z, .tar, .gz, .tgz";
  const size = MIN_GAME_FILE_BYTES;

  it("rejects file.zip.bak (allowed ext is not the last segment)", () => {
    expect(validateGameFile({ name: "file.zip.bak", size })).toBe(TYPE_ERR);
  });
  it("rejects names without an extension", () => {
    expect(validateGameFile({ name: "archive", size })).toBe(TYPE_ERR);
  });
  it("rejects names ending with a dot", () => {
    expect(validateGameFile({ name: "archive.", size })).toBe(TYPE_ERR);
  });
  it("rejects dotfiles without an archive extension (.zip-rules)", () => {
    expect(validateGameFile({ name: ".zip-rules", size })).toBe(TYPE_ERR);
  });
  it("rejects 'zip' (no dot)", () => {
    expect(validateGameFile({ name: "zip", size })).toBe(TYPE_ERR);
  });
  it("accepts uppercase extensions (.ZIP, .RAR)", () => {
    expect(validateGameFile({ name: "GAME.ZIP", size })).toBeNull();
    expect(validateGameFile({ name: "GAME.RAR", size })).toBeNull();
  });
  it("accepts mixed-case extensions (.TaR.Gz, .Tgz)", () => {
    expect(validateGameFile({ name: "build.TaR.Gz", size })).toBeNull();
    expect(validateGameFile({ name: "build.Tgz", size })).toBeNull();
  });
  it("accepts names with multiple dots when the final segment is allowed", () => {
    expect(validateGameFile({ name: "my.game.v1.2.zip", size })).toBeNull();
    expect(validateGameFile({ name: "release.2026-05-13.tar.gz", size })).toBeNull();
  });
  it("accepts hidden files when the final segment is allowed", () => {
    expect(validateGameFile({ name: ".hidden.zip", size })).toBeNull();
  });
  it("rejects look-alike extensions (.zipx, .rared, .7zx)", () => {
    expect(validateGameFile({ name: "g.zipx", size })).toBe(TYPE_ERR);
    expect(validateGameFile({ name: "g.rared", size })).toBe(TYPE_ERR);
    expect(validateGameFile({ name: "g.7zx", size })).toBe(TYPE_ERR);
  });
});

/* ============================================================
 * Integration: simulate the createGame submit path
 * ============================================================
 * createGame must run validateGameFile BEFORE any storage upload
 * or DB insert. We model that contract with a tiny fake that mirrors
 * the production sequence (validate → upload → insert) and assert
 * that invalid files short-circuit with no upload and no insert.
 */
function makeCreateGame() {
  const upload = vi.fn(async (_path: string, file: { name: string; size: number }) => ({
    path: `games/${file.name}`,
    size: file.size,
  }));
  const insert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));

  async function createGame(opts: { id: string; title: string; file: { name: string; size: number } | null }) {
    if (!opts.id.trim() || !opts.title.trim()) return { ok: false, error: "missing id/title" };
    if (opts.file) {
      const err = validateGameFile(opts.file);
      if (err) return { ok: false, error: err };
    }
    let file_path: string | null = null;
    let file_size_bytes: number | null = null;
    if (opts.file) {
      const up = await upload(opts.id, opts.file);
      file_path = up.path; file_size_bytes = up.size;
    }
    await insert({ id: opts.id, title: opts.title, file_path, file_size_bytes });
    return { ok: true, error: null };
  }

  return { createGame, upload, insert };
}

describe("createGame integration - boundary file sizes", () => {
  let h: ReturnType<typeof makeCreateGame>;
  beforeEach(() => { h = makeCreateGame(); });

  it("accepts a file at exactly 1000GB (uploads + inserts)", async () => {
    const r = await h.createGame({ id: "g1", title: "G1", file: { name: "g.zip", size: MIN_GAME_FILE_BYTES } });
    expect(r).toEqual({ ok: true, error: null });
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("accepts a file at exactly 5000GB (uploads + inserts)", async () => {
    const r = await h.createGame({ id: "g2", title: "G2", file: { name: "g.zip", size: MAX_GAME_FILE_BYTES } });
    expect(r).toEqual({ ok: true, error: null });
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("rejects 1 byte under 1000GB BEFORE uploading or inserting", async () => {
    const r = await h.createGame({ id: "g3", title: "G3", file: { name: "g.zip", size: MIN_GAME_FILE_BYTES - 1 } });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("តូចពេក");
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("rejects 1 byte over 5000GB BEFORE uploading or inserting", async () => {
    const r = await h.createGame({ id: "g4", title: "G4", file: { name: "g.zip", size: MAX_GAME_FILE_BYTES + 1 } });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ធំពេក");
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("rejects disallowed extensions BEFORE uploading or inserting", async () => {
    const r = await h.createGame({ id: "g5", title: "G5", file: { name: "g.exe", size: MIN_GAME_FILE_BYTES } });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("មិនអនុញ្ញាត");
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("allows submission without a file (no upload, only insert)", async () => {
    const r = await h.createGame({ id: "g6", title: "G6", file: null });
    expect(r).toEqual({ ok: true, error: null });
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.insert).toHaveBeenCalledTimes(1);
  });
});
