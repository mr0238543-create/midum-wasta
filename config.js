// إعدادات المشروع (بديل ملف .env لأن StackBlitz لا يحفظ الملفات المخفية بعد إعادة الفتح من GitHub).
// المفتاح هنا anon العام فقط، وهو مصمم ليظهر في المتصفح؛ الأمان الحقيقي من سياسات RLS في قاعدة البيانات.
// لا تضع service_role هنا أبدًا.
export const DEFAULTS = {
  SUPABASE_URL: "https://hjorwlxnpzchzvqiojxr.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhqb3J3bHhucHpjaHp2cWlvanhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNDQxNTAsImV4cCI6MjEwNzcyMDE1MH0.GC-9lm28XC04vHjaN3SzuF1XRY8K3wCtXBGbZZz1HhM",
  // المفتاح العام لإشعارات Web Push (VAPID). المفتاح الخاص محفوظ في قاعدة البيانات فقط.
  VAPID_PUBLIC_KEY: "BJf3Uj25qDjo29UxtHayYg5EKe3-_TYH6k3n8DEaBTmx9gAYK9cXK0C3-UX3WgFdVQnhl5IzQ_KqEkp_hfvJthA",
  // اختياري: لو أنشأت تطبيقًا في OneSignal ضع الـ App ID هنا (وإلا يستخدم التطبيق Web Push المباشر).
  ONESIGNAL_APP_ID: "",
  CONTACT_EMAIL: "contact@example.com",
};
