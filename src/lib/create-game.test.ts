import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitCreateGame, type CreateGameDeps, type GameDraft } from "./create-game";
import { MIN_GAME_FILE_BYTES, MAX_GAME_FILE_BYTES } from "./validate-game-file";

/**
 * Integration tests for the real createGame submit path used by admin.tsx.
 * The storage upload client and DB insert are mocked so we can assert that
 * invalid files NEVER trigger either side effect.
 */

const validDraft = (over: Partial<GameDraft> = {}): GameDraft => ({
  id: "g1", title: "Game One", category: "ACTION", description: "d",
  badge: "", price_coins: 100, visible: true, image_url: "", ...over,
});

function makeDeps() {
  const uploadFile: CreateGameDeps["uploadFile"] = vi.fn(async (gameId, file) => ({
    path: `${gameId}/${file.name}`, size: file.size,
  }));
  const insertGame: CreateGameDeps["insertGame"] = vi.fn(async () => ({ error: null }));
  const onError = vi.fn();
  return { uploadFile, insertGame, onError };
}

describe("submitCreateGame - invalid files never call upload or insert", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => { deps = makeDeps(); });

  it("rejects file under 1GB BEFORE upload + insert", async () => {
    const r = await submitCreateGame(validDraft(), { name: "g.zip", size: MIN_GAME_FILE_BYTES - 1 }, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_file");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(expect.stringContaining("តូចពេក"));
  });

  it("rejects file over 5000GB BEFORE upload + insert", async () => {
    const r = await submitCreateGame(validDraft(), { name: "g.zip", size: MAX_GAME_FILE_BYTES + 1 }, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_file");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
    expect(deps.onError).toHaveBeenCalledWith(expect.stringContaining("ធំពេក"));
  });

  it("rejects disallowed extension BEFORE upload + insert", async () => {
    const r = await submitCreateGame(validDraft(), { name: "g.exe", size: MIN_GAME_FILE_BYTES }, deps);
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
    const r = await submitCreateGame(validDraft(), { name: "file.zip.bak", size: MIN_GAME_FILE_BYTES }, deps);
    expect(r.ok).toBe(false);
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
  });

  it("rejects missing id/title BEFORE upload + insert", async () => {
    const r = await submitCreateGame(validDraft({ id: "  ", title: "" }), { name: "g.zip", size: MIN_GAME_FILE_BYTES }, deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing_fields");
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).not.toHaveBeenCalled();
  });
});

describe("submitCreateGame - valid path calls upload + insert exactly once", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => { deps = makeDeps(); });

  it("accepts file at the 1GB minimum boundary", async () => {
    const r = await submitCreateGame(validDraft(), { name: "g.zip", size: MIN_GAME_FILE_BYTES }, deps);
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledWith(expect.objectContaining({
      id: "g1", title: "Game One", file_path: "g1/g.zip", file_size_bytes: MIN_GAME_FILE_BYTES,
    }));
  });

  it("accepts file at the 5000GB maximum boundary", async () => {
    const r = await submitCreateGame(validDraft(), { name: "g.zip", size: MAX_GAME_FILE_BYTES }, deps);
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledTimes(1);
  });

  it("submits without a file (no upload, single insert with null file_path)", async () => {
    const r = await submitCreateGame(validDraft(), null, deps);
    expect(r.ok).toBe(true);
    expect(deps.uploadFile).not.toHaveBeenCalled();
    expect(deps.insertGame).toHaveBeenCalledTimes(1);
    expect(deps.insertGame).toHaveBeenCalledWith(expect.objectContaining({
      file_path: null, file_size_bytes: null,
    }));
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
