// Pass cuoi cho EffectComposer: grain phim + S-curve rat nhe.
// Dung ShaderPass (three/addons/postprocessing/ShaderPass.js).
export const GrainShader = {
  name: 'GrainShader',
  uniforms: {
    tDiffuse: { value: null },
    uAmount:  { value: 0.030 },
    uSeed:    { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uAmount;
    uniform float uSeed;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // S-curve nhe cho do sau
      c = c * c * (3.0 - 2.0 * c) * 0.18 + c * 0.82;
      float n = hash(vUv * 1024.0 + uSeed) - 0.5;
      c += n * uAmount;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `,
};
