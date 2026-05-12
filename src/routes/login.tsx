import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import logoD from "@/assets/dyna-logo.jpeg";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "ចូលប្រើ — Dyna Store" },
      { name: "description", content: "ចូលគណនី Dyna Store ដើម្បីទិញ Coins និងហ្គេម។" },
    ],
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


  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl glass p-8 shadow-[var(--shadow-card)]">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-6">
          <img src={logoD} alt="" className="h-10 w-10 rounded-xl" />
          <span className="font-display text-2xl gradient-text">Dyna Store</span>
        </Link>
        <h1 className="font-display text-2xl text-center">{mode === "login" ? "ចូលប្រើគណនី" : "បង្កើតគណនី"}</h1>
        <p className="text-center text-sm text-muted-foreground mt-1">បង់ប្រាក់តាម Bakong KHQR ទិញ Coins និងហ្គេម</p>

        <form onSubmit={submit} className="space-y-3 mt-6">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="អ៊ីមែល" className="w-full rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ពាក្យសម្ងាត់" className="w-full rounded-xl bg-input px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-primary" />
          {err && <div className="rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive">{err}</div>}
          <button disabled={busy} className="w-full rounded-full px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50" style={{ background: "var(--gradient-hero)" }}>
            {busy ? "កំពុង..." : (mode === "login" ? "ចូលប្រើ" : "បង្កើតគណនី")}
          </button>
        </form>

        <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground">
          {mode === "login" ? "មិនទាន់មានគណនី? បង្កើតថ្មី" : "មានគណនីរួច? ចូលប្រើ"}
        </button>
      </div>
    </div>
  );
}
