import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || "";

// يُعرض شاشة إعداد واضحة بدل انهيار التطبيق إن لم تُضبط المتغيّرات
export const isConfigured = Boolean(SUPABASE_URL && ANON_KEY && !SUPABASE_URL.includes("YOUR-PROJECT"));

// المفتاح هنا هو anon العام فقط؛ الأمان الفعلي من سياسات قاعدة البيانات (RLS).
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
