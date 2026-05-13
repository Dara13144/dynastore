// Native KHQR (EMVCo TLV) encoder. Replaces `bakong-khqr` which is broken
// in the Cloudflare Workers runtime.
// Reference: KHQR participant specification (Bakong individual format).

function tlv(tag: string, value: string): string {
  if (tag.length !== 2) throw new Error(`tlv: bad tag ${tag}`);
  const len = value.length.toString().padStart(2, "0");
  if (value.length > 99) throw new Error(`tlv: value too long for tag ${tag}`);
  return `${tag}${len}${value}`;
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — same as decoder.
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type KhqrEncodeInput = {
  /** Bakong account id, e.g. "ben_sothida@bkrt" */
  accountId: string;
  /** Acquiring bank code (optional sub 01 of merchant account info) */
  acquiringBank?: string;
  merchantName: string;       // tag 59  (max 25)
  merchantCity: string;       // tag 60  (max 15)
  amount: number;             // tag 54
  currency: "USD" | "KHR";    // tag 53 (840/116)
  /** Bill number / order id, tag 62/01 (max 25) */
  billNumber?: string;
  /** Store label, tag 62/03 (max 25) */
  storeLabel?: string;
  /** Terminal label, tag 62/07 (max 25) */
  terminalLabel?: string;
  /** Phone, tag 62/02 (max 25) */
  mobileNumber?: string;
  /** Optional Bakong "additional" md5 string under tag 62/99 — pure additional metadata */
  additional?: string;
};

export type KhqrEncoded = {
  qr: string;
  /** MD5 of the QR string — what Bakong's check_transaction_by_md5 expects. */
  md5: string;
};

const CURRENCY_CODE: Record<string, string> = { USD: "840", KHR: "116" };

function clip(v: string, max: number) {
  return v.length > max ? v.slice(0, max) : v;
}

/**
 * Build a KHQR (EMVCo) payload. Returns the full QR string + its MD5.
 * Caller is responsible for hashing the QR string with crypto.createHash
 * (we keep this file dependency-free for client/server reuse).
 */
export function encodeKhqr(input: KhqrEncodeInput): { qr: string } {
  const currency = CURRENCY_CODE[input.currency];
  if (!currency) throw new Error(`Unsupported currency ${input.currency}`);
  if (!input.accountId) throw new Error("accountId required");
  if (!input.merchantName) throw new Error("merchantName required");
  if (!input.merchantCity) throw new Error("merchantCity required");

  // Merchant account info (tag 29 for Bakong individual)
  const merchantParts: string[] = [tlv("00", input.accountId)];
  if (input.acquiringBank) merchantParts.push(tlv("01", input.acquiringBank));
  const merchant = merchantParts.join("");

  // Additional data — tag 62
  const addParts: string[] = [];
  if (input.billNumber) addParts.push(tlv("01", clip(input.billNumber, 25)));
  if (input.mobileNumber) addParts.push(tlv("02", clip(input.mobileNumber, 25)));
  if (input.storeLabel) addParts.push(tlv("03", clip(input.storeLabel, 25)));
  if (input.terminalLabel) addParts.push(tlv("07", clip(input.terminalLabel, 25)));
  if (input.additional) addParts.push(tlv("99", clip(input.additional, 32)));
  const additional = addParts.join("");

  const amountStr = input.amount.toFixed(2);

  let body = "";
  body += tlv("00", "01");                       // Payload format
  body += tlv("01", "12");                       // Dynamic QR (one-time use)
  body += tlv("29", merchant);                   // Bakong individual
  body += tlv("52", "5999");                     // MCC: misc retail
  body += tlv("53", currency);                   // Currency
  body += tlv("54", amountStr);                  // Amount
  body += tlv("58", "KH");                       // Country
  body += tlv("59", clip(input.merchantName, 25));
  body += tlv("60", clip(input.merchantCity, 15));
  if (additional) body += tlv("62", additional);

  // CRC includes the literal "6304" tag/length prefix
  const toHash = `${body}6304`;
  const crc = crc16(toHash);
  return { qr: `${toHash}${crc}` };
}
