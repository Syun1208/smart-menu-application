// Diem vao cho ca hai che do:
//   ?mode=offline  -> dung yen, cho scripts/render.mjs goi window.AD.renderFrame(t)
//   mac dinh       -> preview thoi gian thuc kem nhac, de duyet nhip truoc khi render
import { FRAME, DURATION, SHOTS, BRAND, AUDIO } from '../content/timeline.js';
import { AdScene } from './scene.js';

const params = new URLSearchParams(location.search);
const offline = params.get('mode') === 'offline';
const scale = parseFloat(params.get('scale') || '1');

const frame = {
  width: Math.round(FRAME.width * scale),
  height: Math.round(FRAME.height * scale),
  fps: parseInt(params.get('fps') || FRAME.fps, 10),
};

const canvas = document.getElementById('stage');
canvas.width = frame.width;
canvas.height = frame.height;

const status = (msg) => {
  const el = document.getElementById('status');
  if (el) el.textContent = msg;
};

async function boot() {
  const [manifest, menu] = await Promise.all([
    fetch('build/manifest.json').then((r) => (r.ok ? r.json() : { frames: {}, stills: {} })),
    fetch('content/menu.json').then((r) => r.json()),
  ]);

  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.load('900 100px "Be Vietnam Pro"'); } catch (e) { /* dung font he thong */ }
    await document.fonts.ready;
  }

  const ad = new AdScene({ frame, shots: SHOTS, brand: BRAND, menu, manifest, canvas });

  window.AD = {
    ready: true,
    duration: DURATION,
    fps: frame.fps,
    width: frame.width,
    height: frame.height,
    shots: SHOTS.map((s) => ({ id: s.id, n: s.n, title: s.title, t0: s.t0, t1: s.t1 })),
    missing: SHOTS.filter((s) => s.source.kind !== 'frames' && !manifest.stills[s.still]).map((s) => s.still),
    renderFrame: (t) => ad.renderFrame(t),
    toJPEG: (q = 0.95) => canvas.toDataURL('image/jpeg', q),
  };

  await ad.renderFrame(0);

  if (offline) { status('offline ready'); return; }
  startPreview(ad);
}

function startPreview(ad) {
  const audio = new Audio(AUDIO.file);
  audio.currentTime = AUDIO.offset;
  audio.volume = 0.9;

  let playing = false;
  let t = 0;
  let last = performance.now();
  let busy = false;

  const label = document.getElementById('label');

  async function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      t += dt;
      if (t >= DURATION) { t = 0; audio.currentTime = AUDIO.offset; }
    }
    if (busy) return;
    busy = true;
    try { await ad.renderFrame(t); } finally { busy = false; }

    const s = SHOTS.find((x) => t >= x.t0 && t < x.t1) || SHOTS[SHOTS.length - 1];
    label.textContent = `${t.toFixed(2)}s / ${DURATION}s  ·  cảnh ${s.n} — ${s.title}`;
    document.getElementById('bar').style.width = (t / DURATION * 100) + '%';
  }
  requestAnimationFrame(loop);

  function toggle() {
    playing = !playing;
    if (playing) { audio.currentTime = AUDIO.offset + t; audio.play().catch(() => {}); }
    else audio.pause();
    status(playing ? 'đang phát — Space để dừng' : 'đang dừng — Space để phát');
  }

  function seek(dt) {
    t = Math.max(0, Math.min(DURATION - 0.01, t + dt));
    audio.currentTime = AUDIO.offset + t;
  }

  function jumpShot(dir) {
    const i = SHOTS.findIndex((x) => t >= x.t0 && t < x.t1);
    const next = Math.max(0, Math.min(SHOTS.length - 1, (i < 0 ? 0 : i) + dir));
    t = SHOTS[next].t0;
    audio.currentTime = AUDIO.offset + t;
  }

  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    else if (e.code === 'ArrowRight') seek(e.shiftKey ? 1 : 1 / frame.fps);
    else if (e.code === 'ArrowLeft') seek(e.shiftKey ? -1 : -1 / frame.fps);
    else if (e.code === 'ArrowDown') jumpShot(1);
    else if (e.code === 'ArrowUp') jumpShot(-1);
    else if (e.code === 'Home') { t = 0; audio.currentTime = AUDIO.offset; }
  });
  canvas.addEventListener('click', toggle);

  const missing = window.AD.missing;
  status(missing.length
    ? `thiếu ${missing.length} ảnh (đang dùng placeholder) — Space để phát`
    : 'đủ ảnh — Space để phát');
}

boot().catch((e) => { status('LỖI: ' + e.message); console.error(e); });
