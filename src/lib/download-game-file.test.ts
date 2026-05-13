import { describe, it, expect, vi } from "vitest";
import {
  resolveDownloadUrl,
  isExternalDownload,
  type SignedUrlSigner,
} from "./download-game-file";
import { GAME_FILE_URL_ERRORS } from "./validate-game-file";

const okSigner = (url = "https://storage.example/signed?token=abc"): SignedUrlSigner =>
  vi.fn(async () => ({ data: { signedUrl: url }, error: null }));

const failSigner = (msg = "boom"): SignedUrlSigner =>
  vi.fn(async () => ({ data: null, error: { message: msg } }));

describe("isExternalDownload", () => {
  it.each([
    ["https://example.com/game.zip", true],
    ["http://example.com/game.zip", true],
    ["HTTPS://EXAMPLE.COM/g.zip", true],
    ["games/3/file.zip", false],
    ["3/file.zip", false],
    ["ftp://example.com/x.zip", false],
    ["", false],
  ])("isExternalDownload(%s) === %s", (input, expected) => {
    expect(isExternalDownload(input)).toBe(expected);
  });
});

describe("resolveDownloadUrl - external http(s) links", () => {
  it("returns the http link unchanged and never calls the signer", async () => {
    const signer = okSigner();
    const r = await resolveDownloadUrl("http://example.com/game.zip", signer);
    expect(r).toEqual({ ok: true, url: "http://example.com/game.zip", external: true });
    expect(signer).not.toHaveBeenCalled();
  });

  it("returns the https link unchanged and never calls the signer", async () => {
    const signer = okSigner();
    const r = await resolveDownloadUrl("https://cdn.example/g.rar", signer);
    expect(r).toEqual({ ok: true, url: "https://cdn.example/g.rar", external: true });
    expect(signer).not.toHaveBeenCalled();
  });

  it("is case-insensitive on the scheme", async () => {
    const signer = okSigner();
    const r = await resolveDownloadUrl("HTTPS://x.test/y.zip", signer);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.external).toBe(true);
    expect(signer).not.toHaveBeenCalled();
  });
});

describe("resolveDownloadUrl - external link validation", () => {
  it("rejects http(s) URLs with a disallowed extension (.exe)", async () => {
    const signer = okSigner();
    const r = await resolveDownloadUrl("https://evil.test/payload.exe", signer);
    expect(r).toEqual({ ok: false, error: GAME_FILE_URL_ERRORS.BAD_EXTENSION });
    expect(signer).not.toHaveBeenCalled();
  });

  it("rejects http(s) URLs with no file extension", async () => {
    const signer = okSigner();
    const r = await resolveDownloadUrl("https://example.com/", signer);
    expect(r).toEqual({ ok: false, error: GAME_FILE_URL_ERRORS.BAD_EXTENSION });
    expect(signer).not.toHaveBeenCalled();
  });

  it("accepts allowed archive extensions over https", async () => {
    for (const ext of [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"]) {
      const signer = okSigner();
      const url = `https://cdn.example/file${ext}`;
      const r = await resolveDownloadUrl(url, signer);
      expect(r).toEqual({ ok: true, url, external: true });
      expect(signer).not.toHaveBeenCalled();
    }
  });

  it("treats non-http(s) schemes as in-bucket paths (signer is called)", async () => {
    const signer = okSigner();
    await resolveDownloadUrl("ftp://example.com/x.zip", signer);
    expect(signer).toHaveBeenCalledTimes(1);
  });
});

describe("resolveDownloadUrl - in-bucket Storage paths", () => {
  it("calls signer with the path and default 300s TTL", async () => {
    const signer = okSigner("https://storage.example/signed?t=1");
    const r = await resolveDownloadUrl("3/game.zip", signer);
    expect(signer).toHaveBeenCalledTimes(1);
    expect(signer).toHaveBeenCalledWith("3/game.zip", 300, undefined);
    expect(r).toEqual({
      ok: true,
      url: "https://storage.example/signed?t=1",
      external: false,
    });
  });

  it("forwards forceDownload as { download: true }", async () => {
    const signer = okSigner();
    await resolveDownloadUrl("3/game.zip", signer, { forceDownload: true });
    expect(signer).toHaveBeenCalledWith("3/game.zip", 300, { download: true });
  });

  it("forwards a custom expiresInSeconds", async () => {
    const signer = okSigner();
    await resolveDownloadUrl("3/game.zip", signer, { expiresInSeconds: 60 });
    expect(signer).toHaveBeenCalledWith("3/game.zip", 60, undefined);
  });

  it("returns ok:false with the signer error message on failure", async () => {
    const signer = failSigner("nope");
    const r = await resolveDownloadUrl("3/game.zip", signer);
    expect(r).toEqual({ ok: false, error: "nope" });
  });

  it("returns ok:false when signer returns no signedUrl and no error", async () => {
    const signer: SignedUrlSigner = vi.fn(async () => ({ data: null, error: null }));
    const r = await resolveDownloadUrl("3/game.zip", signer);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("មិនអាចបង្កើតតំណទាញយកបាន");
  });
});

describe("resolveDownloadUrl - missing file path", () => {
  it.each([null, undefined, ""])("returns ok:false for %p without calling signer", async (val) => {
    const signer = okSigner();
    const r = await resolveDownloadUrl(val as string | null | undefined, signer);
    expect(r.ok).toBe(false);
    expect(signer).not.toHaveBeenCalled();
  });
});
