import { useEffect, useRef, useState } from "react";
import Icon from "./icons";
import { useApp } from "./app";
import { go, qs, useHash } from "./router";
import * as api from "./api";
import { BusinessCard, Empty, ErrorBox, Header, Loading, Sheet, Field } from "./ui";
import { areaLabel, areaParams, useArea } from "./area";
import { useGeo } from "./geo";
import { toAr } from "./util";
import { AreaSheet } from "./shared";

const PAGE = 20;
const SORTS = [
  { id: "newest", label: "الأحدث" },
  { id: "rating", label: "الأعلى تقييمًا" },
  { id: "nearest", label: "الأقرب إليّ" },
];

export default function Search() {
  const { query } = useHash();
  const { categories, villages } = useApp();
  const area = useArea();
  const geo = useGeo();
  const [areaOpen, setAreaOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [text, setText] = useState(query.q || "");
  const [state, setState] = useState({ loading: true, error: null, rows: [], more: false });
  const reqId = useRef(0);

  const cat = categories.find((c) => c.id === query.cat);
  const sort = query.sort || "newest";
  const minRating = Number(query.min || 0);
  const ap = areaParams(area);
  const village = query.village || ap.village;

  const setParam = (patch) => go(`/search${qs({ ...query, ...patch })}`, { replace: true });

  // بحث مباشر أثناء الكتابة (بعد توقف قصير)
  useEffect(() => {
    if ((query.q || "") === text.trim()) return;
    const t = setTimeout(() => setParam({ q: text.trim() }), 350);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async (offset) => {
    const my = ++reqId.current;
    if (offset === 0) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      let coords = geo.coords;
      if (sort === "nearest" && !coords) coords = await geo.request();
      const rows = await api.searchBusinesses({
        q: query.q, category: query.cat, region: ap.region, village, minRating,
        sort: sort === "nearest" && !coords ? "newest" : sort, lat: coords?.lat, lng: coords?.lng, limit: PAGE, offset,
      });
      if (my !== reqId.current) return;
      setState((s) => ({ loading: false, error: null, rows: offset === 0 ? rows : [...s.rows, ...rows], more: rows.length === PAGE }));
    } catch (e) {
      if (my === reqId.current) setState((s) => ({ ...s, loading: false, error: e }));
    }
  };
  useEffect(() => { load(0); }, [query.q, query.cat, query.sort, query.min, query.village, area.region, area.village]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeFilters = (minRating ? 1 : 0) + (query.village ? 1 : 0) + (sort !== "newest" ? 1 : 0);

  return (
    <div className="screen fixed">
      <Header title={cat ? `${cat.emoji} ${cat.name}` : "البحث"} backTo="/"
        right={<button className="pill" onClick={() => setAreaOpen(true)}><Icon name="pin" size={14} />{areaLabel(area, villages)}</button>}>
        <div className="searchbox mt12" style={{ boxShadow: "none" }}>
          <Icon name="search" size={19} />
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="اسم النشاط أو الخدمة أو القرية" aria-label="بحث" autoFocus={!cat && !query.q} />
          {text && <button aria-label="مسح" onClick={() => { setText(""); setParam({ q: "" }); }} style={{ color: "var(--mute)" }}><Icon name="x" size={18} /></button>}
        </div>
      </Header>

      <div className="row" style={{ padding: "10px 20px 0", gap: 8 }}>
        <button className="btn soft sm" onClick={() => setFilterOpen(true)}>
          <Icon name="sliders" size={16} /> تصفية{activeFilters ? ` (${toAr(activeFilters)})` : ""}
        </button>
        <div className="chips grow" style={{ padding: 0 }}>
          {SORTS.map((s) => (
            <button key={s.id} className={`chip ${sort === s.id ? "on" : ""}`} onClick={() => setParam({ sort: s.id === "newest" ? "" : s.id })}>{s.label}</button>
          ))}
        </div>
      </div>
      {geo.error && sort === "nearest" && <div className="banner warn" style={{ margin: "8px 20px 0" }}>{geo.error}</div>}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 20px 24px" }}>
        {state.loading && state.rows.length === 0 ? <Loading />
          : state.error && state.rows.length === 0 ? <ErrorBox error={state.error} onRetry={() => load(0)} />
          : state.rows.length === 0 ? (
            <Empty title="لا توجد نتائج مطابقة" text="جرّب كلمة أخرى، أو غيّر المنطقة والتصفية."
              action={(area.region !== "all" || area.village || activeFilters) && (
                <button className="btn soft" onClick={() => { import("./area").then((m) => m.setArea({ region: "all", village: null })); go(`/search${qs({ q: query.q, cat: query.cat })}`, { replace: true }); }}>عرض كل المناطق</button>
              )} />
          ) : (
            <div className="col">
              {state.rows.map((b) => <BusinessCard key={b.id} b={b} />)}
              {state.more && <button className="btn ghost block" onClick={() => load(state.rows.length)}>عرض المزيد</button>}
            </div>
          )}
      </div>

      {areaOpen && <AreaSheet onClose={() => setAreaOpen(false)} />}
      {filterOpen && (
        <Sheet title="تصفية النتائج" onClose={() => setFilterOpen(false)}>
          <div className="col">
            <Field label="القسم">
              <select className="input" value={query.cat || ""} onChange={(e) => setParam({ cat: e.target.value })}>
                <option value="">كل الأقسام</option>
                {categories.filter((c) => c.kind === "business").map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </Field>
            <Field label="القرية">
              <select className="input" value={query.village || ""} onChange={(e) => setParam({ village: e.target.value })}>
                <option value="">{areaLabel(area, villages)}</option>
                {villages.filter((v) => area.region === "all" || v.region === area.region).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </Field>
            <Field label="التقييم">
              <select className="input" value={minRating} onChange={(e) => setParam({ min: e.target.value === "0" ? "" : e.target.value })}>
                <option value={0}>كل التقييمات</option>
                <option value={3}>٣ نجوم فأكثر</option>
                <option value={4}>٤ نجوم فأكثر</option>
                <option value={4.5}>٤٫٥ فأكثر</option>
              </select>
            </Field>
            <button className="btn primary block" onClick={() => setFilterOpen(false)}>عرض النتائج</button>
            <button className="btn ghost block" onClick={() => { setParam({ village: "", min: "", sort: "" }); setFilterOpen(false); }}>مسح التصفية</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
