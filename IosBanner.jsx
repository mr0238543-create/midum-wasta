import { useState } from "react";
import { needsInstall } from "./push";

const KEY = "midum_ios_hint_closed";
const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };

// خطوات إضافة التطبيق للشاشة الرئيسية (مطلوبة على iPhone كي تعمل الإشعارات الفورية)
export function IosSteps() {
  return (
    <ol style={{ margin: "8px 0 0", paddingInlineStart: 20, lineHeight: 2, fontSize: 13.5 }}>
      <li>افتح الموقع في متصفح <b>Safari</b> (وليس Chrome).</li>
      <li>اضغط زر المشاركة <b>⬆️</b> أسفل الشاشة.</li>
      <li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b> ثم <b>«إضافة»</b>.</li>
      <li>افتح التطبيق من <b>أيقونته على الشاشة الرئيسية</b>.</li>
      <li>ادخل <b>الحساب ← تفعيل الإشعارات</b> ووافق على الإذن.</li>
    </ol>
  );
}

// بنر يظهر لمستخدمي iPhone الذين فتحوا الموقع من المتصفح (غير مثبّت)
export default function IosBanner() {
  const [closed, setClosed] = useState(read);
  const [open, setOpen] = useState(false);
  let need = false;
  try { need = needsInstall(); } catch { /* تجاهل */ }
  if (!need || closed) return null;
  const close = () => { try { localStorage.setItem(KEY, "1"); } catch { /* تجاهل */ } setClosed(true); };
  return (
    <div className="banner info" role="note" style={{ position: "fixed", insetInline: 12, bottom: 84, zIndex: 40, boxShadow: "0 6px 24px rgba(0,0,0,.18)" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 8 }}>
        <div className="grow">
          <div className="bold">📲 فعّل إشعارات الطلبات على iPhone</div>
          {open ? <IosSteps /> : <div className="small" style={{ marginTop: 4 }}>أضف التطبيق للشاشة الرئيسية لتصلك التنبيهات فورًا.</div>}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="btn primary" onClick={() => setOpen((v) => !v)}>{open ? "إخفاء الخطوات" : "اعرض الخطوات"}</button>
            <button className="btn ghost" onClick={close}>لاحقًا</button>
          </div>
        </div>
      </div>
    </div>
  );
}
