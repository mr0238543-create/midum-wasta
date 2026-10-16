// طبقة الاتصال بـ Supabase — كل الشاشات تستورد من هنا فقط.
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(message, code, detail) {
    super(message);
    this.code = code;
    this.detail = detail || "";
  }
}

// رسائل قاعدة البيانات (من Triggers/RPC) → عربي مفهوم
const DB_MESSAGES = [
  ["rate_limit_business", "وصلت للحد اليومي لإضافة الأنشطة (٣ في اليوم). حاول غدًا."],
  ["limit_business_total", "وصلت للحد الأقصى من الأنشطة المسموح بها لحساب واحد."],
  ["rate_limit_review", "أرسلت تقييمات كثيرة خلال وقت قصير. حاول بعد قليل."],
  ["rate_limit_request", "وصلت للحد اليومي لإرسال الطلبات."],
  ["rate_limit_message", "أرسلت رسائل كثيرة بسرعة. انتظر قليلًا ثم أعد المحاولة."],
  ["rate_limit_report", "وصلت للحد اليومي للبلاغات."],
  ["rate_limit_job", "وصلت للحد اليومي لنشر الوظائف (٣ في اليوم)."],
  ["cannot_contact", "لا يمكنك مراسلة هذا النشاط."],
  ["note_required", "اكتب السبب أولًا."],
  ["not_authorized", "هذا الإجراء مخصص للمشرفين."],
  ["not_participant", "لا تملك صلاحية الوصول لهذه المحادثة."],
  ["cannot_ban_self", "لا يمكنك حظر نفسك."],
  ["last_admin", "لا يمكن حذف آخر مشرف في النظام. عيّن مشرفًا آخر أولًا."],
];

export function humanize(err) {
  const msg = String(err?.message || err || "");
  for (const [k, v] of DB_MESSAGES) if (msg.includes(k)) return v;
  const code = err?.code;
  if (code === "23505") return "تم هذا الإجراء من قبل.";
  if (code === "23514") return "بعض البيانات غير صالحة. راجع الحقول وأعد المحاولة.";
  if (code === "23503") return "البيانات المرتبطة غير موجودة.";
  if (code === "42501" || /row-level security|permission denied/i.test(msg)) return "ليست لديك صلاحية لهذا الإجراء. سجّل الدخول وحاول مجددًا.";
  if (code === "PGRST301" || /jwt/i.test(msg)) return "انتهت جلستك. سجّل الدخول مرة أخرى.";
  if (/failed to fetch|network|load failed/i.test(msg)) return "تعذّر الاتصال بالإنترنت. تحقق من الشبكة وأعد المحاولة.";
  if (/payload too large|exceeded the maximum/i.test(msg)) return "حجم الملف أكبر من المسموح.";
  if (/mime type|not supported/i.test(msg)) return "نوع الملف غير مسموح.";
  return "حدث خطأ غير متوقع. أعد المحاولة بعد قليل.";
}

function humanizeAuth(err) {
  const msg = String(err?.message || "");
  const status = err?.status;
  if (/invalid|expired|token/i.test(msg)) return "رمز التحقق غير صحيح أو انتهت صلاحيته.";
  if (status === 429 || /rate limit|too many|security purposes/i.test(msg)) return "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.";
  if (/phone|sms|provider|twilio/i.test(msg)) return "تعذّر إرسال رسالة التحقق إلى هذا الرقم. تأكد من الرقم وحاول مجددًا.";
  if (/failed to fetch|network/i.test(msg)) return "تعذّر الاتصال بالإنترنت. تحقق من الشبكة وأعد المحاولة.";
  return "تعذّر تسجيل الدخول. أعد المحاولة.";
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw new ApiError(humanize(error), error.code, error.message);
  return data;
}

// ───────────── الجلسة والحساب ─────────────
export async function sendOtp(e164, captchaToken) {
  const options = { shouldCreateUser: true, channel: "sms" };
  if (captchaToken) options.captchaToken = captchaToken; // اختياري: يُفعَّل مع Cloudflare Turnstile لمنع إساءة استخدام الرسائل
  const { error } = await supabase.auth.signInWithOtp({ phone: e164, options });
  if (error) throw new ApiError(humanizeAuth(error), error.status);
}
export async function verifyOtp(e164, token) {
  const { data, error } = await supabase.auth.verifyOtp({ phone: e164, token, type: "sms" });
  if (error) throw new ApiError(humanizeAuth(error), error.status);
  return data.session;
}
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
export const signOut = () => supabase.auth.signOut();

export const getMyProfile = (uid) => run(supabase.from("profiles").select("*").eq("id", uid).maybeSingle());
export const updateMyProfile = (uid, patch) =>
  run(supabase.from("profiles").update(patch).eq("id", uid).select().single());

// حذف الحساب وكل بياناته (الأنشطة، التقييمات، الطلبات، المحادثات…) — نهائي
export async function deleteMyAccount(uid) {
  try { // حذف صور المستخدم من التخزين أولًا (الجداول تُحذف تلقائيًا بالتسلسل)
    const { data } = await supabase.storage.from("business-photos").list(uid, { limit: 100 });
    if (data?.length) await supabase.storage.from("business-photos").remove(data.map((f) => `${uid}/${f.name}`));
  } catch { /* لا نمنع الحذف بسبب الصور */ }
  await run(supabase.rpc("delete_my_account"));
  await supabase.auth.signOut().catch(() => {});
}

// ───────────── الأقسام والقرى ─────────────
export async function listCategories({ includeHidden = false } = {}) {
  const rows = await run(supabase.from("categories").select("*").order("sort_order"));
  return includeHidden ? rows : rows.filter((c) => c.is_active);
}
export async function listVillages({ includeHidden = false } = {}) {
  const rows = await run(supabase.from("villages").select("*").order("sort_order"));
  return includeHidden ? rows : rows.filter((v) => v.is_active);
}

// ───────────── الأنشطة ─────────────
export const searchBusinesses = (o = {}) =>
  run(
    supabase.rpc("search_businesses", {
      q: o.q || null,
      p_category: o.category || null,
      p_village: o.village ? Number(o.village) : null,
      p_region: o.region || null,
      p_min_rating: o.minRating || 0,
      p_sort: o.sort || "newest",
      p_lat: o.lat ?? null,
      p_lng: o.lng ?? null,
      p_limit: o.limit || 20,
      p_offset: o.offset || 0,
    })
  );
export const getBusiness = (id) => run(supabase.from("business_public").select("*").eq("id", id).maybeSingle());

export const listMyBusinesses = (uid) =>
  run(supabase.from("businesses").select("*").eq("owner_id", uid).order("created_at", { ascending: false }));
export const getMyBusiness = (id) => run(supabase.from("businesses").select("*").eq("id", id).maybeSingle());
export const createBusiness = (fields) => run(supabase.from("businesses").insert(fields).select().single());
export const updateBusiness = (id, patch) => run(supabase.from("businesses").update(patch).eq("id", id).select().single());
export const deleteBusiness = (id) => run(supabase.from("businesses").delete().eq("id", id));

// ───────────── الصور ─────────────
const BUCKET = "business-photos";
export async function uploadPhoto(uid, blob) {
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg", cacheControl: "31536000", upsert: false,
  });
  if (error) throw new ApiError(humanize(error), error.statusCode);
  return path;
}
export const photoUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
export async function removePhotos(paths) {
  if (paths?.length) await supabase.storage.from(BUCKET).remove(paths);
}

// ───────────── التقييمات ─────────────
export const listReviews = (businessId) =>
  run(supabase.from("reviews_public").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(50));
export const getMyReview = (businessId, uid) =>
  run(supabase.from("reviews").select("*").eq("business_id", businessId).eq("user_id", uid).maybeSingle());
export async function saveReview({ businessId, uid, rating, comment }) {
  const existing = await getMyReview(businessId, uid);
  const body = { rating, comment: comment?.trim() || null };
  if (existing) return run(supabase.from("reviews").update(body).eq("id", existing.id).select().single());
  return run(supabase.from("reviews").insert({ business_id: businessId, ...body }).select().single());
}
export const deleteMyReview = (id) => run(supabase.from("reviews").delete().eq("id", id));

// ───────────── المفضلة ─────────────
export async function listFavoriteIds() {
  const rows = await run(supabase.from("favorites").select("business_id"));
  return rows.map((r) => r.business_id);
}
export async function setFavorite(businessId, on) {
  if (on) {
    const { error } = await supabase.from("favorites").insert({ business_id: businessId });
    if (error && error.code !== "23505") throw new ApiError(humanize(error), error.code, error.message);
  } else {
    await run(supabase.from("favorites").delete().eq("business_id", businessId));
  }
}
export async function listFavorites() {
  const ids = await listFavoriteIds();
  if (!ids.length) return [];
  return run(supabase.from("business_public").select("*").in("id", ids));
}

// ───────────── الطلبات ─────────────
export const createRequest = ({ businessId, kind, message, sharePhone }) =>
  run(supabase.from("service_requests").insert({ business_id: businessId, kind, message, share_phone: !!sharePhone }).select().single());
export const listMyRequests = (uid) =>
  run(supabase.from("service_requests").select("*").eq("user_id", uid).order("created_at", { ascending: false }));
export async function listIncomingRequests(businessIds) {
  if (!businessIds.length) return [];
  return run(supabase.from("service_requests").select("*").in("business_id", businessIds).order("created_at", { ascending: false }));
}
export const getRequest = (id) => run(supabase.from("service_requests").select("*").eq("id", id).maybeSingle());
export const updateRequestStatus = (id, status) =>
  run(supabase.from("service_requests").update({ status }).eq("id", id).select().single());

// ───────────── المحادثات ─────────────
export const startConversation = (businessId) => run(supabase.rpc("start_conversation", { p_business: businessId }));
export const myConversations = () => run(supabase.rpc("my_conversations"));
export const listMessages = (cid) =>
  run(supabase.from("messages").select("*").eq("conversation_id", cid).order("created_at", { ascending: true }).limit(300));
export const sendMessage = (cid, body) =>
  run(supabase.from("messages").insert({ conversation_id: cid, body }).select().single());
export const markConversationRead = (cid) => run(supabase.rpc("mark_conversation_read", { p_conversation: cid }));
export function subscribeMessages(cid, onInsert) {
  const ch = supabase
    .channel(`messages:${cid}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${cid}` }, (p) => onInsert(p.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ───────────── الإشعارات ─────────────
export const listNotifications = () =>
  run(supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50));
export async function countUnreadNotifications() {
  const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
  if (error) throw new ApiError(humanize(error), error.code, error.message);
  return count || 0;
}
export const markAllNotificationsRead = () => run(supabase.from("notifications").update({ is_read: true }).eq("is_read", false));
export const markNotificationRead = (id) => run(supabase.from("notifications").update({ is_read: true }).eq("id", id));
export function subscribeNotifications(uid, onInsert) {
  const ch = supabase
    .channel(`notifications:${uid}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (p) => onInsert(p.new))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ───────────── البلاغات ─────────────
export const reportTarget = ({ type, id, reason, details }) =>
  run(supabase.from("reports").insert({ target_type: type, target_id: id, reason, details: details?.trim() || null }));

// ───────────── الوظائف ─────────────
export const listJobs = ({ village } = {}) => {
  let q = supabase.from("jobs_public").select("*").order("created_at", { ascending: false }).limit(100);
  if (village) q = q.eq("village_id", Number(village));
  return run(q);
};
export const listMyJobs = (uid) =>
  run(supabase.from("job_posts").select("*").eq("poster_id", uid).order("created_at", { ascending: false }));
export const createJob = (fields) => run(supabase.from("job_posts").insert(fields).select().single());
export const updateJob = (id, patch) => run(supabase.from("job_posts").update(patch).eq("id", id).select().single());
export const deleteJob = (id) => run(supabase.from("job_posts").delete().eq("id", id));

// ───────────── المشرف ─────────────
export async function adminCounts() {
  const rows = await run(supabase.rpc("admin_counts"));
  return rows?.[0] || { pending_businesses: 0, pending_jobs: 0, open_reports: 0 };
}
export const adminListBusinesses = (status) => {
  let q = supabase.from("businesses").select("*").order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  return run(q);
};
export const adminModerateBusiness = (id, action, note) =>
  run(supabase.rpc("admin_moderate_business", { p_id: id, p_action: action, p_note: note || null }));
export const adminListJobs = (status) => {
  let q = supabase.from("job_posts").select("*").order("created_at", { ascending: false }).limit(100);
  if (status) q = q.eq("status", status);
  return run(q);
};
export const adminModerateJob = (id, action, note) =>
  run(supabase.rpc("admin_moderate_job", { p_id: id, p_action: action, p_note: note || null }));

// البلاغات مع ملخص الهدف ومعرّف صاحبه (لإمكانية الحظر)
export async function adminListReports(status = "open") {
  const reports = await run(supabase.from("reports").select("*").eq("status", status).order("created_at", { ascending: false }).limit(100));
  const ids = (t) => reports.filter((r) => r.target_type === t).map((r) => r.target_id);
  const [biz, rev, job] = await Promise.all([
    ids("business").length ? run(supabase.from("businesses").select("id,name,status,owner_id").in("id", ids("business"))) : [],
    ids("review").length ? run(supabase.from("reviews").select("id,comment,rating,user_id,business_id").in("id", ids("review"))) : [],
    ids("job").length ? run(supabase.from("job_posts").select("id,title,status,poster_id").in("id", ids("job"))) : [],
  ]);
  const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
  const B = byId(biz), R = byId(rev), J = byId(job);
  return reports.map((r) => {
    let target = null, offender = null, label = "";
    if (r.target_type === "business") { target = B[r.target_id]; label = target?.name; offender = target?.owner_id; }
    if (r.target_type === "review") { target = R[r.target_id]; label = target ? `${"★".repeat(target.rating)} ${target.comment || ""}` : ""; offender = target?.user_id; }
    if (r.target_type === "job") { target = J[r.target_id]; label = target?.title; offender = target?.poster_id; }
    return { ...r, target, label: label || "(محتوى محذوف)", offender };
  });
}
export const adminHandleReport = (id, action, note) =>
  run(supabase.rpc("admin_handle_report", { p_id: id, p_action: action, p_note: note || null }));
export const adminSetBanned = (uid, banned) => run(supabase.rpc("admin_set_banned", { p_user: uid, p_banned: banned }));
// بيانات أصحاب المحتوى (الاسم والهاتف) لمساعدة المشرف في المراجعة — المشرف فقط يقرأها عبر RLS
export async function adminProfiles(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {};
  const rows = await run(supabase.from("profiles").select("id,full_name,phone,is_banned").in("id", uniq));
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}
export const adminSaveCategory = (row) => run(supabase.from("categories").upsert(row).select().single());
export const adminSaveVillage = (row) => run(supabase.from("villages").upsert(row).select().single());
