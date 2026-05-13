import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "ចូលប្រើ — Dyna Store" },
      { name: "description", content: "ចូលគណនី ឬចុះឈ្មោះ Dyna Store ដើម្បីទិញហ្គេម និងរក្សាទុកបណ្ណាល័យរបស់អ្នក។" },
      { property: "og:title", content: "ចូលប្រើ — Dyna Store" },
      { property: "og:description", content: "ចូលប្រើដោយ Email ឬ Google ដើម្បីបន្ថែម Balance, ទិញហ្គេម, និងគ្រប់គ្រងបណ្ណាល័យរបស់អ្នកនៅ Dyna Store។" },
      { property: "og:url", content: "https://dynastore.lovable.app/login" },
    ],
    links: [{ rel: "canonical", href: "https://dynastore.lovable.app/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setErr("ផ្ញើរអ៊ីមែលបញ្ជាក់រួច។ ពិនិត្យ inbox របស់អ្នក។");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const signInGoogle = async () => {
    setErr(null); setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (e: any) { setErr(e.message ?? "Google sign-in បរាជ័យ"); }
    finally { setBusy(false); }
  };

  const signInApple = async () => {
    setErr(null); setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (e: any) { setErr(e.message ?? "Apple sign-in បរាជ័យ"); }
    finally { setBusy(false); }
  };


  return (
    <main className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl glass p-8 shadow-[var(--shadow-card)]">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6">
          <img src={logoD} alt="" className="h-10 w-10 rounded-xl" />
          <span className="font-display text-2xl gradient-text">Dyna Store</span>
        </Link>
        <h1 className="font-display text-2xl text-center">{mode === "login" ? "ចូលប្រើគណនី" : "បង្កើតគណនី"}</h1>
        <p className="text-center text-sm text-muted-foreground mt-1">ស្វែងរក និងតាមដានហ្គេមដែលអ្នកចូលចិត្ត</p>

        <form onSubmit={submit} className="space-y-3 mt-6">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="អ៊ីមែល" className="w-full rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ពាក្យសម្ងាត់" className="w-full rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          {err && <div className="rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive">{err}</div>}
          <button disabled={busy} className="w-full rounded-full px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-hero)" }}>
            {busy ? "កំពុង..." : (mode === "login" ? "ចូលប្រើ" : "បង្កើតគណនី")}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> ឬ <div className="h-px flex-1 bg-border" />
        </div>

        <button
          onClick={signInGoogle}
          disabled={busy}
          className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-900 ring-1 ring-border transition hover:bg-zinc-100 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8L6.2 33C9.6 39.7 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.9 35.6 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          បន្តជាមួយ Google
        </button>

        <button
          onClick={signInApple}
          disabled={busy}
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-black px-5 py-3 text-sm font-semibold text-white ring-1 ring-border transition hover:bg-zinc-900 disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M16.365 1.43c0 1.14-.43 2.21-1.13 3.01-.74.85-1.95 1.5-3.04 1.42-.13-1.1.42-2.27 1.1-3.04.77-.86 2.05-1.5 3.07-1.39zM20.5 17.27c-.55 1.27-.81 1.84-1.52 2.96-.99 1.55-2.39 3.48-4.13 3.5-1.55.02-1.95-1.01-4.05-1-2.1.01-2.54 1.02-4.09.99-1.74-.02-3.06-1.77-4.05-3.32C-.06 16.92-.36 12.07 1.4 9.6c1.25-1.75 3.22-2.78 5.07-2.78 1.88 0 3.07 1.03 4.62 1.03 1.51 0 2.43-1.04 4.6-1.04 1.65 0 3.4.9 4.65 2.46-4.09 2.24-3.43 8.08.16 8.0z"/>
          </svg>
          បន្តជាមួយ Apple
        </button>

        <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === "login" ? "មិនទាន់មានគណនី? បង្កើតថ្មី" : "មានគណនីរួច? ចូលប្រើ"}
        </button>
      </div>
    </div>
  );
}
