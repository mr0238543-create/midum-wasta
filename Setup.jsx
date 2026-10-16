import Icon from "./icons";

// تظهر عندما لا تكون متغيّرات البيئة مضبوطة، بدل أن ينهار التطبيق بصمت
export function Setup() {
  return (
    <div className="screen pad" style={{ justifyContent: "center" }}>
      <div className="card">
        <div className="row"><Icon name="info" size={24} style={{ color: "var(--orange)" }} /><h1 className="h2">التطبيق يحتاج إعداد قاعدة البيانات</h1></div>
        <ol className="prose mt12" style={{ paddingInlineStart: 20 }}>
          <li>أنشئ مشروعًا على Supabase وشغّل ملفات SQL الموجودة في <span className="ltr">supabase/</span>.</li>
          <li>انسخ <span className="ltr">.env.example</span> إلى <span className="ltr">.env.local</span> واملأ <span className="ltr">VITE_SUPABASE_URL</span> و<span className="ltr">VITE_SUPABASE_ANON_KEY</span>.</li>
          <li>أعد تشغيل التطبيق. التفاصيل الكاملة في ملف <span className="ltr">README.md</span>.</li>
        </ol>
      </div>
    </div>
  );
}
