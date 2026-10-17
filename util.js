// أدوات مساعدة: أرقام عربية، هواتف مصرية، أوقات، تسميات الحالات

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const toAr = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
export const toLatinDigits = (s) =>
  String(s ?? "")
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06f0);

// رقم محلي بصيغة 01XXXXXXXXX (أو أرضي 0XXXXXXXXX) من أي صيغة يكتبها المستخدم
export function normalizePhone(input) {
  let s = toLatinDigits(input).replace(/[\s\-()]/g, "");
  if (s.startsWith("+20")) s = "0" + s.slice(3);
  else if (s.startsWith("0020")) s = "0" + s.slice(4);
  else if (s.startsWith("20") && s.length === 12) s = "0" + s.slice(2);
  return s;
}
export const isEgMobile = (local) => /^01[0125]\d{8}$/.test(local);
export const isValidPhone = (local) => /^0\d{8,10}$/.test(local);
export const toE164 = (local) => "+20" + local.slice(1);
// سعر بالجنيه: بدون كسور إن كان صحيحًا، مع فاصل الآلاف
export function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const txt = n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${toAr(txt).replace(/,/g, "٬").replace(/\./g, "٫")} ج.م`;
}
// يقرأ سعرًا يكتبه المستخدم (أرقام عربية أو لاتينية، فاصلة عشرية اختيارية) ويعيد رقمًا أو null
export function parsePrice(input) {
  if (/-|−/.test(String(input))) return null;
  const s = toLatinDigits(input).replace(/[٫,]/g, ".").replace(/[^\d.]/g, "");
  if (!s || (s.match(/\./g) || []).length > 1) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 10000000 ? Math.round(n * 100) / 100 : null;
}
export const phoneLabel = (local) => (local ? toAr(local) : "");

export function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60);
  if (m < 60) return `منذ ${toAr(m)} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${toAr(h)} س`;
  const d = Math.floor(h / 24);
  if (d < 30) return `منذ ${toAr(d)} يوم`;
  return new Date(iso).toLocaleDateString("ar-EG");
}

export const fmtRating = (r) => toAr(Number(r || 0).toFixed(1));
export const fmtKm = (km) =>
  km == null ? "" : km < 1 ? `${toAr(Math.round(km * 1000))} م` : `${toAr(km.toFixed(1))} كم`;

export const BUSINESS_STATUS = {
  pending: { label: "قيد المراجعة", tone: "warn", hint: "نراجع نشاطك، وسيظهر للجميع بعد الموافقة." },
  approved: { label: "معتمد", tone: "ok", hint: "نشاطك ظاهر للجميع." },
  rejected: { label: "مرفوض", tone: "bad", hint: "تم رفض النشاط. راجع السبب وعدّل ثم أعد الإرسال." },
  changes_requested: { label: "مطلوب تعديل", tone: "warn", hint: "المشرف طلب تعديلات. عدّل ثم أعد الإرسال." },
  suspended: { label: "موقوف", tone: "bad", hint: "تم إيقاف النشاط. تواصل معنا إن كنت تراه خطأ." },
};
export const JOB_STATUS = {
  pending: BUSINESS_STATUS.pending,
  approved: BUSINESS_STATUS.approved,
  rejected: BUSINESS_STATUS.rejected,
  suspended: BUSINESS_STATUS.suspended,
};
export const REQUEST_STATUS = {
  new: { label: "تم الإرسال", tone: "warn" },
  accepted: { label: "تم القبول", tone: "ok" },
  in_progress: { label: "جارٍ التنفيذ", tone: "ok" },
  completed: { label: "مكتمل", tone: "ok" },
  declined: { label: "تعذّر القبول", tone: "bad" },
  cancelled: { label: "ملغي", tone: "mute" },
};
export const JOB_TYPES = { full: "دوام كامل", part: "دوام جزئي", temp: "مؤقت", freelance: "عمل حر" };
export const REPORT_REASONS = {
  wrong_info: "معلومات خاطئة",
  inappropriate: "محتوى غير مناسب",
  spam: "إعلان مزعج / مكرر",
  closed: "النشاط مغلق أو غير موجود",
  other: "سبب آخر",
};

// رابط الاتجاهات في خرائط جوجل
export function directionsUrl(b, villageName) {
  if (b.lat != null && b.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
  }
  const q = encodeURIComponent(`${b.name} ${villageName || ""} مصر`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
export function osmEmbedUrl(lat, lng) {
  const d = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
}
export const shareUrl = (path) => `${location.origin}${location.pathname}#${path}`;

// صورة → JPEG مضغوط (التحقق من النوع والحجم قبل الرفع)
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export async function processImage(file, max = 1280) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error("نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WebP.");
  if (file.size > MAX_INPUT_BYTES) throw new Error("حجم الصورة كبير جدًا (الحد الأقصى ١٠ ميجا).");
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("تعذّر قراءة الصورة، جرّب صورة أخرى.");
  }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.82, blob;
  do {
    blob = await new Promise((res) => c.toBlob(res, "image/jpeg", q));
    q -= 0.12;
  } while (blob && blob.size > MAX_OUTPUT_BYTES && q > 0.3);
  if (!blob || blob.size > MAX_OUTPUT_BYTES) throw new Error("تعذّر ضغط الصورة إلى الحجم المسموح.");
  return blob;
}

// يستخرج (خط العرض، خط الطول) من رابط خرائط جوجل أو من نص «lat, lng». يرجع null إن لم يجد.
// ملاحظة: الروابط المختصرة (maps.app.goo.gl) لا يمكن فتحها من المتصفح؛ يُنصح بلصق الرابط الطويل أو الإحداثيات.
export function parseLatLng(text) {
  const s = toLatinDigits(String(text || "")).replace(/٫/g, ".").replace(/٬|،/g, ",");
  const pats = [
    /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/,
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,
    /[?&](?:q|ll|query|destination)=(-?\d{1,3}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i,
    /^\s*(-?\d{1,3}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)\s*$/,
  ];
  for (const re of pats) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]), lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}
// حدود تقريبية لمصر — لاكتشاف الإحداثيات الخاطئة
export const inEgypt = ({ lat, lng }) => lat >= 21.5 && lat <= 32 && lng >= 24.5 && lng <= 37;

// ───────────── الشراء والدفع ─────────────
export const PAYMENT_METHODS = {
  cod: { label: "الدفع عند الاستلام", icon: "💵" },
  vodafone_cash: { label: "فودافون كاش", icon: "🔴" },
  etisalat_cash: { label: "اتصالات كاش", icon: "🟢" },
  orange_cash: { label: "أورنج كاش", icon: "🟠" },
  instapay: { label: "إنستا باي", icon: "🏦" },
};
export const WALLET_METHODS = ["vodafone_cash", "etisalat_cash", "orange_cash", "instapay"];
export const ORDER_STATUS = {
  new: { label: "بانتظار القبول", tone: "warn" },
  accepted: { label: "تم القبول", tone: "ok" },
  shipped: { label: "في الطريق", tone: "ok" },
  delivered: { label: "تم التسليم", tone: "ok" },
  rejected: { label: "مرفوض", tone: "bad" },
  cancelled: { label: "ملغي", tone: "mute" },
};
export const isMobilePhone = (local) => /^01[0125]\d{8}$/.test(local);
// رابط واتساب لرقم مصري محلي (01XXXXXXXXX)
export const waLink = (local, text = "") => `https://wa.me/20${local.slice(1)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
