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
