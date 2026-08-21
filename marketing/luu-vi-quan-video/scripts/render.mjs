// Offline frame renderer.
//
// Chromium (software WebGL) draws the Three.js promo one frame at a time and we
// screenshot the whole stage, so the DOM typography and the 3D food end up in the
// same image. Frames are split across several browsers to use all cores.
//
//   node scripts/render.mjs [--fps 30] [--duration 34] [--workers 3]
//                           [--scale 1] [--quality 92] [--out frames]
//                           [--page scene/film.html]

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

const FPS = Number(arg('fps', 30));
const DURATION = Number(arg('duration', 34));
const WORKERS = Number(arg('workers', 3));
const SCALE = Number(arg('scale', 1));
const QUALITY = Number(arg('quality', 92));
const OUT = path.resolve(ROOT, arg('out', 'frames'));
const PAGE = arg('page', 'scene/index.html');
const FROM = Number(arg('from', 0));
const TO = Number(arg('to', 0));   // 0 = to the end
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const WIDTH = Math.round(1080 * SCALE);
const HEIGHT = Math.round(1920 * SCALE);
const TOTAL = Math.round(DURATION * FPS);

fs.mkdirSync(OUT, { recursive: true });   // note: --from/--to keep existing frames

const launchOptions = {
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--no-sandbox',
    '--hide-scrollbars',
    '--disable-lcd-text',
    '--force-device-scale-factor=1',
    '--disable-dev-shm-usage',
  ],
};
if (fs.existsSync(CHROME)) launchOptions.executablePath = CHROME;

async function renderShard(server, workerId) {
  const port = server.address().port;
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error(`[worker ${workerId}] page error:`, e.message));

  await page.goto(`http://127.0.0.1:${port}/${PAGE}`, { waitUntil: 'load' });
  if (SCALE !== 1) {
    await page.addStyleTag({ content: `#stage { transform: scale(${SCALE}); transform-origin: top left; }` });
  }
  await page.waitForFunction('window.__promoReady === true || window.__promoError', null, { timeout: 120000 });
  const err = await page.evaluate('window.__promoError');
  if (err) throw new Error(`scene failed to boot: ${err}`);

  let done = 0;
  const last = TO > 0 ? Math.min(TO, TOTAL - 1) : TOTAL - 1;
  for (let frame = FROM + workerId; frame <= last; frame += WORKERS) {
    const t = frame / FPS;
    await page.evaluate((time) => window.renderFrame(time), t);
    await page.screenshot({
      path: path.join(OUT, `frame_${String(frame).padStart(5, '0')}.jpg`),
      type: 'jpeg',
      quality: QUALITY,
      animations: 'disabled',
    });
    done++;
    if (done % 20 === 0) {
      process.stdout.write(`[worker ${workerId}] ${done} frames (latest #${frame})\n`);
    }
  }
  await browser.close();
  return done;
}

const started = Date.now();
const server = await serve(0);
console.log(`Rendering frames ${FROM}..${TO > 0 ? TO : TOTAL - 1} @ ${FPS}fps (${WIDTH}x${HEIGHT}) with ${WORKERS} workers -> ${OUT}`);

const counts = await Promise.all(
  Array.from({ length: WORKERS }, (_, i) => renderShard(server, i)),
);
server.close();

const total = counts.reduce((a, b) => a + b, 0);
const secs = (Date.now() - started) / 1000;
const expected = (TO > 0 ? Math.min(TO, TOTAL - 1) : TOTAL - 1) - FROM + 1;
console.log(`Done: ${total}/${expected} frames in ${secs.toFixed(1)}s (${(secs / total).toFixed(2)}s per frame)`);
if (total !== expected) {
  console.error('Frame count mismatch - the video would stutter.');
  process.exit(1);
}
