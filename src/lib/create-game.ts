// Pure, testable submit logic for the admin "Create Game" action.
// admin.tsx calls this with adapters bound to the real supabase client;
// tests call it with mocks to verify validation gates uploads + inserts.
import { validateGameFile, validateGameFileUrl } from "./validate-game-file";

export type GameDraft = {
  id: string;
  title: string;
  category: string;
  description: string;
  badge: string;
  price_coins: number;
  visible: boolean;
  image_url: string;
  /** Optional external link to the game archive (alternative to uploading a file). */
  file_url?: string | null;
  /** Which storage backend holds the file: supabase (default), s3, external_url. */
  storage_provider?: "supabase" | "s3" | "external_url";
  /** Pre-uploaded external file (e.g. S3 object key + size) skipping the bucket upload. */
  external_file?: { path: string; size: number | null } | null;
};

export type CreateGameDeps = {
  uploadFile: (
    gameId: string,
    file: { name: string; size: number },
  ) => Promise<{ path: string; size: number } | null>;
  insertGame: (row: {
    id: string;
    title: string;
    category: string;
    description: string;
    badge: string | null;
    price_coins: number;
    visible: boolean;
    image_url: string | null;
    file_path: string | null;
    file_size_bytes: number | null;
    storage_provider?: "supabase" | "s3" | "external_url";
  }) => Promise<{ error: { message: string } | null }>;
  onError?: (msg: string) => void;
};

export type CreateGameResult =
  | { ok: true }
  | {
      ok: false;
      reason: "missing_fields" | "invalid_file" | "invalid_url" | "upload_failed" | "insert_failed";
      message: string;
    };

export async function submitCreateGame(
  draft: GameDraft,
  draftFile: { name: string; size: number } | null,
  deps: CreateGameDeps,
): Promise<CreateGameResult> {
  if (!draft.id.trim() || !draft.title.trim()) {
    const message = "ត្រូវការ id និង title";
    deps.onError?.(message);
    return { ok: false, reason: "missing_fields", message };
  }
  // Re-validate file BEFORE any upload or DB insert.
  if (draftFile) {
    const err = validateGameFile(draftFile);
    if (err) {
      deps.onError?.(err);
      return { ok: false, reason: "invalid_file", message: err };
    }
  }
  let file_path: string | null = null;
  let file_size_bytes: number | null = null;
  if (draftFile) {
    const up = await deps.uploadFile(draft.id.trim(), draftFile);
    if (!up) return { ok: false, reason: "upload_failed", message: "upload_failed" };
    file_path = up.path;
    file_size_bytes = up.size;
  } else if (draft.file_url && draft.file_url.trim()) {
    // External link path: validate the URL BEFORE inserting.
    const urlErr = validateGameFileUrl(draft.file_url);
    if (urlErr) {
      deps.onError?.(urlErr);
      return { ok: false, reason: "invalid_url", message: urlErr };
    }
    file_path = draft.file_url.trim();
  }
  const { error } = await deps.insertGame({
    id: draft.id.trim(),
    title: draft.title.trim(),
    category: draft.category.trim() || "GAME",
    description: draft.description,
    badge: draft.badge || null,
    price_coins: Number(draft.price_coins) || 0,
    visible: draft.visible,
    image_url: draft.image_url || null,
    file_path,
    file_size_bytes,
  });
  if (error) {
    deps.onError?.(error.message);
    return { ok: false, reason: "insert_failed", message: error.message };
  }
  return { ok: true };
}
