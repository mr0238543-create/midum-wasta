import { useEffect, useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go, useHash } from "./router";
import * as api from "./api";
import { Field, Loading } from "./ui";

// وجهة آمنة بعد الدخول (مسارات داخل التطبيق فقط)
const safeNext = (n) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z"/>
    <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.500-5.800c-2.100 1.400-4.800 2.300-8.400 2.300-6.300 0-11.600-4-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/>
  </svg>
);

export default function Login() {
  const { query } = useHash();
  const next = safeNext(query.next);
  const { session, profile, refreshProfile, villages, toast, uid } = useApp();
  // signin | signup | forgot | reset
  const [mode, setMode] = useState(query.mode === "reset" ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [name, setName] = useState("");
  const [villageId, setVillageId] = useState("");

  useEffect(() => { if (query.mode === "reset") setMode("reset"); }, [query.mode]);

  // بعد الدخول: إن كان الاسم موجودًا نكمل، وإلا نطلب إكمال الملف الشخصي
  useEffect(() => {
    if (session && profile?.full_name && mode !== "reset") go(next, { replace: true });
  }, [session, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (m) => { setMode(m); setError(""); setInfo(""); };
  const cleanEmail = email.trim().toLowerCase();

  const submit = async (e) => {
    e?.preventDefault();
    setError(""); setInfo("");
    if (!EMAIL_RE.test(cleanEmail)) { setError("اكتب بريدًا إلكترونيًا صحيحًا."); return; }
    if (mode === "forgot") {
      setBusy(true);
      try { await api.sendPasswordReset(cleanEmail); setInfo("إن كان البريد مسجّلًا لدينا فقد أرسلنا إليه رابط تغيير كلمة المرور."); }
      catch (err) { setError(err.message); } finally { setBusy(false); }
      return;
    }
    if (password.length < 8) { setError("كلمة المرور ٨ أحرف على الأقل."); return; }
    if (mode === "signup" && displayName.trim().length < 2) { setError("اكتب اسم المستخدم أو اسم النشاط (حرفان على الأقل)."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const r = await api.signUpEmail({ email: cleanEmail, password, name: displayName.trim().slice(0, 80) });
        if (r.needsConfirm) setInfo("أرسلنا رسالة تأكيد إلى بريدك. افتحها ثم عد وسجّل الدخول.");
      } else {
        await api.signInEmail({ email: cleanEmail, password });
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const google = async () => {
    setError(""); setInfo(""); setBusy(true);
    try { await api.signInGoogle(); } // يحوّل المتصفح إلى Google ثم يعود للتطبيق
    catch (err) { setError(err.message); setBusy(false); }
  };

  const saveNewPassword = async (e) => {
    e.preventDefault(); setError("");
    if (password.length < 8) { setError("كلمة المرور ٨ أحرف على الأقل."); return; }
    setBusy(true);
    try { await api.updatePassword(password); toast("تم تغيير كلمة المرور"); setPassword(""); go(next, { replace: true }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
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
  if (session && profile && !profile.full_name && mode !== "reset") {
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

  const links = (
    <p className="small muted" style={{ margin: 0, lineHeight: 1.8 }}>
      بالمتابعة أنت توافق على <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => go("/terms")}>الشروط</button> و
      <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => go("/privacy")}>سياسة الخصوصية</button>.
    </p>
  );
  const pwField = (label, autoComplete) => (
    <Field label={label} hint={mode === "signup" || mode === "reset" ? "٨ أحرف على الأقل." : undefined}>
      <div style={{ position: "relative" }}>
        <input className="input ltr" type={showPw ? "text" : "password"} autoComplete={autoComplete} value={password}
          onChange={(e) => setPassword(e.target.value)} aria-label={label} style={{ paddingInlineEnd: 64 }} />
        <button type="button" className="small bold" onClick={() => setShowPw((v) => !v)}
          style={{ position: "absolute", insetInlineEnd: 12, top: "50%", transform: "translateY(-50%)", color: "var(--deep)" }}>
          {showPw ? "إخفاء" : "إظهار"}
        </button>
      </div>
    </Field>
  );
  const msgs = (<>
    {error && <div className="banner bad" role="alert">{error}</div>}
    {info && <div className="banner ok" role="status">{info}</div>}
  </>);

  if (mode === "reset") {
    return (
      <div className="screen">
        {brand}
        <div className="pad" style={{ marginTop: -24 }}>
          <form className="card col" onSubmit={saveNewPassword}>
            <div className="h2">كلمة مرور جديدة</div>
            {session ? pwField("كلمة المرور الجديدة", "new-password") : <p className="muted small">رابط الاسترجاع غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.</p>}
            {msgs}
            {session
              ? <button className="btn primary block" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
              : <button type="button" className="btn primary block" onClick={() => switchMode("forgot")}>طلب رابط جديد</button>}
          </form>
        </div>
      </div>
    );
  }

  const titles = { signin: "تسجيل الدخول", signup: "إنشاء حساب جديد", forgot: "استرجاع كلمة المرور" };
  return (
    <div className="screen">
      {brand}
      <div className="pad" style={{ marginTop: -24 }}>
        <form className="card col" onSubmit={submit} noValidate>
          <div className="h2">{titles[mode]}</div>
          {mode !== "forgot" && (
            <>
              <button type="button" className="btn soft block" onClick={google} disabled={busy}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <GoogleLogo /> {mode === "signup" ? "التسجيل بواسطة Google" : "الدخول بواسطة Google"}
              </button>
              <div className="row small muted" style={{ alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.2 }} /> أو بالبريد الإلكتروني
                <span style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.2 }} />
              </div>
            </>
          )}
          {mode === "signup" && (
            <Field label="اسم المستخدم أو اسم النشاط" hint="يظهر لأصحاب الأنشطة عند التواصل، ويظهر الاسم الأول فقط في التقييمات.">
              <input className="input" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" placeholder="مثال: أحمد علي" />
            </Field>
          )}
          <Field label="البريد الإلكتروني">
            <input className="input ltr" type="email" inputMode="email" autoComplete="email" placeholder="name@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} aria-label="البريد الإلكتروني" autoFocus />
          </Field>
          {mode !== "forgot" && pwField("كلمة المرور", mode === "signup" ? "new-password" : "current-password")}
          {msgs}
          <button className="btn primary block" disabled={busy}>
            {busy ? "لحظات…" : mode === "signin" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال رابط الاسترجاع"}
          </button>
          <div className="row between small">
            {mode === "signin" && <>
              <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => switchMode("signup")}>ليس لديك حساب؟ سجّل</button>
              <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => switchMode("forgot")}>نسيت كلمة المرور؟</button>
            </>}
            {mode === "signup" && <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => switchMode("signin")}>لديك حساب؟ سجّل الدخول</button>}
            {mode === "forgot" && <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => switchMode("signin")}>العودة لتسجيل الدخول</button>}
          </div>
          {links}
        </form>
        <div className="row mt16 small muted" style={{ justifyContent: "center", gap: 6 }}>
          <Icon name="lock" size={14} /> بياناتك محمية، ولا نشارك بريدك مع أحد دون موافقتك.
        </div>
      </div>
    </div>
  );
}
