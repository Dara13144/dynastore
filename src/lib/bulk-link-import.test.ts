import { describe, it, expect } from "vitest";
import { parseBulkLinks, deriveIdFromUrl, summarizeParse } from "./bulk-link-import";

describe("bulk-link-import parser", () => {
  it("ignores blank lines and comments", () => {
    const rows = parseBulkLinks("\n# header\n\nhttps://cdn.example.com/cool-game.zip\n");
    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft?.url).toBe("https://cdn.example.com/cool-game.zip");
  });

  it("derives id and title from a bare URL", () => {
    const rows = parseBulkLinks("https://cdn.example.com/My_Cool.Game.zip");
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft?.id).toBe("my-cool-game");
    expect(rows[0].draft?.title.length).toBeGreaterThan(0);
  });

  it("parses pipe-delimited id|title|category|price|url", () => {
    const rows = parseBulkLinks("acid|Acid Quest|RPG|150|https://x.example/acid.zip");
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft).toMatchObject({
      id: "acid",
      title: "Acid Quest",
      category: "RPG",
      price_coins: 150,
      url: "https://x.example/acid.zip",
    });
  });

  it("parses tab-delimited rows", () => {
    const rows = parseBulkLinks("g1\tTitle\tACTION\t10\thttps://x.example/g1.rar");
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft?.category).toBe("ACTION");
  });

  it("flags invalid URLs", () => {
    const rows = parseBulkLinks("not-a-url\nftp://x/y.zip\nhttps://x.example/missing-ext");
    expect(rows.every((r) => !r.ok)).toBe(true);
    expect(rows[0].error).toBeTruthy();
  });

  it("rejects unsupported file extensions", () => {
    const rows = parseBulkLinks("https://x.example/game.exe");
    expect(rows[0].ok).toBe(false);
  });

  it("detects duplicate ids in the same batch", () => {
    const rows = parseBulkLinks(
      "dup|Game A|GAME|0|https://x.example/a.zip\ndup|Game B|GAME|0|https://x.example/b.zip",
    );
    expect(rows[0].ok).toBe(true);
    expect(rows[1].ok).toBe(false);
    expect(rows[1].error).toMatch(/ស្ទួន/);
  });

  it("summarizes valid vs invalid", () => {
    const rows = parseBulkLinks(
      "https://x.example/a.zip\nhttps://x.example/b.zip\ngarbage-line",
    );
    expect(summarizeParse(rows)).toEqual({ total: 3, valid: 2, invalid: 1 });
  });

  it("clamps negative or non-numeric prices to 0", () => {
    const rows = parseBulkLinks("g|T|GAME|-5|https://x.example/g.zip");
    expect(rows[0].draft?.price_coins).toBe(0);
  });

  it("derives id from URL filename ignoring extension", () => {
    expect(deriveIdFromUrl("https://cdn.example.com/path/Hello-World.7z")).toBe("hello-world");
  });
});
