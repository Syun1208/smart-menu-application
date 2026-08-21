// Scene three.js cho TVC.
// Bo cuc rat gon co chu dich: mot OrthographicCamera + mot quad phu khung, toan bo
// "may quay" nam trong shader duoi dang phep lay mau UV. Anh goc khong bao gio bi ve lai,
// nen chu / gia / logo tren anh menu giu nguyen tung diem anh - dung yeu cau cua storyboard.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { vertexShader, fragmentShader } from './shaders/shot.js';
import { GrainShader } from './shaders/grain.js';
import { cameraAt, clampCamera } from './cameraMoves.js';
import { loadImage, resolveSource } from './sources.js';
import * as Overlay from './overlay.js';

const FIT_CODE = { cover: 0, contain: 1, width: 2, blurpad: 3 };

// So texture frame giu cung luc. Chi can du cho hai lop luc chuyen canh + vai frame dem.
const MAX_FRAME_TEXTURES = 8;

// Grade trung tinh cho cac the do hoa tu ve (menu, end card, placeholder).
const CARD_GRADE = { warmth: 0, saturation: 1, contrast: 1, vignette: 0, sharpen: 0 };

export class AdScene {
  constructor({ frame, shots, brand, menu, manifest, canvas }) {
    this.frame = frame;
    this.shots = shots;
    this.brand = brand;
    this.menu = menu;
    this.manifest = manifest;

    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, preserveDrawingBuffer: true, alpha: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(frame.width, frame.height, false);
    // Day la mot bo dung 2D, khong phai scene co anh sang: gia tri mau di thang tu anh
    // goc ra file. Neu de three tu giai ma sRGB -> linear thi EffectComposer khong ma hoa
    // nguoc lai o pass cuoi => anh ra toi va bi bet mau. Nen tat ca chuyen doi hai dau.
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 10);
    this.camera.position.z = 1;

    const white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;

    this.uniforms = {
      uTexA: { value: white }, uTexB: { value: white },
      uSizeA: { value: new THREE.Vector2(1, 1) }, uSizeB: { value: new THREE.Vector2(1, 1) },
      uHasB: { value: 0 },
      uCamA: { value: new THREE.Vector4(0, 0, 1, 0) },
      uCamB: { value: new THREE.Vector4(0, 0, 1, 0) },
      uFitA: { value: 0 }, uFitB: { value: 0 },
      uGradeA: { value: new THREE.Vector4(0.1, 1.1, 1.05, 0.2) },
      uGradeB: { value: new THREE.Vector4(0.1, 1.1, 1.05, 0.2) },
      uSharpen: { value: new THREE.Vector2(0.4, 0.4) },
      uGlow: { value: new THREE.Vector2(0, 0) },
      uMix: { value: 0 },
      uWhip: { value: 0 },
      // Dung setStyle voi LinearSRGBColorSpace: pipeline nay khong doi color space,
      // neu de Color tu chuyen sRGB -> linear thi nen kem se ra dam hon mau thuong hieu.
      uBackdrop: { value: new THREE.Color().setStyle(brand.cream, THREE.LinearSRGBColorSpace) },
      uFrame: { value: new THREE.Vector2(frame.width, frame.height) },
    };

    this.quad = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader, fragmentShader, depthTest: false })
    );
    this.quad.renderOrder = 0;
    this.scene.add(this.quad);

    // Lop chu nam trong cung scene, ve sau quad anh.
    this.captionTex = new THREE.CanvasTexture(document.createElement('canvas'));
    this.captionTex.colorSpace = THREE.NoColorSpace;
    this.captionMat = new THREE.MeshBasicMaterial({ map: this.captionTex, transparent: true, depthTest: false });
    this.captionMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.captionMat);
    this.captionMesh.renderOrder = 1;
    this.captionMesh.visible = false;
    this.scene.add(this.captionMesh);

    // Dau nhan thuong hieu goc tren trai, hien suot video (tru end card - o do da co ten quan).
    this.markTex = new THREE.CanvasTexture(Overlay.makeWatermark(brand, frame.width, frame.height));
    this.markTex.colorSpace = THREE.NoColorSpace;
    this.markMat = new THREE.MeshBasicMaterial({ map: this.markTex, transparent: true, depthTest: false });
    this.markMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.markMat);
    this.markMesh.renderOrder = 2;
    this.scene.add(this.markMesh);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(frame.width, frame.height);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.grainPass = new ShaderPass(GrainShader);
    this.composer.addPass(this.grainPass);

    this.textures = new Map();      // anh tinh + the typeset: giu suot phien
    this.frameTextures = new Map(); // frame cua clip: cua so xoay vong
    this.captions = new Map();   // shot.id -> CanvasTexture
    this.cards = new Map();      // fallback-key -> HTMLCanvasElement
  }

  // --- texture ---------------------------------------------------------

  async textureFor(shot, local) {
    const src = resolveSource(shot, local, this.manifest, this.frame.fps);
    const key = src.kind === 'url' ? src.url : `${shot.id}:${src.fallback}`;

    const cached = this.textures.get(key) || this.frameTextures.get(key);
    if (cached) return cached;

    let tex;
    if (src.kind === 'url') {
      const img = await loadImage(src.url);
      tex = new THREE.Texture(img);
      tex.image = img;
    } else {
      tex = new THREE.CanvasTexture(this.cardFor(shot, src.fallback));
      tex.userData.isCard = true;    // do hoa typeset -> khong ap grade anh chup
    }
    tex.colorSpace = THREE.NoColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;

    if (shot.source.kind === 'frames' && src.kind === 'url') {
      // Frame cua clip: moi frame chi dung dung mot lan, giu lai la phinh bo nho
      // (1800 frame x 1280x720 RGBA). Xoay vong mot cua so nho.
      this.frameTextures.set(key, tex);
      this.evictFrames();
    } else {
      // Anh tinh va the typeset: dung lai suot canh, giu luon.
      this.textures.set(key, tex);
    }
    return tex;
  }

  /** Bo bot texture frame cu, nhung khong bao gio bo cai dang gan vao shader. */
  evictFrames() {
    const inUse = new Set([this.uniforms.uTexA.value, this.uniforms.uTexB.value]);
    for (const [k, t] of this.frameTextures) {
      if (this.frameTextures.size <= MAX_FRAME_TEXTURES) break;
      if (inUse.has(t)) continue;
      t.dispose();
      this.frameTextures.delete(k);
    }
  }

  cardFor(shot, kind) {
    const key = `${shot.id}:${kind}`;
    if (this.cards.has(key)) return this.cards.get(key);
    const W = this.frame.width, H = this.frame.height;
    let canvas;
    if (kind === 'menu')         canvas = Overlay.makeMenuCard(this.menu, W, this.brand);
    else if (kind === 'fruit')   canvas = Overlay.makeFruitCard(this.menu, W, this.brand);
    else if (kind === 'endcard') canvas = Overlay.makeEndcard(this.brand, W, H);
    else                         canvas = Overlay.makePlaceholder(shot, W, H, this.brand);
    this.cards.set(key, canvas);
    return canvas;
  }

  captionFor(shot) {
    if (!shot.caption) return null;
    if (this.captions.has(shot.id)) return this.captions.get(shot.id);
    const c = Overlay.makeCaption(shot.caption, this.frame.width, this.frame.height, this.brand);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    this.captions.set(shot.id, t);
    return t;
  }

  // --- tinh trang thai mot lop -----------------------------------------

  stateFor(shot, t) {
    const dur = shot.t1 - shot.t0;
    const p = dur > 0 ? (t - shot.t0) / dur : 0;
    let cam = cameraAt(shot.move, p, shot.ease, shot.bias, !!shot.lockText);
    if (shot.scaleBoost) cam = { ...cam, scale: cam.scale * shot.scaleBoost };
    return { cam, local: Math.max(0, t - shot.t0), p };
  }

  /**
   * fit: 'auto' -> chon kieu can khung theo ti le THAT cua anh vua tha vao.
   * r = ti le anh / ti le khung (khung 9:16 = 0.5625).
   *   r > 2.2  anh ngang bet, cat se mat qua nua be ngang -> dat tren nen chinh no lam mo
   *   r < 0.72 anh rat cao -> dung tron be ngang, cat bot chieu doc
   *   con lai  lap day khung, camera lia de lo het bo cuc
   * Canh khoa chu luon 'width': khong bao gio cat mat mot cot gia.
   */
  resolveFit(shot, texAspect) {
    const f = shot.fit || 'cover';
    if (f !== 'auto') return f;
    if (shot.lockText) return 'width';
    // Canh quay that: luon lap day khung. Cat 16:9 -> 9:16 la chuyen binh thuong voi
    // video doc, va 6 giay hinh dong ma de trong vien mo thi nhin rat hut.
    if (shot.source.kind === 'frames') return 'cover';
    const r = texAspect / (this.frame.width / this.frame.height);
    if (r > 2.2) return 'blurpad';
    if (r < 0.72) return 'width';
    return 'cover';
  }

  applyLayer(suffix, shot, cam, tex) {
    const img = tex.image;
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const texAspect = w / h;
    const frameAspect = this.frame.width / this.frame.height;
    const fit = this.resolveFit(shot, texAspect);
    // blurpad: anh phai luon nhin thay tron ven, nen keo scale xuong duoi 1
    // va lay chuyen dong tu phan nen mo thay vi phong to anh chinh.
    const cam2 = fit === 'blurpad'
      ? { ...cam, scale: Math.min(0.95, Math.max(0.72, cam.scale * 0.80)) }
      : cam;
    const safe = clampCamera(cam2, texAspect, frameAspect, fit);

    this.uniforms['uTex' + suffix].value = tex;
    this.uniforms['uSize' + suffix].value.set(w, h);
    this.uniforms['uCam' + suffix].value.set(safe.x, safe.y, safe.scale, safe.rot);
    this.uniforms['uFit' + suffix].value = FIT_CODE[fit];

    // The typeset (menu / end card / placeholder) da co mau thuong hieu dung roi:
    // to them mau am + glow chi lam chu bet lai. Chi anh chup moi di qua grade.
    const isCard = !!tex.userData.isCard;
    const g = isCard ? CARD_GRADE : shot.grade;
    this.uniforms['uGrade' + suffix].value.set(g.warmth, g.saturation, g.contrast, g.vignette);
    const i = suffix === 'A' ? 'x' : 'y';
    this.uniforms.uSharpen.value[i] = isCard ? 0 : g.sharpen;
    this.uniforms.uGlow.value[i] = (isCard || shot.lockText) ? 0 : (shot.glow || 0);
  }

  // --- ve mot frame -----------------------------------------------------

  async renderFrame(t) {
    t = Math.max(0, Math.min(this.shots[this.shots.length - 1].t1 - 1e-4, t));

    let idx = 0;
    for (let i = 0; i < this.shots.length; i++) {
      if (t >= this.shots[i].t0 && t < this.shots[i].t1) { idx = i; break; }
      if (i === this.shots.length - 1) idx = i;
    }
    const cur = this.shots[idx];
    const prev = this.shots[idx - 1];

    // Chuyen canh: lop A = canh truoc, lop B = canh hien tai, uMix chay 0 -> 1.
    const tr = cur.transition || { type: 'cut', dur: 0 };
    const inTrans = prev && tr.dur > 0 && (t - cur.t0) < tr.dur;

    if (inTrans) {
      const k = (t - cur.t0) / tr.dur;
      const sPrev = this.stateFor(prev, t);          // canh truoc chay tiep qua diem cat
      const sCur = this.stateFor(cur, t);
      const [texPrev, texCur] = await Promise.all([
        this.textureFor(prev, sPrev.local),
        this.textureFor(cur, sCur.local),
      ]);
      this.applyLayer('A', prev, sPrev.cam, texPrev);
      this.applyLayer('B', cur, sCur.cam, texCur);
      this._curIsCard = !!texCur.userData.isCard;
      this.uniforms.uHasB.value = 1;
      this.uniforms.uMix.value = k * k * (3 - 2 * k);                     // smoothstep
      this.uniforms.uWhip.value = tr.type === 'whip' ? Math.sin(k * Math.PI) : 0;
    } else {
      const s = this.stateFor(cur, t);
      const tex = await this.textureFor(cur, s.local);
      this.applyLayer('A', cur, s.cam, tex);
      this._curIsCard = !!tex.userData.isCard;
      this.uniforms.uHasB.value = 0;
      this.uniforms.uMix.value = 0;
      this.uniforms.uWhip.value = 0;
    }

    // Caption: hien khi canh da on dinh, fade in/out o hai dau.
    const capTex = this.captionFor(cur);
    if (capTex && !cur.lockText) {
      const a = fadeEnvelope(t - cur.t0, cur.t1 - cur.t0, 0.45, 0.45);
      this.captionMesh.visible = a > 0.01;
      this.captionMat.map = capTex;
      this.captionMat.opacity = a;
      this.captionMat.needsUpdate = true;
    } else {
      this.captionMesh.visible = false;
    }

    // Dau nhan chi dat len ANH CHUP. The typeset (menu, end card, placeholder) da co san
    // ten quan, va chu trang cua dau nhan tren nen kem thi coi nhu vo hinh.
    const markAlpha = (cur.lockText || this._curIsCard) ? 0 : 0.85;
    this.markMesh.visible = markAlpha > 0.01;
    this.markMat.opacity = markAlpha * Math.min(1, t / 0.6);

    // Grain: tat han o canh co chu de khong lam nhieu net chu / so.
    this.grainPass.uniforms.uAmount.value = cur.lockText ? 0.0 : 0.006;
    this.grainPass.uniforms.uSeed.value = Math.floor(t * this.frame.fps) * 7.13;

    this.composer.render();
  }
}

// Bao hinh len/xuong o hai dau mot canh.
function fadeEnvelope(local, dur, inDur, outDur) {
  if (local < 0 || local > dur) return 0;
  const a = Math.min(1, local / inDur);
  const b = Math.min(1, (dur - local) / outDur);
  const v = Math.min(a, b);
  return v * v * (3 - 2 * v);
}
