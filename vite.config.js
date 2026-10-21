import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";

// المشروع هنا بدون مجلدات (كل الملفات في الجذر)، فلا يوجد مجلد public.
// هذه الإضافة تخدم الأيقونة والـ manifest في التطوير وتنسخهما إلى dist عند البناء.
const staticFiles = ["icon.svg", "manifest.webmanifest", "sw.js", "OneSignalSDKWorker.js"];
const types = { ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".js": "text/javascript" };
const rootStatic = () => ({
  name: "root-static-files",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const name = (req.url || "").split("?")[0].slice(1);
      if (staticFiles.includes(name)) {
        res.setHeader("Content-Type", types[name.slice(name.lastIndexOf("."))]);
        res.end(fs.readFileSync(name));
      } else next();
    });
  },
  generateBundle() {
    for (const f of staticFiles) {
      this.emitFile({ type: "asset", fileName: f, source: fs.readFileSync(f) });
    }
  },
});

export default defineConfig({
  plugins: [react(), rootStatic()],
  publicDir: false,
  build: { sourcemap: false, target: "es2020" },
});
