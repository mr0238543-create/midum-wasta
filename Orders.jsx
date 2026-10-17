import { useRef, useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go } from "./router";
import * as api from "./api";
import { Empty, ErrorBox, Field, Header, Loading, Sheet, StatusBadge, useAsync } from "./ui";
import { ORDER_STATUS, PAYMENT_METHODS, WALLET_METHODS, isMobilePhone, money, normalizePhone, processImage, timeAgo, toAr, waLink } from "./util";

// ───────────── أزرار التواصل السريع (هاتف + واتساب) ─────────────
export function ContactButtons({ phone, waText }) {
  const local = normalizePhone(phone || "");
  if (!local) return null;
  return (
    <div className="row" style={{ gap: 8 }}>
      <a className="btn soft grow" href={`tel:${local}`}><Icon name="phone" size={18} /> اتصال</a>
      {isMobilePhone(local) && (
        <a className="btn wa grow" href={waLink(local, waText)} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={18} /> واتساب</a>
      )}
    </div>
  );
}

const copy = async (text, toast) => {
  try { await navigator.clipboard.writeText(text); toast("تم النسخ"); } catch { toast("تعذّر النسخ. انسخه يدويًا.", "bad"); }
};

// ───────────── شاشة طلب الشراء ─────────────
export function OrderSheet({ business, product, onClose }) {
  const { uid, profile, villages, toast } = useApp();
  const pay = useAsync(() => api.getPaymentMethods(business.id), [business.id]);
  const [f, setF] = useState({
    name: profile?.full_name || "", phone: "", address: "", note: "",
    village_id: String(profile?.village_id ?? business.village_id ?? ""),
  });
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const p = pay.data;
  const methods = [];
  if (!p || p.cod) methods.push("cod");
  for (const k of ["vodafone_cash", "etisalat_cash", "orange_cash", "instapay"]) if (p?.[k]) methods.push(k);
  const chosen = methods.includes(method) ? method : methods[0] || "";
  const isWallet = WALLET_METHODS.includes(chosen);
  const total = Number(product.price) * qty;

  const pickReceipt = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await processImage(file);
      if (receipt) URL.revokeObjectURL(receipt.url);
      setReceipt({ blob, url: URL.createObjectURL(blob) });
    } catch (er) { toast(er.message, "bad"); }
  };

  const submit = async () => {
    const e = {};
    if (f.name.trim().length < 2) e.name = "اكتب اسمك (حرفان على الأقل).";
    const phone = normalizePhone(f.phone);
    if (!isMobilePhone(phone)) e.phone = "اكتب رقم موبايل مصري صحيحًا من ١١ رقمًا.";
    if (f.address.trim().length < 5) e.address = "اكتب العنوان بالتفصيل (٥ أحرف على الأقل).";
    if (!f.village_id) e.village_id = "اختر القرية.";
    if (!chosen) e.method = "اختر طريقة الدفع.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    let receiptPath = null;
    try {
      if (isWallet && receipt?.blob) receiptPath = await api.uploadReceipt(uid, receipt.blob);
      const village = villages.find((v) => String(v.id) === f.village_id);
      const row = await api.createOrder({
        business_id: business.id, product_id: product.id, quantity: qty,
        customer_name: f.name.trim(), customer_phone: phone,
        address: `${f.address.trim()}${village ? ` — ${village.name}` : ""}`,
        village_id: Number(f.village_id), note: f.note.trim() || null,
        payment_method: chosen, receipt_path: receiptPath,
      });
      toast("تم إرسال طلبك. سنُعلمك فور رد صاحب النشاط.");
      onClose();
      go(`/orders/${row.id}`);
    } catch (err) {
      if (receiptPath) api.removeReceipts([receiptPath]);
      toast(err.message, "bad");
    } finally { setBusy(false); }
  };

  return (
    <Sheet title="طلب شراء" onClose={onClose}>
      <div className="col">
        <div className="row card flat" style={{ gap: 12, padding: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", background: "var(--peach)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {product.photo ? <img src={api.photoUrl(product.photo)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🛍️"}
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold trunc">{product.name}</div>
            <div className="small muted trunc">{business.name}</div>
            <div className="bold" style={{ color: "var(--deep)" }}>{money(product.price)}</div>
          </div>
        </div>

        <Field label="الكمية">
          <div className="qty">
            <button type="button" aria-label="إنقاص" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
            <b style={{ minWidth: 28, textAlign: "center", fontSize: 18 }}>{toAr(qty)}</b>
            <button type="button" aria-label="زيادة" onClick={() => setQty((q) => Math.min(99, q + 1))}>+</button>
            <span className="grow" style={{ textAlign: "left", fontWeight: 800, color: "var(--deep)" }}>الإجمالي: {money(total)}</span>
          </div>
        </Field>

        <Field label="الاسم" error={errors.name}>
          <input className={`input ${errors.name ? "bad" : ""}`} value={f.name} maxLength={80} onChange={set("name")} autoComplete="name" />
        </Field>
        <Field label="رقم الهاتف" error={errors.phone}>
          <input className={`input ltr ${errors.phone ? "bad" : ""}`} inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="01012345678" autoComplete="tel" />
        </Field>
        <Field label="القرية" error={errors.village_id}>
          <select className={`input ${errors.village_id ? "bad" : ""}`} value={f.village_id} onChange={set("village_id")}>
            <option value="">اختر القرية</option>
            {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <Field label="العنوان بالتفصيل" error={errors.address}>
          <textarea className={`input ${errors.address ? "bad" : ""}`} rows={2} maxLength={250} value={f.address} onChange={set("address")} placeholder="الشارع، رقم المنزل، أقرب علامة مميزة" />
        </Field>
        <Field label="ملاحظات (اختياري)">
          <input className="input" value={f.note} maxLength={300} onChange={set("note")} placeholder="مثال: المقاس أو اللون أو موعد التسليم" />
        </Field>

        <Field label="طريقة الدفع" error={errors.method}>
          {pay.loading && !pay.data && !pay.error ? <div className="skel" style={{ height: 56 }} /> : methods.length === 0 ? (
            <div className="banner warn">هذا النشاط لا يستقبل طلبات شراء حاليًا. تواصل معه مباشرة.</div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {methods.map((m) => (
                <button type="button" key={m} className={`payopt ${chosen === m ? "on" : ""}`} aria-pressed={chosen === m} onClick={() => setMethod(m)}>
                  <span className="dot" /> <span>{PAYMENT_METHODS[m].icon} {PAYMENT_METHODS[m].label}</span>
                </button>
              ))}
            </div>
          )}
        </Field>

        {isWallet && p?.[chosen] && (
          <div className="paybox">
            <div className="small">حوّل <b>{money(total)}</b> إلى {chosen === "instapay" ? "حساب إنستا باي" : `رقم ${PAYMENT_METHODS[chosen].label}`}:</div>
            <div className="row between card flat" style={{ padding: "8px 12px" }}>
              <b className="ltr" style={{ fontSize: 16 }}>{chosen === "instapay" ? p[chosen] : toAr(p[chosen])}</b>
              <button type="button" className="btn soft sm" onClick={() => copy(p[chosen], toast)}>نسخ</button>
            </div>
            <div className="small muted">بعد التحويل ارفع صورة الإيصال ليتأكد صاحب النشاط من الدفع. يمكنك رفعها لاحقًا من تفاصيل الطلب.</div>
            {receipt ? (
              <div className="photos" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="photo"><img src={receipt.url} alt="إيصال التحويل" />
                  <button type="button" className="rm" aria-label="حذف الإيصال" onClick={() => { URL.revokeObjectURL(receipt.url); setReceipt(null); }}><Icon name="x" size={14} /></button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn soft" onClick={() => fileRef.current?.click()}><Icon name="camera" size={18} /> رفع صورة الإيصال</button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickReceipt} />
          </div>
        )}

        <button className="btn primary block" disabled={busy || !chosen} onClick={submit}>{busy ? "جارٍ الإرسال…" : `تأكيد الطلب — ${money(total)}`}</button>
      </div>
    </Sheet>
  );
}

// ───────────── بطاقة طلب في القوائم ─────────────
export function OrderCard({ o, incoming }) {
  return (
    <button className="card" style={{ width: "100%", textAlign: "right" }} onClick={() => go(`/orders/${o.id}`)}>
      <div className="row between">
        <div className="bold trunc">{o.product_name} × {toAr(o.quantity)}</div>
        <StatusBadge status={o.status} map={ORDER_STATUS} />
      </div>
      <div className="muted small mt8 trunc">{incoming ? `من ${o.customer_name} · ${o.business_name}` : `من «${o.business_name}»`}</div>
      <div className="row between tiny muted mt8">
        <span>{money(o.total)} · {PAYMENT_METHODS[o.payment_method]?.label}</span><span>{timeAgo(o.created_at)}</span>
      </div>
    </button>
  );
}

const FLOW = ["new", "accepted", "shipped", "delivered"];
const OWNER_ACTIONS = {
  new: [["accepted", "قبول الطلب", "primary"], ["rejected", "رفض الطلب", "danger"]],
  accepted: [["shipped", "تم الشحن / في الطريق", "primary"], ["delivered", "تم التسليم", "soft"]],
  shipped: [["delivered", "تم التسليم", "primary"]],
};

// ───────────── تفاصيل الطلب (للعميل وصاحب النشاط) ─────────────
export function OrderDetail({ id }) {
  const { uid, toast, confirm, ask, village } = useApp();
  const st = useAsync(async () => {
    const o = await api.getOrder(id);
    const biz = o && o.user_id === uid ? await api.getBusiness(o.business_id).catch(() => null) : null;
    return { o, biz };
  }, [id, uid]);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const fileRef = useRef(null);

  const head = <Header title="تفاصيل الطلب" backTo="/requests" />;
  if (st.loading && !st.data) return <div className="screen">{head}<Loading /></div>;
  if (st.error) return <div className="screen">{head}<ErrorBox error={st.error} onRetry={st.reload} /></div>;
  const { o, biz } = st.data || {};
  if (!o) return <div className="screen">{head}<Empty icon="🔎" title="لم نجد هذا الطلب" /></div>;

  const mine = o.user_id === uid;
  const ended = o.status === "rejected" || o.status === "cancelled";
  const idx = FLOW.indexOf(o.status);
  const actions = mine ? (o.status === "new" ? [["cancelled", "إلغاء الطلب", "danger"]] : []) : (OWNER_ACTIONS[o.status] || []);
  const isWallet = WALLET_METHODS.includes(o.payment_method);
  const canUploadReceipt = mine && isWallet && ["new", "accepted"].includes(o.status);
  const v = village(o.village_id);

  const act = async ([status, label]) => {
    let reason = null;
    if (status === "rejected") {
      reason = await ask({ title: "رفض الطلب", body: "اكتب سبب الرفض ليصل للعميل (اختياري).", placeholder: "السبب…", okLabel: "رفض الطلب", danger: true });
      if (reason === null) return;
    } else if (!(await confirm({ title: `${label}؟`, okLabel: label, danger: status === "cancelled" }))) return;
    setBusy(true);
    try {
      await api.updateOrder(id, status === "rejected" ? { status, reject_reason: reason || null } : { status });
      toast("تم تحديث حالة الطلب");
      st.reload();
    } catch (e) { toast(e.message, "bad"); } finally { setBusy(false); }
  };

  const uploadReceipt = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    let path = null;
    try {
      const blob = await processImage(file);
      path = await api.uploadReceipt(uid, blob);
      await api.updateOrder(id, { receipt_path: path });
      if (o.receipt_path) api.removeReceipts([o.receipt_path]);
      toast("تم رفع الإيصال");
      st.reload();
    } catch (err) { if (path) api.removeReceipts([path]); toast(err.message, "bad"); } finally { setBusy(false); }
  };

  const showReceipt = async () => {
    try { setView(await api.receiptUrl(o.receipt_path)); } catch (e) { toast(e.message, "bad"); }
  };
  const chat = async () => {
    try { go(`/chat/${await api.startConversation(o.business_id)}`); } catch (e) { toast(e.message, "bad"); }
  };

  return (
    <div className="screen">
      {head}
      <div className="pad col">
        <div className="card col" style={{ gap: 8 }}>
          <div className="row between">
            <div className="bold">{o.product_name} × {toAr(o.quantity)}</div>
            <StatusBadge status={o.status} map={ORDER_STATUS} />
          </div>
          <div className="muted small">{mine ? `من «${o.business_name}»` : `من ${o.customer_name} على «${o.business_name}»`} · {timeAgo(o.created_at)}</div>
          <div className="row between"><span className="muted small">سعر الوحدة</span><b>{money(o.unit_price)}</b></div>
          <div className="row between"><span className="muted small">الإجمالي</span><b style={{ color: "var(--deep)" }}>{money(o.total)}</b></div>
          <div className="row between"><span className="muted small">طريقة الدفع</span><b>{PAYMENT_METHODS[o.payment_method]?.icon} {PAYMENT_METHODS[o.payment_method]?.label}</b></div>
          {o.status === "rejected" && <div className="banner bad">{o.reject_reason ? `سبب الرفض: ${o.reject_reason}` : "اعتذر صاحب النشاط عن هذا الطلب."}</div>}
          {o.status === "cancelled" && <div className="banner warn">تم إلغاء هذا الطلب.</div>}
        </div>

        <div className="card col" style={{ gap: 6 }}>
          <div className="h2">بيانات التوصيل</div>
          <div><b>{o.customer_name}</b> · <span className="ltr" style={{ display: "inline-block" }}>{toAr(o.customer_phone)}</span></div>
          <div className="muted" style={{ lineHeight: 1.8 }}>{o.address}{v && !o.address.includes(v.name) ? ` — ${v.name}` : ""}</div>
          {o.note && <div className="small">ملاحظة: {o.note}</div>}
          {!mine && <ContactButtons phone={o.customer_phone} waText={`مرحبًا ${o.customer_name}، بخصوص طلبك «${o.product_name}» من «${o.business_name}»`} />}
        </div>

        {isWallet && (
          <div className="card col" style={{ gap: 8 }}>
            <div className="h2">إيصال التحويل</div>
            {o.receipt_path ? <button className="btn soft" onClick={showReceipt}><Icon name="image" size={18} /> عرض الإيصال</button>
              : <div className="small muted">{mine ? "لم ترفع إيصال التحويل بعد." : "لم يرفع العميل إيصالًا بعد."}</div>}
            {canUploadReceipt && (
              <>
                <button className="btn ghost" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="camera" size={18} /> {o.receipt_path ? "استبدال الإيصال" : "رفع صورة الإيصال"}</button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadReceipt} />
              </>
            )}
          </div>
        )}

        {!ended && (
          <div className="card">
            <div className="h2" style={{ marginBottom: 10 }}>حالة الطلب</div>
            {FLOW.map((s, i) => (
              <div key={s} className="row" style={{ alignItems: "flex-start", gap: 12 }}>
                <div className="col" style={{ alignItems: "center", gap: 0 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: i <= idx ? "var(--orange)" : "var(--line)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{i <= idx && <Icon name="check" size={14} />}</div>
                  {i < FLOW.length - 1 && <div style={{ width: 2, height: 22, background: i < idx ? "var(--orange)" : "var(--line)" }} />}
                </div>
                <div style={{ fontWeight: i <= idx ? 800 : 600, color: i <= idx ? "var(--ink)" : "var(--mute)", paddingTop: 2 }}>{ORDER_STATUS[s].label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="col">
          {actions.map((a) => <button key={a[0]} className={`btn ${a[2]} block`} disabled={busy} onClick={() => act(a)}>{a[1]}</button>)}
          {mine && biz?.phone && <ContactButtons phone={biz.phone} waText={`مرحبًا، بخصوص طلبي «${o.product_name}»`} />}
          {mine && <button className="btn soft block" onClick={chat}><Icon name="chat" size={18} /> محادثة مع النشاط</button>}
          <button className="btn ghost block" onClick={() => go(`/b/${o.business_id}`)}>عرض النشاط</button>
        </div>
      </div>
      {view && (
        <Sheet title="إيصال التحويل" onClose={() => setView(null)}>
          <img src={view} alt="إيصال التحويل" style={{ width: "100%", borderRadius: 16 }} />
        </Sheet>
      )}
    </div>
  );
}

// ───────────── إعدادات الدفع لصاحب النشاط (داخل نموذج النشاط) ─────────────
export const EMPTY_PAYMENTS = { vodafone_cash: "", etisalat_cash: "", orange_cash: "", instapay: "", cod: true };
export const toPaymentForm = (row) => (row ? {
  vodafone_cash: row.vodafone_cash || "", etisalat_cash: row.etisalat_cash || "", orange_cash: row.orange_cash || "",
  instapay: row.instapay || "", cod: row.cod,
} : { ...EMPTY_PAYMENTS });

export function validatePayments(v) {
  const e = {};
  for (const k of ["vodafone_cash", "etisalat_cash", "orange_cash"]) {
    const x = v[k].trim();
    if (x && !isMobilePhone(normalizePhone(x))) e[k] = "اكتب رقم موبايل صحيحًا من ١١ رقمًا.";
  }
  const ip = v.instapay.trim();
  if (ip && (ip.length < 3 || ip.length > 80)) e.instapay = "من ٣ إلى ٨٠ حرفًا.";
  return e;
}
export const paymentsToFields = (v) => ({
  vodafone_cash: v.vodafone_cash.trim() ? normalizePhone(v.vodafone_cash) : null,
  etisalat_cash: v.etisalat_cash.trim() ? normalizePhone(v.etisalat_cash) : null,
  orange_cash: v.orange_cash.trim() ? normalizePhone(v.orange_cash) : null,
  instapay: v.instapay.trim() || null,
  cod: !!v.cod,
});

export function PaymentSettingsEditor({ value, onChange, errors = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <div className="col" style={{ gap: 10 }}>
      <div>
        <div className="bold">طرق الدفع للمنتجات</div>
        <div className="small muted">اكتب الأرقام التي تستقبل عليها التحويلات، وتظهر للعميل المسجّل عند الشراء فقط. اترك الخانة فارغة لإخفاء الطريقة.</div>
      </div>
      <label className="check">
        <input type="checkbox" checked={value.cod} onChange={set("cod")} /> الدفع عند الاستلام
      </label>
      <Field label="🔴 رقم فودافون كاش" error={errors.vodafone_cash}>
        <input className={`input ltr ${errors.vodafone_cash ? "bad" : ""}`} inputMode="tel" value={value.vodafone_cash} onChange={set("vodafone_cash")} placeholder="01012345678" />
      </Field>
      <Field label="🟢 رقم اتصالات كاش" error={errors.etisalat_cash}>
        <input className={`input ltr ${errors.etisalat_cash ? "bad" : ""}`} inputMode="tel" value={value.etisalat_cash} onChange={set("etisalat_cash")} placeholder="01112345678" />
      </Field>
      <Field label="🟠 رقم أورنج كاش" error={errors.orange_cash}>
        <input className={`input ltr ${errors.orange_cash ? "bad" : ""}`} inputMode="tel" value={value.orange_cash} onChange={set("orange_cash")} placeholder="01212345678" />
      </Field>
      <Field label="🏦 حساب إنستا باي" error={errors.instapay} hint="العنوان أو الاسم المستعار، مثل name@instapay أو رقم الهاتف.">
        <input className={`input ltr ${errors.instapay ? "bad" : ""}`} value={value.instapay} maxLength={80} onChange={set("instapay")} placeholder="name@instapay" />
      </Field>
    </div>
  );
}
