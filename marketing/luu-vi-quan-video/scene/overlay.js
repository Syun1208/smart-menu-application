// DOM typography layer. Rendered on top of the WebGL canvas and captured in the
// same screenshot, which gives us crisp Vietnamese text with real font hinting.

import { COPY, SCENES, VIDEO, sceneAt } from './timeline.js';
import { clamp, lerp, range, easeOutCubic, easeOutBack, easeInOutCubic } from './lib/ease.js';

const $ = (sel) => document.querySelector(sel);

function place(el, { o = 1, x = 0, y = 0, s = 1, rot = 0, blur = 0 } = {}) {
  el.style.opacity = String(clamp(o));
  el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${s.toFixed(4)}) rotate(${rot.toFixed(3)}deg)`;
  el.style.filter = blur > 0.01 ? `blur(${blur.toFixed(2)}px)` : 'none';
}

/** Standard "punch in, drift, fall away" motion used for every text block. */
function popIn(t, start, dur = 0.55) {
  const p = range(t, start, start + dur);
  return { p, s: lerp(0.72, 1, easeOutBack(p, 1.5)), o: easeOutCubic(range(t, start, start + dur * 0.5)), blur: (1 - p) * 14 };
}

function fadeOut(t, start, dur = 0.4) {
  const p = range(t, start, start + dur);
  return { o: 1 - easeInOutCubic(p), y: -70 * easeInOutCubic(p), s: lerp(1, 1.08, p) };
}

// Which chips belong to which chapter, and when each one flies in (scene-local).
const CHIP_TIMING = {
  nem:     [2.0, 2.5, 3.0, 3.5],
  caVien:  [3.0, 3.8, 4.6],
  miTron:  [3.2, 4.0],
  traiCay: [2.2, 3.0, 3.8],
};

export function createOverlay() {
  const els = {
    bug: $('#bug'),
    hookKicker: $('#hook-kicker'),
    lockup: $('#logo-lockup'),
    chapter: $('#chapter'),
    chKicker: $('#ch-kicker'),
    chTitle: $('#ch-title'),
    chips: $('#chips'),
    cta: $('#cta'),
    scrim: $('#scrim'),
    scrimFull: $('#scrim-full'),
    progress: $('#progress'),
  };

  // Build every chapter's price chips up front; only one set is ever visible.
  const chipSets = {};
  for (const [id, timings] of Object.entries(CHIP_TIMING)) {
    const wrap = document.createElement('div');
    wrap.dataset.chapter = id;
    wrap.style.display = 'none';
    const nodes = COPY[id].chips.map((c, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip';
      const hot = c.hot ? `<span class="hot">${c.hot}</span>` : '';
      chip.innerHTML = `<div class="n">${c.name}${hot}</div>` +
        `<div class="p">${c.price}${c.unit ? `<span class="u">${c.unit}</span>` : ''}</div>`;
      wrap.appendChild(chip);
      return { el: chip, tIn: timings[i] ?? 2 + i * 0.5 };
    });
    els.chips.appendChild(wrap);
    chipSets[id] = { wrap, nodes };
  }

  const ctaParts = [
    { el: $('#cta .mark'), t: 0.10 },
    { el: $('#cta .name'), t: 0.20 },
    { el: $('#cta .sub'), t: 0.45 },
    { el: $('#cta .order'), t: 1.20 },
    { el: $('#cta .ship'), t: 2.40 },
    { el: $('#cta .hours'), t: 3.40 },
    { el: $('#cta .tag'), t: 4.60 },
  ];

  function update(t) {
    const sc = sceneAt(t);
    const lt = t - sc.start;

    // --- hook ---------------------------------------------------------------
    if (t < 2.0) {
      const a = popIn(t, 0.35, 0.5);
      const out = fadeOut(t, 1.70, 0.32);
      place(els.hookKicker, {
        o: a.o * out.o,
        s: a.s * (out.s || 1) * (1 + 0.06 * Math.sin(t * 9)),
        y: out.y * 0.5,
        blur: a.blur,
      });
    } else {
      place(els.hookKicker, { o: 0, s: 1 });
    }

    if (t >= 1.95 && t < 4.0) {
      const a = popIn(t, 2.0, 0.6);
      const out = fadeOut(t, 3.55, 0.45);
      place(els.lockup, { o: a.o * out.o, s: a.s * out.s, y: out.y, blur: a.blur });
    } else {
      place(els.lockup, { o: 0 });
    }

    // --- brand bug ----------------------------------------------------------
    const bugOn = t >= 4.1 && t < 26.9;
    const bugIn = easeOutBack(range(t, 4.1, 4.7), 1.4);
    const bugOut = 1 - easeInOutCubic(range(t, 26.5, 26.9));
    place(els.bug, {
      o: bugOn ? easeOutCubic(range(t, 4.1, 4.5)) * bugOut : 0,
      x: lerp(-120, 0, bugIn),
      s: 1,
    });

    // --- chapter title + chips ---------------------------------------------
    const chapterCopy = COPY[sc.id];
    const hasChapterText = ['nem', 'caVien', 'miTron', 'traiCay'].includes(sc.id);
    if (hasChapterText) {
      els.chKicker.textContent = chapterCopy.kicker;
      els.chTitle.textContent = chapterCopy.title;
      const a = popIn(lt, 0.3, 0.5);
      const out = fadeOut(lt, (sc.end - sc.start) - 0.5, 0.4);
      place(els.chapter, {
        o: a.o * out.o,
        x: lerp(-90, 0, easeOutCubic(range(lt, 0.3, 0.9))),
        y: out.y * 0.4,
        s: lerp(0.94, 1, easeOutCubic(range(lt, 0.3, 0.85))),
        blur: a.blur * 0.6,
      });
    } else {
      place(els.chapter, { o: 0 });
    }

    for (const [id, set] of Object.entries(chipSets)) {
      const active = id === sc.id;
      set.wrap.style.display = active ? 'block' : 'none';
      if (!active) continue;
      const chapterEnd = sc.end - sc.start;
      for (const node of set.nodes) {
        const inP = range(lt, node.tIn, node.tIn + 0.45);
        const outP = range(lt, chapterEnd - 0.45, chapterEnd - 0.1);
        place(node.el, {
          o: easeOutCubic(inP) * (1 - easeInOutCubic(outP)),
          x: lerp(160, 0, easeOutBack(inP, 1.3)) + 160 * easeInOutCubic(outP),
          s: lerp(0.92, 1, easeOutBack(inP, 1.2)),
        });
      }
    }
    els.chips.style.opacity = hasChapterText ? '1' : '0';

    // --- call to action -----------------------------------------------------
    if (sc.id === 'cta') {
      place(els.cta, { o: 1 });
      // the phone pill keeps a soft heartbeat so the number is what you remember
      const beat = 1 + 0.035 * Math.sin((lt - 1.2) * 6.0) * clamp(range(lt, 1.6, 2.4));
      for (const part of ctaParts) {
        const a = popIn(lt, part.t, 0.5);
        const isPill = part.el.classList.contains('order');
        place(part.el, {
          o: a.o,
          s: a.s * (isPill ? beat : 1),
          y: lerp(40, 0, easeOutCubic(range(lt, part.t, part.t + 0.5))),
          blur: a.blur * 0.5,
        });
      }
    } else {
      place(els.cta, { o: 0 });
    }

    // --- scrims: keep every line of copy readable over the food -------------
    const chapterScrim = hasChapterText ? clamp(range(lt, 0.2, 0.8)) * 0.95 : 0;
    const hookScrim = t < 4 ? 0.55 * clamp(range(t, 0.2, 0.8)) : 0;
    els.scrim.style.opacity = String(Math.max(chapterScrim, hookScrim, sc.id === 'cta' ? 0.5 : 0));
    els.scrimFull.style.opacity = String(
      sc.id === 'cta' ? clamp(range(lt, 0, 0.6)) * 0.62 : t < 2.4 ? clamp(range(t, 0.2, 0.8)) * 0.5 : 0,
    );

    // --- progress bar -------------------------------------------------------
    els.progress.style.width = `${(t / VIDEO.duration) * VIDEO.width}px`;
    els.progress.style.opacity = t > 0.6 && t < VIDEO.duration - 1.0 ? '0.85' : '0';
  }

  return { update };
}
