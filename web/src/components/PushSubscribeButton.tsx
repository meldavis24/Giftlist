"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export default function PushSubscribeButton() {
  const [status, setStatus] = useState<"idle" | "subscribing" | "subscribed" | "unsupported">(
    "idle"
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      if (existing) setStatus("subscribed");
    });
  }, []);

  async function subscribe() {
    setStatus("subscribing");
    const registration = await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      alert("VAPID public key isn't configured yet (see .env.local.example).");
      setStatus("idle");
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    setStatus("subscribed");
  }

  if (status === "unsupported") return null;

  return (
    <button
      onClick={subscribe}
      disabled={status === "subscribing" || status === "subscribed"}
      className="text-sm text-neutral-500 underline disabled:no-underline"
    >
      {status === "subscribed" ? "Notifications on" : "Enable price-drop notifications"}
    </button>
  );
}
