// Grab a handful of still frames for art-direction review:
//   node scripts/shots.mjs --times 0.5,2.2,5,12,18,24,29 [--scale 0.5] [--out preview]
//                          [--page scene/film.html]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const times = String(arg('times', '0.5,2.2,5,12,18,24,29')).split(',').map(Number);
const SCALE = Number(arg('scale', 0.5));
const OUT = path.resolve(ROOT, arg('out', 'preview'));
const PAGE = arg('page', 'scene/index.html');
fs.mkdirSync(OUT, { recursive: true });

const server = await serve(0);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--hide-scrollbars', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: Math.round(1080 * SCALE), height: Math.round(1920 * SCALE) } });
page.on('pageerror', (e) => console.error('page error:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('console:', m.text()); });
await page.goto(`http://127.0.0.1:${server.address().port}/${PAGE}`, { waitUntil: 'load' });
if (SCALE !== 1) await page.addStyleTag({ content: `#stage { transform: scale(${SCALE}); transform-origin: top left; }` });
await page.waitForFunction('window.__promoReady === true || window.__promoError', null, { timeout: 120000 });
const err = await page.evaluate('window.__promoError');
if (err) { console.error('BOOT ERROR:', err); process.exit(1); }

for (const t of times) {
  await page.evaluate((time) => window.renderFrame(time), t);
  const file = path.join(OUT, `t${String(t).replace('.', '_')}.png`);
  await page.screenshot({ path: file });
  console.log('shot', file);
}
await browser.close();
server.close();
