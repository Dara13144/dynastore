import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAdminPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      throw new Error("Forbidden: admin role required");
    }

    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("id, md5, user_id, amount_usd, coins, status, created_at, paid_at, expires_at, bakong_ref")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return { transactions: data ?? [] };
  });
