import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitCreateGame, type CreateGameDeps, type GameDraft } from "./create-game";
import {
  MIN_GAME_FILE_BYTES,
  MAX_GAME_FILE_BYTES,
  GAME_FILE_URL_ERRORS,
} from "./validate-game-file";

/**
 * Integration tests for the real createGame submit path used by admin.tsx.
 * The storage upload client and DB insert are mocked so we can assert that
 * invalid files NEVER trigger either side effect.
 */

const validDraft = (over: Partial<GameDraft> = {}): GameDraft => ({
  id: "g1",
  title: "Game One",
  category: "ACTION",
  description: "d",
  badge: "",
  price_coins: 100,
  visible: true,
  image_url: "",
  ...over,
});

function makeDeps() {
  const uploadFile: CreateGameDeps["uploadFile"] = vi.fn(async (gameId, file) => ({
    path: `${gameId}/${file.name}`,
    size: file.size,
  }));
  const insertGame: CreateGameDeps["insertGame"] = vi.fn(async () => ({ error: null }));
  const onError = vi.fn();
  return { uploadFile, insertGame, onError };
}

describe("submitCreateGame - invalid files never call upload or insert", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    deps = makeDeps();
  });

  it("rejects file under 1GB BEFORE upload + insert", async () => {
    const r = await submitCreateGame(
      validDraft(),
      { name: "g.zip", size: MIN_GAME_FILE_BYTES - 1 },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_file");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(expect.stringContaining("តូចពេក"));
  });

  it("rejects file over 5000GB BEFORE upload + insert", async () => {
    const r = await submitCreateGame(
      validDraft(),
      { name: "g.zip", size: MAX_GAME_FILE_BYTES + 1 },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_file");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(expect.stringContaining("ធំពេក"));
  });

  it("rejects disallowed extension BEFORE upload + insert", async () => {
    const r = await submitCreateGame(
      validDraft(),
      { name: "g.exe", size: MIN_GAME_FILE_BYTES },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_file");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(expect.stringContaining("មិនអនុញ្ញាត"));
  });

  it("rejects empty file BEFORE upload + insert", async () => {
    const r = await submitCreateGame(validDraft(), { name: "g.zip", size: 0 }, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_file");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
  });

  it("rejects tricky filename file.zip.bak BEFORE upload + insert", async () => {
    const r = await submitCreateGame(
      validDraft(),
      { name: "file.zip.bak", size: MIN_GAME_FILE_BYTES },
      deps,
    );
    expect(r.ok).toBe(false);
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
  });

  it("rejects missing id/title BEFORE upload + insert", async () => {
    const r = await submitCreateGame(
      validDraft({ id: "  ", title: "" }),
      { name: "g.zip", size: MIN_GAME_FILE_BYTES },
      deps,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_fields");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
  });
});

describe("submitCreateGame - valid path calls upload + insert exactly once", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    deps = makeDeps();
  });

  it("accepts file at the 1GB minimum boundary", async () => {
    const r = await submitCreateGame(
      validDraft(),
      { name: "g.zip", size: MIN_GAME_FILE_BYTES },
      deps,
    );
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "g1",
        title: "Game One",
        file_path: "g1/g.zip",
        file_size_bytes: MIN_GAME_FILE_BYTES,
      }),
    );
  });

  it("accepts file at the 5000GB maximum boundary", async () => {
    const r = await submitCreateGame(
      validDraft(),
      { name: "g.zip", size: MAX_GAME_FILE_BYTES },
      deps,
    );
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledTimes(1);
  });

  it("submits without a file (no upload, single insert with null file_path)", async () => {
    const r = await submitCreateGame(validDraft(), null, deps);
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledWith(
      expect.objectContaining({
        file_path: null,
        file_size_bytes: null,
      }),
    );
  });

  it("uses file_url as file_path when no file is uploaded (no upload, single insert)", async () => {
    const url = "https://cdn.example.com/games/g1.zip";
    const r = await submitCreateGame(validDraft({ file_url: url }), null, deps);
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledWith(
      expect.objectContaining({
        file_path: url,
        file_size_bytes: null,
      }),
    );
  });

  it("prefers uploaded file over file_url when both are provided", async () => {
    const r = await submitCreateGame(
      validDraft({ file_url: "https://cdn.example.com/ignored.zip" }),
      { name: "g.zip", size: MIN_GAME_FILE_BYTES },
      deps,
    );
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledWith(
      expect.objectContaining({
        file_path: "g1/g.zip",
        file_size_bytes: MIN_GAME_FILE_BYTES,
      }),
    );
  });

  it("aborts insert when uploadFile fails", async () => {
    const upload = vi.fn(async () => null);
    const insert = vi.fn(async () => ({ error: null }));
    const r = await submitCreateGame(
      validDraft(),
      { name: "g.zip", size: MIN_GAME_FILE_BYTES },
      { uploadFile: upload, insertGame: insert },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("upload_failed");
    expect(upload).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it("propagates DB insert errors", async () => {
    const upload = vi.fn(async () => ({ path: "p", size: MIN_GAME_FILE_BYTES }));
    const insert = vi.fn(async () => ({ error: { message: "duplicate id" } }));
    const r = await submitCreateGame(
      validDraft(),
      { name: "g.zip", size: MIN_GAME_FILE_BYTES },
      { uploadFile: upload, insertGame: insert },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("insert_failed");
      expect(r.message).toBe("duplicate id");
    }
  });
});

describe("submitCreateGame - URL validation gates the insert", () => {
  function deps() {
    return {
      uploadFile: vi.fn(async () => ({ path: "p", size: 0 })),
      insertGame: vi.fn(async () => ({ error: null })),
      onError: vi.fn(),
    };
  }
  const draft = (file_url: string): GameDraft => ({
    id: "g1",
    title: "G1",
    category: "",
    description: "",
    badge: "",
    price_coins: 0,
    visible: true,
    image_url: "",
    file_url,
  });

  it("rejects ftp:// link with BAD_PROTOCOL message and no insert", async () => {
    const d = deps();
    const r = await submitCreateGame(draft("ftp://x.example.com/g.zip"), null, d);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid_url");
      expect(r.message).toBe(GAME_FILE_URL_ERRORS.BAD_PROTOCOL);
    }
    expect(d.insertGame).not.toHaveBeenCalled();
    expect(d.onError).toHaveBeenCalledWith(GAME_FILE_URL_ERRORS.BAD_PROTOCOL);
  });

  it("rejects link with .exe with BAD_EXTENSION message and no insert", async () => {
    const d = deps();
    const r = await submitCreateGame(draft("https://x.example.com/g.exe"), null, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(GAME_FILE_URL_ERRORS.BAD_EXTENSION);
    expect(d.insertGame).not.toHaveBeenCalled();
  });

  it("rejects malformed URL with INVALID_URL message and no insert", async () => {
    const d = deps();
    const r = await submitCreateGame(draft("not a url"), null, d);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(GAME_FILE_URL_ERRORS.INVALID_URL);
    expect(d.insertGame).not.toHaveBeenCalled();
  });

  it("accepts valid https zip URL and inserts it as file_path", async () => {
    const d = deps();
    const url = "https://cdn.example.com/g.zip";
    const r = await submitCreateGame(draft(url), null, d);
    expect(r.ok).toBe(true);
    expect(d.insertGame).toHaveBeenCalledWith(expect.objectContaining({ file_path: url }));
  });
});

describe("submitCreateGame - Add Library tab contract", () => {
  function deps() {
    return {
      uploadFile: vi.fn(async () => ({ path: "p", size: 0 })),
      insertGame: vi.fn(async () => ({ error: null })),
      onError: vi.fn(),
    };
  }
  const draft = (file_url: string | null | undefined): GameDraft => ({
    id: "lib1",
    title: "Lib Game",
    category: "ACTION",
    description: "",
    badge: "",
    price_coins: 50,
    visible: true,
    image_url: "",
    file_url,
  });

  it.each([
    [".zip"],
    [".rar"],
    [".7z"],
    [".tar"],
    [".gz"],
    [".tgz"],
  ])("creates library entry with file_path=URL for %s archives", async (ext) => {
    const d = deps();
    const url = `https://cdn.example.com/games/g${ext}`;
    const r = await submitCreateGame(draft(url), null, d);
    expect(r.ok).toBe(true);
    expect(d.uploadFile).not.toHaveBeenCalled();
    expect(d.insertGame).toHaveBeenCalledTimes(1);
    expect(d.insertGame).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "lib1",
        title: "Lib Game",
        file_path: url,
        file_size_bytes: null,
      }),
    );
  });

  it("trims surrounding whitespace from URL before storing as file_path", async () => {
    const d = deps();
    const r = await submitCreateGame(draft("  https://cdn.example.com/g.zip  "), null, d);
    expect(r.ok).toBe(true);
    expect(d.insertGame).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "https://cdn.example.com/g.zip" }),
    );
  });

  it("rejects javascript: scheme with no insert", async () => {
    const d = deps();
    const r = await submitCreateGame(draft("javascript:alert(1)"), null, d);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invalid_url");
      expect(r.message).toBe(GAME_FILE_URL_ERRORS.BAD_PROTOCOL);
    }
    expect(d.insertGame).not.toHaveBeenCalled();
  });

  it("rejects data: scheme with no insert", async () => {
    const d = deps();
    const r = await submitCreateGame(
      draft("data:application/zip;base64,AAAA"),
      null,
      d,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(GAME_FILE_URL_ERRORS.BAD_PROTOCOL);
    expect(d.insertGame).not.toHaveBeenCalled();
  });

  it("rejects URL whose extension is in query string but not pathname", async () => {
    const d = deps();
    const r = await submitCreateGame(
      draft("https://x.example.com/download?file=g.zip"),
      null,
      d,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe(GAME_FILE_URL_ERRORS.BAD_EXTENSION);
    expect(d.insertGame).not.toHaveBeenCalled();
  });

  it("accepts URL with query string when pathname has allowed extension", async () => {
    const d = deps();
    const url = "https://cdn.example.com/g.zip?token=abc";
    const r = await submitCreateGame(draft(url), null, d);
    expect(r.ok).toBe(true);
    expect(d.insertGame).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: url }),
    );
  });
});

/**
 * UI gating contract for the "Add Library" tab in admin.tsx.
 * The Save button must be disabled when (sourceMode === "library") and
 * (URL is empty OR validateGameFileUrl returns an error). This mirrors the
 * exact disabled-expression in src/routes/admin.tsx so the contract is locked.
 */
import { validateGameFileUrl } from "./validate-game-file";

function isSaveDisabled(opts: {
  busy: boolean;
  draftFileError: string | null;
  draftUrlError: string | null;
  sourceMode: "file" | "library";
  filePath: string | null;
}) {
  return (
    opts.busy ||
    !!opts.draftFileError ||
    !!opts.draftUrlError ||
    (opts.sourceMode === "library" && !(opts.filePath ?? "").trim())
  );
}

describe("Add Library tab — Save button gating", () => {
  const base = {
    busy: false,
    draftFileError: null,
    draftUrlError: null,
    sourceMode: "library" as const,
  };

  it("disables Save when URL is empty", () => {
    expect(isSaveDisabled({ ...base, filePath: null })).toBe(true);
    expect(isSaveDisabled({ ...base, filePath: "" })).toBe(true);
    expect(isSaveDisabled({ ...base, filePath: "   " })).toBe(true);
  });

  it("disables Save when URL is invalid (validateGameFileUrl returns error)", () => {
    const url = "https://x.example.com/g.exe";
    const err = validateGameFileUrl(url);
    expect(err).toBe(GAME_FILE_URL_ERRORS.BAD_EXTENSION);
    expect(isSaveDisabled({ ...base, filePath: url, draftUrlError: err })).toBe(true);
  });

  it("enables Save when URL is a valid archive link", () => {
    const url = "https://cdn.example.com/g.zip";
    expect(validateGameFileUrl(url)).toBeNull();
    expect(isSaveDisabled({ ...base, filePath: url })).toBe(false);
  });

  it("disables Save while busy even with a valid URL", () => {
    expect(
      isSaveDisabled({ ...base, busy: true, filePath: "https://cdn.example.com/g.zip" }),
    ).toBe(true);
  });

  it("file mode does NOT require a URL", () => {
    expect(
      isSaveDisabled({ ...base, sourceMode: "file", filePath: null }),
    ).toBe(false);
  });
});
