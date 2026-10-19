import { useEffect, useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { IosSteps } from "./IosBanner";
import { disablePush, enablePush, pushState } from "./push";

const HINT = {
  unsupported: "متصفحك الحالي لا يدعم الإشعارات الفورية. جرّب Chrome على الموبايل.",
  install: "على iPhone لازم تضيف التطبيق إلى الشاشة الرئيسية أولًا (الخطوات بالأسفل).",
  denied: "الإشعارات محظورة للموقع. افتح إعدادات المتصفح ← إعدادات الموقع ← الإشعارات، واسمح بها ثم ارجع هنا.",
};

// compact=true: شريط تنبيه يظهر فقط عند عدم التفعيل (في شاشة الإشعارات). وإلا بطاقة بزر تشغيل/إيقاف.
export default function PushCard({ compact }) {
  const { uid, toast } = useApp();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let a = true; pushState().then((s) => a && setSt(s)); return () => { a = false; }; }, [uid]);
  if (!uid || st == null) return null;
  if (compact && (st === "on" || st === "unsupported")) return null;

  const turnOn = async () => {
    setBusy(true);
    try { await enablePush(uid); setSt("on"); toast("تم تفعيل الإشعارات الفورية"); }
    catch (e) { setSt(await pushState()); toast(e.message || "تعذّر التفعيل", "bad"); }
    finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true);
    try { await disablePush(); setSt("off"); toast("تم إيقاف الإشعارات الفورية على هذا الجهاز"); }
    catch (e) { toast(e.message || "تعذّر الإيقاف", "bad"); }
    finally { setBusy(false); }
  };

  const hint = HINT[st];
  return (
    <div className={compact ? "banner info" : "card"} style={compact ? { marginBottom: 12 } : { marginBottom: 16 }}>
      <div className="row" style={{ gap: 10, alignItems: "center" }}>
        <Icon name="bell" size={20} />
        <div className="grow">
          <div className="bold" style={{ fontSize: 14 }}>إشعارات فورية على هاتفك</div>
          <div className="small muted" style={{ lineHeight: 1.7 }}>
            {st === "on" ? "مفعّلة: ستصلك تنبيهات الطلبات والرسائل فورًا حتى لو التطبيق مغلق." : hint || "فعّلها لتصلك طلبات الشراء والرسائل فورًا حتى لو التطبيق مغلق."}
          </div>
        </div>
        {st === "off" && <button className="btn primary" disabled={busy} onClick={turnOn}>{busy ? "…" : "تفعيل"}</button>}
        {st === "on" && !compact && <button className="btn" disabled={busy} onClick={turnOff}>{busy ? "…" : "إيقاف"}</button>}
      </div>
      {st === "install" && <IosSteps />}
    </div>
  );
}
