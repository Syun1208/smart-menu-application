// Chuan bi asset cho ban dung:
//   1. chep nhac nen
//   2. tai font Be Vietnam Pro (co day du dau tieng Viet); that bai thi dung DejaVu Sans
//   3. tach 4 clip goc thanh chuoi JPEG dung so frame moi canh can
//   4. quet assets/stills xem khach da tha anh nao vao
//   5. ghi build/manifest.json cho trinh duyet doc
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { FRAME, SHOTS, CLIPS, AUDIO } from '../content/timeline.js';
import { imageSize } from './prepare-assets-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPLOADS = process.env.LVQ_SOURCE_DIR
  || '/root/.claude/uploads/e8d4de96-989d-5856-88cf-2db9705b5264';
const MP3 = process.env.LVQ_AUDIO || path.join(UPLOADS, '3e3be7f4-Ngon_Qua___i.mp3');

const p = (...a) => path.join(ROOT, ...a);
const ensure = (d) => fs.mkdirSync(d, { recursive: true });
const log = (...a) => console.log(...a);


function findClip(basename) {
  const hit = fs.readdirSync(UPLOADS).find((f) => f.includes(basename) && f.endsWith('.mp4'));
  return hit ? path.join(UPLOADS, hit) : null;
}

// --- font ---------------------------------------------------------------
function fetchFonts() {
  const dir = p('assets/fonts');
  ensure(dir);
  const cssOut = path.join(dir, 'fonts.css');
  const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
  const url = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;900&display=swap';
  try {
    let css = execFileSync('curl', ['-fsS', '--max-time', '45', '-H', `User-Agent: ${UA}`, url],
      { encoding: 'utf8', maxBuffer: 4 << 20 });
    const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"]+\.woff2/g) || [])];
    if (!urls.length) throw new Error('khong tim thay woff2');
    urls.forEach((u, i) => {
      const name = `bvp-${i}.woff2`;
      execFileSync('curl', ['-fsS', '--max-time', '45', '-o', path.join(dir, name), u]);
      css = css.split(u).join(`/assets/fonts/${name}`);
    });
    fs.writeFileSync(cssOut, css);
    log(`  font: Be Vietnam Pro — ${urls.length} file woff2`);
    return true;
  } catch (e) {
    fs.writeFileSync(cssOut,
      `/* Khong tai duoc Be Vietnam Pro (${String(e.message).slice(0, 80)}).\n` +
      `   Dung DejaVu Sans co san trong he thong - van du dau tieng Viet. */\n`);
    log(`  font: dung DejaVu Sans (khong tai duoc Google Fonts)`);
    return false;
  }
}

// --- chay ---------------------------------------------------------------
log('Chuan bi asset cho TVC Luu Vi Quan\n');

ensure(p('assets/audio')); ensure(p('assets/stills')); ensure(p('build/frames'));

if (fs.existsSync(MP3)) {
  fs.copyFileSync(MP3, p(AUDIO.file));
  log(`  nhac: ${AUDIO.file} (${(fs.statSync(p(AUDIO.file)).size / 1e6).toFixed(1)} MB)`);
} else if (fs.existsSync(p(AUDIO.file))) {
  log(`  nhac: da co san ${AUDIO.file}`);
} else {
  log(`  ! thieu nhac nen: ${MP3}`);
}

fetchFonts();

const manifest = { frame: FRAME, frames: {}, stills: {}, generatedFor: 'luu-vi-quan-60s' };

for (const shot of SHOTS) {
  if (shot.source.kind !== 'frames') continue;
  const clip = CLIPS[shot.source.clip];
  const src = findClip(clip.file);
  const outDir = p('build/frames', shot.id);
  const count = Math.round((shot.t1 - shot.t0) * FRAME.fps);

  if (!src) { log(`  ! khong thay clip goc cho ${shot.id} (${clip.file})`); continue; }

  const have = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => f.endsWith('.jpg')).length : 0;
  if (have === count && !process.env.LVQ_FORCE) {
    log(`  ${shot.id}: da co ${have} frame, bo qua`);
  } else {
    fs.rmSync(outDir, { recursive: true, force: true });
    ensure(outDir);
    execFileSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error',
      '-ss', String(clip.in), '-i', src,
      '-vf', `fps=${FRAME.fps}`, '-frames:v', String(count),
      '-q:v', '2', '-start_number', '1',
      path.join(outDir, '%05d.jpg'),
    ], { stdio: ['ignore', 'inherit', 'inherit'] });
    log(`  ${shot.id}: tach ${count} frame tu ${path.basename(src)} (tu giay ${clip.in})`);
  }

  const files = fs.readdirSync(outDir).filter((f) => f.endsWith('.jpg')).sort();
  const size = imageSize(path.join(outDir, files[0]));
  manifest.frames[shot.source.clip] = {
    dir: `build/frames/${shot.id}`, count: files.length, ...size,
  };

  // poster: frame giua canh, de dung lam anh tinh du phong
  const poster = p('assets/stills', shot.still);
  if (!fs.existsSync(poster)) {
    fs.copyFileSync(path.join(outDir, files[Math.floor(files.length / 2)]), poster);
    log(`    -> poster assets/stills/${shot.still}`);
  }
}

for (const shot of SHOTS) {
  const f = p('assets/stills', shot.still);
  if (fs.existsSync(f)) {
    const size = imageSize(f);
    manifest.stills[shot.still] = { ...size, bytes: fs.statSync(f).size };
  }
}

ensure(p('build'));
fs.writeFileSync(p('build/manifest.json'), JSON.stringify(manifest, null, 2));

const missing = SHOTS.filter((s) => s.source.kind !== 'frames' && !manifest.stills[s.still]);
log(`\n  manifest: ${Object.keys(manifest.frames).length} chuoi frame, ${Object.keys(manifest.stills).length} anh tinh`);
if (missing.length) {
  log(`  con thieu ${missing.length} anh (dang dung placeholder): ${missing.map((s) => s.still).join(', ')}`);
}
log('\nXong. Chay `npm run check-assets` de xem bang slot, hoac `npm run render`.');
