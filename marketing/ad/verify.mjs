// Decode check for an exported MP4: node verify.mjs [file.mp4] -> prints duration/size, writes out/verify.png
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { openPage } from './cdp.mjs';

const file = resolve(process.argv[2] || 'out/writersnook-ad-1080x1920.mp4');
const page = await openPage(pathToFileURL(resolve(import.meta.dirname, 'verify.html')).href + '?src=' + encodeURIComponent(pathToFileURL(file).href));
try {
  await page.waitFor('window.__done', 30000);
  console.log(await page.evaluate('window.__done'));
  console.log('rms dBFS per 0.5s:', await page.evaluate('window.__env || ""'));
  const png = await page.evaluate('document.getElementById("c").toDataURL("image/png").split(",")[1]');
  writeFileSync(resolve(import.meta.dirname, 'out/verify.png'), Buffer.from(png, 'base64'));
} finally {
  page.close();
}
