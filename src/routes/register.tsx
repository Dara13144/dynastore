import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create Account — DYNASTORE" },
      { name: "description", content: "Create your DYNASTORE account." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referral, setReferral] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    if (username.trim().length < 3) {
      setErr("Username must be at least 3 characters");
      return;
    }
    setBusy(true);
    try {
      // Check username availability
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username.trim())
        .maybeSingle();
      if (existing) throw new Error("Username already taken");

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            username: username.trim(),
            full_name: fullName.trim(),
          },
        },
      });
      if (error) throw error;

      // Update profile with username/full_name/referral if user created
      if (data.user) {
        await supabase
          .from("profiles")
          .update({
            username: username.trim(),
            full_name: fullName.trim() || null,
            referral_code: referral.trim() || null,
            display_name: fullName.trim() || username.trim(),
          })
          .eq("user_id", data.user.id);
      }

      if (data.session) {
        navigate({ to: "/" });
      } else {
        setErr("Account created! Check your email to confirm.");
      }
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    setErr(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (e: unknown) {
      setErr((e as Error).message ?? "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-full bg-background px-4 py-3 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-emerald-500";
  const label = "block text-sm font-semibold mb-1.5";

  return (
    <main className="min-h-screen grid place-items-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl bg-card p-8 shadow-lg border">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-xl bg-emerald-600 grid place-items-center text-white">
            <User className="h-7 w-7" />
          </div>
        </div>
        <h1 className="mt-4 text-center text-3xl font-bold">Create Account</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Join thousands of happy customers</p>

        <button
          onClick={signInGoogle}
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-card px-5 py-3 text-sm font-semibold ring-1 ring-border transition hover:bg-muted disabled:opacity-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden>
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.4-11.3-8L6.2 33C9.6 39.7 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.2 5.2C40.9 35.6 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
          </svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> Or register with email <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Username</label>
              <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className={input} />
            </div>
            <div>
              <label className={label}>Full Name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className={input} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label}>Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className={input} />
            </div>
            <div>
              <label className={label}>Confirm Password</label>
              <input type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className={input} />
            </div>
          </div>
          <div>
            <label className={label}>Referral Code <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="ENTER REFERRAL CODE" className={input} />
          </div>

          {err && (
            <div className="rounded-lg bg-destructive/15 px-3 py-2 text-xs text-destructive">{err}</div>
          )}

          <button
            disabled={busy}
            className="w-full rounded-full bg-emerald-600 hover:bg-emerald-700 px-5 py-3.5 font-bold text-white disabled:opacity-50 transition"
          >
            {busy ? "Creating..." : "Create Account Now"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </main>
  );
}
