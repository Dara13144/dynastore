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
      supabaseAdmin.auth.admin.getUserById(userId).catch(() => ({ data: null as any })),
    ]);
    if (prof?.display_name) name = prof.display_name;
    email = u?.user?.email ?? "";
  } catch { /* ignore */ }
  return formatUser(name, email);
}

export async function notifyTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const envIds = (process.env.TELEGRAM_CHAT_IDS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const chatIds = Array.from(new Set([...envIds, TELEGRAM_DEFAULT_GROUP]));
  if (!token || chatIds.length === 0) return;
  await Promise.all(chatIds.map(async (chat_id) => {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      if (!r.ok) console.error("telegram send failed", r.status, await r.text());
    } catch (e) {
      console.error("telegram send error", e);
    }
  }));
}
