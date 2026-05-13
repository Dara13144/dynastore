// EMVCo / KHQR (Bakong) QR string encoder.
// Builds an Individual KHQR with dynamic amount in USD.

function tlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) used by KHQR
function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface KHQRParams {
  bakongAccountID: string;          // e.g. "user@bank"
  merchantName: string;             // <= 25 chars
  merchantCity: string;             // <= 15 chars
  amountUSD: number;
  merchantPhone?: string;           // optional, in additional data field
  acquiringBank?: string;           // optional issuer
  storeLabel?: string;
  terminalLabel?: string;
}

export function buildKHQR(p: KHQRParams): string {
  // 00 — Payload format indicator
  const f00 = tlv("00", "01");
  // 01 — Point of initiation: 12 = dynamic
  const f01 = tlv("01", "12");

  // 29 — Merchant account info (Individual). Sub-fields:
  //   00 = Bakong account id
  //   01 = acquiring bank (optional)
  let mai = tlv("00", p.bakongAccountID);
  if (p.acquiringBank) mai += tlv("01", p.acquiringBank);
  const f29 = tlv("29", mai);

  // 52 — Merchant Category Code (5999 = misc retail)
  const f52 = tlv("52", "5999");
  // 53 — Currency: 840 = USD
  const f53 = tlv("53", "840");
  // 54 — Transaction amount
  const f54 = tlv("54", p.amountUSD.toFixed(2));
  // 58 — Country
  const f58 = tlv("58", "KH");
  // 59 — Merchant name (<=25)
  const f59 = tlv("59", p.merchantName.slice(0, 25));
  // 60 — Merchant city (<=15)
  const f60 = tlv("60", p.merchantCity.slice(0, 15));

  // 62 — Additional data (optional store/terminal/phone)
  let add = "";
  if (p.storeLabel) add += tlv("03", p.storeLabel);
  if (p.terminalLabel) add += tlv("07", p.terminalLabel);
  if (p.merchantPhone) add += tlv("01", p.merchantPhone);
  const f62 = add ? tlv("62", add) : "";

  // 99 — Optional unique merchant transaction id (kept empty)
  const partial = `${f00}${f01}${f29}${f52}${f53}${f54}${f58}${f59}${f60}${f62}` + "6304";
  const crc = crc16(partial);
  return partial + crc;
}
