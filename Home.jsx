import { useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go, qs } from "./router";
import * as api from "./api";
import { Async, BusinessCard, Empty, useAsync } from "./ui";
import { areaLabel, areaParams, useArea } from "./area";
import { AreaSheet } from "./shared";

export function openCategory(c) {
  go(c.kind === "jobs" ? "/jobs" : `/search${qs({ cat: c.id })}`);
}

export function CategoryGrid() {
  const { categories } = useApp();
  return (
    <div className="cat-grid">
      {categories.map((c) => (
        <button key={c.id} className="cat" onClick={() => openCategory(c)}>
          <div className="ico" aria-hidden="true">{c.emoji}</div>
          <div className="bold" style={{ fontSize: 14, lineHeight: 1.4, textAlign: "center" }}>{c.name}</div>
        </button>
      ))}
    </div>
  );
}

export function AddBanner() {
  return (
    <button className="row mt16" onClick={() => go("/add")}
      style={{ width: "100%", padding: 16, borderRadius: 24, color: "#fff", textAlign: "right", background: "linear-gradient(135deg, var(--orange), var(--deep))", boxShadow: "var(--shadow-lg)" }}>
      <div style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="store" size={24} /></div>
      <div className="grow">
        <div style={{ fontWeight: 900 }}>عندك محل أو خدمة؟</div>
        <div style={{ fontSize: 12.5, opacity: 0.92 }}>سجّل نشاطك مجانًا ويظهر لأهل منطقتك بعد المراجعة</div>
      </div>
      <Icon name="chevL" size={20} />
    </button>
  );
}

export default function Home() {
  const { villages, uid, unread } = useApp();
  const area = useArea();
  const [q, setQ] = useState("");
  const [areaOpen, setAreaOpen] = useState(false);
  const ap = areaParams(area);
  const latest = useAsync(() => api.searchBusinesses({ sort: "newest", limit: 5, ...ap }), [area.region, area.village]);

  const submit = (e) => { e.preventDefault(); if (q.trim()) go(`/search${qs({ q: q.trim() })}`); };

  return (
    <div className="screen">
      <div className="hdr big">
        <div className="blob" style={{ width: 160, height: 160, left: -40, top: -40 }} />
        <div className="blob" style={{ width: 128, height: 128, right: 40, bottom: -48 }} />
        <div className="row between" style={{ position: "relative", alignItems: "flex-start" }}>
          <div>
            <h1>ميدوم والواسطي</h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, opacity: 0.92 }}>دليلك لكل ما تحتاجه قريب منك</p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {uid && (
              <button className="round-btn" aria-label="الإشعارات" onClick={() => go("/notifications")}>
                <Icon name="bell" />{unread > 0 && <span className="dot">{unread > 9 ? "٩+" : unread}</span>}
              </button>
            )}
            <button className="pill" onClick={() => setAreaOpen(true)}>
              <Icon name="pin" size={16} /> {areaLabel(area, villages)} <Icon name="chevDown" size={14} />
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={submit} style={{ margin: "-26px 20px 0", position: "relative" }} role="search">
        <div className="searchbox">
          <Icon name="search" size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن مطعم، محل، خدمة، وظيفة…" aria-label="بحث" enterKeyHint="search" />
          {q && <button type="button" aria-label="مسح" onClick={() => setQ("")} style={{ color: "var(--mute)" }}><Icon name="x" size={18} /></button>}
        </div>
      </form>

      <div className="pad">
        <h2 className="h2" style={{ fontSize: 18 }}>تصفح الأقسام</h2>
        <div className="mt12"><CategoryGrid /></div>
        <AddBanner />

        <div className="row between mt24">
          <h2 className="h2">أحدث الأنشطة</h2>
          <button className="small bold" style={{ color: "var(--deep)" }} onClick={() => go("/search")}>عرض الكل</button>
        </div>
        <div className="mt12">
          <Async state={latest} rows={2}
            empty={<Empty icon="🏪" title="لا توجد أنشطة بعد في هذه المنطقة" text="كن أول من يسجّل نشاطه!" />}>
            {(rows) => <div className="col">{rows.map((b) => <BusinessCard key={b.id} b={b} />)}</div>}
          </Async>
        </div>
      </div>
      {areaOpen && <AreaSheet onClose={() => setAreaOpen(false)} />}
    </div>
  );
}
