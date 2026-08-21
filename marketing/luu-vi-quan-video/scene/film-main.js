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

  window.renderFrame = (t) => {
    film.renderFrame(t);
    overlay.update(t);
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
