import { useState } from "react";
import Icon from "../icons";
import { useApp } from "../app";
import { go } from "../router";
import * as api from "../api";
import { Async, Empty, ErrorBox, Field, Header, Loading, StatusBadge, useAsync } from "../ui";
import { areaLabel, useArea } from "../area";
import { AreaSheet, ReportSheet } from "./shared";
import { JOB_STATUS, JOB_TYPES, isValidPhone, normalizePhone, timeAgo, toAr } from "../util";

export default function Jobs() {
  const { villages, village, requireLogin } = useApp();
  const area = useArea();
  const [areaOpen, setAreaOpen] = useState(false);
  const [report, setReport] = useState(null);
  const st = useAsync(() => api.listJobs(), []);
  const inArea = (j) => (area.village ? j.village_id === area.village : area.region === "all" || village(j.village_id)?.region === area.region);

  return (
    <div className="screen">
      <Header title="💼 الوظائف" backTo="/categories"
        right={<button className="pill" onClick={() => setAreaOpen(true)}><Icon name="pin" size={14} />{areaLabel(area, villages)}</button>} />
      <div className="pad">
        <button className="btn primary block" onClick={() => { if (requireLogin("/jobs/new")) go("/jobs/new"); }}><Icon name="plus" size={18} /> انشر فرصة عمل</button>
        <div className="mt16">
          <Async state={st} rows={3}
            empty={<Empty icon="💼" title="لا توجد وظائف معروضة الآن" text="تظهر الوظائف هنا بعد مراجعتها." />}>
            {(rows) => {
              const list = rows.filter(inArea);
              if (!list.length) return <Empty icon="💼" title="لا توجد وظائف في هذه المنطقة" text="جرّب تغيير المنطقة." action={<button className="btn soft" onClick={() => setAreaOpen(true)}>تغيير المنطقة</button>} />;
              return (
                <div className="col">
                  {list.map((j) => (
                    <div key={j.id} className="card col" style={{ gap: 8 }}>
                      <div className="row between" style={{ alignItems: "flex-start" }}>
                        <div><div className="bold" style={{ fontSize: 15 }}>{j.title}</div><div className="muted small">{j.employer_name}</div></div>
                        <span className="badge brand">{JOB_TYPES[j.job_type]}</span>
                      </div>
                      <div className="row small muted" style={{ gap: 12 }}><span className="row" style={{ gap: 3 }}><Icon name="pin" size={12} />{village(j.village_id)?.name}</span><span>{timeAgo(j.created_at)}</span></div>
                      <p className="prose" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{j.description}</p>
                      <div className="row" style={{ gap: 8 }}>
                        <a className="btn primary sm grow" href={`tel:${j.contact_phone}`}><Icon name="phone" size={16} /> اتصال للتقديم</a>
                        <button className="btn ghost sm" aria-label="الإبلاغ عن هذا الإعلان" onClick={() => { if (requireLogin("/jobs")) setReport({ type: "job", id: j.id, label: "هذا الإعلان" }); }}><Icon name="flag" size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            }}
          </Async>
        </div>
      </div>
      {areaOpen && <AreaSheet onClose={() => setAreaOpen(false)} />}
      {report && <ReportSheet target={report} onClose={() => setReport(null)} />}
    </div>
  );
}

function JobFormInner({ initial, id }) {
  const { villages, toast } = useApp();
  const isNew = !id;
  const [f, setF] = useState({
    title: initial?.title || "", employer_name: initial?.employer_name || "", description: initial?.description || "",
    village_id: initial ? String(initial.village_id) : "", job_type: initial?.job_type || "full", contact_phone: initial?.contact_phone || "",
  });
  const [agree, setAgree] = useState(!isNew);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.title.trim().length < 3) er.title = "عنوان الوظيفة ٣ أحرف على الأقل.";
    if (f.employer_name.trim().length < 2) er.employer_name = "اكتب اسم جهة العمل.";
    if (!f.village_id) er.village_id = "اختر القرية.";
    if (!isValidPhone(normalizePhone(f.contact_phone))) er.contact_phone = "اكتب رقم تواصل صحيحًا.";
    if (f.description.trim().length < 10) er.description = "اكتب وصفًا للوظيفة (١٠ أحرف على الأقل).";
    if (!agree) er.agree = "وافق على إظهار رقم التواصل للعامة.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    const fields = { title: f.title.trim(), employer_name: f.employer_name.trim(), description: f.description.trim(), village_id: Number(f.village_id), job_type: f.job_type, contact_phone: normalizePhone(f.contact_phone) };
    try {
      if (isNew) { await api.createJob(fields); toast("تم إرسال الإعلان للمراجعة."); }
      else {
        const resubmit = initial.status === "rejected";
        const row = await api.updateJob(id, resubmit ? { ...fields, status: "pending" } : fields);
        toast(row.status === "pending" ? "تم الحفظ، وسيُراجَع الإعلان قبل ظهوره." : "تم حفظ التعديلات.");
      }
      go("/jobs/mine", { replace: true });
    } catch (err) { toast(err.message, "bad"); } finally { setBusy(false); }
  };

  return (
    <div className="screen fixed">
      <Header title={isNew ? "انشر فرصة عمل" : "تعديل الإعلان"} backTo="/jobs/mine" />
      <form onSubmit={submit} noValidate style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div className="pad col" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <div className="banner info">يظهر الإعلان للجميع بعد مراجعة المشرف، ويبقى ظاهرًا ٣٠ يومًا.</div>
          {initial?.review_note && <div className="banner warn">ملاحظة المشرف: {initial.review_note}</div>}
          <Field label="عنوان الوظيفة" error={errors.title}><input className={`input ${errors.title ? "bad" : ""}`} value={f.title} maxLength={80} onChange={set("title")} placeholder="مثال: محاسب" /></Field>
          <Field label="جهة العمل" error={errors.employer_name}><input className={`input ${errors.employer_name ? "bad" : ""}`} value={f.employer_name} maxLength={80} onChange={set("employer_name")} placeholder="اسم الشركة أو المحل" /></Field>
          <Field label="نوع الدوام">
            <select className="input" value={f.job_type} onChange={set("job_type")}>{Object.entries(JOB_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="القرية" error={errors.village_id}>
            <select className={`input ${errors.village_id ? "bad" : ""}`} value={f.village_id} onChange={set("village_id")}><option value="">اختر القرية</option>{villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          </Field>
          <Field label="رقم التواصل" error={errors.contact_phone}><input className={`input ltr ${errors.contact_phone ? "bad" : ""}`} inputMode="tel" value={f.contact_phone} onChange={set("contact_phone")} placeholder="01012345678" /></Field>
          <Field label="تفاصيل الوظيفة" error={errors.description}><textarea className={`input ${errors.description ? "bad" : ""}`} rows={5} maxLength={1000} value={f.description} onChange={set("description")} placeholder="المهام، الشروط، المرتب إن أحببت" /></Field>
          <Field error={errors.agree}>
            <label className="check"><input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErrors((x) => ({ ...x, agree: undefined })); }} /> أوافق على إظهار رقم التواصل للعامة ليتقدّم المهتمون.</label>
          </Field>
        </div>
        <div className="actionbar"><button className="btn primary" disabled={busy}>{busy ? "جارٍ الحفظ…" : isNew ? "إرسال للمراجعة" : "حفظ"}</button></div>
      </form>
    </div>
  );
}

export function JobForm({ id }) {
  const { uid } = useApp();
  const st = useAsync(async () => (id ? (await api.listMyJobs(uid)).find((j) => j.id === id) || null : null), [id, uid]);
  if (id) {
    if (st.loading && !st.data) return <div className="screen"><Header title="تعديل الإعلان" backTo="/jobs/mine" /><Loading /></div>;
    if (st.error) return <div className="screen"><Header title="تعديل الإعلان" backTo="/jobs/mine" /><ErrorBox error={st.error} onRetry={st.reload} /></div>;
    if (!st.data) return <div className="screen"><Header title="تعديل الإعلان" backTo="/jobs/mine" /><Empty icon="🔎" title="لم نجد هذا الإعلان" /></div>;
  }
  return <JobFormInner key={id || "new"} id={id} initial={st.data} />;
}

export function MyJobs() {
  const { uid, village, toast, confirm } = useApp();
  const st = useAsync(() => api.listMyJobs(uid), [uid]);
  const remove = async (j) => {
    if (!(await confirm({ title: `حذف «${j.title}»؟`, okLabel: "حذف", danger: true }))) return;
    try { await api.deleteJob(j.id); toast("تم حذف الإعلان"); st.reload(); } catch (e) { toast(e.message, "bad"); }
  };
  return (
    <div className="screen">
      <Header title="وظائفي" backTo="/account" right={<button className="round-btn" aria-label="إعلان جديد" onClick={() => go("/jobs/new")}><Icon name="plus" /></button>} />
      <div className="pad">
        <Async state={st} rows={2} empty={<Empty icon="💼" title="لم تنشر أي وظيفة بعد" action={<button className="btn primary" onClick={() => go("/jobs/new")}>انشر فرصة عمل</button>} />}>
          {(rows) => (
            <div className="col">
              {rows.map((j) => (
                <div key={j.id} className="card col" style={{ gap: 8 }}>
                  <div className="row between"><div className="bold trunc">{j.title}</div><StatusBadge status={j.status} map={JOB_STATUS} /></div>
                  <div className="muted small">{j.employer_name} · {village(j.village_id)?.name} · {timeAgo(j.created_at)}</div>
                  {j.status === "approved" && <div className="tiny muted">ينتهي الإعلان {new Date(j.expires_at).toLocaleDateString("ar-EG")}</div>}
                  {j.review_note && <div className="banner warn">ملاحظة المشرف: {j.review_note}</div>}
                  <div className="row" style={{ gap: 8 }}>
                    <button className="btn soft sm" onClick={() => go(`/jobs/edit/${j.id}`)}><Icon name="edit" size={14} /> {j.status === "rejected" ? "تعديل وإعادة إرسال" : "تعديل"}</button>
                    <button className="btn danger sm" onClick={() => remove(j)}><Icon name="trash" size={14} /> حذف</button>
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
