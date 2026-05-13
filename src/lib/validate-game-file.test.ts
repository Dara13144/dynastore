import { describe, it, expect } from "vitest";
import {
  validateGameFile,
  MIN_GAME_FILE_BYTES,
  MAX_GAME_FILE_BYTES,
  MIN_GAME_FILE_MB,
  MAX_GAME_FILE_MB,
} from "./validate-game-file";

describe("validateGameFile - byte conversion", () => {
  it("MIN_GAME_FILE_BYTES == 1000 * 1024 * 1024", () => {
    expect(MIN_GAME_FILE_BYTES).toBe(1000 * 1024 * 1024);
    expect(MIN_GAME_FILE_BYTES).toBe(1_048_576_000);
  });
  it("MAX_GAME_FILE_BYTES == 5000 * 1024 * 1024", () => {
    expect(MAX_GAME_FILE_BYTES).toBe(5000 * 1024 * 1024);
    expect(MAX_GAME_FILE_BYTES).toBe(5_242_880_000);
  });
});

describe("validateGameFile - boundaries", () => {
  it("accepts a file exactly at the minimum (1000MB)", () => {
    expect(validateGameFile({ name: "g.zip", size: MIN_GAME_FILE_BYTES })).toBeNull();
  });
  it("accepts a file exactly at the maximum (5000MB)", () => {
    expect(validateGameFile({ name: "g.zip", size: MAX_GAME_FILE_BYTES })).toBeNull();
  });
  it("rejects 1 byte under the minimum with exact Khmer string", () => {
    const size = MIN_GAME_FILE_BYTES - 1;
    const mb = (size / 1024 / 1024).toFixed(1);
    expect(validateGameFile({ name: "g.zip", size })).toBe(
      `ឯកសារតូចពេក (${mb}MB) — តម្រូវយ៉ាងតិច ${MIN_GAME_FILE_MB}MB`,
    );
  });
  it("rejects 1 byte over the maximum with exact Khmer string", () => {
    const size = MAX_GAME_FILE_BYTES + 1;
    const mb = (size / 1024 / 1024).toFixed(1);
    expect(validateGameFile({ name: "g.zip", size })).toBe(
      `ឯកសារធំពេក (${mb}MB) — អតិបរមា ${MAX_GAME_FILE_MB}MB`,
    );
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
