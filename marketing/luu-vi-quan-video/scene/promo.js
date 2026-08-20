// Lưu Vị Quán - 3D food promo.
// One scene graph, six chapters, everything driven by a single clock so the render
// is deterministic: renderFrame(t) always produces the exact same image.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { VIDEO, SCENES, sceneAt } from './timeline.js';
import { woodTexture, kraftPaperTexture, radialSprite, starSprite, studioEnvTexture } from './textures.js';
import * as P from './props.js';
import { mulberry32, fbm3 } from './lib/noise.js';
import {
  clamp, lerp, range, easeOutCubic, easeInOutCubic, easeOutBack,
  easeOutElastic, easeOutExpo, pulse,
} from './lib/ease.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Colour grade / vignette / grain - the "shot on a warm lens" look
// ---------------------------------------------------------------------------
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uVignette: { value: 1.05 },
    uWarm: { value: 0.3 },
    uSaturation: { value: 1.14 },
    uFade: { value: 0 },      // 1 = black
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uFlash, uVignette, uWarm, uSaturation, uFade;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      // gentle chromatic aberration towards the frame edge
      vec2 dir = uv - 0.5;
      float d = length(dir);
      float ca = 0.0016 * d;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ca).b;

      // warm grade: lift the highlights towards amber, cool the shadows slightly
      col *= vec3(1.0 + 0.06 * uWarm, 1.0, 1.0 - 0.05 * uWarm);
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, uSaturation);
      col = pow(max(col, 0.0), vec3(0.98));

      // vignette
      float vig = smoothstep(0.95, 0.25, d * uVignette);
      col *= mix(0.66, 1.0, vig);

      // film grain
      float g = hash(uv * vec2(1920.0, 1080.0) + uTime * 37.0) - 0.5;
      col += g * 0.022;

      col += uFlash;
      col = mix(col, vec3(0.0), uFade);
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// ---------------------------------------------------------------------------
// Camera choreography: two anchors per chapter, eased between, plus handheld drift
// ---------------------------------------------------------------------------
const SHOTS = {
  hook: {
    from: { pos: V3(0.0, 1.17, 2.7), look: V3(0, 0.30, 0), fov: 46 },
    to:   { pos: V3(0.17, 2.88, 4.87), look: V3(0, -0.50, 0), fov: 54 },
    ease: easeInOutCubic,
  },
  nem: {
    from: { pos: V3(-2.99, 1.99, 3.34), look: V3(0, -0.05, 0), fov: 52 },
    to:   { pos: V3(1.74, 2.29, 4.04), look: V3(0.1, -0.05, 0), fov: 50 },
    ease: easeInOutCubic,
  },
  caVien: {
    from: { pos: V3(2.58, 3.55, 3.06), look: V3(0, 0.05, 0), fov: 50 },
    to:   { pos: V3(-1.32, 1.7, 4.32), look: V3(0, -0.1, 0), fov: 52 },
    ease: easeInOutCubic,
  },
  miTron: {
    from: { pos: V3(0.0, 4.57, 1.53), look: V3(0, 0.1, 0), fov: 50 },
    to:   { pos: V3(-0.63, 1.7, 4.04), look: V3(0, 0.05, 0), fov: 54 },
    ease: easeInOutCubic,
  },
  traiCay: {
    from: { pos: V3(-2.51, 2.36, 3.62), look: V3(0, -0.05, 0), fov: 50 },
    to:   { pos: V3(1.25, 2.88, 3.9), look: V3(0, -0.05, 0), fov: 52 },
    ease: easeInOutCubic,
  },
  cta: {
    from: { pos: V3(3.06, 2.44, 3.62), look: V3(0, -0.15, 0), fov: 52 },
    to:   { pos: V3(-3.06, 2.73, 3.76), look: V3(0, -0.15, 0), fov: 54 },
    ease: (t) => t, // steady orbit, no easing
  },
};

export async function createPromo({ canvas, width = VIDEO.width, height = VIDEO.height, quality = 'high' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120806);
  scene.fog = new THREE.FogExp2(0x140a06, 0.032);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);

  const env = studioEnvTexture(renderer);
  const envCool = studioEnvTexture(renderer, 'cool');
  scene.environment = env;
  P.initProps(env);

  const wood = woodTexture(1024);
  wood.repeat.set(4, 4);
  const kraft = kraftPaperTexture(1024);
  kraft.repeat.set(5, 5);

  // --- lighting ------------------------------------------------------------
  const ambient = new THREE.AmbientLight(0xffe9d2, 0.16);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffd2a1, 0x2a1108, 0.28);
  scene.add(hemi);

  const key = new THREE.SpotLight(0xfff2e2, 92, 26, Math.PI / 6.4, 0.72, 2.0);
  key.position.set(2.6, 5.4, 3.0);
  key.castShadow = true;
  key.shadow.mapSize.set(quality === 'high' ? 1024 : 512, quality === 'high' ? 1024 : 512);
  key.shadow.bias = -0.0012;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(0xffb27a, 0.95);
  rim.position.set(-4.5, 3.2, -3.6);
  scene.add(rim);

  const fill = new THREE.PointLight(0xffc898, 20, 16, 2);
  fill.position.set(-3.6, 3.6, 4.0);
  scene.add(fill);

  // cool kicker, only really used for the fruit chapter
  const cool = new THREE.DirectionalLight(0x9fd8ff, 0);
  cool.position.set(2.0, 4.0, -2.0);
  scene.add(cool);

  // --- shared set ----------------------------------------------------------
  const set = new THREE.Group();
  set.add(P.table(wood));
  const paper = P.paperSheet(kraft, { w: 6.6, d: 6.6 });
  paper.position.y = 0.006;
  paper.rotation.y = 0.22;
  scene.add(set, paper);

  // --- post processing -----------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(Math.round(width / 2), Math.round(height / 2)),
    0.34,  // strength
    0.8,   // radius
    0.86,  // threshold
  );
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  // --- chapters ------------------------------------------------------------
  const chapters = {
    hook: buildHook(),
    nem: buildNem(),
    caVien: buildCaVien(),
    miTron: buildMiTron(),
    traiCay: buildTraiCay(),
    cta: buildCta(),
  };
  for (const g of Object.values(chapters)) {
    g.group.visible = false;
    scene.add(g.group);
  }

  // The fruit chapter is the one cool, fresh beat in an otherwise amber film,
  // so its materials reflect a daylight studio instead of the warm one.
  chapters.traiCay.group.traverse((obj) => {
    if (!obj.isMesh) return;
    for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      if (!m || !('envMap' in m)) continue;
      m.envMap = envCool;
      m.envMapIntensity = 0.55;
      m.needsUpdate = true;
    }
  });

  const sparks = buildSparks();
  const steam = buildSteam();
  const glitter = buildGlitter();
  scene.add(sparks.points, steam.points, glitter.points);

  // =========================================================================
  // Chapter builders
  // =========================================================================

  /** A pile of assorted fried snacks inside a kraft box - the hero shot. */
  function mixedPile(seed = 5, count = 16) {
    const rnd = mulberry32(seed);
    const group = new THREE.Group();
    const items = [];
    for (let i = 0; i < count; i++) {
      const kind = rnd();
      let mesh;
      if (kind < 0.34) mesh = P.fishBall({ radius: 0.19 + rnd() * 0.07, seed: i * 7 + seed });
      else if (kind < 0.55) mesh = P.crispyBall({ radius: 0.17 + rnd() * 0.05, seed: i * 3 + seed });
      else if (kind < 0.7) mesh = P.dumpling({ radius: 0.2 + rnd() * 0.04, seed: i + seed });
      else if (kind < 0.82) mesh = P.friedRoll({ length: 0.5 + rnd() * 0.2, radius: 0.13, seed: i + seed });
      else if (kind < 0.92) mesh = P.sausage({ length: 0.5, radius: 0.1 });
      else mesh = P.tofuSkin({ w: 0.36, h: 0.5, seed: i });

      // pack them in rough rings so the pile reads as a full box
      const ring = i < 7 ? 0 : 1;
      const a = rnd() * Math.PI * 2;
      const r = ring === 0 ? rnd() * 0.42 : 0.42 + rnd() * 0.42;
      mesh.position.set(Math.cos(a) * r * 1.5, 0.16 + ring * 0.17 + rnd() * 0.08, Math.sin(a) * r);
      mesh.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      group.add(mesh);
      items.push({ mesh, base: mesh.position.clone(), phase: rnd() * 6.28 });
    }
    return { group, items };
  }

  function buildHook() {
    const group = new THREE.Group();
    const box = P.kraftBox({ w: 2.3, d: 1.7, h: 0.6, paperTex: kraft });
    group.add(box);
    const pile = mixedPile(9, 18);
    pile.group.position.y = 0.04;
    group.add(pile.group);

    const bowl = P.dipBowl({ radius: 0.36 });
    bowl.position.set(1.85, 0.02, 0.55);
    group.add(bowl);
    const dip = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshPhysicalMaterial({
      color: 0xc21a10, roughness: 0.1, clearcoat: 1, envMap: env, envMapIntensity: 1.4,
    }));
    dip.rotation.x = -Math.PI / 2;
    dip.position.set(1.85, 0.17, 0.55);
    group.add(dip);

    const chilliA = P.chilli({ length: 0.7 });
    chilliA.position.set(-1.75, 0.03, 0.9);
    chilliA.rotation.y = -0.5;
    group.add(chilliA);

    return {
      group,
      update(t, lt) {
        // the box settles into frame, then breathes
        const drop = easeOutElastic(range(lt, 0, 1.5), 1.05, 0.4);
        group.position.y = lerp(-0.5, 0, drop);
        group.rotation.y = lerp(-0.55, -0.12, easeOutCubic(range(lt, 0, 3.2)));
        for (const it of pile.items) {
          it.mesh.position.y = it.base.y + Math.sin(t * 1.6 + it.phase) * 0.006;
        }
      },
    };
  }

  function buildNem() {
    const group = new THREE.Group();
    const tray = P.kraftBox({ w: 2.6, d: 1.7, h: 0.42, paperTex: kraft });
    group.add(tray);

    // eight nem rolls that fly in one after another
    const rolls = [];
    const rnd = mulberry32(23);
    for (let i = 0; i < 8; i++) {
      const roll = P.friedRoll({ length: 0.78, radius: 0.155, seed: i * 5 + 1, bend: 0.1 + rnd() * 0.1 });
      const col = i % 4, row = Math.floor(i / 4);
      const target = V3(-0.99 + col * 0.66, 0.22 + row * 0.16, 0.34 - row * 0.62);
      roll.position.copy(target);
      // lie the rolls along Z so they read as separate pieces, not one long tube
      roll.rotation.set(Math.PI / 2, (rnd() - 0.5) * 0.35, (rnd() - 0.5) * 0.25);
      group.add(roll);
      rolls.push({ mesh: roll, target, tIn: i < 3 ? -1 : 0.1 + (i - 3) * 0.17, dir: i % 2 ? 1 : -1, spin: 4 + rnd() * 3 });
    }

    // nem xù dropping into the front of the tray
    const balls = [];
    for (let i = 0; i < 6; i++) {
      const b = P.crispyBall({ radius: 0.19 + rnd() * 0.04, seed: 40 + i });
      const target = V3(-0.75 + i * 0.3, 0.22, 0.55);
      b.position.copy(target);
      group.add(b);
      balls.push({ mesh: b, target, tIn: 1.0 + i * 0.1 });
    }

    // nem phô mai + cheese pull
    const stick = P.cheeseStick({ w: 0.8, h: 0.24, d: 0.24, seed: 12 });
    stick.position.set(0.75, 0.3, 0.4);
    stick.rotation.set(0.1, -0.35, 0.06);
    group.add(stick);
    const pulls = [];
    for (let i = 0; i < 3; i++) {
      const strand = P.cheesePull(V3(-0.1 + i * 0.1, 0, 0), V3(0.1 + i * 0.09, 0.9, 0.05 * i), { sag: 0.18, radius: 0.03 + i * 0.006, seed: i + 4 });
      strand.position.set(0.75, 0.2, 0.4);
      strand.visible = false;
      group.add(strand);
      pulls.push(strand);
    }

    const bowl = P.dipBowl({ radius: 0.34 });
    bowl.position.set(-1.7, 0.02, 0.75);
    group.add(bowl);
    const greens = P.greens({ count: 9, seed: 88, scale: 0.7 });
    greens.position.set(1.75, 0.03, -0.5);
    group.add(greens);

    return {
      group,
      update(t, lt) {
        for (const r of rolls) {
          const p = range(lt, r.tIn, r.tIn + 0.75);
          const e = easeOutBack(p, 1.25);
          const fly = 1 - e;
          r.mesh.position.set(
            r.target.x + r.dir * 4.2 * fly,
            r.target.y + 2.6 * fly * fly + Math.sin(p * Math.PI) * 0.5,
            r.target.z - 1.5 * fly,
          );
          r.mesh.rotation.y += 0; // keep the settled orientation
          r.mesh.rotation.x = Math.PI / 2 + fly * r.spin;
          r.mesh.scale.setScalar(p <= 0 ? 0.001 : 1);
        }
        for (const b of balls) {
          const p = range(lt, b.tIn, b.tIn + 0.6);
          const drop = easeOutElastic(p, 1.02, 0.32);
          b.mesh.position.y = lerp(2.4, b.target.y, drop);
          b.mesh.scale.setScalar(p <= 0 ? 0.001 : 1);
          b.mesh.rotation.x = (1 - p) * 5;
        }
        // cheese pull: the stick lifts out of the tray and the strands stretch
        const lift = easeOutCubic(range(lt, 4.2, 5.3));
        const back = easeInOutCubic(range(lt, 5.5, 6.0));
        const h = lerp(0, 1.15, lift) * (1 - back * 0.55);
        stick.position.y = 0.3 + h;
        stick.rotation.z = 0.06 + h * 0.25;
        pulls.forEach((s, i) => {
          s.visible = lift > 0.02;
          const stretch = Math.max(0.001, h / 0.9);
          s.scale.set(lerp(1, 0.45, clamp(stretch)), stretch, lerp(1, 0.45, clamp(stretch)));
          s.rotation.y = i * 0.4 + Math.sin(t * 1.5 + i) * 0.05;
        });
      },
    };
  }

  function buildCaVien() {
    const group = new THREE.Group();
    const box = P.kraftBox({ w: 2.35, d: 1.75, h: 0.6, paperTex: kraft });
    group.add(box);

    const rnd = mulberry32(57);
    const balls = [];
    for (let i = 0; i < 20; i++) {
      const b = P.fishBall({ radius: 0.2 + rnd() * 0.06, seed: i * 9, color: i % 5 === 0 ? 0xf5cd8e : 0xffe0a8 });
      const ring = i < 9 ? 0 : 1;
      const a = (i / 20) * Math.PI * 2 * 1.7 + rnd() * 0.4;
      const r = ring === 0 ? 0.15 + rnd() * 0.3 : 0.5 + rnd() * 0.35;
      const target = V3(Math.cos(a) * r * 1.35, 0.22 + ring * 0.2, Math.sin(a) * r);
      b.position.copy(target);
      group.add(b);
      balls.push({ mesh: b, target, tIn: i < 5 ? -1 : 0.15 + (i - 5) * 0.05, spin: rnd() * 6.28 });
    }

    const sauce = P.sauceBlob({ radius: 0.5, seed: 5 });
    sauce.position.set(-0.05, 0.34, 0.02);
    sauce.scale.setScalar(0.001);
    group.add(sauce);

    const drips = [];
    for (let i = 0; i < 5; i++) {
      const d = P.sauceBlob({ radius: 0.12 + rnd() * 0.06, seed: 30 + i });
      d.position.set((rnd() - 0.5) * 1.5, 0.36, (rnd() - 0.5) * 1.0);
      d.scale.setScalar(0.001);
      group.add(d);
      drips.push({ mesh: d, tIn: 1.9 + i * 0.12 });
    }

    const nuts = P.crumbs(70, 0.85, 15);
    nuts.position.set(-0.05, 0.52, 0.02);
    group.add(nuts);

    const veg = P.greens({ count: 13, seed: 44, scale: 0.85 });
    veg.position.set(1.55, 0.05, 0.15);
    group.add(veg);

    const chilliA = P.chilli({ length: 0.8 });
    chilliA.position.set(-1.85, 0.04, 0.85);
    chilliA.rotation.y = 0.4;
    group.add(chilliA);

    return {
      group,
      update(t, lt) {
        for (const b of balls) {
          const p = range(lt, b.tIn, b.tIn + 0.85);
          const drop = easeOutElastic(p, 1.04, 0.3);
          b.mesh.position.set(b.target.x, lerp(3.4, b.target.y, drop), b.target.z);
          b.mesh.rotation.set(b.spin + (1 - p) * 7, b.spin, 0);
          b.mesh.scale.setScalar(p <= 0 ? 0.001 : 1);
        }
        const pour = range(lt, 1.6, 2.7);
        const po = easeOutCubic(pour);
        sauce.scale.set(po * 1.15, po * 0.5, po * 1.15);
        sauce.position.y = lerp(1.4, 0.3, po);
        for (const d of drips) {
          const p = range(lt, d.tIn, d.tIn + 0.5);
          d.mesh.scale.setScalar(easeOutBack(p) * 0.9);
        }
        const sprinkle = range(lt, 2.5, 3.4);
        nuts.scale.setScalar(easeOutCubic(sprinkle));
        nuts.position.y = lerp(1.0, 0.54, easeOutCubic(sprinkle));
        group.rotation.y = -0.15 + lt * 0.035;
      },
    };
  }

  function buildMiTron() {
    const group = new THREE.Group();
    const box = P.kraftBox({ w: 2.4, d: 1.8, h: 0.58, paperTex: kraft });
    group.add(box);

    const nest = P.noodleNest({ strands: 18, radius: 0.9, seed: 3 });
    nest.position.y = 0.2;
    group.add(nest);

    const toppings = [];
    const rnd = mulberry32(71);
    const specs = [
      () => P.sausage({ length: 0.62, radius: 0.12 }),
      () => P.fishBall({ radius: 0.22, seed: 2 }),
      () => P.dumpling({ radius: 0.24, seed: 8 }),
      () => P.crispyBall({ radius: 0.2, seed: 9 }),
      () => P.fishBall({ radius: 0.2, seed: 4, color: 0xf5cd8e }),
    ];
    specs.forEach((make, i) => {
      const m = make();
      const a = (i / specs.length) * Math.PI * 2 + 0.4;
      const target = V3(Math.cos(a) * 0.72, 0.42, Math.sin(a) * 0.52);
      m.position.copy(target);
      m.rotation.set(rnd() * 3, rnd() * 6.28, rnd() * 0.6);
      group.add(m);
      toppings.push({ mesh: m, target, tIn: 0.5 + i * 0.16 });
    });

    const egg = P.friedEgg({ radius: 0.52 });
    egg.position.set(-0.1, 0.46, -0.1);
    group.add(egg);

    const melt = P.cheeseMelt({ radius: 0.62, seed: 6 });
    melt.position.set(-0.05, 0.44, 0.05);
    melt.material.opacity = 0;
    group.add(melt);

    const pulls = [];
    for (let i = 0; i < 3; i++) {
      const s = P.cheesePull(V3(0, 0, 0), V3((i - 1) * 0.1, 1.0, 0), { sag: 0.14, radius: 0.05, seed: i + 9 });
      s.position.set((i - 1) * 0.16, 0.46, (i % 2 ? 0.12 : -0.1));
      s.visible = false;
      group.add(s);
      pulls.push(s);
    }

    const nuts = P.crumbs(50, 0.8, 22);
    nuts.position.set(0, 0.56, 0);
    group.add(nuts);

    const chopstickMat = new THREE.MeshStandardMaterial({ color: 0x9a6a34, roughness: 0.55 });
    const sticks = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.042, 1.9, 8), chopstickMat);
      stick.rotation.set(0.5, 0.1, 0.62 + i * 0.05);
      stick.position.set(0.52 + i * 0.09, 0.88, 0.52);
      stick.castShadow = true;
      sticks.add(stick);
    }
    // the mouthful hanging between the chopsticks
    const bite = new THREE.Group();
    bite.add(P.noodleNest({ strands: 6, radius: 0.3, seed: 12 }));
    const biteBall = P.fishBall({ radius: 0.17, seed: 33 });
    biteBall.position.set(0.06, -0.1, 0.04);
    bite.add(biteBall);
    bite.scale.setScalar(0.85);
    bite.position.set(0.0, 0.42, 0.16);
    sticks.add(bite);
    group.add(sticks);

    return {
      group,
      update(t, lt) {
        nest.rotation.y = -0.4 + lt * 0.18;
        for (const tp of toppings) {
          const p = range(lt, tp.tIn, tp.tIn + 0.7);
          tp.mesh.position.y = lerp(2.6, tp.target.y, easeOutElastic(p, 1.03, 0.32));
          tp.mesh.scale.setScalar(p <= 0 ? 0.001 : 1);
        }
        const eggIn = range(lt, 1.5, 2.2);
        egg.position.y = lerp(2.8, 0.46, easeOutElastic(eggIn, 1.02, 0.35));
        egg.scale.setScalar(eggIn <= 0 ? 0.001 : 1);

        const meltIn = range(lt, 1.2, 2.6);
        melt.material.opacity = easeOutCubic(meltIn) * 0.92;
        melt.scale.set(lerp(0.4, 1.15, easeOutCubic(meltIn)), lerp(0.4, 0.8, easeOutCubic(meltIn)), lerp(0.4, 1.05, easeOutCubic(meltIn)));

        // chopsticks lift a cheesy bite out of the bowl
        const lift = easeOutCubic(range(lt, 2.4, 4.0));
        const drop = easeInOutCubic(range(lt, 4.4, 5.2));
        const h = lift * (1 - drop * 0.6);
        sticks.position.y = h * 1.5;
        sticks.rotation.z = h * 0.12;
        pulls.forEach((s, i) => {
          s.visible = h > 0.03;
          const stretch = Math.max(0.001, h * 1.45);
          s.scale.set(lerp(1, 0.5, clamp(h)), stretch, lerp(1, 0.5, clamp(h)));
          s.rotation.y = Math.sin(t * 1.2 + i * 1.7) * 0.12;
        });
        nuts.scale.setScalar(easeOutCubic(range(lt, 2.0, 2.8)));
      },
    };
  }

  function buildTraiCay() {
    const group = new THREE.Group();
    const rnd = mulberry32(101);
    const palette = [
      { c: 0xff3f5f, rind: 0x2f9b4a },  // dưa hấu
      { c: 0xffb01f, rind: null },      // xoài
      { c: 0xfff0f4, rind: 0xff5aa0 },  // thanh long
      { c: 0xd6f07a, rind: null },      // ổi
      { c: 0xf6c93c, rind: null },      // thơm
    ];

    const cups = [];
    for (let i = 0; i < 3; i++) {
      const cup = P.kraftBox({ w: 1.28, d: 1.28, h: 0.34, paperTex: kraft });
      cup.position.set(-1.45 + i * 1.45, 0, i === 1 ? -0.42 : 0.26);
      group.add(cup);
      cups.push(cup);
    }

    const pieces = [];
    for (let i = 0; i < 34; i++) {
      const spec = palette[i % palette.length];
      const cupIdx = i % 3;
      // three cups, filled in rotation so they rise together
      const isGrape = i % 7 === 3;
      const m = isGrape
        ? P.grape({ radius: 0.13, color: i % 2 ? 0x9ad84f : 0x7a3fa8, seed: i })
        : P.fruitCube({ size: 0.32 + rnd() * 0.1, color: spec.c, rind: spec.rind, seed: i * 3 });
      const cup = cups[cupIdx];
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 0.4;
      const target = V3(cup.position.x + Math.cos(a) * r, 0.28 + Math.floor(i / 12) * 0.26 + rnd() * 0.06, cup.position.z + Math.sin(a) * r * 0.9);
      m.position.copy(target);
      m.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      group.add(m);
      pieces.push({ mesh: m, target, tIn: i < 6 ? -1 : 0.2 + (i - 6) * 0.05, spin: rnd() * 6 });
    }

    return {
      group,
      update(t, lt) {
        for (const p of pieces) {
          const k = range(lt, p.tIn, p.tIn + 0.75);
          p.mesh.position.set(p.target.x, lerp(3.2, p.target.y, easeOutElastic(k, 1.03, 0.3)), p.target.z);
          p.mesh.rotation.x = p.spin + (1 - k) * 6;
          p.mesh.scale.setScalar(k <= 0 ? 0.001 : 1);
        }
        group.rotation.y = 0.12 - lt * 0.03;
      },
    };
  }

  function buildCta() {
    const group = new THREE.Group();
    const box = P.kraftBox({ w: 2.4, d: 1.8, h: 0.62, paperTex: kraft });
    group.add(box);
    const pile = mixedPile(77, 20);
    pile.group.position.y = 0.06;
    group.add(pile.group);

    const bowl = P.dipBowl({ radius: 0.38 });
    bowl.position.set(1.95, 0.02, 0.6);
    group.add(bowl);
    const veg = P.greens({ count: 10, seed: 66, scale: 0.75 });
    veg.position.set(-1.9, 0.04, 0.3);
    group.add(veg);
    const chilliA = P.chilli({ length: 0.75 });
    chilliA.position.set(1.4, 0.03, -1.0);
    group.add(chilliA);

    return {
      group,
      update(t, lt) {
        group.rotation.y = -0.3 + lt * 0.085;
        const rise = easeOutCubic(range(lt, 0, 1.2));
        group.position.y = lerp(-0.35, 0, rise);
        for (const it of pile.items) {
          it.mesh.position.y = it.base.y + Math.sin(t * 1.9 + it.phase) * 0.008;
        }
      },
    };
  }

  // =========================================================================
  // Particle systems - sizzle sparks, steam and sparkle bursts
  // =========================================================================

  function makePoints(count, material) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const pts = new THREE.Points(geo, material);
    pts.frustumCulled = false;
    return pts;
  }

  function buildSparks(count = 130) {
    const rnd = mulberry32(303);
    const sprite = radialSprite(64, 'rgba(255,214,150,1)');
    const material = new THREE.PointsMaterial({
      size: 0.075, map: sprite, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffc070,
    });
    const points = makePoints(count, material);
    const data = Array.from({ length: count }, () => ({
      a: rnd() * Math.PI * 2,
      r: 0.2 + rnd() * 1.3,
      life: 0.8 + rnd() * 1.4,
      off: rnd() * 3,
      rise: 0.7 + rnd() * 1.5,
      drift: (rnd() - 0.5) * 0.5,
    }));
    return {
      points,
      update(t, intensity, y0 = 0.4) {
        material.opacity = intensity;
        if (intensity <= 0.001) return;
        const pos = points.geometry.attributes.position;
        for (let i = 0; i < count; i++) {
          const d = data[i];
          const p = ((t + d.off) % d.life) / d.life;
          const fall = p * p;
          pos.setXYZ(i,
            Math.cos(d.a) * d.r + d.drift * p,
            y0 + p * d.rise - fall * 0.55,
            Math.sin(d.a) * d.r * 0.8 + d.drift * p * 0.5);
        }
        pos.needsUpdate = true;
        material.size = 0.05 + 0.03 * Math.sin(t * 6);
      },
    };
  }

  function buildSteam(count = 55) {
    const rnd = mulberry32(404);
    const sprite = radialSprite(128, 'rgba(255,246,232,1)');
    const material = new THREE.PointsMaterial({
      size: 0.85, map: sprite, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.NormalBlending, color: 0xfff2e0,
    });
    const points = makePoints(count, material);
    const data = Array.from({ length: count }, () => ({
      x: (rnd() - 0.5) * 1.8,
      z: (rnd() - 0.5) * 1.2,
      life: 2.6 + rnd() * 2.4,
      off: rnd() * 5,
      sway: (rnd() - 0.5) * 0.9,
    }));
    return {
      points,
      update(t, intensity) {
        material.opacity = intensity * 0.07;
        if (intensity <= 0.001) return;
        const pos = points.geometry.attributes.position;
        for (let i = 0; i < count; i++) {
          const d = data[i];
          const p = ((t + d.off) % d.life) / d.life;
          pos.setXYZ(i,
            d.x + Math.sin(p * 3 + d.off) * d.sway * p,
            0.35 + p * 2.6,
            d.z + Math.cos(p * 2 + d.off) * d.sway * 0.6 * p);
        }
        pos.needsUpdate = true;
        material.size = 0.45 + 0.8 * ((t * 0.1) % 1);
      },
    };
  }

  function buildGlitter(count = 34) {
    const rnd = mulberry32(505);
    const material = new THREE.PointsMaterial({
      size: 0.5, map: starSprite(128), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffd9a0,
    });
    const points = makePoints(count, material);
    const data = Array.from({ length: count }, () => ({
      a: rnd() * Math.PI * 2,
      r: 0.6 + rnd() * 2.4,
      y: 0.3 + rnd() * 2.4,
      off: rnd(),
    }));
    const pos = points.geometry.attributes.position;
    data.forEach((d, i) => pos.setXYZ(i, Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r * 0.7));
    pos.needsUpdate = true;
    return {
      points,
      update(t, intensity) {
        material.opacity = intensity;
        material.size = 0.16 + 0.16 * Math.abs(Math.sin(t * 3.1));
        points.rotation.y = t * 0.15;
      },
    };
  }

  // =========================================================================
  // Camera + lighting choreography
  // =========================================================================

  const lookTarget = new THREE.Vector3();

  function updateCamera(t) {
    const sc = sceneAt(t);
    const shot = SHOTS[sc.id];
    const p = clamp((t - sc.start) / (sc.end - sc.start));
    const e = shot.ease(p);

    camera.position.lerpVectors(shot.from.pos, shot.to.pos, e);
    lookTarget.lerpVectors(shot.from.look, shot.to.look, e);
    camera.fov = lerp(shot.from.fov, shot.to.fov, e);

    // handheld drift so nothing feels like a CAD turntable
    camera.position.x += (fbm3(t * 0.55, 1.3, 0, 3) - 0.5) * 0.09;
    camera.position.y += (fbm3(t * 0.47, 7.1, 0, 3) - 0.5) * 0.07;

    // whip-pan out of every cut
    const since = t - sc.start;
    if (since < 0.32) {
      const w = 1 - since / 0.32;
      const dir = SCENES.indexOf(sc) % 2 === 0 ? 1 : -1;
      camera.position.x += dir * w * w * 1.9;
      camera.position.z += w * w * 0.8;
    }

    camera.lookAt(lookTarget);
    camera.rotation.z += Math.sin(t * 0.6) * 0.006;
    camera.updateProjectionMatrix();
  }

  function updateLights(t, id, lt) {
    // hook: the spotlight snaps on and settles
    if (id === 'hook') {
      const on = lt < 0.35 ? 0.05 : 1;
      const flicker = lt < 0.55 ? 0.75 + 0.35 * Math.sin(lt * 60) : 1;
      key.intensity = 92 * on * flicker;
      ambient.intensity = 0.06 + 0.12 * clamp(range(lt, 0.3, 1.6));
    } else {
      key.intensity = 92;
      ambient.intensity = 0.24;
    }

    // fruit chapter turns the room fresh and bright
    const fresh = id === 'traiCay' ? easeOutCubic(range(lt, 0, 0.8)) : 0;
    cool.intensity = fresh * 1.5;
    hemi.intensity = lerp(0.28, 0.9, fresh);
    scene.fog.density = lerp(0.032, 0.016, fresh);
    rim.intensity = lerp(1.1, 0.32, fresh);
    renderer.toneMappingExposure = lerp(0.95, 0.88, fresh);
  key.intensity = lerp(key.intensity, 62, fresh);
  key.color.setHex(fresh > 0.5 ? 0xf2f7ff : 0xfff2e2);
  fill.intensity = lerp(20, 3, fresh);
  rim.color.setHex(fresh > 0.5 ? 0x9ec8ff : 0xffb27a);
  ambient.color.setHex(fresh > 0.5 ? 0xdce8f5 : 0xffe9d2);
  scene.background.setHex(fresh > 0.5 ? 0x0e1116 : 0x120806);
  scene.fog.color.setHex(fresh > 0.5 ? 0x0e1116 : 0x140a06);

    // key light orbits slowly for living highlights
    key.position.set(Math.cos(t * 0.22) * 3.2, 5.2, Math.sin(t * 0.22) * 2.6 + 1.4);
    key.target.position.set(0, 0.4, 0);
    key.target.updateMatrixWorld();
  }

  // =========================================================================
  // Frame renderer
  // =========================================================================

  const FLASH_AT = SCENES.map((s) => s.start).filter((s) => s > 0);

  function renderFrame(t) {
    const sc = sceneAt(t);
    const lt = t - sc.start;

    for (const [id, ch] of Object.entries(chapters)) ch.group.visible = id === sc.id;
    chapters[sc.id].update(t, lt);

    updateCamera(t);
    updateLights(t, sc.id, lt);

    // particle intensities per chapter
    const fryHeat = (sc.id === 'nem' ? clamp(1 - range(lt, 2.0, 4.0)) : 0)
      + (sc.id === 'caVien' ? 0.5 * clamp(1 - range(lt, 2.4, 4.5)) : 0)
      + (sc.id === 'hook' ? 0.45 : 0);
    sparks.update(t, clamp(fryHeat) * 0.5, sc.id === 'hook' ? 0.5 : 0.45);
    const steamy = sc.id === 'miTron' ? 0.6 : sc.id === 'hook' ? 0.35 : sc.id === 'nem' ? 0.3 : sc.id === 'cta' ? 0.4 : 0.1;
    steam.update(t, steamy);
    const sparkleBursts = [2.05, 9.4, 20.8, 27.1, 31.7];
    let glow = 0;
    for (const b of sparkleBursts) glow = Math.max(glow, pulse(range(t, b, b + 1.1)) * 0.9);
    glitter.update(t, glow);

    // cuts: a short white flash + bloom kick
    let flash = 0;
    for (const f of FLASH_AT) {
      if (t >= f - 0.05 && t < f + 0.25) flash = Math.max(flash, 0.34 * (1 - (t - (f - 0.05)) / 0.3));
    }
    if (t >= 1.95 && t < 2.25) flash = Math.max(flash, 0.4 * (1 - (t - 1.95) / 0.3));
    grade.uniforms.uFlash.value = flash;
    grade.uniforms.uTime.value = t;
    grade.uniforms.uSaturation.value = sc.id === 'traiCay' ? 1.24 : 1.14;
    grade.uniforms.uWarm.value = sc.id === 'traiCay' ? 0.05 : 0.3;

    // fade from / to black
    const fadeIn = 1 - easeOutCubic(range(t, 0, 0.6));
    const fadeOut = easeInOutCubic(range(t, VIDEO.duration - 1.1, VIDEO.duration));
    grade.uniforms.uFade.value = Math.max(fadeIn, fadeOut);

    bloom.threshold = sc.id === 'traiCay' ? 0.95 : 0.9;
    bloom.strength = 0.3 + glow * 0.3 + flash * 0.5 + (sc.id === 'traiCay' ? 0.08 : 0);

    composer.render();
  }

  return { renderer, scene, camera, composer, renderFrame };
}
