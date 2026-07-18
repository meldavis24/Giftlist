import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { extractPrice } from "./extractPrice.js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT = "mailto:example@example.com",
  APP_URL = "http://localhost:3000",
  CHECK_INTERVAL_MINUTES = "60",
  FETCH_DELAY_MS = "1500",
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error("Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY -- notifications won't send.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function notifyListMembers(item, newPrice) {
  const { data: list } = await supabase
    .from("lists")
    .select("owner_id")
    .eq("id", item.list_id)
    .single();
  if (!list) return;

  const { data: members } = await supabase
    .from("list_members")
    .select("user_id")
    .eq("list_id", item.list_id)
    .eq("status", "accepted");

  const userIds = [...new Set([list.owner_id, ...(members ?? []).map((m) => m.user_id)])].filter(
    Boolean
  );
  if (!userIds.length) return;

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);

  const payload = JSON.stringify({
    title: "Price drop!",
    body: `${item.title || item.retailer || "An item"} is now $${newPrice} (target: $${item.target_price})`,
    url: `${APP_URL}/lists/${item.list_id}`,
  });

  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error(`Push failed for subscription ${sub.id}:`, err.message);
      }
    }
  }
}

async function checkItem(item) {
  let html;
  try {
    html = await fetchHtml(item.product_url);
  } catch (err) {
    console.warn(`[skip] ${item.product_url} -- ${err.message}`);
    return;
  }

  const newPrice = extractPrice(html);
  if (newPrice == null) {
    console.warn(`[no price found] ${item.product_url}`);
    return;
  }

  if (newPrice !== item.current_price) {
    await supabase.from("price_checks").insert({ item_id: item.id, price: newPrice });
    await supabase.from("list_items").update({ current_price: newPrice }).eq("id", item.id);
  }

  const hitTarget = item.target_price != null && newPrice <= item.target_price;
  const isNewDrop = item.current_price == null || newPrice < item.current_price;
  if (hitTarget && isNewDrop) {
    console.log(`[price drop] ${item.product_url} -> $${newPrice}`);
    await notifyListMembers(item, newPrice);
  }
}

async function runCheck() {
  console.log(`\n[${new Date().toISOString()}] Checking prices...`);
  const { data: items, error } = await supabase
    .from("list_items")
    .select("id, list_id, product_url, title, retailer, current_price, target_price");

  if (error) {
    console.error("Failed to load list_items:", error.message);
    return;
  }

  for (const item of items ?? []) {
    await checkItem(item);
    await sleep(Number(FETCH_DELAY_MS));
  }
  console.log(`Checked ${items?.length ?? 0} item(s).`);
}

const runOnce = process.argv.includes("--once");

if (runOnce) {
  await runCheck();
  process.exit(0);
} else {
  await runCheck();
  setInterval(runCheck, Number(CHECK_INTERVAL_MINUTES) * 60 * 1000);
}
