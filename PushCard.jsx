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

// طلب تفعيل الإشعارات بعد تسجيل الدخول مباشرة: شريط صغير بزر واحد.
// المتصفحات لا تسمح بطلب الإذن إلا بعد لمسة من المستخدم، لذلك الإذن نفسه يُطلب عند الضغط على «تفعيل».
const SNOOZE = "midum_push_prompt_until";
const snoozed = () => { try { return Number(localStorage.getItem(SNOOZE) || 0) > Date.now(); } catch { return false; } };

export function PushPrompt() {
  const { uid, toast } = useApp();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let a = true;
    if (!uid || snoozed()) { setShow(false); return; }
    const t = setTimeout(() => pushState().then((s) => a && setShow(s === "off")), 2500);
    return () => { a = false; clearTimeout(t); };
  }, [uid]);
  if (!show) return null;
  const later = () => { try { localStorage.setItem(SNOOZE, String(Date.now() + 3 * 24 * 3600 * 1000)); } catch { /* تجاهل */ } setShow(false); };
  const on = async () => {
    setBusy(true);
    try { await enablePush(uid); setShow(false); toast("تم تفعيل الإشعارات الفورية"); }
    catch (e) { toast(e.message || "تعذّر التفعيل", "bad"); later(); }
    finally { setBusy(false); }
  };
  return (
    <div className="banner info" role="dialog" aria-label="تفعيل الإشعارات"
      style={{ position: "fixed", insetInline: 12, bottom: 84, zIndex: 40, boxShadow: "0 6px 24px rgba(0,0,0,.18)" }}>
      <div className="bold">🔔 فعّل الإشعارات لتصلك الطلبات والرسائل فورًا</div>
      <div className="small" style={{ marginTop: 2 }}>حتى لو التطبيق مقفول — بنبّهك أول ما حد يطلب منك أو يرد عليك.</div>
      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn primary" disabled={busy} onClick={on}>{busy ? "…" : "تفعيل الآن"}</button>
        <button className="btn ghost" onClick={later}>لاحقًا</button>
      </div>
    </div>
  );
}
