// Juice in the world: crumbs and confetti that tumble and bounce (lit, instanced), soft puffs of dust, steam and sneeze
// (billboards), sparkles that glow, shockwave rings on the table and dizzy stars. All in world units, pooled, capped.

import * as THREE from 'three';

const MAX_SOLID = 700;
const MAX_SOFT = 900;
const MAX_RINGS = 24;
const MAX_STARS = 36;
const G = 9.5;

const rand = (a, b) => a + Math.random() * (b - a);

function softMaterial(additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec4 aColor; attribute float aSoft;
      varying vec4 vColor; varying float vSoft;
      uniform float uScale;
      void main() {
        vColor = aColor; vSoft = aSoft;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      varying vec4 vColor; varying float vSoft;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float d = dot(p, p);
        if (d > 1.0) discard;
        float a = vSoft > 0.5 ? (1.0 - d) * (1.0 - d) : smoothstep(1.0, 0.7, d);
        gl_FragColor = vec4(vColor.rgb, vColor.a * a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function softPool(additive, cap) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(cap * 3);
  const size = new Float32Array(cap);
  const col = new Float32Array(cap * 4);
  const soft = new Float32Array(cap);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSoft', new THREE.BufferAttribute(soft, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mat = softMaterial(additive);
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = additive ? 6 : 5;
  return { pts, geo, mat, pos, size, col, soft, list: [], cap };
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.45 : 1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2 });
  g.center();
  return g;
}

export function createFx3d(scene) {
  const group = new THREE.Group();
  scene.add(group);
  let reduced = false;
  let time = 0;

  // Solid bits: crumbs (chunky), confetti (flat), shavings.
  const solidGeo = new THREE.BoxGeometry(1, 1, 1);
  const solidMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0 });
  const solid = new THREE.InstancedMesh(solidGeo, solidMat, MAX_SOLID);
  solid.count = 0;
  solid.castShadow = true;
  solid.frustumCulled = false;
  solid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  solid.setColorAt(0, new THREE.Color());
  group.add(solid);
  const solids = [];

  const soft = softPool(false, MAX_SOFT);
  const glow = softPool(true, MAX_SOFT / 2);
  group.add(soft.pts, glow.pts);

  // Rings on the table.
  const ringGeo = new THREE.RingGeometry(0.86, 1, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, toneMapped: false }));
    m.visible = false;
    m.renderOrder = 4;
    group.add(m);
    rings.push({ m, t: 0, life: 0, r: 1, on: false });
  }

  // Dizzy stars.
  const stars = new THREE.InstancedMesh(starGeometry(), new THREE.MeshStandardMaterial({ color: '#ffd23a', emissive: '#ff9a00', emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.2 }), MAX_STARS);
  stars.count = 0;
  stars.frustumCulled = false;
  stars.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(stars);
  const starList = [];

  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const E = new THREE.Euler();
  const P = new THREE.Vector3();
  const S = new THREE.Vector3();
  const C = new THREE.Color();

  const addSolid = (p) => {
    if (solids.length >= MAX_SOLID) solids.shift();
    solids.push(p);
  };
  const addSoft = (pool, p) => {
    if (pool.list.length >= pool.cap) pool.list.shift();
    pool.list.push(p);
  };
  const n = (k) => (reduced ? Math.ceil(k / 2) : k);

  const fx = {
    group,
    setReduced(v) {
      reduced = !!v;
    },
    get reduced() {
      return reduced;
    },
    /** Crumbs from (x, y, z): chunky bits that arc, bounce and settle. */
    crumbs(x, y, z, count, colors, speed = 1.2, up = 1, size = 0.03) {
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * rand(0.35, 1);
        addSolid({ k: 'crumb', x, y, z, vx: Math.cos(a) * s, vy: rand(1.2, 2.8) * up, vz: Math.sin(a) * s, s: size * rand(0.6, 1.4), c: new THREE.Color(colors[i % colors.length]), t: 0, life: rand(0.7, 1.3), rx: Math.random() * 6, ry: Math.random() * 6, vr: rand(-12, 12), flat: 0.7 });
      }
    },
    /** Confetti from (x, y, z): flat ribbons that flutter down. */
    confetti(x, y, z, count, spread = 1.5, colors = ['#ff4d6d', '#3fa7f2', '#ffcb2e', '#2dc38a', '#9a5bea', '#fff2d9']) {
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(0.3, 1) * spread;
        addSolid({ k: 'conf', x, y, z, vx: Math.cos(a) * s, vy: rand(2.5, 5.5), vz: Math.sin(a) * s, s: rand(0.035, 0.06), c: new THREE.Color(colors[i % colors.length]), t: 0, life: rand(2, 3.2), rx: Math.random() * 6, ry: Math.random() * 6, vr: rand(-9, 9), flat: 0.08, ph: Math.random() * 6 });
      }
    },
    /** A puff of dust at the table. */
    dust(x, z, count = 6, size = 0.18, color = '#fff4e0', y = 0.05) {
      C.set(color);
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(0.3, 0.9);
        addSoft(soft, { x: x + Math.cos(a) * 0.05, y: y + Math.random() * 0.05, z: z + Math.sin(a) * 0.05, vx: Math.cos(a) * s, vy: rand(0.1, 0.4), vz: Math.sin(a) * s, s: size * rand(0.7, 1.3), grow: 1.6, r: C.r, g: C.g, b: C.b, a: 0.6, t: 0, life: rand(0.45, 0.8), drag: 3.5, soft: 1 });
      }
    },
    /** Steam / smoke rising (chili, a hot bank). */
    steam(x, y, z, count = 4, color = '#ffffff', size = 0.16) {
      C.set(color);
      for (let i = 0; i < n(count); i++) {
        addSoft(soft, { x: x + rand(-0.06, 0.06), y, z: z + rand(-0.06, 0.06), vx: rand(-0.1, 0.1), vy: rand(0.5, 0.9), vz: rand(-0.1, 0.1), s: size * rand(0.7, 1.2), grow: 2, r: C.r, g: C.g, b: C.b, a: 0.45, t: 0, life: rand(0.7, 1.1), drag: 1, soft: 1 });
      }
    },
    /** A spray (a sneeze): a cone of droplets and puffs along (dx, dz). */
    spray(x, y, z, dx, dz, count = 14, color = '#fff8ee') {
      C.set(color);
      for (let i = 0; i < n(count); i++) {
        const a = Math.atan2(dz, dx) + rand(-0.45, 0.45);
        const s = rand(1.5, 3.5);
        addSoft(soft, { x, y, z, vx: Math.cos(a) * s, vy: rand(0.2, 0.9), vz: Math.sin(a) * s, s: rand(0.05, 0.14), grow: 2.5, r: C.r, g: C.g, b: C.b, a: 0.7, t: 0, life: rand(0.35, 0.6), drag: 4, soft: 1 });
      }
    },
    /** Sparkles: little glows that twinkle out. */
    sparkle(x, y, z, count = 8, color = '#fff2a8', spread = 0.5, size = 0.12) {
      C.set(color);
      for (let i = 0; i < n(count); i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(0.2, 1) * spread * 2;
        addSoft(glow, { x, y, z, vx: Math.cos(a) * s, vy: rand(0.4, 1.6), vz: Math.sin(a) * s, s: size * rand(0.6, 1.3), grow: -0.6, r: C.r, g: C.g, b: C.b, a: 1, t: 0, life: rand(0.4, 0.9), drag: 2.5, soft: 1, tw: Math.random() * 6 });
      }
    },
    /** One glow that stays put for a moment (a flash at a point). */
    flare(x, y, z, size = 1, color = '#fff2c0', life = 0.3) {
      C.set(color);
      addSoft(glow, { x, y, z, vx: 0, vy: 0, vz: 0, s: size, grow: 0.8, r: C.r, g: C.g, b: C.b, a: 1, t: 0, life, drag: 0, soft: 1 });
    },
    /** Sweat drops flicking off a strained hamster. */
    sweat(x, y, z) {
      if (reduced) return;
      const a = Math.random() * Math.PI * 2;
      addSoft(soft, { x, y, z, vx: Math.cos(a) * 0.6, vy: rand(0.8, 1.4), vz: Math.sin(a) * 0.6, s: 0.05, grow: 0, r: 0.75, g: 0.9, b: 1, a: 0.95, t: 0, life: 0.45, drag: 0, soft: 0, grav: 1 });
    },
    /** A shockwave ring on the table. */
    ring(x, z, r, color = '#ffffff', life = 0.45, y = 0.02) {
      const slot = rings.find((q) => !q.on) || rings[0];
      slot.on = true;
      slot.t = 0;
      slot.life = life;
      slot.r = r;
      slot.m.position.set(x, y, z);
      slot.m.material.color.set(color);
      slot.m.visible = true;
    },
    /** Dizzy stars circling `follow` (anything with x, z and an optional head height `hy`) for `life` seconds. */
    stars(follow, life, count = 3) {
      for (let i = 0; i < count; i++) {
        if (starList.length >= MAX_STARS) starList.shift();
        starList.push({ f: follow, t: 0, life, ph: (i / count) * Math.PI * 2 });
      }
    },
    clear() {
      solids.length = 0;
      soft.list.length = 0;
      glow.list.length = 0;
      starList.length = 0;
      for (const r of rings) {
        r.on = false;
        r.m.visible = false;
      }
    },
    /** Steps and uploads everything. `pxScale`: the renderer's pixel height over 2·tan(fov/2), for point sizes. */
    update(dt, pxScale) {
      time += dt;
      // Solids.
      let k = 0;
      for (let i = solids.length - 1; i >= 0; i--) {
        const p = solids[i];
        p.t += dt;
        if (p.t >= p.life) {
          solids.splice(i, 1);
          continue;
        }
        if (p.k === 'conf') {
          p.vy = Math.max(p.vy - G * 0.55 * dt, -0.9);
          p.vx *= Math.exp(-dt * 1.4);
          p.vz *= Math.exp(-dt * 1.4);
          p.x += (p.vx + Math.sin(p.t * 5 + p.ph) * 0.4) * dt;
          p.z += (p.vz + Math.cos(p.t * 4 + p.ph) * 0.4) * dt;
          p.y += p.vy * dt;
          if (p.y < 0.004) {
            p.y = 0.004;
            p.vy = 0;
            p.vx = p.vz = 0;
            p.vr = 0;
            p.rx = Math.PI / 2;
          }
        } else {
          p.vy -= G * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < p.s * 0.5) {
            p.y = p.s * 0.5;
            if (p.vy < -0.6) {
              p.vy = -p.vy * 0.35;
              p.vx *= 0.6;
              p.vz *= 0.6;
              p.vr *= 0.5;
            } else {
              p.vy = 0;
              p.vx *= Math.exp(-dt * 10);
              p.vz *= Math.exp(-dt * 10);
              p.vr *= Math.exp(-dt * 10);
            }
          }
        }
        p.rx += p.vr * dt;
        p.ry += p.vr * 0.7 * dt;
        const u = p.t / p.life;
        const sc = p.s * (u > 0.8 ? (1 - u) / 0.2 : 1);
        E.set(p.rx, p.ry, 0);
        Q.setFromEuler(E);
        P.set(p.x, p.y, p.z);
        S.set(sc, sc * p.flat, sc * (p.k === 'conf' ? 0.55 : 0.85));
        M.compose(P, Q, S);
        solid.setMatrixAt(k, M);
        solid.setColorAt(k, p.c);
        k++;
      }
      solid.count = k;
      solid.instanceMatrix.needsUpdate = true;
      if (solid.instanceColor) solid.instanceColor.needsUpdate = true;

      // Soft pools.
      for (const pool of [soft, glow]) {
        pool.mat.uniforms.uScale.value = pxScale;
        let j = 0;
        for (let i = pool.list.length - 1; i >= 0; i--) {
          const p = pool.list[i];
          p.t += dt;
          if (p.t >= p.life) {
            pool.list.splice(i, 1);
            continue;
          }
          const dr = Math.exp(-dt * p.drag);
          p.vx *= dr;
          p.vz *= dr;
          p.vy *= p.grav ? 1 : dr;
          if (p.grav) p.vy -= G * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          const u = p.t / p.life;
          pool.pos[j * 3] = p.x;
          pool.pos[j * 3 + 1] = p.y;
          pool.pos[j * 3 + 2] = p.z;
          let s = p.s * (1 + p.grow * u);
          if (p.tw !== undefined) s *= 0.75 + 0.25 * Math.sin(time * 30 + p.tw);
          pool.size[j] = Math.max(0, s);
          pool.col[j * 4] = p.r;
          pool.col[j * 4 + 1] = p.g;
          pool.col[j * 4 + 2] = p.b;
          pool.col[j * 4 + 3] = p.a * (u < 0.1 ? u / 0.1 : 1 - (u - 0.1) / 0.9);
          pool.soft[j] = p.soft;
          j++;
        }
        pool.geo.setDrawRange(0, j);
        for (const name of ['position', 'aSize', 'aColor', 'aSoft']) pool.geo.attributes[name].needsUpdate = true;
      }

      // Rings.
      for (const r of rings) {
        if (!r.on) continue;
        r.t += dt;
        const u = r.t / r.life;
        if (u >= 1) {
          r.on = false;
          r.m.visible = false;
          continue;
        }
        const e = 1 - (1 - u) ** 3;
        const s = r.r * (0.25 + e * 0.85);
        r.m.scale.set(s, 1, s);
        r.m.material.opacity = (1 - u) * 0.9;
      }

      // Stars.
      let si = 0;
      for (let i = starList.length - 1; i >= 0; i--) {
        const s = starList[i];
        s.t += dt;
        if (s.t >= s.life || !s.f || s.f.gone) {
          starList.splice(i, 1);
          continue;
        }
        const a = s.t * 5.5 + s.ph;
        const fx0 = s.f.wx ?? 0;
        const fz0 = s.f.wz ?? 0;
        const hy = s.f.hy ?? 0.5;
        const u = s.t / s.life;
        const sc = 0.055 * (u < 0.15 ? u / 0.15 : u > 0.85 ? (1 - u) / 0.15 : 1);
        P.set(fx0 + Math.cos(a) * 0.24, hy + Math.sin(a * 2) * 0.03, fz0 + Math.sin(a) * 0.24);
        E.set(-0.6, a * 2, 0);
        Q.setFromEuler(E);
        S.set(sc, sc, sc);
        M.compose(P, Q, S);
        stars.setMatrixAt(si++, M);
      }
      stars.count = si;
      stars.instanceMatrix.needsUpdate = true;
    },
  };
  return fx;
}
