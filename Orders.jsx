import { useRef, useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go } from "./router";
import * as api from "./api";
import { Async, Empty, ErrorBox, Field, Header, Loading, Sheet, StatusBadge, Tabs2, useAsync } from "./ui";
import { ORDER_STATUS, PAYMENT_LABELS, WALLET_METHODS, fmtMoney, processImage, timeAgo, toAr } from "./util";

function OrderCard({ o, incoming }) {
  return (
    <button className="card" style={{ width: "100%", textAlign: "right" }} onClick={() => go(`/orders/${o.id}`)}>
      <div className="row between">
        <div className="bold trunc">{o.product_name} × {toAr(o.quantity)}</div>
        <StatusBadge status={o.status} map={ORDER_STATUS} />
      </div>
      <div className="muted small mt8">{incoming ? `من ${o.customer_name}` : `من «${o.business_name}»`} · {fmtMoney(o.total)}</div>
      <div className="row between tiny muted mt8"><span>{PAYMENT_LABELS[o.payment_method]}</span><span>{timeAgo(o.created_at)}</span></div>
    </button>
  );
}

// «مشترياتي» + «الواردة» على أنشطتي
export default function Orders() {
  const { uid } = useApp();
  const [tab, setTab] = useState("mine");
  const data = useAsync(async () => {
    const [mine, businesses] = await Promise.all([api.listMyOrders(uid), api.listMyBusinesses(uid)]);
    const incoming = await api.listIncomingOrders(businesses.map((b) => b.id));
    return { mine, incoming, hasBusinesses: businesses.length > 0 };
  }, [uid]);
  const d = data.data;
  const newIncoming = d ? d.incoming.filter((o) => o.status === "new").length : 0;
  return (
    <div className="screen">
      <Header title="طلبات الشراء" backTo="/account" />
      <div className="pad col">
        {d?.hasBusinesses && <Tabs2 value={tab} onChange={setTab} tabs={[{ id: "mine", label: "مشترياتي" }, { id: "in", label: "واردة على أنشطتي", count: newIncoming }]} />}
        <Async state={data} rows={3}>
          {() => {
            const list = tab === "in" && d.hasBusinesses ? d.incoming : d.mine;
            if (!list.length) return <Empty icon="🛒" title={tab === "in" ? "لا توجد طلبات واردة" : "لم تشترِ شيئًا بعد"} text={tab === "in" ? "ستظهر هنا طلبات الشراء على منتجاتك." : "تصفح الأنشطة واطلب من منتجاتها."} />;
            return list.map((o) => <OrderCard key={o.id} o={o} incoming={tab === "in" && d.hasBusinesses} />);
          }}
        </Async>
      </div>
    </div>
  );
}

function RejectSheet({ onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  return (
    <Sheet title="سبب الرفض" onClose={onClose}>
      <div className="col">
        <Field label="اكتب السبب (٣ أحرف على الأقل)"><input className="input" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <button className="btn danger block" disabled={reason.trim().length < 3} onClick={() => onSubmit(reason.trim())}>تأكيد الرفض</button>
      </div>
    </Sheet>
  );
}

export function OrderDetail({ id }) {
  const { uid, toast, confirm } = useApp();
  const st = useAsync(() => api.getOrder(id), [id]);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rcpt, setRcpt] = useState(null);
  const fileRef = useRef(null);

  const hdr = <Header title="تفاصيل الطلب" backTo="/orders" />;
  if (st.loading && !st.data) return <div className="screen">{hdr}<Loading /></div>;
  if (st.error) return <div className="screen">{hdr}<ErrorBox error={st.error} onRetry={st.reload} /></div>;
  const o = st.data;
  if (!o) return <div className="screen">{hdr}<Empty icon="🔎" title="لم نجد هذا الطلب" /></div>;

  const mine = o.user_id === uid;
  const wallet = WALLET_METHODS.includes(o.payment_method);
  const act = async (status, extra) => {
    setBusy(true);
    try { await api.updateOrderStatus(id, status, extra); toast("تم تحديث حالة الطلب"); setRejecting(false); st.reload(); }
    catch (e) { toast(e.message, "bad"); } finally { setBusy(false); }
  };
  const confirmAct = async (status, label, danger) => { if (await confirm({ title: `${label}؟`, okLabel: label, danger })) act(status); };
  const upload = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy(true);
    try { const path = await api.uploadReceipt(uid, await processImage(f)); await api.attachReceipt(id, path); toast("تم رفع الإيصال"); st.reload(); }
    catch (er) { toast(er.message, "bad"); } finally { setBusy(false); }
  };
  const viewReceipt = async () => { try { setRcpt(await api.receiptUrl(o.receipt_path)); } catch (e) { toast(e.message, "bad"); } };

  const ownerActions = { new: [["accepted", "قبول الطلب"], ["reject", "رفض", "danger"]], accepted: [["shipped", "خرج للتوصيل"], ["delivered", "تم التسليم"]], shipped: [["delivered", "تم التسليم"]] }[o.status] || [];
  const canUpload = mine && wallet && ["new", "accepted"].includes(o.status);

  return (
    <div className="screen">
      {hdr}
      <div className="pad col">
        <div className="card col">
          <div className="row between"><div className="h2">{o.product_name}</div><StatusBadge status={o.status} map={ORDER_STATUS} /></div>
          <div className="muted small">«{o.business_name}» · {timeAgo(o.created_at)}</div>
          <div>الكمية: <b>{toAr(o.quantity)}</b> × {fmtMoney(o.unit_price)}</div>
          <div className="bold">الإجمالي: {fmtMoney(o.total)}</div>
          <div>الدفع: {PAYMENT_LABELS[o.payment_method]}</div>
          {o.status === "rejected" && o.reject_reason && <div className="banner bad">سبب الرفض: {o.reject_reason}</div>}
        </div>
        <div className="card col">
          <div className="h2">بيانات التوصيل</div>
          <div>{o.customer_name}</div>
          <div className="ltr" style={{ textAlign: "right" }}>{toAr(o.customer_phone)}</div>
          <div>{o.address}</div>
          {o.note && <div className="muted small">ملاحظة: {o.note}</div>}
          {!mine && <a className="btn soft sm" href={`tel:${o.customer_phone}`}><Icon name="phone" size={14} /> اتصال بالعميل</a>}
        </div>
        {wallet && (
          <div className="card col">
            <div className="h2">الإيصال</div>
            {o.receipt_path ? <button className="btn soft sm" onClick={viewReceipt}>عرض صورة الإيصال</button> : <div className="muted small">{mine ? "لم ترفع إيصالًا بعد." : "لم يرفع العميل إيصالًا بعد."}</div>}
            {canUpload && <><button className="btn soft sm" disabled={busy} onClick={() => fileRef.current?.click()}>{o.receipt_path ? "استبدال الإيصال" : "رفع الإيصال"}</button><input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} /></>}
          </div>
        )}
        <div className="col">
          {mine && o.status === "new" && <button className="btn danger block" disabled={busy} onClick={() => confirmAct("cancelled", "إلغاء الطلب", true)}>إلغاء الطلب</button>}
          {!mine && ownerActions.map(([s, label, tone]) => (
            <button key={s} className={`btn ${tone === "danger" ? "danger" : "primary"} block`} disabled={busy} onClick={() => (s === "reject" ? setRejecting(true) : confirmAct(s, label))}>{label}</button>
          ))}
          <button className="btn soft block" onClick={() => go(`/b/${o.business_id}`)}>صفحة النشاط</button>
        </div>
      </div>
      {rejecting && <RejectSheet onClose={() => setRejecting(false)} onSubmit={(r) => act("rejected", r)} />}
      {rcpt && <Sheet title="الإيصال" onClose={() => setRcpt(null)}><img src={rcpt} alt="إيصال الدفع" style={{ width: "100%", borderRadius: 12 }} /></Sheet>}
    </div>
  );
}
