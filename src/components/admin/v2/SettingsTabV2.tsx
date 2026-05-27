import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { getAppSettings, updateAppSettings } from "@/lib/admin.functions";

export function SettingsTabV2() {
  const get = useServerFn(getAppSettings);
  const upd = useServerFn(updateAppSettings);
  const [s, setS] = useState<Awaited<ReturnType<typeof getAppSettings>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { get().then(setS).catch(() => {}); }, [get]);

  if (!s) return <div className="py-10 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const save = async () => {
    setBusy(true);
    try {
      await upd({ data: {
        coins_per_usd: Number(s.coins_per_usd) || 1,
        tx_ttl_min: Number(s.tx_ttl_min) || 5,
        tus_max_net_retries: Number(s.tus_max_net_retries) || 50,
        tus_retry_delays_ms: Array.isArray(s.tus_retry_delays_ms) ? s.tus_retry_delays_ms as number[] : [0, 1000, 3000, 5000, 10000],
        tus_backoff_base_ms: Number(s.tus_backoff_base_ms) || 3000,
        tus_backoff_step_ms: Number(s.tus_backoff_step_ms) || 2000,
        tus_backoff_cap_ms: Number(s.tus_backoff_cap_ms) || 30000,
      } });
      toast.success("Saved");
    } catch { toast.error("Failed"); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Store configuration.</p>
      </div>
      <div className="rounded-2xl border border-border bg-background p-5 space-y-4">
        <Row label="Coins per USD"><input type="number" value={s.coins_per_usd} onChange={(e) => setS({ ...s, coins_per_usd: Number(e.target.value) })} className="input" /></Row>
        <Row label="QR expiry (minutes)"><input type="number" value={s.tx_ttl_min} onChange={(e) => setS({ ...s, tx_ttl_min: Number(e.target.value) })} className="input" /></Row>
        <button disabled={busy} onClick={save} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
        <style>{`.input { width: 100%; height: 2.25rem; border-radius: 0.625rem; border: 1px solid hsl(var(--border)); background: hsl(var(--background)); padding: 0 0.75rem; font-size: 0.875rem; }`}</style>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
