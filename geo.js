// موقع المستخدم (اختياري وبموافقته) لترتيب الأقرب أولًا. لا يُحفظ ولا يُرسل إلا مع طلب البحث.
import { useCallback, useState } from "react";

let cached = null;
export function useGeo() {
  const [coords, setCoords] = useState(cached);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(() => new Promise((resolve) => {
    if (!navigator.geolocation) { setError("المتصفح لا يدعم تحديد الموقع."); resolve(null); return; }
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => { cached = { lat: p.coords.latitude, lng: p.coords.longitude }; setCoords(cached); setBusy(false); resolve(cached); },
      (e) => {
        setBusy(false);
        setError(e.code === 1 ? "لم تسمح بتحديد الموقع. فعّله من إعدادات المتصفح." : "تعذّر تحديد موقعك الآن.");
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 }
    );
  }), []);
  return { coords, error, busy, request };
}
