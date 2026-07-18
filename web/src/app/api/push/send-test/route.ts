import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWebPush } from "@/lib/push/vapid";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", user.id);

  const webpush = getWebPush();
  const results = await Promise.allSettled(
    (subs ?? []).map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: "GiftList test",
          body: "Push notifications are wired up correctly.",
          url: "/dashboard",
        })
      )
    )
  );

  return NextResponse.json({ sent: results.length });
}
