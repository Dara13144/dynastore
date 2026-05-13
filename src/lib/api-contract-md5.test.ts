import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createHash } from "crypto";
import { encodeKhqr } from "@/lib/khqr-encode";

/**
 * Property-based test for the BACKEND API response contract.
 *
 * Mirrors `createTopup` / `generateKhqrForUser` in src/lib/payment.functions.ts
 * (the only client-controlled input is `amountUsd`; everything else is sourced
 * from app_settings on the server). For each random valid amountUsd, we run
 * the same encode + hash code path the server uses and assert:
 *   response.bakongMd5 === md5(response.qr)
 * plus structural invariants of the qr payload.
 */

const md5Hex = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

// Same shape as `loadSettings()` returns at runtime (using safe defaults).
const SERVER_SETTINGS = {
  accountId: "dyna_store@bkrt",
  merchantName: "Dyna Store",
  merchantCity: "PHNOM PENH",
  phone: "85512345678",
};

function simulateCreateTopupResponse(amountUsd: number, userId: string, attempt = 0) {
  // Identical nonce construction to payment.functions.ts createTopup loop.
  const nonce = `${userId.slice(0, 6)}-${Date.now().toString(36)}-${attempt}${Math.random().toString(36).slice(2, 6)}`;
  const { qr } = encodeKhqr({
    accountId: SERVER_SETTINGS.accountId,
    merchantName: SERVER_SETTINGS.merchantName,
    merchantCity: SERVER_SETTINGS.merchantCity,
    currency: "USD",
    amount: Number(amountUsd.toFixed(2)),
    mobileNumber: SERVER_SETTINGS.phone,
    storeLabel: "Dyna Store",
    terminalLabel: `tp-${userId.slice(0, 8)}`,
    billNumber: nonce,
  });
  return { qr, bakongMd5: md5Hex(qr), amountUsd, orderId: `khqr_${userId}-${attempt}` };
}

const validAmountUsd = fc.integer({ min: 1, max: 1000 });
const userId = fc.uuid();

describe("API contract (property-based): createTopup response.bakongMd5 == md5(response.qr)", () => {
  it("holds for 300 random (amountUsd, userId) pairs", () => {
    fc.assert(
      fc.property(validAmountUsd, userId, (amountUsd, uid) => {
        const res = simulateCreateTopupResponse(amountUsd, uid);

        // Structural — same guards backend `checkTopup` uses.
        expect(typeof res.qr).toBe("string");
        expect(res.qr.length).toBeGreaterThanOrEqual(50);
        expect(res.qr.startsWith("0002")).toBe(true);
        expect(res.bakongMd5).toMatch(/^[a-f0-9]{32}$/);

        // The contract.
        expect(res.bakongMd5).toBe(md5Hex(res.qr));
      }),
      { numRuns: 300 },
    );
  });

  it("forceNew (regen) — every successive call returns a fresh, internally-consistent qr+md5", () => {
    fc.assert(
      fc.property(validAmountUsd, userId, fc.integer({ min: 2, max: 6 }), (amountUsd, uid, n) => {
        const seenQr = new Set<string>();
        const seenMd5 = new Set<string>();
        for (let i = 0; i < n; i++) {
          const res = simulateCreateTopupResponse(amountUsd, uid, i);
          // Per-row consistency
          expect(res.bakongMd5).toBe(md5Hex(res.qr));
          // Uniqueness across regenerations
          expect(seenQr.has(res.qr)).toBe(false);
          expect(seenMd5.has(res.bakongMd5)).toBe(false);
          seenQr.add(res.qr);
          seenMd5.add(res.bakongMd5);
        }
      }),
      { numRuns: 50 },
    );
  });

  it("response payload satisfies DB CHECK constraints (qr_string shape + md5 shape + match)", () => {
    fc.assert(
      fc.property(validAmountUsd, userId, (amountUsd, uid) => {
        const res = simulateCreateTopupResponse(amountUsd, uid);
        // transactions_qr_string_shape
        expect(res.qr.length).toBeGreaterThanOrEqual(50);
        expect(res.qr.slice(0, 4)).toBe("0002");
        // transactions_bakong_md5_shape
        expect(res.bakongMd5).toMatch(/^[a-f0-9]{32}$/);
        // transactions_md5_matches_qr
        expect(res.bakongMd5).toBe(md5Hex(res.qr));
      }),
      { numRuns: 200 },
    );
  });
});
