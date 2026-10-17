import { useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go } from "./router";
import * as api from "./api";
import { Async, Empty, ErrorBox, Header, Loading, StatusBadge, TabHeader, Tabs2, useAsync } from "./ui";
import { OrderCard } from "./Orders";
import { REQUEST_STATUS, timeAgo, toAr } from "./util";

const KIND = { service: "طلب خدمة", inquiry: "استفسار" };

function RequestCard({ r, incoming }) {
  return (
    <button className="card" style={{ width: "100%", textAlign: "right" }} onClick={() => go(`/requests/${r.id}`)}>
      <div className="row between">
        <div className="bold trunc">{incoming ? r.requester_name || "عميل" : r.business_name || "نشاط"}</div>
        <StatusBadge status={r.status} map={REQUEST_STATUS} />
      </div>
      <div className="muted small mt8" style={{ lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.message}</div>
      <div className="row between tiny muted mt8"><span>{KIND[r.kind]}{incoming ? ` · على «${r.business_name}»` : ""}</span><span>{timeAgo(r.created_at)}</span></div>
    </button>
  );
}

// «مشترياتي» + «طلبات الخدمة» التي أرسلتها + «الواردة» على أنشطتي (شراء وخدمة)
export default function Requests() {
  const { uid } = useApp();
  const [tab, setTab] = useState("orders");
  const data = useAsync(async () => {
    const [mine, orders, businesses] = await Promise.all([api.listMyRequests(uid), api.listMyOrders(uid), api.listMyBusinesses(uid)]);
    const ids = businesses.map((b) => b.id);
    const [incoming, incomingOrders] = await Promise.all([api.listIncomingRequests(ids), api.listIncomingOrders(ids)]);
    return { mine, orders, incoming, incomingOrders, hasBusinesses: businesses.length > 0 };
  }, [uid]);

  const d = data.data;
  const showIncoming = d?.hasBusinesses;
  const newIncoming = d ? d.incoming.filter((r) => r.status === "new").length + d.incomingOrders.filter((o) => o.status === "new").length : 0;
  const tabs = [{ id: "orders", label: "مشترياتي" }, { id: "mine", label: "طلبات الخدمة" }];
  if (showIncoming) tabs.push({ id: "in", label: "واردة", count: newIncoming });

  return (
    <div className="screen">
      <TabHeader title="طلباتي" subtitle="تابع مشترياتك وطلبات الخدمة والاستفسارات" />
      <div className="pad">
        {data.loading && !d ? <Loading /> : data.error ? <ErrorBox error={data.error} onRetry={data.reload} /> : (
          <>
            <div style={{ marginBottom: 14 }}><Tabs2 value={tab} onChange={setTab} tabs={tabs} /></div>
            {tab === "orders" ? (
              d.orders.length === 0 ? (
                <Empty icon="🛒" title="لا توجد مشتريات بعد" text="افتح أي نشاط واضغط «طلب شراء» على المنتج الذي يعجبك." action={<button className="btn primary" onClick={() => go("/categories")}>تصفح الأقسام</button>} />
              ) : <div className="col">{d.orders.map((o) => <OrderCard key={o.id} o={o} />)}</div>
            ) : tab === "mine" ? (
              d.mine.length === 0 ? (
                <Empty icon="🧾" title="لا توجد طلبات خدمة بعد" text="افتح أي نشاط واضغط «إرسال طلب خدمة أو استفسار»." action={<button className="btn primary" onClick={() => go("/categories")}>تصفح الأقسام</button>} />
              ) : <div className="col">{d.mine.map((r) => <RequestCard key={r.id} r={r} />)}</div>
            ) : (d.incomingOrders.length === 0 && d.incoming.length === 0) ? (
              <Empty icon="📭" title="لا توجد طلبات واردة" text="ستظهر هنا طلبات الشراء والخدمة التي يرسلها العملاء لأنشطتك." />
            ) : (
              <div className="col">
                {d.incomingOrders.length > 0 && <div className="bold">طلبات الشراء</div>}
                {d.incomingOrders.map((o) => <OrderCard key={o.id} o={o} incoming />)}
                {d.incoming.length > 0 && <div className="bold mt8">طلبات الخدمة والاستفسارات</div>}
                {d.incoming.map((r) => <RequestCard key={r.id} r={r} incoming />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const FLOW = ["new", "accepted", "in_progress", "completed"];

// الانتقالات المسموحة (مفروضة أيضًا في قاعدة البيانات)
const OWNER_ACTIONS = {
  new: [["accepted", "قبول الطلب", "primary"], ["declined", "اعتذار", "danger"]],
  accepted: [["in_progress", "بدء التنفيذ", "primary"], ["completed", "تم الإكمال", "soft"]],
  in_progress: [["completed", "تم الإكمال", "primary"]],
};

export function RequestDetail({ id }) {
  const { uid, toast, confirm } = useApp();
  const st = useAsync(() => api.getRequest(id), [id]);
  const [busy, setBusy] = useState(false);

  if (st.loading && !st.data) return <div className="screen"><Header title="تفاصيل الطلب" backTo="/requests" /><Loading /></div>;
  if (st.error) return <div className="screen"><Header title="تفاصيل الطلب" backTo="/requests" /><ErrorBox error={st.error} onRetry={st.reload} /></div>;
  const r = st.data;
  if (!r) return <div className="screen"><Header title="تفاصيل الطلب" backTo="/requests" /><Empty icon="🔎" title="لم نجد هذا الطلب" /></div>;

  const mine = r.user_id === uid;
  const actions = mine
    ? (["new", "accepted"].includes(r.status) ? [["cancelled", "إلغاء الطلب", "danger"]] : [])
    : (OWNER_ACTIONS[r.status] || []);
  const idx = FLOW.indexOf(r.status);
  const ended = r.status === "declined" || r.status === "cancelled";

  const act = async ([status, label]) => {
    const ok = await confirm({ title: `${label}؟`, okLabel: label, danger: status === "declined" || status === "cancelled" });
    if (!ok) return;
    setBusy(true);
    try { await api.updateRequestStatus(id, status); toast("تم تحديث حالة الطلب"); st.reload(); }
    catch (e) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  const chat = async () => {
    try { go(`/chat/${await api.startConversation(r.business_id)}`); } catch (e) { toast(e.message, "bad"); }
  };

  return (
    <div className="screen">
      <Header title="تفاصيل الطلب" backTo="/requests" />
      <div className="pad col">
        <div className="card col" style={{ gap: 8 }}>
          <div className="row between">
            <div className="bold">{KIND[r.kind]}</div>
            <StatusBadge status={r.status} map={REQUEST_STATUS} />
          </div>
          <div className="muted small">{mine ? `إلى «${r.business_name}»` : `من ${r.requester_name || "عميل"} على «${r.business_name}»`} · {timeAgo(r.created_at)}</div>
          <p className="prose" style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{r.message}</p>
          {!mine && r.contact_phone && (
            <a className="btn soft" href={`tel:${r.contact_phone}`}><Icon name="phone" size={18} /> اتصل بالعميل — <span className="ltr">{toAr(r.contact_phone)}</span></a>
          )}
          {!mine && !r.contact_phone && <div className="small muted">لم يشارك العميل رقمه. تواصل معه عبر المحادثة.</div>}
        </div>

        <div className="card">
          <div className="h2" style={{ marginBottom: 10 }}>حالة الطلب</div>
          {ended ? (
            <div className={`banner ${r.status === "declined" ? "bad" : "warn"}`}>{r.status === "declined" ? "اعتذر صاحب النشاط عن هذا الطلب." : "تم إلغاء هذا الطلب."}</div>
          ) : FLOW.map((s, i) => (
            <div key={s} className="row" style={{ alignItems: "flex-start", gap: 12 }}>
              <div className="col" style={{ alignItems: "center", gap: 0 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: i <= idx ? "var(--orange)" : "var(--line)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{i <= idx && <Icon name="check" size={14} />}</div>
                {i < FLOW.length - 1 && <div style={{ width: 2, height: 22, background: i < idx ? "var(--orange)" : "var(--line)" }} />}
              </div>
              <div style={{ fontWeight: i <= idx ? 800 : 600, color: i <= idx ? "var(--ink)" : "var(--mute)", paddingTop: 2 }}>{REQUEST_STATUS[s].label}</div>
            </div>
          ))}
        </div>

        <div className="col">
          {actions.map((a) => <button key={a[0]} className={`btn ${a[2]} block`} disabled={busy} onClick={() => act(a)}>{a[1]}</button>)}
          {mine && <button className="btn soft block" onClick={chat}><Icon name="chat" size={18} /> محادثة مع النشاط</button>}
          <button className="btn ghost block" onClick={() => go(`/b/${r.business_id}`)}>عرض النشاط</button>
        </div>
      </div>
    </div>
  );
}
