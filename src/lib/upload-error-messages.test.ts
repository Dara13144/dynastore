import { describe, it, expect } from "vitest";
import {
  formatBytes,
  friendlyUploadError,
  oversizeForBucketMessage,
} from "./upload-error-messages";
import { validateGameFile, MAX_GAME_FILE_BYTES } from "./validate-game-file";

const ONE_GB = 1024 * 1024 * 1024;

describe("formatBytes — exact units", () => {
  it("formats GB with 2 decimals", () => {
    expect(formatBytes(5 * ONE_GB)).toBe("5.00GB");
    expect(formatBytes(7.25 * ONE_GB)).toBe("7.25GB");
  });
  it("formats MB with 1 decimal", () => {
    expect(formatBytes(500 * 1024 * 1024)).toBe("500.0MB");
  });
});

describe("oversize messages — exact Khmer text", () => {
  it("validateGameFile rejects > 1000GB with the static-cap message", () => {
    const big = { name: "huge.zip", size: 1001 * ONE_GB };
    expect(validateGameFile(big)).toBe("ឯកសារធំពេក — អតិបរមា 1000GB");
  });

  it("validateGameFile rejects files under 1MB with the min-size message", () => {
    const small = { name: "tiny.zip", size: 500 * 1024 }; // 0.5 MB
    expect(validateGameFile(small)).toBe(
      "ឯកសារតូចពេក (0.49MB) — តម្រូវយ៉ាងតិច 1MB",
    );
  });

  it("oversizeForBucketMessage embeds both file size and effective max", () => {
    const fileSize = 2 * ONE_GB;
    const max = ONE_GB;
    expect(oversizeForBucketMessage(fileSize, max)).toBe(
      'ឯកសារធំជាងដែនកំណត់ម៉ាស៊ីន (2.00GB > 1.00GB) — សូមបំបែកជា part តូចជាង',
    );
  });

  it("oversize message uses GB units at multi-GB scale, MB at MB scale", () => {
    expect(oversizeForBucketMessage(750 * 1024 * 1024, 500 * 1024 * 1024)).toBe(
      "ឯកសារធំជាងដែនកំណត់ម៉ាស៊ីន (750.0MB > 500.0MB) — សូមបំបែកជា part តូចជាង",
    );
  });
});

describe("friendlyUploadError — TUS flow failures with exact Khmer text", () => {
  it("413 Maximum size exceeded includes bucket limit + remediation", () => {
    const raw =
      "tus: unexpected response while creating upload, originated from request (method: POST, url: https://x.supabase.co/storage/v1/upload/resumable, response code: 413, response text: Maximum size exceeded , request id: n/a)";
    const out = friendlyUploadError(raw, {
      fileSize: 7 * ONE_GB,
      bucketLimitBytes: 5 * ONE_GB,
    });
    expect(out).toBe(
      'ឯកសារ 7.00GB លើសដែនកំណត់ bucket (5.00GB) — សូមបង្កើនដែនកំណត់ bucket "game-files" នៅក្នុង Lovable Cloud → Storage, ឬបំបែកឯកសារជា part តូចជាង',
    );
  });

  it('413 falls back to "ដែនកំណត់ម៉ាស៊ីន" when bucket limit is unknown', () => {
    const out = friendlyUploadError("413 Payload Too Large", {
      fileSize: 4 * ONE_GB,
      bucketLimitBytes: null,
    });
    expect(out).toBe(
      'ឯកសារ 4.00GB លើសដែនកំណត់ម៉ាស៊ីន — សូមបង្កើនដែនកំណត់ bucket "game-files" នៅក្នុង Lovable Cloud → Storage, ឬបំបែកឯកសារជា part តូចជាង',
    );
  });

  it("413 without file size omits the size phrase but keeps remediation", () => {
    const out = friendlyUploadError("entity too large", {
      bucketLimitBytes: 2 * ONE_GB,
    });
    expect(out).toBe(
      'ឯកសារ លើសដែនកំណត់ bucket (2.00GB) — សូមបង្កើនដែនកំណត់ bucket "game-files" នៅក្នុង Lovable Cloud → Storage, ឬបំបែកឯកសារជា part តូចជាង',
    );
  });

  it('"failed to fetch" → connection-lost message', () => {
    expect(friendlyUploadError("TypeError: Failed to fetch")).toBe(
      "ការតភ្ជាប់បណ្ដាញដាច់ — សូមព្យាយាមម្ដងទៀត",
    );
  });

  it("ECONNRESET also maps to the connection-lost message", () => {
    expect(friendlyUploadError("read ECONNRESET")).toBe(
      "ការតភ្ជាប់បណ្ដាញដាច់ — សូមព្យាយាមម្ដងទៀត",
    );
  });

  it('"network error" also maps to the connection-lost message', () => {
    expect(friendlyUploadError("Network error: socket hang up")).toBe(
      "ការតភ្ជាប់បណ្ដាញដាច់ — សូមព្យាយាមម្ដងទៀត",
    );
  });

  it("timeouts → timeout message", () => {
    expect(friendlyUploadError("Request timeout")).toBe(
      "Upload អស់ពេល — សូមព្យាយាមម្ដងទៀតជាមួយបណ្ដាញលឿនជាង",
    );
    expect(friendlyUploadError("ETIMEDOUT")).toBe(
      "Upload អស់ពេល — សូមព្យាយាមម្ដងទៀតជាមួយបណ្ដាញលឿនជាង",
    );
  });

  it("401 / JWT → re-login message", () => {
    expect(friendlyUploadError("401 Unauthorized")).toBe(
      "សិទ្ធិផុតកំណត់ — សូមចូលគណនីឡើងវិញ",
    );
    expect(friendlyUploadError("JWT expired")).toBe(
      "សិទ្ធិផុតកំណត់ — សូមចូលគណនីឡើងវិញ",
    );
  });

  it("403 → admin-role message", () => {
    expect(friendlyUploadError("403 Forbidden")).toBe(
      "មិនមានសិទ្ធិ upload — ត្រូវការ admin role",
    );
  });

  it("507 / quota → contact-admin message", () => {
    expect(friendlyUploadError("507 storage quota exceeded")).toBe(
      "ទំហំផ្ទុកមិនគ្រប់ — សូមទាក់ទង admin",
    );
  });

  it("unknown errors fall through as-is", () => {
    expect(friendlyUploadError("kaboom: something weird")).toBe(
      "kaboom: something weird",
    );
  });

  it("static 1000GB max is the hard ceiling regardless of bucket", () => {
    // Sanity-check the constant the user-facing message refers to.
    expect(MAX_GAME_FILE_BYTES).toBe(1000 * ONE_GB);
  });
});
