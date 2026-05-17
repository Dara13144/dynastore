import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import { X, Wallet, Loader2, Upload, Check, Clock, AlertCircle, Download, Zap, FileImage } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getTopupConfig, createTopupRequest, listMyTopupRequests,
  createBakongTopup, verifyBakongTopup,
} from "@/lib/topup.functions";

type Props = { onClose: () => void; onToast: (m: string) => void };
type Mode = "auto" | "manual";

const PRESETS = [1, 2, 5, 10, 20, 50];

export function TopupModal({ onClose, onToast }: Props) {
  const cfgFn = useServerFn(getTopupConfig);
  const submitFn = useServerFn(createTopupRequest);
  const listFn = useServerFn(listMyTopupRequests);
  const createAutoFn = useServerFn(createBakongTopup);
  const verifyAutoFn = useServerFn(verifyBakongTopup);
  const fileRef = useRef<HTMLInputElement>(null);
  const qrBoxRef = useRef<HTMLDivElement>(null);
  const autoQrBoxRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<Mode>("auto");
  const [staticQr, setStaticQr] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [amount, setAmount] = useState<number>(1);
  const [note, setNote] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listFn>>>([]);
  const [qrName, setQrName] = useState("dynastore-khqr");
  const [exporting, setExporting] = useState(false);

  // Auto flow state
  const [autoSession, setAutoSession] = useState<{
    id: string; qr: string; coins: number; amount: number; expiresAt: number;
  } | null>(null);
  const [autoStatus, setAutoStatus] = useState<"idle" | "creating" | "waiting" | "paid" | "expired">("idle");
  const [now, setNow] = useState(Date.now());

  const coins = useMemo(() => Math.round(amount * rate), [amount, rate]);

  useEffect(() => {
    (async () => {
      try {
        const c = await cfgFn();
        setStaticQr(c.qr); setRate(c.coins_per_usd);
        const h = await listFn();
        setHistory(h);
      } catch (e) {
        onToast(e instanceof Error ? e.message : "មានបញ្ហា");
      }
    })();
  }, [cfgFn, listFn, onToast]);

  // Countdown tick
  useEffect(() => {
    if (autoStatus !== "waiting") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [autoStatus]);

  // Auto-poll Bakong while waiting. Self-scheduling timeout (not setInterval)
  // lets us back off when the server reports transient upstream issues and
  // stop hard when it reports unrecoverable ones.
  useEffect(() => {
    if (autoStatus !== "waiting" || !autoSession) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;          // consecutive transient/network failures
    let warnedFailure = false; // throttle the "still trying" toast

    const schedule = (ms: number) => {
      if (cancelled) return;
      timer = setTimeout(poll, ms);
    };

    const poll = async () => {
      try {
        const r = await verifyAutoFn({ data: { id: autoSession.id } });
        if (cancelled) return;

        if (r.status === "approved") {
          setAutoStatus("paid");
          onToast(`✅ បានបញ្ចូល ${autoSession.coins.toLocaleString()} coins`);
          const h = await listFn(); setHistory(h);
          window.dispatchEvent(new Event("wallet:refresh"));
          return; // stop polling
        }
        if (r.status === "expired" || r.status === "rejected") {
          setAutoStatus("expired");
          return; // stop polling
        }

        // pending — check for transient upstream signal
        if ("error" in r && r.error) {
          failures += 1;
          if (!warnedFailure && failures >= 2) {
            warnedFailure = true;
            const msg =
              r.error === "upstream_error"
                ? "ប្រព័ន្ធ Bakong មិនទាន់ឆ្លើយតប — កំពុងព្យាយាមម្តងទៀត…"
                : r.error === "auth_error"
                ? "ការតភ្ជាប់ទៅ Bakong មានបញ្ហា — សូមរង់ចាំ…"
                : "បណ្តាញមិនល្អ — កំពុងព្យាយាមម្តងទៀត…";
            onToast(msg);
          }
          // Backoff: 6s → 10s → 15s (cap)
          schedule(Math.min(15000, 3000 + failures * 3000));
          return;
        }

        // pending, healthy — reset counter and continue at 3s
        if (failures > 0) {
          failures = 0;
          warnedFailure = false;
        }
        schedule(3000);
      } catch (e) {
        if (cancelled) return;
        // Hard errors from the server — message contains "not_found",
        // "forbidden", "missing_md5", or BakongApiError("auth_error").
        const raw = e instanceof Error ? e.message : String(e);
        console.warn("verify poll error", raw);

        if (/not_found|forbidden|missing_md5/i.test(raw)) {
          setAutoStatus("expired");
          onToast("មិនអាចតាមដានបញ្ជរនេះបានទេ — សូមបង្កើតថ្មី");
          return; // stop polling
        }
        if (/auth_error/i.test(raw)) {
          setAutoStatus("expired");
          onToast("ការតភ្ជាប់ Bakong ខូច — សូមទាក់ទងផ្នែកជំនួយ");
          return; // stop polling
        }

        // Treat unknown thrown errors as transient network issues.
        failures += 1;
        if (!warnedFailure && failures >= 2) {
          warnedFailure = true;
          onToast("បណ្តាញមិនល្អ — កំពុងព្យាយាមម្តងទៀត…");
        }
        schedule(Math.min(15000, 3000 + failures * 3000));
      }
    };

    poll(); // fire immediately
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [autoStatus, autoSession, verifyAutoFn, listFn, onToast]);


  // Auto-expire client-side
  useEffect(() => {
    if (autoStatus === "waiting" && autoSession && now >= autoSession.expiresAt) {
      setAutoStatus("expired");
    }
  }, [now, autoStatus, autoSession]);

  async function startAuto() {
    if (amount < 0.5) { onToast("ចំនួនទឹកប្រាក់តូចពេក"); return; }
    setAutoStatus("creating");
    try {
      const r = await createAutoFn({ data: { amount_usd: amount } });
      setAutoSession({
        id: r.id, qr: r.qr_payload, coins: r.coins, amount: r.amount_usd,
        expiresAt: new Date(r.expires_at).getTime(),
      });
      setAutoStatus("waiting");
    } catch (e) {
      setAutoStatus("idle");
      onToast(e instanceof Error ? e.message : "មានបញ្ហា");
    }
  }

  function resetAuto() {
    setAutoSession(null);
    setAutoStatus("idle");
  }

  function pickSlip(f: File) {
    if (!f.type.startsWith("image/")) { onToast("សូមជ្រើសរើសរូបភាព"); return; }
    if (f.size > 5 * 1024 * 1024) { onToast("រូបភាពធំជាង 5MB"); return; }
    setSlipFile(f);
    setSlipPreview(URL.createObjectURL(f));
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
      const h = await listFn(); setHistory(h);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "មានបញ្ហា");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadQrPng() {
    downloadQrFromRef(qrBoxRef, qrName.trim() || "dynastore-khqr", "DYNASTORE • KHQR");
  }

  function downloadAutoQrPng() {
    if (!autoSession) return;
    const fname = `dynastore-khqr-$${autoSession.amount.toFixed(2)}-${autoSession.id.slice(0, 8)}`;
    downloadQrFromRef(autoQrBoxRef, fname, `DYNASTORE • KHQR • $${autoSession.amount.toFixed(2)}`);
  }

  function downloadQrFromRef(ref: React.RefObject<HTMLDivElement | null>, filename: string, label: string) {
    const svg = ref.current?.querySelector("svg");
    if (!svg) { onToast("QR មិនទាន់រួចរាល់"); return; }
    setExporting(true);
    const safeName = filename.replace(/[^a-zA-Z0-9_\-\.]+/g, "-").slice(0, 80);
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const SIZE = 1024, PAD = 64;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE; canvas.height = SIZE + 80;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, PAD, PAD, SIZE - PAD * 2, SIZE - PAD * 2);
        ctx.fillStyle = "#000"; ctx.font = "bold 28px system-ui, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(label, SIZE / 2, SIZE + 40);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) { onToast("Export បរាជ័យ"); setExporting(false); return; }
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${safeName}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          setExporting(false);
        }, "image/png");
      } catch { URL.revokeObjectURL(url); onToast("Export បរាជ័យ"); setExporting(false); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); onToast("Export បរាជ័យ"); setExporting(false); };
    img.src = url;
  }

  const secondsLeft = autoSession ? Math.max(0, Math.ceil((autoSession.expiresAt - now) / 1000)) : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <h2 className="font-display text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> បញ្ចូល Balance</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4">
          <div className="inline-flex rounded-full bg-muted/40 p-1 text-xs font-semibold">
            <button onClick={() => setMode("auto")}
              className={`px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition ${mode === "auto" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              <Zap className="h-3.5 w-3.5" /> Auto Bakong
            </button>
            <button onClick={() => setMode("manual")}
              className={`px-4 py-2 rounded-full inline-flex items-center gap-1.5 transition ${mode === "manual" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
              <FileImage className="h-3.5 w-3.5" /> Upload Slip
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-muted-foreground">
            អត្រា៖ <span className="text-foreground font-semibold">$1 = {rate.toLocaleString()} coins</span>
          </p>

          {/* Amount input (shared) */}
          {(mode === "manual" || autoStatus === "idle") && (
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
            </div>
          )}

          {/* AUTO MODE */}
          {mode === "auto" && (
            <>
              {autoStatus === "idle" && (
                <button onClick={startAuto}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 text-sm font-bold hover:opacity-90">
                  <Zap className="h-4 w-4" /> Generate KHQR & Pay
                </button>
              )}
              {autoStatus === "creating" && (
                <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              )}
              {autoStatus === "waiting" && autoSession && (
                <div className="mx-auto w-full max-w-[320px] flex flex-col items-center gap-3">
                  <div ref={autoQrBoxRef} className="rounded-2xl bg-white p-5 w-full flex flex-col items-center">
                    <QRCode value={autoSession.qr} size={260} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox="0 0 256 256" />
                    <div className="mt-3 text-center">
                      <div className="text-[10px] font-semibold tracking-wider text-black">DYNASTORE • KHQR</div>
                      <div className="mt-1 text-sm font-bold text-black">${autoSession.amount.toFixed(2)} USD</div>
                    </div>
                  </div>
                  <div className="w-full rounded-xl bg-muted/30 p-3 text-center">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>កំពុងរង់ចាំការទូទាត់…</span>
                    </div>
                    <div className="mt-1 text-2xl font-mono font-bold tabular-nums">{mm}:{ss}</div>
                    <div className="text-[10px] text-muted-foreground">ស្គេន QR តាម Bakong/ABA/Wing → coins នឹងបញ្ចូលដោយស្វ័យប្រវត្តិ</div>
                  </div>
                  <button onClick={downloadAutoQrPng} disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50">
                    {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {exporting ? "កំពុង Export…" : "ទាញយក QR (PNG)"}
                  </button>
                  <button onClick={resetAuto} className="text-xs text-muted-foreground hover:text-foreground underline">បោះបង់</button>
                </div>
              )}
              {autoStatus === "paid" && autoSession && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
                  <Check className="h-10 w-10 text-emerald-400 mx-auto" />
                  <div className="font-bold text-emerald-300">បានបញ្ចូលដោយជោគជ័យ!</div>
                  <div className="text-sm">+{autoSession.coins.toLocaleString()} coins</div>
                  <button onClick={() => { resetAuto(); }} className="mt-2 rounded-full bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold">បន្ថែមទៀត</button>
                </div>
              )}
              {autoStatus === "expired" && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-2">
                  <Clock className="h-10 w-10 text-amber-400 mx-auto" />
                  <div className="font-bold text-amber-300">QR ផុតកំណត់</div>
                  <div className="text-xs text-muted-foreground">បើបានបង់ប្រាក់រួចហើយ សូមរង់ចាំបន្តិច ឬ Upload Slip ជំនួស</div>
                  <button onClick={resetAuto} className="mt-2 rounded-full bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold">សាកល្បងម្តងទៀត</button>
                </div>
              )}
            </>
          )}

          {/* MANUAL MODE */}
          {mode === "manual" && (
            <>
              <div className="mx-auto w-full max-w-[320px] flex flex-col items-center gap-3">
                <div ref={qrBoxRef} className="rounded-2xl bg-white p-5 w-full flex flex-col items-center">
                  {staticQr ? (
                    <QRCode value={staticQr} size={260} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox="0 0 256 256" />
                  ) : (
                    <div className="h-[260px] w-[260px] grid place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  )}
                  <div className="mt-3 text-center text-[10px] font-semibold tracking-wider text-black">DYNASTORE • KHQR</div>
                </div>
                <div className="flex w-full items-center gap-2">
                  <input value={qrName} onChange={(e) => setQrName(e.target.value)} placeholder="filename" disabled={exporting}
                    className="flex-1 rounded-full bg-input px-3 py-2 text-xs ring-1 ring-border focus:ring-primary outline-none disabled:opacity-50" />
                  <span className="text-[10px] text-muted-foreground">.png</span>
                </div>
                <button onClick={downloadQrPng} disabled={!staticQr || exporting}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50">
                  {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {exporting ? "កំពុង Export…" : "ទាញយក KHQR (PNG)"}
                </button>
              </div>

              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))}
                placeholder="សារបន្ថែម (ស្រេចចិត្ត)…" rows={2}
                className="w-full rounded-xl bg-input px-3 py-2 text-xs ring-1 ring-border focus:ring-primary outline-none resize-none" />

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
                {slipPreview && <img src={slipPreview} alt="slip" className="max-h-56 rounded-xl mx-auto ring-1 ring-border" />}
              </div>

              <button onClick={submit} disabled={submitting || !slipFile}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground py-3 text-sm font-bold disabled:opacity-50 hover:opacity-90">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                បញ្ជូនសំណើ
              </button>
            </>
          )}

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
                      <div className="h-10 w-10 rounded bg-muted/50 shrink-0 grid place-items-center">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {h.status === "approved" && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                        {h.status === "pending" && <Clock className="h-3.5 w-3.5 text-amber-400" />}
                        {(h.status === "rejected" || h.status === "expired") && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
                        <span className="font-mono">${Number(h.amount_usd).toFixed(2)}</span>
                        <span className="text-muted-foreground">→ {Number(h.coins).toLocaleString()}</span>
                        <span className={`ml-auto text-[10px] uppercase font-semibold ${h.status === "approved" ? "text-emerald-400" : (h.status === "rejected" || h.status === "expired") ? "text-destructive" : "text-amber-400"}`}>{h.status}</span>
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
