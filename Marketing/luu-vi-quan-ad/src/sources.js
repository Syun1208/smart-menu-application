// Nap anh cho tung canh. Video da duoc tach thanh chuoi JPEG o buoc prepare-assets,
// nen o day chi con mot loai viec duy nhat: lay dung mot tam anh cho mot moc thoi gian.
// Cache LRU nho de render 1800 frame ma khong phinh bo nho.

const cache = new Map();
const MAX_CACHE = 48;

function touch(key, img) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, img);
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value);
}

export function loadImage(url) {
  const hit = cache.get(url);
  if (hit) { touch(url, hit); return Promise.resolve(hit); }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { touch(url, img); resolve(img); };
    img.onerror = () => reject(new Error('Khong nap duoc anh: ' + url));
    img.src = url;
  });
}

export function frameUrl(manifest, clipId, index) {
  const f = manifest.frames[clipId];
  if (!f) return null;
  const i = Math.min(f.count - 1, Math.max(0, index));
  return `${f.dir}/${String(i + 1).padStart(5, '0')}.jpg`;
}

/**
 * Tra ve nguon anh cho mot canh tai thoi diem cuc bo `local` (giay tinh tu dau canh).
 * Thu tu uu tien:
 *   1. chuoi frame tach tu video (canh 1-4)
 *   2. anh that trong assets/stills (canh khach tha vao)
 *   3. the typeset / placeholder do overlay.js ve
 */
export function resolveSource(shot, local, manifest, fps) {
  if (shot.source.kind === 'frames' && manifest.frames[shot.source.clip]) {
    return { kind: 'url', url: frameUrl(manifest, shot.source.clip, Math.floor(local * fps)) };
  }
  const still = manifest.stills[shot.still];
  if (still) return { kind: 'url', url: `assets/stills/${shot.still}` };
  return { kind: 'canvas', fallback: shot.source.fallback || 'placeholder' };
}

export function clearCache() { cache.clear(); }
