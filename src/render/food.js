// Food you want to eat, modelled (no textures to load): striped sunflower seeds, glossy hazelnuts, dusty blueberries,
// crackers with docking holes, seeded strawberries, chunky cookies, the golden seed, and the specials (a chili, a gumball,
// a peppercorn). Drawn instanced: the field's pieces, falling and flying ones, and each burrow's heap.

import * as THREE from 'three';
import { FOODS } from '../sim/config.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const VIS = 1.3; // food is drawn a little bigger than it eats, to read at a glance

const h1 = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function colorize(g, fn) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    fn(c, p.getX(i), p.getY(i), p.getZ(i), n ? n.getX(i) : 0, n ? n.getY(i) : 1, n ? n.getZ(i) : 0, i);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function displace(g, fn) {
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    fn(v, i);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const C = (hex) => new THREE.Color(hex);
const noise = (x, y, z) => Math.sin(x * 12.9 + y * 4.1) * Math.sin(y * 7.3 + z * 9.7) * Math.sin(z * 5.1 + x * 3.3);

// Each maker returns { geo (unit: radius 1, resting on y = 0), mat }.
const MAKE = {
  seed() {
    const g = new THREE.SphereGeometry(1, 20, 12);
    displace(g, (v) => {
      // A teardrop, flat-ish, pointed at +x.
      const t = (v.x + 1) / 2;
      v.x *= 1.0;
      v.y *= 0.42 * (1 - t * 0.35);
      v.z *= 0.55 * (1 - t * 0.45);
      v.y += 0.38;
    });
    g.scale(1, 1, 1);
    colorize(g, (c, x, y, z) => {
      const stripe = Math.abs(Math.sin(z * 9.5)) > 0.82 ? 1 : 0;
      c.copy(stripe ? C('#e8e0cf') : C('#2b2726'));
      if (y < 0.15) c.lerp(C('#4a423d'), 0.5);
      void x;
    });
    return { geo: g, mat: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.4 }) };
  },
  nut() {
    const g = new THREE.SphereGeometry(1, 22, 16);
    displace(g, (v) => {
      // Rounder at the bottom, a soft point on top.
      if (v.y > 0) {
        const k = v.y;
        v.x *= 1 - k * 0.18;
        v.z *= 1 - k * 0.18;
        v.y *= 1.08;
      }
      v.y *= 0.92;
      v.y += 0.85;
    });
    colorize(g, (c, x, y, z) => {
      c.copy(C('#8a4f22'));
      c.lerp(C('#b9773a'), Math.max(0, Math.sin(x * 7 + z * 3 + y * 11)) * 0.35);
      if (y < 0.55) c.lerp(C('#d9b27e'), 0.85); // the pale cupule scar
    });
    return { geo: g, mat: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.25 }) };
  },
  berry() {
    const g = new THREE.SphereGeometry(1, 22, 16);
    displace(g, (v) => {
      v.y *= 0.86;
      // The crown on top: a little star dimple.
      const r = Math.hypot(v.x, v.z);
      if (v.y > 0.6 && r < 0.45) v.y -= (0.45 - r) * 0.45 * (1 + 0.4 * Math.cos(Math.atan2(v.z, v.x) * 5));
      v.y += 0.86;
    });
    colorize(g, (c, x, y, z) => {
      c.copy(C('#2c3f86'));
      const r = Math.hypot(x, z);
      if (y > 1.45 && r < 0.42) c.copy(C('#3b2a4a'));
      c.lerp(C('#4c5da8'), Math.max(0, noise(x * 3, y * 3, z * 3)) * 0.4);
    });
    return { geo: g, mat: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, sheen: 1, sheenRoughness: 0.5, sheenColor: C('#b7c4ef') }) };
  },
  cracker() {
    // A square cracker: rounded slab, golden, with docking holes and a scalloped rim.
    const shape = new THREE.Shape();
    const s = 0.82;
    const n = 7;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const sc = 1 + Math.sin(t * Math.PI * n * 2) * 0.025;
        let x;
        let y;
        if (side === 0) [x, y] = [-s + 2 * s * t, -s];
        else if (side === 1) [x, y] = [s, -s + 2 * s * t];
        else if (side === 2) [x, y] = [s - 2 * s * t, s];
        else [x, y] = [-s, s - 2 * s * t];
        if (side === 0 && i === 0) shape.moveTo(x * sc, y * sc);
        else shape.lineTo(x * sc, y * sc);
      }
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 4 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.08, 0);
    g.computeVertexNormals();
    const holes = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) holes.push([i * 0.42, j * 0.42]);
    colorize(g, (c, x, y, z) => {
      c.copy(C('#d6a457'));
      c.lerp(C('#b27a36'), Math.min(1, Math.max(0, (Math.max(Math.abs(x), Math.abs(z)) - 0.62) * 3)));
      if (y > 0.3) for (const [hx, hz] of holes) if ((x - hx) ** 2 + (z + hz) ** 2 < 0.006) c.copy(C('#7a4518'));
      c.lerp(C('#efc277'), Math.max(0, noise(x * 4, 0, z * 4)) * 0.3);
    });
    return { geo: g, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }) };
  },
  straw() {
    const g = new THREE.SphereGeometry(1, 26, 18);
    displace(g, (v) => {
      // A heart-ish cone lying on its side, tip at +x.
      const t = (v.x + 1) / 2;
      const k = 1 - t * 0.62;
      v.y *= 0.82 * k;
      v.z *= 0.92 * k;
      v.x *= 1.05;
      v.y += 0.7;
    });
    const seeds = [];
    for (let i = 0; i < 40; i++) seeds.push(new THREE.Vector3(h1(i) * 2 - 1, h1(i + 50) * 2 - 1, h1(i + 90) * 2 - 1).normalize());
    colorize(g, (c, x, y, z) => {
      c.copy(C('#d61f2e'));
      const t = (x + 1.05) / 2.1;
      c.lerp(C('#ff4a3a'), t * 0.4);
      if (x < -0.75) c.lerp(C('#f2f0c0'), (-0.75 - x) * 2.5);
      const d = new THREE.Vector3(x, y - 0.7, z).normalize();
      for (const sd of seeds) if (d.distanceToSquared(sd) < 0.006) c.copy(C('#ffe27a'));
    });
    // The green calyx.
    const leaves = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const l = new THREE.ConeGeometry(0.22, 0.75, 4);
      l.scale(1, 1, 0.35);
      l.rotateZ(Math.PI / 2 + 0.25);
      l.rotateX(a);
      l.translate(-1.05, 0.72, 0);
      leaves.push(colorize(l, (c) => c.copy(C('#4f9e2f'))));
    }
    const stem = new THREE.CylinderGeometry(0.06, 0.08, 0.35, 6);
    stem.rotateZ(Math.PI / 2);
    stem.translate(-1.25, 0.72, 0);
    leaves.push(colorize(stem, (c) => c.copy(C('#3f7f25'))));
    const all = mergeGeometries([g.toNonIndexed(), ...leaves.map((l) => l.toNonIndexed())]);
    return { geo: all, mat: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2 }) };
  },
  cookie() {
    // A baked dome with a rounded rim, a lumpy top and browned edges, studded with chocolate chunks.
    const top = (r) => 0.12 + 0.26 * Math.sqrt(Math.max(0, 1 - r * r));
    const g = new THREE.SphereGeometry(1, 44, 22);
    displace(g, (v) => {
      const a = Math.atan2(v.z, v.x);
      const edge = 1 + Math.sin(a * 7) * 0.03 + Math.sin(a * 13 + 1) * 0.02;
      v.x *= edge;
      v.z *= edge;
      const up = v.y > 0;
      v.y *= up ? 0.26 : 0.12;
      if (up) v.y += noise(v.x * 2.6, 0, v.z * 2.6) * 0.05;
      v.y += 0.12;
    });
    const chips = [];
    for (let i = 0; i < 10; i++) {
      const a = h1(i * 3) * Math.PI * 2;
      const r = Math.sqrt(h1(i * 7 + 1)) * 0.74;
      const ch = new THREE.SphereGeometry(0.12 + h1(i) * 0.05, 8, 6);
      displace(ch, (v) => v.multiplyScalar(1 + noise(v.x * 9 + i, v.y * 9, v.z * 9) * 0.25));
      ch.scale(1, 0.72, 1);
      ch.translate(Math.cos(a) * r, top(r) + 0.01, Math.sin(a) * r);
      chips.push(colorize(ch, (c, x, y) => c.copy(C(y > top(r) + 0.05 ? '#5a3220' : '#3a1f12'))));
    }
    colorize(g, (c, x, y, z) => {
      c.copy(C('#c08a52'));
      c.lerp(C('#e4ba80'), Math.max(0, noise(x * 3, y, z * 3)) * 0.6);
      const r = Math.hypot(x, z);
      if (r > 0.78) c.lerp(C('#9a5f30'), Math.min(1, (r - 0.78) * 3));
      if (y < 0.12) c.lerp(C('#8a5428'), 0.6);
    });
    const all = mergeGeometries([g.toNonIndexed(), ...chips.map((c) => c.toNonIndexed())]);
    return { geo: all, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }) };
  },
  golden() {
    const base = MAKE.seed().geo.clone();
    colorize(base, (c, x, y, z) => {
      const stripe = Math.abs(Math.sin(z * 9.5)) > 0.82;
      c.copy(stripe ? C('#fff1a8') : C('#ffc21a'));
    });
    return { geo: base, mat: new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.2, emissive: C('#ff9e00'), emissiveIntensity: 0.55, clearcoat: 1 }) };
  },
  chili() {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push(new THREE.Vector3(-1 + t * 2, 0.45 + Math.sin(t * Math.PI) * 0.15, Math.sin(t * 2.4) * 0.35 - 0.2));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, 24, 0.32, 10, false);
    // Taper toward the tip (t = 1).
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const segs = 24;
    const radial = 11;
    for (let i = 0; i < p.count; i++) {
      const ring = Math.floor(i / radial);
      const t = ring / segs;
      const c0 = curve.getPoint(t);
      v.set(p.getX(i), p.getY(i), p.getZ(i)).sub(c0).multiplyScalar(Math.max(0.08, 1 - t * 0.92) * (t < 0.08 ? 0.75 + t * 3 : 1));
      p.setXYZ(i, c0.x + v.x, c0.y + v.y, c0.z + v.z);
    }
    g.computeVertexNormals();
    colorize(g, (c) => c.copy(C('#e01b14')));
    const stem = new THREE.CylinderGeometry(0.1, 0.16, 0.4, 6);
    stem.rotateZ(Math.PI / 2 - 0.4);
    stem.translate(-1.15, 0.6, -0.2);
    colorize(stem, (c) => c.copy(C('#3d8a2a')));
    const cap = new THREE.SphereGeometry(0.3, 8, 6);
    cap.scale(0.5, 1, 1);
    cap.translate(-0.98, 0.45, -0.2);
    colorize(cap, (c) => c.copy(C('#4f9e2f')));
    const all = mergeGeometries([g.toNonIndexed(), stem.toNonIndexed(), cap.toNonIndexed()]);
    return { geo: all, mat: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, emissive: C('#400000'), emissiveIntensity: 0.4 }) };
  },
  gum() {
    const g = new THREE.SphereGeometry(1, 24, 16);
    g.translate(0, 1, 0);
    colorize(g, (c, x, y, z) => {
      c.copy(C('#ff6fb0'));
      const swirl = Math.sin(Math.atan2(z, x) * 3 + y * 3);
      if (swirl > 0.7) c.copy(C('#ffd3e8'));
    });
    return { geo: g, mat: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }) };
  },
  pepper() {
    const g = new THREE.SphereGeometry(1, 18, 14);
    displace(g, (v) => {
      v.multiplyScalar(1 + noise(v.x * 3.5, v.y * 3.5, v.z * 3.5) * 0.1);
      v.y += 0.95;
    });
    colorize(g, (c, x, y, z) => {
      c.copy(C('#2a211c'));
      c.lerp(C('#5a4636'), Math.max(0, noise(x * 4, y * 4, z * 4)) * 0.8);
    });
    return { geo: g, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65 }) };
  },
};

const LIST = FOODS.map((f) => f.key);
let BUILT = null;
/** Geometry and material per food type, built once. */
export function foodKinds() {
  if (BUILT) return BUILT;
  BUILT = LIST.map((key) => {
    const m = (MAKE[key] || MAKE.seed)();
    m.geo.computeBoundingSphere();
    return m;
  });
  return BUILT;
}

/** One instanced batch per food type, with a per-instance colour (to tint pieces that would pop you). */
export function createFoodBatch(capacity = 600, { shadows = true } = {}) {
  const kinds = foodKinds();
  const group = new THREE.Group();
  const meshes = kinds.map((k) => {
    const m = new THREE.InstancedMesh(k.geo, k.mat, capacity);
    m.count = 0;
    m.castShadow = shadows;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    group.add(m);
    return m;
  });
  const counts = new Array(kinds.length).fill(0);
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const COL = new THREE.Color();
  return {
    group,
    meshes,
    begin() {
      counts.fill(0);
    },
    /** Adds a piece: type, world x/y/z, yaw, tilt, scale (world radius), tint (0..1 toward danger red). */
    add(type, x, y, z, yaw, tilt, r, tint = 0, roll = 0) {
      const m = meshes[type];
      if (!m) return;
      const i = counts[type];
      if (i >= capacity) return;
      E.set(tilt, yaw, roll, 'YXZ');
      Q.setFromEuler(E);
      P.set(x, y, z);
      S.set(r, r, r);
      M.compose(P, Q, S);
      m.setMatrixAt(i, M);
      if (tint > 0) COL.setRGB(1 + tint * 0.6, 1 - tint * 0.55, 1 - tint * 0.55);
      else COL.setRGB(1, 1, 1);
      m.setColorAt(i, COL);
      counts[type] = i + 1;
    },
    end() {
      meshes.forEach((m, k) => {
        m.count = counts[k];
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
      });
    },
  };
}

export const foodRadius = (type) => FOODS[type].r * 0.01 * VIS;
