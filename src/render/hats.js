// Hats a hamster earns by playing: small sculpted things that sit on the head bone. Model units as hamster.js (the head is
// about 1.6 across); each hat sits on the crown at its origin.

import * as THREE from 'three';

export const HATS = [
  { id: 'party', name: 'Party Hat' },
  { id: 'bow', name: 'Big Bow' },
  { id: 'daisy', name: 'Daisy' },
  { id: 'beanie', name: 'Bobble Beanie' },
  { id: 'sprout', name: 'Sprout' },
  { id: 'acorn', name: 'Acorn Cap' },
  { id: 'chef', name: 'Chef Hat' },
  { id: 'cowboy', name: 'Cowboy Hat' },
  { id: 'propeller', name: 'Propeller Cap' },
  { id: 'strawberry', name: 'Strawberry' },
  { id: 'tophat', name: 'Top Hat' },
  { id: 'crown', name: 'Golden Crown' },
];

const M = {};
const mat = (key, o) => M[key] || (M[key] = new THREE.MeshStandardMaterial(o));
const phys = (key, o) => M[key] || (M[key] = new THREE.MeshPhysicalMaterial(o));

function stripes(colors, n = 8, w = 128) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = 16;
  const x = c.getContext('2d');
  for (let i = 0; i < n; i++) {
    x.fillStyle = colors[i % colors.length];
    x.fillRect((i * w) / n, 0, w / n + 1, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

const mesh = (g, m, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
};

const MAKERS = {
  party() {
    const g = new THREE.Group();
    const m = M.partyMat || (M.partyMat = new THREE.MeshStandardMaterial({ map: stripes(['#ff5a7a', '#ffd23f', '#3fa7f2', '#9bd13a'], 8), roughness: 0.6 }));
    const cone = mesh(new THREE.ConeGeometry(0.34, 0.9, 24, 1, true), m, 0, 0.42, 0);
    cone.material.side = THREE.DoubleSide;
    const pom = mesh(new THREE.SphereGeometry(0.12, 12, 8), mat('pom', { color: '#fff4d6', roughness: 0.9 }), 0, 0.9, 0);
    g.add(cone, pom);
    g.rotation.z = -0.25;
    return g;
  },
  bow() {
    const g = new THREE.Group();
    const m = phys('bow', { color: '#e8324f', roughness: 0.35, sheen: 0.5, sheenColor: new THREE.Color('#ff9fb0') });
    const knot = mesh(new THREE.SphereGeometry(0.11, 12, 8), m, 0, 0.08, 0);
    const l = mesh(new THREE.ConeGeometry(0.2, 0.42, 12), m, 0, 0.1, -0.24);
    l.rotation.x = -Math.PI / 2;
    l.scale.set(1, 1, 0.45);
    const r = l.clone();
    r.position.z = 0.24;
    r.rotation.x = Math.PI / 2;
    g.add(knot, l, r);
    g.rotation.z = 0.15;
    return g;
  },
  daisy() {
    const g = new THREE.Group();
    const pm = mat('petal', { color: '#ffffff', roughness: 0.5 });
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const p = mesh(new THREE.SphereGeometry(0.12, 8, 6), pm, Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17);
      p.scale.set(1.7, 0.25, 0.6);
      p.rotation.y = -a;
      g.add(p);
    }
    const c = mesh(new THREE.SphereGeometry(0.1, 12, 8), mat('daisyC', { color: '#ffbf1f', roughness: 0.7 }), 0, 0.09, 0);
    c.scale.y = 0.6;
    g.add(c);
    g.position.set(0.1, 0, 0.32);
    g.rotation.x = 0.35;
    return g;
  },
  beanie() {
    const g = new THREE.Group();
    const m = M.beanie || (M.beanie = new THREE.MeshStandardMaterial({ map: stripes(['#2e6fd1', '#f4f0e6', '#2e6fd1', '#e8473b'], 4), roughness: 0.95 }));
    const dome = mesh(new THREE.SphereGeometry(0.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -0.06, 0);
    dome.scale.set(1.05, 0.8, 1.05);
    const rim = mesh(new THREE.TorusGeometry(0.5, 0.08, 8, 28), mat('beanieRim', { color: '#e8473b', roughness: 0.95 }), 0, -0.04, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(1.05, 1.05, 1);
    const pom = mesh(new THREE.SphereGeometry(0.15, 12, 8), mat('pom', { color: '#fff4d6', roughness: 0.9 }), 0, 0.42, 0);
    g.add(dome, rim, pom);
    return g;
  },
  sprout() {
    const g = new THREE.Group();
    const gm = mat('leaf', { color: '#6cc04a', roughness: 0.5 });
    const stem = mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 6), mat('stem', { color: '#5aa83c' }), 0, 0.15, 0);
    const l1 = mesh(new THREE.SphereGeometry(0.14, 12, 8), gm, 0.1, 0.32, 0);
    l1.scale.set(1.6, 0.25, 0.8);
    l1.rotation.z = 0.4;
    const l2 = l1.clone();
    l2.position.x = -0.1;
    l2.rotation.z = -0.4;
    g.add(stem, l1, l2);
    return g;
  },
  acorn() {
    const g = new THREE.Group();
    const cap = mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('acorn', { color: '#8a5a2b', roughness: 0.95 }), 0, -0.04, 0);
    cap.scale.set(1, 0.55, 1);
    const stalk = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.18, 6), mat('acornS', { color: '#5e3a1a' }), 0.04, 0.27, 0);
    stalk.rotation.z = -0.3;
    g.add(cap, stalk);
    return g;
  },
  chef() {
    const g = new THREE.Group();
    const w = mat('chef', { color: '#fbfbf6', roughness: 0.85 });
    const band = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.22, 20), w, 0, 0.1, 0);
    g.add(band);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.add(mesh(new THREE.SphereGeometry(0.22, 12, 8), w, Math.cos(a) * 0.18, 0.38, Math.sin(a) * 0.18));
    }
    g.add(mesh(new THREE.SphereGeometry(0.25, 12, 8), w, 0, 0.48, 0));
    return g;
  },
  cowboy() {
    const g = new THREE.Group();
    const m = mat('cowboy', { color: '#a0682e', roughness: 0.8 });
    const brim = mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 28), m, 0, 0.02, 0);
    brim.scale.set(1, 1, 0.8);
    const crown = mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.4, 20), m, 0, 0.22, 0);
    crown.scale.set(1, 1, 0.8);
    const band = mesh(new THREE.CylinderGeometry(0.365, 0.37, 0.08, 20), mat('cowboyB', { color: '#3b2218' }), 0, 0.07, 0);
    band.scale.set(1, 1, 0.8);
    g.add(brim, crown, band);
    g.rotation.z = -0.12;
    return g;
  },
  propeller() {
    const g = new THREE.Group();
    const m = M.prop || (M.prop = new THREE.MeshStandardMaterial({ map: stripes(['#ff3b3b', '#ffd23f', '#3fa7f2', '#5ccb5f'], 4), roughness: 0.6 }));
    const cap = mesh(new THREE.SphereGeometry(0.46, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, -0.04, 0);
    cap.scale.y = 0.6;
    const stalk = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), mat('propS', { color: '#444' }), 0, 0.3, 0);
    const blades = new THREE.Group();
    blades.position.y = 0.4;
    for (const s of [-1, 1]) {
      const b = mesh(new THREE.BoxGeometry(0.42, 0.02, 0.1), mat('propB', { color: '#ffd23f', roughness: 0.4 }), s * 0.22, 0, 0);
      b.rotation.x = 0.3 * s;
      blades.add(b);
    }
    g.add(cap, stalk, blades);
    g.userData.spin = blades;
    return g;
  },
  strawberry() {
    const g = new THREE.Group();
    const berry = mesh(new THREE.SphereGeometry(0.42, 20, 14), phys('straw', { color: '#e3213a', roughness: 0.35, clearcoat: 0.6 }), 0, 0.12, 0);
    berry.scale.set(1, 0.7, 1);
    g.add(berry);
    const sm = mat('seed', { color: '#ffe27a' });
    for (let i = 0; i < 18; i++) {
      const a = i * 2.399;
      const yy = 0.15 + ((i % 6) / 6) * 0.15;
      const r = Math.sqrt(Math.max(0, 1 - ((yy - 0.12) / 0.3) ** 2)) * 0.43;
      const s = mesh(new THREE.SphereGeometry(0.025, 5, 4), sm, Math.cos(a) * r, yy, Math.sin(a) * r);
      g.add(s);
    }
    const lm = mat('leaf', { color: '#6cc04a', roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const l = mesh(new THREE.ConeGeometry(0.08, 0.3, 4), lm, Math.cos(a) * 0.12, 0.38, Math.sin(a) * 0.12);
      l.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
      g.add(l);
    }
    return g;
  },
  tophat() {
    const g = new THREE.Group();
    const m = mat('top', { color: '#1d1a1f', roughness: 0.55 });
    const brim = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.04, 24), m, 0, 0.02, 0);
    const crown = mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.62, 24), m, 0, 0.33, 0);
    const band = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 24), mat('topB', { color: '#d8413a' }), 0, 0.1, 0);
    g.add(brim, crown, band);
    g.rotation.z = -0.15;
    return g;
  },
  crown() {
    const g = new THREE.Group();
    const m = phys('gold', { color: '#ffcc33', metalness: 1, roughness: 0.22 });
    const ring = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.22, 24, 1, true), m, 0, 0.1, 0);
    ring.material.side = THREE.DoubleSide;
    g.add(ring);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = mesh(new THREE.ConeGeometry(0.09, 0.22, 4), m, Math.cos(a) * 0.36, 0.3, Math.sin(a) * 0.36);
      g.add(p);
      const gem = mesh(new THREE.SphereGeometry(0.05, 8, 6), phys('gem', { color: '#e8324f', roughness: 0.05, clearcoat: 1, emissive: '#5a0010' }), Math.cos(a) * 0.37, 0.12, Math.sin(a) * 0.37);
      g.add(gem);
    }
    return g;
  },
};

/** A hat by id (a new group each time; materials are shared), or null. */
export function makeHat(id) {
  const f = MAKERS[id];
  if (!f) return null;
  const g = f();
  g.userData.id = id;
  return g;
}
