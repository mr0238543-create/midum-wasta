// إعدادات التطبيق من متغيّرات البيئة (Vercel ← Settings ← Environment Variables، أو ملف .env.local محليًا).
// المفتاح هنا هو anon العام فقط؛ لا تضع service_role في الواجهة أبدًا.
const env = import.meta.env;

export const SUPABASE_URL = env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || "";
export const CONTACT_EMAIL = env.VITE_CONTACT_EMAIL || "";
export const TURNSTILE_SITE_KEY = env.VITE_TURNSTILE_SITE_KEY || "";

export const isConfigured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes("YOUR-PROJECT")
);
