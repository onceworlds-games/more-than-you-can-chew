// The eight arenas in 3D: the ground (a recoloured gingham on a lawn, a butcher-block counter, a pantry shelf, a night
// lawn, a party tablecloth, a campsite, a dinner table, a farmhouse table), grass, the props (Poly Haven models where a
// real object fits, sculpted ones elsewhere), burrows with their flags, and each arena's twist moving in time.

import * as THREE from 'three';
import { U } from './stage.js';
import { model, fit, texMaterial } from './assets.js';
import { recolored, blobMaterial, glowTexture } from './materials.js';
import { SEATS } from '../sim/config.js';

const h1 = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// ------------------------------------------------------------------ shared pieces

/** Instanced grass blades that sway, kept out of `holes` (rectangles in world units). */
function grass({ count, area, keepOut, height = [0.25, 0.6], colors = ['#3d6b22', '#8fbf4a'], seed = 1, under = null }) {
  const blade = new THREE.BufferGeometry();
  const seg = 4;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const w = 0.035 * (1 - t * 0.85);
    pos.push(-w, t, 0, w, t, 0);
    uv.push(0, t, 1, t);
    if (i < seg) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  blade.setIndex(idx);
  blade.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: THREE.DoubleSide });
  const u = { uTime: { value: 0 }, uBase: { value: new THREE.Color(colors[0]) }, uTip: { value: new THREE.Color(colors[1]) } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vT;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vT = uv.y;
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float sway = sin(uTime * 1.6 + ip.x * 0.7 + ip.z * 0.5) * 0.6 + sin(uTime * 2.7 + ip.x * 1.9) * 0.25;
        transformed.z += uv.y * uv.y * (0.28 + sway * 0.12);
        transformed.x += uv.y * uv.y * sway * 0.08;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uBase; uniform vec3 uTip; varying float vT;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(uBase, uTip, vT);');
  };
  mat.customProgramCacheKey = () => 'grass';
  const mesh = new THREE.InstancedMesh(blade, mat, count);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0;
  for (let i = 0; i < count * 6 && n < count; i++) {
    const x = area.x0 + h1(i * 3 + seed) * (area.x1 - area.x0);
    const z = area.z0 + h1(i * 7 + seed * 5) * (area.z1 - area.z0);
    let ok = true;
    for (const k of keepOut) if (x > k.x0 && x < k.x1 && z > k.z0 && z < k.z1) ok = false;
    if (!ok) continue;
    // Thicker near the keep-outs' edges? No: even, with clumps.
    const clump = Math.sin(x * 1.3) * Math.sin(z * 1.7);
    if (clump < -0.5 && h1(i) < 0.6) continue;
    const hgt = height[0] + h1(i * 11 + seed) * (height[1] - height[0]);
    e.set(0, h1(i * 13) * Math.PI * 2, (h1(i * 17) - 0.5) * 0.5);
    q.setFromEuler(e);
    p.set(x, under ? under(x, z) : 0, z);
    s.set(1 + h1(i) * 0.6, hgt, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.setHSL(0.24 + h1(i * 19) * 0.06, 0.45 + h1(i * 23) * 0.2, 0.42 + h1(i * 29) * 0.18);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.instanceMatrix.needsUpdate = true;
  return { mesh, u };
}

/** A soft-edged cloth (a subdivided plane with gentle folds and a hem that rolls down at the edges). */
function cloth(w, h, mat, { folds = 0.012, seed = 1, droop = 0.05, seg = 6 } = {}) {
  const g = new THREE.PlaneGeometry(w, h, Math.ceil(w * seg), Math.ceil(h * seg));
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    let y = Math.sin(x * 0.9 + seed) * Math.sin(z * 1.3 + seed * 2) * folds + Math.sin(x * 2.3 + z * 0.7) * folds * 0.35;
    const edge = Math.min(w / 2 - Math.abs(x), h / 2 - Math.abs(z));
    if (edge < 0.25) y -= (0.25 - edge) * droop * 4;
    p.setY(i, y);
  }
  g.computeVertexNormals();
  const uvs = g.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * w, uvs.getY(i) * h);
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.7, metalness: o.metalness ?? 0, ...o });
}
function phys(o) {
  return new THREE.MeshPhysicalMaterial(o);
}
const mesh = (g, m, cast = true) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
};

/** A drinking glass with lemonade (or water), a lemon slice and a straw. */
function lemonadeGlass(r) {
  const g = new THREE.Group();
  const h = r * 2.6;
  const glass = mesh(new THREE.CylinderGeometry(r, r * 0.9, h, 40, 1, true), phys({ color: '#ffffff', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.28, clearcoat: 1, side: THREE.DoubleSide }), false);
  glass.position.y = h / 2;
  const drink = mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.85, h * 0.7, 40), phys({ color: '#f7d65a', roughness: 0.1, transparent: true, opacity: 0.82, emissive: '#6b4a00', emissiveIntensity: 0.25 }), false);
  drink.position.y = h * 0.36;
  const base = mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.92, r * 0.2, 40), phys({ color: '#dff4ff', roughness: 0.05, transparent: true, opacity: 0.55 }), false);
  base.position.y = r * 0.1;
  const slice = mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, r * 0.1, 24), std('#f7e15a', { roughness: 0.4 }));
  slice.rotation.z = Math.PI / 2.4;
  slice.position.set(r * 0.85, h * 0.95, 0);
  const straw = mesh(new THREE.CylinderGeometry(r * 0.07, r * 0.07, h * 1.2, 10), std('#ff5a7a'));
  straw.position.set(-r * 0.3, h * 0.8, r * 0.2);
  straw.rotation.z = 0.25;
  g.add(base, drink, glass, slice, straw);
  // Its shadow is a soft blob: glass doesn't block much light.
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(r * 3, r * 3), blobMaterial(0.35));
  sh.rotation.x = -Math.PI / 2;
  sh.position.set(0.2 * r, 0.004, 0.25 * r);
  g.add(sh);
  return g;
}

// Pantry jars: what's inside (a grain texture), a paper label, and a screw lid or a gingham cloth cap tied with twine.
const JARS = [
  { name: 'Lentils', base: '#d4722a', grain: ['#ef9a4c', '#b65a1b', '#e2853a', '#f5ad62'], kind: 'disc', cap: 'cloth', color: '#d8413a', fill: 0.62 },
  { name: 'Oats', base: '#dcc796', grain: ['#f3e5bf', '#c7ad74', '#fff3d6', '#b89a5e'], kind: 'flake', cap: 'lid', color: '#3fa7f2', fill: 0.78 },
  { name: 'Coffee', base: '#3a1e0e', grain: ['#6b3a1f', '#4c2812', '#7d4a28', '#2a1508'], kind: 'bean', cap: 'cloth', color: '#2e3f9e', fill: 0.7 },
  { name: 'Peas', base: '#7f9e33', grain: ['#a6c552', '#6c8a26', '#b8d466', '#93b343'], kind: 'pea', cap: 'lid', color: '#5e9e3f', fill: 0.56 },
];
const jarTex = new Map();
function jarTextures(v) {
  if (jarTex.has(v)) return jarTex.get(v);
  const J = JARS[v];
  let seed = 7 + v * 31;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // What's inside.
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = J.base;
  x.fillRect(0, 0, 256, 256);
  const n = J.kind === 'flake' ? 700 : J.kind === 'pea' ? 260 : 520;
  for (let i = 0; i < n; i++) {
    const px = rnd() * 256;
    const py = rnd() * 256;
    const a = rnd() * Math.PI;
    const col = J.grain[Math.floor(rnd() * J.grain.length)];
    for (const ox of [0, -256, 256]) {
      x.save();
      x.translate(px + ox, py);
      x.rotate(a);
      x.fillStyle = 'rgba(0,0,0,0.28)';
      const [rw, rh] = J.kind === 'flake' ? [9, 5] : J.kind === 'pea' ? [8, 8] : J.kind === 'bean' ? [9, 6.5] : [7.5, 6];
      x.beginPath();
      x.ellipse(1.2, 1.6, rw, rh, 0, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = col;
      x.beginPath();
      x.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
      x.fill();
      if (J.kind === 'bean') {
        x.strokeStyle = 'rgba(20,8,2,0.75)';
        x.lineWidth = 1.4;
        x.beginPath();
        x.moveTo(-rw * 0.7, 0);
        x.quadraticCurveTo(0, rh * 0.35, rw * 0.7, 0);
        x.stroke();
      } else {
        x.fillStyle = 'rgba(255,255,255,0.35)';
        x.beginPath();
        x.ellipse(-rw * 0.3, -rh * 0.35, rw * 0.35, rh * 0.25, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
    }
  }
  const grain = new THREE.CanvasTexture(c);
  grain.colorSpace = THREE.SRGBColorSpace;
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(2.4, 1.3);
  // The label.
  const l = document.createElement('canvas');
  l.width = 512;
  l.height = 200;
  const y = l.getContext('2d');
  y.fillStyle = '#f6ecd4';
  y.fillRect(0, 0, 512, 200);
  y.strokeStyle = J.color;
  y.lineWidth = 10;
  y.strokeRect(14, 14, 484, 172);
  y.lineWidth = 3;
  y.strokeRect(30, 30, 452, 140);
  y.fillStyle = J.color;
  y.font = "bold 74px 'Shrikhand', Georgia, serif";
  y.textAlign = 'center';
  y.textBaseline = 'middle';
  y.fillText(J.name, 256, 96);
  y.fillStyle = 'rgba(59,34,24,0.55)';
  for (const [cx, w] of [[256, 220]]) y.fillRect(cx - w / 2, 142, w, 4);
  const label = new THREE.CanvasTexture(l);
  label.colorSpace = THREE.SRGBColorSpace;
  // A gingham cloth for the caps.
  const g = document.createElement('canvas');
  g.width = g.height = 64;
  const z = g.getContext('2d');
  z.fillStyle = '#fff7ea';
  z.fillRect(0, 0, 64, 64);
  z.fillStyle = J.color;
  z.globalAlpha = 0.55;
  z.fillRect(0, 0, 32, 64);
  z.fillRect(0, 0, 64, 32);
  z.globalAlpha = 1;
  z.fillRect(0, 0, 32, 32);
  const cloth = new THREE.CanvasTexture(g);
  cloth.colorSpace = THREE.SRGBColorSpace;
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
  cloth.repeat.set(4, 4);
  const t = { grain, label, cloth };
  jarTex.set(v, t);
  return t;
}

function jar(r, v = 0) {
  v = ((v % JARS.length) + JARS.length) % JARS.length;
  const J = JARS[v];
  const T = jarTextures(v);
  const g = new THREE.Group();
  const h = r * 2.3;
  // Glass: a rounded base, straight sides, shoulders and a short neck.
  const prof = [
    [0.001, 0],
    [r * 0.86, 0],
    [r * 0.97, r * 0.04],
    [r, r * 0.14],
    [r, h * 0.8],
    [r * 0.97, h * 0.86],
    [r * 0.88, h * 0.9],
    [r * 0.86, h * 0.97],
  ].map(([a, b]) => new THREE.Vector2(a, b));
  const glass = mesh(
    new THREE.LatheGeometry(prof, 48),
    phys({ color: '#eef8ff', roughness: 0.04, transparent: true, opacity: 0.26, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    false,
  );
  glass.renderOrder = 2;
  // What's inside, to its level, with a heaped top.
  const fh = h * J.fill;
  const fill = mesh(new THREE.CylinderGeometry(r * 0.94, r * 0.9, fh, 40, 1, false), std('#ffffff', { map: T.grain, roughness: 0.92 }));
  fill.position.y = fh / 2 + r * 0.04;
  const mound = mesh(new THREE.SphereGeometry(r * 0.94, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), std('#ffffff', { map: T.grain, roughness: 0.92 }), false);
  mound.scale.y = 0.18;
  mound.position.y = fh + r * 0.04;
  // The label, facing the camera.
  const label = mesh(new THREE.CylinderGeometry(r * 1.006, r * 1.006, h * 0.3, 32, 1, true, -1.15, 2.3), std('#ffffff', { map: T.label, roughness: 0.85 }), false);
  label.position.y = h * 0.42;
  g.add(fill, mound, label, glass);
  const top = h * 0.9;
  if (J.cap === 'lid') {
    // A screw lid: knurled sides and a domed top.
    const lm = std(J.color, { roughness: 0.32, metalness: 0.35, flatShading: true });
    const side = mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.93, r * 0.3, 36), lm);
    side.position.y = top + r * 0.15;
    const cap = mesh(new THREE.SphereGeometry(r * 0.93, 36, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(J.color, { roughness: 0.28, metalness: 0.35 }));
    cap.scale.y = 0.12;
    cap.position.y = top + r * 0.3;
    g.add(side, cap);
  } else {
    // A cloth cap: a disc of gingham draped over the neck, with folds at the hem, tied with twine.
    const cg = new THREE.CircleGeometry(r * 1.45, 64, 0, Math.PI * 2);
    cg.rotateX(-Math.PI / 2);
    const p = cg.attributes.position;
    const flat = r * 0.9;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i);
      const pz = p.getZ(i);
      const d = Math.hypot(px, pz);
      const a = Math.atan2(pz, px);
      let y = r * 0.2 - (d / flat) ** 2 * r * 0.03;
      let rr = d;
      if (d > flat) {
        // Puffed over the lid, pinched by the twine, then flaring into a folded hem.
        const k = d - flat;
        const pinch = r * 0.2;
        y = r * 0.17 - k * 1.05;
        if (k <= pinch) rr = flat + r * 0.07 * Math.sin((Math.PI * k) / pinch) + k * 0.12;
        else rr = flat + pinch * 0.12 + (k - pinch) * 0.55 + Math.sin(a * 9) * (k - pinch) * 0.15;
        y += Math.cos(a * 9) * Math.max(0, k - pinch) * 0.25;
      }
      p.setXYZ(i, d > 0 ? (px / d) * rr : 0, y, d > 0 ? (pz / d) * rr : 0);
    }
    cg.computeVertexNormals();
    const cloth = mesh(cg, std('#ffffff', { map: T.cloth, roughness: 0.9, side: THREE.DoubleSide }));
    cloth.position.y = top;
    const twine = mesh(new THREE.TorusGeometry(r * 0.94, r * 0.026, 8, 48), std('#c9a46a', { roughness: 0.95 }));
    twine.rotation.x = Math.PI / 2;
    twine.position.y = top - r * 0.04;
    const bow = mesh(new THREE.TorusGeometry(r * 0.1, r * 0.024, 6, 16), std('#c9a46a', { roughness: 0.95 }));
    bow.position.set(0, top - r * 0.04, r * 0.97);
    g.add(cloth, twine, bow);
  }
  return g;
}

function present(w, d, color, ribbon) {
  const g = new THREE.Group();
  const h = Math.min(w, d) * 0.85;
  const box = mesh(new THREE.BoxGeometry(w, h, d), std(color, { roughness: 0.55 }));
  box.position.y = h / 2;
  const rm = std(ribbon, { roughness: 0.3, metalness: 0.15 });
  const r1 = mesh(new THREE.BoxGeometry(w * 1.01, h * 1.01, d * 0.14), rm);
  r1.position.y = h / 2;
  const r2 = mesh(new THREE.BoxGeometry(w * 0.14, h * 1.01, d * 1.01), rm);
  r2.position.y = h / 2;
  g.add(box, r1, r2);
  for (const s of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(w * 0.13, w * 0.04, 8, 16), rm);
    loop.position.set(s * w * 0.1, h + w * 0.1, 0);
    loop.rotation.set(0, Math.PI / 2, s * 0.6);
    g.add(loop);
  }
  return g;
}

function sink(w, d) {
  const g = new THREE.Group();
  const steel = phys({ color: '#c9ced3', metalness: 1, roughness: 0.28 });
  const rimH = 0.08;
  const t = 0.12;
  for (const [x, z, sw, sd] of [
    [0, -d / 2 + t / 2, w, t],
    [0, d / 2 - t / 2, w, t],
    [-w / 2 + t / 2, 0, t, d],
    [w / 2 - t / 2, 0, t, d],
  ]) {
    const b = mesh(new THREE.BoxGeometry(sw, rimH, sd), steel);
    b.position.set(x, rimH / 2, z);
    g.add(b);
  }
  const basin = mesh(new THREE.BoxGeometry(w - t * 2, 0.02, d - t * 2), phys({ color: '#7f8a93', metalness: 1, roughness: 0.18 }), false);
  basin.position.y = 0.012;
  g.add(basin);
  const water = mesh(new THREE.PlaneGeometry(w - t * 2.4, d - t * 2.4), phys({ color: '#9fd2ee', roughness: 0.02, transparent: true, opacity: 0.35, clearcoat: 1 }), false);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.03;
  g.add(water);
  const drain = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 20), phys({ color: '#3d4247', metalness: 1, roughness: 0.4 }), false);
  drain.position.y = 0.03;
  g.add(drain);
  // The tap at the back.
  const tap = new THREE.Group();
  const post = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 16), steel);
  post.position.y = 0.45;
  const neck = mesh(new THREE.TorusGeometry(0.35, 0.06, 10, 24, Math.PI), steel);
  neck.position.set(0.35, 0.9, 0);
  neck.rotation.y = 0;
  tap.add(post, neck);
  tap.position.set(-w * 0.1, 0, -d / 2 - 0.05);
  tap.rotation.y = -Math.PI / 2;
  g.add(tap);
  return g;
}

function butter(w, d) {
  const g = new THREE.Group();
  const dish = mesh(new THREE.BoxGeometry(w * 1.25, 0.05, d * 1.4), phys({ color: '#f6f3ec', roughness: 0.15, clearcoat: 0.8 }));
  dish.position.y = 0.025;
  const b = mesh(new THREE.BoxGeometry(w * 0.85, d * 0.55, d * 0.9), phys({ color: '#ffe48a', roughness: 0.35, sheen: 0.3 }));
  b.position.y = 0.05 + (d * 0.55) / 2;
  // A curl of butter cut from the end.
  const curl = mesh(new THREE.TorusGeometry(0.1, 0.05, 8, 16, Math.PI * 1.4), phys({ color: '#ffe48a', roughness: 0.35 }));
  curl.position.set(w * 0.5, 0.12, 0);
  g.add(dish, b, curl);
  return g;
}

function tent(w, d) {
  const g = new THREE.Group();
  const h = d * 0.9;
  const fab = std('#e8743b', { roughness: 0.85, side: THREE.DoubleSide });
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(0, h);
  shape.lineTo(d / 2, 0);
  shape.lineTo(-d / 2, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false });
  geo.translate(0, 0, -w / 2);
  const body = mesh(geo, fab);
  body.rotation.y = Math.PI / 2;
  g.add(body);
  const door = mesh(new THREE.CircleGeometry(d * 0.24, 3), std('#3a2216', { side: THREE.DoubleSide }), false);
  door.position.set(-w / 2 - 0.005, d * 0.2, 0);
  door.rotation.set(0, -Math.PI / 2, Math.PI / 2);
  g.add(door);
  return g;
}

function campfire(r) {
  const g = new THREE.Group();
  const stone = std('#8d8a84', { roughness: 0.9 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = mesh(new THREE.DodecahedronGeometry(r * 0.22, 0), stone);
    s.position.set(Math.cos(a) * r * 0.85, r * 0.1, Math.sin(a) * r * 0.85);
    s.scale.set(1.2, 0.7, 1);
    s.rotation.y = a;
    g.add(s);
  }
  const wood = std('#6b4423', { roughness: 0.9 });
  const char = std('#2a1a12', { roughness: 1 });
  // A teepee of logs (their tops meet over the middle), charred at the tips.
  const len = r * 1.25;
  const tilt = 0.6;
  for (let i = 0; i < 5; i++) {
    const az = (i / 5) * Math.PI * 2 + 0.3;
    const l = mesh(new THREE.CylinderGeometry(r * 0.075, r * 0.1, len, 8), i % 2 ? wood : char);
    l.rotation.set(tilt, az, 0, 'YXZ');
    const d = (len / 2) * Math.sin(tilt);
    l.position.set(-Math.sin(az) * d, (len / 2) * Math.cos(tilt), -Math.cos(az) * d);
    g.add(l);
  }
  // Embers at the base.
  const ember = new THREE.MeshBasicMaterial({ color: '#ff6a1a', toneMapped: false });
  for (let i = 0; i < 7; i++) {
    const a = i * 2.4;
    const e = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.07, 0), ember);
    e.position.set(Math.cos(a) * r * 0.28, r * 0.03, Math.sin(a) * r * 0.28);
    g.add(e);
  }
  // Flames: layered glows that rise and shrink (each its own material so each fades on its own).
  const flames = new THREE.Group();
  const tones = ['#fff2b0', '#ffb43a', '#ff7a1a', '#ff4a10'];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.SpriteMaterial({ map: glowTexture(), color: tones[i % tones.length], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const s = new THREE.Sprite(m);
    s.userData.k = i;
    s.userData.core = i % tones.length === 0;
    flames.add(s);
  }
  flames.position.y = r * 0.2;
  g.add(flames);
  const light = new THREE.PointLight('#ff9a4a', 4, r * 10, 1.5);
  light.position.y = r * 0.9;
  g.add(light);
  g.userData.tick = (t) => {
    flames.children.forEach((s) => {
      const k = s.userData.k;
      const ph = (t * 1.3 + k / 10) % 1;
      const sway = Math.sin(t * 3.1 + k) * r * 0.12;
      s.position.set(Math.sin(k * 2.1 + t * 3) * r * 0.12 + sway * ph, ph * r * 1.5, Math.cos(k * 1.7 + t * 2.4) * r * 0.12);
      const sz = r * (s.userData.core ? 0.7 : 1.05) * (1 - ph * 0.65);
      s.scale.set(sz, sz * 1.5, 1);
      s.material.opacity = (1 - ph) * (s.userData.core ? 1 : 0.85);
    });
    light.intensity = 3.6 + Math.sin(t * 13) * 0.5 + Math.sin(t * 7.3) * 0.4;
  };
  return g;
}

function popper(r) {
  const g = new THREE.Group();
  const m = std('#ffcb2e', { roughness: 0.45, metalness: 0.3 });
  const cone = mesh(new THREE.ConeGeometry(r * 0.35, r * 1.4, 20), m);
  cone.rotation.z = Math.PI / 2 + 0.3;
  cone.position.set(0, r * 0.3, 0);
  g.add(cone);
  const colors = ['#ff6fb0', '#3fa7f2', '#9bd13a', '#ffcb2e', '#9a5beA'];
  for (let i = 0; i < 14; i++) {
    const s = mesh(new THREE.BoxGeometry(r * 0.5, 0.008, r * 0.05), std(colors[i % colors.length], { roughness: 0.6 }), false);
    s.position.set(-r * 0.6 - h1(i) * r * 1.6, 0.01, (h1(i + 4) - 0.5) * r * 1.8);
    s.rotation.y = h1(i + 9) * Math.PI;
    g.add(s);
  }
  return g;
}

function sunHat(r) {
  const g = new THREE.Group();
  const straw = std('#e9cf8a', { roughness: 0.9 });
  const brim = mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.04, 40), straw);
  brim.position.y = 0.02;
  const crown = mesh(new THREE.SphereGeometry(r * 0.48, 30, 14, 0, Math.PI * 2, 0, Math.PI / 2), straw);
  crown.scale.y = 0.9;
  const band = mesh(new THREE.CylinderGeometry(r * 0.49, r * 0.49, r * 0.12, 30, 1, true), std('#d8413a'));
  band.position.y = r * 0.06;
  g.add(brim, crown, band);
  g.rotation.z = 0.08;
  return g;
}

function napkin(r) {
  const g = new THREE.Group();
  const m = std('#fbf6ec', { roughness: 0.9 });
  const n = cloth(r * 2.2, r * 1.6, m, { folds: 0.02, seg: 10, droop: 0.01 });
  n.position.y = 0.012;
  n.rotation.y = 0.4;
  g.add(n);
  return g;
}

function stoneProp(r) {
  return model('stone_01').then((m) => {
    if (!m) return null;
    return fit(m, r * 2.2);
  });
}

/** A seat's pennant texture: its colour with its emblem in cream. */
const pennants = new Map();
function pennantTexture(seat) {
  if (pennants.has(seat)) return pennants.get(seat);
  const s = SEATS[seat % SEATS.length];
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = s.color;
  x.fillRect(0, 0, 128, 96);
  x.fillStyle = 'rgba(255,255,255,0.18)';
  x.fillRect(0, 0, 128, 14);
  drawEmblem(x, s.emblem, 44, 48, 22, '#fff2d9');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  pennants.set(seat, t);
  return t;
}

export function drawEmblem(x, kind, cx, cy, r, color) {
  x.save();
  x.fillStyle = color;
  x.strokeStyle = 'rgba(59,34,24,0.85)';
  x.lineWidth = r * 0.18;
  x.beginPath();
  if (kind === 'circle') x.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  else if (kind === 'square') x.rect(cx - r * 0.7, cy - r * 0.7, r * 1.4, r * 1.4);
  else if (kind === 'triangle') {
    x.moveTo(cx, cy - r);
    x.lineTo(cx + r * 0.95, cy + r * 0.7);
    x.lineTo(cx - r * 0.95, cy + r * 0.7);
    x.closePath();
  } else if (kind === 'diamond') {
    x.moveTo(cx, cy - r);
    x.lineTo(cx + r * 0.8, cy);
    x.lineTo(cx, cy + r);
    x.lineTo(cx - r * 0.8, cy);
    x.closePath();
  } else if (kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      if (i) x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    x.closePath();
  } else if (kind === 'heart') {
    x.moveTo(cx, cy + r * 0.85);
    x.bezierCurveTo(cx - r * 1.3, cy - r * 0.1, cx - r * 0.6, cy - r * 1.1, cx, cy - r * 0.4);
    x.bezierCurveTo(cx + r * 0.6, cy - r * 1.1, cx + r * 1.3, cy - r * 0.1, cx, cy + r * 0.85);
  } else if (kind === 'cross') {
    const a = r * 0.32;
    x.moveTo(cx - a, cy - r);
    x.lineTo(cx + a, cy - r);
    x.lineTo(cx + a, cy - a);
    x.lineTo(cx + r, cy - a);
    x.lineTo(cx + r, cy + a);
    x.lineTo(cx + a, cy + a);
    x.lineTo(cx + a, cy + r);
    x.lineTo(cx - a, cy + r);
    x.lineTo(cx - a, cy + a);
    x.lineTo(cx - r, cy + a);
    x.lineTo(cx - r, cy - a);
    x.lineTo(cx - a, cy - a);
    x.closePath();
  } else if (kind === 'moon') {
    x.arc(cx, cy, r * 0.9, 0.5, Math.PI * 2 - 0.5);
    x.arc(cx + r * 0.45, cy, r * 0.6, Math.PI * 2 - 0.9, 0.9, true);
    x.closePath();
  }
  x.fill();
  x.stroke();
  x.restore();
}

/** A burrow: a dark hollow in a ring of earth and wood shavings, its seat's pennant on a cocktail stick. */
function burrow(b, seat, ground) {
  const g = new THREE.Group();
  g.position.set(b.x * U, 0, b.y * U);
  g.rotation.y = Math.atan2(-b.ny, b.nx) - Math.PI / 2; // local -z points into the field... set below
  // Face: local +x toward the field.
  g.rotation.y = -Math.atan2(b.ny, b.nx);
  const r = 0.36;
  const holeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, '#050302');
    gr.addColorStop(0.6, '#1d120a');
    gr.addColorStop(0.85, '#4a3220');
    gr.addColorStop(1, 'rgba(74,50,32,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const hole = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ map: holeTex, transparent: true, depthWrite: false }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.006;
  hole.renderOrder = 1;
  g.add(hole);
  // A lumpy rim of earth (open toward the field a little).
  const earth = std(ground === 'counter' || ground === 'shelf' || ground === 'dinner' || ground === 'farm' || ground === 'party' ? '#c9a26b' : '#6e4a2c', { roughness: 1 });
  const rim = new THREE.TorusGeometry(r * 1.02, r * 0.26, 10, 36, Math.PI * 1.65);
  const p = rim.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = 1 + Math.sin(x * 23 + y * 17) * 0.12 + Math.sin(y * 31 - x * 11) * 0.08;
    p.setXYZ(i, x * (0.95 + n * 0.05), y * (0.95 + n * 0.05), z * 0.55 * n);
  }
  rim.computeVertexNormals();
  const rm = mesh(rim, earth);
  rm.rotation.x = -Math.PI / 2;
  rm.rotation.z = Math.PI + Math.PI * 0.175;
  rm.position.y = 0.02;
  g.add(rm);
  // Shavings (on tables) or crumbs of earth (outside).
  const sm = std(ground === 'lawn' || ground === 'camp' || ground === 'gingham' ? '#8a6038' : '#e8c890', { roughness: 0.9 });
  for (let i = 0; i < 14; i++) {
    const a = h1(i + seat * 31) * Math.PI * 1.6 + Math.PI * 0.2;
    const d = r * (1.25 + h1(i * 3 + seat) * 0.5);
    const s = mesh(new THREE.TorusGeometry(0.05, 0.016, 4, 8, Math.PI * 1.3), sm, false);
    s.position.set(Math.cos(a) * d, 0.02, Math.sin(a) * d);
    s.rotation.set(Math.PI / 2 + h1(i) - 0.5, h1(i + 2) * 6, h1(i + 5) * 6);
    g.add(s);
  }
  // The pennant on its stick, behind the hole.
  const stick = mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.85, 6), std('#d9b27e', { roughness: 0.7 }));
  stick.position.set(-r * 1.3, 0.425, r * 0.9);
  g.add(stick);
  const fg = new THREE.PlaneGeometry(0.34, 0.22, 6, 1);
  fg.translate(0.17, 0, 0);
  // Taper into a pennant.
  const fp = fg.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i);
    fp.setY(i, fp.getY(i) * (1 - (x / 0.34) * 0.75));
  }
  const flag = mesh(fg, new THREE.MeshStandardMaterial({ map: pennantTexture(seat), side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.set(-r * 1.3, 0.74, r * 0.9);
  flag.userData.base = fg.attributes.position.array.slice();
  g.add(flag);
  g.userData.flag = flag;
  return g;
}

// ------------------------------------------------------------------ the arenas

const LOOKS = {
  gingham: { bg: '#9cc278', sky: 'sunflowers', sun: [-0.5, 0.85, -0.42], sunColor: '#ffd6a0', sunI: 2.7, hemiI: 0.55, envI: 0.5, exposure: 1.0 },
  counter: { bg: '#e9dcc6', sky: 'sunflowers', sun: [-0.4, 0.75, -0.5], sunColor: '#fff0d8', sunI: 2.3, hemiI: 0.7, envI: 0.6, exposure: 1.0 },
  shelf: { bg: '#d8c7a8', sky: 'sunflowers', sun: [-0.2, 0.7, -0.7], sunColor: '#ffe2b8', sunI: 2.2, hemiI: 0.7, envI: 0.55, exposure: 1.0 },
  lawn: { bg: '#0d1424', sky: 'evening_meadow', sun: [0.4, 0.8, -0.4], sunColor: '#9fb4ff', sunI: 0.9, hemiI: 0.25, envI: 0.25, exposure: 1.0, dark: true },
  party: { bg: '#f3d9e4', sky: 'sunflowers', sun: [-0.45, 0.85, -0.4], sunColor: '#fff0dc', sunI: 2.4, hemiI: 0.7, envI: 0.6, exposure: 1.0 },
  camp: { bg: '#4e6a3a', sky: 'evening_meadow', sun: [-0.7, 0.62, -0.5], sunColor: '#ffb070', sunI: 2.6, hemiI: 0.5, envI: 0.5, exposure: 1.02 },
  dinner: { bg: '#5a3a26', sky: 'sunflowers', sun: [-0.45, 0.82, -0.45], sunColor: '#ffd7a8', sunI: 2.4, hemiI: 0.5, envI: 0.6, exposure: 1.0 },
  farm: { bg: '#cdb894', sky: 'sunflowers', sun: [-0.55, 0.78, -0.45], sunColor: '#ffd29a', sunI: 2.6, hemiI: 0.55, envI: 0.55, exposure: 1.0 },
};

export const arenaLook = (arena) => LOOKS[arena.ground] || LOOKS.gingham;

/**
 * Builds an arena's world. Returns { group, look, tick(dt, t, w), heapSpot(b), flags, dispose }.
 * Models load in the background and pop in when ready (the arena is playable at once).
 */
export function buildArena(arena, { quality = 'high', seats = 8, burrows = [] } = {}) {
  const group = new THREE.Group();
  const look = arenaLook(arena);
  const W = arena.w * U;
  const H = arena.h * U;
  const ticks = [];
  const disposables = [];
  const grassN = quality === 'low' ? 1500 : quality === 'medium' ? 3500 : 7000;
  const add = (o, x = 0, z = 0, y = 0, rotY = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = rotY;
    group.add(o);
    return o;
  };
  const addModel = (name, size, x, z, rotY = 0, opts = {}) => {
    model(name).then((m) => {
      if (!m) return;
      let obj = m;
      if (opts.pick) {
        const keep = [];
        m.traverse((o) => {
          if (o.isMesh && opts.pick.some((p) => o.name.includes(p))) keep.push(o);
        });
        const g = new THREE.Group();
        for (const k of keep) {
          k.updateWorldMatrix(true, false);
          const c = k.clone();
          c.applyMatrix4(k.matrixWorld);
          g.add(c);
        }
        obj = g;
      }
      const f = fit(obj, size, opts);
      add(f, x, z, opts.y || 0, rotY);
      if (opts.then) opts.then(f);
    });
  };

  // Ground.
  const big = 70;
  const ground = arena.ground;
  if (ground === 'gingham') {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(big, big), texMaterial('sparse_grass', { repeat: big / 7, normalScale: 0.8 }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(W / 2, -0.03, H / 2);
    lawn.receiveShadow = true;
    group.add(lawn);
    const blanket = cloth(W - 2.2, H - 2.3, recolored('gingham_check', { repeat: 1 / 2.2, c0: '#8a1a16', c1: '#d0533f', c2: '#fff3e2', sheen: 0.45, normalScale: 1.4 }), { folds: 0.008, seg: 5, droop: 0.04 });
    blanket.position.set(W / 2, 0, H / 2);
    group.add(blanket);
    const g = grass({ count: grassN, area: { x0: -6, x1: W + 6, z0: -5, z1: H + 4 }, keepOut: [{ x0: 1.0, x1: W - 1.0, z0: 1.05, z1: H - 1.05 }], height: [0.22, 0.75] });
    group.add(g.mesh);
    ticks.push((dt, t) => (g.u.uTime.value = t));
  } else if (ground === 'lawn') {
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(big, big), texMaterial('sparse_grass', { repeat: big / 7, normalScale: 0.8, color: '#9fb0a0' }));
    lawn.rotation.x = -Math.PI / 2;
    lawn.position.set(W / 2, -0.005, H / 2);
    lawn.receiveShadow = true;
    group.add(lawn);
    const f = arena.field;
    const g = grass({ count: grassN, area: { x0: -6, x1: W + 6, z0: -5, z1: H + 4 }, keepOut: [{ x0: f.x * U - 0.4, x1: (f.x + f.w) * U + 0.4, z0: f.y * U - 0.4, z1: (f.y + f.h) * U + 0.4 }], height: [0.25, 0.9], colors: ['#24402a', '#5c8a4a'] });
    group.add(g.mesh);
    ticks.push((dt, t) => (g.u.uTime.value = t));
  } else {
    // Tables: a big surface and what's beyond its edge.
    const surf = {
      counter: () => texMaterial('kitchen_wood', { repeat: [big / 6, big / 6], normalScale: 0.6 }),
      shelf: () => texMaterial('white_planks_clean', { repeat: [big / 5, big / 5] }),
      party: () => recolored('gingham_check', { repeat: 1 / 2.4, c0: '#2d5fb8', c1: '#86aee8', c2: '#f7fbff', sheen: 0.4, normalScale: 1.2 }),
      camp: () => texMaterial('brown_mud_leaves_01', { repeat: big / 6 }),
      dinner: () => texMaterial('wood_table', { repeat: big / 6, normalScale: 0.7 }),
      farm: () => texMaterial('wood_table', { repeat: big / 7, normalScale: 0.9, color: '#e8dccb' }),
    }[ground];
    const mat = surf ? surf() : std('#c8b08a');
    if (ground === 'party') {
      const t = cloth(W + 6, H + 5, mat, { folds: 0.01, seg: 3, droop: 0.0 });
      t.position.set(W / 2, 0, H / 2);
      group.add(t);
    } else {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(big, big), mat);
      g.rotation.x = -Math.PI / 2;
      g.position.set(W / 2, 0, H / 2);
      g.receiveShadow = true;
      group.add(g);
    }
    if (ground === 'camp') {
      const g = grass({ count: Math.round(grassN * 0.5), area: { x0: -6, x1: W + 6, z0: -5, z1: H + 4 }, keepOut: [{ x0: 1.2, x1: W - 1.2, z0: 1.2, z1: H - 1.2 }], height: [0.2, 0.7], colors: ['#3b5a24', '#9ab655'] });
      group.add(g.mesh);
      ticks.push((dt, t) => (g.u.uTime.value = t));
    }
  }

  // Obstacles and decor.
  for (const o of arena.obstacles) {
    const x = (o.k === 'r' ? o.x + o.w / 2 : o.x) * U;
    const z = (o.k === 'r' ? o.y + o.h / 2 : o.y) * U;
    const r = (o.r || 0) * U;
    switch (o.prop) {
      case 'basket':
        addModel('wicker_basket_01', Math.max(o.w, o.h) * U * 1.05, x, z, 0);
        break;
      case 'glass':
        add(lemonadeGlass(r * 0.95), x, z);
        break;
      case 'sink':
        add(sink(o.w * U, o.h * U), x, z);
        break;
      case 'jar':
        add(jar(r * 0.95, o.v || 0), x, z);
        break;
      case 'lantern':
        addModel('wooden_lantern_01', 1.6, x, z, 0, { axis: 'y' });
        break;
      case 'pot':
        addModel('planter_pot_clay', r * 2.1, x, z, 0.4);
        break;
      case 'gnome':
        addModel('garden_gnome', 2.2, x, z, -0.6, { axis: 'y' });
        break;
      case 'cake':
        addModel('strawberry_chocolate_cake', r * 2.05, x, z, 0.3);
        break;
      case 'present':
        add(present(o.w * U, o.h * U, o.v ? '#3fa7f2' : '#ff6fb0', o.v ? '#ffcb2e' : '#fff2d9'), x, z, 0, o.v ? 0.15 : -0.1);
        break;
      case 'tent':
        add(tent(o.w * U, o.h * U), x, z);
        break;
      case 'fire': {
        const f = campfire(r);
        add(f, x, z);
        ticks.push((dt, t) => f.userData.tick(t));
        break;
      }
      case 'teapot':
        addModel('tea_set_01', r * 2.6, x, z, 0.5, { pick: ['teapot'] });
        break;
      case 'bowl':
        addModel('wooden_bowl_02', r * 2.15, x, z, 0.2);
        break;
      case 'butter':
        add(butter(o.w * U, o.h * U), x, z);
        break;
      case 'water':
        break; // drawn with the stream
      default:
        add(mesh(new THREE.CylinderGeometry(r || 0.4, r || 0.4, 0.4, 24), std('#b08a5a')), x, z, 0.2);
    }
  }
  for (const d of arena.decor || []) {
    const x = d.x * U;
    const z = d.y * U;
    const r = (d.r || 60) * U;
    if (d.prop === 'hat') add(sunHat(r), x, z, 0, 0.5);
    else if (d.prop === 'napkin') add(napkin(r), x, z);
    else if (d.prop === 'stone') stoneProp(r).then((s) => s && add(s, x, z, 0, h1(x) * 6));
    else if (d.prop === 'board') addModel('wooden_cutting_board', (d.w || 300) * U, (d.x + (d.w || 0) / 2) * U, (d.y + (d.h || 0) / 2) * U, 0.05);
    else if (d.prop === 'popper') add(popper(r), x, z, 0, 0.6);
  }

  // Scenery beyond the field: giant picnic things that frame the view (never on the field).
  if (ground === 'gingham') {
    addModel('croissant', 1.5, 2.6, -0.9, 0.6);
    addModel('lemon', 0.75, 15.6, -0.6, 0.3);
    addModel('food_apple_01', 0.85, 17.6, 2.6, 0);
    addModel('jug_01', 2.0, -1.4, 4.6, 1.2);
    addModel('hamburger_buns', 1.6, 19.4, 9.8, 0.4);
  } else if (ground === 'counter') {
    addModel('jug_01', 2.2, -1.6, 2.4, 0.4);
    addModel('lemon', 0.8, 18.8, 6.2, 1.0);
    addModel('croissant', 1.6, 9.5, -1.2, 0.1);
  } else if (ground === 'party') {
    addModel('carrot_cake', 2.4, -1.8, 9.2, 0.4);
    addModel('food_apple_01', 0.9, 19.3, 3.0, 0.3);
  } else if (ground === 'camp') {
    addModel('tree_stump_01', 3.4, -2.4, 3.2, 0.6);
    addModel('stone_01', 1.4, 19.5, 7.0, 0.3);
  } else if (ground === 'dinner') {
    addModel('tea_set_01', 2.6, -1.8, 3.0, 0.3, { pick: ['cup_small_01', 'saucer_circular_03'] });
    addModel('wooden_bowl_02', 2.2, 19.6, 4.4, 0.6);
  } else if (ground === 'farm') {
    addModel('jug_01', 2.0, 19.3, 2.2, 0.7);
    addModel('hamburger_buns', 1.7, -1.6, 8.6, 1.2);
  } else if (ground === 'lawn') {
    addModel('tree_stump_01', 3.0, 19.8, 9.0, 1.2);
    addModel('stone_01', 1.6, -1.8, 2.4, 0.2);
  } else if (ground === 'shelf') {
    // The shelf's back wall and its lip.
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(W + 8, 6), texMaterial('white_planks_clean', { repeat: [5, 1.2], color: '#efe6d6' }));
    wall.position.set(W / 2, 3, -0.6);
    wall.receiveShadow = true;
    group.add(wall);
  }

  // Twists.
  if (arena.slip) {
    const m = phys({ color: '#bfe3f7', roughness: 0.02, transparent: true, opacity: 0.38, clearcoat: 1, clearcoatRoughness: 0 });
    for (const z of arena.slip) {
      const sh = new THREE.Shape();
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = z.r * U * (0.92 + Math.sin(a * 3 + z.x) * 0.06 + Math.sin(a * 5 + z.y) * 0.04);
        if (i) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      const p = mesh(new THREE.ShapeGeometry(sh), m, false);
      p.rotation.x = -Math.PI / 2;
      add(p, z.x * U, z.y * U, 0.006);
    }
  }
  if (arena.stream) {
    const s = arena.stream;
    const ax = s.ax * U;
    const az = s.ay * U;
    const bx = s.bx * U;
    const bz = s.by * U;
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    const wgeo = new THREE.PlaneGeometry(len + 2, s.r * U * 2.6, 60, 4);
    wgeo.rotateX(-Math.PI / 2);
    const wm = phys({ color: '#2f8aa0', roughness: 0.04, transparent: true, opacity: 0.9, clearcoat: 1, metalness: 0.15 });
    const wu = { uTime: { value: 0 } };
    wm.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, wu);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = position;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; varying vec3 vW;')
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float w1 = sin(vW.x * 9.0 - uTime * 4.0 + sin(vW.z * 7.0) * 1.2);
          float w2 = sin(vW.x * 14.0 + vW.z * 9.0 - uTime * 5.5);
          normal = normalize(normal + vec3(w1 * 0.12, 0.0, w2 * 0.1));`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float across = abs(vW.z) / ${(s.r * U * 1.3).toFixed(3)};
          float deep = 1.0 - smoothstep(0.0, 0.95, across);
          // Shallow sandy edges, a deep teal middle, foam where it meets the bank, glints that run downstream.
          diffuseColor.rgb = mix(vec3(0.62, 0.55, 0.38), diffuseColor.rgb, smoothstep(0.0, 0.35, deep));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.32, 0.4), deep * 0.55);
          float foam = smoothstep(0.78, 0.98, across) * (0.55 + 0.45 * sin(vW.x * 23.0 - uTime * 3.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 0.95), foam * 0.7);
          diffuseColor.rgb += vec3(0.9) * smoothstep(0.93, 1.0, sin(vW.x * 20.0 - uTime * 6.0 + vW.z * 3.0)) * 0.35 * deep;
          diffuseColor.a = mix(0.75, 0.95, deep);`,
        );
    };
    ticks.push((dt, t) => (wu.uTime.value = t));
    const water = mesh(wgeo, wm, false);
    water.position.set((ax + bx) / 2, 0.004, (az + bz) / 2);
    water.rotation.y = -ang;
    group.add(water);
    // Banks: darker wet earth either side.
    const bgeo = new THREE.PlaneGeometry(len + 2, s.r * U * 3.4);
    bgeo.rotateX(-Math.PI / 2);
    const bank = new THREE.Mesh(bgeo, std('#4b3622', { roughness: 0.95 }));
    bank.position.set((ax + bx) / 2, 0.002, (az + bz) / 2);
    bank.rotation.y = -ang;
    // Pebbles along both banks.
    for (let i = 0; i < 14; i++) {
      const u = (i + 0.5) / 14 + (Math.sin(i * 12.9) * 0.5) / 14;
      const side = i % 2 ? 1 : -1;
      const off = s.r * U * (1.45 + Math.abs(Math.sin(i * 7.3)) * 0.25) * side;
      const px = ax + (bx - ax) * u + Math.cos(ang + Math.PI / 2) * off;
      const pz = az + (bz - az) * u + Math.sin(ang + Math.PI / 2) * off;
      stoneProp(0.07 + Math.abs(Math.sin(i * 3.1)) * 0.07).then((st) => st && add(st, px, pz, -0.01, i * 1.7));
    }
    bank.receiveShadow = true;
    group.add(bank);
    // Log bridges and stepping stones at the crossings.
    const bark = std('#6b4a2e', { roughness: 0.95 });
    for (const c of arena.crossings) {
      const cx = c.x * U;
      const cz = c.y * U;
      if (c.kind === 'bridge') {
        const g = new THREE.Group();
        for (const off of [-0.17, 0.17]) {
          const log = mesh(new THREE.CylinderGeometry(0.16, 0.18, s.r * U * 3.2, 12), bark);
          log.rotation.z = Math.PI / 2;
          log.position.set(0, 0.1, off);
          g.add(log);
        }
        g.position.set(cx, 0, cz);
        g.rotation.y = -ang + Math.PI / 2;
        group.add(g);
      } else {
        for (let i = -1; i <= 1; i++) {
          const px = cx + Math.cos(ang + Math.PI / 2) * i * 0.32;
          const pz = cz + Math.sin(ang + Math.PI / 2) * i * 0.32;
          stoneProp(0.17).then((st) => st && add(st, px, pz, -0.02, i));
        }
      }
    }
  }
  let disc = null;
  if (arena.disc) {
    const d = arena.disc;
    const g = new THREE.Group();
    const top = mesh(new THREE.CylinderGeometry(d.r * U, d.r * U * 0.98, 0.08, 72), texMaterial('kitchen_wood', { repeat: 2, normalScale: 0.5, color: '#f0d5b5' }));
    top.position.y = 0.04;
    const rim = mesh(new THREE.TorusGeometry(d.r * U, 0.035, 8, 96), std('#7a4a26', { roughness: 0.5 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    g.add(top, rim);
    // Marks so the turn reads.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dot = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 12), std('#b07a4a'), false);
      dot.position.set(Math.cos(a) * d.r * U * 0.9, 0.085, Math.sin(a) * d.r * U * 0.9);
      g.add(dot);
    }
    g.position.set(d.x * U, -0.04, d.y * U);
    group.add(g);
    disc = g;
  }
  const flies = [];
  if (arena.dark) {
    const fm = new THREE.SpriteMaterial({ map: glowTexture(), color: '#d8ff7a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < arena.dark.flies; i++) {
      const s = new THREE.Sprite(fm);
      s.scale.set(0.35, 0.35, 1);
      group.add(s);
      flies.push(s);
    }
    const lantern = arena.dark.lantern;
    const pl = new THREE.PointLight('#ffb35a', 6, lantern.r * U * 1.6, 1.5);
    pl.position.set(lantern.x * U, 1.0, lantern.y * U);
    group.add(pl);
    ticks.push((dt, t) => (pl.intensity = 5.5 + Math.sin(t * 9) * 0.3 + Math.sin(t * 5.3) * 0.3));
  }

  // Burrows.
  const flags = [];
  burrows.forEach((b, i) => {
    const node = burrow(b, i, ground);
    group.add(node);
    flags.push(node.userData.flag);
  });
  ticks.push((dt, t) => {
    for (const f of flags) {
      const p = f.geometry.attributes.position;
      const base = f.userData.base;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3];
        p.setZ(i, Math.sin(t * 6 + x * 18) * x * 0.12);
      }
      p.needsUpdate = true;
    }
  });

  return {
    group,
    look,
    disc,
    flies,
    tick(dt, t, w) {
      for (const f of ticks) f(dt, t);
      if (disc && w) disc.rotation.y = -arena.disc.w * w.t;
    },
    dispose() {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      for (const d of disposables) d.dispose();
    },
  };
}

/** Where a burrow's heap sits (world units): behind the hole and to one side, out of the way. */
export function heapSpot(b) {
  const px = -b.ny;
  const py = b.nx;
  return { x: (b.x - b.nx * 30 + px * 62) * U, z: (b.y - b.ny * 30 + py * 62) * U };
}
