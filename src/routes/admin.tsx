import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreProvider, useStore } from "@/lib/store";
import { AdminShell, type AdminTab } from "@/components/admin/v2/AdminShell";
import { DashboardTabV2 } from "@/components/admin/v2/DashboardTabV2";
import { ProductsTabV2 } from "@/components/admin/v2/ProductsTabV2";
import { OrdersTabV2 } from "@/components/admin/v2/OrdersTabV2";
import { WalletsTabV2 } from "@/components/admin/v2/WalletsTabV2";
import { SettingsTabV2 } from "@/components/admin/v2/SettingsTabV2";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — DYNASTORE" },
      { name: "description", content: "DYNASTORE admin dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <StoreProvider>
      <AdminPage />
    </StoreProvider>
  ),
});

function AdminPage() {
  const { authed, loading } = useStore();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<AdminTab>("dashboard");

  useEffect(() => {
    if (loading) return;
    if (!authed) { navigate({ to: "/login" }); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!data);
    })();
  }, [authed, loading, navigate]);

  if (loading || isAdmin === null) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-6">
        <div>
          <h1 className="text-xl font-bold mb-2">Admin only</h1>
          <p className="text-sm text-muted-foreground">This page is restricted to admins.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell tab={tab} onChange={setTab}>
      {tab === "dashboard" && <DashboardTabV2 />}
      {tab === "products" && <ProductsTabV2 />}
      {tab === "orders" && <OrdersTabV2 />}
      {tab === "wallets" && <WalletsTabV2 />}
      {tab === "settings" && <SettingsTabV2 />}
    </AdminShell>
  );
}
