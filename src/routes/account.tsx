import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Save,
  LogOut,
  Copy,
  Check,
  User as UserIcon,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { StoreProvider, useStore } from "@/lib/store";
import { useSession } from "@/hooks/use-session";
import { TopupModal } from "@/components/TopupModal";

import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "គណនី — Dyna Store" },
      {
        name: "description",
        content:
          "មើល និងកែប្រែព័ត៌មានគណនី Dyna Store, គ្រប់គ្រង Balance, និងការកំណត់ផ្ទាល់ខ្លួនរបស់អ្នក។",
      },
      { property: "og:title", content: "គណនី — Dyna Store" },
      {
        property: "og:description",
        content: "គ្រប់គ្រងព័ត៌មានគណនី Dyna Store, Balance, និងការកំណត់ផ្ទាល់ខ្លួនរបស់អ្នក។",
      },
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

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2400);
  };
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
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        កំពុងផ្ទុក…
      </div>
    );
  }

  const user = session.user;
  const provider = user.app_metadata?.provider ?? "email";
  const createdAt = user.created_at ? new Date(user.created_at).toLocaleString() : "—";
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—";

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
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
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/70 border-b border-border/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoD} alt="Dyna Store" className="h-9 w-9 rounded-xl" />
            <span className="font-display text-xl gradient-text">Dyna Store</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> ត្រឡប់
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-3xl space-y-6">
        <div>
          <h1 className="font-display text-3xl">គណនីរបស់អ្នក</h1>
          <p className="text-sm text-muted-foreground mt-1">
            មើល និងកែប្រែព័ត៌មានគណនីទាំងអស់នៅទីនេះ។
          </p>
        </div>

        {/* Profile card */}
        <section className="glass rounded-2xl border border-border/60 p-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-primary/15 grid place-items-center text-primary text-xl font-semibold shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                />
              ) : (
                <UserIcon className="h-7 w-7" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-display text-xl truncate">
                {profile.display_name || "Player"}
              </div>
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
                <span
                  className={`text-xs ${msg.type === "ok" ? "text-primary" : "text-destructive"}`}
                >
                  {msg.text}
                </span>
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
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Balance បច្ចុប្បន្ន
              </div>
              <div className="font-display text-2xl">{balance.toLocaleString()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTopupOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              បញ្ចូល Balance
            </button>
            <button
              onClick={() => {
                refreshWallet();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              <RefreshCw className="h-3.5 w-3.5" /> ផ្ទុកឡើងវិញ
            </button>
          </div>
        </section>

        {/* Account details */}
        <section className="glass rounded-2xl border border-border/60 p-6">
          <h2 className="font-semibold text-sm mb-4">ព័ត៌មានគណនី</h2>
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <Info
              label="អ៊ីមែល"
              value={user.email ?? "—"}
              onCopy={() => copy("email", user.email ?? "")}
              copied={copied === "email"}
            />
            <Info
              label="User ID"
              value={user.id}
              mono
              onCopy={() => copy("uid", user.id)}
              copied={copied === "uid"}
            />
            <Info label="វិធីចូល" value={String(provider)} />
            <Info
              label="អ៊ីមែលបានបញ្ជាក់"
              value={user.email_confirmed_at ? "បាទ/ចាស" : "មិនទាន់"}
            />
            <Info label="បង្កើតគណនី" value={createdAt} />
            <Info label="ចូលចុងក្រោយ" value={lastSignIn} />
            {profile.created_at && (
              <Info label="Profile បង្កើត" value={new Date(profile.created_at).toLocaleString()} />
            )}
            {profile.updated_at && (
              <Info
                label="Profile កែចុងក្រោយ"
                value={new Date(profile.updated_at).toLocaleString()}
              />
            )}
          </dl>
        </section>

        {/* Danger zone */}
        <section className="glass rounded-2xl border border-border/60 p-6">
          <h2 className="font-semibold text-sm mb-3">សកម្មភាព</h2>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 text-destructive px-4 py-2 text-xs hover:bg-destructive/10"
          >
            <LogOut className="h-3.5 w-3.5" /> ចាកចេញពីគណនី
          </button>
        </section>
      </main>
      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} onToast={showToast} />}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] rounded-full bg-foreground text-background px-5 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
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

function Info({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-center gap-2">
        <div className={`flex-1 truncate text-sm ${mono ? "font-mono text-xs" : ""}`} title={value}>
          {value}
        </div>
        {onCopy && (
          <button
            onClick={onCopy}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground"
            aria-label="Copy"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
