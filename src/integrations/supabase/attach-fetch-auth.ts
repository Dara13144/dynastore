// Client-only: forward the current Supabase access token on every
// /_serverFn/* fetch so `requireSupabaseAuth` middleware can authenticate.
import { supabase } from "./client";

if (typeof window !== "undefined" && !(window as any).__lvSupaFetchPatched) {
  (window as any).__lvSupaFetchPatched = true;
  const origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url && url.includes("/_serverFn/")) {
        const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
        if (!headers.has("authorization")) {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          if (token) headers.set("authorization", `Bearer ${token}`);
        }
        return origFetch(input, { ...init, headers });
      }
    } catch {
      /* fall through to original fetch */
    }
    return origFetch(input, init);
  };
}
