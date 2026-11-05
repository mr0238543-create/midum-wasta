import { useApp } from "../app";
import { go } from "../router";
import * as api from "../api";
import Icon from "../icons";
import { Async, BusinessCard, Empty, Header, TabHeader, useAsync } from "../ui";
import { CategoryGrid, AddBanner } from "./Home";
import { areaLabel, useArea } from "../area";
import { timeAgo } from "../util";

export function Categories() {
  const { villages } = useApp();
  const area = useArea();
  return (
    <div className="screen">
      <TabHeader title="الأقسام" subtitle={`المنطقة: ${areaLabel(area, villages)}`} />
      <div className="pad">
        <CategoryGrid />
        <AddBanner />
      </div>
    </div>
  );
}

export function Favorites() {
  const { favIds } = useApp();
  const st = useAsync(() => api.listFavorites(), [favIds.size]);
  return (
    <div className="screen">
      <Header title="المفضلة" backTo="/account" />
      <div className="pad">
        <Async state={st} rows={2} empty={<Empty icon="❤️" title="لا توجد أنشطة في المفضلة" text="اضغط على القلب في صفحة أي نشاط لحفظه هنا." action={<button className="btn primary" onClick={() => go("/categories")}>تصفح الأقسام</button>} />}>
          {(rows) => <div className="col">{rows.map((b) => <BusinessCard key={b.id} b={b} />)}</div>}
        </Async>
      </div>
    </div>
  );
}

const KIND_ICON = {
  business_approved: "✅", business_rejected: "⛔", business_changes: "✏️", business_suspended: "🚫",
  request_new: "🧾", request_update: "🔔", request_cancelled: "↩️", message: "💬",
  job_approved: "✅", job_rejected: "⛔", job_suspended: "🚫",
};

export function Notifications() {
  const { refreshUnread, setUnread } = useApp();
  const st = useAsync(() => api.listNotifications(), []);
  const open = async (n) => {
    if (!n.is_read) { await api.markNotificationRead(n.id).catch(() => {}); refreshUnread(); }
    if (n.link) go(n.link);
  };
  const readAll = async () => { await api.markAllNotificationsRead(); setUnread(0); st.reload(); };
  const hasUnread = st.data?.some((n) => !n.is_read);
  return (
    <div className="screen">
      <Header title="الإشعارات" backTo="/" right={hasUnread && <button className="pill" onClick={readAll}><Icon name="check" size={14} /> قراءة الكل</button>} />
      <div className="pad">
        <Async state={st} rows={3} empty={<Empty icon="🔔" title="لا توجد إشعارات" text="ستصلك هنا تحديثات أنشطتك وطلباتك ورسائلك." />}>
          {(rows) => (
            <div className="col">
              {rows.map((n) => (
                <button key={n.id} className="biz" onClick={() => open(n)} style={{ alignItems: "flex-start", background: n.is_read ? "#fff" : "var(--peach)" }}>
                  <div style={{ fontSize: 24 }}>{KIND_ICON[n.kind] || "🔔"}</div>
                  <div className="grow">
                    <div className="bold" style={{ fontSize: 14 }}>{n.title}</div>
                    {n.body && <div className="muted small" style={{ lineHeight: 1.7 }}>{n.body}</div>}
                    <div className="tiny muted mt8">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--orange)", marginTop: 6 }} aria-label="غير مقروء" />}
                </button>
              ))}
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}
