// إشعارات الهاتف عبر OneSignal (Web SDK v16). الإرسال نفسه يتم من قاعدة البيانات (trigger ← send-push ← OneSignal).
// هنا فقط: تهيئة الـ SDK، طلب الإذن، وربط «معرّف الاشتراك» بحساب المستخدم عبر link_onesignal_player.
import { useCallback, useEffect, useState } from "react";
import { ONESIGNAL_APP_ID } from "./config";
import * as api from "./api";

const SDK = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
let started = false;
let currentUid = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

const supported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && !window.__mock;

function withSdk(fn) {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(fn);
}

function boot() {
  if (started || !supported() || !ONESIGNAL_APP_ID) return;
  started = true;
  const s = document.createElement("script");
  s.src = SDK; s.defer = true; s.onerror = () => { started = false; };
  document.head.appendChild(s);
  withSdk(async (OS) => {
    try {
      await OS.init({
        appId: ONESIGNAL_APP_ID,
        serviceWorkerPath: "OneSignalSDKWorker.js",
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: true,
      });
      OS.User.PushSubscription.addEventListener("change", () => { link(OS); notify(); });
      OS.Notifications.addEventListener("permissionChange", notify);
      link(OS); notify();
    } catch { /* نطاق غير مسموح في OneSignal أو SDK محجوب: لا نكسر التطبيق */ }
  });
}

function link(OS) {
  const id = OS.User.PushSubscription.id;
  if (id && OS.User.PushSubscription.optedIn && currentUid) api.linkOneSignalPlayer(id).catch(() => {});
}

// تُستدعى عند تغيّر المستخدم: التهيئة وربط الجهاز بالحساب إن كان الإذن ممنوحًا
export function initPush(uid) {
  currentUid = uid || null;
  if (!uid) return;
  boot();
  withSdk((OS) => { try { link(OS); } catch { /* تجاهل */ } });
}

// عند الخروج: فك ربط هذا الجهاز بالحساب قبل إنهاء الجلسة
export async function detachPush() {
  currentUid = null;
  if (!window.OneSignal?.User?.PushSubscription) return;
  try {
    const id = window.OneSignal.User.PushSubscription.id;
    if (id) await api.unlinkOneSignalPlayer(id);
  } catch { /* تجاهل */ }
}

export function usePush() {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick((n) => n + 1); listeners.add(f); return () => listeners.delete(f); }, []);
  const OS = typeof window !== "undefined" ? window.OneSignal : null;
  const ready = Boolean(OS?.User?.PushSubscription);
  const perm = supported() ? Notification.permission : "unsupported"; // default | granted | denied | unsupported
  const on = ready && perm === "granted" && Boolean(OS.User.PushSubscription.optedIn);
  const enable = useCallback(async () => {
    if (!supported()) throw new Error("متصفحك لا يدعم الإشعارات. جرّب Chrome على الأندرويد، أو أضف التطبيق للشاشة الرئيسية على الآيفون.");
    if (Notification.permission === "denied") throw new Error("الإشعارات محظورة من إعدادات المتصفح لهذا الموقع. فعّلها من إعدادات الموقع ثم أعد المحاولة.");
    boot();
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("تعذّر تحميل خدمة الإشعارات. تحقق من الإنترنت وحاول مجددًا.")), 8000);
      withSdk(async (OS2) => {
        try { await OS2.Notifications.requestPermission(); await OS2.User.PushSubscription.optIn(); link(OS2); clearTimeout(t); notify(); res(); }
        catch (e) { clearTimeout(t); rej(e); }
      });
    });
  }, []);
  return { supported: supported() && Boolean(ONESIGNAL_APP_ID), perm, on, enable };
}
