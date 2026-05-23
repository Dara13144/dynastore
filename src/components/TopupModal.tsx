import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "react-qr-code";
import {
  X,
  Wallet,
  Loader2,
  Upload,
  Check,
  Clock,
  AlertCircle,
  Download,
  Zap,
  FileImage,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getTopupConfig,
  createTopupRequest,
  listMyTopupRequests,
  createBakongTopup,
  verifyBakongTopup,
} from "@/lib/topup.functions";
import khqrSeal from "@/assets/khqr-seal.png";
import staticKhqrImg from "@/assets/static-khqr.png";
import { TutorialVideo } from "@/components/TutorialVideo";

type Props = { onClose: () => void; onToast: (m: string) => void };
type Mode = "auto" | "manual";

const PRESETS = [1, 2, 5, 10, 20, 50];
const MERCHANT_NAME = "SOTHIDA BEN";
const KHQR_RED = "#E21A23";

function KhqrCard({
  qrValue,
  amount,
  innerRef,
}: {
  qrValue: string | null;
  amount: number;
  innerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={innerRef}
      className="w-full overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5"
    >
      {/* Red header with notched bottom-right corner + KHQR wordmark */}
      <div
        className="flex items-center justify-center py-3"
        style={{
          backgroundColor: KHQR_RED,
          clipPath: "polygon(0 0, 100% 0, 100% 55%, 86% 100%, 0 100%)",
        }}
      >
        <span className="text-white font-black tracking-widest text-xl leading-none">
          KHQR
        </span>
      </div>

      {/* Merchant + amount */}
      <div className="px-5 pt-4">
        <div className="text-[13px] font-semibold uppercase tracking-wider text-black">
          {MERCHANT_NAME}
        </div>
        <div className="mt-1 text-3xl font-bold text-black tabular-nums">
          {amount > 0 ? amount.toFixed(2) : "0"}
        </div>
      </div>

      {/* Dashed separator */}
      <div className="px-5 py-3">
        <div className="border-t border-dashed border-black/30" />
      </div>

      {/* QR */}
      <div className="px-5 pb-5 flex justify-center">
        <div className="relative">
          {qrValue ? (
            <QRCode
              value={qrValue}
              size={240}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              viewBox="0 0 256 256"
            />
          ) : (
            <div className="h-[240px] w-[240px] grid place-items-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {/* Center KHQR seal */}
          {qrValue && (
            <img
              src={khqrSeal}
              alt="KHQR"
              width={56}
              height={56}
              loading="lazy"
              className="absolute inset-0 m-auto h-14 w-14 rounded-full ring-2 ring-white shadow object-cover bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

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
    id: string;
    qr: string;
    coins: number;
    amount: number;
    expiresAt: number;
  } | null>(null);
  const [autoStatus, setAutoStatus] = useState<
    "idle" | "creating" | "waiting" | "paid" | "expired"
  >("idle");
  const [now, setNow] = useState(Date.now());

  const coins = useMemo(() => Math.round(amount * rate), [amount, rate]);

  useEffect(() => {
    (async () => {
      try {
        const c = await cfgFn();
        setStaticQr(c.qr);
        setRate(c.coins_per_usd);
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
    let failures = 0; // consecutive transient/network failures
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
          const h = await listFn();
          setHistory(h);
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
          // Backoff: 10s → 15s → 20s (cap)
          schedule(Math.min(20000, 5000 + failures * 5000));
          return;
        }

        // pending, healthy — reset counter and continue at 5s
        if (failures > 0) {
          failures = 0;
          warnedFailure = false;
        }
        schedule(5000);
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
        schedule(Math.min(20000, 5000 + failures * 5000));
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
    if (amount < 0.5) {
      onToast("ចំនួនទឹកប្រាក់តូចពេក");
      return;
    }
    setAutoStatus("creating");
    try {
      const r = await createAutoFn({ data: { amount_usd: amount } });
      setAutoSession({
        id: r.id,
        qr: r.qr_payload,
        coins: r.coins,
        amount: r.amount_usd,
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
    if (!f.type.startsWith("image/")) {
      onToast("សូមជ្រើសរើសរូបភាព");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      onToast("រូបភាពធំជាង 5MB");
      return;
    }
    setSlipFile(f);
    setSlipPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!slipFile) {
      onToast("សូមបញ្ជូនរូបបង្កាន់ដៃ");
      return;
    }
    if (amount < 0.5) {
      onToast("ចំនួនទឹកប្រាក់តូចពេក");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("មិនទាន់ login");
      const ext = slipFile.name.split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("topup-slips").upload(path, slipFile, {
        contentType: slipFile.type,
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);
      await submitFn({ data: { amount_usd: amount, slip_path: path, note: note || undefined } });
      onToast(`✓ បានបញ្ជូនសំណើ — Admin នឹងបញ្ជាក់ឆាប់ៗ`);
      setSlipFile(null);
      setSlipPreview(null);
      setNote("");
      const h = await listFn();
      setHistory(h);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "មានបញ្ហា");
    } finally {
      setSubmitting(false);
    }
  }

  function downloadQrPng() {
    downloadKhqrCard(qrBoxRef, qrName.trim() || "dynastore-khqr", amount);
  }

  function downloadAutoQrPng() {
    if (!autoSession) return;
    const fname = `dynastore-khqr-$${autoSession.amount.toFixed(2)}-${autoSession.id.slice(0, 8)}`;
    downloadKhqrCard(autoQrBoxRef, fname, autoSession.amount);
  }

  function downloadKhqrCard(
    ref: React.RefObject<HTMLDivElement | null>,
    filename: string,
    amountUsd: number,
  ) {
    const svg = ref.current?.querySelector("svg");
    if (!svg) {
      onToast("QR មិនទាន់រួចរាល់");
      return;
    }
    setExporting(true);
    const safeName = filename.replace(/[^a-zA-Z0-9_\-.]+/g, "-").slice(0, 80);
    const xml = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = async () => {
      try {
        // Card layout
        const W = 720;
        const HEADER_H = 90;
        const BODY_PAD = 40;
        const QR_SIZE = 560;
        const TEXT_BLOCK_H = 130;
        const SEP_H = 30;
        const QR_PAD_BOTTOM = 40;
        const H = HEADER_H + TEXT_BLOCK_H + SEP_H + QR_SIZE + QR_PAD_BOTTOM;

        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d")!;

        // White background
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, W, H);

        // Red header with notched bottom-right corner
        ctx.fillStyle = KHQR_RED;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(W, 0);
        ctx.lineTo(W, HEADER_H * 0.55);
        ctx.lineTo(W * 0.86, HEADER_H);
        ctx.lineTo(0, HEADER_H);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 44px system-ui, -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("KHQR", W / 2, HEADER_H / 2);

        // Merchant + amount
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "#111111";
        ctx.font = "600 24px system-ui, -apple-system, sans-serif";
        ctx.fillText(MERCHANT_NAME, BODY_PAD, HEADER_H + 36);
        ctx.font = "800 52px system-ui, -apple-system, sans-serif";
        const amtText = amountUsd > 0 ? amountUsd.toFixed(2) : "0";
        ctx.fillText(amtText, BODY_PAD, HEADER_H + 96);

        // Dashed separator
        const sepY = HEADER_H + TEXT_BLOCK_H + SEP_H / 2;
        ctx.strokeStyle = "#bbbbbb";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(BODY_PAD, sepY);
        ctx.lineTo(W - BODY_PAD, sepY);
        ctx.stroke();
        ctx.setLineDash([]);

        // QR code (centered)
        const qrX = (W - QR_SIZE) / 2;
        const qrY = HEADER_H + TEXT_BLOCK_H + SEP_H;
        ctx.drawImage(img, qrX, qrY, QR_SIZE, QR_SIZE);

        // Center KHQR seal (image)
        const cx = W / 2;
        const cy = qrY + QR_SIZE / 2;
        const r = 56;
        // White ring background
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
        ctx.fill();

        const sealImg = new Image();
        sealImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve) => {
          sealImg.onload = () => resolve();
          sealImg.onerror = () => resolve();
          sealImg.src = khqrSeal;
        });
        if (sealImg.complete && sealImg.naturalWidth > 0) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(sealImg, cx - r, cy - r, r * 2, r * 2);
          ctx.restore();
        } else {
          ctx.fillStyle = KHQR_RED;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
        }

        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) {
            onToast("Export បរាជ័យ");
            setExporting(false);
            return;
          }
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${safeName}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          setExporting(false);
        }, "image/png");
      } catch {
        URL.revokeObjectURL(url);
        onToast("Export បរាជ័យ");
        setExporting(false);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      onToast("Export បរាជ័យ");
      setExporting(false);
    };
    img.src = url;
  }

  const secondsLeft = autoSession
    ? Math.max(0, Math.ceil((autoSession.expiresAt - now) / 1000))
    : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-auto rounded-3xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <h2 className="font-display text-lg flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" /> បញ្ចូល Balance
          </h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <TutorialVideo slug="topup" />

          <p className="text-xs text-muted-foreground">
            អត្រា៖{" "}
            <span className="text-foreground font-semibold">
              $1 = {rate.toLocaleString()} coins
            </span>
          </p>

          {/* Amount input (shared) */}
          {(autoStatus === "idle") && (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  ចំនួន (USD)
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setAmount(p)}
                      className={`rounded-full px-3 py-2 text-xs font-semibold ring-1 ${amount === p ? "bg-primary/15 text-primary ring-primary" : "ring-border hover:bg-accent"}`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-2 w-full rounded-xl bg-input px-3 py-2 text-sm ring-1 ring-border focus:ring-primary outline-none"
                />
                <div className="mt-1.5 text-xs text-muted-foreground">
                  នឹងទទួលបាន{" "}
                  <span className="text-primary font-semibold">{coins.toLocaleString()} coins</span>
                </div>
              </div>
            </div>
          )}

          {/* AUTO MODE */}
          {mode === "auto" && (
            <>
              {autoStatus === "idle" && (
                <>
                  <div className="mx-auto w-full max-w-[280px] rounded-2xl bg-white p-3 shadow-md ring-1 ring-black/5">
                    <img
                      src={staticKhqrImg}
                      alt="KHQR"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                </>
              )}
              {autoStatus === "creating" && (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              {autoStatus === "waiting" && autoSession && (
                <div className="mx-auto w-full max-w-[320px] flex flex-col items-center gap-3">
                  <KhqrCard
                    innerRef={autoQrBoxRef}
                    qrValue={autoSession.qr}
                    amount={autoSession.amount}
                  />
                  <div className="w-full rounded-xl bg-muted/30 p-3 text-center">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>កំពុងរង់ចាំការទូទាត់…</span>
                    </div>
                    <div className="mt-1 text-2xl font-mono font-bold tabular-nums">
                      {mm}:{ss}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      ស្គេន QR តាម Bakong/ABA/Wing → coins នឹងបញ្ចូលដោយស្វ័យប្រវត្តិ
                    </div>
                  </div>
                  <button
                    onClick={downloadAutoQrPng}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {exporting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {exporting ? "កំពុង Export…" : "ទាញយក QR (PNG)"}
                  </button>
                  <button
                    onClick={resetAuto}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    បោះបង់
                  </button>
                </div>
              )}
              {autoStatus === "paid" && autoSession && (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center space-y-2">
                  <Check className="h-10 w-10 text-emerald-400 mx-auto" />
                  <div className="font-bold text-emerald-300">បានបញ្ចូលដោយជោគជ័យ!</div>
                  <div className="text-sm">+{autoSession.coins.toLocaleString()} coins</div>
                  <button
                    onClick={() => {
                      resetAuto();
                    }}
                    className="mt-2 rounded-full bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold"
                  >
                    បន្ថែមទៀត
                  </button>
                </div>
              )}
              {autoStatus === "expired" && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-2">
                  <Clock className="h-10 w-10 text-amber-400 mx-auto" />
                  <div className="font-bold text-amber-300">QR ផុតកំណត់</div>
                  <div className="text-xs text-muted-foreground">
                    បើបានបង់ប្រាក់រួចហើយ សូមរង់ចាំបន្តិច ឬ Upload Slip ជំនួស
                  </div>
                  <button
                    onClick={resetAuto}
                    className="mt-2 rounded-full bg-primary text-primary-foreground px-5 py-2 text-xs font-semibold"
                  >
                    សាកល្បងម្តងទៀត
                  </button>
                </div>
              )}
            </>
          )}


        </div>
      </div>
    </div>
  );
}
