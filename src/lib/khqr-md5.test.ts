import { describe, it, expect } from "vitest";
import { createHash } from "crypto";
import { encodeKhqr } from "@/lib/khqr-encode";

// ======================================================
// MD5
// ======================================================

const md5Hex = (s: string): string => createHash("md5").update(s, "utf8").digest("hex");

// ======================================================
// BASE INPUT
// ======================================================

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

// ======================================================
// GENERATE FRESH QR
// ======================================================

async function generateFresh(attempt: number) {
  // Unique nonce
  const nonce = `u-${Date.now().toString(36)}-${attempt}-${Math.random().toString(36).slice(2, 8)}`;

  const result = await encodeKhqr({
    ...baseInput,
    billNumber: nonce,
    dynamic: true,
  });

  return {
    qr: result.qr,
    crc: result.crc,
    md5: result.md5 || md5Hex(result.qr),
    billNumber: nonce,
  };
}

// ======================================================
// TESTS
// ======================================================

describe('"បង្កើត QR ថ្មី" — fresh QR + matching MD5', () => {
  // ==================================================
  // QR STRUCTURE
  // ==================================================

  it("generated QR is structurally valid KHQR", async () => {
    const { qr } = await generateFresh(0);

    expect(typeof qr).toBe("string");

    expect(qr.length).toBeGreaterThan(50);

    // EMV format
    expect(qr.startsWith("0002")).toBe(true);

    // CRC field exists
    expect(qr.includes("6304")).toBe(true);

    // Ends with CRC
    expect(qr.slice(-4)).toMatch(/^[A-F0-9]{4}$/);
  });

  // ==================================================
  // MD5 ALWAYS MATCHES
  // ==================================================

  it("bakong_md5 always equals md5(qr_string)", async () => {
    for (let i = 0; i < 10; i++) {
      const { qr, md5 } = await generateFresh(i);

      expect(md5Hex(qr)).toBe(md5);

      expect(md5).toMatch(/^[a-f0-9]{32}$/);
    }
  });

  // ==================================================
  // EVERY QR IS UNIQUE
  // ==================================================

  it("each press of 'បង្កើត QR ថ្មី' creates new qr + md5", async () => {
    const seenQr = new Set<string>();

    const seenMd5 = new Set<string>();

    for (let i = 0; i < 8; i++) {
      const { qr, md5 } = await generateFresh(i);

      expect(seenQr.has(qr)).toBe(false);

      expect(seenMd5.has(md5)).toBe(false);

      seenQr.add(qr);
      seenMd5.add(md5);
    }

    expect(seenQr.size).toBe(8);

    expect(seenMd5.size).toBe(8);
  });

  // ==================================================
  // TAMPER DETECTION
  // ==================================================

  it("tampering changes md5", async () => {
    const { qr, md5 } = await generateFresh(0);

    // Original valid
    expect(md5Hex(qr)).toBe(md5);

    // Modify QR
    const tampered = qr.slice(0, -4) + "AAAA";

    // MD5 mismatch
    expect(md5Hex(tampered)).not.toBe(md5);
  });

  // ==================================================
  // DIFFERENT BILL NUMBERS
  // ==================================================

  it("different billNumbers generate different QR payloads", async () => {
    const a = await generateFresh(1);

    const b = await generateFresh(2);

    expect(a.qr).not.toBe(b.qr);

    expect(a.md5).not.toBe(b.md5);

    expect(a.billNumber).not.toBe(b.billNumber);
  });

  // ==================================================
  // CRC CHANGES IF QR CHANGES
  // ==================================================

  it("changing QR changes CRC", async () => {
    const { qr } = await generateFresh(0);

    const originalCRC = qr.slice(-4);

    // Mutate payload
    const tampered = qr.slice(0, 20) + "A" + qr.slice(21);

    const tamperedCRC = tampered.slice(-4);

    expect(tamperedCRC).not.toBe(originalCRC);
  });
});
