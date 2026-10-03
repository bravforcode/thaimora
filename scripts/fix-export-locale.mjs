import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
// Static exports share a root layout; emit the correct language before hosting.
const root = path.resolve("out");
let count = 0;
async function visit(dir) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) await visit(file);
    else if (item.name.endsWith(".html")) {
      const locale =
        path.relative(root, file).split(path.sep)[0] === "th" ? "th" : "en";
      const original = await readFile(file, "utf8");
      const html = original.replace(
        /(<html\b[^>]*\blang=")[^"]*(")/,
        `$1${locale}$2`,
      );
      if (html === original && !original.includes(`lang="${locale}"`))
        throw new Error(`Missing document language: ${file}`);
      if (html !== original) await writeFile(file, html, "utf8");
      count++;
    }
  }
}
await visit(root);
console.log(`Checked document language in ${count} exported HTML files.`);
