// ======================================================
// FULL KHQR / EMVCo Encoder
// Browser + Node.js + Cloudflare Workers Compatible
// Fixed:
// ✅ UTF-8 length support
// ✅ CRC generation
// ✅ Static/Dynamic QR
// ✅ Proper TLV validation
// ✅ Optional MD5 generation
// ✅ KHQR compatible
// ✅ Safe amount formatting
// ✅ Works in Workers runtime
// ======================================================

export type KhqrEncodeInput = {
  // Bakong account
  // Example: ben_sothida@bkrt
  accountId: string;

  // Optional acquiring bank
  acquiringBank?: string;

  // Merchant info
  merchantName: string;
  merchantCity: string;

  // Amount
  amount?: number;

  // Currency
  currency?: "USD" | "KHR";

  // Dynamic QR = true
  // Static QR = false
  dynamic?: boolean;

  // Additional data
  billNumber?: string;
  mobileNumber?: string;
  storeLabel?: string;
  loyaltyNumber?: string;
  reference?: string;
  customerLabel?: string;
  terminalLabel?: string;
  purpose?: string;
  consumerDataRequest?: string;

  // Bakong metadata
  additional?: string;

  // Merchant category
  merchantCategoryCode?: string;

  // Country
  countryCode?: string;
};

export type KhqrEncoded = {
  qr: string;
  crc: string;
  md5?: string;
};

// ======================================================
// UTF8 LENGTH
// ======================================================

function utf8Length(str: string): number {
  return new TextEncoder().encode(str).length;
}

// ======================================================
// TLV BUILDER
// ======================================================

function tlv(tag: string, value: string): string {
  if (!/^\d{2}$/.test(tag)) {
    throw new Error(`Invalid TLV tag: ${tag}`);
  }

  const len = utf8Length(value);

  if (len > 99) {
    throw new Error(`TLV value too long for tag ${tag}`);
  }

  return `${tag}${len.toString().padStart(2, "0")}${value}`;
}

// ======================================================
// CRC16 CCITT-FALSE
// ======================================================

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

// ======================================================
// MD5
// Browser + Workers
// ======================================================

async function md5Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);

  const hashBuffer = await crypto.subtle.digest("MD5", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ======================================================
// HELPERS
// ======================================================

const CURRENCY_CODE: Record<string, string> = {
  USD: "840",
  KHR: "116",
};

function clip(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;

  return value.length > max ? value.slice(0, max) : value;
}

function amountToString(amount?: number): string {
  if (amount === undefined || amount === null) {
    return "";
  }

  if (amount < 0) {
    throw new Error("Amount cannot be negative");
  }

  return amount.toFixed(2);
}

// ======================================================
// BUILD ADDITIONAL DATA
// Tag 62
// ======================================================

function buildAdditionalData(input: KhqrEncodeInput): string {
  const parts: string[] = [];

  if (input.billNumber) {
    parts.push(tlv("01", clip(input.billNumber, 25)!));
  }

  if (input.mobileNumber) {
    parts.push(tlv("02", clip(input.mobileNumber, 25)!));
  }

  if (input.storeLabel) {
    parts.push(tlv("03", clip(input.storeLabel, 25)!));
  }

  if (input.loyaltyNumber) {
    parts.push(tlv("04", clip(input.loyaltyNumber, 25)!));
  }

  if (input.reference) {
    parts.push(tlv("05", clip(input.reference, 25)!));
  }

  if (input.customerLabel) {
    parts.push(tlv("06", clip(input.customerLabel, 25)!));
  }

  if (input.terminalLabel) {
    parts.push(tlv("07", clip(input.terminalLabel, 25)!));
  }

  if (input.purpose) {
    parts.push(tlv("08", clip(input.purpose, 25)!));
  }

  if (input.consumerDataRequest) {
    parts.push(tlv("09", clip(input.consumerDataRequest, 25)!));
  }

  // Bakong metadata
  if (input.additional) {
    parts.push(tlv("99", clip(input.additional, 99)!));
  }

  return parts.join("");
}

// ======================================================
// BUILD MERCHANT ACCOUNT
// Tag 29 = Bakong Individual
// ======================================================

function buildMerchantAccount(input: KhqrEncodeInput): string {
  const parts: string[] = [];

  parts.push(tlv("00", input.accountId));

  if (input.acquiringBank) {
    parts.push(tlv("01", input.acquiringBank));
  }

  return parts.join("");
}

// ======================================================
// MAIN ENCODER
// ======================================================

export async function encodeKhqr(input: KhqrEncodeInput): Promise<KhqrEncoded> {
  if (!input.accountId) {
    throw new Error("accountId is required");
  }

  if (!input.merchantName) {
    throw new Error("merchantName is required");
  }

  if (!input.merchantCity) {
    throw new Error("merchantCity is required");
  }

  const currency = CURRENCY_CODE[input.currency || "KHR"];

  const amount = amountToString(input.amount);

  const merchantAccount = buildMerchantAccount(input);

  const additionalData = buildAdditionalData(input);

  let body = "";

  // Payload format
  body += tlv("00", "01");

  // Point of initiation
  // 11 = static
  // 12 = dynamic
  body += tlv("01", input.dynamic === false ? "11" : "12");

  // Merchant account
  body += tlv("29", merchantAccount);

  // Merchant category code
  body += tlv("52", input.merchantCategoryCode || "5999");

  // Currency
  body += tlv("53", currency);

  // Amount optional
  if (amount) {
    body += tlv("54", amount);
  }

  // Country
  body += tlv("58", input.countryCode || "KH");

  // Merchant name
  body += tlv("59", clip(input.merchantName, 25)!);

  // Merchant city
  body += tlv("60", clip(input.merchantCity, 15)!);

  // Additional data
  if (additionalData) {
    body += tlv("62", additionalData);
  }

  // CRC
  const crcPayload = `${body}6304`;

  const crc = crc16ccitt(crcPayload);

  const qr = `${crcPayload}${crc}`;

  // MD5
  let md5: string | undefined;

  try {
    md5 = await md5Hex(qr);
  } catch {
    // ignore if MD5 unavailable
  }

  return {
    qr,
    crc,
    md5,
  };
}

// ======================================================
// EXAMPLE
// ======================================================

/*
(async () => {
  const result = await encodeKhqr({
    accountId: "ben_sothida@bkrt",
    merchantName: "Dynastore",
    merchantCity: "PHNOM PENH",
    amount: 1.5,
    currency: "USD",
    dynamic: true,
    billNumber: "ORDER-1001",
    storeLabel: "SELLGAME",
    terminalLabel: "POS1",
    additional: "metadata"
  });

  console.log(result);

  OUTPUT:
  {
    qr: "00020101021229....6304ABCD",
    crc: "ABCD",
    md5: "xxxxxxxxxxxxxxxx"
  }
})();
*/
