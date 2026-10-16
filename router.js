import { useEffect, useState } from "react";

// موجّه بسيط قائم على hash: يعمل على أي استضافة ثابتة، وتصلح الروابط للمشاركة (#/b/<id>)
export function parseHash(h = window.location.hash) {
  const raw = h.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/", query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useHash() {
  const [loc, setLoc] = useState(parseHash());
  useEffect(() => {
    const f = () => setLoc(parseHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  return loc;
}

export function go(path, { replace = false } = {}) {
  if (replace) window.location.replace("#" + path);
  else window.location.hash = path;
}
export function back(fallback = "/") {
  if (window.history.length > 1) window.history.back();
  else go(fallback, { replace: true });
}
export const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== "" && v != null && p.set(k, v));
  const s = p.toString();
  return s ? "?" + s : "";
};

export function matchRoute(routes, path) {
  for (const [pattern, meta] of routes) {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/:([a-z]+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "$");
    const m = path.match(re);
    if (m) return { ...meta, params: Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
