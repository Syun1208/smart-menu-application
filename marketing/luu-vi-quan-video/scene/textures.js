// Procedural textures drawn on 2D canvases - keeps the whole promo self-contained
// (no image downloads at render time) and perfectly reproducible.

import * as THREE from 'three';
import { mulberry32, fbm3 } from './lib/noise.js';

function makeCanvas(size, h) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = h || size;
  return c;
}

function finish(canvas, { repeat = 1, srgb = true, aniso = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = aniso;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Warm restaurant table wood with grain, knots and a subtle vignette. */
export function woodTexture(size = 1024) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      // Grain: stretched noise along X, ring-shaped banding along Y.
      const warp = fbm3(u * 3.2, v * 26, 0.5, 4) - 0.5;
      const rings = Math.sin((v * 34 + warp * 7) * Math.PI) * 0.5 + 0.5;
      const fibre = fbm3(u * 140, v * 8, 3.7, 3);
      const shade = 0.62 + rings * 0.22 + (fibre - 0.5) * 0.22;
      const i = (y * size + x) * 4;
      d[i] = Math.min(255, 132 * shade * 1.32);
      d[i + 1] = Math.min(255, 92 * shade * 1.24);
      d[i + 2] = Math.min(255, 58 * shade * 1.15);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, { repeat: 1 });
}

/** Kraft paper liner printed with the LƯU VỊ QUÁN wordmark, like the real packaging. */
export function kraftPaperTexture(size = 1024) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4ece0';
  ctx.fillRect(0, 0, size, size);

  // paper fibre
  const rnd = mulberry32(7);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rnd() > 0.5 ? '#b9a58a' : '#c8b79c';
    ctx.fillRect(rnd() * size, rnd() * size, 2, 1);
  }
  ctx.globalAlpha = 1;

  // repeated wordmark grid
  const cols = 4, rows = 6;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = (col + 0.5) * (size / cols);
      const y = (r + 0.5) * (size / rows);
      ctx.save();
      ctx.translate(x, y);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(120, 78, 40, 0.72)';
      ctx.font = `800 ${size * 0.036}px "Be Vietnam Pro", sans-serif`;
      ctx.fillText('LƯU VỊ QUÁN', 0, 0);
      ctx.fillStyle = 'rgba(120, 78, 40, 0.45)';
      ctx.font = `600 ${size * 0.015}px "Be Vietnam Pro", sans-serif`;
      ctx.fillText('VỊ NGON ĐÁNG LƯU LẠI', 0, size * 0.026);
      ctx.restore();
    }
  }
  return finish(c, { repeat: 1 });
}

/** Golden deep-fried crust: colour map + matching bump map. */
export function crustTextures(size = 512, tint = [1, 1, 1]) {
  const colour = makeCanvas(size);
  const bump = makeCanvas(size);
  const cc = colour.getContext('2d');
  const bc = bump.getContext('2d');
  const cimg = cc.createImageData(size, size);
  const bimg = bc.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * 9, v = y / size * 9;
      const n = fbm3(u, v, 1.3, 5);
      const blister = Math.pow(fbm3(u * 3.1, v * 3.1, 8.2, 3), 2.2);
      const s = Math.min(1.15, 0.66 + n * 0.42 + blister * 0.3);
      const i = (y * size + x) * 4;
      cimg.data[i] = Math.min(255, 224 * s * tint[0]);
      cimg.data[i + 1] = Math.min(255, 176 * s * tint[1]);
      cimg.data[i + 2] = Math.min(255, 112 * s * tint[2]);
      cimg.data[i + 3] = 255;
      const b = Math.min(255, (n * 0.55 + blister * 0.8) * 255);
      bimg.data[i] = bimg.data[i + 1] = bimg.data[i + 2] = b;
      bimg.data[i + 3] = 255;
    }
  }
  cc.putImageData(cimg, 0, 0);
  bc.putImageData(bimg, 0, 0);
  return { map: finish(colour), bumpMap: finish(bump, { srgb: false }) };
}

/** Fine speckle map used for sesame / pepper / breadcrumb detail. */
export function speckleTexture(size = 512, density = 2600, colour = '#6b3a12') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(99);
  ctx.fillStyle = colour;
  for (let i = 0; i < density; i++) {
    const r = 1 + rnd() * 2.4;
    ctx.beginPath();
    ctx.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c);
}

/** Soft round sprite for steam, sparks and bokeh particles. */
export function radialSprite(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, inner.replace(/[\d.]+\)$/, '0.45)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Four-point star flare used on the "sparkle" beats. */
export function starSprite(size = 256) {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,214,140,0.55)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((i * Math.PI) / 2);
    const grd = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(-size / 2, -size * 0.012, size, size * 0.024);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Environment-ish gradient used as a cheap studio reflection for glossy sauces. */
export function studioEnvTexture(renderer, palette = 'warm') {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  const stops = palette === 'cool'
    ? ['#ffffff', '#cfe6fb', '#5d7183', '#14191e']
    : ['#fff3dd', '#ffb765', '#5a2a12', '#150a05'];
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, stops[0]);
  g.addColorStop(0.42, stops[1]);
  g.addColorStop(0.75, stops[2]);
  g.addColorStop(1, stops[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  // two soft key highlights so glossy food catches the light
  ctx.globalCompositeOperation = 'lighter';
  for (const [x, y, r, a] of [[60, 60, 55, 0.9], [190, 90, 40, 0.6]]) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}
