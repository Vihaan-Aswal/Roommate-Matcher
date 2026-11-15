import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const DIST = path.resolve("dist", "assets");
const MAX_JS = 600 * 1024;
const MAX_JS_GZIP = 200 * 1024;

const jsFiles = fs
  .readdirSync(DIST)
  .filter((name) => name.endsWith(".js"))
  .map((name) => {
    const bytes = fs.readFileSync(path.join(DIST, name));
    return { name, bytes: bytes.length, gzip: zlib.gzipSync(bytes).length };
  })
  .sort((a, b) => b.bytes - a.bytes);

if (jsFiles.length === 0) {
  console.error("No JS assets in dist/assets; run npm run build first.");
  process.exit(1);
}

const [largest] = jsFiles;
console.log(
  `largest JS: ${largest.name} ${(largest.bytes / 1024).toFixed(2)} kB ` +
    `(${(largest.gzip / 1024).toFixed(2)} kB gzip); ${jsFiles.length} chunks`,
);

if (largest.bytes > MAX_JS) {
  console.error(`budget failed: ${largest.bytes} > ${MAX_JS} bytes`);
  process.exit(1);
}
if (largest.gzip > MAX_JS_GZIP) {
  console.error(`gzip budget failed: ${largest.gzip} > ${MAX_JS_GZIP} bytes`);
  process.exit(1);
}
console.log("bundle budget passed");
