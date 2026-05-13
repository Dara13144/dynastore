import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, LogOut, Copy, Check, User as UserIcon, Wallet, Receipt, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import logoD from "@/assets/dyna-logo.jpeg";

type TxRow = {
  id: string;
  bakong_md5: string;
  amount_usd: number;
  coins: number;
  status: "pending" | "paid" | "failed" | "expired" | string;
  created_at: string;
  paid_at: string | null;
  expires_at: string;
};

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "គណនី — Dyna Store" },
      { name: "description", content: "មើល និងកែប្រែព័ត៌មានគណនី Dyna Store, គ្រប់គ្រង Balance, និងការកំណត់ផ្ទាល់ខ្លួនរបស់អ្នក។" },
      { property: "og:title", content: "គណនី — Dyna Store" },
      { property: "og:description", content: "គ្រប់គ្រងព័ត៌មានគណនី Dyna Store, Balance, និងការកំណត់ផ្ទាល់ខ្លួនរបស់អ្នក។" },
      { property: "og:url", content: "https://dynastore.lovable.app/account" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://dynastore.lovable.app/account" }],
  }),
  component: () => (
    <StoreProvider>
      <AccountPage />
    </StoreProvider>
  ),
});

function AccountPage() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { profile, signOut, updateProfile, refreshProfile, balance, refreshWallet } = useStore();
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const loadTxs = async () => {
    setTxLoading(true);
    const { data } = await supabase.from("transactions").select("id, amount_usd, coins, status, created_at, paid_at, expires_at").order("created_at", { ascending: false }).limit(50);
    setTxs((data ?? []) as TxRow[]);
    setTxLoading(false);
  };

  useEffect(() => { if (session) loadTxs(); }, [session]);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) navigate({ to: "/login" });
  }, [sessionLoading, session, navigate]);

  useEffect(() => {
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  if (sessionLoading || !session) {
    return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">កំពុងផ្ទុក…</div>;
  }

  const user = session.user;
  const provider = user.app_metadata?.provider ?? "email";
  const createdAt = user.created_at ? new Date(user.created_at).toLocaleString() : "—";
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—";

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const { error } = await updateProfile({
      display_name: displayName.trim() || "Player",
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    });
    setSaving(false);
    if (error) setMsg({ type: "err", text: error });
    else setMsg({ type: "ok", text: "បានរក្សាទុក" });
    setTimeout(() => setMsg(null), 2500);
  };

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoD} alt="Dyna Store" className="h-9 w-9 rounded-xl" />
            <span className="font-display text-xl gradient-text">Dyna Store</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
            <ArrowLeft className="h-3.5 w-3.5" /> ត្រឡប់
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-3xl">គណនីរបស់អ្នក</h1>
          <p className="text-sm text-muted-foreground mt-1">មើល និងកែប្រែព័ត៌មានគណនីទាំងអស់នៅទីនេះ។</p>
        </div>

        {/* Profile card */}
        <section className="glass rounded-2xl border border-border/60 p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-primary/15 grid place-items-center text-primary text-xl font-semibold shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />
              ) : (
                <UserIcon className="h-7 w-7" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-display text-xl truncate">{profile.display_name || "Player"}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>

          <form onSubmit={onSave} className="mt-6 space-y-4">
            <Field label="ឈ្មោះបង្ហាញ">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
              />
            </Field>
            <Field label="URL រូបភាព (ស្រេច)">
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary"
              />
            </Field>
            <Field label="ប្រវត្តិសង្ខេប (ស្រេច)">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                maxLength={280}
                className="w-full rounded-xl bg-input px-4 py-2.5 text-sm outline-none ring-1 ring-border focus:ring-primary resize-none"
              />
            </Field>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? "កំពុងរក្សាទុក…" : "រក្សាទុក"}
              </button>
              <button
                type="button"
                onClick={refreshProfile}
                className="rounded-full border border-border px-4 py-2 text-xs hover:bg-accent"
              >
                ផ្ទុកឡើងវិញ
              </button>
              {msg && (
                <span className={`text-xs ${msg.type === "ok" ? "text-primary" : "text-destructive"}`}>{msg.text}</span>
              )}
            </div>
          </form>
        </section>

        {/* Balance card */}
        <section className="glass rounded-2xl border border-border/60 p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/15 grid place-items-center text-primary">
              <Wallet className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Balance បច្ចុប្បន្ន</div>
              <div className="font-display text-2xl">{balance.toLocaleString()}</div>
            </div>
          </div>
          <button onClick={() => { refreshWallet(); loadTxs(); }} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent">
            <RefreshCw className="h-3.5 w-3.5" /> ផ្ទុកឡើងវិញ
          </button>
        </section>

        {/* Transactions / Topup history */}
        <section className="glass rounded-2xl border border-border/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm inline-flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" /> ប្រវត្តិ Topup
            </h2>
            <span className="text-[11px] text-muted-foreground">{txs.length} កំណត់ត្រា</span>
          </div>

          {txLoading ? (
            <div className="text-xs text-muted-foreground py-6 text-center">កំពុងផ្ទុក…</div>
          ) : txs.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">មិនទាន់មានការ Topup នៅឡើយទេ។</div>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border/60">
                    <th className="text-left px-2 py-2">ពេលវេលា</th>
                    <th className="text-right px-2 py-2">USD</th>
                    <th className="text-right px-2 py-2">Balance</th>
                    <th className="text-center px-2 py-2">ស្ថានភាព</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map((t) => {
                    const expired = t.status === "pending" && new Date(t.expires_at).getTime() < Date.now();
                    const status = expired ? "expired" : t.status;
                    return (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-muted/10">
                        <td className="px-2 py-2.5 text-xs">
                          <div>{new Date(t.created_at).toLocaleString()}</div>
                          {t.paid_at && <div className="text-[10px] text-emerald-400 mt-0.5">បានបង់: {new Date(t.paid_at).toLocaleString()}</div>}
                        </td>
                        <td className="px-2 py-2.5 text-right font-mono text-xs">${Number(t.amount_usd).toFixed(2)}</td>
                        <td className="px-2 py-2.5 text-right font-semibold text-xs">{t.coins.toLocaleString()}</td>
                        <td className="px-2 py-2.5 text-center"><StatusPill status={status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Account details */}
        <section className="glass rounded-2xl border border-border/60 p-6">
          <h2 className="font-semibold text-sm mb-4">ព័ត៌មានគណនី</h2>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <Info label="អ៊ីមែល" value={user.email ?? "—"} onCopy={() => copy("email", user.email ?? "")} copied={copied === "email"} />
            <Info label="User ID" value={user.id} mono onCopy={() => copy("uid", user.id)} copied={copied === "uid"} />
            <Info label="វិធីចូល" value={String(provider)} />
            <Info label="អ៊ីមែលបានបញ្ជាក់" value={user.email_confirmed_at ? "បាទ/ចាស" : "មិនទាន់"} />
            <Info label="បង្កើតគណនី" value={createdAt} />
            <Info label="ចូលចុងក្រោយ" value={lastSignIn} />
            {profile.created_at && <Info label="Profile បង្កើត" value={new Date(profile.created_at).toLocaleString()} />}
            {profile.updated_at && <Info label="Profile កែចុងក្រោយ" value={new Date(profile.updated_at).toLocaleString()} />}
          </dl>
        </section>

        {/* Danger zone */}
        <section className="glass rounded-2xl border border-border/60 p-6">
          <h2 className="font-semibold text-sm mb-3">សកម្មភាព</h2>
          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 text-destructive px-4 py-2 text-xs hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" /> ចាកចេញពីគណនី
          </button>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Info({ label, value, mono, onCopy, copied }: { label: string; value: string; mono?: boolean; onCopy?: () => void; copied?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2">
        <div className={`flex-1 truncate text-sm ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</div>
        {onCopy && (
          <button onClick={onCopy} className="rounded-md p-1 hover:bg-accent text-muted-foreground" aria-label="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    paid: { label: "បានបង់", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <Check className="h-3 w-3" /> },
    pending: { label: "កំពុងរង់ចាំ", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: <Clock className="h-3 w-3" /> },
    expired: { label: "ផុតកំណត់", cls: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", icon: <AlertTriangle className="h-3 w-3" /> },
    failed: { label: "បរាជ័យ", cls: "bg-destructive/15 text-destructive border-destructive/30", icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const v = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${v.cls}`}>
      {v.icon} {v.label}
    </span>
  );
}
