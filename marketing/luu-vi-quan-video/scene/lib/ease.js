// Timing / easing utilities. All animation is a pure function of the timeline clock.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Normalised 0..1 progress of `t` inside [start, end]. */
export const range = (t, start, end) => clamp((t - start) / (end - start));

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** Overshooting pop used for logos, price chips and anything that must feel snappy. */
export function easeOutBack(t, overshoot = 1.7) {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
}

/** Damped spring settle - great for objects landing on the table. */
export function easeOutElastic(t, amplitude = 1, period = 0.35) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const s = (period / (2 * Math.PI)) * Math.asin(1 / Math.max(1, amplitude));
  return amplitude * Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / period) + 1;
}

/** Bounce a value up and back down again (0 -> 1 -> 0). */
export const pulse = (t) => Math.sin(clamp(t) * Math.PI);

/** Smooth in/out envelope with independent attack and release. */
export function envelope(t, start, attack, hold, release) {
  const inP = range(t, start, start + attack);
  const outP = 1 - range(t, start + attack + hold, start + attack + hold + release);
  return clamp(Math.min(easeOutCubic(inP), easeInOutCubic(Math.max(0, outP))));
}
