import { Component, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { isConfigured } from "./supabase";
import { AppProvider, useApp } from "./app";
import { matchRoute, useHash, go } from "./router";
import * as api from "./api";
import Icon from "./icons";
import { ErrorBox, Loading, RequireAdmin, RequireAuth } from "./ui";
import { Setup } from "./screens/Setup";
import Home from "./screens/Home";
import Search from "./screens/Search";
import Login from "./screens/Login";
import Business from "./screens/Business";
import { BusinessForm, MyBusinesses } from "./screens/BusinessForm";
import Requests, { RequestDetail } from "./screens/Requests";
import Chats, { Chat } from "./screens/Chats";
import { Categories, Favorites, Notifications } from "./screens/Lists";
import Account from "./screens/Account";
import Jobs, { JobForm, MyJobs } from "./screens/Jobs";
import Admin from "./screens/Admin";
import { Privacy, Terms } from "./screens/Legal";

// auth: يتطلب تسجيل الدخول — admin: للمشرفين — tab: التبويب المفعّل — bare: بلا شريط سفلي
const ROUTES = [
  ["/", { C: Home, tab: "/" }],
  ["/categories", { C: Categories, tab: "/categories" }],
  ["/search", { C: Search, tab: "/categories" }],
  ["/b/:id", { C: Business, tab: "/categories" }],
  ["/login", { C: Login, bare: true }],
  ["/add", { C: BusinessForm, auth: true, tab: "/account" }],
  ["/my", { C: MyBusinesses, auth: true, tab: "/account" }],
  ["/my/:id", { C: BusinessForm, auth: true, tab: "/account" }],
  ["/favorites", { C: Favorites, auth: true, tab: "/account" }],
  ["/requests", { C: Requests, auth: true, tab: "/requests" }],
  ["/requests/:id", { C: RequestDetail, auth: true, tab: "/requests" }],
  ["/chats", { C: Chats, auth: true, tab: "/chats" }],
  ["/chat/:id", { C: Chat, auth: true, bare: true }],
  ["/notifications", { C: Notifications, auth: true, tab: "/" }],
  ["/account", { C: Account, tab: "/account" }],
  ["/jobs", { C: Jobs, tab: "/categories" }],
  ["/jobs/new", { C: JobForm, auth: true, tab: "/account" }],
  ["/jobs/edit/:id", { C: JobForm, auth: true, tab: "/account" }],
  ["/jobs/mine", { C: MyJobs, auth: true, tab: "/account" }],
  ["/admin", { C: Admin, auth: true, admin: true, tab: "/account" }],
  ["/privacy", { C: Privacy, tab: "/account" }],
  ["/terms", { C: Terms, tab: "/account" }],
];

const TABS = [
  { path: "/", label: "الرئيسية", icon: "home" },
  { path: "/categories", label: "الأقسام", icon: "grid" },
  { path: "/requests", label: "طلباتي", icon: "clipboard" },
  { path: "/chats", label: "محادثاتي", icon: "chat" },
  { path: "/account", label: "حسابي", icon: "user" },
];

class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (this.state.error) return <ErrorBox error={{ message: "حدث خطأ غير متوقع في هذه الشاشة." }} onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}

function Shell() {
  const { path } = useHash();
  const { boot, reloadPublic, uid } = useApp();
  const [chatUnread, setChatUnread] = useState(0);

  // عدّاد رسائل غير مقروءة على تبويب المحادثات
  useEffect(() => {
    if (!uid) { setChatUnread(0); return; }
    let alive = true;
    api.myConversations().then((rows) => alive && setChatUnread(rows.reduce((n, c) => n + Number(c.unread || 0), 0))).catch(() => {});
    return () => { alive = false; };
  }, [uid, path]);

  if (boot.loading) return <div className="screen" style={{ justifyContent: "center" }}><Loading /></div>;
  if (boot.error) return <div className="screen" style={{ justifyContent: "center" }}><ErrorBox error={boot.error} onRetry={reloadPublic} /></div>;

  const route = matchRoute(ROUTES, path);
  let body;
  if (!route) {
    body = <div className="screen"><div className="empty"><div className="ico">🧭</div><div className="bold">الصفحة غير موجودة</div><button className="btn primary mt12" onClick={() => go("/")}>الرئيسية</button></div></div>;
  } else {
    const C = route.C;
    let el = <C {...route.params} />;
    if (route.admin) el = <RequireAdmin>{el}</RequireAdmin>;
    if (route.auth) el = <RequireAuth next={path}>{el}</RequireAuth>;
    body = el;
  }
  const showTabs = !(route?.bare);
  return (
    <>
      <Boundary resetKey={path}>{body}</Boundary>
      {showTabs && (
        <nav className="tabbar" aria-label="التنقل الرئيسي">
          {TABS.map((t) => {
            const on = (route?.tab ?? "/") === t.path;
            return (
              <button key={t.path} className={`tab ${on ? "on" : ""}`} aria-current={on ? "page" : undefined} onClick={() => go(t.path)}>
                <div className="pillbg"><Icon name={t.icon} size={21} stroke={on ? 2.5 : 2} /></div>
                <span>{t.label}</span>
                {t.path === "/chats" && chatUnread > 0 && <span className="badge-dot">{chatUnread > 9 ? "٩+" : String(chatUnread).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])}</span>}
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

function Root() {
  if (!isConfigured) return <div className="app"><Setup /></div>;
  return (
    <AppProvider>
      <div className="app"><Shell /></div>
    </AppProvider>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
