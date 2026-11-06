import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// الملفات كلها في جذر المشروع (بدون مجلدات)، فننسخ الأيقونة وملف التثبيت إلى dist عند البناء.
const copyStatic = () => ({
  name: "copy-static",
  closeBundle() {
    for (const f of ["icon.svg", "manifest.webmanifest", "sw.js", "OneSignalSDKWorker.js", "OneSignalSDK.sw.js", "service-worker.js"]) {
      if (fs.existsSync(f)) fs.copyFileSync(f, path.join("dist", f));
    }
  },
});

export default defineConfig({
  plugins: [react(), copyStatic()],
  build: { sourcemap: false, target: "es2020" },
});
