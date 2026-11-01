// Little pictures for the screens: a hamster in a coat and hat (lobby seats, the podium, the wardrobe's coats) and a hat on
// its own. One small renderer of its own draws each once; the result is cached as an image URL. Never throws.

import * as THREE from 'three';
import { createHamster } from './hamster.js';
import { makeHat } from './hats.js';

const SIZE = 192;
let R = null;
let failed = false;
const cache = new Map();

function setup() {
  if (R || failed) return R;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.setSize(SIZE, SIZE, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff6e6', '#8a6a48', 1.5));
    const key = new THREE.DirectionalLight('#ffe2bc', 2.8);
    key.position.set(2.5, 4, 3.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#cfe4ff', 1.6);
    rim.position.set(-3, 2.5, -3);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 100);
    R = { canvas, renderer, scene, camera };
    canvas.addEventListener('webglcontextlost', () => {
      R = null;
      failed = true;
    });
  } catch {
    failed = true;
    R = null;
  }
  return R;
}

function frameObject(obj, { pad = 1.15, lookY = 0.5, yaw = 0.5, pitch = 0.32 } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const c = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(c);
  const r = Math.max(size.x, size.y, size.z) * 0.5 * pad;
  const d = r / Math.tan(THREE.MathUtils.degToRad(R.camera.fov / 2));
  const target = new THREE.Vector3(c.x, box.min.y + size.y * lookY, c.z);
  R.camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * d, target.y + Math.sin(pitch) * d, target.z + Math.cos(yaw) * Math.cos(pitch) * d);
  R.camera.lookAt(target);
}

function snap(obj) {
  R.scene.add(obj);
  R.renderer.render(R.scene, R.camera);
  R.scene.remove(obj);
  return R.canvas.toDataURL('image/png');
}

/** A hamster facing the viewer: { coat, seat, hat, mood: 'win' | 'lose' | null }. */
export function hamsterPortrait({ coat = 0, seat = 0, hat = '', mood = null } = {}) {
  const key = `h|${coat}|${seat}|${hat || ''}|${mood || ''}`;
  if (cache.has(key)) return cache.get(key);
  let url = '';
  if (setup()) {
    try {
      const h = createHamster({ coat, seat, hat: hat || null, scale: 1 });
      // Face the camera (+z), a little turned; settle the springs.
      const s = { x: 0, z: 0, a: Math.PI / 2 - 0.45, speed: 0, fill: mood === 'win' ? 30 : 12, over: 0, dash: false, dizzy: 0, stun: 0, strain: 0, gum: false, fire: false, away: false, eating: false, mood };
      for (let i = 0; i < 90; i++) h.update(s, 1 / 60);
      // A winner's hop and spin, held still.
      Object.assign(h.A, { blink: 0, blinkT: 9, spin: 0, hop: 0, hopV: 0, yaw: -s.a, turnV: 0 });
      h.update(s, 0.0001);
      frameObject(h.root, { pad: hat ? 1.02 : 1.0, lookY: 0.52, yaw: 0, pitch: 0.28 });
      url = snap(h.root);
      h.dispose();
    } catch (e) {
      console.warn('[chew] portrait', e);
      url = '';
    }
  }
  cache.set(key, url);
  return url;
}

/** A hat on its own, for the wardrobe. */
export function hatPortrait(id) {
  const key = `hat|${id}`;
  if (cache.has(key)) return cache.get(key);
  let url = '';
  if (id && setup()) {
    try {
      const g = makeHat(id);
      if (g) {
        const wrap = new THREE.Group();
        wrap.add(g);
        wrap.rotation.y = -Math.PI / 2 + 0.55; // its front (+x on the head) toward the viewer, a little turned
        frameObject(wrap, { pad: 1.15, lookY: 0.5, yaw: 0, pitch: 0.42 });
        url = snap(wrap);
      }
    } catch (e) {
      console.warn('[chew] hat portrait', e);
      url = '';
    }
  }
  cache.set(key, url);
  return url;
}
