// The simulation drawn in 3D: builds the arena for a world, keeps a hamster rig per hamster, lays out every piece of
// food (on the table, dropping in, flying out of a pop, piled on heaps), the shadows of what's coming (the giant hand,
// the golden seed's light, the cat's paw), the night's lights, and the juice. Sim coordinates are px; the world is U.

import * as THREE from 'three';
import { createStage, createRig, U } from './stage.js';
import { createHamster, warmHamsters } from './hamster.js';
import { createFoodBatch, foodRadius } from './food.js';
import { buildArena, heapSpot, drawEmblem } from './arena.js';
import { createFx3d } from './fx.js';
import { environment, setAnisotropy } from './assets.js';
import { blobTexture, glowTexture } from './materials.js';
import { FOODS, GOLDEN, CHILI, GUM, PEPPER, SEATS, CAP, MAX, PAW, PORCH_R, SCHEDULE, TIERS } from '../sim/config.js';
import { popChance } from '../sim/rules.js';
import { pawAt } from '../sim/schedule.js';
import { unit } from '../sim/rng.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const HAM_SCALE = 0.235;
// A heap's mix: mostly seeds and nuts, some of everything.
const PILE = [0, 1, 0, 2, 3, 0, 1, 4, 2, 0, 5, 1, 3, 0, 2, 1, 4, 0, 3, 1];

// ------------------------------------------------------------------ decals

/** Instanced soft shadows on the table (per-instance darkness in instanceColor.r). */
function blobBatch(cap) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: blobTexture() }, uColor: { value: new THREE.Color('#2a1608') } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vA;
      void main() { vUv = uv; vA = instanceColor.r; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; varying vec2 vUv; varying float vA;
      void main() { float a = texture2D(uMap, vUv).a * vA; gl_FragColor = vec4(uColor, a); }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  let n = 0;
  return {
    mesh,
    begin() {
      n = 0;
    },
    add(x, y, z, sx, sz, rot, a) {
      if (n >= cap || a <= 0.003) return;
      Q.setFromAxisAngle(Y, rot);
      P.set(x, y, z);
      S.set(sx, 1, sz);
      M.compose(P, Q, S);
      mesh.setMatrixAt(n, M);
      mesh.instanceColor.setXYZ(n, a, 0, 0);
      n++;
    },
    end() {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
  };
}

/** A ring gauge drawn on the table: track, an arc that fills, ticks, dashes and spikes. */
function ringMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uFill: { value: 0 },
      uColor: { value: new THREE.Color('#ffcb2e') },
      uTrack: { value: new THREE.Vector4(0.23, 0.13, 0.09, 0.45) },
      uEdge: { value: new THREE.Vector4(1, 0.95, 0.85, 0.9) },
      uR0: { value: 0.78 },
      uR1: { value: 0.94 },
      uDash: { value: 0 },
      uRot: { value: 0 },
      uOver: { value: 0 },
      uTime: { value: 0 },
      uTicks: { value: new THREE.Vector2(-1, -1) },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uFill; uniform vec3 uColor; uniform vec4 uTrack; uniform vec4 uEdge; uniform float uR0; uniform float uR1;
      uniform float uDash; uniform float uRot; uniform float uOver; uniform float uTime; uniform vec2 uTicks; uniform float uAlpha;
      varying vec2 vUv;
      const float PI = 3.14159265;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        // Angle clockwise from the top of the screen (the table's -z).
        float ang = atan(p.x, p.y);
        float u = fract(ang / (2.0 * PI) + 1.0);
        float aa = fwidth(r) * 1.2;
        float band = smoothstep(uR0 - aa, uR0 + aa, r) * (1.0 - smoothstep(uR1 - aa, uR1 + aa, r));
        float outline = smoothstep(uR0 - 0.05 - aa, uR0 - 0.05 + aa, r) * (1.0 - smoothstep(uR1 + 0.05 - aa, uR1 + 0.05 + aa, r));
        vec4 col = vec4(0.0);
        // A dark outline round the band.
        col = mix(col, vec4(uTrack.rgb, uTrack.a), outline);
        if (uDash > 0.0) {
          float d = step(0.5, fract((u + uRot) * uDash));
          col = mix(col, vec4(uColor, 1.0), band * d);
        } else {
          col = mix(col, uEdge, band * 0.85);
          float f = step(u, uFill);
          col = mix(col, vec4(uColor, 1.0), band * f);
          // Ticks where the tiers start.
          for (int i = 0; i < 2; i++) {
            float t = i == 0 ? uTicks.x : uTicks.y;
            if (t < 0.0) continue;
            float dt = abs(u - t);
            dt = min(dt, 1.0 - dt);
            float tick = (1.0 - smoothstep(0.004, 0.009, dt)) * smoothstep(uR0 - 0.08, uR0 - 0.04, r) * (1.0 - smoothstep(uR1 + 0.04, uR1 + 0.08, r));
            col = mix(col, vec4(uTrack.rgb, 1.0), tick);
          }
        }
        if (uOver > 0.0) {
          // Spikes round the outside, flickering.
          float n = 28.0;
          float k = fract(u * n + uTime * 0.6);
          float spike = 1.0 - abs(k - 0.5) * 2.0;
          float outer = uR1 + 0.05 + spike * (0.08 + uOver * 0.1) * (0.85 + 0.15 * sin(uTime * 30.0 + u * 40.0));
          float s = smoothstep(uR1 + 0.03, uR1 + 0.05, r) * (1.0 - smoothstep(outer - aa, outer + aa, r));
          col = mix(col, vec4(1.0, 0.3, 0.43, 1.0), s);
        }
        gl_FragColor = vec4(col.rgb, col.a * uAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    extensions: { derivatives: true },
    toneMapped: false,
  });
}

function decalPlane(size, mat) {
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 3;
  m.frustumCulled = false;
  return m;
}

/** A giant hand's shadow (the thrower above the table), drawn once. */
let handTex = null;
function handTexture() {
  if (handTex) return handTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const x = c.getContext('2d');
  x.filter = 'blur(9px)';
  x.fillStyle = '#000';
  x.translate(100, 128);
  x.beginPath();
  x.ellipse(0, 0, 58, 50, 0, 0, Math.PI * 2);
  x.fill();
  for (let k = 0; k < 4; k++) {
    const off = (k - 1.5) * 22;
    const len = k === 0 || k === 3 ? 50 : 64;
    x.beginPath();
    x.ellipse(50 + len * 0.5, off, len * 0.55, 11, 0, 0, Math.PI * 2);
    x.fill();
  }
  x.beginPath();
  x.ellipse(18, 62, 36, 13, 0.9, 0, Math.PI * 2);
  x.fill();
  handTex = new THREE.CanvasTexture(c);
  return handTex;
}

/** The cat's band: a darkening stripe with claw marks that run toward the swat. */
let clawTex = null;
function clawTexture() {
  if (clawTex) return clawTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(40,10,24,0)');
  g.addColorStop(0.2, 'rgba(40,10,24,0.55)');
  g.addColorStop(0.8, 'rgba(40,10,24,0.55)');
  g.addColorStop(1, 'rgba(40,10,24,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  x.strokeStyle = 'rgba(255,77,109,1)';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.lineWidth = 12;
  for (const ox of [40, 168]) {
    x.beginPath();
    x.moveTo(ox, 34);
    x.lineTo(ox + 42, 64);
    x.lineTo(ox, 94);
    x.stroke();
  }
  clawTex = new THREE.CanvasTexture(c);
  clawTex.wrapS = THREE.RepeatWrapping;
  clawTex.colorSpace = THREE.SRGBColorSpace;
  return clawTex;
}

/** The cat's foreleg and paw: ginger tabby fur, toe beans under. Points along +x; the leg rises behind (−x, +y). */
function makePaw() {
  const g = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: '#f0a050', roughness: 0.9, vertexColors: true });
  const legGeo = new THREE.CapsuleGeometry(0.42, 5, 8, 20);
  legGeo.rotateZ(Math.PI / 2);
  // Tabby stripes round the leg.
  const p = legGeo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const xx = p.getX(i);
    const yy = p.getY(i);
    const stripe = Math.sin(xx * 3.4 + Math.sin(yy * 4) * 0.4) > 0.55;
    c.set(stripe ? '#c86a28' : '#f5a85c');
    if (yy < -0.2) c.lerp(new THREE.Color('#ffe2c0'), 0.5);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  legGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const leg = new THREE.Mesh(legGeo, fur);
  leg.position.set(-2.6, 0.1, 0);
  leg.castShadow = true;
  const legPivot = new THREE.Group();
  legPivot.add(leg);
  legPivot.rotation.z = -0.55;
  g.add(legPivot);
  const pawGeo = new THREE.SphereGeometry(0.62, 28, 18);
  pawGeo.scale(1.05, 0.55, 1);
  const pc = new Float32Array(pawGeo.attributes.position.count * 3);
  for (let i = 0; i < pawGeo.attributes.position.count; i++) {
    c.set(pawGeo.attributes.position.getY(i) < -0.1 ? '#ffe2c0' : '#f5a85c');
    pc[i * 3] = c.r;
    pc[i * 3 + 1] = c.g;
    pc[i * 3 + 2] = c.b;
  }
  pawGeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const paw = new THREE.Mesh(pawGeo, fur);
  paw.castShadow = true;
  g.add(paw);
  const bean = new THREE.MeshStandardMaterial({ color: '#ff8fa8', roughness: 0.45 });
  const toeFur = fur;
  for (let k = 0; k < 4; k++) {
    const a = -0.8 + k * 0.53;
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), toeFur);
    t.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(t.geometry.attributes.position.count * 3).fill(0.95), 3));
    t.scale.set(1, 0.7, 1);
    t.position.set(Math.cos(a) * 0.62, -0.02, Math.sin(a) * 0.62);
    t.castShadow = true;
    g.add(t);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), bean);
    b.scale.set(1, 0.4, 1);
    b.position.set(Math.cos(a) * 0.64, -0.17, Math.sin(a) * 0.64);
    g.add(b);
  }
  const pad = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), bean);
  pad.scale.set(1, 0.35, 1.1);
  pad.position.set(-0.05, -0.28, 0);
  g.add(pad);
  // Claws (out during the swat).
  const clawMat = new THREE.MeshStandardMaterial({ color: '#fff8ee', roughness: 0.3 });
  const claws = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const a = -0.8 + k * 0.53;
    const cl = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 8), clawMat);
    cl.rotation.z = -Math.PI / 2 - 0.4;
    cl.position.set(Math.cos(a) * 0.86, -0.08, Math.sin(a) * 0.86);
    claws.add(cl);
  }
  g.add(claws);
  g.userData.claws = claws;
  g.scale.setScalar(1.15);
  return g;
}

/** The golden seed's beacon: a shaft of light where it will land. */
function makeBeacon() {
  const g = new THREE.Group();
  const shaftTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, 'rgba(255,240,170,0)');
    gr.addColorStop(0.6, 'rgba(255,230,140,0.35)');
    gr.addColorStop(1, 'rgba(255,220,120,0.9)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.6, 6, 32, 1, true),
    new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }),
  );
  shaft.position.y = 3;
  g.add(shaft);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffd860', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.012;
  g.add(pool);
  g.userData.shaft = shaft;
  g.userData.pool = pool;
  return g;
}

/** A heap's flag: a cocktail stick with a pennant showing the number, redrawn when it changes. */
function makeHeapFlag(seat) {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1, 6), new THREE.MeshStandardMaterial({ color: '#e7c38c', roughness: 0.6 }));
  stick.position.y = 0.5;
  stick.castShadow = true;
  g.add(stick);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 112;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const geo = new THREE.PlaneGeometry(0.62, 0.27, 8, 1);
  geo.translate(0.31, 0, 0);
  const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.7 }));
  flag.position.y = 0.86;
  flag.castShadow = true;
  g.add(flag);
  let shown = null;
  const s = SEATS[seat % SEATS.length];
  const draw = (n, mine) => {
    const key = `${n}|${mine}`;
    if (key === shown) return;
    shown = key;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 256, 112);
    x.fillStyle = '#3b2218';
    x.beginPath();
    x.roundRect(0, 0, 256, 112, 18);
    x.fill();
    x.fillStyle = mine ? '#fff2d9' : s.color;
    x.beginPath();
    x.roundRect(7, 7, 242, 98, 13);
    x.fill();
    drawEmblem(x, s.emblem, 46, 56, 24, mine ? s.color : '#fff2d9');
    x.font = '800 64px "Bricolage Grotesque", system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineJoin = 'round';
    const txt = String(n);
    const tw = x.measureText(txt).width;
    const sc = Math.min(1, 170 / tw);
    x.save();
    x.translate(160, 60);
    x.scale(sc, 1);
    if (!mine) {
      x.lineWidth = 12;
      x.strokeStyle = '#3b2218';
      x.strokeText(txt, 0, 0);
    }
    x.fillStyle = mine ? '#3b2218' : '#ffffff';
    x.fillText(txt, 0, 0);
    x.restore();
    tex.needsUpdate = true;
  };
  g.userData = { flag, draw, base: geo.attributes.position.array.slice() };
  return g;
}

// ------------------------------------------------------------------ the world

export function createWorld3d(canvas) {
  const stage = createStage(canvas);
  setAnisotropy(Math.min(8, stage.renderer.capabilities.getMaxAnisotropy()));
  const rig = createRig(stage);
  const scene = stage.scene;
  const fx = createFx3d(scene);
  warmHamsters();
  const food = createFoodBatch(900);
  scene.add(food.group);
  const blobs = blobBatch(500);
  scene.add(blobs.mesh);
  const fog = new THREE.Fog('#9cc278', 20, 60);
  scene.fog = fog;

  let arena = null; // { key, a, built }
  let envName = '';
  const envs = new Map();
  const hams = new Map();
  const heaps = new Map(); // id -> { flag, shown, pop, seat }
  const flights = []; // purely visual: pieces carried from a burrow to its heap
  let time = 0;
  let quality = 'high';

  // My gauge, porches, the paw, the band, the beacons and the hand shadows.
  const gaugeMat = ringMaterial();
  const gauge = decalPlane(1, gaugeMat);
  gauge.visible = false;
  scene.add(gauge);
  const porches = [];
  const pawObj = makePaw();
  pawObj.visible = false;
  scene.add(pawObj);
  const bandMat = new THREE.MeshBasicMaterial({ map: clawTexture(), transparent: true, depthWrite: false, toneMapped: false });
  const band = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bandMat);
  band.rotation.x = -Math.PI / 2;
  band.renderOrder = 3;
  band.visible = false;
  scene.add(band);
  const beacons = [];
  const hands = [];
  const handMat = () => new THREE.MeshBasicMaterial({ map: handTexture(), color: '#2a1608', transparent: true, depthWrite: false, opacity: 0 });
  const nightGlows = [];

  function ensureEnv(name) {
    if (name === envName) return;
    envName = name;
    const apply = (e) => {
      if (!e || envName !== name) return;
      scene.environment = e.env;
    };
    if (envs.has(name)) apply(envs.get(name));
    else
      environment(stage.renderer, name).then((e) => {
        envs.set(name, e);
        apply(e);
      });
  }

  function ensureArena(w) {
    const key = `${w.arena.id}|${w.hams.map((h) => `${h.burrow.x},${h.burrow.y}`).join(';')}`;
    if (arena && arena.key === key) return;
    if (arena) {
      scene.remove(arena.built.group);
      arena.built.dispose();
    }
    for (const p of porches) scene.remove(p);
    porches.length = 0;
    for (const [, hp] of heaps) scene.remove(hp.flag);
    heaps.clear();
    const built = buildArena(w.arena, { quality, burrows: w.hams.map((h) => h.burrow) });
    scene.add(built.group);
    arena = { key, a: w.arena, built };
    const L = built.look;
    stage.setSunDir(...L.sun);
    stage.sun.color.set(L.sunColor);
    stage.sun.intensity = L.sunI;
    stage.hemi.intensity = L.hemiI;
    scene.environmentIntensity = L.envI;
    stage.renderer.toneMappingExposure = L.exposure;
    scene.background = new THREE.Color(L.bg);
    fog.color.set(L.bg);
    stage.grade.uDark.value = L.dark ? 1 : 0;
    ensureEnv(L.sky);
    // Porch rings (dashed, seat colour) round each burrow mouth.
    w.hams.forEach((h) => {
      const m = ringMaterial();
      m.uniforms.uDash.value = 18;
      m.uniforms.uColor.value.set(SEATS[h.seat % SEATS.length].color);
      m.uniforms.uR0.value = 0.9;
      m.uniforms.uR1.value = 0.97;
      m.uniforms.uTrack.value.set(0.23, 0.13, 0.09, 0.35);
      const d = decalPlane((PORCH_R * U) * 2, m);
      d.position.set(h.burrow.x * U, 0.008, h.burrow.y * U);
      d.userData.seat = h.seat;
      scene.add(d);
      porches.push(d);
    });
  }

  function hamFor(h) {
    let r = hams.get(h.id);
    if (!r) {
      const ham = createHamster({ coat: h.coat, seat: h.seat, hat: h.hat || null, scale: HAM_SCALE });
      scene.add(ham.root);
      r = { ham, x: h.x, y: h.y, speed: 0, seen: 0, mood: null, sweat: 0, info: { wx: 0, wz: 0, hy: 0.5, gone: false } };
      hams.set(h.id, r);
    }
    if (r.ham.coat !== h.coat) r.ham.setCoat(h.coat);
    if (r.ham.seat !== h.seat) r.ham.setSeat(h.seat);
    if ((h.hat || null) !== r.ham.hat) r.ham.setHat(h.hat || null);
    return r;
  }

  function heapFor(h) {
    let hp = heaps.get(h.id);
    if (!hp) {
      const flag = makeHeapFlag(h.seat);
      const p = heapSpot(h.burrow);
      flag.position.set(p.x, 0, p.z);
      scene.add(flag);
      hp = { flag, shown: h.heap, target: h.heap, pop: 0, seat: h.seat, x: p.x, z: p.z };
      heaps.set(h.id, hp);
    }
    return hp;
  }

  const groundY = (x, y) => {
    const d = arena && arena.a.disc;
    return d && (x - d.x) ** 2 + (y - d.y) ** 2 < d.r * d.r ? 0.04 : 0;
  };

  // ------------------------------------------------------------------ projection

  const v3 = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();

  const api = {
    stage,
    rig,
    fx,
    get vw() {
      return stage.vw;
    },
    get vh() {
      return stage.vh;
    },
    get dpr() {
      return stage.pr;
    },
    resize(w, h, ratio) {
      stage.resize(w, h, ratio);
    },
    setQuality(q) {
      if (!q || q === quality) return;
      quality = q;
      stage.setQuality(q);
      if (arena) arena.key = ''; // rebuild (grass density)
    },
    setReduced(v) {
      fx.setReduced(v);
      rig.reduced = !!v;
    },
    resetAnims() {
      for (const [, r] of hams) {
        scene.remove(r.ham.root);
        r.ham.dispose();
      }
      hams.clear();
      flights.length = 0;
      fx.clear();
    },
    /** Sim px (x, y) at `h` world units up → CSS px on screen; `behind` when it's behind the camera. */
    toScreen(x, y, h = 0) {
      v3.set(x * U, h, y * U).project(stage.camera);
      return { x: (v3.x * 0.5 + 0.5) * stage.vw, y: (-v3.y * 0.5 + 0.5) * stage.vh, behind: v3.z > 1 };
    },
    worldToScreen(x, y, z) {
      v3.set(x, y, z).project(stage.camera);
      return { x: (v3.x * 0.5 + 0.5) * stage.vw, y: (-v3.y * 0.5 + 0.5) * stage.vh };
    },
    /** CSS px → sim px on the table. */
    toWorld(sx, sy) {
      ndc.set((sx / stage.vw) * 2 - 1, -(sy / stage.vh) * 2 + 1);
      ray.setFromCamera(ndc, stage.camera);
      const hit = ray.ray.intersectPlane(plane, v3);
      if (!hit) return { x: 0, y: 0 };
      return { x: hit.x / U, y: hit.z / U };
    },
    heapSpot(h) {
      const p = heapSpot(h.burrow);
      return { x: p.x / U, y: p.z / U };
    },
    hamTop(id) {
      const r = hams.get(id);
      return r ? r.info : null;
    },
    // ---------------------------------------------------------------- events
    gulp(id, size) {
      const r = hams.get(id);
      if (r) r.ham.bite(size);
    },
    squash(id, k) {
      const r = hams.get(id);
      if (r) r.ham.squash(k);
    },
    happy(id) {
      const r = hams.get(id);
      if (r) r.ham.bank();
    },
    pop(id) {
      const r = hams.get(id);
      if (r) r.ham.pop();
    },
    hit(id) {
      const r = hams.get(id);
      if (r) r.ham.flashHit();
    },
    mood(id, m) {
      const r = hams.get(id);
      if (r) {
        r.mood = m;
        if (m === 'win') r.ham.win();
        else if (m === 'lose') r.ham.lose();
      }
    },
    /** A cheekful flying from the burrow to its heap (visual only). */
    bankFlight(h, counts, worth) {
      const hp = heapFor(h);
      const list = [];
      if (counts) counts.forEach((n, type) => {
        for (let i = 0; i < Math.min(n, 6); i++) list.push(type);
      });
      if (!list.length) for (let i = 0; i < Math.min(8, Math.ceil(worth / 8)); i++) list.push(0);
      list.length = Math.min(list.length, 16);
      const bx = h.burrow.x * U;
      const bz = h.burrow.y * U;
      list.forEach((type, i) => {
        flights.push({ type, x0: bx + (Math.random() - 0.5) * 0.2, z0: bz + (Math.random() - 0.5) * 0.2, x1: hp.x + (Math.random() - 0.5) * 0.3, z1: hp.z + (Math.random() - 0.5) * 0.3, t: -i * 0.035, life: 0.42 + Math.random() * 0.12, spin: Math.random() * 6, id: h.id });
      });
      hp.pending = (hp.pending || 0) + list.length;
    },
    heapPop(id) {
      const hp = heaps.get(id);
      if (hp) hp.pop = 1;
    },
    // ---------------------------------------------------------------- the camera
    /** view: { mode: 'follow'|'drift'|'overview'|'fixed', x, y (sim px), vx, vy, zoom }. */
    camera(w, view, dt) {
      const o = { mode: view.mode, arena: { w: w.arena.w * U, h: w.arena.h * U }, zoom: view.zoom || 1 };
      if (view.mode === 'follow') {
        o.x = view.x * U;
        o.z = view.y * U;
        o.vx = (view.vx || 0) * U;
        o.vz = (view.vy || 0) * U;
      } else if (view.mode === 'fixed') {
        o.x = view.x * U;
        o.z = view.y * U;
        o.dist = view.dist;
      }
      if (view.snap) rig.ready = false;
      rig.update(o, dt);
    },
    set camReady(v) {
      rig.ready = !!v;
    },
    // ---------------------------------------------------------------- a frame
    /** scene: { w, me, leader, dt, noRing, practice } */
    draw(sc) {
      const w = sc.w;
      const dt = sc.dt || 0;
      time += dt;
      ensureArena(w);
      const A = w.arena;
      const t = w.t;
      const me = sc.me ? w.byId.get(sc.me) : null;
      arena.built.tick(dt, time, w);

      // Fog follows the camera's distance so the far edge melts into the light.
      fog.near = rig.dist * 1.25;
      fog.far = rig.dist * 3.2;

      // Hamsters.
      const seen = new Set();
      for (const h of w.hams) {
        const r = hamFor(h);
        seen.add(h.id);
        const ddx = h.x - r.x;
        const ddy = h.y - r.y;
        const sp = dt > 0 ? Math.hypot(ddx, ddy) / dt : 0;
        r.x = h.x;
        r.y = h.y;
        // Teleports (respawn, a fresh world) don't count as speed.
        r.speed += ((sp > 1200 ? 0 : sp) - r.speed) * (1 - Math.exp(-dt * 12));
        const over = clamp((h.fill - CAP) / (MAX - CAP), 0, 1);
        const dizzy = h.dizzyT > 0 || h.remoteDizzy ? Math.max(0.3, h.dizzyT || 0.5) : 0;
        r.ham.update(
          {
            x: h.x * U,
            z: h.y * U,
            a: h.a,
            speed: r.speed,
            fill: h.fill,
            over,
            dash: h.dashT > 0 || !!h.remoteDash,
            dizzy,
            stun: h.stunT || 0,
            strain: over,
            gum: h.gumT > 0 || !!h.remoteGum,
            fire: h.hotT > 0 || !!h.remoteHot,
            mood: r.mood,
            hidden: !!h.gone,
            away: !!h.away,
          },
          dt,
        );
        const gy = groundY(h.x, h.y);
        r.ham.root.position.y = gy;
        r.info.wx = h.x * U;
        r.info.wz = h.y * U;
        r.info.hy = gy + 0.55 + Math.min(1, h.fill / CAP) * 0.04;
        r.info.gone = !!h.gone;
        if (!h.gone) blobs.add(h.x * U + 0.03, gy + 0.004, h.y * U + 0.04, 0.62 + h.fill * 0.0012, 0.5 + h.fill * 0.001, -h.a, 0.5);
        // Strain: sweat flicks off an overstuffed hamster.
        if (over > 0 && !h.gone && dizzy <= 0) {
          r.sweat -= dt * (1 + over * 4);
          if (r.sweat <= 0) {
            r.sweat = 0.35;
            fx.sweat(h.x * U, gy + 0.42, h.y * U);
          }
        }
        if ((h.hotT > 0 || h.remoteHot) && Math.random() < dt * 14) fx.steam(h.x * U, gy + 0.45, h.y * U, 1, '#ffb070', 0.1);
      }
      for (const [id, r] of hams) {
        if (!seen.has(id)) {
          scene.remove(r.ham.root);
          r.ham.dispose();
          hams.delete(id);
        }
      }

      // My gauge on the table.
      if (me && !me.gone && !sc.noRing) {
        gauge.visible = true;
        const gy = groundY(me.x, me.y);
        const R = 0.52 + Math.min(1, me.fill / MAX) * 0.08;
        gauge.scale.set(R * 2, 1, R * 2);
        gauge.position.set(me.x * U, gy + 0.01, me.y * U);
        const f = clamp(me.fill / MAX, 0, 1);
        const u = gaugeMat.uniforms;
        u.uFill.value += (f - u.uFill.value) * (1 - Math.exp(-dt * 14));
        u.uTicks.value.set(TIERS[1].at / MAX, TIERS[0].at / MAX);
        const col = me.fill >= TIERS[0].at ? '#ff4d6d' : me.fill >= TIERS[1].at ? '#ff8a2a' : me.fill >= 70 ? '#ffcb2e' : SEATS[me.seat % SEATS.length].color;
        u.uColor.value.set(col);
        u.uOver.value = clamp((me.fill - CAP) / (MAX - CAP), 0, 1);
        u.uTime.value = time;
      } else gauge.visible = false;
      for (const p of porches) {
        const mine = me && me.seat === p.userData.seat;
        const u = p.material.uniforms;
        u.uRot.value = time * 0.04;
        u.uAlpha.value = mine ? 1 : 0.55;
      }

      // Food: the table, the air, the heaps.
      food.begin();
      const meFill = me && !me.gone ? me.fill : 0;
      const disc = A.disc;
      for (const f of w.food.values()) {
        const R = foodRadius(f.type);
        const yaw = (f.id * 2.399) % (Math.PI * 2);
        if (t >= f.land) {
          let rot = yaw;
          if (disc && f.tb !== undefined && (f.bx - disc.x) ** 2 + (f.by - disc.y) ** 2 < disc.r * disc.r) rot -= disc.w * (t - f.tb);
          const since = t - f.land;
          const sq = since < 0.3 ? Math.sin((since / 0.3) * Math.PI) * 0.22 : 0;
          const gy = groundY(f.x, f.y);
          let tint = 0;
          if (me && meFill > 0 && f.type !== PEPPER) {
            const after = meFill + FOODS[f.type].size;
            if (after > CAP) tint = clamp(popChance(after, FOODS[f.type].size) * 1.6, 0.15, 1);
          }
          const bob = f.type === GOLDEN ? 0.03 + Math.sin(time * 3 + f.id) * 0.02 : 0;
          food.add(f.type, f.x * U, gy + R * (1 - sq * 0.5) + bob, f.y * U, rot, 0, R, tint, f.type === GOLDEN ? time * 1.5 : 0);
          if (f.type === GOLDEN && Math.random() < dt * 5) fx.sparkle(f.x * U, gy + 0.18, f.y * U, 1, '#fff2a8', 0.15, 0.1);
          if (f.type === CHILI && Math.random() < dt * 2) fx.steam(f.x * U, gy + 0.12, f.y * U, 1, '#ffd0a0', 0.07);
          continue;
        }
        if (f.src === 'spill' && f.fx !== null && f.fx !== undefined) {
          const ft = f.ft ?? f.land - 0.45;
          const u = clamp((t - ft) / Math.max(0.05, f.land - ft), 0, 1);
          const x = f.fx + (f.x - f.fx) * u;
          const y = f.fy + (f.y - f.fy) * u;
          const z = Math.sin(u * Math.PI) * 0.75;
          food.add(f.type, x * U, groundY(x, y) + R + z, y * U, yaw + u * 9, u * 7, R, 0, u * 5);
          blobs.add(x * U, 0.004, y * U, R * 3, R * 3, 0, 0.35 * (1 - z));
        } else {
          const lead = f.src === 'golden' ? SCHEDULE.beacon : SCHEDULE.tossShadow;
          const u = clamp(1 - (f.land - t) / lead, 0, 1);
          // The shadow grows where it will land; the piece drops in for the last part.
          blobs.add(f.x * U, 0.004, f.y * U, R * (1.2 + u * 2.2), R * (1.2 + u * 2.2), 0, 0.12 + u * 0.4);
          if (f.type === GOLDEN && u < 0.7) continue;
          if (u > 0.4) {
            const k = (1 - u) / 0.6;
            const z = k * k * 6;
            food.add(f.type, f.x * U, R + z, f.y * U, yaw + k * 6, k * 3, R * (1 + k * 0.3), 0, k * 4);
          }
        }
      }
      // Heaps: a mound per hamster, a flag with its number.
      for (const h of w.hams) {
        const hp = heapFor(h);
        if (h.heap < hp.shown || sc.snapHeaps) hp.shown = h.heap;
        if (hp.shown < h.heap && !(hp.pending > 0)) hp.shown = Math.min(h.heap, hp.shown + Math.max(40, (h.heap - hp.shown) * 4) * dt);
        const shown = Math.round(hp.shown);
        hp.flag.userData.draw(shown, !!me && me.id === h.id);
        hp.pop = Math.max(0, hp.pop - dt * 3);
        const count = Math.min(46, Math.ceil(shown / 12));
        const Rm = 0.08 + Math.min(0.42, Math.sqrt(shown) * 0.016);
        for (let i = 0; i < count; i++) {
          const d = Math.sqrt(1 - i / Math.max(1, count)) * Rm;
          const ang = i * 2.39996 + h.seat;
          const type = PILE[(i + h.seat * 3) % PILE.length];
          const fr = foodRadius(type);
          const lift = (1 - d / (Rm + 0.001)) * Rm * 0.75;
          const bounce = i >= count - 3 ? hp.pop * 0.08 : 0;
          food.add(type, hp.x + Math.cos(ang) * d, fr * 0.8 + lift + bounce, hp.z + Math.sin(ang) * d * 0.9, ang * 3, (i % 3) * 0.6, fr, 0, i);
        }
        if (count) blobs.add(hp.x + 0.03, 0.004, hp.z + 0.04, Rm * 2.8 + 0.2, Rm * 2.5 + 0.2, 0, 0.45);
        const pole = 0.9 + Rm * 0.9;
        hp.flag.scale.setScalar(1);
        hp.flag.children[0].scale.y = pole;
        hp.flag.children[0].position.y = pole / 2;
        const fl = hp.flag.userData.flag;
        fl.position.y = pole - 0.13;
        fl.scale.setScalar(1 + hp.pop * 0.25);
        const pos = fl.geometry.attributes.position;
        const base = hp.flag.userData.base;
        for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(time * 5 + base[i * 3] * 9 + h.seat) * base[i * 3] * 0.14);
        pos.needsUpdate = true;
      }
      // Banked pieces flying to the heap.
      for (let i = flights.length - 1; i >= 0; i--) {
        const fl = flights[i];
        fl.t += dt;
        if (fl.t >= fl.life) {
          flights.splice(i, 1);
          const hp = heaps.get(fl.id);
          if (hp) {
            hp.pending = Math.max(0, (hp.pending || 0) - 1);
            hp.pop = 1;
          }
          continue;
        }
        if (fl.t < 0) continue;
        const u = fl.t / fl.life;
        const R = foodRadius(fl.type);
        food.add(fl.type, fl.x0 + (fl.x1 - fl.x0) * u, R + Math.sin(u * Math.PI) * 0.9, fl.z0 + (fl.z1 - fl.z0) * u, fl.spin + u * 8, u * 6, R, 0, u * 4);
      }
      food.end();

      // Tosses: the giant hand's shadow slides in, the piece is thrown, the hand withdraws.
      let hi = 0;
      for (const ts of w.sched.tosses) {
        if (t < ts.at - 0.4 || t > ts.land + 0.5) continue;
        const ang = unit('hand', w.seed, ts.i) * Math.PI * 2;
        let u;
        if (t < ts.land) u = clamp((t - (ts.at - 0.4)) / (ts.land - ts.at + 0.4), 0, 1);
        else u = 1 - clamp((t - ts.land) / 0.5, 0, 1);
        const e = 1 - (1 - u) * (1 - u);
        const dist = 1.6 + (1 - e) * 7;
        if (!hands[hi]) {
          const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), handMat());
          m.rotation.x = -Math.PI / 2;
          m.renderOrder = 2;
          scene.add(m);
          hands[hi] = m;
        }
        const m = hands[hi++];
        m.visible = true;
        m.position.set(ts.x * U - Math.cos(ang) * dist, 0.006, ts.y * U - Math.sin(ang) * dist);
        m.rotation.z = -ang;
        m.scale.set(3.4, 3.4, 1);
        m.material.opacity = 0.32 * Math.min(1, u * 2);
      }
      for (let i = hi; i < hands.length; i++) hands[i].visible = false;

      // Golden seeds: a shaft of light where one will land.
      let bi = 0;
      for (const g of w.sched.goldens) {
        if (t < g.at || t > g.land + 0.8) continue;
        if (w.gone && w.gone[g.i] && t > g.land) continue;
        if (!beacons[bi]) {
          const b = makeBeacon();
          scene.add(b);
          beacons[bi] = b;
        }
        const b = beacons[bi++];
        const u = clamp((t - g.at) / (g.land - g.at), 0, 1);
        const fade = t > g.land ? 1 - (t - g.land) / 0.8 : Math.min(1, u * 4);
        b.visible = true;
        b.position.set(g.x * U, groundY(g.x, g.y), g.y * U);
        const sh = b.userData.shaft;
        sh.scale.set(0.6 + u * 0.5, 1, 0.6 + u * 0.5);
        sh.material.opacity = fade * (0.55 + Math.sin(time * 9) * 0.1);
        sh.rotation.y = time * 0.6;
        const pool = b.userData.pool;
        pool.scale.setScalar(0.7 + u * 0.6 + Math.sin(time * 6) * 0.05);
        pool.material.opacity = fade * 0.9;
      }
      for (let i = bi; i < beacons.length; i++) beacons[i].visible = false;

      // The cat: its band darkens, then the paw sweeps across.
      let pawOn = false;
      let bandOn = false;
      for (const s of w.sched.sweeps) {
        if (t < s.at || t > s.end + 0.5) continue;
        const ang = Math.atan2(s.dy, s.dx);
        const warn = t < s.swat;
        const u = warn ? (t - s.at) / (s.swat - s.at) : 1 - clamp((t - s.end) / 0.3, 0, 1);
        bandOn = true;
        const len = (s.to - s.from + 600) * U;
        band.visible = true;
        band.position.set(s.px * U, 0.007, s.py * U);
        band.rotation.z = -ang;
        band.scale.set(len, PAW.band * U * 1.1, 1);
        bandMat.map.repeat.set(len / 1.6, 1);
        bandMat.map.offset.x = -time * 1.8;
        bandMat.opacity = warn ? 0.25 + u * 0.6 : 0.7 * u;
        const along = pawAt(s, t);
        const perpX = -s.dy;
        const perpY = s.dx;
        let ax;
        let height;
        if (along !== null) {
          ax = along;
          height = 0.25;
        } else if (warn) {
          ax = s.from - 80;
          height = 0.6 + (1 - u) * 3.5;
        } else {
          ax = s.to + 40;
          height = 0.25 + (1 - u) * 3;
        }
        const px = s.px + s.dx * ax;
        const py = s.py + s.dy * ax;
        // The paw comes from the far side of the band: it rises toward the cat out there.
        pawOn = true;
        pawObj.visible = true;
        pawObj.position.set(px * U - perpX * 0.0, height + groundY(px, py), py * U - perpY * 0.0);
        const side = perpY > 0 ? -1 : 1; // the leg goes toward −z (away from the camera) when it can
        pawObj.rotation.set(0, -Math.atan2(perpY * side, perpX * side) + Math.PI, 0);
        pawObj.userData.claws.visible = along !== null;
        const shadowA = along !== null ? 0.6 : warn ? 0.12 + u * 0.45 : 0.4 * u;
        blobs.add(px * U, 0.005, py * U, 2.6 + height * 0.5, 2.2 + height * 0.5, -ang, shadowA);
      }
      if (!pawOn) pawObj.visible = false;
      if (!bandOn) band.visible = false;

      // Night: pools of light (the lantern, the fireflies, each hamster's glow, golden seeds).
      if (A.dark) {
        const g = stage.grade;
        const L = g.uLights.value;
        let n = 0;
        const put = (x, y, r) => {
          if (n >= L.length) return;
          L[n++].set(x * U, y * U, r * U);
        };
        put(A.dark.lantern.x, A.dark.lantern.y, A.dark.lantern.r * (1 + Math.sin(time * 3) * 0.02));
        for (const fl of w.flies || []) put(fl.x, fl.y, fl.r);
        for (const h of w.hams) if (!h.gone) put(h.x, h.y, me && h.id === me.id ? A.dark.own : 75);
        for (const f of w.food.values()) if (f.type === GOLDEN && t >= f.land) put(f.x, f.y, 55);
        g.uLightN.value = n;
        const flies = arena.built.flies;
        (w.flies || []).forEach((fl, i) => {
          const s = flies[i];
          if (!s) return;
          s.position.set(fl.x * U, 0.5 + Math.sin(time * 2 + i) * 0.12, fl.y * U);
          const k = 0.3 + Math.sin(time * 7 + i * 2) * 0.06;
          s.scale.set(k, k, 1);
        });
      }

      blobs.end();
      blobs.begin();
      const fov = (stage.camera.fov * Math.PI) / 180;
      fx.update(dt, (stage.vh * stage.renderer.getPixelRatio()) / (2 * Math.tan(fov / 2)));
      stage.render();
    },
  };
  blobs.begin();
  return api;
}
