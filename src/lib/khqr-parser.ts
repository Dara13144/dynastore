// Client-safe EMVCo TLV parser for KHQR payloads.
// Pure string parsing — no Node/server imports — usable in any component.

export type TlvTag = {
  id: string;
  length: number;
  value: string;
  name: string;
  /** Pretty-printed subtags for nested templates (29, 30, 62, etc.) */
  children?: TlvTag[];
  /** Soft warnings flagged during parse (length mismatch, unknown subtag, etc.) */
  warnings: string[];
};

export type FixRecommendation = {
  /** Q0626 / CRC / STRUCTURE / FORMAT */
  code: string;
  /** Short headline shown as the recommendation title */
  title: string;
  /** Plain-English explanation of why banks reject this */
  why: string;
  /** Exact field path that is wrong, e.g. "tag 29 → subtag 00" */
  field: string;
  /** What the value currently is (may be empty / "missing") */
  current: string;
  /** What the value MUST be set to */
  expected: string;
  /** Concrete code/builder change to apply */
  fix: string;
  severity: "critical" | "high" | "medium";
};

export type KhqrParseResult = {
  ok: boolean;
  tags: TlvTag[];
  crc: {
    declared: string | null;
    computed: string;
    valid: boolean;
  };
  warnings: string[];
  errors: string[];
  recommendations: FixRecommendation[];
};

// Root EMV tags relevant to KHQR
const ROOT_NAMES: Record<string, string> = {
  "00": "Payload Format Indicator",
  "01": "Point of Initiation Method (11=static, 12=dynamic)",
  "29": "Merchant Account Information — Bakong (individual)",
  "30": "Merchant Account Information — Bakong (merchant)",
  "52": "Merchant Category Code (MCC)",
  "53": "Transaction Currency (840=USD, 116=KHR)",
  "54": "Transaction Amount",
  "58": "Country Code",
  "59": "Merchant Name",
  "60": "Merchant City",
  "62": "Additional Data Field Template",
  "63": "CRC",
  "64": "Merchant Information — Language Template",
};

// Subtags inside tag 29 / 30 (Bakong account templates)
const BAKONG_MAI_NAMES: Record<string, string> = {
  "00": "Globally Unique Identifier (must be \"kh.gov.nbc.bakong\")",
  "01": "Bakong Account ID (e.g. username@aclb)",
  "02": "Acquiring Bank",
  "03": "Merchant ID",
  "04": "Account Type",
  "05": "Currency",
};

// Subtags inside tag 62 (Additional Data)
const ADDITIONAL_DATA_NAMES: Record<string, string> = {
  "01": "Bill Number",
  "02": "Mobile Number",
  "03": "Store Label",
  "04": "Loyalty Number",
  "05": "Reference Label",
  "06": "Customer Label",
  "07": "Terminal Label",
  "08": "Purpose of Transaction",
  "09": "Additional Consumer Data Request",
  "99": "Merchant Tax ID / extra",
};

function parseTlvs(payload: string, nameMap: Record<string, string>): { tags: TlvTag[]; errors: string[] } {
  const tags: TlvTag[] = [];
  const errors: string[] = [];
  let i = 0;
  while (i < payload.length) {
    if (i + 4 > payload.length) {
      errors.push(`Truncated TLV header at offset ${i}: "${payload.slice(i)}"`);
      break;
    }
    const id = payload.slice(i, i + 2);
    const lenStr = payload.slice(i + 2, i + 4);
    const length = Number(lenStr);
    if (!/^\d{2}$/.test(lenStr) || Number.isNaN(length)) {
      errors.push(`Invalid length "${lenStr}" for tag ${id} at offset ${i + 2}`);
      break;
    }
    if (i + 4 + length > payload.length) {
      errors.push(`Tag ${id} declares length ${length} but only ${payload.length - i - 4} chars remain`);
      break;
    }
    const value = payload.slice(i + 4, i + 4 + length);
    const tag: TlvTag = {
      id,
      length,
      value,
      name: nameMap[id] ?? "(unknown / RFU)",
      warnings: [],
    };
    if (!nameMap[id]) tag.warnings.push("Unknown tag — may be RFU or a banking extension");
    tags.push(tag);
    i += 4 + length;
  }
  return { tags, errors };
}

// CRC16-CCITT (poly 0x1021, init 0xFFFF) — same as the builder
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

export function parseKhqr(input: string): KhqrParseResult {
  const payload = input.trim();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!payload) {
    return { ok: false, tags: [], crc: { declared: null, computed: "", valid: false }, warnings, errors: ["Empty payload"], recommendations: [] };
  }

  // CRC is tag 6304 + 4-char hex at the end
  const crcIdx = payload.lastIndexOf("6304");
  let declared: string | null = null;
  let computed = "";
  let crcValid = false;
  if (crcIdx === -1 || crcIdx !== payload.length - 8) {
    errors.push("CRC tag (6304) not found at end of payload — KHQR will be rejected by all banks");
  } else {
    declared = payload.slice(payload.length - 4);
    computed = crc16(payload.slice(0, payload.length - 4));
    crcValid = declared.toUpperCase() === computed.toUpperCase();
    if (!crcValid) {
      errors.push(`CRC mismatch: declared ${declared}, computed ${computed}. Recompute CRC over the entire payload incl. "6304".`);
    }
  }

  const { tags, errors: parseErrors } = parseTlvs(payload, ROOT_NAMES);
  errors.push(...parseErrors);

  // Validate each root tag and parse known nested ones
  for (const tag of tags) {
    if (tag.id === "00" && tag.value !== "01") {
      tag.warnings.push(`Payload Format Indicator must be "01" — got "${tag.value}"`);
    }
    if (tag.id === "01" && tag.value !== "11" && tag.value !== "12") {
      tag.warnings.push(`Point of Initiation must be "11" (static) or "12" (dynamic) — got "${tag.value}"`);
    }
    if (tag.id === "58" && tag.value !== "KH") {
      tag.warnings.push(`Country code should be "KH" for KHQR — got "${tag.value}"`);
    }
    if (tag.id === "53" && tag.value !== "840" && tag.value !== "116") {
      tag.warnings.push(`Currency must be "840" (USD) or "116" (KHR) — got "${tag.value}"`);
    }
    if (tag.id === "29" || tag.id === "30") {
      const sub = parseTlvs(tag.value, BAKONG_MAI_NAMES);
      tag.children = sub.tags;
      errors.push(...sub.errors.map((e) => `Inside tag ${tag.id}: ${e}`));
      const guid = sub.tags.find((t) => t.id === "00");
      const accountId = sub.tags.find((t) => t.id === "01");
      if (!guid) {
        tag.warnings.push("Missing subtag 00 (GUID) — must be \"kh.gov.nbc.bakong\" — banks will reject (Q0626)");
      } else if (guid.value !== "kh.gov.nbc.bakong") {
        tag.warnings.push(`Subtag 00 must be "kh.gov.nbc.bakong" — got "${guid.value}". This causes Q0626 on ABA/ACLEDA.`);
      }
      if (!accountId) {
        tag.warnings.push("Missing subtag 01 (Bakong account ID) — required");
      } else if (!/^[a-z0-9_.-]+@[a-z]+$/i.test(accountId.value)) {
        tag.warnings.push(`Subtag 01 should look like "username@aclb" — got "${accountId.value}"`);
      }
    }
    if (tag.id === "62") {
      const sub = parseTlvs(tag.value, ADDITIONAL_DATA_NAMES);
      tag.children = sub.tags;
      errors.push(...sub.errors.map((e) => `Inside tag 62: ${e}`));
    }
  }

  // Required root tags
  const required = ["00", "01", "52", "53", "58", "59", "60", "63"];
  for (const id of required) {
    if (!tags.find((t) => t.id === id)) errors.push(`Missing required root tag ${id} (${ROOT_NAMES[id]})`);
  }
  if (!tags.find((t) => t.id === "29" || t.id === "30")) {
    errors.push("Missing merchant account info — need tag 29 (individual) or 30 (merchant)");
  }

  return {
    ok: errors.length === 0 && crcValid,
    tags,
    crc: { declared, computed, valid: crcValid },
    warnings,
    errors,
  };
}
