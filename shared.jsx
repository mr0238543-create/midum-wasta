import { useState } from "react";
import Icon from "./icons";
import { Sheet, Field } from "./ui";
import { useApp } from "./app";
import * as api from "./api";
import { REPORT_REASONS } from "./util";
import { setArea, useArea } from "./area";

export function AreaSheet({ onClose }) {
  const { villages } = useApp();
  const area = useArea();
  const regions = [...new Set(villages.map((v) => v.region))];
  const pick = (a) => { setArea(a); onClose(); };
  const Opt = ({ label, active, onClick, sub }) => (
    <button className="row between" onClick={onClick}
      style={{ width: "100%", padding: sub ? "10px 28px 10px 16px" : "12px 16px", borderRadius: 16, background: active ? "var(--peach)" : "transparent", fontWeight: sub ? 600 : 800 }}>
      {label}{active && <Icon name="check" size={18} style={{ color: "var(--orange)" }} />}
    </button>
  );
  return (
    <Sheet title="اختر المنطقة" onClose={onClose}>
      <Opt label="كل المناطق" active={area.region === "all" && !area.village} onClick={() => pick({ region: "all", village: null })} />
      {regions.map((r) => (
        <div key={r}>
          <Opt label={`مركز ${r}`} active={area.region === r && !area.village} onClick={() => pick({ region: r, village: null })} />
          {villages.filter((v) => v.region === r).map((v) => (
            <Opt key={v.id} sub label={v.name} active={area.village === v.id} onClick={() => pick({ region: r, village: v.id })} />
          ))}
        </div>
      ))}
    </Sheet>
  );
}

export function ReportSheet({ target, onClose }) {
  const { requireLogin, toast, confirm } = useApp();
  const [reason, setReason] = useState("wrong_info");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!requireLogin()) return;
    const ok = await confirm({ title: "إرسال البلاغ؟", body: "سيراجع المشرفون البلاغ. تكرار البلاغات الكاذبة قد يعرّض حسابك للإيقاف.", okLabel: "إرسال البلاغ" });
    if (!ok) return;
    setBusy(true);
    try {
      await api.reportTarget({ type: target.type, id: target.id, reason, details });
      toast("شكرًا، وصلنا بلاغك وسنراجعه.");
      onClose();
    } catch (e) {
      toast(e.code === "23505" ? "سبق أن أبلغت عن هذا المحتوى." : e.message, "bad");
    } finally { setBusy(false); }
  };
  return (
    <Sheet title={`الإبلاغ عن ${target.label || "المحتوى"}`} onClose={onClose}>
      <div className="col">
        {Object.entries(REPORT_REASONS).map(([k, v]) => (
          <label key={k} className="check">
            <input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} /> {v}
          </label>
        ))}
        <Field label="تفاصيل (اختياري)">
          <textarea className="input" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="اشرح المشكلة باختصار" />
        </Field>
        <button className="btn primary block" disabled={busy} onClick={submit}>{busy ? "جارٍ الإرسال…" : "إرسال البلاغ"}</button>
      </div>
    </Sheet>
  );
}
