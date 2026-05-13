// Minimal EMVCo / KHQR TLV decoder — runs in the browser.
// Returns parsed merchant account, amount, currency, order id, CRC, etc.

export type KhqrDecoded = {
  raw: string;
  payloadFormat?: string;
  pointOfInitiation?: string;
  merchantAccount?: string; // e.g. ben_sothida@bkrt
  merchantCategory?: string;
  currency?: string;        // ISO 4217 numeric (840=USD, 116=KHR)
  currencyLabel?: string;   // "USD" / "KHR"
  amount?: string;
  country?: string;
  merchantName?: string;
  merchantCity?: string;
  billNumber?: string;      // 62/01 — order id
  reference?: string;       // 62/05
  md5?: string;             // 62/99 — bakong md5 (additional data)
  crc?: string;
  crcValid?: boolean;
};

function parseTLV(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = parseInt(s.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len)) break;
    const val = s.slice(i + 4, i + 4 + len);
    out[tag] = val;
    i += 4 + len;
  }
  return out;
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF)
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

const CURRENCY: Record<string, string> = { "840": "USD", "116": "KHR" };

export function decodeKhqr(raw: string): KhqrDecoded {
  const out: KhqrDecoded = { raw };
  if (!raw || raw.length < 8) return out;
  const tlv = parseTLV(raw);
  out.payloadFormat = tlv["00"];
  out.pointOfInitiation = tlv["01"];
  out.merchantCategory = tlv["52"];
  out.currency = tlv["53"];
  out.currencyLabel = tlv["53"] ? CURRENCY[tlv["53"]] ?? tlv["53"] : undefined;
  out.amount = tlv["54"];
  out.country = tlv["58"];
  out.merchantName = tlv["59"];
  out.merchantCity = tlv["60"];

  // Merchant account: try 29 (Bakong individual) first, then 30
  for (const t of ["29", "30", "31"]) {
    if (tlv[t]) {
      const sub = parseTLV(tlv[t]);
      if (sub["00"]) { out.merchantAccount = sub["00"]; break; }
    }
  }

  if (tlv["62"]) {
    const sub = parseTLV(tlv["62"]);
    out.billNumber = sub["01"];
    out.reference = sub["05"];
    out.md5 = sub["99"];
  }

  // CRC: last 8 chars are "6304XXXX"
  if (raw.length >= 8 && raw.slice(-8, -4) === "6304") {
    out.crc = raw.slice(-4);
    const expected = crc16(raw.slice(0, -4));
    out.crcValid = expected.toUpperCase() === out.crc.toUpperCase();
  }
  return out;
}
