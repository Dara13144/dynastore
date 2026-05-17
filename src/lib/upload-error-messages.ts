// User-facing upload error messages (Khmer). Pure functions so they can be
// asserted in tests without rendering the admin route.

export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)}GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)}MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${n}B`;
}

export interface FriendlyErrorContext {
  fileSize?: number;
  bucketLimitBytes?: number | null;
}

/**
 * Map a raw upload error string (from Supabase Storage, TUS, or fetch) to a
 * friendly Khmer message. When the underlying cause is a 413 / "Maximum size
 * exceeded" the message includes the configured bucket limit and remediation.
 */
export function friendlyUploadError(raw: string, ctx: FriendlyErrorContext = {}): string {
  const m = raw.toLowerCase();
  if (m.includes("network") || m.includes("failed to fetch") || m.includes("econnreset"))
    return "ការតភ្ជាប់បណ្ដាញដាច់ — សូមព្យាយាមម្ដងទៀត";
  if (m.includes("timeout") || m.includes("etimedout"))
    return "Upload អស់ពេល — សូមព្យាយាមម្ដងទៀតជាមួយបណ្ដាញលឿនជាង";
  if (m.includes("401") || m.includes("unauthorized") || m.includes("jwt"))
    return "សិទ្ធិផុតកំណត់ — សូមចូលគណនីឡើងវិញ";
  if (m.includes("403") || m.includes("forbidden"))
    return "មិនមានសិទ្ធិ upload — ត្រូវការ admin role";
  if (
    m.includes("413") ||
    m.includes("payload too large") ||
    m.includes("entity too large") ||
    m.includes("maximum size exceeded")
  ) {
    const limit = ctx.bucketLimitBytes;
    const sizePart = ctx.fileSize ? `ឯកសារ ${formatBytes(ctx.fileSize)}` : "ឯកសារ";
    const limitPart = limit
      ? `លើសដែនកំណត់ bucket (${formatBytes(limit)})`
      : "លើសដែនកំណត់ម៉ាស៊ីន";
    return `${sizePart} ${limitPart} — សូមបង្កើនដែនកំណត់ bucket "game-files" នៅក្នុង Lovable Cloud → Storage, ឬបំបែកឯកសារជា part តូចជាង`;
  }
  if (m.includes("507") || m.includes("storage") || m.includes("quota"))
    return "ទំហំផ្ទុកមិនគ្រប់ — សូមទាក់ទង admin";
  return raw;
}

/** Oversize message produced by the admin file picker when a file exceeds the
 *  live effective bucket limit (and would 413 if sent). */
export function oversizeForBucketMessage(fileSize: number, effectiveMaxBytes: number): string {
  return `ឯកសារធំជាងដែនកំណត់ម៉ាស៊ីន (${formatBytes(fileSize)} > ${formatBytes(effectiveMaxBytes)}) — សូមបំបែកជា part តូចជាង`;
}
