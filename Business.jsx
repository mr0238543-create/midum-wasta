import { useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { ProductsSection } from "./Products";
import { back, go } from "./router";
import * as api from "./api";
import { Empty, ErrorBox, Field, Loading, Sheet, Stars, StarPicker, StatusBadge, useAsync } from "./ui";
import { ReportSheet } from "./shared";
import { BUSINESS_STATUS, directionsUrl, fmtRating, osmEmbedUrl, shareUrl, timeAgo, toAr } from "./util";

function Row({ icon, label, children }) {
  return (
    <div className="info-row">
      <div className="ico"><Icon name={icon} size={17} /></div>
      <div className="grow">
        <div className="muted small">{label}</div>
        <div className="bold" style={{ fontSize: 14, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

// ───────────── طلب خدمة / استفسار ─────────────
function RequestSheet({ business, onClose }) {
  const { toast, profile } = useApp();
  const [kind, setKind] = useState("service");
  const [message, setMessage] = useState("");
  const [sharePhone, setSharePhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    if (message.trim().length < 5) { setErr("اكتب تفاصيل الطلب (٥ أحرف على الأقل)."); return; }
    setBusy(true); setErr("");
    try {
      const r = await api.createRequest({ businessId: business.id, kind, message: message.trim(), sharePhone });
      toast("تم إرسال طلبك، وستصلك إشعارات بتحديثاته.");
      onClose();
      go(`/requests/${r.id}`);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title={`طلب من «${business.name}»`} onClose={onClose}>
      <div className="col">
        <div className="tabs2" role="radiogroup" aria-label="نوع الطلب">
          <button type="button" className={kind === "service" ? "on" : ""} role="radio" aria-checked={kind === "service"} onClick={() => setKind("service")}>طلب خدمة</button>
          <button type="button" className={kind === "inquiry" ? "on" : ""} role="radio" aria-checked={kind === "inquiry"} onClick={() => setKind("inquiry")}>استفسار</button>
        </div>
        <Field label="تفاصيل الطلب" error={err}>
          <textarea className={`input ${err ? "bad" : ""}`} rows={4} maxLength={1000} value={message} onChange={(e) => { setMessage(e.target.value); setErr(""); }}
            placeholder={kind === "service" ? "اشرح الخدمة المطلوبة والموعد المناسب" : "اكتب سؤالك"} />
        </Field>
        {profile?.phone && (
          <label className="check">
            <input type="checkbox" checked={sharePhone} onChange={(e) => setSharePhone(e.target.checked)} />
            أوافق على مشاركة رقم هاتفي مع صاحب النشاط ليتواصل معي. (بدونه يكون التواصل داخل التطبيق فقط)
          </label>
        )}
        <button className="btn primary block" disabled={busy} onClick={submit}>{busy ? "جارٍ الإرسال…" : "إرسال الطلب"}</button>
      </div>
    </Sheet>
  );
}

// ───────────── تقييم ─────────────
function ReviewSheet({ business, existing, onClose, onSaved }) {
  const { uid, toast, confirm } = useApp();
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!rating) { setErr("اختر عدد النجوم."); return; }
    setBusy(true);
    try {
      await api.saveReview({ businessId: business.id, uid, rating, comment });
      toast("شكرًا على تقييمك");
      onSaved(); onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!(await confirm({ title: "حذف تقييمك؟", okLabel: "حذف", danger: true }))) return;
    setBusy(true);
    try { await api.deleteMyReview(existing.id); toast("تم حذف التقييم"); onSaved(); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title={existing ? "تعديل تقييمك" : "قيّم هذا النشاط"} onClose={onClose}>
      <div className="col">
        <div className="row" style={{ justifyContent: "center" }}><StarPicker value={rating} onChange={(n) => { setRating(n); setErr(""); }} /></div>
        <Field label="تعليقك (اختياري)" error={err}>
          <textarea className="input" rows={3} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="شاركنا تجربتك بأدب واحترام" />
        </Field>
        <button className="btn primary block" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ التقييم"}</button>
        {existing && <button className="btn danger block" disabled={busy} onClick={remove}>حذف تقييمي</button>}
      </div>
    </Sheet>
  );
}

function Reviews({ business, canReview, onChanged, onReport }) {
  const { uid, requireLogin } = useApp();
  const list = useAsync(() => api.listReviews(business.id), [business.id]);
  const mine = useAsync(() => (uid && canReview ? api.getMyReview(business.id, uid) : Promise.resolve(null)), [business.id, uid, canReview]);
  const [open, setOpen] = useState(false);
  const saved = () => { list.reload(); mine.reload(); onChanged(); };
  return (
    <div className="mt24">
      <div className="row between">
        <h2 className="h2">التقييمات {business.rating_count > 0 && <span className="muted small">({toAr(business.rating_count)})</span>}</h2>
        {canReview && (
          <button className="btn soft sm" onClick={() => { if (requireLogin(`/b/${business.id}`)) setOpen(true); }}>
            <Icon name="star" size={14} /> {mine.data ? "تعديل تقييمي" : "أضف تقييمك"}
          </button>
        )}
      </div>
      <div className="mt12 col">
        {list.loading && !list.data ? <div className="skel" style={{ height: 70 }} />
          : list.error ? <ErrorBox error={list.error} onRetry={list.reload} />
          : list.data.length === 0 ? <div className="muted small">لا توجد تقييمات بعد. كن أول من يقيّم.</div>
          : list.data.map((r) => (
            <div key={r.id} className="card flat">
              <div className="row between">
                <div className="bold">{r.author}</div>
                <div className="row" style={{ gap: 8 }}>
                  <Stars value={r.rating} size={13} />
                  {canReview && mine.data?.id !== r.id && (
                    <button aria-label="الإبلاغ عن هذا التقييم" className="muted" onClick={() => onReport({ type: "review", id: r.id, label: "هذا التقييم" })}><Icon name="flag" size={15} /></button>
                  )}
                </div>
              </div>
              {r.comment && <p style={{ margin: "6px 0 0", lineHeight: 1.8, fontSize: 14 }}>{r.comment}</p>}
              <div className="tiny muted mt8">{timeAgo(r.created_at)}</div>
            </div>
          ))}
      </div>
      {open && <ReviewSheet business={business} existing={mine.data} onClose={() => setOpen(false)} onSaved={saved} />}
    </div>
  );
}

// ───────────── صفحة النشاط ─────────────
export default function Business({ id }) {
  const { uid, village, category, favIds, toggleFav, toast, requireLogin } = useApp();
  const st = useAsync(async () => {
    const pub = await api.getBusiness(id);
    const mine = uid ? await api.getMyBusiness(id).catch(() => null) : null;
    return { pub, mine };
  }, [id, uid]);
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);

  const topBar = (title = "النشاط") => (
    <div className="hdr"><div className="row"><button className="round-btn" aria-label="رجوع" onClick={() => back("/")}><Icon name="back" /></button><h1 className="grow trunc">{title}</h1></div></div>
  );
  if (st.loading && !st.data) return <div className="screen">{topBar()}<Loading /></div>;
  if (st.error) return <div className="screen">{topBar()}<ErrorBox error={st.error} onRetry={st.reload} /></div>;

  const { pub, mine } = st.data;
  const b = pub || mine;
  if (!b) return <div className="screen">{topBar()}<Empty icon="🔎" title="لم نجد هذا النشاط" text="ربما حُذف أو لم تتم الموافقة عليه بعد." action={<button className="btn soft" onClick={() => go("/")}>الرئيسية</button>} /></div>;

  const isPublic = Boolean(pub);
  const isOwner = Boolean(mine && mine.owner_id === uid);
  const isAdminPreview = Boolean(mine && !isOwner);
  const cat = category(b.category_id);
  const v = village(b.village_id);
  const fav = favIds.has(b.id);
  const demo = Boolean(b.is_demo);
  const interactive = isPublic && !isOwner && !demo && (pub ? pub.chat_enabled : false);
  const photos = b.photos || [];
  const statusInfo = BUSINESS_STATUS[b.status];

  const share = async () => {
    const url = shareUrl(`/b/${b.id}`);
    try {
      if (navigator.share) { await navigator.share({ title: b.name, url }); return; }
      await navigator.clipboard.writeText(url);
      toast("تم نسخ رابط النشاط");
    } catch { /* المستخدم ألغى المشاركة */ }
  };

  const startChat = async () => {
    if (!requireLogin(`/b/${b.id}`)) return;
    setBusy(true);
    try { go(`/chat/${await api.startConversation(b.id)}`); }
    catch (e) { toast(e.message, "bad"); } finally { setBusy(false); }
  };

  return (
    <div className="screen" style={{ paddingBottom: 0 }}>
      <div className="hero" aria-label={b.name}>
        {photos[0] ? <img src={api.photoUrl(photos[0])} alt={b.name} /> : cat?.emoji || "📍"}
        <button className="round-btn white" aria-label="رجوع" style={{ position: "absolute", top: 16, right: 16 }} onClick={() => back("/")}><Icon name="back" /></button>
        <div className="row" style={{ position: "absolute", top: 16, left: 16 }}>
          <button className="round-btn white" aria-label="مشاركة" onClick={share}><Icon name="share" size={18} /></button>
          {isPublic && (
            <button className="round-btn white" aria-label={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"} onClick={() => toggleFav(b.id)}>
              <Icon name="heart" size={18} fill={fav ? "var(--orange)" : "none"} style={{ color: "var(--orange)" }} />
            </button>
          )}
        </div>
      </div>

      <div className="pad" style={{ marginTop: -36, paddingBottom: 24 }}>
        <div className="card" style={{ boxShadow: "var(--shadow-lg)" }}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <h1 className="h2" style={{ fontSize: 20, lineHeight: 1.4 }}>{b.name}</h1>
            {demo ? <span className="badge mute">بيانات تجريبية</span> : !isPublic && <StatusBadge status={b.status} />}
          </div>
          <div className="muted small">{b.type_label}{cat ? ` · ${cat.name}` : ""}</div>
          <div className="row mt8" style={{ gap: 12 }}>
            {b.rating_count > 0 ? <Stars value={b.rating_avg} size={15} /> : <span className="badge brand">جديد</span>}
            <span className="muted small">{b.rating_count > 0 ? `(${toAr(b.rating_count)} تقييم)` : "بانتظار أول تقييم"}</span>
          </div>
        </div>

        {!isPublic && statusInfo && (
          <div className={`banner ${statusInfo.tone === "ok" ? "ok" : statusInfo.tone === "bad" ? "bad" : "warn"} mt12`}>
            {isAdminPreview ? "معاينة للمشرف — " : ""}{statusInfo.hint}
            {b.review_note && <div className="bold mt8">ملاحظة المشرف: {b.review_note}</div>}
          </div>
        )}
        {demo && <div className="banner info mt12">هذا النشاط بيانات تجريبية للعرض فقط وليس نشاطًا حقيقيًا.</div>}

        <div className="card col mt12">
          {v && <Row icon="pin" label="القرية">{v.name}</Row>}
          {b.address && <Row icon="store" label="العنوان">{b.address}</Row>}
          {b.phone && <Row icon="phone" label="رقم الهاتف"><span className="ltr" style={{ display: "inline-block" }}>{toAr(b.phone)}</span></Row>}
          <Row icon="clock" label="ساعات العمل">{b.hours}</Row>
        </div>

        <h2 className="h2 mt24">عن النشاط</h2>
        <p className="prose" style={{ margin: "6px 0 0" }}>{b.description}</p>

        {photos.length > 1 && (
          <>
            <h2 className="h2 mt24">الصور</h2>
            <div className="gallery mt12">{photos.map((p) => <img key={p} src={api.photoUrl(p)} alt="" loading="lazy" />)}</div>
          </>
        )}

        {b.lat != null && b.lng != null && (
          <>
            <h2 className="h2 mt24">الموقع</h2>
            <iframe className="map mt12" title="موقع النشاط على الخريطة" loading="lazy" src={osmEmbedUrl(b.lat, b.lng)} />
          </>
        )}

        {interactive && (
          <button className="btn soft block mt24" onClick={() => { if (requireLogin(`/b/${b.id}`)) setSheet("request"); }}>
            <Icon name="clipboard" size={18} /> إرسال طلب خدمة أو استفسار
          </button>
        )}

        {isPublic && !demo && (
          <>
            <ProductsSection business={b} canOrder={interactive} />
            <Reviews business={b} canReview={interactive} onChanged={st.reload} onReport={(t) => setSheet({ report: t })} />
          </>
        )}

        {isPublic && !isOwner && !demo && (
          <button className="row mt24 small muted" style={{ margin: "24px auto 0" }} onClick={() => { if (requireLogin(`/b/${b.id}`)) setSheet({ report: { type: "business", id: b.id, label: "هذا النشاط" } }); }}>
            <Icon name="flag" size={15} /> الإبلاغ عن هذا النشاط
          </button>
        )}
      </div>

      <div className="actionbar" style={{ position: "sticky", bottom: 0 }}>
        {isOwner ? (
          <>
            <button className="btn primary" onClick={() => go(`/my/${b.id}`)}><Icon name="edit" size={18} /> تعديل النشاط</button>
            <button className="btn soft" onClick={() => go("/my")}>أنشطتي</button>
          </>
        ) : isPublic ? (
          <>
            {b.phone && <a className="btn primary" href={`tel:${b.phone}`}><Icon name="phone" size={18} /> اتصال</a>}
            {interactive && <button className="btn soft" disabled={busy} onClick={startChat}><Icon name="chat" size={18} /> محادثة</button>}
            <a className="btn soft" href={directionsUrl(b, v?.name)} target="_blank" rel="noreferrer"><Icon name="navigation" size={18} /> الاتجاهات</a>
          </>
        ) : isAdminPreview ? (
          <button className="btn primary" onClick={() => go("/admin")}>العودة للوحة المشرف</button>
        ) : null}
      </div>

      {sheet === "request" && <RequestSheet business={b} onClose={() => setSheet(null)} />}
      {sheet?.report && <ReportSheet target={sheet.report} onClose={() => setSheet(null)} />}
    </div>
  );
}
