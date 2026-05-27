import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  Languages,
  Wallet,
  
  ShoppingCart,
  ChevronDown,
  Package,
  History,
  Settings as SettingsIcon,
  Plus,
  
  LogOut,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useSession } from "@/hooks/use-session";
import logoAkira from "@/assets/akira-logo.png";


type Props = {
  onTopup?: () => void;
};

export function SiteHeader({ onTopup }: Props) {
  const { authed, balance, profile, signOut, isAdmin } = useStore();
  const { session } = useSession();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const initial = (profile?.display_name || "U").slice(0, 1).toUpperCase();
  const balanceLabel = `$${(balance || 0).toFixed(2)}`;

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5">
          <img src={logoAkira} alt="AkiraStore" className="h-9 w-9 rounded-lg object-cover" />
          <span className="font-semibold text-base text-foreground">AkiraStore</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            aria-label="Search"
            className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card hover:bg-muted transition"
          >
            <Search className="h-4 w-4 text-foreground" />
          </button>
          <button
            aria-label="Language"
            className="h-9 w-9 grid place-items-center rounded-full border border-border bg-card hover:bg-muted transition"
          >
            <Languages className="h-4 w-4 text-foreground" />
          </button>

          {authed ? (
            <>
              <button
                aria-label="Cart"
                className="hidden sm:inline-flex items-center gap-1.5 h-9 rounded-full border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
              >
                <ShoppingCart className="h-3.5 w-3.5" /> Cart
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="inline-flex items-center gap-1 h-9 pl-1 pr-2 rounded-full border border-border bg-card hover:bg-muted transition"
                >
                  <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                    {initial}
                  </span>
                  <span className="hidden md:inline text-xs font-medium text-foreground max-w-[100px] truncate">
                    {profile?.display_name || "Account"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-popover shadow-xl ring-1 ring-black/5 overflow-hidden">
                    <div className="p-4 flex flex-col items-center text-center border-b border-border">
                      <div className="relative">
                        <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-semibold">
                          {initial}
                        </div>
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-popover" />
                      </div>
                      <div className="mt-2 text-sm font-semibold text-foreground">
                        {profile?.display_name || "Account"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate max-w-full">
                        {session?.user?.email || ""}
                      </div>
                    </div>
                    <div className="py-2 text-sm">
                      <MenuItem icon={<Package className="h-4 w-4" />} label="Browse Products" onClick={() => { setMenuOpen(false); navigate({ to: "/" }); }} />
                      <MenuItem icon={<History className="h-4 w-4" />} label="Order History" onClick={() => { setMenuOpen(false); navigate({ to: "/library" }); }} />
                      <MenuItem icon={<SettingsIcon className="h-4 w-4" />} label="Account Settings" onClick={() => { setMenuOpen(false); navigate({ to: "/account" }); }} />
                      <MenuItem icon={<Plus className="h-4 w-4" />} label="Add Balance" onClick={() => { setMenuOpen(false); onTopup?.(); }} />
                      
                      {isAdmin && (
                        <MenuItem icon={<ShieldCheck className="h-4 w-4" />} label="Admin" onClick={() => { setMenuOpen(false); navigate({ to: "/admin" }); }} />
                      )}
                      <div className="my-1 mx-3 h-px bg-border" />
                      <MenuItem
                        icon={<LogOut className="h-4 w-4" />}
                        label="Sign Out"
                        destructive
                        onClick={async () => {
                          setMenuOpen(false);
                          await signOut();
                          navigate({ to: "/" });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 h-9 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <LogIn className="h-3.5 w-3.5" /> Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition text-left ${destructive ? "text-destructive" : "text-foreground"}`}
    >
      <span className={destructive ? "text-destructive" : "text-primary"}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
