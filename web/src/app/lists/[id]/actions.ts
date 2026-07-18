"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addItem(listId: string, formData: FormData) {
  const productUrl = String(formData.get("product_url") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim() || null;
  const targetPriceRaw = String(formData.get("target_price") ?? "").trim();
  const targetPrice = targetPriceRaw ? Number(targetPriceRaw) : null;
  if (!productUrl) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  let retailer: string | null = null;
  try {
    retailer = new URL(productUrl).hostname.replace(/^www\./, "");
  } catch {
    // leave retailer null if the URL doesn't parse
  }

  await supabase.from("list_items").insert({
    list_id: listId,
    added_by: user.id,
    product_url: productUrl,
    title,
    retailer,
    target_price: targetPrice,
  });

  revalidatePath(`/lists/${listId}`);
}

export async function claimItem(listId: string, itemId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("item_claims").insert({ item_id: itemId, claimed_by: user.id });
  revalidatePath(`/lists/${listId}`);
}

export async function unclaimItem(listId: string, itemId: string) {
  const supabase = await createClient();
  await supabase.from("item_claims").delete().eq("item_id", itemId);
  revalidatePath(`/lists/${listId}`);
}

export async function inviteMember(listId: string, formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = (String(formData.get("role") ?? "viewer") as "editor" | "viewer") || "viewer";
  if (!email) return;

  const supabase = await createClient();
  await supabase.from("list_members").insert({
    list_id: listId,
    invited_email: email,
    role,
    status: "pending",
  });

  revalidatePath(`/lists/${listId}`);
}

// Phase 2 will replace this with a real scheduled worker hitting retailer
// APIs/scrapers. For now it's a stub so the UI/DB plumbing is provable end to end.
export async function checkPriceNow(listId: string, itemId: string) {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("list_items")
    .select("current_price")
    .eq("id", itemId)
    .single();

  if (item) {
    await supabase.from("price_checks").insert({
      item_id: itemId,
      price: item.current_price ?? 0,
    });
  }

  revalidatePath(`/lists/${listId}`);
}
