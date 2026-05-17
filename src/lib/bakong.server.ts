// Bakong KHQR builder + Open API client.
// Server-only: reads BAKONG_* env at call time.
import { createHash } from "crypto";

// EMVCo TLV helper: 2-digit id + 2-digit length + value
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — KHQR / EMVCo spec
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (!v && fallback === undefined) throw new Error(`Missing env: ${name}`);
  return (v ?? fallback)!;
}

/**
 * Build an amount-bound KHQR payload for a one-time bill.
 * billNumber must be unique per request so MD5 hash is unique.
 */
export function buildKhqr(amountUsd: number, billNumber: string): string {
  const accountId = env("BAKONG_ACCOUNT_ID");
  const merchantName = env("BAKONG_MERCHANT_NAME", "DynaStore").slice(0, 25);
  const merchantCity = env("BAKONG_MERCHANT_CITY", "Phnom Penh").slice(0, 15);
  const acquiringBank = env("BAKONG_ACQUIRING_BANK", "");
  const phone = env("BAKONG_MERCHANT_PHONE", "");

  // Merchant account info (tag 29) for individual / static-account merchant
  const sub00 = tlv("00", accountId);
  let mai = sub00;
  if (acquiringBank) mai += tlv("01", acquiringBank);
  const merchantAccountInfo = tlv("29", mai);

  // Additional data (tag 62): bill number + store label (phone)
  let additional = tlv("01", billNumber.slice(0, 25));
  if (phone) additional += tlv("03", phone.slice(0, 25));
  const additionalData = tlv("62", additional);

  // USD = currency 840, KHR = 116. We use USD here.
  const amount = amountUsd.toFixed(2);

  const payloadNoCrc =
    tlv("00", "01") +                            // payload format indicator
    tlv("01", "12") +                            // point-of-init: 12 = dynamic (amount-bound)
    merchantAccountInfo +
    tlv("52", "5999") +                          // MCC: misc
    tlv("53", "840") +                           // currency: USD
    tlv("54", amount) +                          // amount
    tlv("58", "KH") +                            // country
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    additionalData +
    "6304";                                      // CRC tag + length placeholder
  const crc = crc16(payloadNoCrc);
  return payloadNoCrc + crc;
}

export function md5Hex(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

const BAKONG_API = "https://api-bakong.nbc.gov.kh";

export type BakongCheckResult = {
  responseCode: number;
  responseMessage: string;
  data?: {
    hash: string;
    fromAccountId?: string;
    toAccountId?: string;
    currency?: string;
    amount?: number;
    description?: string;
    createdDateMs?: number;
    acknowledgedDateMs?: number;
    [k: string]: unknown;
  } | null;
};

export async function checkTransactionByMd5(md5: string): Promise<BakongCheckResult> {
  const token = env("BAKONG_DEVELOPER_TOKEN");
  const res = await fetch(`${BAKONG_API}/v1/check_transaction_by_md5`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ md5 }),
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Bakong API non-JSON response [${res.status}]: ${text.slice(0, 200)}`); }
  return json as BakongCheckResult;
}
