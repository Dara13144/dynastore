import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Package, ShoppingBag, Wallet, Settings as SettingsIcon, ArrowLeft, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type AdminTab = "dashboard" | "products" | "orders" | "wallets" | "settings";

const NAV: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "products", label: "Products", icon: Package },
  { id: "orders", label: "Orders", icon: ShoppingBag },
  { id: "wallets", label: "Wallets", icon: Wallet },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

type Props = {
  tab: AdminTab;
  onChange: (t: AdminTab) => void;
  children: ReactNode;
};

export function AdminShell({ tab, onChange, children }: Props) {
  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-background">
        <div className="px-4 h-16 flex items-center gap-2.5 border-b border-border">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="font-semibold text-sm text-foreground">DYNASTORE Admin</div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChange(item.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to store
          </Link>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {/* Mobile top nav */}
        <div className="md:hidden sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
          <div className="px-3 h-12 flex items-center gap-2 overflow-x-auto">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id)}
                  className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
