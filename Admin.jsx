import { useState } from "react";
import Icon from "../icons";
import { useApp } from "../app";
import { go } from "../router";
import * as api from "../api";
import { Async, Empty, Header, StatusBadge, useAsync } from "../ui";
import { BUSINESS_STATUS, JOB_STATUS, JOB_TYPES, REPORT_REASONS, directionsUrl, timeAgo, toAr } from "../util";

const Chips = ({ items, value, onChange }) => (
  <div className="chips" style={{ padding: "0 0 8px" }}>
    {items.map((t) => (
      <button key={t.id} className={`chip ${value === t.id ? "on" : ""}`} onClick={() => onChange(t.id)}>
        {t.label}{t.count > 0 ? ` (${toAr(t.count)})` : ""}
      </button>
    ))}
  </div>
);

const ownerLine = (p) => (p ? `${p.full_name || "بدون اسم"} — ${p.phone ? "+" + p.phone.replace(/^\+/, "") : "بدون هاتف"}${p.is_banned ? " (محظور)" : ""}` : "—");

// ───────────── مراجعة الأنشطة ─────────────
function BusinessesPanel({ onChange }) {
  const { category, village, ask, confirm, toast } = useApp();
  const [status, setStatus] = useState("pending");
  const st = useAsync(async () => {
    const rows = await api.adminListBusinesses(status === "all" ? null : status);
    return { rows, owners: await api.adminProfiles(rows.map((r) => r.owner_id)) };
  }, [status]);

  const act = async (b, action) => {
    const labels = { approve: "اعتماد", request_changes: "طلب تعديل", reject: "رفض", suspend: "إيقاف" };
    let note = null;
    if (action === "approve") {
      if (!(await confirm({ title: `اعتماد «${b.name}»؟`, body: "سيظهر النشاط للجميع فورًا.", okLabel: "اعتماد" }))) return;
    } else {
      note = await ask({ title: `${labels[action]} «${b.name}»`, body: "اكتب السبب ليصل لصاحب النشاط.", required: true, placeholder: "السبب…", okLabel: labels[action], danger: action !== "request_changes" });
      if (!note) return;
    }
    try { await api.adminModerateBusiness(b.id, action, note); toast("تم تنفيذ الإجراء"); st.reload(); onChange(); }
    catch (e) { toast(e.message, "bad"); }
  };

  return (
    <>
      <Chips value={status} onChange={setStatus} items={[
        { id: "pending", label: "قيد المراجعة" }, { id: "changes_requested", label: "مطلوب تعديل" }, { id: "approved", label: "معتمد" },
        { id: "rejected", label: "مرفوض" }, { id: "suspended", label: "موقوف" }, { id: "all", label: "الكل" }]} />
      <Async state={st} rows={2} empty={<Empty icon="✅" title="لا توجد أنشطة بهذه الحالة" />}>
        {({ rows, owners }) => (
          <div className="col">
            {rows.map((b) => (
              <div key={b.id} className="card col" style={{ gap: 8 }}>
                <div className="row between" style={{ alignItems: "flex-start" }}>
                  <div className="bold">{b.name}</div><StatusBadge status={b.status} />
                </div>
                <div className="muted small">{category(b.category_id)?.name} · {b.type_label} · {village(b.village_id)?.name}</div>
                {b.photos?.length > 0 && <div className="gallery">{b.photos.map((p) => <img key={p} src={api.photoUrl(p)} alt="" loading="lazy" />)}</div>}
                <p className="prose" style={{ margin: 0 }}>{b.description}</p>
                <div className="small" style={{ lineHeight: 1.9 }}>
                  <div>📞 <span className="ltr" style={{ display: "inline-block" }}>{toAr(b.phone)}</span> {b.show_phone ? "" : "(مخفي عن العامة)"}</div>
                  <div>📍 {b.address} {b.show_address ? "" : "(مخفي عن العامة)"}</div>
                  <div>🕐 {b.hours}</div>
                  <div>👤 {ownerLine(owners[b.owner_id])}</div>
                  <div className="muted">أُرسل {timeAgo(b.created_at)}</div>
                </div>
                {b.lat != null && <a className="small bold" style={{ color: "var(--deep)" }} href={directionsUrl(b, "")} target="_blank" rel="noreferrer">فتح الموقع على الخريطة</a>}
                {b.review_note && <div className="banner warn">آخر ملاحظة: {b.review_note}</div>}
                <div className="row wrap" style={{ gap: 8 }}>
                  {b.status !== "approved" && <button className="btn primary sm" onClick={() => act(b, "approve")}><Icon name="check" size={14} /> اعتماد</button>}
                  {["pending", "approved"].includes(b.status) && <button className="btn soft sm" onClick={() => act(b, "request_changes")}>طلب تعديل</button>}
                  {["pending", "changes_requested"].includes(b.status) && <button className="btn danger sm" onClick={() => act(b, "reject")}>رفض</button>}
                  {b.status === "approved" && <button className="btn danger sm" onClick={() => act(b, "suspend")}>إيقاف</button>}
                  <button className="btn ghost sm" onClick={() => go(`/b/${b.id}`)}>معاينة</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

// ───────────── مراجعة الوظائف ─────────────
function JobsPanel({ onChange }) {
  const { village, ask, confirm, toast } = useApp();
  const [status, setStatus] = useState("pending");
  const st = useAsync(async () => {
    const rows = await api.adminListJobs(status === "all" ? null : status);
    return { rows, owners: await api.adminProfiles(rows.map((r) => r.poster_id)) };
  }, [status]);
  const act = async (j, action) => {
    let note = null;
    if (action === "approve") { if (!(await confirm({ title: `اعتماد «${j.title}»؟`, okLabel: "اعتماد" }))) return; }
    else {
      note = await ask({ title: `${action === "reject" ? "رفض" : "إيقاف"} «${j.title}»`, required: true, placeholder: "السبب…", okLabel: action === "reject" ? "رفض" : "إيقاف", danger: true });
      if (!note) return;
    }
    try { await api.adminModerateJob(j.id, action, note); toast("تم تنفيذ الإجراء"); st.reload(); onChange(); } catch (e) { toast(e.message, "bad"); }
  };
  return (
    <>
      <Chips value={status} onChange={setStatus} items={[{ id: "pending", label: "قيد المراجعة" }, { id: "approved", label: "معتمد" }, { id: "rejected", label: "مرفوض" }, { id: "suspended", label: "موقوف" }, { id: "all", label: "الكل" }]} />
      <Async state={st} rows={2} empty={<Empty icon="✅" title="لا توجد وظائف بهذه الحالة" />}>
        {({ rows, owners }) => (
          <div className="col">
            {rows.map((j) => (
              <div key={j.id} className="card col" style={{ gap: 8 }}>
                <div className="row between"><div className="bold">{j.title}</div><StatusBadge status={j.status} map={JOB_STATUS} /></div>
                <div className="muted small">{j.employer_name} · {JOB_TYPES[j.job_type]} · {village(j.village_id)?.name}</div>
                <p className="prose" style={{ margin: 0 }}>{j.description}</p>
                <div className="small" style={{ lineHeight: 1.9 }}>
                  <div>📞 <span className="ltr" style={{ display: "inline-block" }}>{toAr(j.contact_phone)}</span></div>
                  <div>👤 {ownerLine(owners[j.poster_id])}</div>
                  <div className="muted">أُرسل {timeAgo(j.created_at)}</div>
                </div>
                {j.review_note && <div className="banner warn">آخر ملاحظة: {j.review_note}</div>}
                <div className="row wrap" style={{ gap: 8 }}>
                  {j.status !== "approved" && <button className="btn primary sm" onClick={() => act(j, "approve")}><Icon name="check" size={14} /> اعتماد</button>}
                  {j.status === "pending" && <button className="btn danger sm" onClick={() => act(j, "reject")}>رفض</button>}
                  {j.status === "approved" && <button className="btn danger sm" onClick={() => act(j, "suspend")}>إيقاف</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

// ───────────── البلاغات ─────────────
const TARGET = { business: "نشاط", review: "تقييم", job: "وظيفة" };
function ReportsPanel({ onChange }) {
  const { ask, confirm, toast } = useApp();
  const [status, setStatus] = useState("open");
  const st = useAsync(() => api.adminListReports(status), [status]);
  const done = () => { toast("تم تنفيذ الإجراء"); st.reload(); onChange(); };
  const handle = async (r, action) => {
    let note = null;
    if (action === "suspend") {
      note = await ask({ title: r.target_type === "review" ? "إخفاء التقييم" : "إيقاف المحتوى", body: "اكتب السبب (يصل لصاحب المحتوى).", required: true, placeholder: "السبب…", okLabel: r.target_type === "review" ? "إخفاء" : "إيقاف", danger: true });
      if (!note) return;
    } else {
      note = await ask({ title: action === "dismiss" ? "رفض البلاغ" : "إغلاق البلاغ كمحلول", body: "ملاحظة اختيارية.", placeholder: "ملاحظة…", okLabel: "تأكيد" });
      if (note === null) return;
    }
    try { await api.adminHandleReport(r.id, action, note); done(); } catch (e) { toast(e.message, "bad"); }
  };
  const ban = async (r) => {
    if (!(await confirm({ title: "حظر صاحب المحتوى؟", body: "لن يستطيع نشر أو تقييم أو مراسلة أحد بعد الحظر، ويمكنك رفعه لاحقًا.", okLabel: "حظر", danger: true }))) return;
    try { await api.adminSetBanned(r.offender, true); done(); } catch (e) { toast(e.message, "bad"); }
  };
  return (
    <>
      <Chips value={status} onChange={setStatus} items={[{ id: "open", label: "مفتوحة" }, { id: "resolved", label: "تم حلها" }, { id: "dismissed", label: "مرفوضة" }]} />
      <Async state={st} rows={2} empty={<Empty icon="🛡️" title="لا توجد بلاغات" />}>
        {(rows) => (
          <div className="col">
            {rows.map((r) => (
              <div key={r.id} className="card col" style={{ gap: 8 }}>
                <div className="row between"><span className="badge warn">{TARGET[r.target_type]}</span><span className="tiny muted">{timeAgo(r.created_at)}</span></div>
                <div className="bold">{r.label}</div>
                <div className="small"><b>السبب:</b> {REPORT_REASONS[r.reason] || r.reason}</div>
                {r.details && <div className="small muted" style={{ lineHeight: 1.7 }}>{r.details}</div>}
                {r.resolution_note && <div className="banner info">ملاحظة الإدارة: {r.resolution_note}</div>}
                {r.status === "open" && (
                  <div className="row wrap" style={{ gap: 8 }}>
                    {r.target_type === "business" && r.target && <button className="btn ghost sm" onClick={() => go(`/b/${r.target_id}`)}>معاينة</button>}
                    <button className="btn soft sm" onClick={() => handle(r, "dismiss")}>رفض البلاغ</button>
                    <button className="btn soft sm" onClick={() => handle(r, "resolve")}>تم الحل</button>
                    {r.target && <button className="btn danger sm" onClick={() => handle(r, "suspend")}>{r.target_type === "review" ? "إخفاء التقييم" : "إيقاف المحتوى"}</button>}
                    {r.offender && <button className="btn danger sm" onClick={() => ban(r)}>حظر صاحبه</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}

// ───────────── الأقسام والقرى (إدارة بلا كود) ─────────────
function EditableList({ rows, fields, onSave, addLabel, newRow, idKey }) {
  const { toast } = useApp();
  const [draft, setDraft] = useState({});
  const [adding, setAdding] = useState(null);
  const save = async (row) => {
    try { await onSave(row); toast("تم الحفظ"); setDraft({}); setAdding(null); } catch (e) { toast(e.message, "bad"); }
  };
  const field = (row, set) => fields.map((f) => (
    <div key={f.key} style={{ flex: f.flex || 1, minWidth: f.min || 90 }}>
      <div className="tiny muted">{f.label}</div>
      {f.type === "select" ? (
        <select className="input" style={{ minHeight: 38 }} value={row[f.key] ?? ""} onChange={(e) => set({ ...row, [f.key]: e.target.value })}>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      ) : (
        <input className={`input ${f.ltr ? "ltr" : ""}`} style={{ minHeight: 38 }} type={f.type || "text"} value={row[f.key] ?? ""} disabled={f.disabledWhenExisting && row.__existing}
          onChange={(e) => set({ ...row, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value })} />
      )}
    </div>
  ));
  return (
    <div className="col">
      <button className="btn soft block" onClick={() => setAdding({ ...newRow })}><Icon name="plus" size={16} /> {addLabel}</button>
      {adding && (
        <div className="card col" style={{ gap: 8 }}>
          <div className="row wrap" style={{ gap: 8 }}>{field(adding, setAdding)}</div>
          <div className="row"><button className="btn primary sm" onClick={() => save(adding)}>إضافة</button><button className="btn ghost sm" onClick={() => setAdding(null)}>إلغاء</button></div>
        </div>
      )}
      {rows.map((r) => {
        const cur = draft[r[idKey]] || { ...r, __existing: true };
        const dirty = Boolean(draft[r[idKey]]);
        return (
          <div key={r[idKey]} className="card col" style={{ gap: 8, opacity: cur.is_active ? 1 : 0.6 }}>
            <div className="row wrap" style={{ gap: 8 }}>{field(cur, (v) => setDraft((d) => ({ ...d, [r[idKey]]: v })))}</div>
            <div className="row between">
              <label className="check" style={{ alignItems: "center" }}><input type="checkbox" checked={!!cur.is_active} onChange={(e) => setDraft((d) => ({ ...d, [r[idKey]]: { ...cur, is_active: e.target.checked } }))} /> ظاهر للجميع</label>
              <button className="btn primary sm" disabled={!dirty} onClick={() => save(cur)}>حفظ</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const strip = ({ __existing, ...row }) => row;

function CategoriesPanel() {
  const { reloadPublic } = useApp();
  const st = useAsync(() => api.listCategories({ includeHidden: true }), []);
  return (
    <Async state={st} rows={2}>
      {(rows) => (
        <EditableList rows={rows} idKey="id" addLabel="إضافة قسم جديد"
          newRow={{ id: "", name: "", emoji: "📍", kind: "business", sort_order: rows.length + 1, is_active: true }}
          fields={[
            { key: "emoji", label: "أيقونة", min: 60, flex: 0.5 },
            { key: "name", label: "اسم القسم", flex: 2, min: 140 },
            { key: "id", label: "المعرّف (إنجليزي)", ltr: true, disabledWhenExisting: true, min: 110 },
            { key: "sort_order", label: "الترتيب", type: "number", min: 70, flex: 0.6 },
          ]}
          onSave={async (row) => {
            const r = strip(row);
            if (!/^[a-z0-9_-]{2,30}$/.test(r.id)) throw new Error("المعرّف: حروف إنجليزية صغيرة وأرقام وشرطات فقط (٢–٣٠).");
            if (!r.name || r.name.trim().length < 2) throw new Error("اكتب اسم القسم.");
            await api.adminSaveCategory({ ...r, name: r.name.trim() });
            await reloadPublic(); st.reload();
          }} />
      )}
    </Async>
  );
}

function VillagesPanel() {
  const { reloadPublic } = useApp();
  const st = useAsync(() => api.listVillages({ includeHidden: true }), []);
  return (
    <Async state={st} rows={2}>
      {(rows) => (
        <EditableList rows={rows} idKey="id" addLabel="إضافة قرية جديدة"
          newRow={{ name: "", region: "ميدوم", sort_order: rows.length + 1, is_active: true }}
          fields={[
            { key: "name", label: "اسم القرية", flex: 2, min: 140 },
            { key: "region", label: "المركز", type: "select", options: ["ميدوم", "الواسطى"], min: 100 },
            { key: "sort_order", label: "الترتيب", type: "number", min: 70, flex: 0.6 },
          ]}
          onSave={async (row) => {
            const r = strip(row);
            if (!r.name || r.name.trim().length < 2) throw new Error("اكتب اسم القرية.");
            await api.adminSaveVillage({ ...r, name: r.name.trim() });
            await reloadPublic(); st.reload();
          }} />
      )}
    </Async>
  );
}

export default function Admin() {
  const [tab, setTab] = useState("businesses");
  const counts = useAsync(() => api.adminCounts(), []);
  const c = counts.data || {};
  return (
    <div className="screen">
      <Header title="لوحة المشرف" backTo="/account" />
      <div className="pad">
        <Chips value={tab} onChange={setTab} items={[
          { id: "businesses", label: "الأنشطة", count: Number(c.pending_businesses) },
          { id: "jobs", label: "الوظائف", count: Number(c.pending_jobs) },
          { id: "reports", label: "البلاغات", count: Number(c.open_reports) },
          { id: "categories", label: "الأقسام" },
          { id: "villages", label: "القرى" },
        ]} />
        <div className="mt8">
          {tab === "businesses" && <BusinessesPanel onChange={counts.reload} />}
          {tab === "jobs" && <JobsPanel onChange={counts.reload} />}
          {tab === "reports" && <ReportsPanel onChange={counts.reload} />}
          {tab === "categories" && <CategoriesPanel />}
          {tab === "villages" && <VillagesPanel />}
        </div>
      </div>
    </div>
  );
}
