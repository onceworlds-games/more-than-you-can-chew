// A look-development bench (dev only, ?lab=...): hamsters, food and props under the game's light, to judge them up close.

import * as THREE from 'three';
import { createStage, createRig } from './render/stage.js';
import { createHamster, warmHamsters } from './render/hamster.js';
import { recolored } from './render/materials.js';
import { environment, model, fit } from './render/assets.js';

export async function runLab(kind, params) {
  const canvas = document.getElementById('game');
  const stage = createStage(canvas);
  stage.setQuality(params.get('q') || 'high');
  const rig = createRig(stage);
  const resize = () => stage.resize(window.innerWidth, window.innerHeight, Math.min(2, window.devicePixelRatio || 1));
  resize();
  window.addEventListener('resize', resize);
  const env = await environment(stage.renderer);
  if (env) {
    stage.scene.environment = env.env;
    stage.scene.environmentIntensity = 0.55;
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), recolored('gingham_check', { repeat: 30 / 2.4, c0: '#8e1b17', c1: '#cf5446', c2: '#fff1df', sheen: 0.4 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  stage.scene.add(ground);
  warmHamsters();
  const hams = [];
  const states = [
    { coat: 0, seat: 0, fill: 0, hat: 'party' },
    { coat: 3, seat: 1, fill: 60, hat: null },
    { coat: 4, seat: 2, fill: 100, hat: 'beanie' },
    { coat: 6, seat: 3, fill: 130, hat: 'crown' },
    { coat: 7, seat: 4, fill: 30, hat: 'strawberry', dizzy: true },
    { coat: 9, seat: 5, fill: 80, hat: 'tophat', happy: true },
    { coat: 8, seat: 6, fill: 20, hat: 'propeller', run: true },
    { coat: 10, seat: 7, fill: 110, hat: 'cowboy', run: true },
  ];
  states.forEach((s, i) => {
    const h = createHamster({ coat: s.coat, seat: s.seat, hat: s.hat, scale: 0.18 });
    stage.scene.add(h.root);
    hams.push({ h, s, x: 1.2 + (i % 4) * 0.95, z: 1.2 + Math.floor(i / 4) * 0.95 });
  });
  model('wicker_basket_01').then((m) => {
    if (!m) return;
    const g = fit(m, 2.4);
    g.position.set(-1.2, 0, 0.6);
    stage.scene.add(g);
  });
  const close = params.get('cam') === 'close';
  let last = performance.now();
  let t = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    for (const { h, s, x, z } of hams) {
      if (s.happy && Math.floor(t * 0.7) !== Math.floor((t - dt) * 0.7)) h.bank();
      h.update({ x, z, a: s.run ? t * 1.5 : Math.PI * 0.5 + Math.sin(t * 0.4) * 0.3, speed: s.run ? 200 : 0, fill: s.fill, over: Math.max(0, (s.fill - 100) / 40), dizzy: s.dizzy ? 1 : 0, stun: 0, strain: s.fill > 100 ? 0.6 : 0, dash: false }, dt);
    }
    rig.update(close ? { mode: 'fixed', x: 2.6, z: 1.6, dist: 4.2 } : { mode: 'fixed', x: 2.2, z: 1.6, dist: 9 }, dt);
    stage.render();
  }
  requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
}
