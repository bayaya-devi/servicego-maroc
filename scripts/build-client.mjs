import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
await build({
  entryPoints: [path.join(publicDir, "app.js")],
  format: "esm",
  target: "es2022",
  charset: "utf8",
  minify: true,
  outfile: path.join(publicDir, "app.min.js"),
});

await Promise.all(["i18n", "photo-catalog", "globe"].map((name) => build({
  entryPoints: [path.join(publicDir, `${name}.js`)],
  format: "esm",
  target: "es2022",
  charset: "utf8",
  minify: true,
  outfile: path.join(publicDir, `${name}.min.js`),
})));

const appOutput = path.join(publicDir, "app.min.js");
const minifiedApp = (await readFile(appOutput, "utf8"))
  .replaceAll('"/i18n.js"', '"/i18n.min.js"')
  .replaceAll('"/photo-catalog.js"', '"/photo-catalog.min.js"')
  .replaceAll('"/globe.js"', '"/globe.min.js"');
await writeFile(appOutput, minifiedApp);

await Promise.all(["tokens", "styles", "premium"].map((name) => build({
  entryPoints: [path.join(publicDir, `${name}.css`)],
  minify: true,
  charset: "utf8",
  outfile: path.join(publicDir, `${name}.min.css`),
})));
