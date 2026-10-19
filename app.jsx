// سياق التطبيق: الجلسة، الحساب، الأقسام والقرى، المفضلة، الإشعارات، الإشعارات المنبثقة والحوارات
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as api from "./api";
import { releasePush, syncPush } from "./push";
import { playNotifySound, unlockSound } from "./sound";
import IosBanner from "./IosBanner";
import { go } from "./router";
import Icon from "./icons";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = جارٍ التحميل، null = زائر
  const [profile, setProfile] = useState(null);
  const [categories, setCategories] = useState([]);
  const [villages, setVillages] = useState([]);
  const [favIds, setFavIds] = useState(() => new Set());
  const [unread, setUnread] = useState(0);
  const [boot, setBoot] = useState({ loading: true, error: null });
  const [toastState, setToastState] = useState(null);
  const [dialog, setDialog] = useState(null);
  const toastTimer = useRef();

  const toast = useCallback((message, tone = "ok") => {
    setToastState({ message, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), 2600);
  }, []);

  // بيانات عامة + الجلسة
  const loadPublic = useCallback(async () => {
    setBoot({ loading: true, error: null });
    try {
      const [cats, vils, sess] = await Promise.all([api.listCategories(), api.listVillages(), api.getSession()]);
      setCategories(cats);
      setVillages(vils);
      setSession(sess);
      setBoot({ loading: false, error: null });
    } catch (e) {
      setBoot({ loading: false, error: e });
    }
  }, []);
  useEffect(() => { loadPublic(); }, [loadPublic]);
  useEffect(() => { unlockSound(); }, []);
  useEffect(() => api.onAuthChange((s, ev) => { setSession(s); if (ev === "PASSWORD_RECOVERY") go("/login?mode=reset"); }), []);

  const uid = session?.user?.id || null;

  // بيانات المستخدم عند تغيّر الجلسة
  useEffect(() => {
    if (session === undefined) return;
    if (!uid) { setProfile(null); setFavIds(new Set()); setUnread(0); return; }
    let alive = true;
    (async () => {
      try {
        const [p, favs, n] = await Promise.all([api.getMyProfile(uid), api.listFavoriteIds(), api.countUnreadNotifications()]);
        if (!alive) return;
        setProfile(p); setFavIds(new Set(favs)); setUnread(n);
      } catch { /* تبقى الشاشة تعمل، والخطأ يظهر في الشاشات المعنية */ }
    })();
    syncPush(uid);
    const off = api.subscribeNotifications(uid, (n) => {
      setUnread((c) => c + 1);
      toast(n.title);
      playNotifySound(n.kind === "order_new" ? "order" : "normal");
    });
    return () => { alive = false; off(); };
  }, [uid, session === undefined, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshProfile = useCallback(async () => { if (uid) setProfile(await api.getMyProfile(uid)); }, [uid]);
  const refreshUnread = useCallback(async () => { if (uid) setUnread(await api.countUnreadNotifications().catch(() => 0)); }, [uid]);

  const requireLogin = useCallback((next) => {
    if (uid) return true;
    go(`/login?next=${encodeURIComponent(next || window.location.hash.replace(/^#/, "") || "/")}`);
    return false;
  }, [uid]);

  const toggleFav = useCallback(async (businessId) => {
    if (!requireLogin(`/b/${businessId}`)) return;
    const on = !favIds.has(businessId);
    setFavIds((s) => { const n = new Set(s); on ? n.add(businessId) : n.delete(businessId); return n; });
    try { await api.setFavorite(businessId, on); toast(on ? "أُضيف إلى المفضلة" : "أُزيل من المفضلة"); }
    catch (e) {
      setFavIds((s) => { const n = new Set(s); on ? n.delete(businessId) : n.add(businessId); return n; });
      toast(e.message, "bad");
    }
  }, [favIds, requireLogin, toast]);

  const logout = useCallback(async () => {
    await releasePush();
    await api.signOut();
    setSession(null);
    go("/", { replace: true });
  }, []);

  // حوارات: تأكيد وإدخال نص (سبب)
  const confirm = useCallback((o) => new Promise((resolve) => setDialog({ kind: "confirm", ...o, resolve })), []);
  const ask = useCallback((o) => new Promise((resolve) => setDialog({ kind: "ask", ...o, resolve })), []);
  const closeDialog = (v) => { dialog?.resolve(v); setDialog(null); };

  const village = useCallback((id) => villages.find((v) => v.id === id), [villages]);
  const category = useCallback((id) => categories.find((c) => c.id === id), [categories]);

  const value = useMemo(() => ({
    session, uid, profile, isAdmin: profile?.role === "admin", categories, villages, favIds, unread, boot,
    toast, confirm, ask, requireLogin, toggleFav, logout, village, category,
    refreshProfile, refreshUnread, setUnread, reloadPublic: loadPublic, setCategories, setVillages,
  }), [session, uid, profile, categories, villages, favIds, unread, boot, toast, confirm, ask, requireLogin, toggleFav, logout, village, category, refreshProfile, refreshUnread, loadPublic]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastState && <div className={`toast ${toastState.tone === "bad" ? "bad" : ""}`} role="status">{toastState.message}</div>}
      {dialog && <Dialog dialog={dialog} onClose={closeDialog} />}
      <IosBanner />
    </Ctx.Provider>
  );
}

function Dialog({ dialog, onClose }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const isAsk = dialog.kind === "ask";
  const submit = () => {
    if (isAsk) {
      if (dialog.required && !text.trim()) { setErr("هذا الحقل مطلوب."); return; }
      onClose(text.trim());
    } else onClose(true);
  };
  return (
    <div className="overlay" onClick={() => onClose(isAsk ? null : false)} role="dialog" aria-modal="true" aria-label={dialog.title}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="h2">{dialog.title}</div>
        {dialog.body && <p className="muted mt8" style={{ lineHeight: 1.8, margin: "8px 0 0", fontSize: 14 }}>{dialog.body}</p>}
        {isAsk && (
          <div className="mt12">
            <textarea className={`input ${err ? "bad" : ""}`} rows={3} autoFocus value={text}
              placeholder={dialog.placeholder || ""} maxLength={dialog.maxLength || 300}
              onChange={(e) => { setText(e.target.value); setErr(""); }} aria-label={dialog.label || dialog.title} />
            {err && <div className="small mt8" style={{ color: "var(--red)" }}>{err}</div>}
          </div>
        )}
        <div className="row mt16">
          <button className={`btn ${dialog.danger ? "danger" : "primary"} grow`} onClick={submit}>{dialog.okLabel || "تأكيد"}</button>
          <button className="btn ghost grow" onClick={() => onClose(isAsk ? null : false)}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

export { Icon };
