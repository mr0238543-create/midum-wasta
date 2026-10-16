// المنطقة المختارة (ميدوم / الواسطى / قرية) — تُحفظ على الجهاز فقط
import { useSyncExternalStore } from "react";

const KEY = "mw_area";
const DEFAULT = { region: "all", village: null };
function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || DEFAULT; } catch { return DEFAULT; }
}
let current = read();
const subs = new Set();

export const getArea = () => current;
export function setArea(a) {
  current = a;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* التخزين غير متاح: نكمل بدونه */ }
  subs.forEach((f) => f());
}
export function useArea() {
  return useSyncExternalStore((cb) => (subs.add(cb), () => subs.delete(cb)), getArea);
}
export function areaLabel(a, villages) {
  if (a.village) return villages.find((v) => v.id === a.village)?.name || "كل المناطق";
  return a.region === "all" ? "كل المناطق" : `مركز ${a.region}`;
}
// معاملات البحث المناسبة للمنطقة
export const areaParams = (a) => ({ region: a.village ? null : a.region === "all" ? null : a.region, village: a.village || null });
