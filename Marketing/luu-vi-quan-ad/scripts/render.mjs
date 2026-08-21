// Render offline: Chromium chay scene three.js tung frame mot, doc canvas ra JPEG,
// roi ffmpeg ghep frame + nhac thanh MP4.
//
//   node scripts/render.mjs                  ban day du 1080x1920 @30fps
//   node scripts/render.mjs --draft          ban nhap 540x960 @24fps (nhanh hon nhieu)
//   node scripts/render.mjs --range 35:42    chi render mot doan (de soi lai mot canh)
//   node scripts/render.mjs --no-audio       khong ghep nhac
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { launch } from './browser.mjs';
import { listen } from './serve.mjs';
import { FRAME, DURATION, AUDIO } from '../content/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const draft = has('--draft');
const scale = parseFloat(val('--scale', draft ? '0.5' : '1'));
const fps = parseInt(val('--fps', draft ? '24' : String(FRAME.fps)), 10);
const quality = parseFloat(val('--quality', draft ? '0.82' : '0.95'));
const withAudio = !has('--no-audio');
// --patch: render de len bo frame da co trong build/out, danh so theo vi tri tuyet doi
// tren timeline. Dung khi sua mot canh roi chi muon render lai dung canh do,
// sau do chay `npm run mux` de ghep lai ca video.
const patch = has('--patch');

let [t0, t1] = (val('--range', `0:${DURATION}`)).split(':').map(Number);
t0 = Math.max(0, t0); t1 = Math.min(DURATION, t1);
const partial = t0 > 0 || t1 < DURATION;

const W = Math.round(FRAME.width * scale), H = Math.round(FRAME.height * scale);
const total = Math.round((t1 - t0) * fps);
const outDir = path.join(ROOT, 'build/out');
const suffix = draft ? '-draft' : '';
const rangeTag = partial ? `-${t0}s_${t1}s` : '';
const outFile = path.join(ROOT, 'dist', `luu-vi-quan-60s-9x16${suffix}${rangeTag}.mp4`);

if (!patch) fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });

const bar = (i, n, extra = '') => {
  const pct = i / n;
  const filled = Math.round(pct * 28);
  process.stdout.write(`\r  [${'█'.repeat(filled)}${'·'.repeat(28 - filled)}] ${String(Math.round(pct * 100)).padStart(3)}%  ${i}/${n}  ${extra}   `);
};

const { server, port } = await listen(0);
console.log(`\nRender TVC Lưu Vị Quán`);
console.log(`  khung   ${W}×${H} @ ${fps}fps${draft ? '  (BẢN NHÁP)' : ''}`);
console.log(`  đoạn    ${t0}s → ${t1}s  (${total} frame)\n`);

const browser = await launch();
const page = await browser.newPage({ viewport: { width: Math.min(W, 1200), height: 600 } });
page.on('pageerror', (e) => console.error('\n  [trang lỗi]', e.message));

const url = `http://127.0.0.1:${port}/src/index.html?mode=offline&scale=${scale}&fps=${fps}`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction('window.AD && window.AD.ready', null, { timeout: 90_000 });

const info = await page.evaluate(() => ({ missing: window.AD.missing, w: window.AD.width, h: window.AD.height }));
if (info.missing.length) console.log(`  ! ${info.missing.length} cảnh dùng placeholder: ${info.missing.join(', ')}\n`);

const started = Date.now();
for (let i = 0; i < total; i++) {
  const t = t0 + i / fps;
  const dataUrl = await page.evaluate(async ([tt, q]) => {
    await window.AD.renderFrame(tt);
    return window.AD.toJPEG(q);
  }, [t, quality]);
  const index = patch ? Math.round(t * fps) + 1 : i + 1;
  fs.writeFileSync(path.join(outDir, `${String(index).padStart(5, '0')}.jpg`),
    Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
  if (i % 5 === 0 || i === total - 1) {
    const el = (Date.now() - started) / 1000;
    const eta = i > 2 ? Math.round(el / (i + 1) * (total - i - 1)) : 0;
    bar(i + 1, total, `${(el / (i + 1)).toFixed(2)}s/frame · còn ~${Math.floor(eta / 60)}m${String(eta % 60).padStart(2, '0')}s`);
  }
}
process.stdout.write('\n');
await browser.close();
server.close();

// --- ghep MP4 -----------------------------------------------------------
if (patch) {
  const n = fs.readdirSync(outDir).filter((f) => f.endsWith('.jpg')).length;
  console.log(`  đã vá ${total} frame vào build/out (tổng ${n} frame).`);
  console.log('  chạy `npm run mux` để ghép lại cả video.\n');
  process.exit(0);
}

const audioFile = path.join(ROOT, AUDIO.file);
const useAudio = withAudio && fs.existsSync(audioFile);
const dur = t1 - t0;
const args = [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-framerate', String(fps), '-i', path.join(outDir, '%05d.jpg'),
];
if (useAudio) args.push('-ss', String(AUDIO.offset + t0), '-i', audioFile);
if (useAudio) args.push('-map', '0:v:0', '-map', '1:a:0');
args.push(
  '-t', String(dur),
  '-c:v', 'libx264', '-crf', draft ? '23' : '18', '-preset', draft ? 'veryfast' : 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-vf', 'scale=' + W + ':' + H + ':flags=lanczos',
);
if (useAudio) {
  const fo = Math.max(0, dur - AUDIO.fadeOut);
  const L = AUDIO.loudness;
  // loudnorm truoc, fade sau - nguoc lai thi loudnorm se keo phan fade len lai.
  args.push('-c:a', 'aac', '-b:a', '192k',
    '-af', `loudnorm=I=${L.I}:TP=${L.TP}:LRA=${L.LRA},`
         + `afade=t=in:st=0:d=${AUDIO.fadeIn},afade=t=out:st=${fo}:d=${AUDIO.fadeOut}`,
    '-shortest');
} else {
  args.push('-an');
}
args.push(outFile);

console.log('  ghép video + nhạc…');
await new Promise((res, rej) => {
  const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg thoát với mã ' + c))));
});

const mb = (fs.statSync(outFile).size / 1e6).toFixed(1);
const took = Math.round((Date.now() - started) / 1000);
console.log(`\n  ✓ ${path.relative(ROOT, outFile)}  —  ${mb} MB, ${dur}s, ${W}×${H}${useAudio ? ', có nhạc' : ', không nhạc'}`);
console.log(`  mất ${Math.floor(took / 60)} phút ${took % 60} giây\n`);
