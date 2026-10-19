// Service Worker: يستقبل الإشعارات الفورية ويعرضها حتى لو التطبيق مغلق.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: event.data ? event.data.text() : "" }; }
  const title = d.title || "ميدوم والواسطي";
  event.waitUntil((async () => {
    // لو التطبيق مفتوح وظاهر أمام المستخدم، يكفيه التنبيه داخل التطبيق
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (all.some((c) => c.visibilityState === "visible")) return;
    await self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icon.svg",
    badge: "/icon.svg",
    dir: "rtl",
    lang: "ar",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    vibrate: [200, 100, 200],
    silent: false,
    data: { url: d.url || "/#/notifications" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/#/notifications", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        if ("navigate" in c) { try { await c.navigate(url); } catch { /* يكفي التركيز */ } }
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
