import { useEffect, useRef, useState } from "react";
import Icon from "../icons";
import { useApp } from "../app";
import { go, useHash } from "../router";
import * as api from "../api";
import { Field, Loading } from "../ui";
import { isEgMobile, normalizePhone, toAr, toE164, toLatinDigits } from "../util";

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
const MAX_TRIES = 5;
const LOCK_MS = 5 * 60 * 1000;
const RESEND_S = 60;

// وجهة آمنة بعد الدخول (مسارات داخل التطبيق فقط)
const safeNext = (n) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/");

// حماية اختيارية (Cloudflare Turnstile) ضد إساءة استخدام رسائل SMS — تُفعَّل بضبط VITE_TURNSTILE_SITE_KEY
function useTurnstile() {
  const ref = useRef(null);
  const widget = useRef(null);
  const [token, setToken] = useState(null);
  useEffect(() => {
    if (!SITE_KEY) return;
    const render = () => {
      if (!ref.current || widget.current != null) return;
      widget.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY, language: "ar", callback: setToken, "expired-callback": () => setToken(null),
      });
    };
    if (window.turnstile) render();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = render;
      document.head.appendChild(s);
    }
    return () => { try { window.turnstile?.remove(widget.current); } catch { /* تجاهل */ } widget.current = null; };
  }, []);
  const reset = () => { setToken(null); try { window.turnstile?.reset(widget.current); } catch { /* تجاهل */ } };
  return { ref, token, reset, enabled: Boolean(SITE_KEY) };
}

export default function Login() {
  const { query } = useHash();
  const next = safeNext(query.next);
  const { session, profile, refreshProfile, villages, toast, uid } = useApp();
  const [step, setStep] = useState("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [tries, setTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [name, setName] = useState("");
  const [villageId, setVillageId] = useState("");
  const ts = useTurnstile();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // بعد الدخول: إن كان الاسم موجودًا نكمل، وإلا نطلب إكمال الملف الشخصي
  useEffect(() => {
    if (session && profile?.full_name) go(next, { replace: true });
  }, [session, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const local = normalizePhone(phoneInput);

  const send = async (e) => {
    e?.preventDefault();
    setError("");
    if (!isEgMobile(local)) { setError("اكتب رقم موبايل مصري صحيح مكوّن من ١١ رقمًا، مثل ٠١٠١٢٣٤٥٦٧٨."); return; }
    if (ts.enabled && !ts.token) { setError("أكمل التحقق الأمني أولًا."); return; }
    setBusy(true);
    try {
      await api.sendOtp(toE164(local), ts.token);
      setStep("otp"); setCode(""); setCooldown(RESEND_S);
      ts.reset();
    } catch (err) {
      setError(err.message); ts.reset();
    } finally { setBusy(false); }
  };

  const verify = async (e) => {
    e?.preventDefault();
    setError("");
    if (Date.now() < lockedUntil) { setError("تجاوزت عدد المحاولات. انتظر بضع دقائق ثم أعد الإرسال."); return; }
    const token = toLatinDigits(code).replace(/\D/g, "");
    if (token.length < 6) { setError("اكتب رمز التحقق المكوّن من ٦ أرقام."); return; }
    setBusy(true);
    try {
      await api.verifyOtp(toE164(local), token);
    } catch (err) {
      const n = tries + 1;
      setTries(n);
      if (n >= MAX_TRIES) { setLockedUntil(Date.now() + LOCK_MS); setError("تجاوزت عدد المحاولات. انتظر ٥ دقائق ثم اطلب رمزًا جديدًا."); }
      else setError(err.message);
    } finally { setBusy(false); }
  };

  const saveName = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) { setError("اكتب اسمك (حرفان على الأقل)."); return; }
    setBusy(true); setError("");
    try {
      await api.updateMyProfile(uid, { full_name: n, village_id: villageId ? Number(villageId) : null });
      await refreshProfile();
      toast("أهلًا بك في «ميدوم والواسطي»");
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  if (session && !profile) return <div className="screen"><Loading /></div>;

  const brand = (
    <div className="hdr big" style={{ paddingBottom: 40 }}>
      <div className="blob" style={{ width: 150, height: 150, left: -40, top: -40 }} />
      <h1 style={{ position: "relative" }}>ميدوم والواسطي</h1>
      <p style={{ margin: "4px 0 0", fontSize: 14, opacity: 0.92, position: "relative" }}>سجّل الدخول لتتواصل مع الأنشطة وتضيف نشاطك</p>
    </div>
  );

  // إكمال الملف الشخصي
  if (session && profile && !profile.full_name) {
    return (
      <div className="screen">
        {brand}
        <form className="pad col" onSubmit={saveName} style={{ marginTop: -24 }}>
          <div className="card col">
            <div className="h2">أكمل بياناتك</div>
            <Field label="الاسم" hint="يظهر لأصحاب الأنشطة عند التواصل، ويظهر الاسم الأول فقط في التقييمات.">
              <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="مثال: أحمد علي" autoFocus autoComplete="name" />
            </Field>
            <Field label="قريتك (اختياري)">
              <select className="input" value={villageId} onChange={(e) => setVillageId(e.target.value)}>
                <option value="">بدون تحديد</option>
                {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            {error && <div className="banner bad" role="alert">{error}</div>}
            <button className="btn primary block" disabled={busy}>{busy ? "جارٍ الحفظ…" : "ابدأ"}</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="screen">
      {brand}
      <div className="pad" style={{ marginTop: -24 }}>
        {step === "phone" ? (
          <form className="card col" onSubmit={send}>
            <div className="h2">رقم الموبايل</div>
            <Field label="رقمك" hint="سنرسل لك رمز تحقق من ٦ أرقام برسالة نصية. لا توجد كلمة مرور: ندخلك دائمًا بالرمز.">
              <input className="input ltr" inputMode="tel" autoComplete="tel" placeholder="01012345678" value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)} autoFocus aria-label="رقم الموبايل" />
            </Field>
            {ts.enabled && <div ref={ts.ref} />}
            {error && <div className="banner bad" role="alert">{error}</div>}
            <button className="btn primary block" disabled={busy}>{busy ? "جارٍ الإرسال…" : "إرسال الرمز"}</button>
            <p className="small muted" style={{ margin: 0, lineHeight: 1.8 }}>
              بالمتابعة أنت توافق على <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => go("/terms")}>الشروط</button> و
              <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => go("/privacy")}>سياسة الخصوصية</button>.
            </p>
          </form>
        ) : (
          <form className="card col" onSubmit={verify}>
            <div className="h2">أدخل رمز التحقق</div>
            <p className="muted small" style={{ margin: 0, lineHeight: 1.8 }}>أرسلنا رمزًا إلى <span className="ltr bold" style={{ display: "inline-block" }}>{toAr(local)}</span></p>
            <input className="input otp ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••"
              value={code} onChange={(e) => setCode(e.target.value)} autoFocus aria-label="رمز التحقق" />
            {error && <div className="banner bad" role="alert">{error}</div>}
            <button className="btn primary block" disabled={busy || code.length < 6}>{busy ? "جارٍ التحقق…" : "تأكيد ودخول"}</button>
            <div className="row between">
              <button type="button" className="small bold" style={{ color: "var(--deep)" }} onClick={() => { setStep("phone"); setError(""); }}>تغيير الرقم</button>
              {cooldown > 0
                ? <span className="small muted">إعادة الإرسال بعد {toAr(cooldown)} ث</span>
                : <button type="button" className="small bold" style={{ color: "var(--deep)" }} disabled={busy} onClick={send}>إعادة إرسال الرمز</button>}
            </div>
          </form>
        )}
        <div className="row mt16 small muted" style={{ justifyContent: "center", gap: 6 }}>
          <Icon name="lock" size={14} /> بياناتك محمية، ولا نشارك رقمك مع أحد دون موافقتك.
        </div>
      </div>
    </div>
  );
}
