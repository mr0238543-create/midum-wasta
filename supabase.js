import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, CONTACT_EMAIL, isConfigured } from "./config";

export { SUPABASE_URL, CONTACT_EMAIL, isConfigured };

// يُعرض شاشة إعداد واضحة بدل انهيار التطبيق إن لم تُضبط المتغيّرات.
// الأمان الفعلي من سياسات قاعدة البيانات (RLS).
export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
