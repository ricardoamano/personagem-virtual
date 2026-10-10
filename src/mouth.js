import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';

// 5 formas de boca (visemes). Ordem importa: as imagens do usuario seguem esta ordem.
export const VISEMES = [
  'Fechada',
  'Pequena',
  'Aberta (A)',
  'Redonda (O/U)',
  'Larga (E/I)',
];

function drawViseme(ctx, kind, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dark = '#4a1218';
  const tongue = '#e8667a';
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 0) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 4);
    ctx.quadraticCurveTo(cx, cy + 22, cx + 70, cy - 4);
    ctx.stroke();
    return;
  }

  const shapes = {
    1: { rx: 42, ry: 18, teeth: false },
    2: { rx: 58, ry: 52, teeth: true },
    3: { rx: 34, ry: 40, teeth: false },
    4: { rx: 84, ry: 26, teeth: true },
  };
  const s = shapes[kind];

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(cx, cy, s.rx, s.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, s.rx, s.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  if (s.teeth) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - s.rx, cy - s.ry, s.rx * 2, s.ry * 0.38);
  }
  if (s.ry > 20) {
    ctx.fillStyle = tongue;
    ctx.beginPath();
    ctx.ellipse(cx, cy + s.ry * 0.85, s.rx * 0.6, s.ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = '#2a0a0e';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(cx, cy, s.rx, s.ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function makeDefaultTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  drawViseme(c.getContext('2d'), kind, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const _m = new THREE.Matrix4();
const _zero = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// Volta qualquer personagem com esqueleto para a pose original (sem animacao).
export function bindPose(root) {
  root.traverse((o) => {
    if (o.isSkinnedMesh) o.skeleton.pose();
  });
  root.updateMatrixWorld(true);
}

// A boca e uma "decalque": a imagem da boca e projetada e colada NA SUPERFICIE do rosto
// (acompanha a curva), presa a um osso da cabeca.
export class MouthSprite {
  constructor() {
    this.defaultTextures = VISEMES.map((_, i) => makeDefaultTexture(i));
    this.textures = [...this.defaultTextures];
    this.material = new THREE.MeshBasicMaterial({
      map: this.textures[0],
      transparent: true,
      toneMapped: false,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.mesh.raycast = () => {}; // o clique "atravessa" a boca
    this.mesh.renderOrder = 10;
    this.mesh.frustumCulled = false;
    this.size = 0.3; // largura em unidades do mundo (~metros)
    this.aspect = 160 / 256;
    this.node = null; // osso onde a boca fica presa
    this.hit = null; // { mesh, point, normal } no mundo, na pose original
    this.current = 0;
    this.hideWhenClosed = false;
  }

  setViseme(i) {
    this.current = i;
    this.material.map = this.textures[i];
    this.mesh.visible = !(this.hideWhenClosed && i === 0) && !!this.hit;
  }

  setSize(w) {
    this.size = w;
    this.rebuild();
  }

  setNode(node) {
    this.node = node;
    this.rebuild();
  }

  clear() {
    this.mesh.removeFromParent();
    this.hit = null;
    this.node = null;
    this.mesh.visible = false;
  }

  // Coloca a boca num ponto da superficie de "targetMesh" (ponto e normal no mundo).
  place(node, targetMesh, point, normal) {
    this.node = node;
    this.hit = { mesh: targetMesh, point: point.clone(), normal: normal.clone().normalize() };
    this.rebuild();
  }

  rebuild() {
    if (!this.hit || !this.node) return;
    const { mesh, point, normal } = this.hit;

    let top = mesh;
    while (top.parent) top = top.parent;
    bindPose(top);

    _m.lookAt(normal, _zero, _up); // eixo z da projecao = normal do rosto
    const euler = new THREE.Euler().setFromRotationMatrix(_m);
    const w = this.size;
    const geo = new DecalGeometry(mesh, point, euler, new THREE.Vector3(w, w * this.aspect, w * 0.6));

    // geometria vai para o espaco do osso: assim a boca acompanha a cabeca
    this.node.updateWorldMatrix(true, false);
    geo.applyMatrix4(new THREE.Matrix4().copy(this.node.matrixWorld).invert());

    this.mesh.geometry.dispose();
    this.mesh.geometry = geo;
    if (this.mesh.parent !== this.node) this.node.add(this.mesh);
    this.mesh.position.set(0, 0, 0);
    this.mesh.quaternion.identity();
    this.mesh.scale.set(1, 1, 1);
    this.mesh.visible = true;
  }

  // Troca as 5 imagens por arquivos do usuario (ordem alfabetica = ordem dos visemes).
  async loadImages(files) {
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (sorted.length < VISEMES.length) {
      throw new Error(`Preciso de ${VISEMES.length} imagens, recebi ${sorted.length}.`);
    }
    const loader = new THREE.TextureLoader();
    const tex = [];
    for (const f of sorted.slice(0, VISEMES.length)) {
      const url = URL.createObjectURL(f);
      const t = await loader.loadAsync(url);
      t.colorSpace = THREE.SRGBColorSpace;
      tex.push(t);
    }
    this.textures = tex;
    const img = tex[0].image;
    this.aspect = img.height / img.width;
    this.material.map = this.textures[this.current];
    this.rebuild();
  }

  resetImages() {
    this.textures = [...this.defaultTextures];
    this.aspect = 160 / 256;
    this.material.map = this.textures[this.current];
    this.rebuild();
  }
}
