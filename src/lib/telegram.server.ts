// Server-only Telegram notifier. Forwards to TELEGRAM_CHAT_IDS + the default group.
const TELEGRAM_DEFAULT_GROUP = "-1003892184606";

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
