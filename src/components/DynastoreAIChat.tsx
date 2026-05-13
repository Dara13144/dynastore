import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { aiChat } from "@/lib/ai-chat.functions";

type Msg = { role: "user" | "assistant"; content: string };

const WELCOME: Msg = {
  role: "assistant",
  content:
    "សួស្តី! ខ្ញុំ Dynastore AI 🤖 ខ្ញុំអាចជួយណែនាំអំពីការ Topup, ការទិញហ្គេម និងការប្រើប្រាស់ប្រព័ន្ធ។ សូមសួរសំណួររបស់អ្នក!",
};

const QUICK = [
  "តើធ្វើម៉េចដើម្បី Topup?",
  "របៀបទិញហ្គេម?",
  "Balance មិនគ្រប់ ត្រូវធ្វើម៉េច?",
  "តើ Download ហ្គេមនៅណា?",
];

export function DynastoreAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatFn = useServerFn(aiChat);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    const userMsg: Msg = { role: "user", content: t };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const history = next.filter((m) => m !== WELCOME).slice(-12);
      const r = await chatFn({ data: { messages: history } });
      if (r.ok) {
        setMessages((p) => [...p, { role: "assistant", content: r.reply || "…" }]);
      } else {
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${r.error}` }]);
      }
    } catch (e) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: "⚠️ មានបញ្ហាបណ្តាញ សូមព្យាយាមម្តងទៀត។" },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Dynastore AI"
        className="fixed bottom-5 right-5 z-[150] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg ring-1 ring-primary/40 hover:opacity-90 transition"
      >
        {open ? <X className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        <span className="hidden sm:inline">Dynastore AI</span>
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-[150] w-[calc(100%-2rem)] max-w-sm rounded-2xl glass border border-border/60 shadow-[var(--shadow-card)] overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-primary/10">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 grid place-items-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Dynastore AI</div>
                <div className="text-[10px] text-muted-foreground">ជំនួយការ Dyna Store</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-accent" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[55vh] min-h-[280px]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent/60 text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-accent/60 px-3 py-2 text-sm inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> កំពុងគិត…
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={busy}
                  className="text-[11px] rounded-full border border-border/60 bg-background/40 px-2.5 py-1 hover:bg-accent disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="p-3 border-t border-border/60 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="សួរអ្វីមួយ…"
              disabled={busy}
              className="flex-1 rounded-full bg-input px-4 py-2 text-sm outline-none ring-1 ring-border focus:ring-primary disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
