import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { parseKhqr, type TlvTag, type FixRecommendation } from "@/lib/khqr-parser";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Wrench } from "lucide-react";

export const Route = createFileRoute("/admin/khqr-debug")({
  head: () => ({
    meta: [{ title: "KHQR Debug — Dyna Store Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: KhqrDebugPage,
});

function KhqrDebugPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login" });
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [navigate]);

  const result = useMemo(() => (input.trim() ? parseKhqr(input) : null), [input]);

  if (isAdmin === null) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <div className="p-8">Forbidden</div>;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin
        </Link>
        <header>
          <h1 className="text-2xl font-bold">KHQR Debug</h1>
          <p className="text-sm text-muted-foreground">
            Paste a KHQR payload (the text content of the QR, starts with <code>00020101...</code>)
            to inspect TLV tags, verify CRC16, and surface common Q0626 rejection causes.
          </p>
        </header>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={6}
          placeholder="00020101021229..."
          className="w-full font-mono text-sm p-3 rounded-md border border-border bg-card text-foreground"
        />

        {result && (
          <div className="space-y-4">
            <StatusBanner
              ok={result.ok}
              crcValid={result.crc.valid}
              errorCount={result.errors.length}
            />

            <Section title="CRC16">
              <div className="font-mono text-sm space-y-1">
                <div>
                  declared:{" "}
                  <span className={result.crc.valid ? "text-emerald-400" : "text-red-400"}>
                    {result.crc.declared ?? "—"}
                  </span>
                </div>
                <div>
                  computed: <span className="text-emerald-400">{result.crc.computed || "—"}</span>
                </div>
                <div>match: {result.crc.valid ? "✓" : "✗"}</div>
              </div>
            </Section>

            {result.errors.length > 0 && (
              <Section title={`Errors (${result.errors.length})`} tone="error">
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {result.errors.map((e, i) => (
                    <li key={i} className="text-red-300">
                      {e}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {result.recommendations.length > 0 && (
              <Section title={`How to fix (${result.recommendations.length})`} tone="fix">
                <div className="space-y-3">
                  {result.recommendations.map((r, i) => (
                    <RecommendationCard key={i} rec={r} />
                  ))}
                </div>
              </Section>
            )}

            <Section title={`Parsed Tags (${result.tags.length})`}>
              <div className="space-y-2">
                {result.tags.map((t, i) => (
                  <TagRow key={i} tag={t} />
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBanner({
  ok,
  crcValid,
  errorCount,
}: {
  ok: boolean;
  crcValid: boolean;
  errorCount: number;
}) {
  if (ok)
    return (
      <div className="flex items-center gap-2 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
        <CheckCircle2 className="h-5 w-5" /> Looks valid — banks should accept this KHQR.
      </div>
    );
  return (
    <div className="flex items-center gap-2 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-300">
      <XCircle className="h-5 w-5" />
      {errorCount} error{errorCount === 1 ? "" : "s"} found · CRC {crcValid ? "ok" : "invalid"}
    </div>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "error" | "fix";
}) {
  const cls =
    tone === "error"
      ? "border-red-500/30 bg-red-500/5"
      : tone === "fix"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-border bg-card";
  return (
    <section className={`rounded-md border p-4 ${cls}`}>
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}

const SEVERITY_STYLES: Record<FixRecommendation["severity"], string> = {
  critical: "bg-red-500/20 text-red-300 border-red-500/40",
  high: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  medium: "bg-sky-500/20 text-sky-300 border-sky-500/40",
};

function RecommendationCard({ rec }: { rec: FixRecommendation }) {
  return (
    <div className="rounded-md border border-border bg-card/60 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Wrench className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="font-semibold text-sm">{rec.title}</span>
        <span
          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${SEVERITY_STYLES[rec.severity]}`}
        >
          {rec.severity}
        </span>
        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-border text-muted-foreground">
          {rec.code}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{rec.why}</p>
      <div className="grid grid-cols-1 md:grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs font-mono">
        <span className="text-muted-foreground">field:</span>
        <span className="break-all">{rec.field}</span>
        <span className="text-muted-foreground">current:</span>
        <span className="break-all text-red-300">{rec.current}</span>
        <span className="text-muted-foreground">expected:</span>
        <span className="break-all text-emerald-300">{rec.expected}</span>
      </div>
      <div className="text-xs">
        <span className="text-muted-foreground font-mono">fix: </span>
        <span className="font-mono break-all">{rec.fix}</span>
      </div>
    </div>
  );
}

function TagRow({ tag, depth = 0 }: { tag: TlvTag; depth?: number }) {
  return (
    <div className="font-mono text-xs" style={{ marginLeft: depth * 16 }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">{tag.id}</span>
        <span className="text-muted-foreground">len={tag.length}</span>
        <span className="text-foreground break-all">{tag.value || "(empty)"}</span>
      </div>
      <div className="text-muted-foreground ml-1 mt-0.5 text-[11px] font-sans">{tag.name}</div>
      {tag.warnings.map((w, i) => (
        <div
          key={i}
          className="ml-1 mt-0.5 text-[11px] font-sans text-amber-400 flex items-start gap-1"
        >
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
        </div>
      ))}
      {tag.children && tag.children.length > 0 && (
        <div className="mt-2 space-y-2 border-l border-border/50 pl-3">
          {tag.children.map((c, i) => (
            <TagRow key={i} tag={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
