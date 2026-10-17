import { useRef, useState } from "react";
import Icon from "./icons";
import * as api from "./api";
import { useApp } from "./app";
import { ContactButtons, OrderSheet } from "./Orders";
import { Field, Sheet, useAsync } from "./ui";
import { money, parsePrice, processImage, toAr } from "./util";

// ───────────── نافذة إضافة/تعديل منتج (محلية؛ الحفظ يتم مع زر حفظ النشاط) ─────────────
function ProductSheet({ initial, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [photo, setPhoto] = useState(initial ? { path: initial.path, blob: initial.blob, url: initial.url } : null);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const blob = await processImage(file);
      if (photo?.blob) URL.revokeObjectURL(photo.url);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
      setErr((x) => ({ ...x, photo: undefined }));
    } catch (er) { setErr((x) => ({ ...x, photo: er.message })); } finally { setBusy(false); }
  };

  const save = () => {
    const e = {};
    const n = name.trim();
    const p = parsePrice(price);
    if (n.length < 2 || n.length > 80) e.name = "اسم المنتج من حرفين إلى ٨٠ حرفًا.";
    if (p == null) e.price = "اكتب السعر بالجنيه (أرقام فقط).";
    setErr(e);
    if (Object.keys(e).length) return;
    onSave({ ...(initial || {}), oldPath: initial?.id ? (initial.oldPath ?? initial.path) : undefined, name: n, price: p, path: photo?.path, blob: photo?.blob, url: photo?.url, dirty: true });
    onClose();
  };

  return (
    <Sheet title={initial ? "تعديل المنتج" : "إضافة منتج"} onClose={onClose}>
      <div className="col">
        <Field label="صورة المنتج" error={err.photo} hint="اختياري، لكن الصورة تزيد فرص الطلب. تُضغط تلقائيًا.">
          <div className="photos" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {photo ? (
              <div className="photo">
                <img src={photo.url} alt="" />
                <button type="button" className="rm" aria-label="حذف الصورة" onClick={() => setPhoto(null)}><Icon name="x" size={14} /></button>
              </div>
            ) : (
              <button type="button" className="photo" aria-label="إضافة صورة" disabled={busy} onClick={() => fileRef.current?.click()}
                style={{ flexDirection: "column", gap: 4, border: "2px dashed var(--line)", background: "#fff" }}>
                <Icon name="camera" size={24} /><span className="tiny bold">{busy ? "جارٍ…" : "إضافة"}</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
        </Field>
        <Field label="اسم المنتج" error={err.name}>
          <input className={`input ${err.name ? "bad" : ""}`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="مثال: فستان سهرة" />
        </Field>
        <Field label="السعر بالجنيه" error={err.price}>
          <input className={`input ltr ${err.price ? "bad" : ""}`} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250" />
        </Field>
        <button type="button" className="btn primary block" onClick={save}>{initial ? "تحديث المنتج" : "إضافة المنتج"}</button>
      </div>
    </Sheet>
  );
}

// ───────────── قسم المنتجات داخل شاشة (أضف نشاطك / تعديل النشاط) ─────────────
export function ProductsEditor({ items, setItems, onRemove }) {
  const [sheet, setSheet] = useState(null); // null | { index?: number }
  const upsert = (p) => {
    setItems((list) => {
      if (sheet?.index != null) return list.map((x, i) => (i === sheet.index ? { ...p, key: x.key } : x));
      return [...list, { ...p, key: crypto.randomUUID() }];
    });
  };
  const remove = (i) => {
    const x = items[i];
    if (x.blob) URL.revokeObjectURL(x.url);
    if (x.id) onRemove(x);
    setItems((list) => list.filter((_, j) => j !== i));
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between">
        <div>
          <div className="bold">المنتجات والكتالوج</div>
          <div className="small muted">أضف منتجاتك بصورها وأسعارها لتظهر للزبائن. بدون حد أقصى للعدد.</div>
        </div>
      </div>
      {items.length > 0 && (
        <div className="products">
          {items.map((p, i) => (
            <div className="product" key={p.key}>
              <div className="pimg">{p.url ? <img src={p.url} alt="" /> : "🛍️"}</div>
              <div className="pbody"><div className="pname">{p.name}</div><div className="pprice">{money(p.price)}</div></div>
              <div className="pactions">
                <button type="button" className="btn soft sm grow" onClick={() => setSheet({ index: i })}><Icon name="edit" size={14} /> تعديل</button>
                <button type="button" className="btn danger sm" aria-label="حذف المنتج" onClick={() => remove(i)}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" className="btn soft block" onClick={() => setSheet({})}>
        <Icon name="plus" size={18} /> إضافة منتج
      </button>
      {items.some((p) => p.dirty) && <div className="tiny muted">تُحفظ المنتجات عند الضغط على زر الحفظ أسفل الشاشة.</div>}
      {sheet && <ProductSheet initial={sheet.index != null ? items[sheet.index] : null} onClose={() => setSheet(null)} onSave={upsert} />}
    </div>
  );
}

export const toItem = (row) => ({
  key: row.id, id: row.id, name: row.name, price: Number(row.price),
  path: row.photo || undefined, url: row.photo ? api.photoUrl(row.photo) : undefined,
});

// حفظ التغييرات على الخادم: حذف المحذوف، رفع الصور الجديدة، إضافة/تحديث الباقي بترتيبه الحالي
export async function syncProducts({ uid, businessId, items, removed }) {
  const uploaded = [];
  try {
    for (const r of removed) { await api.deleteProduct(r.id); }
    api.removePhotos(removed.map((r) => r.path).filter(Boolean));
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (p.id && !p.dirty) continue;
      let photo = p.path || null;
      if (p.blob) { photo = await api.uploadPhoto(uid, p.blob); uploaded.push(photo); }
      const fields = { name: p.name, price: p.price, photo, sort_order: i };
      if (p.id) {
        await api.updateProduct(p.id, fields);
        if (p.oldPath && p.oldPath !== photo) api.removePhotos([p.oldPath]);
      } else {
        await api.createProduct({ business_id: businessId, ...fields });
      }
    }
  } catch (e) {
    if (uploaded.length) api.removePhotos(uploaded);
    throw e;
  }
}

// ───────────── عرض المنتجات للزبائن داخل صفحة النشاط ─────────────
export function ProductsSection({ business, canOrder }) {
  const { requireLogin } = useApp();
  const st = useAsync(() => api.listProducts(business.id), [business.id]);
  const [detail, setDetail] = useState(null);
  const [order, setOrder] = useState(null);
  if (!st.data || st.data.length === 0) return null;
  const buy = (p) => { if (requireLogin(`/b/${business.id}`)) { setDetail(null); setOrder(p); } };
  return (
    <div className="mt24">
      <h2 className="h2">المنتجات <span className="muted small">({toAr(st.data.length)})</span></h2>
      <div className="products mt12">
        {st.data.map((p) => (
          <div className="product" key={p.id}>
            <button type="button" className="pimg" aria-label={`تفاصيل ${p.name}`} onClick={() => setDetail(p)}>
              {p.photo ? <img src={api.photoUrl(p.photo)} alt={p.name} loading="lazy" /> : "🛍️"}
            </button>
            <div className="pbody"><div className="pname">{p.name}</div><div className="pprice">{money(p.price)}</div></div>
            {canOrder && (
              <div className="pactions"><button type="button" className="btn primary sm grow" onClick={() => buy(p)}>طلب شراء</button></div>
            )}
          </div>
        ))}
      </div>
      {detail && (
        <Sheet title={detail.name} onClose={() => setDetail(null)}>
          {detail.photo && <img src={api.photoUrl(detail.photo)} alt={detail.name} style={{ width: "100%", borderRadius: 16 }} />}
          <div className="pprice mt12" style={{ color: "var(--deep)", fontWeight: 800, fontSize: 18 }}>{money(detail.price)}</div>
          <div className="col mt12">
            {canOrder && <button type="button" className="btn primary block" onClick={() => buy(detail)}>طلب شراء</button>}
            {business.phone && <ContactButtons phone={business.phone} waText={`مرحبًا، أستفسر عن «${detail.name}» في «${business.name}»`} />}
          </div>
        </Sheet>
      )}
      {order && <OrderSheet business={business} product={order} onClose={() => setOrder(null)} />}
    </div>
  );
}
