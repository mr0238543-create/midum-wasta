// اختبار شامل للواجهة في Chromium حقيقي مع خادم وهمي. التشغيل: node build.mjs && node e2e.mjs
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
const { chromium } = require(execSync("npm root -g").toString().trim() + "/playwright");

fs.writeFileSync(path.join(here, "out/index.html"),
  `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="bundle.css"></head><body><div id="root"></div><script src="bundle.js"></script></body></html>`);

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ar-EG" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("file://" + path.join(here, "out/index.html"));
await page.waitForSelector(".tabbar");

const results = [];
const T = 4000;
async function step(name, fn) {
  try { await fn(); results.push([true, name]); console.log("PASS", name); }
  catch (e) {
    results.push([false, name, e.message.split("\n")[0]]); console.log("FAIL", name, "→", e.message.split("\n")[0]);
    await page.screenshot({ path: path.join(here, "out", `fail-${results.length}.png`) }).catch(() => {});
  }
}
const go = (h) => page.evaluate((x) => { location.hash = x; }, h);
const see = (t, o = {}) => page.getByText(t, { exact: false }).first().waitFor({ timeout: T, ...o }).catch(() => { throw new Error("لم يظهر النص: " + t); });
const gone = (t) => page.getByText(t, { exact: false }).first().waitFor({ state: "detached", timeout: T });
const click = (t) => page.getByRole("button", { name: t }).first().click({ timeout: T }).catch(() => { throw new Error("تعذّر الضغط على: " + t); });
const shot = (n) => page.screenshot({ path: path.join(here, "out", n + ".png") });
const mock = (f, ...a) => page.evaluate(([fn, args]) => window.__mock[fn](...args), [f, a]);
const lastSheet = () => page.locator(".overlay").last();
const as = async (phone, name) => { await mock("signInAs", phone, name); await page.waitForTimeout(150); };
const A = "201012345678", B = "201055555555", ADMIN = "201000000003";
let bizId;

await step("1. الرئيسية: العنوان، البحث، ١٣ قسمًا + الوظائف، الشريط السفلي", async () => {
  await see("ميدوم والواسطي"); await see("تصفح الأقسام");
  await page.getByPlaceholder("ابحث عن مطعم، محل، خدمة، وظيفة…").waitFor({ timeout: T });
  if ((await page.locator(".cat").count()) !== 14) throw new Error("expected 14 categories");
  for (const t of ["الرئيسية", "الأقسام", "طلباتي", "محادثاتي", "حسابي"]) await page.locator(".tabbar").getByText(t, { exact: true }).waitFor({ timeout: T });
  if ((await page.evaluate(() => document.documentElement.scrollWidth)) > 392) throw new Error("horizontal overflow");
  await shot("01-home");
});
await step("2. زائر: صفحات محمية تحوّل لتسجيل الدخول", async () => {
  await go("/add"); await see("رقم الموبايل");
  await go("/requests"); await see("رقم الموبايل");
});
await step("3. تسجيل الدخول: رقم خاطئ / فشل الإرسال / رمز خاطئ / نجاح + اسم", async () => {
  await go("/login?next=%2Fadd");
  const phone = page.getByLabel("رقم الموبايل");
  await phone.fill("123"); await click("إرسال الرمز"); await see("اكتب رقم موبايل مصري صحيح");
  await phone.fill("01099999999"); await click("إرسال الرمز"); await see("تعذّر إرسال رسالة التحقق");
  await phone.fill("٠١٠١٢٣٤٥٦٧٨"); await click("إرسال الرمز"); await see("أرسلنا رمزًا");
  const otp = page.getByLabel("رمز التحقق");
  await otp.fill("111111"); await click("تأكيد ودخول"); await see("رمز التحقق غير صحيح");
  await otp.fill("123456"); await click("تأكيد ودخول"); await see("أكمل بياناتك");
  await click("ابدأ"); await see("الاسم (حرفان على الأقل)".slice(0, 4) && "اكتب اسمك");
  await page.getByPlaceholder("مثال: أحمد علي").fill("أحمد علي"); await click("ابدأ");
  await see("أضف نشاطك"); // التحويل إلى next
  await shot("02-add-form");
});
await step("4. نموذج النشاط: تحقق من الحقول ثم إرسال مع صورة", async () => {
  await click("إرسال للمراجعة");
  await see("اسم النشاط من ٣ إلى ٨٠ حرفًا"); await see("يجب الموافقة على الشروط");
  await page.getByPlaceholder("مثال: بوتيك الأناقة").fill("محل النخيل للعطارة");
  await page.locator("select").nth(0).selectOption("shops");
  await page.getByPlaceholder("مثال: ملابس رجالي وحريمي").fill("عطارة وتوابل");
  await page.locator("select").nth(1).selectOption({ label: "بني أحمد — مركز الواسطى" });
  await page.locator('input[inputmode="tel"]').fill("٠١٠٩٨٧٦٥٤٣٢");
  await page.getByPlaceholder("الشارع وأقرب علامة مميزة").fill("بجوار المدرسة الإعدادية");
  await page.getByPlaceholder("مثال: ١٠ ص – ١٠ م").fill("٩ ص – ٩ م");
  await page.getByPlaceholder("اكتب ما تقدمه وما يميّزك").fill("أعشاب وتوابل وبهارات طازجة");
  await page.locator('input[type=file]').setInputFiles({ name: "shop.png", mimeType: "image/png", buffer: PNG });
  await page.locator(".photo img").first().waitFor({ timeout: T });
  await page.getByLabel("رابط الموقع").fill("https://www.google.com/maps/@29.3000,31.1000,17z"); await click("تطبيق");
  await page.locator("iframe.map").waitFor({ timeout: T });
  await page.getByRole("checkbox", { name: /أقرّ/ }).check();
  await click("إرسال للمراجعة");
  await see("قيد المراجعة"); await see("محل النخيل للعطارة");
  bizId = await page.evaluate(() => window.__mock.db().businesses[0].id);
  await shot("03-my-pending");
});
await step("5. النشاط قيد المراجعة لا يظهر للزائر ولا لمستخدم آخر", async () => {
  await mock("signOutNow"); await page.waitForTimeout(300); await go("/search?q=عطارة"); await see("لا توجد نتائج مطابقة");
  await go("/b/" + bizId); await see("لم نجد هذا النشاط");
  await as(B, "سارة محمود"); await go("/b/" + bizId); await see("لم نجد هذا النشاط");
});
await step("6. المشرف: طلب تعديل بسبب إلزامي", async () => {
  await as(ADMIN); await go("/admin"); await see("لوحة المشرف"); await see("الأنشطة (١)");
  await see("محل النخيل للعطارة"); await see("بجوار المدرسة الإعدادية");
  await shot("04-admin");
  await page.locator(".card").filter({ hasText: "محل النخيل" }).getByRole("button", { name: "طلب تعديل" }).click();
  await lastSheet().getByRole("button", { name: "طلب تعديل" }).click(); await see("هذا الحقل مطلوب");
  await lastSheet().locator("textarea").fill("أضف صورة أوضح للمحل");
  await lastSheet().getByRole("button", { name: "طلب تعديل" }).click();
  await see("تم تنفيذ الإجراء");
});
await step("7. صاحب النشاط يرى الملاحظة ويعدّل ويعيد الإرسال", async () => {
  await as(A); await go("/my"); await see("مطلوب تعديل"); await see("أضف صورة أوضح للمحل");
  await click("تعديل وإعادة إرسال"); await see("ملاحظة المشرف");
  await page.getByPlaceholder("اكتب ما تقدمه وما يميّزك").fill("أعشاب وتوابل وبهارات طازجة ومنتجات طبيعية");
  await click("حفظ وإعادة الإرسال"); await see("قيد المراجعة");
});
await step("8. المشرف يعتمد → يظهر في البحث العربي (عطاره ↔ عطارة) وفي أحدث الأنشطة", async () => {
  await as(ADMIN); await go("/admin"); await see("الأنشطة (١)");
  await page.locator(".card").filter({ hasText: "محل النخيل" }).getByRole("button", { name: "اعتماد" }).click();
  await lastSheet().getByRole("button", { name: "اعتماد" }).click(); await see("تم تنفيذ الإجراء");
  await mock("signOutNow"); await page.waitForTimeout(300); await go("/search?q=عطاره"); await see("محل النخيل للعطارة");
  await go("/search?q=بني احمد"); await see("محل النخيل للعطارة");
  await go("/"); await see("أحدث الأنشطة"); await see("محل النخيل للعطارة");
});
await step("9. زائر يفتح الصفحة: الهاتف ظاهر، المحادثة تطلب تسجيل دخول", async () => {
  await go("/b/" + bizId); await see("أعشاب وتوابل"); await see("٠١٠٩٨٧٦٥٤٣٢");
  await page.locator(".gallery, .hero img").first().waitFor({ timeout: T });
  await click("محادثة"); await see("رقم الموبايل");
});
await step("10. مستخدم: تقييم + مفضلة + طلب خدمة + محادثة + بلاغ", async () => {
  await as(B); await go("/b/" + bizId); await see("محل النخيل للعطارة");
  await click("أضف تقييمك"); await page.getByRole("radio", { name: "٥ نجوم" }).click();
  await lastSheet().locator("textarea").fill("خدمة ممتازة وأسعار مناسبة"); await click("حفظ التقييم");
  await see("(١ تقييم)"); await see("خدمة ممتازة وأسعار مناسبة");
  await page.getByLabel("إضافة للمفضلة").click(); await see("أُضيف إلى المفضلة");
  await click("إرسال طلب خدمة أو استفسار");
  await lastSheet().getByRole("button", { name: "إرسال الطلب" }).click(); await see("٥ أحرف على الأقل");
  await lastSheet().locator("textarea").fill("أريد ٢ كيلو يانسون وحلبة"); await lastSheet().getByRole("checkbox").check();
  await lastSheet().getByRole("button", { name: "إرسال الطلب" }).click();
  await see("تفاصيل الطلب"); await see("تم الإرسال"); await see("أريد ٢ كيلو يانسون");
  await go("/b/" + bizId); await click("محادثة"); await see("اكتب رسالتك الأولى");
  await page.getByLabel("الرسالة").fill("هل التوصيل متاح لكفر الشيخ؟"); await click("إرسال");
  await page.locator(".msg.me").filter({ hasText: "هل التوصيل متاح" }).waitFor({ timeout: T });
  await shot("05-chat");
  await go("/b/" + bizId); await click("الإبلاغ عن هذا النشاط");
  await lastSheet().getByRole("button", { name: "إرسال البلاغ" }).click();
  await lastSheet().getByRole("button", { name: "إرسال البلاغ" }).click(); await see("وصلنا بلاغك");
  await go("/favorites"); await see("محل النخيل للعطارة");
  await shot("06-business");
});
await step("11. صاحب النشاط: إشعارات، عدّاد المحادثات، قبول الطلب، رد فوري Realtime", async () => {
  await as(A); await go("/"); await page.locator(".dot").first().waitFor({ timeout: T });
  await page.locator(".tabbar .badge-dot").waitFor({ timeout: T });
  await go("/requests"); await page.getByRole("tab", { name: /واردة على أنشطتي/ }).click(); await page.getByText("أريد ٢ كيلو يانسون").first().click();
  await see("اتصل بالعميل"); await click("قبول الطلب"); await lastSheet().getByRole("button", { name: "قبول الطلب" }).click();
  await see("تم تحديث حالة الطلب"); await see("تم القبول");
  await go("/chats"); await see("عميل لنشاطك"); await page.getByText("هل التوصيل متاح").first().click();
  await page.locator(".msg.them").filter({ hasText: "هل التوصيل متاح" }).waitFor({ timeout: T });
  await page.getByLabel("الرسالة").fill("نعم متاح بعد الظهر"); await click("إرسال");
  const cid = await page.evaluate(() => window.__mock.db().convs[0].id);
  await mock("otherSays", cid, "ممتاز، شكرًا لك");
  await page.locator(".msg.them").filter({ hasText: "ممتاز، شكرًا لك" }).waitFor({ timeout: T });
});
await step("12. المستخدم يرى تحديث طلبه، ولا يمكنه رؤية طلبات غيره", async () => {
  await as(B); await go("/requests"); await see("تم القبول");
  await as("201077777777", "كريم"); await go("/requests"); await see("لا توجد طلبات بعد");
});
await step("13. المشرف: بلاغ → إيقاف النشاط فيختفي من البحث", async () => {
  await as(ADMIN); await go("/admin"); await click("البلاغات"); await see("محتوى غير مناسب".slice(0, 0) || "معلومات خاطئة");
  await page.getByRole("button", { name: "إيقاف المحتوى" }).click();
  await lastSheet().locator("textarea").fill("بيانات غير دقيقة"); await lastSheet().getByRole("button", { name: "إيقاف" }).click();
  await see("تم تنفيذ الإجراء");
  await mock("signOutNow"); await page.waitForTimeout(300); await go("/search?q=عطارة"); await see("لا توجد نتائج مطابقة");
  await as(A); await go("/my"); await see("موقوف"); await see("بيانات غير دقيقة");
});
await step("14. الوظائف: نشر → مراجعة → ظهور للزائر", async () => {
  await as(B); await go("/jobs/new"); await see("انشر فرصة عمل");
  await click("إرسال للمراجعة"); await see("عنوان الوظيفة ٣ أحرف على الأقل");
  await page.getByPlaceholder("مثال: محاسب").fill("محاسب خبرة سنتين");
  await page.getByPlaceholder("اسم الشركة أو المحل").fill("شركة الدلتا للتجارة");
  await page.locator("select").nth(1).selectOption({ label: "الواسطى" });
  await page.locator('input[inputmode="tel"]').fill("01122334455");
  await page.getByPlaceholder("المهام، الشروط، المرتب إن أحببت").fill("إجادة إكسل ومسك الدفاتر");
  await page.getByRole("checkbox").check(); await click("إرسال للمراجعة"); await see("قيد المراجعة");
  await as(ADMIN); await go("/admin"); await click("الوظائف"); await see("محاسب خبرة سنتين");
  await page.getByRole("button", { name: "اعتماد" }).first().click(); await lastSheet().getByRole("button", { name: "اعتماد" }).click();
  await see("تم تنفيذ الإجراء");
  await mock("signOutNow"); await page.waitForTimeout(300); await go("/jobs"); await see("محاسب خبرة سنتين"); await see("اتصال للتقديم");
  await shot("07-jobs");
});
await step("15. المشرف يضيف قسمًا فيظهر في الرئيسية، والمستخدم العادي ممنوع من اللوحة", async () => {
  await as(ADMIN); await go("/admin"); await click("الأقسام"); await click("إضافة قسم جديد");
  const card = page.locator(".card").filter({ has: page.getByRole("button", { name: "إلغاء" }) });
  await card.locator("input").nth(1).fill("المخابز"); await card.locator("input").nth(2).fill("bakery");
  await card.getByRole("button", { name: "إضافة" }).click(); await see("تم الحفظ");
  await mock("signOutNow"); await page.waitForTimeout(300); await go("/"); await see("المخابز");
  await as(B); await go("/admin"); await see("هذه الصفحة للمشرفين فقط");
});
await step("16. الحساب: تعديل الاسم، الخصوصية والشروط، صفحة غير موجودة", async () => {
  await go("/account"); await see("سارة محمود"); await click("تعديل بياناتي");
  await lastSheet().locator("input").first().fill("سارة م."); await lastSheet().getByRole("button", { name: "حفظ" }).click(); await see("تم حفظ بياناتك"); await see("سارة م.");
  await go("/privacy"); await see("البيانات التي نجمعها"); await see("support@example.com");
  await go("/terms"); await see("المحتوى الممنوع");
  await go("/xyz"); await see("الصفحة غير موجودة");
});
await step("17. حذف الحساب نهائيًا وتسجيل الخروج", async () => {
  await go("/account"); await click("حذف حسابي");
  await lastSheet().getByRole("button", { name: "حذف حسابي" }).click(); await see("تم حذف حسابك");
  await see("تصفح الأقسام"); await go("/account");
  await see("سجّل الدخول لتستفيد من كل المزايا");
});
await step("18. بلا أخطاء JavaScript أو تحذيرات console", async () => {
  if (errors.length) throw new Error(errors.slice(0, 3).join(" | "));
});

await browser.close();
const failed = results.filter((r) => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} خطوات نجحت`);
if (failed.length) { failed.forEach((f) => console.log(" ✗", f[1], "—", f[2])); process.exit(1); }
