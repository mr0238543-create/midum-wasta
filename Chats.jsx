import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go } from "./router";
import * as api from "./api";
import { Async, Empty, ErrorBox, Header, Loading, TabHeader, useAsync } from "./ui";
import { timeAgo, toAr } from "./util";

export default function Chats() {
  const st = useAsync(() => api.myConversations(), []);
  return (
    <div className="screen">
      <TabHeader title="محادثاتي" subtitle="تواصل مباشرة مع الأنشطة والعملاء" />
      <div className="pad">
        <Async state={st} rows={3}
          empty={<Empty icon="💬" title="لا توجد محادثات بعد" text="افتح صفحة أي نشاط واضغط «محادثة» لتبدأ." action={<button className="btn primary" onClick={() => go("/categories")}>تصفح الأقسام</button>} />}>
          {(rows) => (
            <div className="col">
              {rows.map((c) => (
                <button key={c.id} className="biz" onClick={() => go(`/chat/${c.id}`)}>
                  <div className="thumb" style={{ width: 52, height: 52, fontSize: 24, color: "#fff" }}>{c.as_owner ? "👤" : "🏪"}</div>
                  <div className="grow">
                    <div className="row between"><span className="bold trunc">{c.title}</span><span className="tiny muted">{timeAgo(c.last_message_at)}</span></div>
                    <div className="muted small trunc">{c.last_body || "ابدأ المحادثة"}</div>
                    {c.as_owner && <div className="tiny" style={{ color: "var(--deep)" }}>عميل لنشاطك</div>}
                  </div>
                  {Number(c.unread) > 0 && <span className="badge" style={{ background: "var(--orange)", color: "#fff" }}>{toAr(c.unread)}</span>}
                </button>
              ))}
            </div>
          )}
        </Async>
      </div>
    </div>
  );
}

export function Chat({ id }) {
  const { uid, toast, refreshUnread } = useApp();
  const st = useAsync(async () => {
    const [convs, msgs] = await Promise.all([api.myConversations(), api.listMessages(id)]);
    const conv = convs.find((c) => c.id === id) || null;
    if (conv) api.markConversationRead(id).then(refreshUnread).catch(() => {});
    return { conv, msgs };
  }, [id]);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef(null);

  useEffect(() => { if (st.data) setMsgs(st.data.msgs); }, [st.data]);
  useEffect(() => {
    const off = api.subscribeMessages(id, (m) => {
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      if (m.sender_id !== uid) api.markConversationRead(id).then(refreshUnread).catch(() => {});
    });
    return off;
  }, [id, uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const m = await api.sendMessage(id, body);
      setMsgs((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setText("");
    } catch (err) { toast(err.message, "bad"); } finally { setSending(false); }
  };

  if (st.loading && !st.data) return <div className="screen"><Header title="محادثة" backTo="/chats" /><Loading /></div>;
  if (st.error) return <div className="screen"><Header title="محادثة" backTo="/chats" /><ErrorBox error={st.error} onRetry={st.reload} /></div>;
  if (!st.data.conv) return <div className="screen"><Header title="محادثة" backTo="/chats" /><Empty icon="🔒" title="هذه المحادثة غير متاحة" text="المحادثات خاصة بين طرفيها فقط." /></div>;
  const { conv } = st.data;

  return (
    <div className="screen fixed">
      <Header title={conv.title} backTo="/chats"
        right={!conv.as_owner && <button className="round-btn" aria-label="صفحة النشاط" onClick={() => go(`/b/${conv.business_id}`)}><Icon name="store" size={18} /></button>} />
      <div className="msgs" aria-live="polite">
        {msgs.length === 0 && <p className="muted center small" style={{ marginTop: 24 }}>اكتب رسالتك الأولى. الرسائل خاصة بينك وبين الطرف الآخر.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.sender_id === uid ? "me" : "them"}`}>
            {m.body}
            <div className="t">{timeAgo(m.created_at)}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="composer" onSubmit={send}>
        <input className="input grow" style={{ borderRadius: 999 }} value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="اكتب رسالة…" aria-label="الرسالة" />
        <button className="btn primary" style={{ width: 46, padding: 0 }} aria-label="إرسال" disabled={sending || !text.trim()}><Icon name="send" size={18} style={{ transform: "scaleX(-1)" }} /></button>
      </form>
    </div>
  );
}
