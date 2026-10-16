// يبني حزمة اختبار للواجهة: يستبدل src/api.js بالخادم الوهمي و src/supabase.js بنسخة بلا شبكة
import { build } from "/opt/npm-tools/node_modules/esbuild/lib/main.js";
import path from "node:path";
import { execSync } from "node:child_process";
const here = path.dirname(new URL(import.meta.url).pathname);
const root = here;
const G = execSync("npm root -g").toString().trim();
const redirect = {
  name: "redirect",
  setup(b) {
    b.onResolve({ filter: /^(\.\.?\/)+api$/ }, () => ({ path: path.join(here, "mock-api.js") }));
    b.onResolve({ filter: /^(\.\.?\/)+supabase$/ }, () => ({ path: path.join(here, "stub-supabase.js") }));
  },
};
await build({
  entryPoints: [path.join(root, "main.jsx")], bundle: true, format: "iife", jsx: "automatic", outfile: path.join(here, "out/bundle.js"),
  loader: { ".jsx": "jsx", ".js": "jsx" }, minify: false, logLevel: "error", plugins: [redirect],
  alias: { react: `${G}/react`, "react-dom": `${G}/react-dom` },
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env.VITE_TURNSTILE_SITE_KEY": '""', "import.meta.env": "{}" },
});
console.log("bundle ok");
