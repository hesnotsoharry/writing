// Headless MP4 export: node export.mjs [out.mp4]  (then: node verify.mjs to decode-check it)
// Runs the page's frame-exact exporter in headless Chrome and pulls the file back in base64 slices.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { openPage } from './cdp.mjs';

const out = resolve(process.argv[2] || 'out/writersnook-ad-1080x1920.mp4');
const page = await openPage(pathToFileURL(resolve(import.meta.dirname, 'index.html')).href + '?ui=0&s=2');
try {
  await page.waitFor('typeof window.__exportMp4 === "function"');
  const t0 = Date.now();
  const size = await page.evaluate(`(async () => {
    const buf = new Uint8Array(await (await window.__exportMp4()).arrayBuffer());
    window.__mp4 = buf;
    return buf.length;
  })()`);
  console.log(`encoded ${(size / 1e6).toFixed(1)} MB in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const SLICE = 4 * 1024 * 1024, parts = [];
  for (let o = 0; o < size; o += SLICE) {
    const b64 = await page.evaluate(`(() => { const s = window.__mp4.subarray(${o}, ${o + SLICE}); let bin = ''; for (let i = 0; i < s.length; i += 0x8000) bin += String.fromCharCode.apply(null, s.subarray(i, i + 0x8000)); return btoa(bin); })()`);
    parts.push(Buffer.from(b64, 'base64'));
  }
  writeFileSync(out, Buffer.concat(parts));
  console.log(out);
} finally {
  page.close();
}
