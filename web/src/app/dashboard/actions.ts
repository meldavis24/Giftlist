"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createList(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const occasion = String(formData.get("occasion") ?? "").trim() || null;
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("lists")
    .insert({ owner_id: user.id, name, occasion })
    .select("id")
    .single();

  if (error || !data) {
    console.error(error);
    return;
  }

  revalidatePath("/dashboard");
  redirect(`/lists/${data.id}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
