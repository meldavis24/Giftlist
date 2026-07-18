import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Resolves a Bearer token (from the browser extension) to a user id by looking
 * up its SHA-256 hash. Returns null if the Authorization header is missing or
 * the token doesn't match any issued token.
 */
export async function resolveBearerToken(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const tokenHash = createHash("sha256").update(match[1]).digest("hex");
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .single();

  if (!data) return null;

  await supabase
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data.user_id;
}
