// Ghep lai MP4 tu frame da render san trong build/out - khong render lai.
// Dung khi chi muon doi do nen, doi doan nhac, hay xuat them ban nhe de dang len mang.
//
//   node scripts/mux.mjs                       ban giao hang (CRF 21, ~30 MB)
//   node scripts/mux.mjs --crf 18 --tag master ban master net toi da
//   node scripts/mux.mjs --audio-offset 12      lay nhac tu giay 12
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { FRAME, DURATION, AUDIO } from '../content/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const crf = val('--crf', '21');
const tag = val('--tag', '');
const fps = parseInt(val('--fps', String(FRAME.fps)), 10);
const offset = parseFloat(val('--audio-offset', String(AUDIO.offset)));

const inDir = path.join(ROOT, 'build/out');
const frames = fs.existsSync(inDir) ? fs.readdirSync(inDir).filter((f) => f.endsWith('.jpg')).length : 0;
if (!frames) {
  console.error('Chua co frame trong build/out — chay `npm run render` truoc.');
  process.exit(1);
}

const dur = frames / fps;
const out = path.join(ROOT, 'dist', `luu-vi-quan-60s-9x16${tag ? '-' + tag : ''}.mp4`);
const audioFile = path.join(ROOT, AUDIO.file);
const useAudio = fs.existsSync(audioFile);

const args = ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(inDir, '%05d.jpg')];
if (useAudio) args.push('-ss', String(offset), '-i', audioFile);
if (useAudio) args.push('-map', '0:v:0', '-map', '1:a:0');
args.push(
  '-t', String(dur),
  '-c:v', 'libx264', '-crf', crf, '-preset', 'slow',
  // aq-mode 3 phan bo bit theo do sang, giu chi tiet vung toi ma khong phinh file.
  // Luu y: KHONG dung tune=grain - no giu grain va day bitrate len, nguoc muc dich.
  '-x264-params', 'aq-mode=3:aq-strength=0.9',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
);
if (useAudio) {
  const L = AUDIO.loudness;
  // loudnorm truoc, fade sau - nguoc lai thi loudnorm se keo phan fade len lai.
  args.push('-c:a', 'aac', '-b:a', '160k',
    '-ar', '48000',
    '-af', `loudnorm=I=${L.I}:TP=${L.TP}:LRA=${L.LRA},`
         + `afade=t=in:st=0:d=${AUDIO.fadeIn},`
         + `afade=t=out:st=${Math.max(0, dur - AUDIO.fadeOut)}:d=${AUDIO.fadeOut}`,
    '-shortest');
} else args.push('-an');
args.push(out);

console.log(`\nGhép ${frames} frame @ ${fps}fps — CRF ${crf}${useAudio ? `, nhạc từ giây ${offset}` : ', không nhạc'}`);
await new Promise((res, rej) => {
  const ff = spawn(ffmpegPath, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg thoát với mã ' + c))));
});
const mb = fs.statSync(out).size / 1e6;
console.log(`  ✓ ${path.relative(ROOT, out)} — ${mb.toFixed(1)} MB, ${dur}s, ${Math.round(mb * 8 / dur)} Mbps\n`);
