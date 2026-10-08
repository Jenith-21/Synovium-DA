import { build } from "vite";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dashboard = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(dashboard, ".html-build");
const destination = resolve(dashboard, "..", process.argv[2] || "Synovium Analytics.html");

await build({
  root: dashboard,
  configFile: resolve(dashboard, "vite.config.js"),
  base: "./",
  build: { outDir, emptyOutDir: true },
  logLevel: "warn",
});

let html = readFileSync(resolve(outDir, "index.html"), "utf8");
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const css = readFileSync(resolve(outDir, href), "utf8").replace(/<\/style/gi, "<\\/style");
  return `<style>\n${css}\n</style>`;
});
html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
  const code = readFileSync(resolve(outDir, src), "utf8").replace(/<\/script/gi, "<\\/script");
  return `<script type="module">\n${code}\n</script>`;
});
html = html.replace(/<link rel="modulepreload"[^>]*>/g, "");
html = html.replace(/<link rel="icon"[^>]*>\s*/g, "");

writeFileSync(destination, html);
rmSync(outDir, { recursive: true, force: true });
console.log(destination);
