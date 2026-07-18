self.addEventListener("push", (event) => {
  let payload = { title: "GiftList", body: "Something on your list changed." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // fall back to the default payload if the push body isn't JSON
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon.png",
      data: { url: payload.url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(self.clients.openWindow(url));
});
