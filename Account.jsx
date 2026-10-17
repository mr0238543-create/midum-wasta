import { useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go } from "./router";
import * as api from "./api";
import { Field, Sheet, TabHeader } from "./ui";
import { areaLabel, useArea } from "./area";
import { AreaSheet } from "./shared";
import { toAr } from "./util";

const ROLE = { user: "مستخدم", owner: "صاحب نشاط", admin: "مشرف" };

function Item({ icon, label, onClick, badge, danger }) {
  return (
    <button className="row" onClick={onClick} style={{ width: "100%", padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
      <div className="info-row"><div className="ico" style={danger ? { background: "var(--red-bg)", color: "var(--red)" } : null}><Icon name={icon} size={17} /></div></div>
      <span className="grow bold" style={{ fontSize: 14, color: danger ? "var(--red)" : "inherit" }}>{label}</span>
      {badge != null && <span className="small muted">{badge}</span>}
      <Icon name="chevL" size={17} style={{ color: "var(--mute)" }} />
    </button>
  );
}

function EditProfile({ onClose }) {
  const { uid, profile, villages, refreshProfile, toast } = useApp();
  const [name, setName] = useState(profile?.full_name || "");
  const [villageId, setVillageId] = useState(profile?.village_id ? String(profile.village_id) : "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (name.trim().length < 2) { setErr("اكتب اسمك (حرفان على الأقل)."); return; }
    setBusy(true);
    try {
      await api.updateMyProfile(uid, { full_name: name.trim(), village_id: villageId ? Number(villageId) : null });
      await refreshProfile(); toast("تم حفظ بياناتك"); onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Sheet title="تعديل بياناتي" onClose={onClose}>
      <div className="col">
        <Field label="الاسم" error={err}><input className="input" value={name} maxLength={80} onChange={(e) => { setName(e.target.value); setErr(""); }} autoFocus /></Field>
        <Field label="قريتي">
          <select className="input" value={villageId} onChange={(e) => setVillageId(e.target.value)}>
            <option value="">بدون تحديد</option>
            {villages.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <div className="small muted">رقم الموبايل ثابت ومرتبط بحسابك، ولا يمكن تغييره من هنا.</div>
        <button className="btn primary block" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      </div>
    </Sheet>
  );
}

export default function Account() {
  const { session, uid, profile, villages, favIds, isAdmin, logout, confirm, toast } = useApp();
  const area = useArea();
  const [areaOpen, setAreaOpen] = useState(false);
  const [edit, setEdit] = useState(false);

  const del = async () => {
    const ok = await confirm({
      title: "حذف حسابك نهائيًا؟",
      body: "سيُحذف حسابك وأنشطتك وتقييماتك وطلباتك ومحادثاتك وصورك ولا يمكن استرجاعها. هذا الإجراء نهائي.",
      okLabel: "حذف حسابي", danger: true,
    });
    if (!ok) return;
    try { await api.deleteMyAccount(uid); toast("تم حذف حسابك"); go("/", { replace: true }); }
    catch (e) { toast(e.message, "bad"); }
  };

  return (
    <div className="screen">
      <div className="hdr big" style={{ paddingBottom: 28, textAlign: "center" }}>
        <div className="blob" style={{ width: 150, height: 150, left: -40, top: -40 }} />
        <div style={{ position: "relative" }}>
          <div style={{ width: 76, height: 76, margin: "0 auto", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🙂</div>
          {session ? (
            <>
              <h1 style={{ fontSize: 20, marginTop: 10 }}>{profile?.full_name || "مستخدم"}</h1>
              <div style={{ fontSize: 13, opacity: 0.92 }}><span className="ltr" style={{ display: "inline-block" }}>{session?.user?.email || ""}</span> · {ROLE[profile?.role] || ""}</div>
            </>
          ) : <h1 style={{ fontSize: 20, marginTop: 10 }}>مرحبًا بك</h1>}
        </div>
      </div>

      <div className="pad">
        {!session ? (
          <div className="card col">
            <div className="bold">سجّل الدخول لتستفيد من كل المزايا</div>
            <div className="muted small" style={{ lineHeight: 1.8 }}>التقييم، المفضلة، المحادثات، الطلبات، وإضافة نشاطك.</div>
            <button className="btn primary block" onClick={() => go("/login?next=/account")}>تسجيل الدخول بالبريدالإلكتروني</button>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <Item icon="edit" label="تعديل بياناتي" onClick={() => setEdit(true)} />
            <Item icon="store" label="أنشطتي" onClick={() => go("/my")} />
            <Item icon="plus" label="أضف نشاطك" onClick={() => go("/add")} />
            <Item icon="briefcase" label="وظائفي" onClick={() => go("/jobs/mine")} />
            <Item icon="heart" label="المفضلة" badge={toAr(favIds.size)} onClick={() => go("/favorites")} />
            <Item icon="bell" label="الإشعارات" onClick={() => go("/notifications")} />
            {isAdmin && <Item icon="shield" label="لوحة المشرف" onClick={() => go("/admin")} />}
          </div>
        )}

        <div className="card mt16" style={{ padding: 0, overflow: "hidden" }}>
          <Item icon="pin" label="منطقتي" badge={areaLabel(area, villages)} onClick={() => setAreaOpen(true)} />
          <Item icon="lock" label="سياسة الخصوصية" onClick={() => go("/privacy")} />
          <Item icon="info" label="الشروط والأحكام" onClick={() => go("/terms")} />
        </div>

        {session && (
          <div className="card mt16" style={{ padding: 0, overflow: "hidden" }}>
            <Item icon="logout" label="تسجيل الخروج" onClick={async () => { if (await confirm({ title: "تسجيل الخروج؟", okLabel: "خروج" })) logout(); }} />
            <Item icon="trash" label="حذف حسابي" danger onClick={del} />
          </div>
        )}
        <p className="tiny muted center mt24">ميدوم والواسطي</p>
      </div>
      {areaOpen && <AreaSheet onClose={() => setAreaOpen(false)} />}
      {edit && <EditProfile onClose={() => setEdit(false)} />}
    </div>
  );
}
