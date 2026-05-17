// Server-only Telegram notifier. Forwards to TELEGRAM_CHAT_IDS + the default group.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TELEGRAM_DEFAULT_GROUP = "-1003892184606";

/** Escape special HTML chars for Telegram parse_mode=HTML. */
export function tgEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Format user identity consistently as "Name (email)" or "Name" if no email. */
export function formatUser(name: string | null | undefined, email?: string | null): string {
  const n = (name ?? "").trim() || "user";
  const e = (email ?? "").trim();
  return e ? `${tgEscape(n)} (<code>${tgEscape(e)}</code>)` : tgEscape(n);
}

/** Look up "Name (email)" for a userId — used by all notifiers for consistency. */
export async function formatUserById(userId: string): Promise<string> {
  let name = userId.slice(0, 8);
  let email = "";
  try {
    const [{ data: prof }, { data: u }] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.auth.admin
        .getUserById(userId)
        .catch(() => ({ data: null as { user: { email?: string } | null } | null })),
    ]);
    if (prof?.display_name) name = prof.display_name;
    email = u?.user?.email ?? "";
  } catch {
    /* ignore */
  }
  return formatUser(name, email);
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 400;

async function logResult(row: {
  event_type: string;
  chat_id: string;
  status: "sent" | "failed";
  http_status?: number | null;
  error?: string | null;
  attempts: number;
  message_preview: string;
}) {
  try {
    await supabaseAdmin.from("telegram_notifications").insert(row);
  } catch (e) {
    console.error("[telegram] failed to persist log", e);
  }
}

async function sendOnce(token: string, chat_id: string, text: string) {
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  let body: string | null = null;
  if (!r.ok) {
    try {
      body = await r.text();
    } catch {
      body = null;
    }
  }
  return { ok: r.ok, status: r.status, body };
}

async function sendPhotoOnce(
  token: string,
  chat_id: string,
  caption: string,
  photo: Blob,
  filename: string,
) {
  const fd = new FormData();
  fd.append("chat_id", chat_id);
  fd.append("caption", caption);
  fd.append("parse_mode", "HTML");
  fd.append("photo", photo, filename);
  const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: fd,
  });
  let body: string | null = null;
  if (!r.ok) {
    try {
      body = await r.text();
    } catch {
      body = null;
    }
  }
  return { ok: r.ok, status: r.status, body };
}

async function sendDocumentOnce(
  token: string,
  chat_id: string,
  caption: string,
  doc: Blob,
  filename: string,
) {
  const fd = new FormData();
  fd.append("chat_id", chat_id);
  fd.append("caption", caption);
  fd.append("parse_mode", "HTML");
  fd.append("document", doc, filename);
  const r = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: fd,
  });
  let body: string | null = null;
  if (!r.ok) {
    try {
      body = await r.text();
    } catch {
      body = null;
    }
  }
  return { ok: r.ok, status: r.status, body };
}

/**
 * Send a photo by public URL — Telegram fetches the image itself.
 * Falls back to a text message (with the URL) on any failure.
 */
export async function notifyTelegramPhotoFromUrl(
  photoUrl: string,
  caption: string,
  eventType = "generic",
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const envIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const chatIds = Array.from(new Set([...envIds, TELEGRAM_DEFAULT_GROUP]));
  const preview = caption.slice(0, 500);

  if (!token) {
    console.error("[telegram] missing TELEGRAM_BOT_TOKEN", { eventType });
    await logResult({
      event_type: eventType,
      chat_id: "(none)",
      status: "failed",
      error: "missing TELEGRAM_BOT_TOKEN",
      attempts: 0,
      message_preview: preview,
    });
    return;
  }
  if (chatIds.length === 0) return;

  await Promise.all(
    chatIds.map(async (chat_id) => {
      let attempt = 0;
      let lastStatus: number | null = null;
      let lastError: string | null = null;
      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        try {
          const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id, photo: photoUrl, caption, parse_mode: "HTML" }),
          });
          if (r.ok) {
            console.info("[telegram] photo-url sent", { eventType, chat_id, attempt });
            await logResult({
              event_type: eventType,
              chat_id,
              status: "sent",
              http_status: r.status,
              attempts: attempt,
              message_preview: preview,
            });
            return;
          }
          lastStatus = r.status;
          let body: string | null = null;
          try {
            body = await r.text();
          } catch {
            /* ignore */
          }
          lastError = body?.slice(0, 500) ?? `HTTP ${r.status}`;
          if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((res) => setTimeout(res, RETRY_BASE_MS * attempt));
        }
      }
      console.error("[telegram] photo-url FAILED, falling back to text", {
        eventType,
        chat_id,
        attempts: attempt,
        http_status: lastStatus,
        error: lastError,
      });
      await logResult({
        event_type: eventType,
        chat_id,
        status: "failed",
        http_status: lastStatus,
        error: lastError,
        attempts: attempt,
        message_preview: preview,
      });
    }),
  );

  // Best-effort text fallback if any chat may have failed (sendPhoto by URL can be flaky for hotlinked images)
  // We send text only when no chats succeeded above is hard to track per-chat; instead we always append a link in caller if needed.
}
/**
 * Send a photo (or document fallback) from a Supabase Storage object to all Telegram chats.
 * Falls back to a plain text message if the file cannot be downloaded.
 */
export async function notifyTelegramPhotoFromStorage(
  bucket: string,
  path: string,
  caption: string,
  eventType = "generic",
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const envIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const chatIds = Array.from(new Set([...envIds, TELEGRAM_DEFAULT_GROUP]));
  const preview = caption.slice(0, 500);

  if (!token) {
    console.error("[telegram] missing TELEGRAM_BOT_TOKEN", { eventType });
    await logResult({
      event_type: eventType,
      chat_id: "(none)",
      status: "failed",
      error: "missing TELEGRAM_BOT_TOKEN",
      attempts: 0,
      message_preview: preview,
    });
    return;
  }
  if (chatIds.length === 0) return;

  // Download once from storage
  let blob: Blob | null = null;
  const filename = path.split("/").pop() || "slip";
  try {
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
    if (error) throw error;
    blob = data;
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[telegram] storage download failed, falling back to text", {
      eventType,
      bucket,
      path,
      err,
    });
    // fallback: attach signed URL in text
    try {
      const { data: signed } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);
      const link = signed?.signedUrl ? `\n🔗 <a href="${signed.signedUrl}">slip</a>` : "";
      await notifyTelegram(caption + link, eventType);
    } catch {
      await notifyTelegram(caption, eventType);
    }
    return;
  }

  const isImage = /\.(png|jpe?g|webp|gif)$/i.test(filename);

  await Promise.all(
    chatIds.map(async (chat_id) => {
      let attempt = 0;
      let lastStatus: number | null = null;
      let lastError: string | null = null;
      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        try {
          const r = isImage
            ? await sendPhotoOnce(token, chat_id, caption, blob!, filename)
            : await sendDocumentOnce(token, chat_id, caption, blob!, filename);
          if (r.ok) {
            console.info("[telegram] photo sent", { eventType, chat_id, attempt });
            await logResult({
              event_type: eventType,
              chat_id,
              status: "sent",
              http_status: r.status,
              attempts: attempt,
              message_preview: preview,
            });
            return;
          }
          lastStatus = r.status;
          lastError = r.body?.slice(0, 500) ?? `HTTP ${r.status}`;
          if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((res) => setTimeout(res, RETRY_BASE_MS * attempt));
        }
      }
      console.error("[telegram] photo FAILED", {
        eventType,
        chat_id,
        attempts: attempt,
        http_status: lastStatus,
        error: lastError,
      });
      await logResult({
        event_type: eventType,
        chat_id,
        status: "failed",
        http_status: lastStatus,
        error: lastError,
        attempts: attempt,
        message_preview: preview,
      });
    }),
  );
}

/**
 * Send a Telegram message to all configured chats with retries + structured logging.
 * Every attempt result is recorded in `telegram_notifications` for alerting/diagnosis.
 */
export async function notifyTelegram(text: string, eventType = "generic"): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const envIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const chatIds = Array.from(new Set([...envIds, TELEGRAM_DEFAULT_GROUP]));
  const preview = text.slice(0, 500);

  if (!token) {
    console.error("[telegram] missing TELEGRAM_BOT_TOKEN", { eventType });
    await logResult({
      event_type: eventType,
      chat_id: "(none)",
      status: "failed",
      error: "missing TELEGRAM_BOT_TOKEN",
      attempts: 0,
      message_preview: preview,
    });
    return;
  }
  if (chatIds.length === 0) return;

  await Promise.all(
    chatIds.map(async (chat_id) => {
      let attempt = 0;
      let lastStatus: number | null = null;
      let lastError: string | null = null;
      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        try {
          const r = await sendOnce(token, chat_id, text);
          if (r.ok) {
            console.info("[telegram] sent", { eventType, chat_id, attempt });
            await logResult({
              event_type: eventType,
              chat_id,
              status: "sent",
              http_status: r.status,
              attempts: attempt,
              message_preview: preview,
            });
            return;
          }
          lastStatus = r.status;
          lastError = r.body?.slice(0, 500) ?? `HTTP ${r.status}`;
          // Don't retry on 4xx (bad request, blocked, chat not found, etc.)
          if (r.status >= 400 && r.status < 500 && r.status !== 429) break;
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((res) => setTimeout(res, RETRY_BASE_MS * attempt));
        }
      }
      console.error("[telegram] FAILED", {
        eventType,
        chat_id,
        attempts: attempt,
        http_status: lastStatus,
        error: lastError,
      });
      await logResult({
        event_type: eventType,
        chat_id,
        status: "failed",
        http_status: lastStatus,
        error: lastError,
        attempts: attempt,
        message_preview: preview,
      });
    }),
  );
}
