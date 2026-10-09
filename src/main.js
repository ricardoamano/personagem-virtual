import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Robot } from './robot.js';
import { MouthSprite, VISEMES } from './mouth.js';
import { LipSync } from './lipsync.js';

const $ = (id) => document.getElementById(id);

// ---------- cena ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

const BACKGROUNDS = {
  azul: 0x0d3b66,
  verde: 0x00b140, // chroma key
  cinza: 0x3a3f47,
  preto: 0x000000,
  branco: 0xffffff,
};
scene.background = new THREE.Color(BACKGROUNDS.azul);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- personagem ----------
const stage = new THREE.Group();
scene.add(stage);
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

function clearStage() {
  mouth.mesh.removeFromParent();
  mouth.node = null;
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
    if (/head$|^head|cabe/.test(s) && !/end|top|nub/.test(s)) return 2;
    if (/head/.test(s)) return 1;
    return 0;
  };
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

// Procura a superficie do rosto de frente e coloca a boca la.
function autoPlaceMouth(yFrac) {
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, characterHeight * yFrac, 8),
    new THREE.Vector3(0, 0, -1),
  );
  stage.updateMatrixWorld(true);
  const hit = ray.intersectObjects(stage.children, true)[0];
  if (!hit || !mouth.node) return false;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  mouth.placeAt(mouth.node, hit.point, n);
  return true;
}

function loadRobot() {
  clearStage();
  robot = new Robot();
  stage.add(robot.root);
  characterHeight = 1.95;
  bones = [robot.head];
  robot.head.name = 'Cabeça do robô';
  anims = robot.actions.map((a, i) => ({ name: a.name, play: () => robot.play(i) }));
  refreshAnimList();
  refreshBoneList(robot.head);
  mouth.setSize(0.34);
  $('mouthSize').value = '0.34';
  mouth.placeAt(robot.head, new THREE.Vector3(0, 1.36, 0.39), new THREE.Vector3(0, 0, 1));
  mouth.mesh.rotation.set(0, 0, 0);
  mouth.mesh.quaternion.identity();
  mouth.mesh.position.set(0, -0.14, 0.395);
  controls.target.set(0, 1.0, 0);
  setStatus('Robô de teste carregado.');
}

async function loadGLB(file) {
  setStatus(`Carregando ${file.name}…`);
  const buf = await file.arrayBuffer();
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
  controls.target.set(0, 1.0, 0);

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
  mixer.addEventListener('finished', () => {
    if (idleAction) {
      const prev = currentAction;
      idleAction.reset().play();
      if (prev && prev !== idleAction) prev.crossFadeTo(idleAction, 0.3, false);
      currentAction = idleAction;
    }
  });
  anims = glbClips.map((clip) => ({
    name: clip.name || 'animação',
    play: () => {
      const a = mixer.clipAction(clip);
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = !idleAction;
      if (currentAction && currentAction !== a) a.crossFadeFrom(currentAction, 0.25, false);
      a.play();
      currentAction = a;
    },
  }));
  refreshAnimList();

  mouth.setSize(0.16);
  $('mouthSize').value = '0.16';
  mouth.placeAt(head, new THREE.Vector3(0, 1.6, 0.2), new THREE.Vector3(0, 0, 1));
  const ok = autoPlaceMouth(0.8);
  setStatus(
    `${file.name} carregado: ${glbClips.length} animações, ${bones.length} ossos. ` +
      (ok ? 'Boca posicionada automaticamente — ajuste se precisar.' : 'Não achei o rosto: use "Posicionar boca".'),
  );
}

// ---------- arrastar arquivos ----------
$('glbFile').addEventListener('change', (e) => e.target.files[0] && loadGLB(e.target.files[0]).catch(fail));
$('mouthFiles').addEventListener('change', async (e) => {
  try {
    await mouth.loadImages(e.target.files);
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
$('resetMouth').onclick = () => {
  mouth.resetImages();
  setStatus('Boca padrão restaurada.');
};

// ---------- boca: posicao, tamanho, osso ----------
let placing = false;
$('placeBtn').onclick = () => {
  placing = !placing;
  $('placeBtn').classList.toggle('on', placing);
  canvas.style.cursor = placing ? 'crosshair' : '';
  setStatus(placing ? 'Clique no rosto do personagem, onde a boca deve ficar.' : 'Posicionamento desligado.');
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
  stage.updateMatrixWorld(true);
  const hit = ray.intersectObjects(stage.children, true)[0];
  if (!hit || !mouth.node) return setStatus('Clique em cima do personagem.', true);
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  mouth.placeAt(mouth.node, hit.point, n);
  setStatus('Boca posicionada. Segure Espaço para testar.');
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
$('bg').onchange = (e) => (scene.background = new THREE.Color(BACKGROUNDS[e.target.value]));
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
  if (e.target.matches('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  if (e.repeat && k !== ' ') return;
  if (/^[1-9]$/.test(e.key)) anims[parseInt(e.key, 10) - 1]?.play();
  else if (e.key === '0') {
    robot?.stop();
    if (idleAction) idleAction.reset().play();
  } else if (k === ' ') {
    simulate = true;
    e.preventDefault();
  } else if (k in VISEME_KEYS) forced = VISEME_KEYS[k];
  else if (k === 'm') toggleMic();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'h') togglePanel();
  else if (k === 'g') {
    $('bg').value = $('bg').value === 'verde' ? 'azul' : 'verde';
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
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();
  if (robot) robot.update(dt);
  if (mixer) mixer.update(dt);
  const v = lip.update(dt, parseFloat($('sens').value), simulate, forced);
  mouth.setViseme(v);
  $('vu').style.width = `${Math.round(lip.open * 100)}%`;
  $('viseme').textContent = VISEMES[v];
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

loadRobot();
frame();

// ganchos para testes automaticos
window.__nestor = { THREE, scene, camera, mouth, lip, get robot() { return robot; }, loadGLB, autoPlaceMouth, stage };
