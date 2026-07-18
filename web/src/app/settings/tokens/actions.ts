"use server";

import { randomBytes, createHash } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function generateToken(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim() || "Browser extension";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawToken = `gl_${randomBytes(24).toString("hex")}`;

  const { error } = await supabase
    .from("api_tokens")
    .insert({ user_id: user.id, label, token_hash: hashToken(rawToken) });

  if (error) {
    console.error(error);
    return;
  }

  redirect(`/settings/tokens?new=${rawToken}`);
}

export async function revokeToken(tokenId: string) {
  const supabase = await createClient();
  await supabase.from("api_tokens").delete().eq("id", tokenId);
  revalidatePath("/settings/tokens");
}
