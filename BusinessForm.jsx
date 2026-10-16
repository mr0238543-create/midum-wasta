import { useRef, useState } from "react";
import Icon from "../icons";
import { useApp } from "../app";
import { go } from "../router";
import * as api from "../api";
import { Empty, ErrorBox, Field, Header, Loading, StatusBadge, Async, Thumb, useAsync } from "../ui";
import { useGeo } from "../geo";
import { BUSINESS_STATUS, inEgypt, isValidPhone, normalizePhone, osmEmbedUrl, parseLatLng, processImage, timeAgo, toAr } from "../util";

const MAX_PHOTOS = 5;
const EMPTY = {
  name: "", category_id: "", type_label: "", village_id: "", phone: "", show_phone: true,
  address: "", show_address: true, hours: "", description: "", lat: null, lng: null,
};

function validate(f, agree, isNew) {
  const e = {};
  const n = f.name.trim(), t = f.type_label.trim(), d = f.description.trim(), a = f.address.trim(), h = f.hours.trim();
  if (n.length < 3 || n.length > 80) e.name = "اسم النشاط من ٣ إلى ٨٠ حرفًا.";
  if (!f.category_id) e.category_id = "اختر القسم.";
  if (t.length < 2 || t.length > 60) e.type_label = "اكتب نوع النشاط (مثل: ملابس أو بقالة).";
  if (!f.village_id) e.village_id = "اختر القرية.";
  if (!isValidPhone(normalizePhone(f.phone))) e.phone = "اكتب رقم هاتف صحيحًا (موبايل من ١١ رقمًا أو أرضي بكود المحافظة).";
  if (a.length < 3 || a.length > 200) e.address = "اكتب العنوان بالتفصيل (٣ أحرف على الأقل).";
  if (h.length < 2 || h.length > 100) e.hours = "اكتب ساعات العمل، مثل: ١٠ ص – ١٠ م.";
  if (d.length < 10 || d.length > 1000) e.description = "الوصف من ١٠ إلى ١٠٠٠ حرف.";
  if (isNew && !agree) e.agree = "يجب الموافقة على الشروط وسياسة الخصوصية.";
  return e;
}

function Form({ initial, id }) {
  const { uid, categories, villages, toast } = useApp();
  const isNew = !id;
  const [f, setF] = useState(() => (initial ? {
    ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, initial[k] ?? EMPTY[k]])),
    category_id: initial.category_id, village_id: String(initial.village_id),
  } : { ...EMPTY }));
  const [photos, setPhotos] = useState(() => (initial?.photos || []).map((p) => ({ path: p, url: api.photoUrl(p) })));
  const [removed, setRemoved] = useState([]);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [mapText, setMapText] = useState("");
  const [mapErr, setMapErr] = useState("");
  const fileRef = useRef(null);
  const geo = useGeo();
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const suspended = initial?.status === "suspended";

  const addPhotos = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = "";
    for (const file of files) {
      if (photos.length + 1 > MAX_PHOTOS) { toast(`الحد الأقصى ${toAr(MAX_PHOTOS)} صور.`, "bad"); break; }
      try {
        const blob = await processImage(file);
        setPhotos((p) => (p.length >= MAX_PHOTOS ? p : [...p, { blob, url: URL.createObjectURL(blob) }]));
      } catch (err) { toast(err.message, "bad"); }
    }
  };
  const removePhoto = (i) => {
    setPhotos((p) => {
      const x = p[i];
      if (x?.path) setRemoved((r) => [...r, x.path]);
      if (x?.blob) URL.revokeObjectURL(x.url);
      return p.filter((_, j) => j !== i);
    });
  };

  const useMyLocation = async () => {
    setMapErr("");
    const c = await geo.request();
    if (c) setF((x) => ({ ...x, lat: Number(c.lat.toFixed(6)), lng: Number(c.lng.toFixed(6)) }));
  };
  const applyMapText = () => {
    setMapErr("");
    const c = parseLatLng(mapText);
    if (!c) { setMapErr("لم نستطع قراءة الموقع. الصق رابط خرائط جوجل الكامل أو الإحداثيات مثل: 29.3,31.1"); return; }
    if (!inEgypt(c)) { setMapErr("هذه الإحداثيات خارج مصر. تأكد منها."); return; }
    setF((x) => ({ ...x, lat: c.lat, lng: c.lng })); setMapText("");
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(f, agree, isNew);
    setErrors(errs);
    if (Object.keys(errs).length) { toast("راجع الحقول المطلوبة.", "bad"); return; }
    setBusy(true);
    const uploaded = [];
    try {
      for (const p of photos.filter((x) => x.blob)) uploaded.push(await api.uploadPhoto(uid, p.blob));
      const paths = [...photos.filter((x) => x.path).map((x) => x.path), ...uploaded];
      const fields = {
        category_id: f.category_id, village_id: Number(f.village_id), name: f.name.trim(), type_label: f.type_label.trim(),
        description: f.description.trim(), phone: normalizePhone(f.phone), address: f.address.trim(), hours: f.hours.trim(),
        lat: f.lat, lng: f.lng, show_phone: f.show_phone, show_address: f.show_address, photos: paths,
      };
      if (isNew) {
        await api.createBusiness(fields);
        toast("تم إرسال نشاطك للمراجعة. سنخبرك فور الموافقة.");
      } else {
        const resubmit = ["rejected", "changes_requested"].includes(initial.status);
        const row = await api.updateBusiness(id, resubmit ? { ...fields, status: "pending" } : fields);
        if (removed.length) api.removePhotos(removed);
        toast(row.status === "pending" ? "تم الحفظ، وسيُراجَع نشاطك قبل ظهوره من جديد." : "تم حفظ التعديلات.");
      }
      go("/my", { replace: true });
    } catch (err) {
      if (uploaded.length) api.removePhotos(uploaded);
      toast(err.message, "bad");
    } finally { setBusy(false); }
  };

  const cats = categories.filter((c) => c.kind === "business");
  const hasLoc = f.lat != null && f.lng != null;

  return (
    <div className="screen fixed">
      <Header title={isNew ? "أضف نشاطك" : "تعديل النشاط"} backTo="/my" />
      <form onSubmit={submit} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }} noValidate>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} className="pad">
          {isNew ? (
            <div className="banner info">يظهر نشاطك للجميع <b>بعد مراجعة المشرف</b>، وسنرسل لك إشعارًا بالنتيجة.</div>
          ) : (
            <div className={`banner ${BUSINESS_STATUS[initial.status].tone === "bad" ? "bad" : BUSINESS_STATUS[initial.status].tone === "ok" ? "ok" : "warn"}`}>
              <b>{BUSINESS_STATUS[initial.status].label}:</b> {BUSINESS_STATUS[initial.status].hint}
              {initial.review_note && <div className="bold mt8">ملاحظة المشرف: {initial.review_note}</div>}
              {initial.status === "approved" && <div className="mt8">تعديل الاسم أو النوع أو القسم أو الوصف أو الصور أو الهاتف يعيد النشاط للمراجعة مؤقتًا.</div>}
            </div>
          )}

          <div className="col mt16">
            <Field multi label="صور النشاط (حتى ٥)" hint="صور واضحة للمكان أو المنتجات. تُضغط تلقائيًا قبل الرفع.">
              <div className="photos">
                {photos.map((p, i) => (
                  <div className="photo" key={p.path || p.url}>
                    <img src={p.url} alt="" />
                    <button type="button" className="rm" aria-label="حذف الصورة" onClick={() => removePhoto(i)}><Icon name="x" size={14} /></button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button type="button" className="photo" aria-label="إضافة صورة" onClick={() => fileRef.current?.click()} style={{ flexDirection: "column", gap: 4, border: "2px dashed var(--line)", background: "#fff" }}>
                    <Icon name="camera" size={24} /><span className="tiny bold">إضافة</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
            </Field>

            <Field label="اسم النشاط" error={errors.name}>
              <input className={`input ${errors.name ? "bad" : ""}`} value={f.name} maxLength={80} onChange={set("name")} placeholder="مثال: بوتيك الأناقة" />
            </Field>
            <Field label="القسم" error={errors.category_id}>
              <select className={`input ${errors.category_id ? "bad" : ""}`} value={f.category_id} onChange={set("category_id")}>
                <option value="">اختر القسم</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </Field>
            <Field label="نوع النشاط" error={errors.type_label}>
              <input className={`input ${errors.type_label ? "bad" : ""}`} value={f.type_label} maxLength={60} onChange={set("type_label")} placeholder="مثال: ملابس رجالي وحريمي" />
            </Field>
            <Field label="القرية" error={errors.village_id}>
              <select className={`input ${errors.village_id ? "bad" : ""}`} value={f.village_id} onChange={set("village_id")}>
                <option value="">اختر القرية</option>
                {villages.map((v) => <option key={v.id} value={v.id}>{v.name} — مركز {v.region}</option>)}
              </select>
            </Field>
            <Field label="رقم الهاتف" error={errors.phone}>
              <input className={`input ltr ${errors.phone ? "bad" : ""}`} inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="01012345678" />
            </Field>
            <label className="check">
              <input type="checkbox" checked={f.show_phone} onChange={set("show_phone")} />
              أوافق على إظهار رقم هاتفي للجميع. (إن أوقفتَه يتواصل العملاء معك عبر المحادثة داخل التطبيق)
            </label>
            <Field label="العنوان" error={errors.address}>
              <input className={`input ${errors.address ? "bad" : ""}`} value={f.address} maxLength={200} onChange={set("address")} placeholder="الشارع وأقرب علامة مميزة" />
            </Field>
            <label className="check">
              <input type="checkbox" checked={f.show_address} onChange={set("show_address")} />
              أوافق على إظهار العنوان والموقع على الخريطة للجميع.
            </label>
            <Field label="ساعات العمل" error={errors.hours}>
              <input className={`input ${errors.hours ? "bad" : ""}`} value={f.hours} maxLength={100} onChange={set("hours")} placeholder="مثال: ١٠ ص – ١٠ م" />
            </Field>
            <Field label="وصف النشاط" error={errors.description} hint={`${toAr(f.description.trim().length)} / ١٠٠٠`}>
              <textarea className={`input ${errors.description ? "bad" : ""}`} rows={4} maxLength={1000} value={f.description} onChange={set("description")} placeholder="اكتب ما تقدمه وما يميّزك" />
            </Field>

            <Field multi label="الموقع على الخريطة (اختياري)" error={mapErr}>
              <div className="col" style={{ gap: 8 }}>
                <button type="button" className="btn soft" onClick={useMyLocation} disabled={geo.busy}>
                  <Icon name="locate" size={18} /> {geo.busy ? "جارٍ التحديد…" : "استخدم موقعي الحالي (وأنت في المكان)"}
                </button>
                {geo.error && <div className="small" style={{ color: "var(--red)" }}>{geo.error}</div>}
                <div className="row">
                  <input className="input ltr grow" value={mapText} onChange={(e) => setMapText(e.target.value)} placeholder="الصق رابط خرائط جوجل أو 29.3,31.1" aria-label="رابط الموقع" />
                  <button type="button" className="btn ghost sm" onClick={applyMapText}>تطبيق</button>
                </div>
                {hasLoc && (
                  <>
                    <iframe className="map" title="معاينة الموقع" loading="lazy" src={osmEmbedUrl(f.lat, f.lng)} />
                    <button type="button" className="btn danger sm" onClick={() => setF((x) => ({ ...x, lat: null, lng: null }))}>إزالة الموقع</button>
                  </>
                )}
              </div>
            </Field>

            {isNew && (
              <Field error={errors.agree}>
                <label className="check">
                  <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors((x) => ({ ...x, agree: undefined })); }} />
                  <span>أقرّ بأن البيانات صحيحة وأنني صاحب النشاط أو مفوَّض عنه، وأوافق على <button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => go("/terms")}>الشروط</button> و<button type="button" className="bold" style={{ color: "var(--deep)" }} onClick={() => go("/privacy")}>سياسة الخصوصية</button>.</span>
                </label>
              </Field>
            )}
          </div>
        </div>
        <div className="actionbar">
          {suspended
            ? <div className="banner bad grow">هذا النشاط موقوف من الإدارة، ولا يمكن تعديله.</div>
            : <button className="btn primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : isNew ? "إرسال للمراجعة" : ["rejected", "changes_requested"].includes(initial.status) ? "حفظ وإعادة الإرسال" : "حفظ التعديلات"}</button>}
        </div>
      </form>
    </div>
  );
}

export function BusinessForm({ id }) {
  const st = useAsync(() => (id ? api.getMyBusiness(id) : Promise.resolve(null)), [id]);
  if (id) {
    if (st.loading && !st.data) return <div className="screen"><Header title="تعديل النشاط" backTo="/my" /><Loading /></div>;
    if (st.error) return <div className="screen"><Header title="تعديل النشاط" backTo="/my" /><ErrorBox error={st.error} onRetry={st.reload} /></div>;
    if (!st.data) return <div className="screen"><Header title="تعديل النشاط" backTo="/my" /><Empty icon="🔎" title="لم نجد هذا النشاط" /></div>;
  }
  return <Form key={id || "new"} id={id} initial={st.data} />;
}

// ───────────── أنشطتي ─────────────
export function MyBusinesses() {
  const { uid, toast, confirm, category, village } = useApp();
  const st = useAsync(() => api.listMyBusinesses(uid), [uid]);

  const remove = async (b) => {
    const ok = await confirm({ title: `حذف «${b.name}»؟`, body: "سيُحذف النشاط وتقييماته ومحادثاته نهائيًا ولا يمكن التراجع.", okLabel: "حذف نهائي", danger: true });
    if (!ok) return;
    try {
      await api.deleteBusiness(b.id);
      api.removePhotos(b.photos);
      toast("تم حذف النشاط");
      st.reload();
    } catch (e) { toast(e.message, "bad"); }
  };

  return (
    <div className="screen">
      <Header title="أنشطتي" backTo="/account" right={<button className="round-btn" aria-label="إضافة نشاط" onClick={() => go("/add")}><Icon name="plus" /></button>} />
      <div className="pad">
        <Async state={st} rows={2}
          empty={<Empty icon="🏪" title="لم تضف أي نشاط بعد" text="سجّل محلك أو خدمتك ليجدك أهل منطقتك." action={<button className="btn primary" onClick={() => go("/add")}>أضف نشاطك</button>} />}>
          {(rows) => (
            <div className="col">
              {rows.map((b) => (
                <div key={b.id} className="card col" style={{ gap: 10 }}>
                  <div className="row" style={{ alignItems: "flex-start" }}>
                    <Thumb business={b} size={56} />
                    <div className="grow">
                      <div className="bold trunc">{b.name}</div>
                      <div className="muted small trunc">{category(b.category_id)?.name} · {village(b.village_id)?.name}</div>
                      <div className="row mt8" style={{ gap: 8 }}><StatusBadge status={b.status} /><span className="tiny muted">{timeAgo(b.created_at)}</span></div>
                    </div>
                  </div>
                  {b.review_note && <div className="banner warn">ملاحظة المشرف: {b.review_note}</div>}
                  <div className="row wrap" style={{ gap: 8 }}>
                    <button className="btn soft sm" onClick={() => go(`/b/${b.id}`)}>عرض</button>
                    <button className="btn soft sm" onClick={() => go(`/my/${b.id}`)}><Icon name="edit" size={14} /> {["rejected", "changes_requested"].includes(b.status) ? "تعديل وإعادة إرسال" : "تعديل"}</button>
                    <button className="btn danger sm" onClick={() => remove(b)}><Icon name="trash" size={14} /> حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}
