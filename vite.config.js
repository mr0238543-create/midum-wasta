import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ROOT = process.cwd();
const STATIC = ["OneSignalSDKWorker.js", "apple-touch-icon.png", "favicon-32.png", "favicon.ico", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "manifest.json", "manifest.webmanifest", "service-worker.js", "sw.js"];

// الملفات كلها في جذر المشروع (بدون مجلدات)، فننسخ الأيقونات وملف التثبيت وعمّال الخدمة إلى dist عند البناء.
const copyStatic = () => ({
  name: "copy-static",
  closeBundle() {
    for (const f of STATIC) if (fs.existsSync(f)) fs.copyFileSync(f, path.join("dist", f));
  },
});

// حماية من الرفع الخاطئ: لو وصل ملف بمسارات المجلدات ("../api" أو "./screens/X") داخل مشروع مسطّح،
// نحلّها إلى الملف الموجود في الجذر بدل أن يفشل البناء. لا تعمل إن وُجد مجلد src (الهيكل الكامل).
const flatResolve = () => ({
  name: "flat-resolve",
  enforce: "pre",
  resolveId(source, importer) {
    if (!importer || fs.existsSync(path.join(ROOT, "src"))) return null;
    const m = /^\.\.?\/(?:screens\/)?([\w-]+)(\.(?:jsx|js))?$/.exec(source);
    if (!m) return null;
    if (path.dirname(importer.split("?")[0]) !== ROOT) return null;
    for (const ext of m[2] ? [m[2]] : [".jsx", ".js"]) {
      const f = path.join(ROOT, m[1] + ext);
      if (fs.existsSync(f)) return f;
    }
    return null;
  },
});

// يبقي رابط ملف التثبيت ثابتًا (/manifest.webmanifest) بعد البناء حتى لا يضيع تحديث الاسم والأيقونة عند من ثبّتوا التطبيق،
// فـ Vite قد يعيد تسميته بـ hash.
const stableManifest = () => ({
  name: "stable-manifest",
  transformIndexHtml: {
    order: "post",
    handler: (html) => html.replace(/<link\b[^>]*\brel=["']manifest["'][^>]*>/i, '<link rel="manifest" href="/manifest.webmanifest" />'),
  },
});

export default defineConfig({
  plugins: [flatResolve(), react(), copyStatic(), stableManifest()],
  build: { sourcemap: false, target: "es2020" },
});
