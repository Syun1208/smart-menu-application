// Chuyen dong camera: ham thuan p in [0,1] -> {x, y, scale, rot}.
// x,y tinh theo don vi khung hinh dich (1.0 = tron mot chieu khung). rot tinh bang radian.
// Moi ten trung voi mot dong "Prompt" trong storyboard goc.

export const EASINGS = {
  linear: (p) => p,
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  outCubic: (p) => 1 - Math.pow(1 - p, 3),
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outQuint: (p) => 1 - Math.pow(1 - p, 5),
};

const lerp = (a, b, p) => a + (b - a) * p;
const DEG = Math.PI / 180;

// Moi move: {from, to} tren 4 kenh. Ham chung noi suy.
const MOVES = {
  // 1 - push in cham, troi nhe trai -> phai
  pushIn:        { x: [-0.012, 0.012], y: [0, 0],            scale: [1.04, 1.12], rot: [0, 0] },
  // 2 - dolly forward, parallax rat nhe
  dollyForward:  { x: [0.007, -0.007], y: [0.006, -0.008],   scale: [1.03, 1.14], rot: [0, 0] },
  // 3 - luot overhead + tien nhe
  overheadGlide: { x: [-0.008, 0.008], y: [-0.038, 0.038],   scale: [1.07, 1.11], rot: [0, 0] },
  // 4 - close up push vao ly trai cay dam
  closePush:     { x: [0, 0.006],      y: [0.012, -0.012],   scale: [1.06, 1.20], rot: [0, 0] },
  // 5 - top down push, mon vua ra lo
  topDownPush:   { x: [0, 0],          y: [-0.018, 0.018],   scale: [1.03, 1.14], rot: [0, 0] },
  // 6 - canh manh nhat cua bo, nhung van giu muc diu: bo han xoay
  orbitPush:     { x: [-0.018, 0.018], y: [0.008, -0.008],   scale: [1.05, 1.17], rot: [0, 0] },
  // 7 - crawl doc tren menu: KHONG xoay, doi scale toi thieu
  verticalCrawl: { x: [0, 0],          y: [-0.190, 0.190],   scale: [1.02, 1.05], rot: [0, 0] },
  // 8 - slide trai -> phai qua mam do chien
  slideLR:       { x: [-0.062, 0.062], y: [0, 0],            scale: [1.09, 1.09], rot: [0, 0] },
  // 9 - zoom vao menu trai cay rat cham: KHONG xoay
  slowZoom:      { x: [0, 0],          y: [0.010, -0.010],   scale: [1.00, 1.05], rot: [0, 0] },
  // 10 - push sang trong vao box qua tang
  luxuryPush:    { x: [-0.009, 0.009], y: [0.005, -0.005],   scale: [1.03, 1.12], rot: [0, 0] },
  // 11 - end card gan nhu dung yen
  holdPush:      { x: [0, 0],          y: [0, 0],            scale: [1.00, 1.03], rot: [0, 0] },
};

export function moveNames() {
  return Object.keys(MOVES);
}

/**
 * @param {string} name ten chuyen dong
 * @param {number} p tien do trong canh, 0..1
 * @param {string} ease ten easing
 * @param {{x:number,y:number}} bias dich chuyen co dinh (vd: day watermark ra khoi khung)
 * @param {boolean} lockText khoa an toan cho canh co chu: rot = 0
 */
export function cameraAt(name, p, ease = 'inOutSine', bias = { x: 0, y: 0 }, lockText = false) {
  const m = MOVES[name];
  if (!m) throw new Error('Khong co chuyen dong camera: ' + name);
  const e = EASINGS[ease] || EASINGS.inOutSine;
  const q = e(Math.min(1, Math.max(0, p)));
  return {
    x: lerp(m.x[0], m.x[1], q) + (bias?.x || 0),
    y: lerp(m.y[0], m.y[1], q) + (bias?.y || 0),
    scale: lerp(m.scale[0], m.scale[1], q),
    rot: lockText ? 0 : lerp(m.rot[0], m.rot[1], q),
  };
}

// Do "gian no" tu khong gian khung sang khong gian texture, theo tung truc.
export function fitMultiplier(texAspect, frameAspect, fit) {
  const ratio = texAspect / frameAspect;
  if (fit === 'width') return { x: 1, y: ratio };
  // blurpad lay mau nhu contain (phan thua do shader lap bang nen mo)
  if (fit === 'contain' || fit === 'blurpad') {
    return ratio > 1 ? { x: 1, y: ratio } : { x: 1 / ratio, y: 1 };
  }
  return ratio > 1 ? { x: 1 / ratio, y: 1 } : { x: 1, y: ratio }; // cover
}

/**
 * Ghim camera lai sao cho vung lay mau khong bao gio truot ra ngoai texture.
 * Nho vay: anh menu tha vao co ti le nao cung an toan - anh cao thi crawl that,
 * anh thap hon khung thi tu dong dung yen o giua thay vi loi ra vien den.
 */
export function clampCamera(cam, texAspect, frameAspect, fit, margin = 0.98) {
  const m = fitMultiplier(texAspect, frameAspect, fit);
  const half = 0.5 / cam.scale;
  const limX = (0.5 / m.x - half) * margin;
  const limY = (0.5 / m.y - half) * margin;
  return {
    ...cam,
    x: limX <= 0 ? 0 : Math.max(-limX, Math.min(limX, cam.x)),
    y: limY <= 0 ? 0 : Math.max(-limY, Math.min(limY, cam.y)),
    clampedX: limX <= 0 || Math.abs(cam.x) > limX,
    clampedY: limY <= 0 || Math.abs(cam.y) > limY,
  };
}
