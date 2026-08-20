// Procedural food props. Everything is built from Three.js primitives that are then
// pushed around by noise, so the dishes look hand-made instead of geometric.

import * as THREE from 'three';
import { mulberry32, fbm3 } from './lib/noise.js';
import { crustTextures, speckleTexture, radialSprite } from './textures.js';

let SHARED = null;

/** Build the texture/material set once and reuse it for every prop. */
export function initProps(env) {
  const golden = crustTextures(512, [1.0, 1.0, 1.0]);
  const deepFried = crustTextures(512, [0.92, 0.82, 0.72]);
  SHARED = {
    env,
    golden,
    deepFried,
    crumb: speckleTexture(512, 4200, '#8a4a16'),
    sprite: radialSprite(128),
    materials: {},
  };
  return SHARED;
}

function mat(key, make) {
  if (!SHARED.materials[key]) SHARED.materials[key] = make();
  return SHARED.materials[key];
}

const crustMat = (tint = 0xfff0d8, tex = 'golden') =>
  mat(`crust-${tint}-${tex}`, () =>
    new THREE.MeshStandardMaterial({
      color: tint,
      map: SHARED[tex].map,
      bumpMap: SHARED[tex].bumpMap,
      bumpScale: 0.35,
      roughness: 0.52,
      metalness: 0.0,
      envMap: SHARED.env,
      envMapIntensity: 0.28,
    }));

const glossMat = (color, roughness = 0.18, extra = {}) =>
  mat(`gloss-${color}-${roughness}-${JSON.stringify(extra)}`, () =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness: 0.02,
      envMap: SHARED.env,
      envMapIntensity: 0.5,
      ...extra,
    }));

/** Push vertices around with fbm so a primitive stops looking like a primitive. */
function roughen(geometry, amount, freq, seed = 1) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = fbm3(x * freq + seed, y * freq + seed * 2, z * freq + seed * 3, 3) - 0.5;
    const len = Math.hypot(x, y, z) || 1;
    pos.setXYZ(i, x + (x / len) * n * amount, y + (y / len) * n * amount, z + (z / len) * n * amount);
  }
  geometry.computeVertexNormals();
  return geometry;
}

// ---------------------------------------------------------------------------
// Nem (spring rolls)
// ---------------------------------------------------------------------------

/** Nem trần / nem rán: a slightly bent, blistered golden roll. */
export function friedRoll({ length = 1.5, radius = 0.24, seed = 3, bend = 0.12 } = {}) {
  const g = new THREE.CapsuleGeometry(radius, length, 6, 20);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // gentle banana bend + wrapper wrinkles
    const bendX = x + bend * (y * y) * 0.9;
    const n = fbm3(x * 6 + seed, y * 3.5 + seed, z * 6, 3) - 0.5;
    const r = Math.hypot(bendX, z) || 1;
    pos.setXYZ(i, bendX + (bendX / r) * n * 0.05, y, z + (z / r) * n * 0.05);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, crustMat(0xffe8c4));
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.rotation.z = Math.PI / 2; // lie down
  return mesh;
}

/** Nem xù: shaggy breadcrumb-coated ball. */
export function crispyBall({ radius = 0.26, seed = 11 } = {}) {
  const g = roughen(new THREE.IcosahedronGeometry(radius, 3), radius * 0.34, 12, seed);
  const m = mat('crumb', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf2ca8e,
      roughness: 0.78,
      envMap: SHARED.env,
      envMapIntensity: 0.5,
    }));
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Nem phô mai: crumbed cheese stick. */
export function cheeseStick({ w = 0.9, h = 0.26, d = 0.26, seed = 5 } = {}) {
  const g = roughen(new THREE.BoxGeometry(w, h, d, 8, 4, 4), 0.05, 9, seed);
  const mesh = new THREE.Mesh(g, crustMat(0xfff0d4, 'deepFried'));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Stretchy mozzarella strand between two points - the classic cheese-pull shot. */
export function cheesePull(from, to, { sag = 0.35, radius = 0.035, seed = 2 } = {}) {
  const rnd = mulberry32(seed);
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const p = i / 6;
    const v = new THREE.Vector3().lerpVectors(from, to, p);
    v.y -= Math.sin(p * Math.PI) * sag;
    v.x += (rnd() - 0.5) * 0.06;
    v.z += (rnd() - 0.5) * 0.06;
    pts.push(v);
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 28, radius, 6, false);
  const m = mat('cheese', () =>
    new THREE.MeshStandardMaterial({
      color: 0xffe9a8,
      roughness: 0.34,
      envMap: SHARED.env,
      envMapIntensity: 0.9,
      transparent: true,
      opacity: 0.97,
    }));
  return new THREE.Mesh(g, m);
}

// ---------------------------------------------------------------------------
// Cá viên (fish balls) & friends
// ---------------------------------------------------------------------------

export function fishBall({ radius = 0.28, seed = 7, color = 0xffe0a8 } = {}) {
  const g = roughen(new THREE.SphereGeometry(radius, 20, 14), radius * 0.09, 5, seed);
  g.scale(1, 0.92, 1);
  const mesh = new THREE.Mesh(g, crustMat(color));
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function sausage({ length = 0.9, radius = 0.13 } = {}) {
  const g = new THREE.CapsuleGeometry(radius, length, 6, 16);
  const mesh = new THREE.Mesh(g, glossMat(0xd6452a, 0.22));
  mesh.rotation.z = Math.PI / 2;
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** Há cảo / dumpling: pleated pale parcel. */
export function dumpling({ radius = 0.3, seed = 13 } = {}) {
  const group = new THREE.Group();
  const body = roughen(new THREE.SphereGeometry(radius, 18, 12), radius * 0.12, 6, seed);
  body.scale(1.05, 0.7, 1);
  const m = glossMat(0xf6dfa0, 0.45);
  const mesh = new THREE.Mesh(body, m);
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 1.2 - Math.PI * 0.6;
    const pleat = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.16, 8, 6), m);
    pleat.position.set(Math.cos(a) * radius * 0.85, radius * 0.5, Math.sin(a) * radius * 0.5);
    group.add(pleat);
  }
  return group;
}

/** Bánh phồng / tofu skin strip with a wavy edge. */
export function tofuSkin({ w = 0.5, h = 0.7, seed = 17 } = {}) {
  const g = new THREE.PlaneGeometry(w, h, 10, 12);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(y * 14 + seed) * 0.035 + (fbm3(x * 8, y * 8, seed, 2) - 0.5) * 0.05);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    color: 0xf7d9a0,
    map: SHARED.golden.map,
    bumpMap: SHARED.golden.bumpMap,
    bumpScale: 0.25,
    roughness: 0.6,
    side: THREE.DoubleSide,
    envMap: SHARED.env,
    envMapIntensity: 0.5,
  }));
  mesh.castShadow = true;
  return mesh;
}

/** Glossy chilli-garlic glaze blob that can be poured over a pile of food. */
export function sauceBlob({ radius = 0.5, seed = 21 } = {}) {
  const g = roughen(new THREE.SphereGeometry(radius, 22, 16), radius * 0.2, 3, seed);
  g.scale(1, 0.42, 1);
  const m = mat('sauce', () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xb2160c,
      roughness: 0.12,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap: SHARED.env,
      envMapIntensity: 1.5,
      transparent: true,
      opacity: 0.96,
    }));
  return new THREE.Mesh(g, m);
}

/** Peanut / fried garlic crumbs sprinkled on top. */
export function crumbs(count = 60, spread = 0.9, seed = 31) {
  const rnd = mulberry32(seed);
  const g = roughen(new THREE.IcosahedronGeometry(0.035, 1), 0.012, 30, seed);
  const m = glossMat(0xe8b34a, 0.55);
  const inst = new THREE.InstancedMesh(g, m, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * spread;
    dummy.position.set(Math.cos(a) * r, rnd() * 0.05, Math.sin(a) * r);
    dummy.rotation.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
    const s = 0.7 + rnd() * 0.8;
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.castShadow = true;
  return inst;
}

/** Rau muống xào tỏi: a tangle of green stems with leaves. */
export function greens({ count = 14, seed = 41, scale = 1 } = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const stemMat = glossMat(0x3f8f2a, 0.4);
  const leafMat = glossMat(0x2f7a1f, 0.45, { side: THREE.DoubleSide });
  for (let i = 0; i < count; i++) {
    const pts = [];
    const base = new THREE.Vector3((rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.0);
    for (let k = 0; k <= 4; k++) {
      pts.push(new THREE.Vector3(
        base.x + (rnd() - 0.5) * 0.5 * k,
        base.y + k * 0.12 + rnd() * 0.05,
        base.z + (rnd() - 0.5) * 0.4 * k,
      ));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.022, 5, false);
    group.add(new THREE.Mesh(tube, stemMat));
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), leafMat);
    leaf.scale.set(1.5, 0.16, 0.7);
    leaf.position.copy(pts[4]);
    leaf.rotation.set(rnd(), rnd() * 6.28, rnd());
    group.add(leaf);
  }
  group.scale.setScalar(scale);
  return group;
}

// ---------------------------------------------------------------------------
// Mì trộn (mixed noodles)
// ---------------------------------------------------------------------------

/** A nest of springy egg noodles. */
export function noodleNest({ strands = 16, radius = 0.85, seed = 53 } = {}) {
  const rnd = mulberry32(seed);
  const group = new THREE.Group();
  const m = mat('noodle', () =>
    new THREE.MeshStandardMaterial({
      color: 0xf7d271,
      roughness: 0.35,
      envMap: SHARED.env,
      envMapIntensity: 1.0,
    }));
  for (let s = 0; s < strands; s++) {
    const pts = [];
    const turns = 1.4 + rnd() * 1.6;
    const r0 = radius * (0.35 + rnd() * 0.65);
    const phase = rnd() * Math.PI * 2;
    const yBase = rnd() * 0.16;
    for (let i = 0; i <= 14; i++) {
      const p = i / 14;
      const a = phase + p * Math.PI * 2 * turns;
      const r = r0 * (0.75 + 0.35 * Math.sin(p * Math.PI * 2 + phase));
      pts.push(new THREE.Vector3(
        Math.cos(a) * r,
        yBase + Math.sin(p * Math.PI * 3 + phase) * 0.07,
        Math.sin(a) * r,
      ));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.028, 5, false);
    const mesh = new THREE.Mesh(tube, m);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

export function friedEgg({ radius = 0.55 } = {}) {
  const group = new THREE.Group();
  const whiteGeo = roughen(new THREE.CircleGeometry(radius, 28), radius * 0.12, 4, 61);
  whiteGeo.rotateX(-Math.PI / 2);
  const white = new THREE.Mesh(whiteGeo, glossMat(0xfff6e6, 0.32, { side: THREE.DoubleSide }));
  white.receiveShadow = true;
  group.add(white);
  const yolk = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.36, 20, 14), glossMat(0xffa514, 0.14));
  yolk.scale.set(1, 0.55, 1);
  yolk.position.y = radius * 0.1;
  yolk.castShadow = true;
  group.add(yolk);
  return group;
}

/** Melted mozzarella cap that can be blended in over time. */
export function cheeseMelt({ radius = 0.9, seed = 71 } = {}) {
  const g = roughen(new THREE.SphereGeometry(radius, 24, 16), radius * 0.16, 3, seed);
  g.scale(1, 0.3, 1);
  const m = mat('melt', () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xf7dda0,
      roughness: 0.42,
      clearcoat: 0.35,
      envMap: SHARED.env,
      envMapIntensity: 0.5,
      transparent: true,
      opacity: 1,
    }));
  return new THREE.Mesh(g, m.clone());
}

// ---------------------------------------------------------------------------
// Trái cây (cut fruit)
// ---------------------------------------------------------------------------

export function fruitCube({ size = 0.34, color = 0xff4d6a, rind = null, seed = 83 } = {}) {
  const group = new THREE.Group();
  const g = roughen(new THREE.BoxGeometry(size, size, size, 3, 3, 3), size * 0.06, 8, seed);
  const flesh = new THREE.Mesh(g, glossMat(color, 0.36, { transparent: true, opacity: 0.98 }));
  flesh.castShadow = flesh.receiveShadow = true;
  group.add(flesh);
  if (rind !== null) {
    const skin = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, size * 0.14, size * 1.02), glossMat(rind, 0.4));
    skin.position.y = -size * 0.5;
    group.add(skin);
  }
  return group;
}

export function grape({ radius = 0.16, color = 0x8fd44a, seed = 91 } = {}) {
  const g = roughen(new THREE.SphereGeometry(radius, 16, 12), radius * 0.05, 6, seed);
  g.scale(1, 1.15, 1);
  return new THREE.Mesh(g, glossMat(color, 0.2));
}

// ---------------------------------------------------------------------------
// Packaging & set dressing
// ---------------------------------------------------------------------------

/** Open kraft takeaway box, matching the brown paper bowls in the brand photos. */
export function kraftBox({ w = 2.2, d = 1.6, h = 0.62, thickness = 0.05, paperTex = null } = {}) {
  const group = new THREE.Group();
  const outer = new THREE.MeshStandardMaterial({
    color: 0xc79a63,
    map: paperTex || null,
    roughness: 0.85,
    envMap: SHARED.env,
    envMapIntensity: 0.35,
  });
  const inner = new THREE.MeshStandardMaterial({ color: 0xc19a6b, roughness: 0.92 });

  const base = new THREE.Mesh(new THREE.BoxGeometry(w, thickness, d), outer);
  base.receiveShadow = true;
  group.add(base);

  const walls = [
    [w, h, thickness, 0, h / 2, d / 2],
    [w, h, thickness, 0, h / 2, -d / 2],
    [thickness, h, d, w / 2, h / 2, 0],
    [thickness, h, d, -w / 2, h / 2, 0],
  ];
  for (const [bw, bh, bd, x, y, z] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), outer);
    wall.position.set(x, y, z);
    wall.castShadow = wall.receiveShadow = true;
    // slight outward flare like a real takeaway box
    if (bd === thickness) wall.rotation.x = (z > 0 ? -1 : 1) * 0.09;
    else wall.rotation.z = (x > 0 ? 1 : -1) * 0.09;
    group.add(wall);
  }
  const liner = new THREE.Mesh(new THREE.BoxGeometry(w - thickness * 3, thickness * 0.6, d - thickness * 3), inner);
  liner.position.y = thickness;
  group.add(liner);
  return group;
}

/** Small round dipping bowl. */
export function dipBowl({ radius = 0.42, color = 0xdfd2bd } = {}) {
  const profile = [];
  for (let i = 0; i <= 10; i++) {
    const p = i / 10;
    profile.push(new THREE.Vector2(radius * (0.35 + 0.65 * Math.pow(p, 0.7)), p * radius * 0.55));
  }
  const g = new THREE.LatheGeometry(profile, 28);
  const bowl = new THREE.Mesh(g, glossMat(color, 0.5, { side: THREE.DoubleSide }));
  bowl.castShadow = bowl.receiveShadow = true;
  return bowl;
}

/** Printed kraft paper sheet the food is styled on. */
export function paperSheet(tex, { w = 5.5, d = 5.5 } = {}) {
  const g = new THREE.PlaneGeometry(w, d, 20, 20);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, (fbm3(x * 1.2, y * 1.2, 5, 2) - 0.5) * 0.05);
  }
  g.computeVertexNormals();
  g.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xbfa683,        // knock the paper back so the food stays the hero
    roughness: 0.94,
    envMap: SHARED.env,
    envMapIntensity: 0.18,
  }));
  mesh.receiveShadow = true;
  return mesh;
}

export function table(tex, { size = 26 } = {}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, envMap: SHARED.env, envMapIntensity: 0.3 }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

/** Red chilli with a green stem - the little accent in every food photo. */
export function chilli({ length = 0.75, seed = 97 } = {}) {
  const group = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const p = i / 6;
    pts.push(new THREE.Vector3(p * length, Math.sin(p * 2.2) * 0.09, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 20, 0.075, 8, false);
  // taper towards the tip
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const k = 1 - Math.pow(Math.max(0, x / length), 1.6) * 0.92;
    const c = curve.getPoint(Math.min(1, Math.max(0, x / length)));
    pos.setY(i, c.y + (pos.getY(i) - c.y) * k);
    pos.setZ(i, pos.getZ(i) * k);
  }
  g.computeVertexNormals();
  group.add(new THREE.Mesh(g, glossMat(0xd8231b, 0.15)));
  const stem = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 8), glossMat(0x3f7d24, 0.4));
  stem.rotation.z = Math.PI / 2 + 0.3;
  stem.position.set(-0.08, 0.04, 0);
  group.add(stem);
  group.userData.seed = seed;
  return group;
}
