import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateGameFile,
  validateGameFileUrl,
  GAME_FILE_URL_ERRORS,
  MIN_GAME_FILE_BYTES,
  MAX_GAME_FILE_BYTES,
  MIN_GAME_FILE_MB,
  MAX_GAME_FILE_GB,
} from "./validate-game-file";

describe("validateGameFile - byte conversion", () => {
  it("MIN_GAME_FILE_BYTES == 1 * 1024 * 1024 (1MB)", () => {
    expect(MIN_GAME_FILE_BYTES).toBe(1 * 1024 * 1024);
  });
  it("MAX_GAME_FILE_BYTES == 1000 * 1024 * 1024 * 1024 (1000GB)", () => {
    expect(MAX_GAME_FILE_BYTES).toBe(1000 * 1024 * 1024 * 1024);
  });
});

describe("validateGameFile - boundaries", () => {
  it("accepts a file exactly at the minimum (1 MiB)", () => {
    expect(validateGameFile({ name: "g.zip", size: MIN_GAME_FILE_BYTES })).toBeNull();
  });
  it("accepts a file exactly at the maximum (1000 GiB)", () => {
    expect(validateGameFile({ name: "g.zip", size: MAX_GAME_FILE_BYTES })).toBeNull();
  });
  it("rejects 1 byte under the minimum with detailed MiB/GiB range", () => {
    const size = MIN_GAME_FILE_BYTES - 1;
    const msg = validateGameFile({ name: "g.zip", size })!;
    expect(msg).toContain("តូចពេក");
    expect(msg).toContain(`${size.toLocaleString("en-US")} bytes`);
    expect(msg).toContain(`${MIN_GAME_FILE_MB} MiB`);
    expect(msg).toContain(`${MIN_GAME_FILE_BYTES.toLocaleString("en-US")} bytes`);
    expect(msg).toContain(`${MAX_GAME_FILE_GB} GiB`);
  });
  it("rejects 1 byte over the maximum with detailed MiB/GiB range", () => {
    const size = MAX_GAME_FILE_BYTES + 1;
    const msg = validateGameFile({ name: "g.zip", size })!;
    expect(msg).toContain("ធំពេក");
    expect(msg).toContain(`${size.toLocaleString("en-US")} bytes`);
    expect(msg).toContain(`${MAX_GAME_FILE_GB} GiB`);
    expect(msg).toContain(`${MAX_GAME_FILE_BYTES.toLocaleString("en-US")} bytes`);
    expect(msg).toContain("បំបែកជា parts");
  });
  it("rejects very large sizes mentioning the GiB ceiling", () => {
    const size = MAX_GAME_FILE_BYTES * 2;
    const msg = validateGameFile({ name: "g.zip", size })!;
    expect(msg).toContain("ធំពេក");
    expect(msg).toContain(`${MAX_GAME_FILE_GB} GiB`);
  });
  it("over-max error mentions binary GiB limit, not decimal GB", () => {
    const msg = validateGameFile({ name: "g.zip", size: MAX_GAME_FILE_BYTES + 1 })!;
    expect(msg).toContain("ធំពេក");
    expect(msg).toContain(`${MAX_GAME_FILE_GB} GiB`);
    expect(msg).not.toMatch(/\b\d+GB\b/); // old decimal-looking format removed
  });
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

  async function createGame(opts: {
    id: string;
    title: string;
    file: { name: string; size: number } | null;
  }) {
    if (!opts.id.trim() || !opts.title.trim()) return { ok: false, error: "missing id/title" };
    if (opts.file) {
      const err = validateGameFile(opts.file);
      if (err) return { ok: false, error: err };
    }
    let file_path: string | null = null;
    let file_size_bytes: number | null = null;
    if (opts.file) {
      const up = await upload(opts.id, opts.file);
      file_path = up.path;
      file_size_bytes = up.size;
    }
    await insert({ id: opts.id, title: opts.title, file_path, file_size_bytes });
    return { ok: true, error: null };
  }

  return { createGame, upload, insert };
}

describe("createGame integration - boundary file sizes", () => {
  let h: ReturnType<typeof makeCreateGame>;
  beforeEach(() => {
    h = makeCreateGame();
  });

  it("accepts a file at exactly 1MB (uploads + inserts)", async () => {
    const r = await h.createGame({
      id: "g1",
      title: "G1",
      file: { name: "g.zip", size: MIN_GAME_FILE_BYTES },
    });
    expect(r).toEqual({ ok: true, error: null });
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("accepts a file at exactly the maximum (1000GB) (uploads + inserts)", async () => {
    const r = await h.createGame({
      id: "g2",
      title: "G2",
      file: { name: "g.zip", size: MAX_GAME_FILE_BYTES },
    });
    expect(r).toEqual({ ok: true, error: null });
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it("rejects 1 byte under 1MB BEFORE uploading or inserting", async () => {
    const r = await h.createGame({
      id: "g3",
      title: "G3",
      file: { name: "g.zip", size: MIN_GAME_FILE_BYTES - 1 },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("តូចពេក");
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("rejects sizes above the maximum BEFORE uploading or inserting", async () => {
    const r = await h.createGame({
      id: "g4",
      title: "G4",
      file: { name: "g.zip", size: Number.POSITIVE_INFINITY },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ធំពេក");
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("rejects disallowed extensions BEFORE uploading or inserting", async () => {
    const r = await h.createGame({
      id: "g5",
      title: "G5",
      file: { name: "g.exe", size: MIN_GAME_FILE_BYTES },
    });
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

describe("validateGameFileUrl - exact error messages", () => {
  // Imported inline to avoid touching the existing import block.
  // (validateGameFileUrl + GAME_FILE_URL_ERRORS imported at top)

  it("returns null for a valid https zip URL", () => {
    expect(validateGameFileUrl("https://cdn.example.com/games/g1.zip")).toBeNull();
  });
  it("returns null for a valid http rar URL", () => {
    expect(validateGameFileUrl("http://files.example.com/path/to/game.rar")).toBeNull();
  });
  it("accepts each allowed extension over https", () => {
    for (const ext of [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"]) {
      expect(validateGameFileUrl(`https://x.example.com/g${ext}`)).toBeNull();
    }
  });
  it("accepts uppercase extensions in the URL path", () => {
    expect(validateGameFileUrl("https://x.example.com/GAME.ZIP")).toBeNull();
    expect(validateGameFileUrl("https://x.example.com/build.TAR.GZ")).toBeNull();
  });

  it("rejects empty string with EMPTY message", () => {
    expect(validateGameFileUrl("")).toBe(GAME_FILE_URL_ERRORS.EMPTY);
    expect(GAME_FILE_URL_ERRORS.EMPTY).toBe("តំណមិនអាចទទេ");
  });
  it("rejects whitespace-only with EMPTY message", () => {
    expect(validateGameFileUrl("   ")).toBe(GAME_FILE_URL_ERRORS.EMPTY);
  });
  it("rejects null/undefined with EMPTY message", () => {
    expect(validateGameFileUrl(null)).toBe(GAME_FILE_URL_ERRORS.EMPTY);
    expect(validateGameFileUrl(undefined)).toBe(GAME_FILE_URL_ERRORS.EMPTY);
  });

  it("rejects a non-URL string with INVALID_URL message", () => {
    expect(validateGameFileUrl("not a url")).toBe(GAME_FILE_URL_ERRORS.INVALID_URL);
    expect(GAME_FILE_URL_ERRORS.INVALID_URL).toBe("តំណមិនត្រឹមត្រូវ");
  });

  it("rejects ftp:// with BAD_PROTOCOL message", () => {
    expect(validateGameFileUrl("ftp://x.example.com/g.zip")).toBe(
      GAME_FILE_URL_ERRORS.BAD_PROTOCOL,
    );
    expect(GAME_FILE_URL_ERRORS.BAD_PROTOCOL).toBe("តម្រូវ http ឬ https ប៉ុណ្ណោះ");
  });
  it("rejects javascript: with BAD_PROTOCOL message", () => {
    expect(validateGameFileUrl("javascript:alert(1)")).toBe(GAME_FILE_URL_ERRORS.BAD_PROTOCOL);
  });
  it("rejects data: with BAD_PROTOCOL message", () => {
    expect(validateGameFileUrl("data:application/zip;base64,AAAA")).toBe(
      GAME_FILE_URL_ERRORS.BAD_PROTOCOL,
    );
  });
  it("rejects file: with BAD_PROTOCOL message", () => {
    expect(validateGameFileUrl("file:///tmp/g.zip")).toBe(GAME_FILE_URL_ERRORS.BAD_PROTOCOL);
  });

  it("rejects http URL ending with .exe with BAD_EXTENSION message", () => {
    expect(validateGameFileUrl("https://x.example.com/g.exe")).toBe(
      GAME_FILE_URL_ERRORS.BAD_EXTENSION,
    );
    expect(GAME_FILE_URL_ERRORS.BAD_EXTENSION).toBe(
      "តំណត្រូវបញ្ចប់ដោយ .zip, .rar, .7z, .tar, .gz, .tgz",
    );
  });
  it("rejects URL whose path has no extension", () => {
    expect(validateGameFileUrl("https://x.example.com/games/")).toBe(
      GAME_FILE_URL_ERRORS.BAD_EXTENSION,
    );
  });
  it("ignores query string when checking extension (extension must be in pathname)", () => {
    expect(validateGameFileUrl("https://x.example.com/g.zip?token=abc")).toBeNull();
    expect(validateGameFileUrl("https://x.example.com/download?file=g.zip")).toBe(
      GAME_FILE_URL_ERRORS.BAD_EXTENSION,
    );
  });
  it("trims surrounding whitespace before validating", () => {
    expect(validateGameFileUrl("  https://x.example.com/g.zip  ")).toBeNull();
  });
});
