// Materials made from the CC0 sets: a fabric recoloured by its own light and dark (one gingham weave becomes every
// tablecloth), and small helpers for the procedural props.

import * as THREE from 'three';
import { texSet } from './assets.js';

/**
 * A cloth from a texture set, recoloured: its dark, mid and light tones become c0, c1, c2. `lo`/`hi`: the source's
 * darkest and lightest luminance.
 */
export function recolored(name, { repeat = 1, c0, c1, c2, lo = 0.2, hi = 0.92, roughness = 1, normalScale = 1, sheen = 0 } = {}) {
  const s = texSet(name, { repeat });
  const m = new THREE.MeshPhysicalMaterial({
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.armMap,
    roughness,
    metalness: 0,
    sheen,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(c2 || '#ffffff'),
  });
  m.normalScale.set(normalScale, normalScale);
  const u = {
    uC0: { value: new THREE.Color(c0 || '#7a1612') },
    uC1: { value: new THREE.Color(c1 || '#c84a3f') },
    uC2: { value: new THREE.Color(c2 || '#fff4e4') },
    uLo: { value: lo },
    uHi: { value: hi },
  };
  m.userData.u = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uLo; uniform float uHi;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
          // The texture is sRGB-decoded already: compare in a perceptual-ish space.
          float t = clamp((pow(l, 1.0 / 2.2) - uLo) / (uHi - uLo), 0.0, 1.0);
          vec3 c = t < 0.5 ? mix(uC0, uC1, t * 2.0) : mix(uC1, uC2, (t - 0.5) * 2.0);
          diffuseColor.rgb = c;
        }`,
      );
  };
  m.customProgramCacheKey = () => `recolor-${name}`;
  return m;
}

/** A soft round contact shadow (a texture shared by every blob). */
let blobTex = null;
export function blobTexture() {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.38)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

export function blobMaterial(opacity = 1) {
  return new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity, color: '#3a2410', toneMapped: false });
}

/** A radial glow sprite texture (soft light, for pools and sparkles). */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
