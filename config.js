// إعدادات التطبيق من متغيّرات البيئة (Vercel ← Settings ← Environment Variables، أو ملف .env.local محليًا).
// المفتاح هنا هو anon العام فقط؛ لا تضع service_role في الواجهة أبدًا.
const env = import.meta.env;

export const SUPABASE_URL = env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || "";
export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL || "";
export const TURNSTILE_SITE_KEY = env.VITE_TURNSTILE_SITE_KEY || "";

// معرّف تطبيق OneSignal (عام وغير سري). المفتاح السري يبقى في Supabase فقط.
export const ONESIGNAL_APP_ID = env.VITE_ONESIGNAL_APP_ID || "2b7b8007-ebe9-4033-95d6-4da8a863e25c";

export const isConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("YOUR-PROJECT")
);
