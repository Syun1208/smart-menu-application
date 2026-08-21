// The photo film: the shop's real photographs, cut to the beat.
//
// Everything you see is one full-screen quad. A single fragment shader frames a
// window out of a source photograph (so a "camera move" is just an animated UV
// rectangle, always sampled at full resolution), renders the outgoing and the
// incoming shot, and blends them with a transition - whip pan, zoom punch,
// flash cut, slide, wipe or dissolve. Grade, vignette, grain and the light
// sweep happen in the same pass; a bloom pass on top gives the fried food that
// warm glow.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { PHOTOS, REGIONS } from './photos.js';
import { SHOTS } from './shots.js';
import { VIDEO, sceneAt } from './timeline.js';
import { clamp, lerp, range, easeOutCubic, easeInOutCubic, pulse } from './lib/ease.js';

const FRAME_ASPECT = VIDEO.width / VIDEO.height;   // 0.5625

const TRANS_ID = { none: 0, cut: 0, whip: 1, punch: 2, slide: 3, flash: 4, wipe: 5, dissolve: 6 };

// Where a "card" shot sits in frame: upper half, clear of the chapter title.
const CARD = { maxW: 0.92, maxH: 0.42, centerY: 0.700 };

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uTexA, uTexB;
  uniform vec4 uRectA, uRectB;     // window into the source photo (x0,y0,x1,y1)
  uniform vec4 uCardA, uCardB;     // cx, cy, halfW, halfH in frame uv
  uniform vec2 uModeA, uModeB;     // x: 0 full-bleed / 1 card, y: sharpen amount
  uniform vec2 uTexSizeA, uTexSizeB;
  uniform vec3 uFxA, uFxB;         // xy: directional blur, z: radial blur
  uniform float uRotA, uRotB;

  uniform float uMix, uTrans;
  uniform vec2 uDir;
  uniform float uFlash, uDark, uCool, uSweep, uGrain, uVignette, uExposure, uContrast, uSat;
  uniform float uTime, uAspect;
  uniform vec2 uShake;
  uniform float uPunch, uRoll;   // beat kick: zoom in, tilt a hair

  const vec3 WARM = vec3(1.055, 0.995, 0.915);
  const vec3 COOL = vec3(0.930, 1.000, 1.070);

  // Frame uv (y up) -> source uv (y down, matching how the rects are written).
  vec2 srcUV(vec4 rect, vec2 uv) {
    vec2 q = clamp(uv, 0.0, 1.0);
    return mix(rect.xy, rect.zw, vec2(q.x, 1.0 - q.y));
  }

  // Catmull-Rom bicubic, the 9-bilinear-tap formulation. The GPU's own filter
  // is bilinear, which turns any enlargement into mush; this keeps edges.
  vec3 bicubic(sampler2D tex, vec2 uv, vec2 texSize) {
    vec2 pos = uv * texSize;
    vec2 c = floor(pos - 0.5) + 0.5;
    vec2 f = pos - c;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    vec2 w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2;
    vec2 t0 = (c - 1.0) / texSize;
    vec2 t3 = (c + 2.0) / texSize;
    vec2 t12 = (c + w2 / w12) / texSize;
    vec3 r = vec3(0.0);
    r += texture2D(tex, vec2(t0.x,  t0.y )).rgb * w0.x  * w0.y;
    r += texture2D(tex, vec2(t12.x, t0.y )).rgb * w12.x * w0.y;
    r += texture2D(tex, vec2(t3.x,  t0.y )).rgb * w3.x  * w0.y;
    r += texture2D(tex, vec2(t0.x,  t12.y)).rgb * w0.x  * w12.y;
    r += texture2D(tex, vec2(t12.x, t12.y)).rgb * w12.x * w12.y;
    r += texture2D(tex, vec2(t3.x,  t12.y)).rgb * w3.x  * w12.y;
    r += texture2D(tex, vec2(t0.x,  t3.y )).rgb * w0.x  * w3.y;
    r += texture2D(tex, vec2(t12.x, t3.y )).rgb * w12.x * w3.y;
    r += texture2D(tex, vec2(t3.x,  t3.y )).rgb * w3.x  * w3.y;
    return r;
  }

  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
  }

  vec3 sampleRect(sampler2D tex, vec4 rect, vec2 uv, vec3 fx, vec2 tsize, float sharpen) {
    float amt = abs(fx.x) + abs(fx.y) + abs(fx.z);
    if (amt < 0.0015) {
      vec2 suv = srcUV(rect, uv);
      vec3 c = bicubic(tex, suv, tsize);
      if (sharpen > 0.001) {
        vec2 px = abs(rect.zw - rect.xy) / max(tsize, vec2(1.0)) * 1.15;
        vec3 n = texture2D(tex, suv + vec2(px.x, 0.0)).rgb + texture2D(tex, suv - vec2(px.x, 0.0)).rgb
               + texture2D(tex, suv + vec2(0.0, px.y)).rgb + texture2D(tex, suv - vec2(0.0, px.y)).rgb;
        c = clamp(c * (1.0 + 4.0 * sharpen) - n * sharpen, 0.0, 2.0);
      }
      return c;
    }
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 9; i++) {
      float f = float(i) / 8.0 - 0.5;
      vec2 off = fx.xy * f + (uv - 0.5) * fx.z * f;
      acc += texture2D(tex, srcUV(rect, uv + off)).rgb;
    }
    return acc / 9.0;
  }

  vec3 renderShot(sampler2D tex, vec4 rect, vec4 card, vec2 mode, float rot, vec3 fx, vec2 tsize, vec2 uv) {
    if (mode.x < 0.5) {
      return sampleRect(tex, rect, uv, fx, tsize, mode.y);
    }

    // --- mode 2: the photo runs the full width of the frame and whatever it
    // cannot fill is a blurred, darkened copy of itself. Used for photographs
    // whose shape does not suit 9:16 - nothing is cropped away, and the picture
    // is still as big as the frame allows.
    if (mode.x > 1.5) {
      vec2 hs = card.zw;                 // 'half' is a reserved word in GLSL
      vec2 dd = (uv - card.xy) / hs;
      vec3 bg = texture2D(tex, vec2(uv.x, 1.0 - uv.y) * 0.9 + 0.05, 5.0).rgb;
      bg = mix(vec3(0.06, 0.03, 0.015), bg * 0.55, 0.85);
      float inside = step(max(abs(dd.x), abs(dd.y)), 1.0);
      vec3 photo = sampleRect(tex, rect, clamp(dd * 0.5 + 0.5, 0.0, 1.0), fx, tsize, mode.y);
      float edge = smoothstep(1.06, 0.99, abs(dd.y));
      return mix(bg, photo, inside * edge + inside * (1.0 - edge) * 0.85);
    }

    // --- card: the photo floats over a blurred, dimmed copy of itself --------
    vec2 asp = vec2(uAspect, 1.0);
    vec2 p = (uv - card.xy) * asp;
    float c = cos(rot), s = sin(rot);
    p = mat2(c, -s, s, c) * p;
    vec2 b = card.zw * asp;
    float radius = min(b.x, b.y) * 0.16;

    // Backdrop: the brand's warm gradient, tinted by the average colour of the
    // dish itself (one heavily mipped sample), so the card always sits in a
    // clean studio-like field instead of a smeared copy of the photo.
    vec3 avg = texture2D(tex, srcUV(rect, vec2(0.5, 0.5)), 6.0).rgb;   // colour of THIS dish, not the whole file
    float h = smoothstep(0.0, 1.1, uv.y);
    vec3 grad = mix(
      mix(vec3(0.105, 0.052, 0.026), vec3(0.36, 0.155, 0.058), h),   // warm, fried food
      mix(vec3(0.050, 0.085, 0.060), vec3(0.115, 0.265, 0.150), h),  // fresh, fruit
      uCool);
    vec3 bg = mix(grad, avg * 0.55, 0.26);
    float glow = exp(-pow(length((uv - vec2(card.x, card.y)) * vec2(uAspect * 1.35, 1.0)) / 0.42, 2.0));
    bg += mix(vec3(1.0, 0.52, 0.16), vec3(0.45, 1.0, 0.62), uCool) * glow * 0.16;
    bg *= 1.0 - 0.35 * length((uv - 0.5) * vec2(uAspect * 1.7, 1.0));

    float dShadow = sdRoundRect(p + vec2(0.0, 0.030), b * 1.015, radius);
    bg = mix(bg, bg * 0.35, smoothstep(0.085, -0.01, dShadow));

    float d = sdRoundRect(p, b, radius);
    vec2 luv = p / b * 0.5 + 0.5;
    vec3 photo = sampleRect(tex, rect, clamp(luv, 0.0, 1.0), fx, tsize, mode.y);

    float inside = smoothstep(0.004, -0.002, d);
    float border = smoothstep(0.0055, 0.0015, abs(d + 0.0035));
    float halo = exp(-pow(max(d, 0.0) / 0.020, 2.0));
    vec3 col = mix(bg, photo, inside);
    col = mix(col, vec3(1.0, 0.95, 0.88), border * 0.85);
    col += (1.0 - inside) * halo * vec3(1.0, 0.62, 0.26) * 0.14;
    return col;
  }

  void main() {
    // the beat kick: snap in a few percent and tilt, then let it settle
    vec2 pc = (vUv + uShake) - 0.5;
    float rs = sin(uRoll), rc = cos(uRoll);
    pc = vec2(pc.x * uAspect, pc.y);
    pc = mat2(rc, -rs, rs, rc) * pc;
    pc = vec2(pc.x / uAspect, pc.y) * (1.0 - uPunch);
    vec2 uv = clamp(pc + 0.5, -0.5, 1.5);
    vec2 uvA = uv, uvB = uv;
    vec3 fxA = uFxA, fxB = uFxB;
    float m = clamp(uMix, 0.0, 1.0);
    float blend = 1.0;
    float edgeGlow = 0.0;

    if (uTrans < 0.5) {                    // hard cut
      blend = step(0.5, m);
    } else if (uTrans < 1.5) {             // whip pan
      float e = smoothstep(0.0, 1.0, m);
      uvA += uDir * e * 0.62;
      uvB += uDir * (e - 1.0) * 0.62;
      float b = sin(3.14159 * m) * 0.055;
      fxA += vec3(uDir * b, 0.0);
      fxB += vec3(uDir * b, 0.0);
      blend = step(0.5, e);
    } else if (uTrans < 2.5) {             // zoom punch
      float e = 1.0 - pow(1.0 - m, 3.0);
      uvB = (uvB - 0.5) * mix(1.16, 1.0, e) + 0.5;
      uvA = (uvA - 0.5) * mix(1.0, 0.92, e) + 0.5;
      float r = sin(3.14159 * m) * 0.028;
      fxB.z += r;
      fxA.z += r * 0.7;
      blend = smoothstep(0.16, 0.52, m);
    } else if (uTrans < 3.5) {             // slide
      float e = 1.0 - pow(1.0 - m, 3.0);
      uvB += uDir * (e - 1.0);
      float ins = step(0.0, uvB.x) * step(uvB.x, 1.0) * step(0.0, uvB.y) * step(uvB.y, 1.0);
      blend = ins;
      float edge = min(min(uvB.x, 1.0 - uvB.x), min(uvB.y, 1.0 - uvB.y));
      edgeGlow = ins * exp(-edge / 0.008) * 0.25;
    } else if (uTrans < 4.5) {             // flash cut
      blend = step(0.45, m);
    } else if (uTrans < 5.5) {             // diagonal wipe
      float w = 0.14;
      float g = uv.x * 0.68 + uv.y * 0.32;
      float pos = mix(1.0 + w, -w, m);
      blend = clamp((g - pos) / w, 0.0, 1.0);
      edgeGlow = exp(-pow((g - pos) / (w * 0.45), 2.0)) * 0.28;
    } else {                                // dissolve
      blend = smoothstep(0.0, 1.0, m);
    }

    vec3 a = renderShot(uTexA, uRectA, uCardA, uModeA, uRotA, fxA, uTexSizeA, uvA);
    vec3 b = renderShot(uTexB, uRectB, uCardB, uModeB, uRotB, fxB, uTexSizeB, uvB);
    vec3 col = mix(a, b, blend);
    col += edgeGlow * vec3(1.0, 0.76, 0.38);

    // sheen sweeping across the food on the accents
    if (uSweep > 0.001) {
      float g = uv.x * 0.55 + uv.y * 0.45;
      float d = g - fract(uSweep);
      col += vec3(1.0, 0.88, 0.66) * exp(-d * d / 0.0025) * 0.14;
    }

    col *= uExposure;
    col = (col - 0.5) * uContrast + 0.5;
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, uSat);
    col *= mix(WARM, COOL, uCool);
    col *= 1.0 - uDark * 0.62;

    float v = length((uv - 0.5) * vec2(uAspect * 1.55, 1.0));
    col *= 1.0 - uVignette * smoothstep(0.30, 1.05, v);
    col = mix(col, vec3(1.0, 0.97, 0.92), clamp(uFlash, 0.0, 1.0));

    float n = fract(sin(dot(uv * vec2(1927.0, 1091.0) + uTime * 41.0, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * uGrain;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

/**
 * Which window of the photo do we sample?
 *
 * Full-bleed shots take the whole WIDTH of the region and let the window spill
 * up and down into the surrounding photo - a 9:16 frame is so tall that cropping
 * a wide region to the frame's aspect would leave a narrow strip of pixels and
 * upscale it four times over. Card shots keep the region exactly as framed,
 * because their crop is lifted out of the printed menu and has no surroundings.
 */
function windowFor(regionName, zoom, panX, panY, cardMode) {
  const r = REGIONS[regionName];
  const photo = PHOTOS[r.photo];
  const [x0, y0, x1, y1] = r.rect;
  const rw = x1 - x0;
  const rh = y1 - y0;
  const regionAspect = (rw * photo.w) / (rh * photo.h);

  let w;
  let h;
  if (cardMode) {
    w = rw / zoom;
    h = rh / zoom;
  } else {
    w = rw;
    h = (rw * photo.w) / (FRAME_ASPECT * photo.h);
    if (h > 1) {                       // landscape source: height is the limit
      h = 1;
      w = (h * FRAME_ASPECT * photo.h) / photo.w;
    }
    w /= zoom;
    h /= zoom;
  }

  let cx = (x0 + x1) / 2 + panX * w;
  let cy = (y0 + y1) / 2 + panY * h;

  const bound = (c, half, lo, hi) => (half * 2 > hi - lo ? (lo + hi) / 2 : clamp(c, lo + half, hi - half));
  if (cardMode) {
    cx = bound(cx, w / 2, x0, x1);
    cy = bound(cy, h / 2, y0, y1);
  } else {
    cx = bound(cx, w / 2, 0, 1);
    cy = bound(cy, h / 2, 0, 1);
  }

  return { rect: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], photo, regionAspect };
}

/** Card geometry in frame uv for a given photo aspect. */
function cardFor(regionAspect, shot) {
  if (shot.mode === 'wide') {
    const uh = FRAME_ASPECT / regionAspect;          // full width, natural height
    return [0.5, shot.cardY ?? 0.60, 0.5, uh / 2];
  }
  let uw = shot.cardW ?? CARD.maxW;
  let uh = (uw * FRAME_ASPECT) / regionAspect;
  const maxH = shot.cardH ?? CARD.maxH;
  if (uh > maxH) {
    uh = maxH;
    uw = (uh * regionAspect) / FRAME_ASPECT;
  }
  return [shot.cardX ?? 0.5, shot.cardY ?? CARD.centerY, uw / 2, uh / 2];
}

/** Evaluate one shot at absolute time t (clamped to its own span). */
function evalShot(shot, t) {
  const p = clamp((t - shot.at) / (shot.end - shot.at));
  const e = easeOutCubic(p) * 0.65 + easeInOutCubic(p) * 0.35;   // slow, filmic drift
  const zoom = lerp(shot.z[0], shot.z[1], e);
  const panX = lerp(shot.x[0], shot.x[1], e);
  const panY = lerp(shot.y[0], shot.y[1], e);
  const rot = lerp(shot.rot[0], shot.rot[1], e) * (Math.PI / 180);
  const isCard = shot.mode === 'card' || shot.mode === 'wide';
  const modeId = shot.mode === 'wide' ? 2 : shot.mode === 'card' ? 1 : 0;

  const win = windowFor(shot.region, zoom, panX, panY, isCard);
  const card = isCard ? cardFor(win.regionAspect, shot) : [0.5, 0.5, 0.5, 0.5];

  return {
    rect: win.rect,
    photo: win.photo,
    card,
    mode: [modeId, shot.sharpen],
    rot,
    dark: shot.dark,
    cool: shot.cool,
    expo: shot.expo ?? 1,
  };
}

function makeSparkleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,240,210,1)');
  grad.addColorStop(0.35, 'rgba(255,180,90,0.55)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export async function createFilm({ canvas, width, height }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // photos pass through untouched

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

  // --- load every photograph up front --------------------------------------
  const loader = new THREE.TextureLoader();
  const textures = {};
  await Promise.all(
    Object.entries(PHOTOS).map(
      ([key, p]) =>
        new Promise((resolve, reject) => {
          loader.load(
            p.src,
            (tex) => {
              tex.colorSpace = THREE.NoColorSpace;
              tex.flipY = false;   // rects are written in image space (y down)
              tex.generateMipmaps = true;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              tex.magFilter = THREE.LinearFilter;
              tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
              tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
              textures[key] = tex;
              resolve();
            },
            undefined,
            reject,
          );
        }),
    ),
  );
  const texOf = (photo) => textures[Object.keys(PHOTOS).find((k) => PHOTOS[k] === photo)];

  // --- the beat map: what the music is doing, frame by frame ---------------
  // Written by audio/beatmap.py from whatever track is on the film, so swapping
  // the music re-times every kick in here without touching this file.
  let beat = null;
  let shots = SHOTS;
  try {
    const res = await fetch('./beats.json', { cache: 'no-store' });
    if (res.ok) {
      const raw = await res.json();
      // one list of hits: every beat, plus the sharpest onsets in between
      const hits = raw.beats.map((t, i) => ({
        t,
        s: i % 4 === 0 ? 1.25 : i % 2 === 0 ? 1.0 : 0.8,   // downbeats hit hardest
      }));
      for (const o of raw.onsets || []) {
        if (o.v < 0.55) continue;
        if (raw.beats.some((b) => Math.abs(b - o.t) < 0.09)) continue;   // already a beat
        hits.push({ t: o.t, s: 0.55 * o.v });
      }
      hits.sort((a, b) => a.t - b.t);
      beat = { hits, bass: raw.energy?.bass || [], fps: raw.fps || 30, bpm: raw.bpm };
      shots = snapToBeats(SHOTS, raw.beats);
    }
  } catch (err) {
    console.warn('no beat map:', err);
  }

  /**
   * Move every cut onto the nearest beat of whatever track is playing, as long
   * as it does not move far or crowd the shot before it. Swapping the music
   * therefore re-times the edit, not just the effects.
   */
  function snapToBeats(list, beats) {
    if (!beats || !beats.length) return list;
    const out = list.map((s) => ({ ...s }));
    for (let i = 1; i < out.length; i++) {
      let best = out[i].at;
      let bestD = Infinity;
      for (const b of beats) {
        const d = Math.abs(b - out[i].at);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (bestD <= 0.30 && best - out[i - 1].at >= 0.45) out[i].at = best;
    }
    for (let i = 0; i < out.length - 1; i++) out[i].end = out[i + 1].at;
    return out;
  }

  /** The kick riding on the music at time t. */
  function beatKick(t) {
    if (!beat || !beat.hits.length) return { punch: 0, roll: 0, split: 0 };
    let lo = 0;
    let hi = beat.hits.length - 1;
    if (t < beat.hits[0].t) return { punch: 0, roll: 0, split: 0 };
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (beat.hits[mid].t <= t) lo = mid; else hi = mid - 1;
    }
    const hit = beat.hits[lo];
    const age = t - hit.t;
    const env = Math.exp(-age / 0.105);            // a soft breath on the beat, not a jolt
    const bassFrame = Math.min(beat.bass.length - 1, Math.round(t * beat.fps));
    const pump = beat.bass.length ? beat.bass[bassFrame] * 0.005 : 0;
    return {
      punch: 0.019 * hit.s * env + pump,
      roll: 0.0026 * hit.s * env * (lo % 2 ? 1 : -1),
      split: hit.s > 1.1 ? 0.0010 * env : 0,
    };
  }

  const uniforms = {
    uTexA: { value: null }, uTexB: { value: null },
    uRectA: { value: new THREE.Vector4(0, 0, 1, 1) }, uRectB: { value: new THREE.Vector4(0, 0, 1, 1) },
    uCardA: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) }, uCardB: { value: new THREE.Vector4(0.5, 0.5, 0.5, 0.5) },
    uModeA: { value: new THREE.Vector2(0, 0.2) }, uModeB: { value: new THREE.Vector2(0, 0.2) },
    uTexSizeA: { value: new THREE.Vector2(1500, 1500) }, uTexSizeB: { value: new THREE.Vector2(1500, 1500) },
    uFxA: { value: new THREE.Vector3() }, uFxB: { value: new THREE.Vector3() },
    uRotA: { value: 0 }, uRotB: { value: 0 },
    uMix: { value: 1 }, uTrans: { value: 0 }, uDir: { value: new THREE.Vector2(1, 0) },
    uFlash: { value: 0 }, uDark: { value: 0 }, uCool: { value: 0 }, uSweep: { value: 0 },
    uGrain: { value: 0.017 }, uVignette: { value: 0.38 },
    uExposure: { value: 1.03 }, uContrast: { value: 1.05 }, uSat: { value: 1.12 },
    uTime: { value: 0 }, uAspect: { value: FRAME_ASPECT },
    uShake: { value: new THREE.Vector2() },
    uPunch: { value: 0 }, uRoll: { value: 0 },
  };

  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, depthTest: false, depthWrite: false }),
  );
  quad.frustumCulled = false;
  scene.add(quad);

  // --- floating embers, so even a still photograph has life in it ----------
  const SPARKS = 90;
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkSeed = new Float32Array(SPARKS);
  for (let i = 0; i < SPARKS; i++) sparkSeed[i] = (i * 9301 % 233280) / 233280;
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    map: makeSparkleTexture(),
    size: 26,
    sizeAttenuation: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    opacity: 0.0,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);

  // --- bloom ---------------------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.22, 0.55, 0.92);
  composer.addPass(bloom);

  // On the hardest hits the channels separate for a frame or two and the whole
  // image lifts - the "snap" you feel in a music-cut ad.
  const beatPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uSplit: { value: 0 },
      uLift: { value: 0 },
      uDirection: { value: new THREE.Vector2(1, 0.35) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uSplit, uLift;
      uniform vec2 uDirection;
      varying vec2 vUv;
      void main() {
        vec2 d = uDirection * uSplit;
        vec3 c;
        c.r = texture2D(tDiffuse, clamp(vUv + d, 0.0, 1.0)).r;
        c.g = texture2D(tDiffuse, vUv).g;
        c.b = texture2D(tDiffuse, clamp(vUv - d, 0.0, 1.0)).b;
        gl_FragColor = vec4(c * (1.0 + uLift), 1.0);
      }
    `,
  });
  composer.addPass(beatPass);

  const rnd = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function updateSparks(t, intensity) {
    for (let i = 0; i < SPARKS; i++) {
      const s = sparkSeed[i];
      const speed = 0.045 + s * 0.06;
      const y = ((s * 1.7 + t * speed) % 1.35) - 0.35;
      const x = (s * 3.3 % 1) + Math.sin(t * (0.5 + s) + s * 6.28) * 0.03;
      sparkPos[i * 3] = ((x % 1) - 0.5);
      sparkPos[i * 3 + 1] = y - 0.5;
      sparkPos[i * 3 + 2] = 0;
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkMat.opacity = intensity;
    sparkMat.size = 14 + 18 * intensity;
  }

  function renderFrame(t) {
    // --- which shot, and are we mid-cut? -----------------------------------
    let index = 0;
    for (let i = shots.length - 1; i >= 0; i--) {
      if (t >= shots[i].at) { index = i; break; }
    }
    const cur = shots[index];
    const prev = shots[Math.max(0, index - 1)];
    const dur = cur.trans.dur;
    const inCut = index > 0 && t < cur.at + dur;
    const m = inCut ? clamp((t - cur.at) / dur) : 1;

    const B = evalShot(cur, t);
    const A = inCut ? evalShot(prev, t) : B;

    uniforms.uTexB.value = texOf(B.photo);
    uniforms.uTexA.value = texOf(A.photo);
    uniforms.uRectB.value.set(...B.rect);
    uniforms.uRectA.value.set(...A.rect);
    uniforms.uCardB.value.set(...B.card);
    uniforms.uCardA.value.set(...A.card);
    uniforms.uModeB.value.set(...B.mode);
    uniforms.uModeA.value.set(...A.mode);
    uniforms.uTexSizeB.value.set(B.photo.w, B.photo.h);
    uniforms.uTexSizeA.value.set(A.photo.w, A.photo.h);
    uniforms.uRotB.value = B.rot;
    uniforms.uRotA.value = A.rot;
    uniforms.uMix.value = m;
    uniforms.uTrans.value = inCut ? (TRANS_ID[cur.trans.type] ?? 0) : 0;
    uniforms.uDir.value.set(cur.trans.dir[0], cur.trans.dir[1]);

    // --- accents ------------------------------------------------------------
    const flashCut = inCut && cur.trans.type === 'flash' ? pulse(m) * 0.34 : 0;
    const openFlash = t < 0.5 ? Math.max(0, 0.55 - t * 1.6) : 0;
    uniforms.uFlash.value = Math.max(flashCut, openFlash);

    const sinceCut = t - cur.at;
    const shakeAmp = (cur.trans.type === 'flash' || cur.trans.type === 'punch')
      ? 0.0035 * Math.exp(-sinceCut * 9) : 0.0012 * Math.exp(-sinceCut * 6);
    // a permanent, very slow handheld drift keeps a still photograph breathing
    const driftX = Math.sin(t * 0.9 + 0.4) * 0.0009 + Math.sin(t * 2.3 + 1.9) * 0.0003;
    const driftY = Math.sin(t * 1.1 + 2.1) * 0.0010 + Math.sin(t * 2.9 + 0.7) * 0.0003;
    uniforms.uShake.value.set(
      driftX + Math.sin(t * 61.0) * shakeAmp * 0.6,
      driftY + Math.sin(t * 47.0 + 1.3) * shakeAmp,
    );

    // a sheen crosses the frame right after every hard accent
    uniforms.uSweep.value = 0;   // the sheen read as one effect too many

    // --- grade --------------------------------------------------------------
    const sc = sceneAt(t);
    const lt = t - sc.start;
    const openDark = t < 1.0 ? (1 - easeOutCubic(range(t, 0.0, 0.9))) * 0.75 : 0;
    uniforms.uDark.value = clamp(Math.max(B.dark * (inCut ? m : 1), openDark));
    uniforms.uCool.value = lerp(A.cool, B.cool, inCut ? m : 1);
    uniforms.uVignette.value = 0.38 + 0.18 * clamp(B.dark * 2);
    uniforms.uExposure.value = (1.03 + 0.03 * Math.sin(t * 1.3)) * lerp(A.expo, B.expo, inCut ? m : 1);
    uniforms.uTime.value = t;

    // --- the beat ------------------------------------------------------------
    const kick = beatKick(t);
    uniforms.uPunch.value = kick.punch;
    uniforms.uRoll.value = kick.roll;
    beatPass.uniforms.uSplit.value = kick.split;
    beatPass.uniforms.uLift.value = kick.punch * 0.9;

    // embers ride the fried-food chapters, fade out over the fruit
    const ember = sc.id === 'traiCay' ? 0.05 : sc.id === 'cta' ? 0.16 : 0.22;
    updateSparks(t, ember * (0.55 + 0.45 * Math.sin(t * 0.8 + 1.2)));

    composer.render();
    return kick;          // the overlay kicks with the picture
  }

  return { renderFrame, renderer };
}
