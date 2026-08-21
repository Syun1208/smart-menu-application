// In bang slot anh: canh nao da co, canh nao con cho khach tha file vao.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHOTS, FRAME, DURATION } from '../content/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frameAspect = FRAME.width / FRAME.height;
const { imageSize } = await import('./prepare-assets-lib.mjs');

const rows = [];
let missing = 0;
for (const s of SHOTS) {
  const f = path.join(ROOT, 'assets/stills', s.still);
  const auto = s.source.kind === 'frames';
  const exists = fs.existsSync(f);
  let note = '';
  if (exists) {
    const sz = imageSize(f);
    if (sz) {
      const a = sz.width / sz.height;
      note = `${sz.width}×${sz.height}`;
      if (s.fit === 'width') {
        note += a < frameAspect - 0.01
          ? ' · cao hơn khung → camera crawl dọc'
          : ' · thấp hơn khung → giữ nguyên giữa khung, có viền trên/dưới';
      }
    }
  } else { missing++; }
  rows.push({
    n: String(s.n).padStart(2, '0'),
    time: `${String(s.t0).padStart(2)}–${String(s.t1).padStart(2)}s`,
    title: s.title,
    file: s.still,
    state: exists ? (auto ? 'tự sinh từ clip' : 'đã có') : 'CẦN THẢ ẢNH',
    note,
  });
}

const w = (s, n) => String(s).padEnd(n);
console.log(`\nTVC Lưu Vị Quán — ${DURATION}s · ${FRAME.width}×${FRAME.height} @ ${FRAME.fps}fps\n`);
console.log(w('#', 3) + w('thời gian', 11) + w('cảnh', 26) + w('file trong assets/stills/', 32) + w('trạng thái', 16) + 'ghi chú');
console.log('─'.repeat(128));
for (const r of rows) {
  console.log(w(r.n, 3) + w(r.time, 11) + w(r.title, 26) + w(r.file, 32) + w(r.state, 16) + r.note);
}
console.log('─'.repeat(128));
if (missing) {
  console.log(`\nCòn ${missing} ảnh chưa có. Video vẫn dựng đủ ${DURATION}s — các cảnh đó dùng placeholder có nhãn.`);
  console.log('Thả ảnh vào assets/stills/ đúng tên ở cột trên rồi chạy:  npm run prepare-assets && npm run render');
} else {
  console.log('\nĐủ ảnh cho cả 11 cảnh.');
}
