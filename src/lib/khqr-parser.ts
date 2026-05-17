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
  "00": 'Globally Unique Identifier (must be "kh.gov.nbc.bakong")',
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

function parseTlvs(
  payload: string,
  nameMap: Record<string, string>,
): { tags: TlvTag[]; errors: string[] } {
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
      errors.push(
        `Tag ${id} declares length ${length} but only ${payload.length - i - 4} chars remain`,
      );
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
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function parseKhqr(input: string): KhqrParseResult {
  const payload = input.trim();
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!payload) {
    return {
      ok: false,
      tags: [],
      crc: { declared: null, computed: "", valid: false },
      warnings,
      errors: ["Empty payload"],
      recommendations: [],
    };
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
      errors.push(
        `CRC mismatch: declared ${declared}, computed ${computed}. Recompute CRC over the entire payload incl. "6304".`,
      );
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
      tag.warnings.push(
        `Point of Initiation must be "11" (static) or "12" (dynamic) — got "${tag.value}"`,
      );
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
        tag.warnings.push(
          'Missing subtag 00 (GUID) — must be "kh.gov.nbc.bakong" — banks will reject (Q0626)',
        );
      } else if (guid.value !== "kh.gov.nbc.bakong") {
        tag.warnings.push(
          `Subtag 00 must be "kh.gov.nbc.bakong" — got "${guid.value}". This causes Q0626 on ABA/ACLEDA.`,
        );
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
    if (!tags.find((t) => t.id === id))
      errors.push(`Missing required root tag ${id} (${ROOT_NAMES[id]})`);
  }
  if (!tags.find((t) => t.id === "29" || t.id === "30")) {
    errors.push("Missing merchant account info — need tag 29 (individual) or 30 (merchant)");
  }

  const recommendations = buildRecommendations(
    tags,
    { declared, computed, valid: crcValid },
    errors,
  );

  return {
    ok: errors.length === 0 && crcValid,
    tags,
    crc: { declared, computed, valid: crcValid },
    warnings,
    errors,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// Targeted fix recommendations — map detected tag issues to exact corrections.
// ---------------------------------------------------------------------------
function buildRecommendations(
  tags: TlvTag[],
  crc: { declared: string | null; computed: string; valid: boolean },
  errors: string[],
): FixRecommendation[] {
  const recs: FixRecommendation[] = [];
  const find = (id: string) => tags.find((t) => t.id === id);

  // --- Tag 29 / 30: Bakong Merchant Account Info (Q0626 root cause) ---
  const mai = find("29") ?? find("30");
  if (!mai) {
    recs.push({
      code: "Q0626",
      severity: "critical",
      title: "Missing Bakong merchant account info",
      why: "Without tag 29 (individual) or 30 (merchant) the QR has no Bakong routing target, so ABA/ACLEDA cannot resolve the payee and return Q0626.",
      field: "root tag 29 or 30",
      current: "missing",
      expected: 'tlv("29", tlv("00","kh.gov.nbc.bakong") + tlv("01","<account>@aclb"))',
      fix: "Add a tag 29 template before tag 52 (MCC). Use tag 30 only for registered merchants.",
    });
  } else {
    const sub = mai.children ?? [];
    const guid = sub.find((t) => t.id === "00");
    const acct = sub.find((t) => t.id === "01");

    if (!guid) {
      recs.push({
        code: "Q0626",
        severity: "critical",
        title: `Tag ${mai.id} is missing subtag 00 (GUID)`,
        why: "Banks identify the Bakong scheme by GUID. With no subtag 00, the QR is treated as an unknown scheme and rejected with Q0626.",
        field: `tag ${mai.id} → subtag 00`,
        current: "missing",
        expected: '"kh.gov.nbc.bakong"',
        fix: `Prepend tlv("00", "kh.gov.nbc.bakong") to the value of tag ${mai.id} before subtag 01.`,
      });
    } else if (guid.value !== "kh.gov.nbc.bakong") {
      recs.push({
        code: "Q0626",
        severity: "critical",
        title: `Tag ${mai.id} subtag 00 has the wrong GUID`,
        why: 'ABA/ACLEDA only accept the literal string "kh.gov.nbc.bakong" as the Bakong scheme identifier. Any other value (including putting the account ID here) causes Q0626.',
        field: `tag ${mai.id} → subtag 00`,
        current: JSON.stringify(guid.value),
        expected: '"kh.gov.nbc.bakong"',
        fix: `Replace subtag 00 with tlv("00", "kh.gov.nbc.bakong"). If the current value looks like "user@aclb", you swapped subtags 00 and 01 — move it into subtag 01.`,
      });
    }

    if (!acct) {
      recs.push({
        code: "Q0626",
        severity: "critical",
        title: `Tag ${mai.id} is missing subtag 01 (account ID)`,
        why: "Subtag 01 carries the Bakong account that receives the funds. Without it, no destination wallet can be resolved.",
        field: `tag ${mai.id} → subtag 01`,
        current: "missing",
        expected: '"<username>@aclb" (or @<bank suffix>)',
        fix: `Append tlv("01", BAKONG_ACCOUNT_ID) after subtag 00.`,
      });
    } else if (!/^[a-z0-9_.-]+@[a-z]+$/i.test(acct.value)) {
      recs.push({
        code: "Q0626",
        severity: "high",
        title: `Tag ${mai.id} subtag 01 is not a valid Bakong account ID`,
        why: 'Bakong account IDs must look like "username@bank" (e.g. ben_sothida@aclb). Bare names, emails, or phone numbers fail directory lookup.',
        field: `tag ${mai.id} → subtag 01`,
        current: JSON.stringify(acct.value),
        expected: '"<username>@<bank-suffix>"  e.g. "ben_sothida@aclb"',
        fix: "Set BAKONG_ACCOUNT_ID to the value shown in your Bakong developer dashboard (it always contains an @).",
      });
    }
  }

  // --- CRC ---
  if (!crc.valid) {
    recs.push({
      code: "CRC",
      severity: "critical",
      title: "CRC16 checksum is wrong",
      why: 'Every scanner recomputes CRC16-CCITT over the entire payload up to and including "6304". A mismatch is the first thing rejected — usually before Q0626 is even reached.',
      field: 'tag 63 (last 4 hex chars after "6304")',
      current: crc.declared ?? "missing",
      expected: crc.computed || "(payload too short to compute)",
      fix: 'Recompute CRC16-CCITT (poly 0x1021, init 0xFFFF) on payload + "6304", uppercase, zero-pad to 4 hex chars, then append.',
    });
  }

  // --- Required root tags ---
  const requiredFixes: Record<string, { expected: string; fix: string; why: string }> = {
    "00": {
      expected: '"01"',
      fix: 'Prepend tlv("00", "01") as the first tag.',
      why: "Payload Format Indicator is mandatory and must be 01.",
    },
    "01": {
      expected: '"11" (static) or "12" (dynamic)',
      fix: 'Add tlv("01", "12") for amount-bearing QRs, "11" for reusable QRs.',
      why: "Banks need to know whether the QR is reusable.",
    },
    "52": {
      expected: '4-digit MCC, e.g. "5999"',
      fix: 'Add tlv("52", "5999") before tag 53.',
      why: "Merchant Category Code is required by EMVCo.",
    },
    "53": {
      expected: '"840" (USD) or "116" (KHR)',
      fix: 'Add tlv("53", "840") for USD.',
      why: "Transaction currency is required.",
    },
    "58": {
      expected: '"KH"',
      fix: 'Add tlv("58", "KH").',
      why: "Country code must be KH for KHQR.",
    },
    "59": {
      expected: "merchant name (≤25 chars)",
      fix: 'Add tlv("59", BAKONG_MERCHANT_NAME).',
      why: "Merchant name shown in the payer's bank app.",
    },
    "60": {
      expected: "merchant city (≤15 chars)",
      fix: 'Add tlv("60", "Phnom Penh").',
      why: "Merchant city is required.",
    },
  };
  for (const [id, spec] of Object.entries(requiredFixes)) {
    if (!find(id)) {
      recs.push({
        code: "STRUCTURE",
        severity: "high",
        title: `Missing required root tag ${id} (${ROOT_NAMES[id]})`,
        why: spec.why,
        field: `root tag ${id}`,
        current: "missing",
        expected: spec.expected,
        fix: spec.fix,
      });
    }
  }

  // --- Format checks on present tags ---
  const fmt = find("00");
  if (fmt && fmt.value !== "01") {
    recs.push({
      code: "FORMAT",
      severity: "high",
      title: 'Payload Format Indicator must be "01"',
      why: 'EMVCo requires tag 00 = "01". Any other value is rejected before Bakong routing.',
      field: "root tag 00",
      current: JSON.stringify(fmt.value),
      expected: '"01"',
      fix: 'Use tlv("00", "01").',
    });
  }
  const country = find("58");
  if (country && country.value !== "KH") {
    recs.push({
      code: "FORMAT",
      severity: "high",
      title: 'Country code must be "KH"',
      why: "KHQR is the Cambodian scheme; non-KH country codes route to non-Bakong rails and fail.",
      field: "root tag 58",
      current: JSON.stringify(country.value),
      expected: '"KH"',
      fix: 'Use tlv("58", "KH").',
    });
  }
  const ccy = find("53");
  if (ccy && ccy.value !== "840" && ccy.value !== "116") {
    recs.push({
      code: "FORMAT",
      severity: "high",
      title: "Currency must be USD (840) or KHR (116)",
      why: "Bakong only settles in USD or KHR. Other ISO 4217 codes are rejected.",
      field: "root tag 53",
      current: JSON.stringify(ccy.value),
      expected: '"840" or "116"',
      fix: 'Use tlv("53", "840") for USD.',
    });
  }

  // --- Truncation / TLV parse errors ---
  if (errors.some((e) => e.startsWith("Truncated") || e.includes("declares length"))) {
    recs.push({
      code: "STRUCTURE",
      severity: "critical",
      title: "Payload is truncated or has a wrong length byte",
      why: "EMVCo parsers walk the payload by reading id(2) + len(2) + value(len). One wrong length cascades and the rest of the QR is unreadable.",
      field: "see Errors list above",
      current: "length mismatch",
      expected: "id + 2-digit length + value of exactly that many chars",
      fix: "Rebuild the offending TLV using a helper like tlv(id, val) = id + String(val.length).padStart(2,'0') + val.",
    });
  }

  return recs;
}
