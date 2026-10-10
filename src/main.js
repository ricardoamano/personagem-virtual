import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Robot } from './robot.js';
import { MouthSprite, VISEMES, bindPose } from './mouth.js';
import { officeDataURL } from './backgrounds.js';
import { LipSync } from './lipsync.js';

const $ = (id) => document.getElementById(id);

// ---------- cena ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setClearColor(0x000000, 0); // fundo transparente: o cenario e uma camada HTML atras
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
camera.position.set(0, 1.25, 5.2);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.0, 0);
controls.enableDamping = true;
controls.update();

scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(2.5, 4, 4);
scene.add(sun);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  // limita os pixels desenhados: telas Retina em tela cheia pesam demais e causam travadas
  const cap = Math.sqrt(3.0e6 / (w * h));
  renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio, 2, cap)));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- fundo (camada HTML atras do 3D: cor, imagem ou video) ----------
const BG_COLORS = {
  azul: '#0d3b66',
  verde: '#00b140', // chroma key
  cinza: '#3a3f47',
  preto: '#000000',
  branco: '#ffffff',
};
let bgKey = 'azul';
let embeddedVideoUrl = null;

// arquivos embutidos no HTML (base64) -> bytes na memoria
function embeddedBytes(id) {
  const el = document.getElementById(id);
  if (!el || !el.textContent.trim()) return null;
  const bin = atob(el.textContent.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function setBackground(key, fileUrl, isVideo) {
  const layer = $('bgLayer');
  layer.innerHTML = '';
  layer.style.background = '';
  bgKey = key;
  let videoSrc = null;
  if (key in BG_COLORS) layer.style.background = BG_COLORS[key];
  else if (key === 'consultorio') layer.style.background = `center / cover no-repeat url("${officeDataURL()}")`;
  else if (key === 'consultorio-video') {
    if (!embeddedVideoUrl) {
      // MP4 (H.264) onde o navegador toca; senao WebM
      const probe = document.createElement('video');
      const mp4Ok = probe.canPlayType('video/mp4; codecs="avc1.42E01E"') !== '';
      const [id, type] = mp4Ok ? ['vid-consultorio', 'video/mp4'] : ['vid-consultorio-webm', 'video/webm'];
      const bytes = embeddedBytes(id) || embeddedBytes('vid-consultorio') || embeddedBytes('vid-consultorio-webm');
      if (bytes) embeddedVideoUrl = URL.createObjectURL(new Blob([bytes], { type }));
    }
    if (embeddedVideoUrl) videoSrc = embeddedVideoUrl;
    else layer.style.background = `center / cover no-repeat url("${officeDataURL()}")`;
  } else if (isVideo) videoSrc = fileUrl;
  else layer.style.background = `center / cover no-repeat url("${fileUrl}")`;

  if (videoSrc) {
    const v = document.createElement('video');
    v.src = videoSrc;
    v.autoplay = true;
    v.loop = true;
    v.muted = true;
    v.playsInline = true;
    v.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block';
    layer.appendChild(v);
    v.play().catch(() => {});
  }
  updateShadow();
}

// ---------- personagem ----------
const stage = new THREE.Group();
scene.add(stage);

// sombra suave no chao: ajuda o personagem a "pisar" no cenario
const shadowCanvas = document.createElement('canvas');
shadowCanvas.width = shadowCanvas.height = 128;
{
  const g = shadowCanvas.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.38)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
}
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.7, 1.7),
  new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.004;
scene.add(shadow);
function updateShadow() {
  shadow.visible = $('shadowChk').checked && bgKey !== 'verde';
}

const mouth = new MouthSprite();
const lip = new LipSync();

let robot = null;
let mixer = null;
let glbClips = [];
let idleAction = null;
let currentAction = null;
let anims = []; // { name, play() }
let bones = [];
let characterHeight = 2;
let headCenterY = 1.6; // altura do centro da cabeca (para a camera de close)
const inPlaceCache = new WeakMap();

function warmMouthTextures() {
  mouth.textures.forEach((t) => renderer.initTexture(t)); // evita micro-travada na 1a vez que cada boca aparece
}

function clearStage() {
  mouth.clear();
  stage.clear();
  robot = null;
  mixer = null;
  glbClips = [];
  idleAction = null;
  currentAction = null;
}

function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.style.color = isError ? '#ff8a80' : '';
}

const PT_NAMES = {
  Running: 'Correndo',
  Walking: 'Andando',
  Gangnam_Groove: 'Dança Gangnam',
  Hip_Hop_Dance: 'Dança Hip Hop',
  Skip_Forward: 'Pulinhos',
};
const prettyName = (n) => PT_NAMES[n] || (n || 'animação').replace(/_/g, ' ');

function refreshAnimList() {
  const box = $('anims');
  box.innerHTML = '';
  anims.forEach((a, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1} · ${a.name}`;
    b.onclick = () => a.play();
    box.appendChild(b);
  });
  if (!anims.length) box.textContent = 'Este modelo não tem animações.';
}

function refreshBoneList(defaultNode) {
  const sel = $('bone');
  sel.innerHTML = '';
  bones.forEach((b, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = b.name || `(osso ${i})`;
    sel.appendChild(o);
  });
  sel.value = String(Math.max(0, bones.indexOf(defaultNode)));
}

function guessHeadBone(list) {
  const score = (n) => {
    const s = (n.name || '').toLowerCase();
    if (s.endsWith('head')) return 3;
    if (/head|cabe/.test(s) && !/top|end|nub|front/.test(s)) return 2;
    if (/head/.test(s) && !/top|end|nub/.test(s)) return 1;
    return 0;
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

const findBone = (re) => bones.find((b) => re.test((b.name || '').toLowerCase()));
const worldY = (o) => o.getWorldPosition(new THREE.Vector3()).y;

// Procura a superficie do rosto de frente (na altura y do mundo) e cola a boca la.
function autoPlaceMouth(y) {
  bindPose(stage);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, y, 8), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObjects(stage.children, true)[0];
  if (!hit || !mouth.node) return false;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  mouth.place(mouth.node, hit.object, hit.point, n);
  return true;
}

function setHideClosed(on) {
  $('hideClosed').checked = on;
  mouth.hideWhenClosed = on;
}

function loadRobot() {
  clearStage();
  robot = new Robot();
  stage.add(robot.root);
  characterHeight = 1.95;
  headCenterY = 1.38;
  bones = [robot.head];
  robot.head.name = 'Cabeça do robô';
  anims = robot.actions.map((a, i) => ({ name: a.name, play: () => robot.play(i) }));
  refreshAnimList();
  refreshBoneList(robot.head);
  robot.restRoot.y = -0.125; // pes encostam no chao
  robot.root.position.copy(robot.restRoot);
  mouth.size = 0.5;
  $('mouthSize').value = '0.5';
  mouth.node = robot.head;
  autoPlaceMouth(1.25);
  setHideClosed(false);
  goCamera(0, true);
  setStatus('Robô de teste carregado.');
}

async function loadGLBBuffer(buf, label, { hasPaintedMouth = false } = {}) {
  setStatus(`Carregando ${label}…`);
  const gltf = await new GLTFLoader().parseAsync(buf, '');
  clearStage();

  const model = gltf.scene;
  const holder = new THREE.Group();
  holder.add(model);
  stage.add(holder);

  // ajusta tamanho (2 unidades de altura) e apoia os pes no chao
  holder.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const k = 2 / (size.y || 1);
  holder.scale.setScalar(k);
  holder.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(holder);
  const c = box2.getCenter(new THREE.Vector3());
  holder.position.set(-c.x, -box2.min.y, -c.z);
  characterHeight = 2;

  bones = [];
  model.traverse((o) => {
    if (o.isBone) bones.push(o);
  });
  const head = guessHeadBone(bones) || holder;
  if (!bones.length) bones = [holder];
  refreshBoneList(head);

  mixer = new THREE.AnimationMixer(model);
  glbClips = gltf.animations;
  const idleClip = glbClips.find((cl) => /idle|parad|espera|respir|breath/i.test(cl.name));
  idleAction = idleClip ? mixer.clipAction(idleClip) : null;
  if (idleAction) {
    idleAction.play();
    currentAction = idleAction;
  }
  mixer.addEventListener('finished', (e) => {
    const a = e.action;
    if (a !== currentAction) return;
    if (idleAction && a !== idleAction) {
      idleAction.reset().play();
      a.crossFadeTo(idleAction, 0.3, false);
      currentAction = idleAction;
    } else if (!idleAction) {
      stopAnimation(); // sem "parado" no arquivo: volta suavemente para a pose original
    }
  });
  anims = glbClips.map((clip) => ({ name: prettyName(clip.name), play: () => playClip(clip) }));
  refreshAnimList();

  // posicao e tamanho iniciais da boca, a partir dos ossos da cabeca
  bindPose(stage);
  const topB = findBone(/headtop/);
  const frontB = findBone(/headfront/);
  let yMouth = 0.66 * characterHeight;
  let mouthSize = 0.28;
  headCenterY = 0.84 * characterHeight;
  if (topB && head && head.isBone) {
    const hy = worldY(head);
    const span = Math.max(0.2, worldY(topB) - hy);
    yMouth = frontB ? worldY(frontB) + 0.12 * span : hy + 0.14 * span;
    mouthSize = 0.36 * span;
    headCenterY = hy + 0.5 * span;
  }
  mouth.size = mouthSize;
  $('mouthSize').value = String(mouthSize.toFixed(3));
  mouth.node = head;
  const ok = autoPlaceMouth(yMouth);
  setHideClosed(hasPaintedMouth);
  goCamera(0, true);
  setStatus(
    `${label} carregado: ${glbClips.length} animações, ${bones.length} ossos. ` +
      (ok ? 'Boca posicionada automaticamente — ajuste se precisar.' : 'Não achei o rosto: use "Posicionar boca".'),
  );
}

async function loadGLB(file) {
  await loadGLBBuffer(await file.arrayBuffer(), file.name);
}

async function loadDoctor() {
  const bytes = embeddedBytes('glb-medico');
  if (!bytes) return false;
  await loadGLBBuffer(bytes.buffer, 'Médico', { hasPaintedMouth: true });
  return true;
}

// ---------- animacoes ----------
// "Ficar no lugar": tira o deslocamento horizontal do quadril (correr/andar sem sair do enquadramento)
function inPlaceClip(clip) {
  let c = inPlaceCache.get(clip);
  if (c) return c;
  c = clip.clone();
  for (const t of c.tracks) {
    if (/hips\.position$/i.test(t.name)) {
      const v = t.values;
      const x0 = v[0];
      const z0 = v[2];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0;
        v[i + 2] = z0;
      }
    }
  }
  inPlaceCache.set(clip, c);
  return c;
}

function playClip(clip) {
  if (!mixer) return;
  const used = $('inPlace').checked ? inPlaceClip(clip) : clip;
  const a = mixer.clipAction(used);
  a.reset();
  a.enabled = true;
  a.setLoop($('loopChk').checked ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  a.clampWhenFinished = false;
  if (currentAction && currentAction !== a) a.crossFadeFrom(currentAction, 0.25, false);
  a.play();
  currentAction = a;
}

function stopAnimation() {
  robot?.stop();
  if (!mixer) return;
  if (idleAction) {
    idleAction.reset().play();
    if (currentAction && currentAction !== idleAction) currentAction.crossFadeTo(idleAction, 0.3, false);
    currentAction = idleAction;
    return;
  }
  const a = currentAction;
  currentAction = null;
  if (a) {
    a.fadeOut(0.3);
    setTimeout(() => a.stop(), 320); // ao parar, o personagem volta para a pose original
  }
}

// ---------- cameras pre-definidas ----------
const CAMERAS = [
  { key: 'q', name: 'Corpo inteiro', pos: (s) => [0, 1.25 * s, 5.2 * s], tgt: (s) => [0, 1.0 * s, 0] },
  { key: 'w', name: 'Plano médio', pos: (s) => [0, 1.45 * s, 3.4 * s], tgt: (s) => [0, 1.32 * s, 0] },
  { key: 'e', name: 'Close no rosto', pos: (s) => [0, headCenterY + 0.02 * s, 2.1 * s], tgt: () => [0, headCenterY, 0] },
  { key: 'r', name: '3/4 esquerda', pos: (s) => [-3.1 * s, 1.35 * s, 4.2 * s], tgt: (s) => [0, 1.0 * s, 0] },
  { key: 't', name: '3/4 direita', pos: (s) => [3.1 * s, 1.35 * s, 4.2 * s], tgt: (s) => [0, 1.0 * s, 0] },
  { key: 'y', name: 'Plano aberto', pos: (s) => [0, 1.6 * s, 8.5 * s], tgt: (s) => [0, 1.0 * s, 0] },
];
let camGoal = null;
function goCamera(i, instant = false) {
  const c = CAMERAS[i];
  if (!c) return;
  const s = characterHeight / 2;
  const goal = { pos: new THREE.Vector3(...c.pos(s)), tgt: new THREE.Vector3(...c.tgt(s)) };
  if (instant) {
    camera.position.copy(goal.pos);
    controls.target.copy(goal.tgt);
    controls.update();
    camGoal = null;
  } else camGoal = goal;
}
controls.addEventListener('start', () => (camGoal = null)); // se voce arrastar o mouse, a camera automatica para
{
  const box = $('cams');
  CAMERAS.forEach((c, i) => {
    const b = document.createElement('button');
    b.textContent = `${c.key.toUpperCase()} · ${c.name}`;
    b.onclick = () => goCamera(i);
    box.appendChild(b);
  });
}

// ---------- arrastar arquivos ----------
$('glbFile').addEventListener('change', (e) => e.target.files[0] && loadGLB(e.target.files[0]).catch(fail));
$('mouthFiles').addEventListener('change', async (e) => {
  try {
    await mouth.loadImages(e.target.files);
    warmMouthTextures();
    setStatus('Imagens da boca carregadas.');
  } catch (err) {
    fail(err);
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  const glb = files.find((f) => /\.(glb|gltf)$/i.test(f.name));
  const imgs = files.filter((f) => /\.(png|webp|jpe?g)$/i.test(f.name));
  try {
    if (glb) await loadGLB(glb);
    else if (imgs.length) {
      await mouth.loadImages(imgs);
      warmMouthTextures();
      setStatus('Imagens da boca carregadas.');
    }
  } catch (err) {
    fail(err);
  }
});
function fail(err) {
  console.error(err);
  setStatus(`Erro: ${err.message || err}`, true);
}

$('robotBtn').onclick = loadRobot;
$('doctorBtn').onclick = () => loadDoctor().catch(fail);
$('resetMouth').onclick = () => {
  mouth.resetImages();
  warmMouthTextures();
  setStatus('Boca padrão restaurada.');
};

// ---------- boca: posicao, tamanho, osso ----------
let placing = false;
function setPlacing(on) {
  placing = on;
  $('placeBtn').classList.toggle('on', placing);
  canvas.style.cursor = placing ? 'crosshair' : '';
}
$('placeBtn').onclick = () => {
  setPlacing(!placing);
  setStatus(
    placing
      ? 'Personagem parado. Clique no rosto, onde a boca deve ficar.'
      : 'Posicionamento desligado. As animações voltaram a funcionar.',
  );
};
$('mouthSize').oninput = (e) => mouth.setSize(parseFloat(e.target.value));
$('bone').onchange = (e) => {
  const node = bones[parseInt(e.target.value, 10)];
  if (node) mouth.setNode(node);
};
let downAt = null;
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!placing || !downAt) return;
  if (Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return; // foi arrastar a camera
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(stage.children, true)[0];
  if (!hit || !mouth.node) return setStatus('Clique em cima do personagem.', true);
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  mouth.place(mouth.node, hit.object, hit.point, n);
  setPlacing(false);
  setStatus('Boca posicionada. As animações voltaram a funcionar; segure Espaço para testar a boca.');
});

// ---------- microfone ----------
async function fillDevices() {
  const sel = $('mic');
  const devs = await lip.listDevices();
  sel.innerHTML = '';
  devs.forEach((d, i) => {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = d.label || `Microfone ${i + 1}`;
    sel.appendChild(o);
  });
}
async function toggleMic() {
  if (lip.active) {
    lip.stop();
    $('micBtn').textContent = 'Ligar microfone';
    $('micBtn').classList.remove('on');
    return;
  }
  try {
    await lip.start($('mic').value || undefined);
    await fillDevices();
    $('micBtn').textContent = 'Desligar microfone';
    $('micBtn').classList.add('on');
    setStatus('Microfone ligado. Fale para ver a boca mexer.');
  } catch (err) {
    fail(new Error(`Microfone: ${err.message}`));
  }
}
$('micBtn').onclick = toggleMic;
$('mic').onchange = () => lip.active && lip.start($('mic').value).catch(fail);

// ---------- fundo, tela cheia, painel ----------
$('bg').onchange = (e) => setBackground(e.target.value);
$('bgFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  let opt = [...$('bg').options].find((o) => o.value === 'arquivo');
  if (!opt) {
    opt = document.createElement('option');
    opt.value = 'arquivo';
    $('bg').appendChild(opt);
  }
  opt.textContent = `Arquivo: ${f.name}`;
  $('bg').value = 'arquivo';
  setBackground('arquivo', url, f.type.startsWith('video'));
  setStatus(`Fundo: ${f.name}`);
});
$('shadowChk').onchange = updateShadow;
$('hideClosed').onchange = (e) => {
  mouth.hideWhenClosed = e.target.checked;
};
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.();
}
$('fsBtn').onclick = toggleFullscreen;
function togglePanel() {
  $('panel').classList.toggle('hidden');
}

// ---------- teclado ----------
const VISEME_KEYS = { z: 0, x: 1, c: 2, v: 3, b: 4 };
let simulate = false;
let forced = -1;
window.addEventListener('keydown', (e) => {
  if (e.target.matches('textarea, input[type=text]')) return;
  // tira o foco de botoes/listas/barras: senão o teclado fica "preso" nelas
  if (e.target !== document.body && e.target.matches('button, select, input')) e.target.blur();
  const k = e.key.toLowerCase();
  if (e.repeat && k !== ' ') return;
  const camIdx = CAMERAS.findIndex((c) => c.key === k);
  if (/^[1-9]$/.test(e.key)) anims[parseInt(e.key, 10) - 1]?.play();
  else if (e.key === '0') stopAnimation();
  else if (k === ' ') {
    simulate = true;
    e.preventDefault();
  } else if (k in VISEME_KEYS) forced = VISEME_KEYS[k];
  else if (camIdx >= 0) goCamera(camIdx);
  else if (k === 'm') toggleMic();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'h') togglePanel();
  else if (k === 'g') {
    $('bg').value = $('bg').value === 'verde' ? 'consultorio-video' : 'verde';
    $('bg').onchange({ target: $('bg') });
  }
});
window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') simulate = false;
  if (k in VISEME_KEYS) forced = -1;
});

// ---------- loop ----------
const clock = new THREE.Clock();
let lastVu = -1;
let lastViseme = -1;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (camGoal) {
    const a = 1 - Math.exp(-dt * 5);
    camera.position.lerp(camGoal.pos, a);
    controls.target.lerp(camGoal.tgt, a);
    if (camera.position.distanceTo(camGoal.pos) < 0.01 && controls.target.distanceTo(camGoal.tgt) < 0.01) camGoal = null;
  }
  controls.update();
  if (placing) {
    bindPose(stage); // congela o personagem na pose original para posicionar a boca
  } else {
    if (robot) robot.update(dt);
    if (mixer) mixer.update(dt);
  }
  const v = lip.update(dt, parseFloat($('sens').value), simulate, forced);
  mouth.setViseme(v);
  const vu = Math.round(lip.open * 100);
  if (vu !== lastVu) {
    lastVu = vu;
    $('vu').style.width = `${vu}%`;
  }
  if (v !== lastViseme) {
    lastViseme = v;
    $('viseme').textContent = VISEMES[v];
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

async function start() {
  setBackground($('bg').value || 'consultorio-video');
  warmMouthTextures();
  let ok = false;
  try {
    ok = await loadDoctor();
  } catch (err) {
    fail(err);
  }
  if (!ok) loadRobot();
  frame();
  $('boot')?.remove();
}
start();

// ganchos para testes automaticos
window.__nestor = {
  THREE, scene, camera, controls, mouth, lip, stage,
  get robot() { return robot; },
  get mixer() { return mixer; },
  get bones() { return bones; },
  loadGLB, autoPlaceMouth, setBackground, goCamera, playClip,
};
