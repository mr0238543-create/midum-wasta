// خادم وهمي داخل الذاكرة يحاكي طبقة src/api.js وقواعد قاعدة البيانات الأساسية، لاختبار الواجهة في متصفح
// دون Supabase. (الصلاحيات الحقيقية مُختبَرة فعليًا في supabase/tests على Postgres.)
export class ApiError extends Error { constructor(m, code) { super(m); this.code = code; } }
export const humanize = (e) => String(e?.message || e);

const ar = (t = "") => String(t).replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase();
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));

const db = {
  profiles: {}, products: [], payments: {}, orders: [], businesses: [], reviews: [], favorites: [], requests: [], convs: [], messages: [], notifs: [], reports: [], jobs: [],
  categories: [
    ["restaurants", "المطاعم والكافيهات", "🍽️", "business"], ["shops", "المحلات والسوبر ماركت", "🛍️", "business"], ["pharmacies", "الصيدليات", "💊", "business"],
    ["clinics", "الأطباء والعيادات", "🩺", "business"], ["labs", "المعامل والتحاليل", "🧪", "business"], ["transport", "المواصلات", "🚌", "business"],
    ["crafts", "الصنايعية والخدمات المنزلية", "🔧", "business"], ["jobs", "الوظائف", "💼", "jobs"], ["realestate", "العقارات", "🏠", "business"],
    ["sports", "الملاعب والأنشطة الرياضية", "⚽", "business"], ["education", "التعليم والدروس", "📚", "business"], ["cars", "خدمات السيارات", "🚗", "business"],
    ["events", "المناسبات والخدمات العامة", "🎉", "business"], ["market", "سوق ميدوم والواسطى", "🧺", "business"],
  ].map(([id, name, emoji, kind], i) => ({ id, name, emoji, kind, sort_order: i + 1, is_active: true })),
  villages: [["ميدوم", "ميدوم"], ["المنشية", "ميدوم"], ["كفر الشيخ", "ميدوم"], ["الواسطى", "الواسطى"], ["أبو صير الملق", "الواسطى"], ["بني أحمد", "الواسطى"]]
    .map(([name, region], i) => ({ id: i + 1, name, region, sort_order: i + 1, is_active: true })),
};
const ADMIN_PHONE = "201000000003";
let uid = null;
const listeners = new Set();
const msgSubs = new Set();
const notifSubs = new Set();
const sessionOf = () => (uid ? { user: { id: uid, phone: db.profiles[uid].phone, email: db.profiles[uid].email } } : null);
const emit = () => listeners.forEach((f) => f(sessionOf()));
const me = () => db.profiles[uid];
const isAdmin = () => me()?.role === "admin";
const first = (name) => (String(name || "").trim().split(" ")[0] || "مستخدم");
const notify = (user, kind, title, body, link) => {
  if (!user) return;
  const row = { id: uuid(), user_id: user, kind, title, body, link, is_read: false, created_at: now() };
  db.notifs.unshift(row);
  if (user === uid) notifSubs.forEach((f) => f(row));
};
const need = (c, msg, code) => { if (!c) throw new ApiError(msg, code); };
const login = () => need(uid, "ليست لديك صلاحية لهذا الإجراء. سجّل الدخول وحاول مجددًا.", "42501");

function ensureUser(phone, extra = {}) {
  let p = Object.values(db.profiles).find((x) => x.phone === phone);
  if (!p) { p = { id: uuid(), phone, full_name: null, role: "user", village_id: null, is_banned: false, created_at: now(), ...extra }; db.profiles[p.id] = p; }
  return p;
}
ensureUser(ADMIN_PHONE, { role: "admin", full_name: "المشرف العام" });

// أدوات اختبار (تُستعمل من سكربت Playwright)
if (typeof window !== "undefined") {
  window.__mock = {
    signInAs(phone, name) { const p = ensureUser(phone, name ? { full_name: name } : {}); uid = p.id; emit(); return p.id; },
    signOutNow() { uid = null; emit(); },
    db: () => db,
    otherSays(cid, body) { // رسالة من الطرف الآخر تصل فورًا (محاكاة Realtime)
      const c = db.convs.find((x) => x.id === cid);
      const biz = db.businesses.find((b) => b.id === c.business_id);
      const sender = c.user_id === uid ? biz.owner_id : c.user_id;
      const m = { id: uuid(), conversation_id: cid, sender_id: sender, body, created_at: now(), read_at: null };
      db.messages.push(m); c.last_message_at = m.created_at; msgSubs.forEach(([id, f]) => id === cid && f(m));
    },
  };
}

// ── الجلسة ──
export async function sendOtp(e164) {
  if (e164 === "+201099999999") throw new ApiError("تعذّر إرسال رسالة التحقق إلى هذا الرقم. تأكد من الرقم وحاول مجددًا.");
  window.__lastOtpPhone = e164;
}
export async function verifyOtp(e164, token) {
  if (token !== "123456") throw new ApiError("رمز التحقق غير صحيح أو انتهت صلاحيته.");
  uid = ensureUser(e164.replace("+", "")).id; emit(); return sessionOf();
}
export const getSession = async () => sessionOf();
export function onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }
export const signOut = async () => { uid = null; emit(); };
export const getMyProfile = async (id) => clone(db.profiles[id] || null);
export async function updateMyProfile(id, patch) { Object.assign(db.profiles[id], patch); return clone(db.profiles[id]); }
export async function deleteMyAccount(id) {
  db.businesses = db.businesses.filter((b) => b.owner_id !== id); delete db.profiles[id]; uid = null; emit();
}

export const listCategories = async ({ includeHidden = false } = {}) => clone(db.categories.filter((c) => includeHidden || c.is_active).sort((a, b) => a.sort_order - b.sort_order));
export const listVillages = async ({ includeHidden = false } = {}) => clone(db.villages.filter((v) => includeHidden || v.is_active).sort((a, b) => a.sort_order - b.sort_order));

// ── الأنشطة ──
const pub = (b) => ({
  id: b.id, category_id: b.category_id, village_id: b.village_id, name: b.name, type_label: b.type_label, description: b.description,
  phone: b.show_phone ? b.phone : null, address: b.show_address ? b.address : null, hours: b.hours,
  lat: b.show_address ? b.lat : null, lng: b.show_address ? b.lng : null, photos: b.photos, rating_avg: b.rating_avg, rating_count: b.rating_count,
  is_demo: b.is_demo, created_at: b.created_at, chat_enabled: b.owner_id != null, distance_km: null,
});
const catOn = (id) => db.categories.find((c) => c.id === id)?.is_active;
export async function searchBusinesses(o = {}) {
  const words = ar(o.q || "").split(/\s+/).filter(Boolean);
  let rows = db.businesses.filter((b) => b.status === "approved" && catOn(b.category_id)).filter((b) => {
    const v = db.villages.find((x) => x.id === b.village_id);
    if (o.category && b.category_id !== o.category) return false;
    if (o.village && b.village_id !== Number(o.village)) return false;
    if (o.region && v.region !== o.region) return false;
    if (b.rating_avg < (o.minRating || 0)) return false;
    const st = ar([b.name, b.type_label, b.description, v.name, db.categories.find((c) => c.id === b.category_id).name].join(" "));
    return words.every((w) => st.includes(w));
  });
  rows.sort((a, b) => (o.sort === "rating" ? b.rating_avg - a.rating_avg : b.created_at.localeCompare(a.created_at)));
  return clone(rows.slice(o.offset || 0, (o.offset || 0) + (o.limit || 20)).map(pub));
}
export const getBusiness = async (id) => { const b = db.businesses.find((x) => x.id === id && x.status === "approved"); return b ? clone(pub(b)) : null; };
export const listMyBusinesses = async (id) => clone(db.businesses.filter((b) => b.owner_id === id));
export async function getMyBusiness(id) {
  const b = db.businesses.find((x) => x.id === id);
  return b && (b.owner_id === uid || isAdmin()) ? clone(b) : null;
}
export async function createBusiness(f) {
  login();
  need(db.businesses.filter((b) => b.owner_id === uid).length < 3, "وصلت للحد اليومي لإضافة الأنشطة (٣ في اليوم). حاول غدًا.");
  const b = { ...f, id: uuid(), owner_id: uid, status: "pending", review_note: null, rating_avg: 0, rating_count: 0, is_demo: false, created_at: now(), updated_at: now() };
  db.businesses.push(b); if (me().role === "user") me().role = "owner"; return clone(b);
}
export async function updateBusiness(id, patch) {
  const b = db.businesses.find((x) => x.id === id); need(b && b.owner_id === uid, "ليست لديك صلاحية لهذا الإجراء.", "42501");
  const old = { ...b }; const { status, ...rest } = patch; Object.assign(b, rest);
  if (status && status !== old.status && ["rejected", "changes_requested"].includes(old.status) && status === "pending") b.status = "pending";
  if (old.status === "approved" && ["name", "description", "type_label", "category_id"].some((k) => b[k] !== old[k]) || JSON.stringify(old.photos) !== JSON.stringify(b.photos) && old.status === "approved") b.status = "pending";
  return clone(b);
}
export async function deleteBusiness(id) { db.businesses = db.businesses.filter((b) => !(b.id === id && b.owner_id === uid)); }
export async function uploadPhoto(id) { return `${id}/${uuid()}.jpg`; }
export const photoUrl = () => "data:image/gif;base64,R0lGODlhAQABAIAAAP8AAP///yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==";
export async function removePhotos() {}

// ── التقييمات ──
const canInteract = (id) => { const b = db.businesses.find((x) => x.id === id); return b && b.status === "approved" && b.owner_id && b.owner_id !== uid; };
const recompute = (bid) => {
  const rs = db.reviews.filter((r) => r.business_id === bid && r.status === "visible"); const b = db.businesses.find((x) => x.id === bid);
  b.rating_count = rs.length; b.rating_avg = rs.length ? Math.round((rs.reduce((s, r) => s + r.rating, 0) / rs.length) * 10) / 10 : 0;
};
export async function listReviews(bid) {
  return clone(db.reviews.filter((r) => r.business_id === bid && r.status === "visible").map((r) => ({ id: r.id, business_id: bid, rating: r.rating, comment: r.comment, created_at: r.created_at, author: first(db.profiles[r.user_id]?.full_name) })));
}
export const getMyReview = async (bid, id) => clone(db.reviews.find((r) => r.business_id === bid && r.user_id === id) || null);
export async function saveReview({ businessId, uid: u, rating, comment }) {
  login(); need(canInteract(businessId), "ليست لديك صلاحية لهذا الإجراء.", "42501");
  let r = db.reviews.find((x) => x.business_id === businessId && x.user_id === u);
  if (r) { r.rating = rating; r.comment = comment?.trim() || null; } else { r = { id: uuid(), business_id: businessId, user_id: u, rating, comment: comment?.trim() || null, status: "visible", created_at: now() }; db.reviews.push(r); notify(db.businesses.find((b) => b.id === businessId).owner_id, "review", "تقييم جديد", "", `/b/${businessId}`); }
  recompute(businessId); return clone(r);
}
export async function deleteMyReview(id) { const r = db.reviews.find((x) => x.id === id && x.user_id === uid); if (r) { db.reviews = db.reviews.filter((x) => x !== r); recompute(r.business_id); } }

// ── المفضلة ──
export const listFavoriteIds = async () => db.favorites.filter((f) => f.user_id === uid).map((f) => f.business_id);
export async function setFavorite(bid, on) {
  login(); db.favorites = db.favorites.filter((f) => !(f.user_id === uid && f.business_id === bid)); if (on) db.favorites.push({ user_id: uid, business_id: bid });
}
export async function listFavorites() { const ids = await listFavoriteIds(); return clone(db.businesses.filter((b) => ids.includes(b.id) && b.status === "approved").map(pub)); }

// ── الطلبات ──
export async function createRequest({ businessId, kind, message, sharePhone }) {
  login(); need(canInteract(businessId), "ليست لديك صلاحية لهذا الإجراء.", "42501");
  const b = db.businesses.find((x) => x.id === businessId);
  const r = { id: uuid(), business_id: businessId, user_id: uid, kind, message, share_phone: !!sharePhone, contact_phone: sharePhone ? "0" + me().phone.slice(2) : null, requester_name: first(me().full_name), business_name: b.name, status: "new", created_at: now() };
  db.requests.unshift(r); notify(b.owner_id, "request_new", `طلب جديد على «${b.name}»`, message.slice(0, 80), "/requests"); return clone(r);
}
export const listMyRequests = async (id) => clone(db.requests.filter((r) => r.user_id === id));
export async function listIncomingRequests(ids) { return clone(db.requests.filter((r) => ids.includes(r.business_id))); }
export async function getRequest(id) {
  const r = db.requests.find((x) => x.id === id); const b = r && db.businesses.find((x) => x.id === r.business_id);
  return r && (r.user_id === uid || b.owner_id === uid || isAdmin()) ? clone(r) : null;
}
const OWN = [["new", "accepted"], ["new", "declined"], ["accepted", "in_progress"], ["accepted", "completed"], ["in_progress", "completed"]];
export async function updateRequestStatus(id, status) {
  const r = db.requests.find((x) => x.id === id); const b = db.businesses.find((x) => x.id === r.business_id);
  const okOwner = b.owner_id === uid && OWN.some(([a, c]) => a === r.status && c === status);
  const okUser = r.user_id === uid && ["new", "accepted"].includes(r.status) && status === "cancelled";
  need(okOwner || okUser, "ليست لديك صلاحية لهذا الإجراء.", "42501");
  r.status = status; notify(okOwner ? r.user_id : b.owner_id, "request_update", `تحديث على طلبك من «${b.name}»`, status, "/requests"); return clone(r);
}

// ── المحادثات ──
export async function startConversation(bid) {
  login(); need(canInteract(bid), "لا يمكنك مراسلة هذا النشاط.", "42501");
  let c = db.convs.find((x) => x.business_id === bid && x.user_id === uid);
  if (!c) { c = { id: uuid(), business_id: bid, user_id: uid, created_at: now(), last_message_at: now() }; db.convs.push(c); }
  return c.id;
}
const member = (c) => c.user_id === uid || db.businesses.find((b) => b.id === c.business_id).owner_id === uid;
export async function myConversations() {
  return clone(db.convs.filter(member).map((c) => {
    const b = db.businesses.find((x) => x.id === c.business_id); const owner = b.owner_id === uid; const ms = db.messages.filter((m) => m.conversation_id === c.id);
    return { id: c.id, business_id: b.id, title: owner ? first(db.profiles[c.user_id].full_name) : b.name, as_owner: owner, last_body: ms.at(-1)?.body || null, last_message_at: c.last_message_at, unread: ms.filter((m) => m.sender_id !== uid && !m.read_at).length };
  }));
}
export async function listMessages(cid) { const c = db.convs.find((x) => x.id === cid); return c && member(c) ? clone(db.messages.filter((m) => m.conversation_id === cid)) : []; }
export async function sendMessage(cid, body) {
  const c = db.convs.find((x) => x.id === cid); need(c && member(c), "ليست لديك صلاحية لهذا الإجراء.", "42501");
  const m = { id: uuid(), conversation_id: cid, sender_id: uid, body, created_at: now(), read_at: null }; db.messages.push(m); c.last_message_at = m.created_at;
  const b = db.businesses.find((x) => x.id === c.business_id); notify(uid === c.user_id ? b.owner_id : c.user_id, "message", "رسالة جديدة", body.slice(0, 80), `/chat/${cid}`);
  msgSubs.forEach(([id, f]) => id === cid && f(m)); return clone(m);
}
export async function markConversationRead(cid) {
  db.messages.filter((m) => m.conversation_id === cid && m.sender_id !== uid).forEach((m) => { m.read_at = now(); });
  db.notifs.filter((x) => x.user_id === uid && x.kind === "message" && x.link === `/chat/${cid}`).forEach((x) => { x.is_read = true; });
}
export function subscribeMessages(cid, cb) { const e = [cid, cb]; msgSubs.add(e); return () => msgSubs.delete(e); }

// ── الإشعارات ──
export const listNotifications = async () => clone(db.notifs.filter((x) => x.user_id === uid));
export const countUnreadNotifications = async () => db.notifs.filter((x) => x.user_id === uid && !x.is_read).length;
export async function markAllNotificationsRead() { db.notifs.filter((x) => x.user_id === uid).forEach((x) => { x.is_read = true; }); }
export async function markNotificationRead(id) { const x = db.notifs.find((n) => n.id === id && n.user_id === uid); if (x) x.is_read = true; }
export function subscribeNotifications(u, cb) { notifSubs.add(cb); return () => notifSubs.delete(cb); }

// ── البلاغات والوظائف ──
export async function reportTarget({ type, id, reason, details }) {
  login(); if (db.reports.some((r) => r.reporter_id === uid && r.target_type === type && r.target_id === id)) throw new ApiError("تم هذا الإجراء من قبل.", "23505");
  db.reports.push({ id: uuid(), reporter_id: uid, target_type: type, target_id: id, reason, details, status: "open", resolution_note: null, created_at: now() });
}
export async function listJobs() { return clone(db.jobs.filter((j) => j.status === "approved").map(({ id, title, employer_name, description, village_id, job_type, contact_phone, created_at, expires_at }) => ({ id, title, employer_name, description, village_id, job_type, contact_phone, created_at, expires_at }))); }
export const listMyJobs = async (id) => clone(db.jobs.filter((j) => j.poster_id === id));
export async function createJob(f) { login(); const j = { ...f, id: uuid(), poster_id: uid, status: "pending", review_note: null, created_at: now(), expires_at: new Date(Date.now() + 30 * 864e5).toISOString() }; db.jobs.push(j); return clone(j); }
export async function updateJob(id, patch) { const j = db.jobs.find((x) => x.id === id && x.poster_id === uid); Object.assign(j, patch); return clone(j); }
export async function deleteJob(id) { db.jobs = db.jobs.filter((j) => !(j.id === id && j.poster_id === uid)); }

// ── المشرف ──
const adm = () => need(isAdmin(), "هذا الإجراء مخصص للمشرفين.", "42501");
export async function adminCounts() { adm(); return { pending_businesses: db.businesses.filter((b) => b.status === "pending").length, pending_jobs: db.jobs.filter((j) => j.status === "pending").length, open_reports: db.reports.filter((r) => r.status === "open").length }; }
export async function adminListBusinesses(status) { adm(); return clone(db.businesses.filter((b) => !status || b.status === status)); }
const MAP = { approve: "approved", reject: "rejected", request_changes: "changes_requested", suspend: "suspended" };
export async function adminModerateBusiness(id, action, note) {
  adm(); const s = MAP[action]; need(s === "approved" || (note && note.trim()), "اكتب السبب أولًا.");
  const b = db.businesses.find((x) => x.id === id); b.status = s; b.review_note = s === "approved" ? null : note;
  notify(b.owner_id, "business_" + s, "تحديث على نشاطك", note || "", s === "approved" ? `/b/${id}` : `/my/${id}`);
}
export async function adminListJobs(status) { adm(); return clone(db.jobs.filter((j) => !status || j.status === status)); }
export async function adminModerateJob(id, action, note) { adm(); const j = db.jobs.find((x) => x.id === id); j.status = MAP[action]; j.review_note = action === "approve" ? null : note; }
export async function adminListReports(status = "open") {
  adm(); return clone(db.reports.filter((r) => r.status === status).map((r) => {
    const b = r.target_type === "business" ? db.businesses.find((x) => x.id === r.target_id) : null;
    return { ...r, target: b, label: b?.name || "(محتوى)", offender: b?.owner_id };
  }));
}
export async function adminHandleReport(id, action, note) {
  adm(); const r = db.reports.find((x) => x.id === id);
  if (action === "suspend") { need(note, "اكتب السبب أولًا."); if (r.target_type === "business") { const b = db.businesses.find((x) => x.id === r.target_id); b.status = "suspended"; b.review_note = note; } }
  r.status = action === "dismiss" ? "dismissed" : "resolved"; r.resolution_note = note || null;
}
export async function adminSetBanned(id, banned) { adm(); db.profiles[id].is_banned = banned; }
export async function adminProfiles(ids) { adm(); return clone(Object.fromEntries(ids.filter(Boolean).map((i) => [i, db.profiles[i]]))); }
export async function adminSaveCategory(row) { adm(); const i = db.categories.findIndex((c) => c.id === row.id); if (i >= 0) db.categories[i] = { ...db.categories[i], ...row }; else db.categories.push(row); return clone(row); }
export async function adminSaveVillage(row) { adm(); if (row.id) { const i = db.villages.findIndex((v) => v.id === row.id); db.villages[i] = { ...db.villages[i], ...row }; } else db.villages.push({ ...row, id: db.villages.length + 1 }); return clone(row); }


// ── الدخول بالإيميل/جوجل ──
export async function signInWithGoogle(next) { window.__googleNext = next || null; throw new ApiError("هذه الطريقة غير مفعّلة حاليًا. استخدم طريقة دخول أخرى."); }
export async function signInWithEmail(email, password) {
  const p = Object.values(db.profiles).find((x) => x.email === email.trim());
  if (!p || p.password !== password) throw new ApiError("الإيميل أو كلمة المرور غير صحيحة.");
  uid = p.id; emit(); return sessionOf();
}
export async function signUpWithEmail(email, password, fullName) {
  if (Object.values(db.profiles).some((x) => x.email === email.trim())) throw new ApiError("هذا الإيميل مسجّل بالفعل. سجّل الدخول، أو اطلب رابط دخول.");
  const p = { id: uuid(), phone: null, email: email.trim(), password, full_name: fullName || null, role: "user", village_id: null, is_banned: false, created_at: now() };
  db.profiles[p.id] = p; uid = p.id; emit(); return { session: sessionOf() };
}
export async function sendMagicLink() {}

// ── المنتجات والدفع والطلبات ──
const ownerOf = (bid) => db.businesses.find((b) => b.id === bid)?.owner_id;
export const listProducts = async (bid) => clone(db.products.filter((p) => p.business_id === bid && db.businesses.find((b) => b.id === bid)?.status === "approved").sort((a, b) => a.sort_order - b.sort_order));
export const listMyProducts = async (bid) => clone(db.products.filter((p) => p.business_id === bid && ownerOf(bid) === uid));
export async function saveProduct({ id, business_id, name, price, photo }) {
  login(); need(name.trim().length >= 2 && price >= 0, "بيانات المنتج غير صحيحة.");
  if (id) { const p = db.products.find((x) => x.id === id && ownerOf(x.business_id) === uid); need(p, "ليست لديك صلاحية لهذا الإجراء.", "42501"); Object.assign(p, { name: name.trim(), price, photo: photo || null }); return clone(p); }
  need(ownerOf(business_id) === uid, "ليست لديك صلاحية لهذا الإجراء.", "42501");
  const p = { id: uuid(), business_id, name: name.trim(), price, photo: photo || null, sort_order: 0, created_at: now() }; db.products.push(p); return clone(p);
}
export async function deleteProduct(id) { db.products = db.products.filter((p) => !(p.id === id && ownerOf(p.business_id) === uid)); }
export async function getPaymentMethods(bid) { const b = db.businesses.find((x) => x.id === bid && x.status === "approved"); if (!b) return null; const r = db.payments[bid]; return r ? clone({ business_id: bid, ...r }) : null; }
export const getMyPayments = async (bid) => (ownerOf(bid) === uid && db.payments[bid] ? clone({ business_id: bid, ...db.payments[bid] }) : null);
export async function saveMyPayments(bid, f) { need(ownerOf(bid) === uid, "ليست لديك صلاحية لهذا الإجراء.", "42501"); const { business_id, updated_at, ...rest } = f; db.payments[bid] = rest; return clone(rest); }
export async function createOrder(f) {
  login();
  const p = db.products.find((x) => x.id === f.product_id && x.business_id === f.business_id); need(p, "هذا المنتج لم يعد متاحًا. حدّث الصفحة وحاول مجددًا.");
  const bp = db.payments[f.business_id] || { cod: true };
  const okPay = f.payment_method === "cod" ? bp.cod !== false : Boolean(bp[f.payment_method]);
  need(okPay, "طريقة الدفع هذه غير متاحة لدى هذا النشاط. اختر طريقة أخرى.");
  need(ownerOf(f.business_id) !== uid, "لا يمكنك الشراء من هذا النشاط.");
  const b = db.businesses.find((x) => x.id === f.business_id);
  const o = { ...f, receipt_path: f.payment_method === "cod" ? null : f.receipt_path || null, id: uuid(), user_id: uid, business_name: b.name, product_name: p.name, product_photo: p.photo, unit_price: p.price, total: p.price * f.quantity, status: "new", reject_reason: null, created_at: now(), updated_at: now() };
  db.orders.push(o); notify(b.owner_id, "order_new", `طلب شراء جديد على «${b.name}»`, `${p.name} × ${f.quantity}`, `/orders/${o.id}`); return clone(o);
}
export const listMyOrders = async (id) => clone(db.orders.filter((o) => o.user_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
export async function listIncomingOrders(ids) { return clone(db.orders.filter((o) => ids.includes(o.business_id) && ownerOf(o.business_id) === uid)); }
export async function getOrder(id) { const o = db.orders.find((x) => x.id === id); return o && (o.user_id === uid || ownerOf(o.business_id) === uid) ? clone(o) : null; }
export async function updateOrderStatus(id, status, reason) {
  const o = db.orders.find((x) => x.id === id); need(o, "ليست لديك صلاحية لهذا الإجراء.", "42501");
  const buyer = o.user_id === uid, owner = ownerOf(o.business_id) === uid;
  const ok = buyer ? o.status === "new" && status === "cancelled"
    : owner && ((o.status === "new" && ["accepted", "rejected"].includes(status)) || (o.status === "accepted" && ["shipped", "delivered"].includes(status)) || (o.status === "shipped" && status === "delivered"));
  need(ok, "لا يمكن تنفيذ هذا الإجراء على حالة الطلب الحالية. حدّث الصفحة.");
  o.status = status; if (status === "rejected") o.reject_reason = reason;
  if (!buyer) notify(o.user_id, "order_update", "تحديث على طلبك", o.product_name, `/orders/${o.id}`);
  return clone(o);
}
export async function attachReceipt(id, path) { const o = db.orders.find((x) => x.id === id && x.user_id === uid); need(o && o.payment_method !== "cod" && ["new", "accepted"].includes(o.status), "لا يمكن تنفيذ هذا الإجراء على حالة الطلب الحالية. حدّث الصفحة."); o.receipt_path = path; return clone(o); }
export async function uploadReceipt(id) { return `${id}/${uuid()}.jpg`; }
export async function receiptUrl() { return "data:image/gif;base64,R0lGODlhAQABAIAAAP8AAP///yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=="; }

// ── OneSignal + إحصاءات المشرف ──
export async function linkOneSignalPlayer() {}
export async function unlinkOneSignalPlayer() {}
export async function adminUserStats() {
  need(db.profiles[uid]?.role === "admin", "ليست لديك صلاحية لهذا الإجراء.", "42501");
  const all = Object.values(db.profiles);
  return { total_users: all.length, new_24h: all.length, new_7d: all.length, active_24h: 1, active_7d: 1, active_30d: all.length, push_devices: 0, push_users: 0 };
}
