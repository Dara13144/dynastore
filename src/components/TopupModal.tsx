import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { Loader2, X, Wallet, Check, Copy, Upload } from "lucide-react";
import { createTopup, checkTopupStatus, submitTopupProof } from "@/lib/topup.functions";

const PRESETS = [1, 2, 5, 10, 20, 50];

export function TopupModal({
  onClose,
  onCredited,
  onToast,
}: {
  onClose: () => void;
  onCredited: (newBalance: number) => void;
  onToast: (m: string) => void;
}) {
  const [amount, setAmount] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<{
    md5: string;
    qrString: string;
    coins: number;
    amountUSD: number;
    expiresAt: string;
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "pending" | "paid" | "expired">("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const pollRef = useRef<number | null>(null);

  const createFn = useServerFn(createTopup);
  const checkFn = useServerFn(checkTopupStatus);
  const proofFn = useServerFn(submitTopupProof);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofSent, setProofSent] = useState(false);

  const onPickProof = async (file: File) => {
    if (!tx) return;
    if (file.size > 6_000_000) { onToast("File too large (max 6MB)"); return; }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let bin = "";
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      const ct = (file.type === "image/jpeg" || file.type === "image/webp") ? file.type : "image/png";
      await proofFn({ data: { md5: tx.md5, imageBase64: b64, contentType: ct } });
      setProofSent(true);
      onToast("បានផ្ញើទៅ Telegram ✓");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!tx) return;
    QRCode.toDataURL(tx.qrString, { width: 280, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [tx]);

  // Countdown + polling
  useEffect(() => {
    if (!tx || status !== "pending") return;
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(tx.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) setStatus("expired");
    };
    tick();
    const ti = window.setInterval(tick, 1000);
    pollRef.current = window.setInterval(async () => {
      try {
        const r = await checkFn({ data: { md5: tx.md5 } });
        if (r.status === "paid") {
          setStatus("paid");
          onCredited(r.balance);
          onToast(`បន្ថែម ${tx.coins.toLocaleString()} coins ✓`);
          if (pollRef.current) window.clearInterval(pollRef.current);
        } else if (r.status === "expired" || r.status === "not_found") {
          setStatus("expired");
          if (pollRef.current) window.clearInterval(pollRef.current);
        }
      } catch {/* keep polling */}
    }, 4000);
    return () => {
      window.clearInterval(ti);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [tx, status, checkFn, onCredited, onToast]);

  const create = async () => {
    setBusy(true);
    try {
      const r = await createFn({ data: { amountUSD: amount } });
      setTx({ md5: r.md5, qrString: r.qrString, coins: r.coins, amountUSD: r.amountUSD, expiresAt: r.expiresAt });
      setStatus("pending");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "បរាជ័យ");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!tx) return;
    await navigator.clipboard.writeText(tx.qrString);
    onToast("បានចម្លង QR string");
  };

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in" onClick={onClose}>
      <div className="glass rounded-2xl border border-border/60 w-full max-w-md p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-accent" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-display text-xl mb-1 flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> បញ្ចូល Balance
        </h2>
        <p className="text-xs text-muted-foreground mb-4">បង់តាម KHQR (Bakong) — ស្វ័យប្រវត្តិបន្ទាប់ពីបង់សរេច។</p>

        {!tx && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">ចំនួន (USD)</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {PRESETS.map((v) => (
                  <button key={v} onClick={() => setAmount(v)} className={`rounded-xl py-2 text-sm font-semibold border transition ${amount === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}>
                    ${v}
                  </button>
                ))}
              </div>
              <input
                type="number" min={0.5} max={500} step={0.5}
                value={amount}
                onChange={(e) => setAmount(Math.max(0.5, Math.min(500, Number(e.target.value) || 0)))}
                className="mt-2 w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
              />
            </div>
            <button onClick={create} disabled={busy || amount <= 0} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "បង្កើត QR"}
            </button>
          </div>
        )}

        {tx && status === "pending" && (
          <div className="space-y-3 text-center">
            <div className="mx-auto w-[280px] h-[280px] rounded-xl bg-white grid place-items-center overflow-hidden">
              {qrDataUrl ? <img src={qrDataUrl} alt="KHQR" width={280} height={280} /> : <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
            </div>
            <div className="text-sm">
              <div className="font-semibold">${tx.amountUSD.toFixed(2)} → {tx.coins.toLocaleString()} coins</div>
              <div className="text-xs text-muted-foreground mt-1">នឹងផុតក្នុង <span className="font-mono text-foreground">{mm}:{ss}</span></div>
            </div>
            <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Copy className="h-3.5 w-3.5" /> ចម្លង QR string
            </button>
            <p className="text-[11px] text-muted-foreground">បើក Bakong/ABA/Wing → Scan QR → បង់ → រង់ចាំ ៤–៦ វិនាទី។</p>

            <div className="pt-2 border-t border-border/40 mt-2">
              <p className="text-[11px] text-muted-foreground mb-2">បើបង់រួចហើយ ផ្ញើរូប slip ទៅ Admin (Telegram)</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickProof(f); e.currentTarget.value = ""; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {proofSent ? "ផ្ញើរួច ✓ ផ្ញើម្តងទៀត" : "ផ្ទុករូប slip"}
              </button>
            </div>
          </div>
        )}

        {tx && status === "paid" && (
          <div className="text-center space-y-3 py-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/20 grid place-items-center"><Check className="h-7 w-7 text-emerald-400" /></div>
            <div className="font-display text-lg">បានបញ្ចូលជោគជ័យ!</div>
            <div className="text-sm text-muted-foreground">+{tx.coins.toLocaleString()} coins</div>
            <button onClick={onClose} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">បិទ</button>
          </div>
        )}

        {tx && status === "expired" && (
          <div className="text-center space-y-3 py-4">
            <div className="text-amber-400 font-semibold">QR ផុតកំណត់</div>
            <button onClick={() => { setTx(null); setStatus("idle"); }} className="rounded-full border border-border px-5 py-2 text-sm hover:bg-accent">សាកល្បងម្តងទៀត</button>
          </div>
        )}
      </div>
    </div>
  );
}
