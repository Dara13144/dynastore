import { supabase } from "@/integrations/supabase/client";

export type UploadAuditEvent =
  | "start"
  | "progress"
  | "pause"
  | "resume"
  | "retry"
  | "network_lost"
  | "network_restored"
  | "success"
  | "error"
  | "abort"
  | "token_refresh";

export type UploadAuditPayload = {
  event_type: UploadAuditEvent;
  game_id?: string | null;
  file_name?: string | null;
  file_size_bytes?: number | null;
  offset_bytes?: number | null;
  attempt?: number | null;
  message?: string | null;
};

/**
 * Best-effort fire-and-forget audit insert. RLS requires auth.uid()=user_id, so
 * we fetch the current user and skip silently if not signed in. Never throws —
 * failures only land in the console so they cannot break the upload flow.
 */
export async function logUploadEvent(payload: UploadAuditPayload): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const online =
      typeof navigator !== "undefined" ? navigator.onLine : null;
    await supabase.from("upload_audit_log").insert({
      user_id: userId,
      event_type: payload.event_type,
      game_id: payload.game_id ?? null,
      file_name: payload.file_name ?? null,
      file_size_bytes: payload.file_size_bytes ?? null,
      offset_bytes: payload.offset_bytes ?? null,
      attempt: payload.attempt ?? null,
      message: payload.message ?? null,
      online,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[upload-audit] insert failed", e);
  }
}
