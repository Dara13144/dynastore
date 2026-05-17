import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * External storage flow (currently AWS S3 via Lovable connector gateway).
 *
 * The browser asks the server for a short-lived signed PUT URL, then uploads
 * the file directly to S3 — bypassing Supabase's per-upload cap. The S3 object
 * key is stored on the game row (`file_path`) with `storage_provider = 's3'`.
 * Downloads later go through `getGameDownloadUrl`, which re-signs the key.
 */

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";

function requireGatewayEnv() {
  const lovable = process.env.LOVABLE_API_KEY;
  const s3 = process.env.AWS_S3_API_KEY;
  if (!lovable || !s3) {
    throw new Error(
      "AWS S3 connector មិនទាន់បានភ្ជាប់ — សូមទៅ Connectors > AWS S3 ដើម្បីភ្ជាប់ជាមុនសិន",
    );
  }
  return { lovable, s3 };
}

async function signS3Url(
  mode: "read" | "write",
  objectKey: string,
): Promise<{ url: string; method: string; expiresIn: number }> {
  const { lovable, s3 } = requireGatewayEnv();
  const res = await fetch(
    `${GATEWAY_BASE}/api/v1/sign_storage_url?provider=aws_s3&mode=${mode}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": s3,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ object_path: objectKey }),
    },
  );
  if (!res.ok) {
    throw new Error(`S3 sign ${mode} ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as {
    url: string;
    expires_in: number;
    method?: string;
  };
  return {
    url: json.url,
    expiresIn: json.expires_in,
    method: json.method ?? (mode === "write" ? "PUT" : "GET"),
  };
}

export async function signS3ReadUrl(objectKey: string): Promise<string> {
  const { url } = await signS3Url("read", objectKey);
  return url;
}

const SAFE_KEY = /^[a-zA-Z0-9._/-]+$/;

export const getS3SignedUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        key: z.string().min(1).max(512).regex(SAFE_KEY),
        contentType: z.string().min(1).max(128).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Admin only.
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("forbidden");

    const { url, expiresIn, method } = await signS3Url("write", data.key);
    return { uploadUrl: url, method, expiresIn, key: data.key };
  });

export const getS3Status = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("forbidden");
    return {
      connected: !!process.env.AWS_S3_API_KEY && !!process.env.LOVABLE_API_KEY,
    };
  });
