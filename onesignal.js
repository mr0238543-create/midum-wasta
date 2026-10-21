// ربط جهاز المستخدم (OneSignal Player/Subscription ID) بحسابه في Supabase.
// يعمل فقط لو ضبطت ONESIGNAL_APP_ID في config.js؛ وإلا يبقى التطبيق على Web Push المباشر.
import { DEFAULTS } from "./config";
import * as api from "./api";

export const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || DEFAULTS.ONESIGNAL_APP_ID || "";
export const oneSignalEnabled = () => !!ONESIGNAL_APP_ID;

let ready = null;
function init() {
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      const s = document.createElement("script");
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      s.defer = true;
      s.onerror = () => { ready = null; reject(new Error("تعذّر تحميل خدمة الإشعارات")); };
      document.head.appendChild(s);
      window.OneSignalDeferred.push(async (OS) => {
        try {
          await OS.init({
            appId: ONESIGNAL_APP_ID,
            serviceWorkerPath: "OneSignalSDKWorker.js",
            allowLocalhostAsSecureOrigin: true,
            notifyButton: { enable: false },
          });
          resolve(OS);
        } catch (e) { ready = null; reject(e); }
      });
    });
  }
  return ready;
}

let linkedFor = null;
// يربط الجهاز بالمستخدم الحالي فقط: login(external_id) ثم حفظ Player ID في قاعدة البيانات
export async function osLink(uid) {
  const OS = await init();
  if (linkedFor !== uid) { await OS.login(uid); linkedFor = uid; }
  const id = OS.User.PushSubscription.id;
  if (id && OS.User.PushSubscription.optedIn) await api.linkOneSignalPlayer(id);
  if (!osLink.bound) {
    osLink.bound = true;
    OS.User.PushSubscription.addEventListener("change", (e) => {
      const nid = e?.current?.id;
      if (nid && e.current.optedIn && linkedFor) api.linkOneSignalPlayer(nid).catch(() => {});
    });
  }
}

export async function osState() {
  if (typeof Notification !== "undefined" && Notification.permission === "denied") return "denied";
  const OS = await init();
  return OS.Notifications.permission && OS.User.PushSubscription.optedIn ? "on" : "off";
}

export async function osEnable(uid) {
  const OS = await init();
  await OS.Notifications.requestPermission();
  if (!OS.Notifications.permission) throw new Error("لم يتم السماح بالإشعارات. فعّلها من إعدادات المتصفح للموقع.");
  await OS.User.PushSubscription.optIn();
  await osLink(uid);
}

export async function osDisable() {
  const OS = await init();
  const id = OS.User.PushSubscription.id;
  if (id) await api.deleteOneSignalPlayer(id).catch(() => {});
  await OS.User.PushSubscription.optOut();
}

// تسجيل الخروج: يفك ربط الجهاز بالحساب حتى لا تصل إشعاراته لمن يستخدم الهاتف بعده
export async function osRelease() {
  const OS = await init();
  const id = OS.User.PushSubscription.id;
  if (id) await api.deleteOneSignalPlayer(id).catch(() => {});
  await OS.logout();
  linkedFor = null;
}
