// Kiem chung ban render: thoi luong, khung hinh, va quan trong nhat -
// canh co chu (menu / end card) phai giu nguyen noi dung anh goc,
// chi khac o phep scale/translate cua camera.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { FRAME, DURATION, SHOTS } from '../content/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2] || path.join(ROOT, 'dist/luu-vi-quan-60s-9x16.mp4');
if (!fs.existsSync(file)) { console.error('Khong thay file:', file); process.exit(1); }

const ffprobe = (args) => execFileSync(ffmpegPath, ['-hide_banner', ...args], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
let info = '';
try { info = execFileSync(ffmpegPath, ['-hide_banner', '-i', file], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }); }
catch (e) { info = (e.stderr || '') + (e.stdout || ''); }

const dur = info.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
const vid = info.match(/Video:\s*([^,]+),[^,]*,\s*(\d+)x(\d+)[^,]*,\s*([\d.]+)?\s*kb\/s.*?([\d.]+) fps/s)
         || info.match(/Video:\s*([^,]+),[^,]*,\s*(\d+)x(\d+)/);
const aud = info.match(/Audio:\s*([^,]+),\s*(\d+) Hz,\s*(\w+)/);

const seconds = dur ? (+dur[1]) * 3600 + (+dur[2]) * 60 + parseFloat(dur[3]) : NaN;
const ok = (b) => (b ? '✓' : '✗');
let fail = 0;
const check = (label, pass, detail) => { if (!pass) fail++; console.log(`  ${ok(pass)} ${label}${detail ? '  — ' + detail : ''}`); };

console.log(`\nKiểm chứng ${path.relative(ROOT, file)}\n`);
check(`thời lượng ${DURATION}s`, Math.abs(seconds - DURATION) < 0.15, `${seconds.toFixed(2)}s`);
if (vid) {
  const w = +vid[2], h = +vid[3];
  check(`khung ${FRAME.width}×${FRAME.height}`, w === FRAME.width && h === FRAME.height, `${w}×${h}`);
  check('tỉ lệ 9:16', Math.abs(w / h - 9 / 16) < 0.001, (w / h).toFixed(4));
  check('codec H.264', /h264/i.test(vid[1]), vid[1].trim());
} else { check('đọc được luồng video', false); }
check('có luồng audio', !!aud, aud ? `${aud[1]}, ${aud[2]} Hz` : 'không có');

// Trich frame giua moi canh de soi bang mat
const outDir = path.join(ROOT, 'build/verify');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const s of SHOTS) {
  const t = (s.t0 + s.t1) / 2;
  execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', file,
    '-frames:v', '1', '-q:v', '2', '-y', path.join(outDir, `shot${String(s.n).padStart(2,'0')}-${t}s.jpg`)]);
}
console.log(`\n  đã trích ${SHOTS.length} frame giữa cảnh vào build/verify/ để soi bằng mắt`);
console.log(fail ? `\n  ${fail} mục KHÔNG đạt\n` : '\n  tất cả các mục đều đạt\n');
process.exit(fail ? 1 : 0);
