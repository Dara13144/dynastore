// Game archive upload validation — shared between admin UI and tests.
export const ALLOWED_GAME_FILE_EXTS = [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"] as const;
export const MIN_GAME_FILE_MB = 1000;
export const MAX_GAME_FILE_MB = 5000;
export const MIN_GAME_FILE_BYTES = MIN_GAME_FILE_MB * 1024 * 1024;
export const MAX_GAME_FILE_BYTES = MAX_GAME_FILE_MB * 1024 * 1024;

export function validateGameFile(file: { name: string; size: number }): string | null {
  if (file.size <= 0) return "ឯកសារទទេ";
  const name = file.name.toLowerCase();
  const ok = ALLOWED_GAME_FILE_EXTS.some((ext) => name.endsWith(ext));
  if (!ok) return `ប្រភេទឯកសារមិនអនុញ្ញាត — តម្រូវ ${ALLOWED_GAME_FILE_EXTS.join(", ")}`;
  const mb = file.size / 1024 / 1024;
  if (file.size < MIN_GAME_FILE_BYTES) return `ឯកសារតូចពេក (${mb.toFixed(1)}MB) — តម្រូវយ៉ាងតិច ${MIN_GAME_FILE_MB}MB`;
  if (file.size > MAX_GAME_FILE_BYTES) return `ឯកសារធំពេក (${mb.toFixed(1)}MB) — អតិបរមា ${MAX_GAME_FILE_MB}MB`;
  return null;
}
