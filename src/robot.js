import * as THREE from 'three';

// Robo cartoon de teste, feito so de formas simples (sem arquivo 3D).
// Serve para validar o software antes de gerar personagens por IA.

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * (3 - 2 * x);
// sobe nos primeiros 15%, desce nos ultimos 15%
const envelope = (p) => smooth(clamp01(p / 0.15)) * smooth(clamp01((1 - p) / 0.15));

export class Robot {
  constructor() {
    const blue = new THREE.MeshStandardMaterial({ color: 0x2f7fe0, roughness: 0.35 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f4f8, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14202e, roughness: 0.5 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.4 });

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.35, 8, 20), blue);
    torso.position.y = 1.0;
    this.body.add(torso);
    const badge = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), yellow);
    badge.position.set(0, 1.05, 0.26);
    this.body.add(badge);

    // cabeca
    this.head = new THREE.Group();
    this.head.position.y = 1.5;
    this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), blue);
    skull.scale.set(1, 1.05, 0.95);
    this.head.add(skull);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.16, 0.1, 0.33);
      eye.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), white));
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), dark);
      pupil.position.z = 0.085;
      eye.add(pupil);
      this.head.add(eye);
      this.eyes.push(eye);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8), dark);
    ant.position.y = 0.52;
    this.head.add(ant);
    const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), yellow);
    antBall.position.y = 0.64;
    this.head.add(antBall);

    // bracos (pivo no ombro)
    this.armR = this._limb(0.38, 1.22, 0.07, 0.34, blue, white, true);
    this.armL = this._limb(-0.38, 1.22, 0.07, 0.34, blue, white, true);
    // pernas (pivo no quadril)
    this.legR = this._limb(0.15, 0.7, 0.09, 0.28, blue, white, false);
    this.legL = this._limb(-0.15, 0.7, 0.09, 0.28, blue, white, false);

    this.rest = new Map();
    for (const n of [this.body, this.head, this.armR, this.armL, this.legR, this.legL]) {
      this.rest.set(n, { p: n.position.clone(), r: n.rotation.clone() });
    }
    this.restRoot = this.root.position.clone();

    this.t = 0;
    this.blinkAt = 2;
    this.current = null; // { action, t }

    this.actions = [
      { name: 'Acenar', dur: 2.6, fn: (t, p, e) => this._wave(t, p, e) },
      { name: 'Dançar', dur: 4.0, fn: (t, p, e) => this._dance(t, p, e) },
      { name: 'Pular', dur: 1.1, fn: (t, p, e) => this._jump(t, p, e) },
      { name: 'Apontar', dur: 2.4, fn: (t, p, e) => this._point(t, p, e) },
      { name: 'Aplaudir', dur: 2.6, fn: (t, p, e) => this._clap(t, p, e) },
      { name: 'Sim (cabeça)', dur: 1.5, fn: (t, p, e) => this._nod(t, p, e) },
      { name: 'Não (cabeça)', dur: 1.5, fn: (t, p, e) => this._shake(t, p, e) },
    ];
  }

  _limb(x, y, r, len, mat, endMat, isArm) {
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
    seg.position.y = -(len / 2 + r);
    g.add(seg);
    const end = new THREE.Mesh(new THREE.SphereGeometry(isArm ? 0.1 : 0.12, 16, 12), endMat);
    end.position.set(0, -(len + r * 2 + 0.03), isArm ? 0 : 0.05);
    if (!isArm) end.scale.set(1, 0.7, 1.4);
    g.add(end);
    this.body.add(g);
    return g;
  }

  play(i) {
    const action = this.actions[i];
    if (action) this.current = { action, t: 0 };
  }

  stop() {
    this.current = null;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    // volta tudo para a pose de descanso
    for (const [n, r] of this.rest) {
      n.position.copy(r.p);
      n.rotation.copy(r.r);
    }
    this.root.position.copy(this.restRoot);

    // idle: respirar + balancar
    this.body.scale.y = 1 + Math.sin(t * 2) * 0.012;
    this.head.rotation.y += Math.sin(t * 0.9) * 0.06;
    this.armR.rotation.z += 0.12 + Math.sin(t * 2) * 0.02;
    this.armL.rotation.z -= 0.12 + Math.sin(t * 2 + 1) * 0.02;

    // piscar
    let blink = 1;
    if (t > this.blinkAt) {
      const k = (t - this.blinkAt) / 0.14;
      if (k < 1) blink = Math.abs(1 - k * 2) * 0.9 + 0.1;
      else this.blinkAt = t + 2 + Math.random() * 3;
    }
    for (const e of this.eyes) e.scale.y = blink;

    if (this.current) {
      const c = this.current;
      c.t += dt;
      const p = c.t / c.action.dur;
      if (p >= 1) this.current = null;
      else c.action.fn(c.t, p, envelope(p));
    }
  }

  // convencao: braco +x levanta com rotacao z positiva, braco -x com negativa
  _wave(t, p, e) {
    this.armR.rotation.z += e * 2.4 + Math.sin(t * 14) * 0.25 * e;
    this.head.rotation.z += Math.sin(t * 4) * 0.08 * e;
  }

  _dance(t, p, e) {
    const s = Math.sin(t * 6);
    this.body.position.y += Math.abs(s) * 0.07 * e;
    this.body.rotation.y += Math.sin(t * 3) * 0.35 * e;
    this.armR.rotation.z += (1.2 + s * 0.8) * e;
    this.armL.rotation.z -= (1.2 - s * 0.8) * e;
    this.legR.rotation.x += s * 0.4 * e;
    this.legL.rotation.x -= s * 0.4 * e;
    this.head.rotation.z += Math.sin(t * 6) * 0.12 * e;
  }

  _jump(t, p, e) {
    const s = Math.sin(Math.PI * p);
    this.root.position.y += 0.55 * s;
    this.armR.rotation.z += 1.6 * s;
    this.armL.rotation.z -= 1.6 * s;
    this.legR.rotation.x -= 0.35 * (1 - s);
    this.legL.rotation.x -= 0.35 * (1 - s);
  }

  _point(t, p, e) {
    this.armR.rotation.x += -1.5 * e;
    this.armR.rotation.z += 0.1 * e;
    this.head.rotation.y += 0.35 * e;
  }

  _clap(t, p, e) {
    const s = Math.sin(t * 15);
    this.armR.rotation.x += -1.15 * e;
    this.armL.rotation.x += -1.15 * e;
    this.armR.rotation.z += (-0.25 + s * 0.22) * e;
    this.armL.rotation.z += (0.25 - s * 0.22) * e;
  }

  _nod(t, p, e) {
    this.head.rotation.x += Math.sin(t * 10) * 0.28 * e;
  }

  _shake(t, p, e) {
    this.head.rotation.y += Math.sin(t * 10) * 0.45 * e;
  }
}
