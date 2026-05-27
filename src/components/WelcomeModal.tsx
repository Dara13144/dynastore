import { useEffect, useState } from "react";
import { X } from "lucide-react";
import banner from "@/assets/welcome-banner.png";

const STORAGE_KEY = "dyna_welcome_seen_v1";
const TELEGRAM_URL = "https://t.me/darazzdev";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(STORAGE_KEY)) {
        const t = setTimeout(() => setOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch {/* ignore */}
  }, []);

  const close = () => {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {/* ignore */}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
      onClick={close}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-border bg-card shadow-2xl animate-in zoom-in-95"
      >
        {/* NEW ribbon */}
        <div className="absolute top-0 right-0 z-10 overflow-hidden w-24 h-24 pointer-events-none">
          <div className="absolute top-4 -right-8 rotate-45 bg-red-600 text-white text-[10px] font-bold tracking-wider py-1 w-32 text-center shadow-md">
            NEW!
          </div>
        </div>

        <button
          onClick={close}
          aria-label="Close"
          className="absolute top-2 left-2 z-10 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white grid place-items-center"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Banner image */}
        <div className="w-full bg-black">
          <img
            src={banner}
            alt="Dyna Store — Designing with passion"
            className="w-full h-auto object-cover"
          />
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <h2 className="font-display text-xl text-center gradient-text">
            តើលោកអ្នកចង់មាន Website សម្រាប់អាជីវកម្មមែនទេ?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Dyna Store កំពុងផ្តល់ឱកាសសម្រាប់អ្នកចង់មាន Website ផ្ទាល់ខ្លួនសម្រាប់លក់៖
          </p>
          <ul className="text-sm space-y-1.5 text-foreground">
            <li>• Premium Accounts</li>
            <li>• Digital Products</li>
            <li>• AI Tools</li>
            <li>• License Key</li>
          </ul>
          <p className="text-sm text-muted-foreground leading-relaxed">
            មាន Website Ready-Made, Payment System និង Support Setup គ្រប់ពេល។
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ចុះឈ្មោះសម្រាប់ Early Access Program ឥឡូវនេះ។
          </p>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={close}
              className="flex-1 rounded-xl border border-border bg-background px-5 py-3 text-sm font-semibold hover:bg-accent transition"
            >
              Close
            </button>
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-sm font-semibold hover:opacity-90 transition shadow-lg"
            >
              ចុះឈ្មោះឥឡូវនេះ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
