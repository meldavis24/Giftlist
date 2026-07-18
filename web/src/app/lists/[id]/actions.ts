"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { fetchProductPrice } from "@/lib/extract-price";
import { getWebPush } from "@/lib/push/vapid";

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

export async function deleteList(listId: string) {
  const supabase = await createClient();
  // RLS ("owner deletes list") already restricts this to the list's owner --
  // a non-owner's delete would just affect zero rows.
  await supabase.from("lists").delete().eq("id", listId);
  redirect("/dashboard");
}

export type CheckPriceResult =
  | { status: "not_found" }
  | { status: "unchanged"; price: number }
  | { status: "updated"; price: number; notified: boolean };

// The scheduled worker (worker/) does this same check automatically and on a
// timer; this is the same logic triggered on demand from the UI.
export async function checkPriceNow(listId: string, itemId: string): Promise<CheckPriceResult> {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("list_items")
    .select("id, list_id, product_url, title, retailer, current_price, target_price")
    .eq("id", itemId)
    .single();
  if (!item) return { status: "not_found" };

  const newPrice = await fetchProductPrice(item.product_url);
  if (newPrice == null) {
    revalidatePath(`/lists/${listId}`);
    return { status: "not_found" };
  }

  if (newPrice === item.current_price) {
    return { status: "unchanged", price: newPrice };
  }

  await supabase.from("price_checks").insert({ item_id: itemId, price: newPrice });
  await supabase.from("list_items").update({ current_price: newPrice }).eq("id", itemId);

  const hitTarget = item.target_price != null && newPrice <= item.target_price;
  const isNewDrop = item.current_price == null || newPrice < item.current_price;
  let notified = false;
  if (hitTarget && isNewDrop) {
    await notifyListMembers(item, newPrice);
    notified = true;
  }

  revalidatePath(`/lists/${listId}`);
  return { status: "updated", price: newPrice, notified };
}

async function notifyListMembers(
  item: {
    list_id: string;
    title: string | null;
    retailer: string | null;
    target_price: number | null;
  },
  newPrice: number
) {
  const service = createServiceClient();

  const { data: list } = await service
    .from("lists")
    .select("owner_id")
    .eq("id", item.list_id)
    .single();
  if (!list) return;

  const { data: members } = await service
    .from("list_members")
    .select("user_id")
    .eq("list_id", item.list_id)
    .eq("status", "accepted");

  const userIds = [...new Set([list.owner_id, ...(members ?? []).map((m) => m.user_id)])].filter(
    (id): id is string => Boolean(id)
  );
  if (!userIds.length) return;

  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (!subs?.length) return;

  const webpush = getWebPush();
  const payload = JSON.stringify({
    title: "Price drop!",
    body: `${item.title || item.retailer || "An item"} is now $${newPrice} (target: $${item.target_price})`,
    url: `/lists/${item.list_id}`,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await service.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}
