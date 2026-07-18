import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { User } from "@supabase/supabase-js";

/**
 * Runs on every authenticated page load: makes sure a profile row exists,
 * and attaches any pending list invites that were sent to this email address
 * before the person had an account.
 */
export async function bootstrapUser(
  supabase: SupabaseClient<Database>,
  user: User
) {
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email!,
      display_name: (user.user_metadata?.display_name as string) || user.email!.split("@")[0],
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  await supabase
    .from("list_members")
    .update({ user_id: user.id, status: "accepted" })
    .eq("invited_email", user.email!)
    .is("user_id", null);
}
