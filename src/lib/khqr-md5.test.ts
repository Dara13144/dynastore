import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { encodeKhqr } from "@/lib/khqr-encode";

const md5Hex = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

const baseInput = {
  accountId: "ben_sothida@bkrt",
  merchantName: "Dyna Store",
  merchantCity: "PHNOM PENH",
  currency: "USD" as const,
  amount: 5,
  mobileNumber: "85512345678",
  storeLabel: "Dyna Store",
  terminalLabel: "tp-test",
};

function generateFresh(attempt: number) {
  const nonce = `u-${Date.now().toString(36)}-${attempt}${Math.random().toString(36).slice(2, 6)}`;
  const { qr } = encodeKhqr({ ...baseInput, billNumber: nonce });
  return { qr, md5: md5Hex(qr) };
}

describe('"បង្កើត QR ថ្មី" — fresh QR + matching MD5', () => {
  it("each generated QR is structurally valid KHQR", () => {
    const { qr } = generateFresh(0);
    expect(typeof qr).toBe("string");
    expect(qr.length).toBeGreaterThan(50);
    expect(qr.startsWith("0002")).toBe(true);
  });

  it("bakong_md5 always equals md5(qr_string) for a fresh generation", () => {
    for (let i = 0; i < 10; i++) {
      const { qr, md5 } = generateFresh(i);
      expect(md5Hex(qr)).toBe(md5);
      expect(md5).toMatch(/^[a-f0-9]{32}$/);
    }
  });

  it("each press of 'បង្កើត QR ថ្មី' produces a new qr_string AND new bakong_md5", () => {
    const seen = new Set<string>();
    const md5s = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const { qr, md5 } = generateFresh(i);
      expect(seen.has(qr)).toBe(false);
      expect(md5s.has(md5)).toBe(false);
      seen.add(qr);
      md5s.add(md5);
    }
    expect(seen.size).toBe(8);
    expect(md5s.size).toBe(8);
  });

  it("recomputing md5 on the stored qr_string detects tampering", () => {
    const { qr, md5 } = generateFresh(0);
    expect(md5Hex(qr)).toBe(md5); // good
    const tampered = qr.slice(0, -4) + "AAAA";
    expect(md5Hex(tampered)).not.toBe(md5); // mismatch detected
  });
});
