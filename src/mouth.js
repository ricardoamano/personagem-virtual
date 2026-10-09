import * as THREE from 'three';

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

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _zero = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

// A boca e um plano com a imagem da boca, preso a um osso/grupo da cabeca.
export class MouthSprite {
  constructor() {
    this.defaultTextures = VISEMES.map((_, i) => makeDefaultTexture(i));
    this.textures = [...this.defaultTextures];
    this.material = new THREE.MeshBasicMaterial({
      map: this.textures[0],
      transparent: true,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.raycast = () => {}; // o clique "atravessa" a boca
    this.mesh.renderOrder = 10;
    this.size = 0.3; // largura em unidades do mundo (~metros)
    this.aspect = 160 / 256;
    this.node = null;
    this.current = 0;
  }

  setViseme(i) {
    if (i === this.current) return;
    this.current = i;
    this.material.map = this.textures[i];
  }

  setSize(w) {
    this.size = w;
    this.updateScale();
  }

  updateScale() {
    if (!this.node) return;
    this.node.updateWorldMatrix(true, false);
    this.node.getWorldScale(_v);
    const s = _v.x || 1;
    this.mesh.scale.set(this.size / s, (this.size * this.aspect) / s, 1);
  }

  // Muda o osso onde a boca fica preso, mantendo a posicao atual no mundo.
  setNode(node) {
    if (!node) return;
    node.attach(this.mesh);
    this.node = node;
    this.updateScale();
  }

  // Coloca a boca num ponto do mundo, virada para "normal" (direcao para fora da superficie).
  placeAt(node, point, normal) {
    if (this.mesh.parent !== node) {
      node.add(this.mesh);
    }
    this.node = node;
    node.updateWorldMatrix(true, false);
    const wp = _v.copy(point).addScaledVector(normal, this.size * 0.01);
    this.mesh.position.copy(node.worldToLocal(wp));
    _m.lookAt(normal, _zero, _up); // eixo z da boca = normal
    const qWorld = new THREE.Quaternion().setFromRotationMatrix(_m);
    node.getWorldQuaternion(_q);
    this.mesh.quaternion.copy(_q.invert().multiply(qWorld));
    this.updateScale();
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
    this.updateScale();
  }

  resetImages() {
    this.textures = [...this.defaultTextures];
    this.aspect = 160 / 256;
    this.material.map = this.textures[this.current];
    this.updateScale();
  }
}
