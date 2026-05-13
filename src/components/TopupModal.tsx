import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { X, Wallet, Loader2, Upload, Check, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTopupConfig, createTopupRequest, listMyTopupRequests } from "@/lib/topup.functions";

type Props = { onClose: () => void; onToast: (m: string) => void };

const PRESETS = [1, 2, 5, 10, 20, 50];

export function TopupModal({ onClose, onToast }: Props) {
  const cfgFn = useServerFn(getTopupConfig);
  const submitFn = useServerFn(createTopupRequest);
  const listFn = useServerFn(listMyTopupRequests);
  const fileRef = useRef<HTMLInputElement>(null);

  const [qr, setQr] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [amount, setAmount] = useState<number>(1);
  const [note, setNote] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listFn>>>([]);

  const coins = useMemo(() => Math.round(amount * rate), [amount, rate]);

  useEffect(() => {
    (async () => {
      try {
        const c = await cfgFn();
        setQr(c.qr); setRate(c.coins_per_usd);
        const h = await listFn();
        setHistory(h);
      } catch (e) {
        onToast(e instanceof Error ? e.message : "មានបញ្ហា");
      }
    })();
  }, [cfgFn, listFn, onToast]);

  function pickSlip(f: File) {
    if (!f.type.startsWith("image/")) { onToast("សូមជ្រើសរើសរូបភាព"); return; }
    if (f.size > 5 * 1024 * 1024) { onToast("រូបភាពធំជាង 5MB"); return; }
    setSlipFile(f);
    const url = URL.createObjectURL(f);
    setSlipPreview(url);
  }

  async function submit() {
    if (!slipFile) { onToast("សូមបញ្ជូនរូបបង្កាន់ដៃ"); return; }
    if (amount < 0.5) { onToast("ចំនួនទឹកប្រាក់តូចពេក"); return; }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("មិនទាន់ login");
      const ext = slipFile.name.split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("topup-slips").upload(path, slipFile, {
        contentType: slipFile.type, upsert: false,
      });
      if (upErr) throw new Error(upErr.message);
      await submitFn({ data: { amount_usd: amount, slip_path: path, note: note || undefined } });
      onToast(`✓ បានបញ្ជូនសំណើ — Admin នឹងបញ្ជាក់ឆាប់ៗ`);
      setSlipFile(null); setSlipPreview(null); setNote("");
      const h = await listFn();
      setHistory(h);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "មានបញ្ហា");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <h2 className="font-display text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> បញ្ចូល Balance</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-muted-foreground">ស្គេន KHQR ខាងក្រោម តាម Bakong, ApPay, ABA, ឬ Wing → បន្ទាប់មក upload រូបបង្កាន់ដៃ → admin នឹងបន្ថែម coins ឲ្យ។ អត្រា៖ <span className="text-foreground font-semibold">$1 = {rate.toLocaleString()} coins</span></p>

          {/* QR */}
          <div className="rounded-2xl bg-white p-5 mx-auto w-full max-w-[320px] flex flex-col items-center">
            {qr ? (
              <QRCode value={qr} size={260} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox="0 0 256 256" />
            ) : (
              <div className="h-[260px] w-[260px] grid place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            )}
            <div className="mt-3 text-center text-[10px] font-semibold tracking-wider text-black">DYNASTORE • KHQR</div>
          </div>

          <div className="space-y-3">

              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">ចំនួន (USD)</div>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button key={p} onClick={() => setAmount(p)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ring-1 ${amount === p ? "bg-primary/15 text-primary ring-primary" : "ring-border hover:bg-accent"}`}>
                      ${p}
                    </button>
                  ))}
                </div>
                <input type="number" min={0.5} step={0.5} value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-2 w-full rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none" />
                <div className="mt-1.5 text-xs text-muted-foreground">នឹងទទួលបាន <span className="text-primary font-semibold">{coins.toLocaleString()} coins</span></div>
              </div>

              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))}
                placeholder="សារបន្ថែម (ស្រេចចិត្ត)…" rows={2}
                className="w-full rounded-xl bg-input px-3 py-2 text-xs ring-1 ring-border focus:ring-primary outline-none resize-none" />
          </div>

          {/* Slip upload */}
          <div className="rounded-2xl border border-dashed border-border p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold">បង្កាន់ដៃ (Screenshot)</div>
                <div className="text-[11px] text-muted-foreground">PNG/JPG ≤ 5MB</div>
              </div>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
                <Upload className="h-3.5 w-3.5" /> ជ្រើសរូប
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickSlip(f); }} />
            </div>
            {slipPreview && (
              <img src={slipPreview} alt="slip" className="max-h-56 rounded-xl mx-auto ring-1 ring-border" />
            )}
          </div>

          <button onClick={submit} disabled={submitting || !slipFile}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 text-sm font-bold disabled:opacity-50 hover:opacity-90">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            បញ្ជូនសំណើ
          </button>

          {/* History */}
          {history.length > 0 && (
            <div className="pt-2 border-t border-border/60">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">ប្រវត្តិសំណើ</div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs rounded-lg bg-muted/30 px-2 py-1.5">
                    {h.slip_url ? (
                      <a href={h.slip_url} target="_blank" rel="noreferrer" className="shrink-0">
                        <img src={h.slip_url} alt="slip" className="h-10 w-10 rounded object-cover ring-1 ring-border" />
                      </a>
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted/50 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {h.status === "approved" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        {h.status === "pending" && <Clock className="h-3.5 w-3.5 text-amber-400" />}
                        {h.status === "rejected" && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                        <span className="font-mono">${Number(h.amount_usd).toFixed(2)}</span>
                        <span className="text-muted-foreground">→ {Number(h.coins).toLocaleString()}</span>
                        <span className={`ml-auto text-[10px] uppercase font-semibold ${h.status === "approved" ? "text-emerald-400" : h.status === "rejected" ? "text-destructive" : "text-amber-400"}`}>{h.status}</span>
                      </div>
                      <div className="text-muted-foreground text-[10px] truncate">
                        {new Date(h.created_at).toLocaleString()}
                        {h.status === "rejected" && h.reject_reason ? ` · ${h.reject_reason}` : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
