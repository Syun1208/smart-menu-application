// Single source of truth for the promo: length, scene boundaries, copy and audio cues.
// The Three.js scene, the DOM overlay and the Python sound designer all read this file,
// so picture and sound can never drift apart.

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 34,        // seconds
  bpm: 120,            // 0.5 s per beat, 2 s per bar - every scene lands on a bar
};

export const BEAT = 60 / VIDEO.bpm;
export const BAR = BEAT * 4;

export const BRAND = {
  name: 'LƯU VỊ QUÁN',
  sub: 'Nem chua Trần Công Châu',
  tagline: 'Vị ngon đáng lưu lại',
  phone: '0947 815 316',
  ship: 'Freeship bán kính 2km',
  hours: 'T2–T6: 10h–23h  ·  T7, CN: cả ngày',
};

// Scene boundaries in seconds. Keep them on bar lines (multiples of 2 s where possible).
export const SCENES = [
  { id: 'hook',   start: 0,    end: 4 },
  { id: 'nem',    start: 4,    end: 10 },
  { id: 'caVien', start: 10,   end: 16 },
  { id: 'miTron', start: 16,   end: 22 },
  { id: 'traiCay',start: 22,   end: 27 },
  { id: 'cta',    start: 27,   end: 34 },
];

export const sceneAt = (t) => SCENES.find((s) => t >= s.start && t < s.end) || SCENES[SCENES.length - 1];

/** Local time inside a scene, in seconds. */
export const local = (t, id) => {
  const s = SCENES.find((x) => x.id === id);
  return t - s.start;
};

// ---------------------------------------------------------------------------
// Copy shown on screen. Prices come straight from the printed menu.
// ---------------------------------------------------------------------------
export const COPY = {
  hook: {
    kicker: 'ĐÓI CHƯA?',
    line: 'Chỉ vài phút để có bữa ăn ngon',
  },
  nem: {
    title: 'NEM CHUA TRẦN CÔNG CHÂU',
    kicker: 'GIÒN RỤM · NÓNG HỔI',
    chips: [
      { name: 'Nem trần',    price: '50k', unit: '/10c', hot: 'chiên 60k' },
      { name: 'Nem xù',      price: '60k', unit: '/10c', hot: 'chiên 75k' },
      { name: 'Nem phô mai', price: '12k', unit: '/1v',  hot: 'chiên 15k' },
      { name: 'Nem bò pía',  price: '65k', unit: '/10c', hot: 'chiên 80k' },
    ],
  },
  caVien: {
    title: 'CÁ VIÊN CHIÊN · MẮM TỎI',
    kicker: 'SỐT CAY THẤM ĐẪM',
    chips: [
      { name: 'Combo nhỏ', price: '50k' },
      { name: 'Combo vừa', price: '70k' },
      { name: 'Combo lớn', price: '100k' },
    ],
  },
  miTron: {
    title: 'MÌ TRỘN CÁ VIÊN',
    kicker: 'PHÔ MAI KÉO SỢI',
    chips: [
      { name: 'Mì trộn cá viên', price: '50 – 70k' },
      { name: '+ Mozzarella',    price: '60 – 80k' },
    ],
  },
  traiCay: {
    title: 'TRÁI CÂY CẮT SẴN',
    kicker: 'TƯƠI MỚI MỖI NGÀY',
    chips: [
      { name: 'Trái cây dầm', price: '40k' },
      { name: 'Combo mix vị', price: '50k' },
      { name: 'Box cắt sẵn',  price: '199k / 299k / 399k' },
    ],
  },
};

// ---------------------------------------------------------------------------
// Audio cues. `type` maps to a synthesised sound in audio/soundtrack.py,
// `t` is the exact second it fires, `gain` scales it.
// ---------------------------------------------------------------------------
export const CUES = [
  // --- hook -----------------------------------------------------------------
  { t: 0.10, type: 'riser',   gain: 0.9,  dur: 1.9 },
  { t: 0.35, type: 'whoosh',  gain: 0.7 },
  { t: 2.00, type: 'impact',  gain: 1.0 },
  { t: 2.05, type: 'sparkle', gain: 0.8 },
  { t: 2.60, type: 'ding',    gain: 0.5 },

  // --- nem chua rán ---------------------------------------------------------
  { t: 3.90, type: 'whoosh',  gain: 0.8 },
  { t: 4.00, type: 'sizzle',  gain: 0.9,  dur: 2.6 },
  { t: 4.15, type: 'crunch',  gain: 0.7 },
  { t: 4.90, type: 'crunch',  gain: 0.6 },
  { t: 5.50, type: 'pop',     gain: 0.6 },
  { t: 6.00, type: 'ding',    gain: 0.5 },
  { t: 6.50, type: 'ding',    gain: 0.5 },
  { t: 7.00, type: 'ding',    gain: 0.5 },
  { t: 7.50, type: 'ding',    gain: 0.5 },
  { t: 8.20, type: 'stretch', gain: 0.8,  dur: 1.2 },
  { t: 9.40, type: 'sparkle', gain: 0.6 },

  // --- cá viên chiên --------------------------------------------------------
  { t: 9.90, type: 'whoosh',  gain: 0.8 },
  { t: 10.30, type: 'pop',    gain: 0.7 },
  { t: 10.60, type: 'pop',    gain: 0.7 },
  { t: 10.90, type: 'pop',    gain: 0.7 },
  { t: 11.20, type: 'pop',    gain: 0.6 },
  { t: 11.60, type: 'pour',   gain: 0.9,  dur: 1.4 },
  { t: 12.40, type: 'sizzle', gain: 0.5,  dur: 1.2 },
  { t: 13.00, type: 'ding',   gain: 0.55 },
  { t: 13.80, type: 'ding',   gain: 0.55 },
  { t: 14.60, type: 'chime',  gain: 0.7 },

  // --- mì trộn --------------------------------------------------------------
  { t: 15.90, type: 'whoosh', gain: 0.8 },
  { t: 16.30, type: 'slurp',  gain: 0.7,  dur: 1.0 },
  { t: 17.20, type: 'stretch',gain: 0.9,  dur: 1.6 },
  { t: 18.60, type: 'pop',    gain: 0.6 },
  { t: 19.20, type: 'ding',   gain: 0.55 },
  { t: 20.00, type: 'ding',   gain: 0.55 },
  { t: 20.80, type: 'sparkle',gain: 0.6 },

  // --- trái cây -------------------------------------------------------------
  { t: 21.90, type: 'whoosh', gain: 0.8 },
  { t: 22.20, type: 'splash', gain: 0.9 },
  { t: 22.80, type: 'pop',    gain: 0.5 },
  { t: 23.20, type: 'pop',    gain: 0.5 },
  { t: 23.60, type: 'pop',    gain: 0.5 },
  { t: 24.20, type: 'ding',   gain: 0.55 },
  { t: 25.00, type: 'ding',   gain: 0.55 },
  { t: 25.80, type: 'chime',  gain: 0.7 },

  // --- call to action -------------------------------------------------------
  { t: 26.90, type: 'whoosh', gain: 0.9 },
  { t: 27.00, type: 'impact', gain: 1.0 },
  { t: 27.10, type: 'sparkle',gain: 0.8 },
  { t: 28.20, type: 'bell',   gain: 0.8 },
  { t: 29.40, type: 'ding',   gain: 0.6 },
  { t: 30.40, type: 'ding',   gain: 0.6 },
  { t: 31.60, type: 'chime',  gain: 0.9 },
  { t: 31.70, type: 'sparkle',gain: 0.7 },
];

/** Music arrangement: which sections of the bed are active, and how loud. */
export const MUSIC = {
  intro:  { start: 0,    end: 2 },     // riser only, no drums
  main:   { start: 2,    end: 27 },    // full beat + melody
  outro:  { start: 27,   end: 34 },    // chorus lift, then tail
  fadeOut:{ start: 32.5, end: 34 },
};
