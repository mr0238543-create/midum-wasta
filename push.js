// الإشعارات الفورية (Web Push) من جهة المتصفح.
import { DEFAULTS } from "./config";
import * as api from "./api";
import { oneSignalEnabled, osDisable, osEnable, osLink, osRelease, osState } from "./onesignal";

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || DEFAULTS.VAPID_PUBLIC_KEY;

const base = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
export const pushSupported = () => oneSignalEnabled() ? base() :
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!VAPID_KEY;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
// على iPhone تعمل الإشعارات فقط بعد "إضافة إلى الشاشة الرئيسية"
export const needsInstall = () => isIOS() && !isStandalone();

function keyBytes(b64) {
  const p = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  const r = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return r;
}

// "unsupported" | "install" | "denied" | "off" | "on"
export async function pushState() {
  if (needsInstall()) return "install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (oneSignalEnabled()) { try { return await osState(); } catch { return "off"; } }
  try {
    const r = await navigator.serviceWorker.getRegistration("/sw.js");
    const s = r && (await r.pushManager.getSubscription());
    return s && Notification.permission === "granted" ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush(uid) {
  if (!pushSupported()) throw new Error("متصفحك لا يدعم الإشعارات الفورية.");
  if (oneSignalEnabled()) return osEnable(uid);
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("لم يتم السماح بالإشعارات. فعّلها من إعدادات المتصفح للموقع.");
  const r = await registration();
  const sub = (await r.pushManager.getSubscription()) ||
    (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY) }));
  await api.savePushSubscription(uid, sub.toJSON());
}

export async function disablePush() {
  if (oneSignalEnabled()) return osDisable();
  const r = await navigator.serviceWorker.getRegistration("/sw.js");
  const s = r && (await r.pushManager.getSubscription());
  if (s) { await api.deletePushSubscription(s.endpoint).catch(() => {}); await s.unsubscribe().catch(() => {}); }
}

// عند فتح التطبيق: إن كان مفعّلًا نحدّث تسجيل الجهاز (قد يتغير عنوان الاشتراك)
export async function syncPush(uid) {
  try {
    if (!pushSupported()) return;
    if (oneSignalEnabled()) { if (Notification.permission === "granted") await osLink(uid); return; }
    if (Notification.permission !== "granted") return;
    const r = await navigator.serviceWorker.getRegistration("/sw.js");
    const s = r && (await r.pushManager.getSubscription());
    if (s) await api.savePushSubscription(uid, s.toJSON());
  } catch { /* صامت */ }
}

// عند تسجيل الخروج: لا يستقبل الجهاز إشعارات حساب لم يعد مسجّلًا عليه
export async function releasePush() {
  try { if (oneSignalEnabled()) { await osRelease(); return; } if (pushSupported()) await disablePush(); } catch { /* صامت */ }
}
