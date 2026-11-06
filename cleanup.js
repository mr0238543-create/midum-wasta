// تنظيف كاش النسخ القديمة عند أول فتح بعد كل إصدار. غيّر BUILD عند أي إصدار تريد فيه إجبار التحديث.
const BUILD = "2026-11-06-a";
(async () => {
  try {
    if (localStorage.getItem("mw_build") === BUILD) return;
    let touched = false;
    if ("caches" in window) {
      for (const k of await caches.keys()) { await caches.delete(k); touched = true; }
    }
    if ("serviceWorker" in navigator) {
      for (const r of await navigator.serviceWorker.getRegistrations()) { await r.unregister(); touched = true; }
    }
    localStorage.setItem("mw_build", BUILD);
    // إعادة تحميل واحدة فقط (حارس sessionStorage يمنع التكرار) إن وُجد شيء قديم
    if (touched && !sessionStorage.getItem("mw_reloaded")) { sessionStorage.setItem("mw_reloaded", "1"); location.reload(); }
  } catch { /* التخزين قد يكون محجوبًا: لا نكسر التطبيق */ }
})();
