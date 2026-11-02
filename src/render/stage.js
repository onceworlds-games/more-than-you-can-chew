// The 3D stage: renderer, a golden-hour sun with soft shadows, the sky's reflections, a macro lens (tilt-shift blur and a
// warm grade) and the camera that follows a hamster. World units: 1 = 100 px of the simulation (U).

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const U = 0.01;

const TiltShift = {
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uFocus: { value: 0.5 },
    uBand: { value: 0.16 },
    uAmount: { value: 4 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes; uniform float uFocus; uniform float uBand; uniform float uAmount;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      // More blur toward the top (the far side) than the bottom, like a lens over a table.
      float far = vUv.y > uFocus ? 1.25 : 0.8;
      float k = smoothstep(uBand, uBand + 0.32, d) * uAmount * far;
      if (k < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec2 st = uDir / uRes * k;
      vec4 c = texture2D(tDiffuse, vUv) * 0.2270270270;
      c += texture2D(tDiffuse, vUv + st * 1.3846153846) * 0.3162162162;
      c += texture2D(tDiffuse, vUv - st * 1.3846153846) * 0.3162162162;
      c += texture2D(tDiffuse, vUv + st * 3.2307692308) * 0.0702702703;
      c += texture2D(tDiffuse, vUv - st * 3.2307692308) * 0.0702702703;
      gl_FragColor = c;
    }`,
};

// After tone mapping: a warm grade, a soft vignette and (at night) the dark with its pools of light.
const Grade = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.32 },
    uWarm: { value: 0.06 },
    uLift: { value: new THREE.Color(0.02, 0.012, 0.0) },
    uDark: { value: 0 },
    uDarkTint: { value: new THREE.Color(0.08, 0.1, 0.22) },
    uLights: { value: Array.from({ length: 20 }, () => new THREE.Vector3(0, 0, -1)) },
    uLightN: { value: 0 },
    uInvVP: { value: new THREE.Matrix4() },
    uCam: { value: new THREE.Vector3() },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVignette; uniform float uWarm; uniform vec3 uLift;
    uniform float uDark; uniform vec3 uDarkTint; uniform vec3 uLights[20]; uniform int uLightN; uniform mat4 uInvVP; uniform vec3 uCam;
    uniform float uFlash; uniform vec3 uFlashColor;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      // Warm highlights, a touch of lift in the shadows.
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col += uWarm * vec3(0.9, 0.35, -0.5) * smoothstep(0.35, 1.0, l) * 0.6;
      col += uLift * (1.0 - l);
      if (uDark > 0.0) {
        // Where this pixel meets the table (y = 0), and how lit that spot is.
        vec4 a = uInvVP * vec4(vUv * 2.0 - 1.0, -1.0, 1.0); a /= a.w;
        vec4 b = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0); b /= b.w;
        vec3 dir = b.xyz - a.xyz;
        float t = -a.y / (abs(dir.y) > 1e-5 ? dir.y : -1e-5);
        vec3 p = a.xyz + dir * clamp(t, 0.0, 1.0);
        float lit = 0.0;
        for (int i = 0; i < 20; i++) {
          if (i >= uLightN) break;
          vec3 L = uLights[i];
          float d = length(p.xz - L.xy);
          lit = max(lit, smoothstep(L.z, L.z * 0.45, d));
        }
        vec3 night = col * uDarkTint * 3.6 + uDarkTint * 0.05;
        col = mix(col, night, uDark * (1.0 - lit));
      }
      float v = smoothstep(0.95, 0.25, length((vUv - 0.5) * vec2(1.15, 1.0)));
      col *= mix(1.0 - uVignette, 1.0, v);
      col = mix(col, uFlashColor, uFlash);
      gl_FragColor = vec4(col, c.a);
    }`,
};

const QUALITY = {
  low: { shadows: 0, post: false, bloom: false, tilt: false },
  medium: { shadows: 1024, post: true, bloom: false, tilt: true },
  high: { shadows: 2048, post: true, bloom: true, tilt: true },
};

export function createStage(canvas, { preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: preserve, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a9c98a');
  const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.5, 120);

  // Light: a low warm sun with a soft blue sky fill.
  const hemi = new THREE.HemisphereLight('#cfe4ff', '#6b5a3a', 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffdcae', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  const sc = sun.shadow.camera;
  sc.near = 1;
  sc.far = 60;
  scene.add(sun);
  scene.add(sun.target);
  const sunDir = new THREE.Vector3(-0.55, 0.62, -0.56).normalize();

  let quality = 'high';
  let q = QUALITY.high;
  let vw = 1;
  let vh = 1;
  let pr = 1;

  // Post: render, tilt-shift (two passes), bloom, tone map, grade.
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const tiltH = new ShaderPass(TiltShift);
  const tiltV = new ShaderPass(TiltShift);
  tiltV.uniforms.uDir.value.set(0, 1);
  composer.addPass(tiltH);
  composer.addPass(tiltV);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const grade = new ShaderPass(Grade);
  composer.addPass(grade);

  function applyQuality() {
    q = QUALITY[quality] || QUALITY.high;
    renderer.shadowMap.enabled = q.shadows > 0;
    sun.castShadow = q.shadows > 0;
    if (q.shadows) {
      if (sun.shadow.mapSize.x !== q.shadows) {
        sun.shadow.mapSize.set(q.shadows, q.shadows);
        if (sun.shadow.map) {
          sun.shadow.map.dispose();
          sun.shadow.map = null;
        }
      }
    }
    tiltH.enabled = tiltV.enabled = q.tilt;
    bloom.enabled = q.bloom;
    scene.traverse((o) => {
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) m.needsUpdate = true;
      }
    });
  }

  const stage = {
    THREE,
    renderer,
    scene,
    camera,
    sun,
    hemi,
    grade: grade.uniforms,
    tilt: { focus: 0.47, band: 0.22, amount: 2.4 },
    get quality() {
      return quality;
    },
    get vw() {
      return vw;
    },
    get vh() {
      return vh;
    },
    get pr() {
      return pr;
    },
    setQuality(qn) {
      if (!QUALITY[qn] || qn === quality) return;
      quality = qn;
      applyQuality();
      stage.resize(vw, vh, pr);
    },
    resize(w, h, ratio) {
      vw = Math.max(1, w);
      vh = Math.max(1, h);
      pr = ratio;
      const cap = quality === 'low' ? Math.min(ratio, 1.25) : quality === 'medium' ? Math.min(ratio, 1.6) : ratio;
      renderer.setPixelRatio(cap);
      renderer.setSize(vw, vh, false);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      composer.setPixelRatio(cap);
      composer.setSize(vw, vh);
      bloom.resolution.set(vw * cap * 0.5, vh * cap * 0.5);
      const rw = vw * cap;
      const rh = vh * cap;
      tiltH.uniforms.uRes.value.set(rw, rh);
      tiltV.uniforms.uRes.value.set(rw, rh);
      camera.aspect = vw / vh;
      camera.updateProjectionMatrix();
    },
    /** Keeps the sun's shadow box on what the camera sees. */
    aimSun(cx, cz, span) {
      const d = 20;
      sun.position.set(cx + sunDir.x * d, sunDir.y * d, cz + sunDir.z * d);
      sun.target.position.set(cx, 0, cz);
      const s = Math.max(4, span);
      if (sc.right !== s) {
        sc.left = -s;
        sc.right = s;
        sc.top = s;
        sc.bottom = -s;
        sc.updateProjectionMatrix();
      }
    },
    setSunDir(x, y, z) {
      sunDir.set(x, y, z).normalize();
    },
    render() {
      const g = grade.uniforms;
      if (g.uDark.value > 0) {
        g.uInvVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
        g.uCam.value.copy(camera.position);
      }
      if (!q.post && g.uDark.value <= 0 && g.uFlash.value <= 0) {
        renderer.render(scene, camera);
        return;
      }
      for (const p of [tiltH, tiltV]) {
        p.uniforms.uFocus.value = stage.tilt.focus;
        p.uniforms.uBand.value = stage.tilt.band;
        p.uniforms.uAmount.value = stage.tilt.amount;
      }
      composer.render();
    },
  };
  applyQuality();
  return stage;
}

/**
 * The camera rig: looks down at about 55 degrees over a point on the table, follows with a lead, punches in on big moments
 * and shakes with direction. Everything in world units.
 */
export function createRig(stage) {
  const cam = stage.camera;
  const rig = {
    x: 9,
    z: 6,
    tx: 9,
    tz: 6,
    dist: 11,
    tdist: 11,
    pitch: 0.9, // radians above the table
    dip: 0, // added to pitch by a fixed view that asks for its own angle
    lift: 0, // height of the point the camera looks at
    yaw: 0,
    punch: 0,
    punchV: 0,
    shake: 0,
    shakeX: 0,
    shakeZ: 0,
    ready: false,
    reduced: false,
    t: 0,
  };
  const look = new THREE.Vector3();
  /**
   * o: { mode: 'follow' | 'drift' | 'overview' | 'fixed', x, z (target), vx, vz, dist, arena: { w, h } (world units),
   *      pitch, lift (fixed and follow: a lower angle and a raised aim, for showing off one hamster) }
   */
  rig.update = (o, dt) => {
    rig.t += dt;
    const portrait = stage.vh > stage.vw * 1.1;
    const aw = o.arena ? o.arena.w : 18;
    const ah = o.arena ? o.arena.h : 12;
    let tx = rig.tx;
    let tz = rig.tz;
    let dist = rig.tdist;
    let dipTo = 0;
    let liftTo = 0;
    // Distance that shows about `span` world units across.
    const fov = (cam.fov * Math.PI) / 180;
    const across = (span) => span / (2 * Math.tan(fov / 2) * Math.max(0.5, cam.aspect));
    if (o.mode === 'follow') {
      tx = o.x + (o.vx || 0) * 0.35;
      tz = o.z + (o.vz || 0) * 0.3;
      const span = portrait ? 5.1 : 7.8;
      dist = across(span) * (o.zoom || 1);
      dist = Math.min(dist, portrait ? 16 : 22);
    } else if (o.mode === 'drift') {
      const t = rig.t * 0.05;
      tx = aw / 2 + Math.sin(t * 1.3) * aw * 0.18;
      tz = ah / 2 + Math.cos(t) * ah * 0.12;
      dist = across(portrait ? 9 : 13);
    } else if (o.mode === 'overview') {
      tx = aw / 2;
      tz = ah / 2 + 0.6;
      dist = Math.max(across(aw * 1.02), across(ah * 1.4) * (cam.aspect < 1 ? 1 : 0.8));
    } else if (o.mode === 'fixed') {
      tx = o.x;
      tz = o.z;
      dist = o.dist;
    }
    if (o.mode === 'fixed' || o.mode === 'follow') {
      if (o.pitch) dipTo = o.pitch - rig.pitch;
      if (o.lift) liftTo = o.lift;
    }
    // Keep the view over the arena (with a margin of the world around it).
    const halfW = (dist * Math.tan(fov / 2) * cam.aspect) * 0.8;
    const halfH = dist * Math.tan(fov / 2) * 0.7;
    if (o.mode === 'follow') {
      tx = halfW * 2 >= aw + 2 ? aw / 2 : Math.min(aw + 1 - halfW, Math.max(-1 + halfW, tx));
      tz = halfH * 2 >= ah + 2.4 ? ah / 2 : Math.min(ah + 1.6 - halfH, Math.max(-1.0 + halfH, tz));
    }
    rig.tx = tx;
    rig.tz = tz;
    rig.tdist = dist;
    if (!rig.ready) {
      rig.x = tx;
      rig.z = tz;
      rig.dist = dist;
      rig.dip = dipTo;
      rig.lift = liftTo;
      rig.ready = true;
    }
    const k = 1 - Math.exp(-dt * (o.mode === 'follow' ? 5 : 1.6));
    rig.x += (tx - rig.x) * k;
    rig.z += (tz - rig.z) * k;
    rig.dist += (dist - rig.dist) * (1 - Math.exp(-dt * 2.2));
    rig.dip += (dipTo - rig.dip) * (1 - Math.exp(-dt * 2.2));
    rig.lift += (liftTo - rig.lift) * (1 - Math.exp(-dt * 2.2));
    // Punch: a spring that eases the camera in and back.
    rig.punchV += (-rig.punch * 90 - rig.punchV * 14) * dt;
    rig.punch += rig.punchV * dt;
    rig.shake = Math.max(0, rig.shake - dt * 2.6);
    const s = rig.reduced ? 0 : rig.shake * rig.shake;
    const n1 = Math.sin(rig.t * 61.3) * 0.6 + Math.sin(rig.t * 37.1) * 0.4;
    const n2 = Math.cos(rig.t * 53.7) * 0.6 + Math.sin(rig.t * 29.9) * 0.4;
    const sx = (n1 * 0.25 + rig.shakeX) * s * 0.22;
    const sz = (n2 * 0.25 + rig.shakeZ) * s * 0.22;
    rig.shakeX *= Math.exp(-dt * 10);
    rig.shakeZ *= Math.exp(-dt * 10);
    const d = rig.dist * (1 - (rig.reduced ? 0 : rig.punch));
    const pitch = rig.pitch + rig.dip + (portrait ? 0.08 : 0);
    look.set(rig.x + sx, rig.lift, rig.z + sz);
    cam.position.set(look.x + Math.sin(rig.yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d, look.z + Math.cos(rig.yaw) * Math.cos(pitch) * d);
    cam.lookAt(look);
    stage.aimSun(look.x, look.z - 0.5, Math.min(14, d * 0.62 + 2));
  };
  rig.kick = (amount, dx = 0, dz = 0) => {
    rig.shake = Math.min(1.2, rig.shake + amount);
    rig.shakeX += dx * amount;
    rig.shakeZ += dz * amount;
  };
  rig.punchIn = (amount) => {
    if (rig.reduced) return;
    rig.punchV += amount * 9;
  };
  return rig;
}
