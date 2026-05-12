// KHQR (Bakong) EMVCo TLV builder + MD5 hash
import { createHash } from "crypto";

const tlv = (id: string, value: string) => {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
};

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type KhqrInput = {
  bakongAccountId: string;     // e.g. yourname@aclb
  merchantName: string;        // <= 25 chars
  merchantCity: string;        // <= 15 chars
  amount: number;              // in KHR or USD depending on currency
  currency: "USD" | "KHR";
  billNumber?: string;
  storeLabel?: string;
};

export function buildKhqr(input: KhqrInput): { payload: string; md5: string } {
  const merchantInfo = tlv("00", "kh.gov.nbc.bakong") + tlv("01", input.bakongAccountId);

  let additional = "";
  if (input.billNumber) additional += tlv("01", input.billNumber.slice(0, 25));
  if (input.storeLabel) additional += tlv("03", input.storeLabel.slice(0, 25));

  const currencyCode = input.currency === "USD" ? "840" : "116";
  const amountStr = input.currency === "USD"
    ? input.amount.toFixed(2)
    : Math.round(input.amount).toString();

  let body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("29", merchantInfo) +
    tlv("52", "5999") +
    tlv("53", currencyCode) +
    tlv("54", amountStr) +
    tlv("58", "KH") +
    tlv("59", input.merchantName.slice(0, 25)) +
    tlv("60", input.merchantCity.slice(0, 15));

  if (additional) body += tlv("62", additional);

  const toCrc = body + "6304";
  const crc = crc16(toCrc);
  const payload = toCrc + crc;
  const md5 = createHash("md5").update(payload).digest("hex");
  return { payload, md5 };
}

const BAKONG_BASE = "https://api-bakong.nbc.gov.kh";

export async function checkBakongMd5(md5: string, token: string): Promise<{
  status: "SUCCESS" | "PENDING" | "FAILED";
  raw: any;
}> {
  const res = await fetch(`${BAKONG_BASE}/v1/check_transaction_by_md5`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ md5 }),
  });
  const raw = await res.json().catch(() => ({}));
  // Bakong response shape: { responseCode: 0|1, responseMessage, data: {...}, errorCode: null|... }
  if (res.ok && raw?.responseCode === 0 && raw?.data) {
    return { status: "SUCCESS", raw };
  }
  // Pending / not found yet
  return { status: "PENDING", raw };
}
