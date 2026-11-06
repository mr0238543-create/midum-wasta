import { useRef, useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go } from "./router";
import * as api from "./api";
import { Async, Empty, ErrorBox, Field, Header, Loading, Sheet, useAsync } from "./ui";
import { PAYMENT_LABELS, WALLET_METHODS, fmtMoney, isValidPhone, normalizePhone, processImage, toAr, toLatinDigits } from "./util";

const MAX_QTY = 99;

// ───────────── شراء منتج (على صفحة النشاط) ─────────────
function OrderSheet({ business, product, methods, onClose }) {
  const { uid, profile, villages, toast } = useApp();
  const accepted = ["cod", ...WALLET_METHODS].filter((m) => (m === "cod" ? (methods ? methods.cod : true) : methods && methods[m]));
  const [qty, setQty] = useState(1);
  const [name, setName] = useState(profile?.full_name || "");
  const [phone, setPhone] = useState(profile?.phone ? normalizePhone(profile.phone) : "");
  const [address, setAddress] = useState("");
  const [villageId, setVillageId] = useState(profile?.village_id ? String(profile.village_id) : "");
  const [note, setNote] = useState("");
  const [pay, setPay] = useState(accepted[0] || "");
  const [receipt, setReceipt] = useState(null); // { blob, url }
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});
  const fileRef = useRef(null);
  const wallet = WALLET_METHODS.includes(pay);

  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { const blob = await processImage(f); setReceipt({ blob, url: URL.createObjectURL(blob) }); }
    catch (err) { toast(err.message, "bad"); }
  };

  const submit = async () => {
    const local = normalizePhone(phone);
    const e = {};
    if (name.trim().length < 2) e.name = "اكتب اسمك.";
    if (!isValidPhone(local)) e.phone = "اكتب رقم هاتف صحيح.";
    if (address.trim().length < 5) e.address = "اكتب عنوان التوصيل (٥ أحرف على الأقل).";
    if (!pay) e.pay = "لا توجد طريقة دفع متاحة.";
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const receipt_path = wallet && receipt ? await api.uploadReceipt(uid, receipt.blob) : null;
      const o = await api.createOrder({
        business_id: business.id, product_id: product.id, quantity: qty,
        customer_name: name.trim(), customer_phone: local, address: address.trim(),
        village_id: villageId ? Number(villageId) : null, note: note.trim() || null,
        payment_method: pay, receipt_path,
      });
      toast("تم إرسال طلب الشراء.");
      onClose();
      go(`/orders/${o.id}`);
    } catch (err) { toast(err.message, "bad"); } finally { setBusy(false); }
  };

  return (
    <Sheet title={`شراء: ${product.name}`} onClose={onClose}>
      <div className="col">
        <div className="row between">
          <div className="muted small">السعر {fmtMoney(product.price)}</div>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="round-btn" aria-label="إنقاص" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
            <span className="bold" aria-live="polite">{toAr(qty)}</span>
            <button type="button" className="round-btn" aria-label="زيادة" disabled={qty >= MAX_QTY} onClick={() => setQty(qty + 1)}>+</button>
          </div>
        </div>
        <div className="bold">الإجمالي: {fmtMoney(product.price * qty)}</div>
        <Field label="الاسم" error={errs.name}><input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        <Field label="رقم الهاتف" error={errs.phone}><input className="input ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" /></Field>
        <Field label="القرية">
          <select className="input" value={villageId} onChange={(e) => setVillageId(e.target.value)}>
            <option value="">بدون تحديد</option>
            {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <Field label="عنوان التوصيل" error={errs.address}><textarea className="input" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <Field label="ملاحظات (اختياري)"><input className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label="طريقة الدفع" multi error={errs.pay}>
          <div className="col" style={{ gap: 6 }}>
            {accepted.map((m) => (
              <label key={m} className="check">
                <input type="radio" name="pay" checked={pay === m} onChange={() => setPay(m)} />
                {PAYMENT_LABELS[m]}{m !== "cod" && methods?.[m] ? <span className="ltr muted" style={{ marginInlineStart: 6 }}>{methods[m]}</span> : null}
              </label>
            ))}
          </div>
        </Field>
        {wallet && (
          <div className="banner info">
            حوّل {fmtMoney(product.price * qty)} إلى الرقم/الحساب الظاهر ثم ارفع صورة الإيصال (يمكنك رفعها لاحقًا من صفحة الطلب).
            <div className="mt8">
              {receipt ? <img src={receipt.url} alt="الإيصال" style={{ maxWidth: 140, borderRadius: 10 }} /> : null}
              <button type="button" className="btn soft sm" onClick={() => fileRef.current?.click()}><Icon name="plus" size={14} /> {receipt ? "تغيير الإيصال" : "إرفاق إيصال"}</button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
            </div>
          </div>
        )}
        <button className="btn primary block" disabled={busy} onClick={submit}>{busy ? "جارٍ الإرسال…" : "تأكيد الطلب"}</button>
      </div>
    </Sheet>
  );
}

// ───────────── قسم المنتجات في صفحة النشاط ─────────────
export function ProductsSection({ business, canBuy, requireLogin }) {
  const list = useAsync(() => api.listProducts(business.id), [business.id]);
  const pay = useAsync(() => api.getPaymentMethods(business.id), [business.id]);
  const [sel, setSel] = useState(null);
  if (list.loading || !list.data?.length) return null;
  return (
    <>
      <h2 className="h2 mt24">المنتجات</h2>
      <div className="col mt12">
        {list.data.map((p) => (
          <div key={p.id} className="card row" style={{ gap: 12, alignItems: "center" }}>
            {p.photo ? <img src={api.photoUrl(p.photo)} alt="" loading="lazy" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 12 }} /> : <div style={{ width: 64, height: 64, borderRadius: 12, background: "var(--soft)", display: "grid", placeItems: "center" }}>🛍️</div>}
            <div className="grow"><div className="bold">{p.name}</div><div className="muted small">{fmtMoney(p.price)}</div></div>
            {canBuy && <button className="btn primary sm" onClick={() => { if (requireLogin(`/b/${business.id}`)) setSel(p); }}>شراء</button>}
          </div>
        ))}
      </div>
      {sel && <OrderSheet business={business} product={sel} methods={pay.data} onClose={() => setSel(null)} />}
    </>
  );
}

// ───────────── إدارة المنتجات ووسائل الدفع (لصاحب النشاط) ─────────────
function ProductSheet({ businessId, initial, onClose, onSaved }) {
  const { uid, toast } = useApp();
  const [name, setName] = useState(initial?.name || "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [photo, setPhoto] = useState(initial?.photo || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { setBusy(true); const blob = await processImage(f, 900); setPhoto(await api.uploadPhoto(uid, blob)); }
    catch (er) { toast(er.message, "bad"); } finally { setBusy(false); }
  };
  const save = async () => {
    const n = Number(toLatinDigits(price).replace(/[,٫،]/g, ".").trim());
    if (name.trim().length < 2) { setErr("اكتب اسم المنتج."); return; }
    if (!Number.isFinite(n) || n < 0 || n > 10000000) { setErr("اكتب سعرًا صحيحًا."); return; }
    setBusy(true); setErr("");
    try { await api.saveProduct({ id: initial?.id, business_id: businessId, name, price: n, photo }); onSaved(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title={initial ? "تعديل منتج" : "إضافة منتج"} onClose={onClose}>
      <div className="col">
        <Field label="اسم المنتج"><input className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="السعر (ج.م)" error={err}><input className="input ltr" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="صورة (اختياري)" multi>
          <div className="row" style={{ gap: 10 }}>
            {photo && <img src={api.photoUrl(photo)} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 12 }} />}
            <button type="button" className="btn soft sm" disabled={busy} onClick={() => fileRef.current?.click()}>{photo ? "تغيير" : "إضافة صورة"}</button>
            {photo && <button type="button" className="btn danger sm" onClick={() => setPhoto(null)}>إزالة</button>}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
          </div>
        </Field>
        <button className="btn primary block" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </Sheet>
  );
}

function PaymentsCard({ businessId }) {
  const { toast } = useApp();
  const st = useAsync(() => api.getMyPayments(businessId), [businessId]);
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (st.loading && !st.data && !f) return <Loading rows={1} />;
  if (st.error) return <ErrorBox error={st.error} onRetry={st.reload} />;
  const cur = f || { cod: st.data ? st.data.cod : true, vodafone_cash: st.data?.vodafone_cash || "", etisalat_cash: st.data?.etisalat_cash || "", orange_cash: st.data?.orange_cash || "", instapay: st.data?.instapay || "" };
  const set = (k, v) => setF({ ...cur, [k]: v });
  const save = async () => {
    const out = { cod: cur.cod };
    for (const m of WALLET_METHODS) {
      let v = toLatinDigits(cur[m] || "").trim();
      if (m !== "instapay" && v) { v = normalizePhone(v); if (!/^01[0125]\d{8}$/.test(v)) { setErr(`رقم ${PAYMENT_LABELS[m]} غير صحيح (١١ رقمًا).`); return; } }
      if (m === "instapay" && v && (v.length < 3 || v.length > 80)) { setErr("عنوان إنستاباي بين ٣ و٨٠ حرفًا."); return; }
      out[m] = v || null;
    }
    setBusy(true); setErr("");
    try { await api.saveMyPayments(businessId, out); setF(null); st.reload(); toast("تم حفظ وسائل الدفع"); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="card col">
      <div className="h2">وسائل الدفع</div>
      <label className="check"><input type="checkbox" checked={cur.cod} onChange={(e) => set("cod", e.target.checked)} /> الدفع عند الاستلام</label>
      {WALLET_METHODS.map((m) => (
        <Field key={m} label={PAYMENT_LABELS[m]} hint={m === "instapay" ? "عنوان الدفع (مثل name@instapay). اتركه فارغًا لإيقافها." : "رقم المحفظة. اتركه فارغًا لإيقافها."}>
          <input className="input ltr" value={cur[m]} onChange={(e) => set(m, e.target.value)} />
        </Field>
      ))}
      {err && <div className="banner bad" role="alert">{err}</div>}
      <button className="btn primary block" disabled={busy || !f} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ وسائل الدفع"}</button>
    </div>
  );
}

export default function ShopManager({ id }) {
  const { toast, confirm } = useApp();
  const st = useAsync(async () => ({ b: await api.getMyBusiness(id), products: await api.listMyProducts(id) }), [id]);
  const [sheet, setSheet] = useState(null);
  const remove = async (p) => {
    if (!(await confirm({ title: `حذف «${p.name}»؟`, okLabel: "حذف", danger: true }))) return;
    try { await api.deleteProduct(p.id); st.reload(); } catch (e) { toast(e.message, "bad"); }
  };
  return (
    <div className="screen">
      <Header title="المنتجات والدفع" backTo="/my" right={<button className="round-btn" aria-label="إضافة منتج" onClick={() => setSheet({})}><Icon name="plus" /></button>} />
      <div className="pad col">
        <Async state={st} rows={2}>
          {(d) => !d.b ? <Empty icon="🔎" title="لم نجد هذا النشاط" /> : (
            <>
              {d.b.status !== "approved" && <div className="banner warn">المنتجات ووسائل الدفع تظهر للمشترين بعد اعتماد النشاط.</div>}
              {d.products.length === 0
                ? <Empty icon="🛍️" title="لا توجد منتجات بعد" text="أضف منتجاتك ليشتريها أهل المنطقة مباشرة." action={<button className="btn primary" onClick={() => setSheet({})}>إضافة منتج</button>} />
                : d.products.map((p) => (
                  <div key={p.id} className="card row" style={{ gap: 12, alignItems: "center" }}>
                    {p.photo ? <img src={api.photoUrl(p.photo)} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 12 }} /> : <div style={{ width: 56, height: 56, borderRadius: 12, background: "var(--soft)", display: "grid", placeItems: "center" }}>🛍️</div>}
                    <div className="grow"><div className="bold">{p.name}</div><div className="muted small">{fmtMoney(p.price)}</div></div>
                    <button className="btn soft sm" onClick={() => setSheet(p)}>تعديل</button>
                    <button className="btn danger sm" aria-label="حذف" onClick={() => remove(p)}><Icon name="trash" size={14} /></button>
                  </div>
                ))}
              <PaymentsCard businessId={id} />
            </>
          )}
        </Async>
      </div>
      {sheet && <ProductSheet businessId={id} initial={sheet.id ? sheet : null} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); st.reload(); }} />}
    </div>
  );
}
