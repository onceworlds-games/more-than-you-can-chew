// Loading what the world is made of: CC0 textures (Poly Haven) and models (glTF, meshopt), the sky for reflections.
// Everything is cached and every load is allowed to fail (the world still draws, plainer).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = 'assets/';
const texLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const texCache = new Map();
const modelCache = new Map();
let maxAniso = 4;
export function setAnisotropy(n) {
  maxAniso = n;
}

function loadTex(url, srgb, r = [1, 1]) {
  const key = `${url}|${srgb}|${r[0]}|${r[1]}`;
  if (texCache.has(key)) return texCache.get(key);
  const t = texLoader.load(BASE + url, undefined, undefined, () => {});
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = maxAniso;
  t.repeat.set(r[0], r[1]);
  texCache.set(key, t);
  return t;
}

/** A Poly Haven material set (diffuse, normal, AO/rough/metal) sharing one repeat. */
export function texSet(name, { repeat = 1, diff = true, nor = true, arm = true } = {}) {
  const r = typeof repeat === 'number' ? [repeat, repeat] : repeat;
  return {
    map: diff ? loadTex(`tex/${name}_diff.webp`, true, r) : null,
    normalMap: nor ? loadTex(`tex/${name}_nor.webp`, false, r) : null,
    armMap: arm ? loadTex(`tex/${name}_arm.webp`, false, r) : null,
  };
}

/** A textured standard material from a set (AO from red, roughness from green, metalness from blue). */
export function texMaterial(name, o = {}) {
  const s = texSet(name, o);
  const m = new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.armMap,
    aoMap: null,
    metalnessMap: null,
    roughness: o.roughness ?? 1,
    metalness: 0,
    color: o.color ?? '#ffffff',
  });
  if (o.normalScale) m.normalScale.set(o.normalScale, o.normalScale);
  return m;
}

/** A model, loaded once; every call gets its own clone. Resolves null if it can't load. */
export function model(name) {
  if (!modelCache.has(name)) {
    modelCache.set(
      name,
      new Promise((res) => {
        gltfLoader.load(
          `${BASE}models/${name}.glb`,
          (g) => {
            g.scene.traverse((o) => {
              if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
                if (o.material && o.material.map) o.material.map.anisotropy = maxAniso;
              }
            });
            res(g.scene);
          },
          undefined,
          () => res(null),
        );
      }),
    );
  }
  return modelCache.get(name).then((s) => (s ? s.clone(true) : null));
}

/** Fits a model: scales it so its footprint's longest side is `size` (world units), sits it on y = 0, centres it. */
export function fit(obj, size, { axis = 'xz', lift = 0 } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = new THREE.Vector3();
  box.getSize(s);
  const k = axis === 'y' ? size / s.y : size / Math.max(s.x, s.z);
  obj.scale.multiplyScalar(k);
  box.setFromObject(obj);
  const c = new THREE.Vector3();
  box.getCenter(c);
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= box.min.y - lift;
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

/** The sky's reflections: an equirect photo through PMREM. */
export function environment(renderer, name = 'sunflowers') {
  return new Promise((res) => {
    texLoader.load(
      `${BASE}env/${name}.jpg`,
      (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        t.colorSpace = THREE.SRGBColorSpace;
        const pm = new THREE.PMREMGenerator(renderer);
        const env = pm.fromEquirectangular(t).texture;
        pm.dispose();
        res({ env, sky: t });
      },
      undefined,
      () => res(null),
    );
  });
}
