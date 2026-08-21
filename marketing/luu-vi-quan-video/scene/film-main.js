// Entry point for the photo film (the cut that uses the shop's real photographs).
//
//   ?preview=1  - plays in real time in a browser
//   default     - exposes window.renderFrame(t) for the offline renderer

import { createFilm } from './film.js';
import { createOverlay } from './overlay.js';
import { VIDEO } from './timeline.js';

const canvas = document.getElementById('gl');
const params = new URLSearchParams(location.search);
const preview = params.get('preview') === '1';

async function boot() {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.load('900 100px "Be Vietnam Pro"');
    await document.fonts.load('600 100px "Be Vietnam Pro"');
    await document.fonts.ready;
  }

  const film = await createFilm({ canvas, width: VIDEO.width, height: VIDEO.height });
  const overlay = createOverlay();

  const ui = document.getElementById('ui');
  ui.style.transformOrigin = '50% 50%';

  window.renderFrame = (t) => {
    const kick = film.renderFrame(t);
    overlay.update(t);
    // the typography rides the same beat as the photograph, a little softer
    const scale = 1 + (kick ? kick.punch : 0) * 0.55;
    const roll = (kick ? kick.roll : 0) * (180 / Math.PI) * 0.5;
    ui.style.transform = `scale(${scale.toFixed(4)}) rotate(${roll.toFixed(3)}deg)`;
  };

  window.renderFrame(0);
  window.renderFrame(0.001);
  window.__promoReady = true;

  if (preview) {
    const start = performance.now();
    const loop = () => {
      const t = ((performance.now() - start) / 1000) % VIDEO.duration;
      window.renderFrame(t);
      requestAnimationFrame(loop);
    };
    const fit = () => {
      const s = Math.min(window.innerWidth / VIDEO.width, window.innerHeight / VIDEO.height);
      const stage = document.getElementById('stage');
      stage.style.transformOrigin = 'top left';
      stage.style.transform = `scale(${s})`;
      document.body.style.width = `${VIDEO.width * s}px`;
      document.body.style.height = `${VIDEO.height * s}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    loop();
  }
}

boot().catch((err) => {
  console.error(err);
  window.__promoError = String((err && err.stack) || err);
});
