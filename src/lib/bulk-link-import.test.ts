import { describe, it, expect } from "vitest";
import { parseBulkLinks, deriveIdFromUrl, summarizeParse, dedupeAgainstExisting } from "./bulk-link-import";

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
    expect(summarizeParse(rows)).toEqual({ total: 3, valid: 2, invalid: 1, skipped: 0, importable: 2 });
  });

  it("clamps negative or non-numeric prices to 0", () => {
    const rows = parseBulkLinks("g|T|GAME|-5|https://x.example/g.zip");
    expect(rows[0].draft?.price_coins).toBe(0);
  });

  it("derives id from URL filename ignoring extension", () => {
    expect(deriveIdFromUrl("https://cdn.example.com/path/Hello-World.7z")).toBe("hello-world");
  });

  it("accepts CDN links with the filename in the query string", () => {
    const url = "https://fileditchfiles.me/file.php?f=/alpha4/c80c951923db4e2fe7d5/interactv-scenarios-v100.rar";
    const rows = parseBulkLinks(url);
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft?.id).toBe("interactv-scenarios-v100");
  });

  it("accepts share-page URLs without file extension (uploadnow.io)", () => {
    const rows = parseBulkLinks("https://uploadnow.io/files/FvFBmV6");
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft?.id).toBe("fvfbmv6");
  });
});

describe("bulk-link-import URL normalization", () => {
  it("strips tracking params (utm_*, fbclid, gclid)", () => {
    const rows = parseBulkLinks(
      "https://cdn.example.com/game.zip?utm_source=x&utm_medium=y&fbclid=abc&keep=1",
    );
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft?.url).toBe("https://cdn.example.com/game.zip?keep=1");
  });

  it("lowercases host and strips leading www.", () => {
    const rows = parseBulkLinks("https://WWW.Cdn.Example.COM/My-Game.zip");
    expect(rows[0].ok).toBe(true);
    expect(rows[0].draft?.url).toBe("https://cdn.example.com/My-Game.zip");
  });

  it("rejects URLs from unsupported hosts with no archive extension", () => {
    const rows = parseBulkLinks("https://random.example.com/page");
    expect(rows[0].ok).toBe(false);
    expect(rows[0].error).toBe("ប្រភពនេះមិនត្រូវបានគាំទ្រទេ");
  });

  it("rejects URLs longer than 2048 chars", () => {
    const long = "https://example.com/" + "a".repeat(2100) + ".zip";
    const rows = parseBulkLinks(long);
    expect(rows[0].ok).toBe(false);
  });
});

describe("dedupeAgainstExisting", () => {
  it("marks rows whose id already exists in the system as skipped", () => {
    const rows = parseBulkLinks(
      "https://cdn.example.com/cool-game.zip\nhttps://cdn.example.com/new-game.zip",
    );
    const out = dedupeAgainstExisting(rows, { ids: ["cool-game"] });
    expect(out[0].ok).toBe(false);
    expect(out[0].skipped).toBe(true);
    expect(out[0].skipReason).toContain("cool-game");
    expect(out[1].ok).toBe(true);
  });

  it("marks rows whose URL already exists (case + www. insensitive)", () => {
    const rows = parseBulkLinks("https://CDN.example.com/cool-game.zip");
    const out = dedupeAgainstExisting(rows, {
      urls: ["https://www.cdn.example.com/cool-game.zip"],
    });
    expect(out[0].ok).toBe(false);
    expect(out[0].skipped).toBe(true);
    expect(out[0].skipReason).toMatch(/URL/);
  });

  it("summarizeParse reports total/valid/invalid/skipped/importable", () => {
    const rows = parseBulkLinks(
      [
        "https://cdn.example.com/a.zip",
        "https://cdn.example.com/b.zip",
        "not a url",
      ].join("\n"),
    );
    const out = dedupeAgainstExisting(rows, { ids: ["a"] });
    expect(summarizeParse(out)).toEqual({
      total: 3,
      valid: 1,
      invalid: 1,
      skipped: 1,
      importable: 1,
    });
  });

  it("leaves rows untouched when no existing set provided", () => {
    const rows = parseBulkLinks("https://cdn.example.com/x.zip");
    const out = dedupeAgainstExisting(rows, {});
    expect(out[0].ok).toBe(true);
    expect(out[0].skipped).toBeUndefined();
  });
});
