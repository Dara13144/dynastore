import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const recordClick = createServerFn({ method: "POST" })
  .inputValidator((data: { button_label: string }) => data)
  .handler(async ({ data, request }) => {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";
    const referrer = request.headers.get("referer") || "unknown";

    const { error } = await supabaseAdmin
      .from("click_tracking")
      .insert({
        button_label: data.button_label,
        visitor_ip: ip.split(",")[0]?.trim() || ip,
        user_agent: userAgent,
        referrer: referrer,
      });

    if (error) {
      console.error("Click tracking error:", error);
    }

    return { ok: true };
  });
