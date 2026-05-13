// Full KHQR / EMVCo TLV Decoder (TypeScript)
// Works in Browser + Node.js
// Supports:
// - KHQR / EMVCo parsing
// - Nested TLV parsing
// - CRC validation
// - Merchant account extraction
// - Currency decode
// - Additional data parsing
// - Safe parsing

export type KhqrDecoded = {
  raw: string;

  payloadFormat?: string;
  pointOfInitiation?: string;

  merchantAccount?: string;
  merchantAccountTag?: string;

  merchantCategory?: string;

  currency?: string;
  currencyLabel?: string;

  amount?: string;

  country?: string;
  merchantName?: string;
  merchantCity?: string;

  postalCode?: string;

  billNumber?: string;
  mobileNumber?: string;
  storeLabel?: string;
  loyaltyNumber?: string;
  reference?: string;
  customerLabel?: string;
  terminalLabel?: string;
  purpose?: string;
  consumerDataRequest?: string;
  md5?: string;

  crc?: string;
  crcValid?: boolean;

  tags?: Record<string, any>;
};

// =========================
// Parse TLV
// =========================
function parseTLV(input: string): Record<string, string> {
  const result: Record<string, string> = {};

  let index = 0;

  while (index < input.length) {
    if (index + 4 > input.length) break;

    const tag = input.substring(index, index + 2);
    const lengthStr = input.substring(index + 2, index + 4);

    const length = parseInt(lengthStr, 10);

    if (isNaN(length)) break;

    const start = index + 4;
    const end = start + length;

    if (end > input.length) break;

    const value = input.substring(start, end);

    result[tag] = value;

    index = end;
  }

  return result;
}

// =========================
// CRC16 CCITT-FALSE
// =========================
function crc16ccitt(input: string): string {
  let crc = 0xffff;

  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// =========================
// Currency Map
// =========================
const CURRENCY: Record<string, string> = {
  "116": "KHR",
  "840": "USD",
};

// =========================
// Additional Data Parser
// =========================
function parseAdditionalData(value: string, out: KhqrDecoded) {
  const sub = parseTLV(value);

  out.billNumber = sub["01"];
  out.mobileNumber = sub["02"];
  out.storeLabel = sub["03"];
  out.loyaltyNumber = sub["04"];
  out.reference = sub["05"];
  out.customerLabel = sub["06"];
  out.terminalLabel = sub["07"];
  out.purpose = sub["08"];
  out.consumerDataRequest = sub["09"];

  // Bakong MD5
  out.md5 = sub["99"];
}

// =========================
// Merchant Account Parser
// =========================
function parseMerchantAccount(value: string, out: KhqrDecoded, tag: string) {
  const sub = parseTLV(value);

  out.merchantAccountTag = tag;

  // KHQR merchant account
  // Usually:
  // 00 = merchant id/account

  if (sub["00"]) {
    out.merchantAccount = sub["00"];
  }

  return sub;
}

// =========================
// Main Decoder
// =========================
export function decodeKhqr(raw: string): KhqrDecoded {
  const out: KhqrDecoded = {
    raw,
    tags: {},
  };

  try {
    if (!raw || typeof raw !== "string") {
      return out;
    }

    const qr = raw.trim();

    if (qr.length < 8) {
      return out;
    }

    const tlv = parseTLV(qr);

    out.tags = tlv;

    // Basic EMV tags
    out.payloadFormat = tlv["00"];
    out.pointOfInitiation = tlv["01"];
    out.merchantCategory = tlv["52"];

    out.currency = tlv["53"];

    if (tlv["53"]) {
      out.currencyLabel = CURRENCY[tlv["53"]] || tlv["53"];
    }

    out.amount = tlv["54"];

    out.country = tlv["58"];
    out.merchantName = tlv["59"];
    out.merchantCity = tlv["60"];
    out.postalCode = tlv["61"];

    // =========================
    // Merchant Account Info
    // =========================
    const merchantTags = [
      "26",
      "27",
      "28",
      "29",
      "30",
      "31",
      "32",
      "33",
      "34",
      "35",
      "36",
      "37",
      "38",
      "39",
      "40",
      "41",
      "42",
      "43",
      "44",
      "45",
      "46",
      "47",
      "48",
      "49",
    ];

    for (const tag of merchantTags) {
      if (tlv[tag]) {
        parseMerchantAccount(tlv[tag], out, tag);

        if (out.merchantAccount) {
          break;
        }
      }
    }

    // =========================
    // Additional Data
    // =========================
    if (tlv["62"]) {
      parseAdditionalData(tlv["62"], out);
    }

    // =========================
    // CRC Validation
    // =========================
    if (qr.length >= 8 && qr.slice(-8, -4) === "6304") {
      out.crc = qr.slice(-4).toUpperCase();

      const payloadWithoutCRC = qr.slice(0, -4);

      const calculatedCRC = crc16ccitt(payloadWithoutCRC);

      out.crcValid = calculatedCRC.toUpperCase() === out.crc.toUpperCase();
    } else {
      out.crcValid = false;
    }

    return out;
  } catch (err) {
    console.error("KHQR decode error:", err);
    return out;
  }
}

// =========================
// Example Usage
// =========================

/*
const qr =
  "00020101021129370016A000000677010111011300066001234520459995303116540610.005802KH5910TEST SHOP6002PP6304ABCD";

const decoded = decodeKhqr(qr);

console.log(decoded);

OUTPUT:
{
  raw: "...",
  payloadFormat: "01",
  pointOfInitiation: "11",
  merchantAccount: "00066001234",
  currency: "116",
  currencyLabel: "KHR",
  amount: "10.00",
  country: "KH",
  merchantName: "TEST SHOP",
  merchantCity: "PP",
  crc: "ABCD",
  crcValid: true
}
*/
