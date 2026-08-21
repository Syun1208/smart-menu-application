// The shooting script for the photo film.
//
// Every entry frames one of the shop's real photographs for a beat or two and
// says how we cut into it. Cuts land on the 120 BPM grid (0.5 s per beat) so the
// picture snaps with the music.
//
//   region : a rectangle from photos.js
//   mode   : 'full' = the photo fills the frame
//            'card' = the photo floats as a rounded card over a blurred copy of
//                     itself (used for the crops lifted out of the printed menu,
//                     which are too small to fill 1080x1920 cleanly)
//   z      : [from, to] zoom over the shot - the slow push that keeps food alive
//   x, y   : [from, to] pan, in fractions of the visible window
//   trans  : how we cut INTO this shot

const shot = (at, end, region, opts = {}) => ({
  at, end, region,
  mode: opts.mode || 'full',
  z: opts.z || [1.12, 1.0],
  x: opts.x || [0, 0],
  y: opts.y || [0, 0],
  rot: opts.rot || [0, 0],
  trans: opts.trans || { type: 'whip', dur: 0.34, dir: [1, 0] },
  cool: opts.cool || 0,
  cardW: opts.cardW,
  sharpen: opts.sharpen ?? (opts.mode === 'card' ? 0.55 : 0.18),
  dark: opts.dark || 0,
});

const whip = (dx = 1, dy = 0, dur = 0.32) => ({ type: 'whip', dur, dir: [dx, dy] });
const punch = (dur = 0.36) => ({ type: 'punch', dur, dir: [0, 0] });
const flash = (dur = 0.3) => ({ type: 'flash', dur, dir: [0, 0] });
const slide = (dx = 0, dy = 1, dur = 0.45) => ({ type: 'slide', dur, dir: [dx, dy] });
const wipe = (dur = 0.5) => ({ type: 'wipe', dur, dir: [1, 0] });
const dissolve = (dur = 0.6) => ({ type: 'dissolve', dur, dir: [0, 0] });
const none = () => ({ type: 'none', dur: 0.001, dir: [0, 0] });

export const SHOTS = [
  // ---------------------------------------------------------------- hook ----
  shot(0.00, 1.30, 'caVienSauce', { z: [1.34, 1.12], y: [0.04, -0.02], trans: none() }),
  shot(1.30, 1.75, 'nemXu',       { z: [1.22, 1.10], trans: whip(1, 0, 0.26) }),
  shot(1.75, 2.00, 'comboMacro',  { z: [1.18, 1.08], trans: whip(-1, 0, 0.2) }),
  shot(2.00, 4.00, 'comboWide',   { z: [1.24, 1.04], y: [-0.02, 0.02], trans: flash(0.34), dark: 0.34 }),

  // ------------------------------------------------- nem chua Trần Công Châu -
  shot(4.00, 5.60, 'nemBoardRight', { z: [1.20, 1.04], x: [0.03, -0.02], trans: whip(1, 0, 0.3) }),
  shot(5.60, 7.00, 'nemPhoMai',     { z: [1.10, 0.98], y: [0.03, -0.01], trans: punch() }),
  shot(7.00, 8.30, 'nemRan',        { z: [1.18, 1.04], x: [-0.03, 0.02], trans: whip(-1, 0, 0.28) }),
  shot(8.30, 10.00, 'nemSongTray',  { mode: 'card', z: [1.08, 1.0], rot: [-2.4, 1.6], trans: slide(0, 1, 0.42) }),

  // ----------------------------------------------------- cá viên chiên ------
  shot(10.00, 11.50, 'caVienSauce', { z: [1.30, 1.08], y: [-0.03, 0.02], trans: flash(0.3) }),
  shot(11.50, 12.80, 'caVienPeanut', { z: [1.20, 1.02], trans: punch(0.34) }),
  shot(12.80, 14.20, 'comboBox',    { z: [1.22, 1.04], x: [0.03, -0.03], trans: whip(1, 0, 0.3) }),
  shot(14.20, 16.00, 'peanutBowl',  { z: [1.26, 1.06], y: [0.02, -0.03], trans: slide(0, -1, 0.4) }),

  // ---------------------------------------------------------- mì trộn -------
  shot(16.00, 18.00, 'miTronPhoto',  { mode: 'card', z: [1.10, 1.0], rot: [2.2, -1.4], trans: punch(0.38) }),
  shot(18.00, 19.60, 'miTronCheese', { mode: 'card', z: [1.06, 0.98], rot: [-1.8, 1.2], trans: whip(1, 0, 0.3) }),
  shot(19.60, 22.00, 'comboBox',     { z: [1.10, 1.26], x: [-0.02, 0.04], trans: wipe(0.5) }),

  // ---------------------------------------------------------- trái cây ------
  shot(22.00, 24.00, 'fruitMix',      { mode: 'card', cardW: 0.76, z: [1.10, 1.0], rot: [-2.0, 1.4], trans: flash(0.3), cool: 0.3 }),
  shot(24.00, 25.60, 'fruitBox',      { mode: 'card', cardW: 0.74, z: [1.06, 0.98], rot: [1.8, -1.2], trans: whip(-1, 0, 0.3), cool: 0.3 }),
  shot(25.60, 27.00, 'brandPaper',     { z: [1.34, 1.12], x: [0.02, -0.02], trans: slide(0, 1, 0.4), cool: 0.25, dark: 0.26 }),

  // ------------------------------------------------------ call to action ----
  shot(27.00, 30.40, 'comboWide',    { z: [1.16, 1.02], y: [0.02, -0.02], trans: flash(0.36), dark: 0.58 }),
  shot(30.40, 34.00, 'nemTallFull', { z: [1.04, 1.18], x: [-0.03, 0.03], trans: dissolve(0.7), dark: 0.60 }),
];

export const shotAt = (t) => {
  for (let i = SHOTS.length - 1; i >= 0; i--) if (t >= SHOTS[i].at) return { shot: SHOTS[i], index: i };
  return { shot: SHOTS[0], index: 0 };
};

// ---------------------------------------------------------------------------
// Sound cues that come straight out of the edit: every cut gets its own accent
// so the track can never drift away from the picture.
// ---------------------------------------------------------------------------
const CUT_SFX = {
  whip:     [{ type: 'whoosh', gain: 0.85, lead: 0.10 }],
  punch:    [{ type: 'impact', gain: 0.7, lead: 0.02 }, { type: 'whoosh', gain: 0.5, lead: 0.12 }],
  flash:    [{ type: 'impact', gain: 0.95, lead: 0.02 }, { type: 'sparkle', gain: 0.6, lead: -0.04 }],
  slide:    [{ type: 'whoosh', gain: 0.6, lead: 0.10 }],
  wipe:     [{ type: 'whoosh', gain: 0.7, lead: 0.12 }, { type: 'sparkle', gain: 0.4, lead: 0 }],
  dissolve: [{ type: 'sparkle', gain: 0.35, lead: 0 }],
  none:     [],
};

/** Foley that belongs to what is on screen, not to the cut. */
const FOLEY = [
  { t: 0.10, type: 'riser',   gain: 0.95, dur: 1.9 },
  { t: 0.55, type: 'sizzle',  gain: 0.75, dur: 1.1 },
  { t: 2.05, type: 'sparkle', gain: 0.85 },
  { t: 2.70, type: 'ding',    gain: 0.5 },

  { t: 4.10, type: 'sizzle',  gain: 0.85, dur: 2.4 },
  { t: 4.40, type: 'crunch',  gain: 0.7 },
  { t: 5.80, type: 'crunch',  gain: 0.65 },
  { t: 6.00, type: 'ding',    gain: 0.5 },
  { t: 6.50, type: 'ding',    gain: 0.5 },
  { t: 7.00, type: 'ding',    gain: 0.5 },
  { t: 7.50, type: 'ding',    gain: 0.5 },
  { t: 7.20, type: 'crunch',  gain: 0.6 },
  { t: 9.30, type: 'chime',   gain: 0.55 },

  { t: 10.20, type: 'sizzle', gain: 0.7, dur: 1.6 },
  { t: 11.60, type: 'pour',   gain: 0.85, dur: 1.3 },
  { t: 12.90, type: 'pop',    gain: 0.6 },
  { t: 13.00, type: 'ding',   gain: 0.55 },
  { t: 13.80, type: 'ding',   gain: 0.55 },
  { t: 14.60, type: 'ding',   gain: 0.55 },
  { t: 15.40, type: 'chime',  gain: 0.6 },

  { t: 16.40, type: 'slurp',  gain: 0.7, dur: 1.0 },
  { t: 18.10, type: 'stretch',gain: 0.9, dur: 1.5 },
  { t: 19.20, type: 'ding',   gain: 0.55 },
  { t: 20.00, type: 'ding',   gain: 0.55 },
  { t: 21.20, type: 'sparkle',gain: 0.5 },

  { t: 22.10, type: 'splash', gain: 0.9 },
  { t: 22.60, type: 'pop',    gain: 0.5 },
  { t: 23.00, type: 'pop',    gain: 0.5 },
  { t: 24.20, type: 'ding',   gain: 0.55 },
  { t: 25.00, type: 'ding',   gain: 0.55 },
  { t: 25.80, type: 'ding',   gain: 0.55 },
  { t: 26.40, type: 'riser',  gain: 0.7, dur: 0.6 },

  { t: 27.10, type: 'sparkle',gain: 0.8 },
  { t: 28.20, type: 'bell',   gain: 0.85 },
  { t: 29.40, type: 'ding',   gain: 0.6 },
  { t: 30.40, type: 'ding',   gain: 0.6 },
  { t: 31.60, type: 'chime',  gain: 0.9 },
  { t: 31.70, type: 'sparkle',gain: 0.7 },
];

export const PHOTO_CUES = [
  ...SHOTS.flatMap((s) =>
    (CUT_SFX[s.trans.type] || []).map((c) => ({ t: Math.max(0, s.at - c.lead), type: c.type, gain: c.gain })),
  ),
  ...FOLEY,
].sort((a, b) => a.t - b.t);
