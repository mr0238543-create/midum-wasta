// عامل خدمة «تنظيف ذاتي»: يحلّ محل أي نسخة قديمة مخزّنة على هواتف المستخدمين.
// عند التفعيل: يمسح كل الكاش القديم، ثم يعيد تحميل الصفحات المفتوحة لتجلب أحدث نسخة، ثم يلغي نفسه.
// لا يعترض أي طلب شبكة (لا fetch handler)، فلا يمكنه تقديم محتوى قديم أبدًا.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) { /* تجاهل */ }
    await self.clients.claim();
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    await self.registration.unregister();
    for (const c of wins) { try { c.navigate(c.url); } catch (e) { /* تجاهل */ } }
  })());
});
