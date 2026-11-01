// The hamster: one soft fused body (a skinned mesh: hips, chest, head) with cheek morph targets that swell to twice the
// head's width and glow hot pink past full, velvet fur, painted coat markings, glossy eyes with expressions, pink ears and
// paws, a bandana in the seat colour and whatever hat it wears. Animated procedurally from the simulation's state.
// Model units: 1 = BODY_R (the body is about 2.3 long); forward is +X, up +Y.

import * as THREE from 'three';
import { ALL_COATS, SEATS } from '../sim/config.js';
import { makeHat } from './hats.js';

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** The body's surface for a direction on the unit sphere (the same function shapes the mesh and places the face). */
export function surf(x, y, z, out = new THREE.Vector3()) {
  let X = x * 1.14;
  let Y = y * 0.86;
  let Z = z * 0.98;
  // A head that's a little narrower and lower than the rump, one fused egg.
  const front = smooth(0.15, 1, x);
  Z *= 1 - 0.09 * front;
  Y *= 1 - 0.05 * front;
  // A soft muzzle.
  const m = Math.exp(-((y + 0.05) ** 2 / 0.05 + (z * z) / 0.06)) * smooth(0.55, 1, x);
  X += m * 0.1;
  Y -= m * 0.03;
  // Round rump.
  const back = smooth(-0.3, -1, x);
  Y *= 1 + 0.04 * back;
  // A flat-ish belly to sit on.
  if (Y < -0.46) Y = -0.46 + (Y + 0.46) * 0.32;
  Y += 0.52;
  return out.set(X, Y, Z);
}

// Where things sit (model units), from the surface function.
const P = (() => {
  const v = (x, y, z, push = 0) => {
    const d = new THREE.Vector3(x, y, z).normalize();
    const s = surf(d.x, d.y, d.z);
    const n = s.clone().sub(new THREE.Vector3(0, 0.5, 0)).normalize();
    return s.addScaledVector(n, push);
  };
  return {
    eyeL: v(0.76, 0.32, -0.5, -0.02),
    eyeR: v(0.76, 0.32, 0.5, -0.02),
    earL: v(0.2, 0.86, -0.46, -0.03),
    earR: v(0.2, 0.86, 0.46, -0.03),
    nose: v(1, 0.06, 0, 0.0),
    top: v(0.3, 1, 0, 0),
    tail: v(-1, 0.2, 0, -0.02),
  };
})();

// ------------------------------------------------------------------ geometry (shared), colours (per coat)

let BASE = null;
function baseGeometry() {
  if (BASE) return BASE;
  const g = new THREE.SphereGeometry(1, 56, 36);
  const pos = g.attributes.position;
  const n = pos.count;
  const cheek = new Float32Array(n);
  const dirs = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const morphCheek = new Float32Array(n * 3);
  const morphOver = new Float32Array(n * 3);
  const morphSquish = new Float32Array(n * 3);
  const s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    dirs[i * 3] = x;
    dirs[i * 3 + 1] = y;
    dirs[i * 3 + 2] = z;
    surf(x, y, z, s);
    pos.setXYZ(i, s.x, s.y, s.z);
    // Cheeks: a pouch on each side of the face that pushes outward (and a little down and forward).
    const az = Math.abs(z);
    const c = Math.exp(-((x - 0.5) ** 2 / 0.11 + (y + 0.1) ** 2 / 0.12 + (az - 0.78) ** 2 / 0.14));
    cheek[i] = clamp(c * 1.25, 0, 1);
    const sz = Math.sign(z) || 1;
    morphCheek[i * 3] = c * 0.16;
    morphCheek[i * 3 + 1] = c * -0.06 + c * y * 0.12;
    morphCheek[i * 3 + 2] = c * 0.58 * sz;
    const c2 = Math.exp(-((x - 0.4) ** 2 / 0.2 + (y + 0.05) ** 2 / 0.2 + (az - 0.7) ** 2 / 0.25));
    morphOver[i * 3] = c2 * 0.1;
    morphOver[i * 3 + 1] = c2 * 0.08;
    morphOver[i * 3 + 2] = c2 * 0.42 * sz;
    // Squish: the whole body spreads (used for pops and heavy landings).
    morphSquish[i * 3] = s.x * 0.18;
    morphSquish[i * 3 + 1] = -(s.y - 0.0) * 0.45;
    morphSquish[i * 3 + 2] = s.z * 0.28;
    // Skin: the head leads, the hips follow.
    const w = smooth(-0.05, 0.6, s.x);
    const hip = smooth(-0.2, -0.85, s.x);
    skinIndex.set([1, 2, 3, 0], i * 4);
    const wb = Math.max(0, 1 - w - hip * 0.6);
    skinWeight.set([wb, w, hip * 0.6, 0], i * 4);
  }
  g.computeVertexNormals();
  g.setAttribute('aCheek', new THREE.BufferAttribute(cheek, 1));
  g.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  g.morphAttributes.position = [new THREE.BufferAttribute(morphCheek, 3), new THREE.BufferAttribute(morphOver, 3), new THREE.BufferAttribute(morphSquish, 3)];
  g.morphTargetsRelative = true;
  BASE = g;
  return g;
}

// Value noise for coat patches.
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let a = 0; a < 2; a++)
    for (let b = 0; b < 2; b++)
      for (let c = 0; c < 2; c++) r += hash3(ix + a, iy + b, iz + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  return r;
}

const coatGeoms = new Map();
/** The body geometry with this coat painted into its vertex colours. */
function coatGeometry(coatIndex) {
  if (coatGeoms.has(coatIndex)) return coatGeoms.get(coatIndex);
  const base = baseGeometry();
  const g = base.clone();
  const coat = ALL_COATS[coatIndex] || ALL_COATS[0];
  const pos = g.attributes.position;
  const dir = g.attributes.aDir;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  const cBase = new THREE.Color(coat.base);
  const cDark = new THREE.Color(coat.dark);
  const cBelly = new THREE.Color(coat.belly);
  const cMark = coat.mark ? new THREE.Color(coat.mark.color) : null;
  const cBlush = new THREE.Color('#ffb3ae');
  const c = new THREE.Color();
  const kind = coat.mark ? coat.mark.kind : '';
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const dx = dir.getX(i);
    const dy = dir.getY(i);
    const dz = dir.getZ(i);
    c.copy(cBase);
    // Darker along the back, a little ticking.
    c.lerp(cDark, smooth(0.25, 0.95, dy) * 0.55 * smooth(0.9, -0.2, dx));
    const tick = noise3(dx * 9, dy * 9, dz * 9);
    c.lerp(cDark, (tick - 0.5) * 0.25 + 0.05);
    // A light belly and muzzle.
    const belly = Math.max(smooth(-0.05, -0.55, dy), smooth(0.62, 0.95, dx) * smooth(0.35, -0.2, dy));
    const muzzle = Math.exp(-((dx - 0.95) ** 2 / 0.05 + (dy + 0.02) ** 2 / 0.06 + (dz * dz) / 0.12));
    c.lerp(cBelly, clamp(belly + muzzle * 0.8, 0, 1));
    if (cMark) {
      let m = 0;
      if (kind === 'patches') {
        const nn = noise3(dx * 2.3 + 4, dy * 2.3 + 1, dz * 2.3 + 7);
        m = smooth(0.48, 0.58, nn) * smooth(-0.3, 0.1, dy);
      } else if (kind === 'band') m = Math.exp(-((dx + 0.05) ** 2) / 0.05) * smooth(-0.6, -0.1, dy);
      else if (kind === 'panda') m = Math.max(smooth(-0.15, -0.45, dx) * smooth(-0.4, 0.1, dy), Math.exp(-((dx - 0.72) ** 2 / 0.025 + (dy - 0.3) ** 2 / 0.03 + (Math.abs(dz) - 0.52) ** 2 / 0.03)) * 1.4);
      else if (kind === 'shimmer') m = smooth(0.62, 0.8, noise3(dx * 7, dy * 7, dz * 7)) * 0.8;
      else if (kind === 'blaze') m = Math.exp(-(dz * dz) / 0.02) * smooth(0.35, 0.9, dx) * smooth(-0.2, 0.3, dy);
      else if (kind === 'spot') m = Math.exp(-((dx + 0.25) ** 2 + (dz - 0.35) ** 2) / 0.07) * smooth(0.1, 0.5, dy);
      else if (kind === 'stripe') m = Math.exp(-(dz * dz) / 0.012) * smooth(0.3, 0.7, dy) * smooth(0.8, 0.2, dx);
      c.lerp(cMark, clamp(m, 0, 1));
    }
    // Dwarf-hamster spine stripe for coats that want it.
    if (coat.stripe) c.lerp(new THREE.Color(coat.stripe), Math.exp(-(dz * dz) / 0.01) * smooth(0.35, 0.75, dy) * smooth(0.85, 0.1, dx) * 0.85);
    // A natural blush on the cheeks.
    c.lerp(cBlush, g.attributes.aCheek.getX(i) * 0.18);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    void x;
    void y;
    void z;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  coatGeoms.set(coatIndex, g);
  return g;
}

// ------------------------------------------------------------------ materials

/** Velvet fur: sheen, a soft rim of light, fine strand shading, and cheeks that blush hot pink when overstuffed. */
function furMaterial(coat) {
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color(coat.belly).lerp(new THREE.Color('#ffffff'), 0.3),
  });
  const u = { uHot: { value: 0 }, uHotColor: { value: new THREE.Color('#ff3d6a') }, uRim: { value: 0.35 }, uFlash: { value: 0 }, uGum: { value: 0 }, uFire: { value: 0 } };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCheek;\nattribute vec3 aDir;\nvarying float vCheek;\nvarying vec3 vDir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCheek = aCheek;\nvDir = aDir;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uHot; uniform vec3 uHotColor; uniform float uRim; uniform float uFlash; uniform float uGum; uniform float uFire;
        varying float vCheek; varying vec3 vDir;
        float fh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float fn(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), f.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), f.x), mix(fh(i + vec3(0,1,1)), fh(i + vec3(1,1,1)), f.x), f.y), f.z); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        // Fine fur: streaks that run front to back.
        float strand = fn(vec3(vDir.x * 6.0, vDir.y * 46.0, vDir.z * 46.0));
        diffuseColor.rgb *= 0.9 + strand * 0.2;
        float hot = vCheek * uHot;
        diffuseColor.rgb = mix(diffuseColor.rgb, uHotColor, clamp(hot, 0.0, 1.0));`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float nn = fn(vec3(vDir.x * 14.0, vDir.y * 60.0, vDir.z * 60.0)) - 0.5;
        normal = normalize(normal + vec3(nn * 0.18, nn * 0.12, -nn * 0.1));`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);
        outgoingLight += diffuseColor.rgb * rim * uRim + vec3(1.0, 0.9, 0.7) * rim * uRim * 0.25;
        outgoingLight += uHotColor * vCheek * uHot * 0.18;
        outgoingLight = mix(outgoingLight, vec3(1.0, 0.95, 0.85), uFlash);
        outgoingLight += vec3(1.0, 0.5, 0.75) * rim * uGum * 0.9;
        outgoingLight += vec3(1.0, 0.35, 0.05) * rim * uFire * 1.2;
        #include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'fur1';
  return m;
}

const MAT = {};
function mats() {
  if (MAT.pink) return MAT;
  MAT.pink = new THREE.MeshStandardMaterial({ color: '#f4a3a8', roughness: 0.55 });
  MAT.earIn = new THREE.MeshStandardMaterial({ color: '#f39aa2', roughness: 0.6 });
  MAT.eye = new THREE.MeshPhysicalMaterial({ color: '#120d0c', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 });
  MAT.glint = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  MAT.lid = new THREE.MeshStandardMaterial({ color: '#2a1a15', roughness: 0.7 });
  MAT.nose = new THREE.MeshPhysicalMaterial({ color: '#e46f84', roughness: 0.3, clearcoat: 0.6 });
  MAT.whisker = new THREE.LineBasicMaterial({ color: '#fff7ee', transparent: true, opacity: 0.75 });
  MAT.tooth = new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.4 });
  return MAT;
}

const GEO = {};
function geos() {
  if (GEO.eye) return GEO;
  GEO.eye = new THREE.SphereGeometry(0.135, 20, 14);
  GEO.glint = new THREE.SphereGeometry(0.038, 8, 6);
  GEO.glint2 = new THREE.SphereGeometry(0.02, 6, 4);
  GEO.arc = new THREE.TorusGeometry(0.1, 0.028, 6, 14, Math.PI);
  GEO.bar = new THREE.CapsuleGeometry(0.026, 0.13, 3, 6);
  GEO.ear = new THREE.SphereGeometry(0.26, 18, 12);
  GEO.earIn = new THREE.SphereGeometry(0.19, 14, 10);
  GEO.nose = new THREE.SphereGeometry(0.075, 12, 8);
  GEO.foot = new THREE.SphereGeometry(0.15, 12, 8);
  GEO.paw = new THREE.SphereGeometry(0.11, 10, 8);
  GEO.tail = new THREE.SphereGeometry(0.12, 10, 8);
  GEO.tooth = new THREE.BoxGeometry(0.05, 0.08, 0.1);
  // Whiskers: three a side.
  const w = [];
  for (const sz of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const a = (k - 1) * 0.28;
      w.push(0, 0, 0.05 * sz, 0.05, 0.02 + Math.sin(a) * 0.3, (0.55 + Math.abs(a) * 0.2) * sz);
    }
  GEO.whiskers = new THREE.BufferGeometry();
  GEO.whiskers.setAttribute('position', new THREE.Float32BufferAttribute(w, 3));
  // The bandana: a band round the neck and a little knot at the back.
  // A neckerchief: a broad band hugging the neck, a knot on top and two tails lying back over the shoulders.
  const band = new THREE.TorusGeometry(1, 0.13, 10, 48);
  band.scale(1, 1, 1.9);
  GEO.band = band;
  GEO.knot = new THREE.SphereGeometry(0.15, 12, 8);
  GEO.tailBand = new THREE.ConeGeometry(0.13, 0.42, 4);
  return GEO;
}

// ------------------------------------------------------------------ one hamster

const seatColor = (seat) => new THREE.Color(SEATS[((seat % SEATS.length) + SEATS.length) % SEATS.length].color);

export function createHamster({ coat = 0, seat = 0, hat = null, scale = 0.2 } = {}) {
  geos();
  mats();
  const root = new THREE.Group(); // placed and turned by the world
  const lean = new THREE.Group(); // leans and squashes
  root.add(lean);
  lean.scale.setScalar(scale);

  const coatDef = ALL_COATS[coat] || ALL_COATS[0];
  const fur = furMaterial(coatDef);
  const body = new THREE.SkinnedMesh(coatGeometry(coat), fur);
  body.castShadow = true;
  body.receiveShadow = false;
  body.frustumCulled = false;
  const bRoot = new THREE.Bone();
  const bChest = new THREE.Bone();
  const bHead = new THREE.Bone();
  const bHip = new THREE.Bone();
  bChest.position.set(0.05, 0.5, 0);
  bHead.position.set(0.35, 0.05, 0);
  bHip.position.set(-0.4, 0.0, 0);
  bRoot.add(bChest);
  bChest.add(bHead);
  bChest.add(bHip);
  body.add(bRoot);
  body.bind(new THREE.Skeleton([bRoot, bChest, bHead, bHip]));
  lean.add(body);

  // Things on the head move with the head bone; positions are relative to it.
  const headOrigin = new THREE.Vector3(0.4, 0.55, 0);
  const onHead = (obj, p) => {
    obj.position.copy(p).sub(headOrigin);
    bHead.add(obj);
    return obj;
  };

  // Eyes, with their expressions.
  const eyes = [];
  for (const [p, sz] of [
    [P.eyeL, -1],
    [P.eyeR, 1],
  ]) {
    const g = new THREE.Group();
    onHead(g, p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1.6, 0.35, 1.5 * sz).normalize());
    const open = new THREE.Group();
    const ball = new THREE.Mesh(GEO.eye, MAT.eye);
    ball.scale.set(1, 1.08, 0.75);
    const gl = new THREE.Mesh(GEO.glint, MAT.glint);
    gl.position.set(0.05 * -sz * 0, 0.055, 0.075);
    const gl2 = new THREE.Mesh(GEO.glint2, MAT.glint);
    gl2.position.set(-0.04, -0.04, 0.085);
    open.add(ball, gl, gl2);
    const happy = new THREE.Mesh(GEO.arc, MAT.lid);
    happy.position.set(0, -0.03, 0.06);
    const squeeze = new THREE.Group();
    const b1 = new THREE.Mesh(GEO.bar, MAT.lid);
    const b2 = new THREE.Mesh(GEO.bar, MAT.lid);
    b1.rotation.z = Math.PI / 2 + 0.5 * sz;
    b2.rotation.z = Math.PI / 2 - 0.5 * sz;
    b1.position.set(0, 0.035, 0.06);
    b2.position.set(0, -0.035, 0.06);
    squeeze.add(b1, b2);
    const ko = new THREE.Group();
    const k1 = new THREE.Mesh(GEO.bar, MAT.lid);
    const k2 = new THREE.Mesh(GEO.bar, MAT.lid);
    k1.rotation.z = 0.78;
    k2.rotation.z = -0.78;
    k1.position.z = k2.position.z = 0.06;
    ko.add(k1, k2);
    const spiral = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.022, 5, 18, Math.PI * 1.6), MAT.lid);
    spiral.position.z = 0.06;
    g.add(open, happy, squeeze, ko, spiral);
    eyes.push({ g, open, happy, squeeze, ko, spiral, sz });
  }
  // Ears.
  const ears = [];
  for (const [p, sz] of [
    [P.earL, -1],
    [P.earR, 1],
  ]) {
    const e = new THREE.Group();
    onHead(e, p);
    const outer = new THREE.Mesh(GEO.ear, fur);
    outer.scale.set(0.45, 1.25, 1.12);
    outer.position.y = 0.08;
    const inner = new THREE.Mesh(GEO.earIn, MAT.earIn);
    inner.scale.set(0.32, 1.1, 0.98);
    inner.position.set(0.06, 0.09, 0);
    e.add(outer, inner);
    e.rotation.set(0.25 * sz, -0.35 * sz, -0.2);
    e.userData.base = e.rotation.clone();
    ears.push(e);
  }
  // Nose, whiskers, teeth.
  const nose = onHead(new THREE.Mesh(GEO.nose, MAT.nose), P.nose);
  nose.scale.set(0.7, 0.75, 1.1);
  const whiskers = new THREE.LineSegments(GEO.whiskers, MAT.whisker);
  onHead(whiskers, P.nose.clone().add(new THREE.Vector3(-0.08, -0.04, 0)));
  const teeth = onHead(new THREE.Mesh(GEO.tooth, MAT.tooth), P.nose.clone().add(new THREE.Vector3(-0.05, -0.17, 0)));
  teeth.visible = false;

  // Feet (on the lean group, so they stay on the ground), front paws, a tail nub.
  const feet = [];
  for (const [x, z, front] of [
    [0.55, -0.4, true],
    [0.55, 0.4, true],
    [-0.55, -0.48, false],
    [-0.55, 0.48, false],
  ]) {
    const f = new THREE.Mesh(GEO.foot, MAT.pink);
    f.scale.set(front ? 1.0 : 1.35, 0.55, 0.8);
    f.position.set(x, 0.06, z);
    f.castShadow = false;
    f.userData = { x, z, front };
    lean.add(f);
    feet.push(f);
  }
  const paws = [];
  for (const sz of [-1, 1]) {
    const p = new THREE.Mesh(GEO.paw, MAT.pink);
    p.scale.set(0.9, 0.7, 0.8);
    p.visible = false;
    onHead(p, new THREE.Vector3(0.95, 0.2, 0.18 * sz));
    paws.push(p);
  }
  const tail = new THREE.Mesh(GEO.tail, fur);
  tail.position.copy(P.tail).sub(new THREE.Vector3(-0.35, 0.5, 0));
  bHip.add(tail);

  // Bandana in the seat colour, round the neck.
  const bandMat = new THREE.MeshStandardMaterial({ color: seatColor(seat), roughness: 0.65 });
  const band = new THREE.Mesh(GEO.band, bandMat);
  band.rotation.set(0, Math.PI / 2, 0.22, 'ZYX');
  band.scale.set(1.02, 0.77, 1);
  band.position.set(-0.06, 0.14, 0);
  bChest.add(band);
  const knot = new THREE.Mesh(GEO.knot, bandMat);
  knot.position.set(-0.24, 0.88, 0);
  knot.scale.set(1, 0.7, 1.15);
  bChest.add(knot);
  for (const sz of [-1, 1]) {
    const tl = new THREE.Mesh(GEO.tailBand, bandMat);
    tl.position.set(-0.46, 0.83, sz * 0.13);
    tl.rotation.set(sz * 0.35, 0, Math.PI / 2 + 0.35);
    tl.scale.set(1, 1, 0.35);
    bChest.add(tl);
  }
  band.castShadow = true;

  // A hat.
  let hatObj = null;
  function setHat(id) {
    if (hatObj) {
      bHead.remove(hatObj);
      hatObj = null;
    }
    if (!id) return;
    hatObj = makeHat(id);
    if (!hatObj) return;
    onHead(hatObj, P.top);
  }
  setHat(hat);

  // ------------------------------------------------------------------ animation state

  const A = {
    t: Math.random() * 10,
    yaw: 0, // facing (radians, three's y rotation)
    turnV: 0,
    gait: 0,
    speed: 0,
    cheeks: 0,
    cheekV: 0,
    over: 0,
    squash: 0,
    squashV: 0,
    squish: 0,
    lookX: 0,
    lookV: 0,
    nod: 0,
    nodV: 0,
    blinkT: 2,
    blink: 0,
    eat: 0,
    happy: 0,
    hop: 0,
    hopV: 0,
    spin: 0,
    flash: 0,
    idleLook: 0,
    idleT: 3,
    groom: 0,
    win: 0,
    sad: 0,
    lean: 0,
    pitch: 0,
    tremble: 0,
  };

  function expression(kind) {
    for (const e of eyes) {
      e.open.visible = kind === 'open';
      e.happy.visible = kind === 'happy';
      e.squeeze.visible = kind === 'squeeze';
      e.ko.visible = kind === 'ko';
      e.spiral.visible = kind === 'dizzy';
    }
  }
  expression('open');

  const ham = {
    root,
    body,
    fur,
    bandMat,
    A,
    coat,
    seat,
    get hat() {
      return hatObj ? hatObj.userData.id : null;
    },
    setHat,
    setCoat(c) {
      if (c === ham.coat) return;
      ham.coat = c;
      body.geometry = coatGeometry(c);
      fur.sheenColor.set((ALL_COATS[c] || ALL_COATS[0]).belly).lerp(new THREE.Color('#ffffff'), 0.3);
    },
    setSeat(s) {
      ham.seat = s;
      bandMat.color.copy(seatColor(s));
    },
    /** Events: a bite (size), a squash (amount; negative stretches), a pop, a bank, a hit. */
    bite(size = 5) {
      A.cheekV += 1.4 + size * 0.06;
      A.nodV -= 5 + size * 0.15;
      A.eat = 0.35;
      A.squashV += 1.2;
    },
    squash(k) {
      A.squashV += k * 14;
    },
    pop() {
      A.squish = 1;
      A.flash = 1;
      A.cheekV -= 6;
    },
    bank() {
      A.hopV += 4.2;
      A.happy = 1.1;
    },
    flashHit() {
      A.flash = Math.max(A.flash, 0.6);
    },
    win() {
      A.win = 1;
    },
    lose() {
      A.sad = 1;
    },
    /**
     * s: { x, z (world), a (sim angle), speed (px/s), fill, over (0..1 past full), dash (bool), dizzy (s), stun (s),
     *      strain (0..1), gum, fire, away, eating, mood: 'win' | 'lose' | null }
     */
    update(s, dt) {
      A.t += dt;
      const sp = clamp(s.speed / 240, 0, 1.4);
      A.speed += (sp - A.speed) * (1 - Math.exp(-dt * 10));
      // Facing: the head leads, the body follows with a little lag (spring on yaw).
      const targetYaw = -s.a;
      let dy = targetYaw - A.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const turnRate = s.dizzy > 0 ? 0 : 18;
      A.turnV += (dy * turnRate * 3.2 - A.turnV * 9) * dt;
      A.yaw += A.turnV * dt;
      root.position.set(s.x, 0, s.z);
      root.rotation.y = A.yaw;
      // Lean into turns, pitch forward when running, back when full.
      const leanT = clamp(-A.turnV * 0.05 * A.speed, -0.35, 0.35);
      A.lean += (leanT - A.lean) * (1 - Math.exp(-dt * 8));
      const pitchT = (s.dash ? 0.18 : 0.06 * A.speed) - s.over * 0.08;
      A.pitch += (pitchT - A.pitch) * (1 - Math.exp(-dt * 6));
      // Gait: a bouncy gallop when light, a waddle when heavy.
      const heavy = clamp((s.fill - 50) / 70, 0, 1);
      A.gait += dt * (6 + A.speed * 14) * (s.dizzy > 0 ? 0 : 1);
      const bounce = Math.abs(Math.sin(A.gait)) * A.speed * (0.22 - heavy * 0.12);
      const sway = Math.sin(A.gait * 0.5) * A.speed * heavy * 0.18;
      // Springs.
      A.squashV += (-A.squash * 220 - A.squashV * 16) * dt;
      A.squash += A.squashV * dt;
      A.hopV += (-A.hop * 160 - A.hopV * 10) * dt;
      A.hop += A.hopV * dt;
      A.hop = Math.max(-0.05, A.hop);
      const cheekT = clamp(s.fill / 100, 0, 1);
      A.cheekV += ((cheekT - A.cheeks) * 160 - A.cheekV * 12) * dt;
      A.cheeks += A.cheekV * dt;
      A.over += (s.over - A.over) * (1 - Math.exp(-dt * 8));
      A.nodV += (-A.nod * 180 - A.nodV * 14) * dt;
      A.nod += A.nodV * dt;
      A.squish = Math.max(0, A.squish - dt * (s.dizzy > 0 ? 0.55 : 1.8));
      A.flash = Math.max(0, A.flash - dt * 5);
      A.eat = Math.max(0, A.eat - dt);
      A.happy = Math.max(0, A.happy - dt);
      // Idle life: look around, groom now and then.
      if (A.speed < 0.08 && s.dizzy <= 0) {
        A.idleT -= dt;
        if (A.idleT <= 0) {
          A.idleT = 1.5 + Math.random() * 3;
          A.idleLook = (Math.random() - 0.5) * 1.4;
          if (Math.random() < 0.25) A.groom = 1.2;
        }
      } else {
        A.idleLook = 0;
        A.groom = 0;
      }
      A.groom = Math.max(0, A.groom - dt);
      const lookT = clamp(-A.turnV * 0.06, -0.6, 0.6) + A.idleLook;
      A.lookV += ((lookT - A.lookX) * 120 - A.lookV * 14) * dt;
      A.lookX += A.lookV * dt;
      // Strain: trembling when past full.
      A.tremble = s.over > 0 && s.dizzy <= 0 ? (Math.sin(A.t * 63) * 0.5 + Math.sin(A.t * 41) * 0.5) * (0.012 + s.over * 0.03) : 0;
      // Win / lose moods.
      if (s.mood === 'win') {
        A.win += dt;
        if (A.hop < 0.01 && A.hopV <= 0) A.hopV += 3.6;
        A.spin += dt * 7;
      } else A.spin = 0;

      // Pose.
      const sq = A.squash + A.squish * 0.0;
      const sy = 1 - sq * 0.35 + bounce * 0.4;
      const sxz = 1 + sq * 0.22 - bounce * 0.15;
      lean.scale.set(scale * sxz * (1 + A.tremble), scale * sy, scale * sxz * (1 - A.tremble));
      lean.position.y = (bounce * 0.45 + Math.max(0, A.hop) * 1.6) * scale;
      lean.rotation.set(A.lean + sway, A.spin, -A.pitch + (s.mood === 'lose' ? 0.25 : 0), 'YXZ');
      if (s.dizzy > 0) lean.rotation.x += Math.sin(A.t * 6) * 0.12;
      bRoot.position.set(0, 0, 0);
      bHead.rotation.set(A.lookX * 0.25, A.lookX, -A.nod * 0.25 + (A.groom > 0 ? Math.sin(A.t * 20) * 0.12 : 0) + (s.mood === 'lose' ? 0.35 : 0) - (s.mood === 'win' ? 0.2 : 0));
      bHip.rotation.y = -A.lookX * 0.3 + sway * 0.5;
      bChest.position.y = 0.5 + Math.sin(A.t * 2.4) * 0.01 * (1 - A.speed);
      // Morphs: cheeks, overstuffed, squish.
      const infl = body.morphTargetInfluences;
      infl[0] = clamp(A.cheeks, -0.2, 1.3) * (1 - A.squish * 0.9);
      infl[1] = clamp(A.over, 0, 1.2) * (1 - A.squish);
      infl[2] = clamp(A.squish * 1.1, 0, 1);
      fur.userData.u.uHot.value = clamp(A.over * 1.1 + (s.strain || 0) * 0.2, 0, 0.95);
      fur.userData.u.uFlash.value = A.flash * 0.7;
      fur.userData.u.uGum.value = s.gum ? 0.7 + Math.sin(A.t * 8) * 0.3 : 0;
      fur.userData.u.uFire.value = s.fire ? 0.6 + Math.sin(A.t * 17) * 0.3 : 0;
      // Ears: back when running, twitch at rest.
      for (const e of ears) {
        const b = e.userData.base;
        const run = A.speed * 0.7;
        e.rotation.set(b.x, b.y, b.z - run * 0.9 + (A.speed < 0.1 ? Math.max(0, Math.sin(A.t * 0.9 + e.position.z * 3) - 0.96) * 6 : 0));
      }
      // Feet: a gallop (front pair, then back pair).
      for (const f of feet) {
        const u = f.userData;
        const ph = A.gait + (u.front ? 0 : Math.PI) + (u.z > 0 ? 0.35 : 0);
        const stride = A.speed * 0.36 * (1 - heavy * 0.4);
        f.position.x = u.x + Math.sin(ph) * stride;
        f.position.y = 0.06 + Math.max(0, Math.cos(ph)) * stride * 0.5;
        f.visible = A.squish < 0.5;
      }
      // Paws to the mouth while eating, grooming or banking.
      const pawsUp = A.eat > 0 || A.groom > 0;
      for (const p of paws) {
        p.visible = pawsUp;
        if (pawsUp) p.position.y = -0.35 + Math.sin(A.t * 24) * 0.03;
      }
      teeth.visible = A.eat > 0.15 || s.mood === 'win';
      // Eyes.
      A.blinkT -= dt;
      if (A.blinkT <= 0) {
        A.blink = 0.12;
        A.blinkT = 1.8 + Math.random() * 3.5;
      }
      A.blink = Math.max(0, A.blink - dt);
      let ex = 'open';
      if (s.dizzy > 0) ex = A.squish > 0.3 ? 'ko' : 'dizzy';
      else if (A.happy > 0 || s.mood === 'win') ex = 'happy';
      else if ((s.strain || 0) > 0.45 || s.stun > 0 || A.flash > 0.3) ex = 'squeeze';
      expression(ex);
      const lid = A.blink > 0 && ex === 'open' ? 0.1 : 1;
      for (const e of eyes) {
        e.open.scale.y = lid;
        if (ex === 'dizzy') e.spiral.rotation.z = A.t * 9 * e.sz;
      }
      root.visible = !s.hidden;
    },
    dispose() {
      fur.dispose();
      bandMat.dispose();
    },
  };
  return ham;
}

/** Preloads shared geometry (call once at boot so the first round doesn't stall). */
export function warmHamsters() {
  geos();
  mats();
  for (let i = 0; i < ALL_COATS.length; i++) coatGeometry(i);
}
export { lerp };
