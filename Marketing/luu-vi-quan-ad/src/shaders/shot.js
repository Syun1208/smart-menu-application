// Shader chinh: fit 16:9 -> 9:16, bien doi camera trong UV space, grade am,
// unsharp bu upscale, glow nhe, vignette, va tron 2 lop cho chuyen canh.
// Anh goc KHONG bao gio bi sinh lai - chi la mot phep lay mau => chu/gia/logo giu nguyen.

export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform vec2  uSizeA;      // kich thuoc texture A (px)
uniform vec2  uSizeB;
uniform float uHasB;

// camera cho tung lop: xy = pan, z = scale, w = rot
uniform vec4  uCamA;
uniform vec4  uCamB;
uniform float uFitA;       // 0 = cover, 1 = contain
uniform float uFitB;

// grade: x=warmth y=saturation z=contrast w=vignette
uniform vec4  uGradeA;
uniform vec4  uGradeB;
uniform vec2  uSharpen;    // x = luong sharpen lop A, y = lop B
uniform vec2  uGlow;       // x = glow lop A, y = lop B

uniform float uMix;        // 0 = A, 1 = B
uniform float uWhip;       // 0..1 do manh whip-blur khi chuyen canh
uniform vec3  uBackdrop;   // mau nen khi contain (letterbox)
uniform vec2  uFrame;      // kich thuoc khung dich (px)

const float PI = 3.14159265359;

vec2 rot2(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

// Dua vUv ve toa do lay mau, co ap camera + fit.
vec2 mapUv(vec2 uv, vec4 cam, float texAspect, float frameAspect, float fit) {
  vec2 p = uv - 0.5;
  p = rot2(p, cam.w);
  p /= max(cam.z, 0.0001);
  p += cam.xy;
  p += 0.5;

  float ratio = texAspect / frameAspect;
  // fit: 0 = cover (lap day khung, cat bot)
  //      1 = contain (vua tron trong khung, chua letterbox)
  //      2 = width (luon dung tron be ngang anh -> khong bao gio cat mat gia tren menu)
  vec2 m;
  if (fit > 1.5) {
    m = vec2(1.0, ratio);
  } else if (fit > 0.5) {
    m = (ratio > 1.0) ? vec2(1.0, ratio) : vec2(1.0 / ratio, 1.0);
  } else {
    m = (ratio > 1.0) ? vec2(1.0 / ratio, 1.0) : vec2(1.0, ratio);
  }
  p = 0.5 + (p - 0.5) * m;
  return p;
}

bool outside(vec2 uv) {
  return uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0;
}

vec3 sampleTex(sampler2D tex, vec2 uv) {
  return texture2D(tex, clamp(uv, vec2(0.0), vec2(1.0))).rgb;
}

// Unsharp mask 4 tap: bu lai do mem khi phong anh 720p len khung doc.
vec3 sharpen(sampler2D tex, vec2 uv, vec2 texSize, float amount) {
  if (amount <= 0.001) return sampleTex(tex, uv);
  vec2 t = 1.0 / texSize;
  vec3 c = sampleTex(tex, uv);
  vec3 blur = (
    sampleTex(tex, uv + vec2( t.x, 0.0)) +
    sampleTex(tex, uv + vec2(-t.x, 0.0)) +
    sampleTex(tex, uv + vec2(0.0,  t.y)) +
    sampleTex(tex, uv + vec2(0.0, -t.y))
  ) * 0.25;
  return c + (c - blur) * amount;
}

// Glow: lay mau rong ra roi chi giu phan sang => hoi nong / sot bong.
vec3 glowPass(sampler2D tex, vec2 uv, vec2 texSize, float amount) {
  if (amount <= 0.001) return vec3(0.0);
  vec2 t = 6.0 / texSize;
  vec3 acc = vec3(0.0);
  acc += sampleTex(tex, uv + vec2( t.x,  t.y));
  acc += sampleTex(tex, uv + vec2(-t.x,  t.y));
  acc += sampleTex(tex, uv + vec2( t.x, -t.y));
  acc += sampleTex(tex, uv + vec2(-t.x, -t.y));
  acc += sampleTex(tex, uv + vec2( 0.0, t.y * 1.8));
  acc += sampleTex(tex, uv + vec2( 0.0, -t.y * 1.8));
  acc /= 6.0;
  vec3 bright = max(acc - 0.62, vec3(0.0)) / 0.38;
  return bright * amount;
}

vec3 grade(vec3 c, vec4 g, vec2 uv) {
  // warmth: keo ve phia cam, hop voi anh do an
  c.r += g.x * 0.11;
  c.b -= g.x * 0.085;
  c.g += g.x * 0.018;
  // saturation
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, g.y);
  // contrast quanh diem giua
  c = (c - 0.5) * g.z + 0.5;
  // vignette
  vec2 d = (uv - 0.5) * vec2(1.0, 1.0);
  float v = 1.0 - g.w * dot(d, d) * 2.0;
  c *= clamp(v, 0.0, 1.0);
  return c;
}

vec3 layer(sampler2D tex, vec2 texSize, vec4 cam, float fit, vec4 g, float sh, float gl, vec2 uv, float frameAspect, float whip) {
  float texAspect = texSize.x / texSize.y;
  vec2 suv = mapUv(uv, cam, texAspect, frameAspect, fit);

  bool mayLetterbox = fit > 0.5;
  if (mayLetterbox && outside(suv)) return uBackdrop;

  vec3 c;
  if (whip > 0.001) {
    // whip-blur ngang: 5 tap doc theo truc x, tao cam giac lia may nhanh
    vec3 acc = vec3(0.0);
    float amt = whip * 0.045;
    for (int i = -2; i <= 2; i++) {
      vec2 o = vec2(float(i) * amt, 0.0);
      vec2 u2 = suv + o;
      if (mayLetterbox && outside(u2)) acc += uBackdrop;
      else acc += sampleTex(tex, u2);
    }
    c = acc / 5.0;
  } else {
    c = sharpen(tex, suv, texSize, sh);
  }

  c += glowPass(tex, suv, texSize, gl);
  return grade(c, g, uv);
}

void main() {
  float frameAspect = uFrame.x / uFrame.y;

  vec3 a = layer(uTexA, uSizeA, uCamA, uFitA, uGradeA, uSharpen.x, uGlow.x, vUv, frameAspect, uWhip);
  vec3 c = a;

  if (uHasB > 0.5 && uMix > 0.0001) {
    vec3 b = layer(uTexB, uSizeB, uCamB, uFitB, uGradeB, uSharpen.y, uGlow.y, vUv, frameAspect, uWhip);
    c = mix(a, b, uMix);
  }

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;
