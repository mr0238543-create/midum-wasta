// مكوّنات واجهة مشتركة
import { useCallback, useEffect, useState } from "react";
import Icon from "./icons";
import { back, go } from "./router";
import { useApp } from "./app";
import { photoUrl } from "./api";
import { fmtKm, fmtRating, toAr, BUSINESS_STATUS } from "./util";

// تحميل بيانات مع حالات التحميل/الخطأ
export function useAsync(fn, deps) {
  const [s, setS] = useState({ loading: true, error: null, data: null });
  const reload = useCallback(() => {
    let alive = true;
    setS((x) => ({ ...x, loading: true, error: null }));
    fn().then((data) => alive && setS({ loading: false, error: null, data }))
        .catch((error) => alive && setS({ loading: false, error, data: null }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => reload(), [reload]);
  const setData = (updater) => setS((x) => ({ ...x, data: typeof updater === "function" ? updater(x.data) : updater }));
  return { ...s, reload, setData };
}

export function Header({ title, onBack, right, backTo, children }) {
  return (
    <div className="hdr">
      <div className="row">
        <button className="round-btn" aria-label="رجوع" onClick={() => (onBack ? onBack() : back(backTo || "/"))}>
          <Icon name="back" />
        </button>
        <h1 className="grow trunc">{title}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}

export function TabHeader({ title, subtitle, right }) {
  return (
    <div className="hdr" style={{ padding: "22px 20px 20px" }}>
      <div className="row between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900 }}>{title}</h1>
          {subtitle && <div style={{ fontSize: 13, opacity: 0.92, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
    </div>
  );
}

export const Spinner = () => <div className="spinner" role="status" aria-label="جارٍ التحميل" />;

export function Loading({ rows = 3 }) {
  return (
    <div className="col pad" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skel" style={{ height: 84 }} />)}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="empty" role="alert">
      <div className="ico">⚠️</div>
      <div className="bold">{error?.message || "حدث خطأ غير متوقع"}</div>
      {onRetry && <button className="btn soft mt12" onClick={onRetry}>إعادة المحاولة</button>}
    </div>
  );
}

export function Empty({ icon = "🔍", title, text, action }) {
  return (
    <div className="empty">
      <div className="ico">{icon}</div>
      <div className="bold">{title}</div>
      {text && <div className="muted small" style={{ lineHeight: 1.7 }}>{text}</div>}
      {action && <div className="mt12">{action}</div>}
    </div>
  );
}

// حالات التحميل/الخطأ/الفراغ في مكان واحد
export function Async({ state, empty, children, rows }) {
  if (state.loading && !state.data) return <Loading rows={rows} />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (Array.isArray(state.data) && state.data.length === 0 && empty) return empty;
  return children(state.data);
}

export function Stars({ value, size = 14 }) {
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`التقييم ${fmtRating(value)} من ٥`}>
      <Icon name="star" size={size} /> {fmtRating(value)}
    </span>
  );
}

export function StarPicker({ value, onChange }) {
  return (
    <div className="star-pick" role="radiogroup" aria-label="التقييم">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" className={n <= value ? "on" : ""} role="radio" aria-checked={n === value}
          aria-label={`${toAr(n)} نجوم`} onClick={() => onChange(n)}>
          <Icon name="star" size={34} />
        </button>
      ))}
    </div>
  );
}

// multi: حقل يضم أكثر من عنصر تحكم (صور، خريطة…) فيُرسم div بدل label،
// لأن الضغط على أي مساحة داخل label يُفعّل أول زر بداخله (مثل حذف صورة أو طلب الموقع) دون قصد المستخدم.
export function Field({ label, error, hint, children, multi }) {
  const Tag = multi ? "div" : "label";
  return (
    <Tag className="field" {...(multi ? { role: "group", "aria-label": typeof label === "string" ? label : undefined } : {})}>
      <div className="lbl">{label}</div>
      {children}
      {error ? <div className="err" role="alert">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </Tag>
  );
}

export function StatusBadge({ status, map = BUSINESS_STATUS }) {
  const s = map[status];
  if (!s) return null;
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}

export function Thumb({ business, size = 64 }) {
  const { category } = useApp();
  const first = business.photos?.[0];
  return (
    <div className="thumb" style={{ width: size, height: size, fontSize: size * 0.48 }}>
      {first ? <img src={photoUrl(first)} alt="" loading="lazy" /> : category(business.category_id)?.emoji || "📍"}
    </div>
  );
}

export function BusinessCard({ b }) {
  const { village } = useApp();
  return (
    <button className="biz" onClick={() => go(`/b/${b.id}`)}>
      <Thumb business={b} />
      <div className="grow">
        <div className="bold trunc" style={{ fontSize: 15 }}>{b.name}</div>
        <div className="muted small trunc">{b.type_label}</div>
        <div className="row small muted mt8" style={{ gap: 8, marginTop: 4 }}>
          {b.rating_count > 0 ? <Stars value={b.rating_avg} size={12} /> : <span className="badge brand">جديد</span>}
          <span className="row" style={{ gap: 3 }}>
            <Icon name="pin" size={12} />
            {village(b.village_id)?.name}{b.distance_km != null ? ` · ${fmtKm(b.distance_km)}` : ""}
          </span>
        </div>
      </div>
      <div className="col" style={{ alignItems: "flex-end", gap: 6 }}>
        {b.is_demo && <span className="badge mute">تجريبي</span>}
        <Icon name="chevL" size={18} style={{ color: "var(--mute)" }} />
      </div>
    </button>
  );
}

export function Sheet({ title, onClose, children }) {
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {title && <div className="h2" style={{ marginBottom: 8 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

export function Tabs2({ tabs, value, onChange }) {
  return (
    <div className="tabs2" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? "on" : ""} onClick={() => onChange(t.id)}>
          {t.label}{t.count > 0 ? ` (${toAr(t.count)})` : ""}
        </button>
      ))}
    </div>
  );
}

// يطلب تسجيل الدخول قبل عرض الشاشة
export function RequireAuth({ children, next }) {
  const { session, requireLogin } = useApp();
  useEffect(() => { if (session === null) requireLogin(next); }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  if (session === undefined) return <Loading />;
  if (!session) return <Empty icon="🔒" title="سجّل الدخول للمتابعة" text="نحتاج رقم هاتفك لحماية حسابك وبياناتك." />;
  return children;
}

export function RequireAdmin({ children }) {
  const { profile, session } = useApp();
  if (session === undefined || (session && !profile)) return <Loading />;
  if (profile?.role !== "admin") return <Empty icon="⛔" title="هذه الصفحة للمشرفين فقط" />;
  return children;
}
