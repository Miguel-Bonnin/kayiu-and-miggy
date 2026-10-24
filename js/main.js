// Miggy & Kayiu: a scroll-driven pop-up book on a real desk.
// Built on the lemo-opuscar paper-popup engine (book.js, cutmesh.js, paper.js, post.js; MIT, LemoLab).
// Everything in the story is a pure function of p (0 to 1, scroll progress), so scrolling scrubs it.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clamp, lerp, seg, ss, eio, back, TAU, mulberry, track } from './lib.js';
import { cv, GRAIN, paperFill, finishCut } from './paper.js';
import { makeBook, coverCanvases, texOf, BW, BD, PG } from './book.js';
import { cutMesh, particles } from './cutmesh.js';
import { makePost, resizePost } from './post.js';
import { drawCaptions, drawBubbles } from './hud.js';

const MOBILE = matchMedia('(pointer: coarse)').matches || innerWidth < 700;
const DPR = Math.min(devicePixelRatio || 1, MOBILE ? 1.5 : 2);
const params = new URLSearchParams(location.search);
const fixedP = params.has('p') ? parseFloat(params.get('p')) : null;   // ?p=0.4 freezes a frame

// ---------- renderer ----------
const glCanvas = document.getElementById('gl'), ov = document.getElementById('ov'), OX = ov.getContext('2d');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false, powerPreference: 'high-performance' }); }
catch (e) { document.body.classList.add('nogl'); document.getElementById('fallback').hidden = false; throw e; }
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(30, 16 / 9, .004, 30);
let W = 2, H = 2;
const post = makePost(renderer, scene, cam, W, H, MOBILE ? 24 : 48);

// ---------- loading ----------
const tl = new THREE.TextureLoader(), gl = new GLTFLoader();
const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const ART = {
  backdrop: 'assets/s1/backdrop.webp', river: 'assets/s1/river.webp', grass: 'assets/s1/grass.webp',
  swan1: 'assets/s1/swan-1.webp', swan2: 'assets/s1/swan-2.webp', swan3: 'assets/s1/swan-3.webp',
  miggy: 'assets/char/miggy-front.webp', kayiu: 'assets/char/kayiu-front.webp', leaf: 'assets/misc/leaf-green.webp',
};

async function room() {
  const hdr = await new RGBELoader().loadAsync('assets/room/lythwood_lounge_1k.hdr');
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = hdr; scene.background = hdr; scene.backgroundBlurriness = .22;
  scene.backgroundRotation.set(0, 2.3, 0); scene.environmentRotation.set(0, 2.3, 0);
  const wt = n => { const t = tl.load(`assets/room/walnut_${n}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2.2, 1.4); t.anisotropy = 8; return t; };
  const wdiff = wt('diff'); wdiff.colorSpace = THREE.SRGBColorSpace;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, .04, 1.7), new THREE.MeshStandardMaterial({ map: wdiff, normalMap: wt('nor'), roughnessMap: wt('rough'), color: '#c9a88a', envMapIntensity: .8 }));
  desk.position.set(0, -.02, .25); desk.receiveShadow = true; scene.add(desk);
  const prop = async (name, x, z, s, ry) => {
    const m = (await gl.loadAsync(`assets/room/${name}/${name}.gltf`)).scene;
    m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = ry;
    m.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    scene.add(m); return m;
  };
  const lamp = await prop('desk_lamp_arm_01', -.347, .51, .55, -.76);
  lamp.traverse(o => { if (o.isMesh) o.castShadow = false; });   // its head sits between the paper sun and the page
  lamp.traverse(o => { if (o.isMesh && o.material.name.includes('light')) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffd9a0'); o.material.emissiveIntensity = 6; } });
  const tea = await prop('tea_set_01', 0, 0, 1, 0);
  const keep = { tea_set_01_teapot_01: [.52, .2, .5], tea_set_01_teapot_01_lid: [.52, .2, .5], tea_set_01_cup_small_01: [.36, .5, 2.2], tea_set_01_saucer_circular_04: [.36, .5, 0], tea_set_01_sugar_cup_01: [.55, .42, 0], tea_set_01_sugar_cup_01_lid: [.55, .42, 0] };
  const dead = [];
  tea.traverse(o => { if (!o.name.startsWith('tea_set_01_')) return; const k = keep[o.name]; if (!k) dead.push(o); else { o.position.x = k[0]; o.position.z = k[1]; o.rotation.y = k[2]; } });
  dead.forEach(o => o.parent && o.parent.remove(o));
  tea.traverse(o => { if (o.name === 'tea_set_01_cup_small_01') o.position.y += .012; });
}

// ---------- lights (values from the paper-popup demo) ----------
const lampHead = new THREE.Vector3(-.28, .375, .44);
const spot = new THREE.SpotLight('#fff0dc', 0, 3, .75, .55, 2); spot.position.copy(lampHead); spot.target.position.set(.02, 0, .2);
spot.castShadow = true; spot.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
spot.shadow.bias = -.00006; spot.shadow.normalBias = .0004; spot.shadow.radius = 5; spot.shadow.camera.near = .05; spot.shadow.camera.far = 2;
scene.add(spot, spot.target);
const bulb = new THREE.PointLight('#ffcf94', 0, .6, 2); bulb.position.copy(lampHead).add(new THREE.Vector3(0, -.02, 0)); scene.add(bulb);
const sun = new THREE.DirectionalLight('#fff3e0', 0); sun.position.set(-.55, 1.1, .85);
sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048); sun.shadow.bias = -.00008; sun.shadow.normalBias = .0003; sun.shadow.radius = 4;
Object.assign(sun.shadow.camera, { left: -.3, right: .3, top: .3, bottom: -.3, near: .1, far: 3 }); sun.target.position.set(0, .05, .12); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe6ff', '#caa27a', 0); scene.add(hemi);

// ---------- page art (watercolour washes on paper) ----------
const PW = 2048, PH = Math.round(2048 * BD / BW);
function wash(x, col, cx, cy, rx, ry, a, seed) {
  const R = mulberry(seed);
  for (let i = 0; i < 26; i++) {
    const px = cx + (R() - .5) * rx * 1.6, py = cy + (R() - .5) * ry * 1.6, r = (rx + ry) * (.18 + R() * .3);
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col.replace('A', (a * (.5 + R() * .5)).toFixed(3))); g.addColorStop(1, col.replace('A', '0'));
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
}
function page(kind) {
  const c = cv(PW, PH), x = c.getContext('2d');
  paperFill(x, PW, PH, '#f5ecd9', kind.length * 7, .05);
  if (kind === 'sky') {
    const g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, 'rgba(70,140,215,.95)'); g.addColorStop(.65, 'rgba(140,195,235,.75)'); g.addColorStop(1, 'rgba(225,235,230,.3)');
    x.fillStyle = g; x.fillRect(40, 40, PW - 80, PH - 80);
    for (let i = 0; i < 9; i++) wash(x, 'rgba(255,255,255,A)', 200 + i * 210, 160 + (i % 3) * 90, 120, 34, .5, i + 3);
  } else if (kind === 'ground') {
    const g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, 'rgba(96,150,72,.6)'); g.addColorStop(1, 'rgba(132,180,88,.8)');
    x.fillStyle = g; x.fillRect(30, 30, PW - 60, PH - 60);
    wash(x, 'rgba(70,120,50,A)', PW * .5, PH * .6, PW * .4, PH * .3, .18, 11);
    wash(x, 'rgba(240,230,120,A)', PW * .3, PH * .8, 300, 120, .15, 12);
  } else if (kind === 'dusk') {
    const g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, 'rgba(48,40,98,.92)'); g.addColorStop(.55, 'rgba(150,92,140,.75)'); g.addColorStop(1, 'rgba(250,170,110,.7)');
    x.fillStyle = g; x.fillRect(40, 40, PW - 80, PH - 80);
    const R = mulberry(5); x.fillStyle = 'rgba(255,248,220,.9)';
    for (let i = 0; i < 60; i++) { x.beginPath(); x.arc(60 + R() * (PW - 120), 60 + R() * PH * .45, 1.5 + R() * 3, 0, TAU); x.fill(); }
  } else if (kind === 'lawn') {
    const g = x.createLinearGradient(0, 0, 0, PH); g.addColorStop(0, 'rgba(40,78,52,.8)'); g.addColorStop(1, 'rgba(60,104,62,.85)');
    x.fillStyle = g; x.fillRect(30, 30, PW - 60, PH - 60);
    wash(x, 'rgba(255,190,110,A)', PW * .5, PH * .45, PW * .3, PH * .2, .12, 21);
  }
  x.save(); x.globalAlpha = .7; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, PW, PH); x.restore();
  return texOf(c);
}

function signCanvas() {
  const c = cv(900, 620), x = c.getContext('2d');
  paperFill(x, 900, 620, '#fbf6ea', 4, .04);
  x.strokeStyle = '#b8893a'; x.lineWidth = 6; x.strokeRect(34, 34, 832, 552); x.lineWidth = 2; x.strokeRect(48, 48, 804, 524);
  x.textAlign = 'center';
  x.font = 'italic 52px "IM Fell English"'; x.fillStyle = '#b8893a'; x.fillText('Save the date', 450, 138);
  x.fillStyle = '#3a2a24'; x.font = '500 106px "Cormorant Garamond"'; x.fillText('Miggy & Kayiu', 450, 272);
  x.font = '600 54px "Cormorant Garamond"'; x.fillText('Saturday 15 May 2027', 450, 372);
  x.font = '500 46px "Cormorant Garamond"'; x.fillText('Kew Gardens', 450, 442);
  x.font = 'italic 36px "IM Fell English"'; x.fillText('seventeen years to the day', 450, 520);
  return c;
}

// ---------- scene state ----------
let book, leaf, T = {};
const pieces = [];   // { g, z, dir, rise:[a,b], fold:[a,b], sway, glide, x }
const anchors = {};
const heads = {};    // name -> card group, for speech-bubble anchors

function cardFrom(source, width, o = {}) {
  // pad first so the paper border isn't clipped at the image edge
  const border = o.border ?? Math.max(8, Math.round(Math.max(source.width, source.height) * .012)), pad = border + 8;
  const padded = cv(source.width + pad * 2, source.height + pad * 2); padded.getContext('2d').drawImage(source, pad, pad);
  const art = finishCut(padded, border);
  return cutMesh({ c: art, w: width, h: width * art.height / art.width, ax: .5, ay: 1 });   // ay = 1: anchored at the bottom edge
}
function place(spec) {
  const g = cardFrom(spec.src, spec.w, spec);
  g.position.set(spec.x, 0, spec.z); g.visible = false; book.stage.add(g);
  const pc = { g, dir: spec.z > .15 ? -1 : 1, sway: 0, glide: 0, ...spec, x: spec.x };
  pieces.push(pc);
  if (spec.head) heads[spec.head] = pc;
  return pc;
}

async function build() {
  await Promise.all(['500 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', 'italic 40px "IM Fell English"', '40px "Patrick Hand"'].map(f => document.fonts.load(f))).catch(() => {});
  const [im] = await Promise.all([
    Promise.all(Object.entries(ART).map(async ([k, v]) => [k, await img(v)])).then(Object.fromEntries),
    room(),
  ]);

  book = makeBook(coverCanvases(im.leaf));
  scene.add(book.root);
  T = { sky: page('sky'), ground: page('ground'), dusk: page('dusk'), lawn: page('lawn') };
  book.backMat.map = T.sky; book.groundMat.map = T.ground;
  book.backMat.color.setScalar(.62); book.groundMat.color.setScalar(.9);   // the standing page faces the sun; keep its sky from blowing out
  book.leafFront.material.map = T.ground; book.leafBack.material.map = T.dusk;
  for (const m of [book.backMat, book.groundMat, book.leafFront.material, book.leafBack.material]) m.needsUpdate = true;

  // Spread 1: Lammas, Staines. Pieces rise back to front.
  place({ src: im.backdrop, w: .43, x: 0, z: .012, rise: [.15, .22], fold: [.66, .70], dir: 1 });
  place({ src: im.river, w: .43, x: 0, z: .07, rise: [.17, .24], fold: [.66, .70], dir: 1 });
  place({ src: im.swan1, w: .055, x: -.12, z: .082, rise: [.20, .26], fold: [.66, .70], glide: .05, dir: 1 });
  place({ src: im.swan2, w: .065, x: .03, z: .092, rise: [.21, .27], fold: [.66, .70], glide: -.04, dir: 1 });
  place({ src: im.swan3, w: .058, x: .14, z: .086, rise: [.22, .28], fold: [.66, .70], glide: .035, dir: 1 });
  place({ src: im.miggy, w: .05, x: -.04, z: .165, rise: [.25, .31], fold: [.67, .71], head: 'miggy' });
  place({ src: im.kayiu, w: .038, x: .035, z: .165, rise: [.26, .32], fold: [.67, .71], head: 'kayiu' });
  place({ src: im.grass, w: .44, x: 0, z: .275, rise: [.28, .34], fold: [.655, .695], sway: .004, lean: -1.0 });

  // Spread 2: Kew at dusk, the save-the-date
  place({ src: signCanvas(), w: .19, x: 0, z: .16, rise: [.85, .90], fold: [2, 3], border: 14, dir: 1 });
  const m2 = place({ src: im.miggy, w: .05, x: -.135, z: .2, rise: [.87, .91], fold: [2, 3] });
  const k2 = place({ src: im.kayiu, w: .038, x: .13, z: .2, rise: [.875, .915], fold: [2, 3] });
  heads.miggy2 = m2; heads.kayiu2 = k2;

  leaf = cardFrom(im.leaf, .042, { border: 10 });
  leaf.userData.front.material = leaf.userData.front.material.clone(); leaf.userData.front.material.side = THREE.DoubleSide;
  leaf.userData.back.visible = false;
  scene.add(leaf);

  document.getElementById('loading').classList.add('done');
  window.__dbg = { scene, pieces, book, T }; window.__ready = true;
}

// ---------- particles (from the demo): lamp-beam dust and sparkles as the book opens ----------
function spriteTex(fn, n = 64) { const c = cv(n, n), x = c.getContext('2d'); fn(x, n); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const glowTex = spriteTex((x, n) => { const g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, n, n); });
const starTex = spriteTex((x, n) => { x.translate(n / 2, n / 2); x.fillStyle = '#fff'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? n * .1 : n * .48; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); });
const quad = new THREE.PlaneGeometry(1, 1);
const addMat = (map, col) => new THREE.MeshBasicMaterial({ map, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
const camE = new THREE.Euler();
const dust = particles(quad, addMat(glowTex, new THREE.Color(1.2, 1.0, .75)), MOBILE ? 40 : 90, (i, t) => {
  const R = mulberry(i * 7 + 1), u = R(), v = R(), w = R(), sp = .004 + R() * .006;
  return { x: lerp(-.34, .1, u) + Math.sin(t * .3 + i) * .02, y: .02 + ((v * .38 + t * sp) % .38), z: lerp(.1, .6, w) + Math.cos(t * .23 + i) * .02,
    s: (.0016 + R() * .0022) * (.5 + .5 * Math.sin(t * 1.3 + i * 2)), rx: camE.x, ry: camE.y, rz: camE.z };
});
scene.add(dust);
const sparkle = particles(quad, addMat(starTex, new THREE.Color(2.4, 1.9, .9)), 90, (i, p) => {
  const R = mulberry(i * 13 + 5), p0 = .1 + R() * .1, life = .04 + R() * .04, k = (p - p0) / life; if (k < 0 || k > 1) return null;
  return { x: lerp(-.2, .2, R()) + Math.sin(k * 6 + i) * .01, y: PG + k * (.08 + R() * .1), z: lerp(.02, .28, R()), s: .006 * Math.sin(k * Math.PI) * (.5 + R()), rx: camE.x, ry: camE.y, rz: camE.z + p * 40 + i };
});
scene.add(sparkle);

// ---------- camera: [p, px,py,pz, tx,ty,tz, fov, aperture, portrait pull-back] ----------
const SHOTS = [
  [0.00, .22, .42, .95, 0, .02, .15, 32, 3.0, 1.6],
  [0.08, .12, .40, .80, 0, .03, .14, 30, 3.0, 1.7],
  [0.20, .00, .30, .66, 0, .07, .12, 30, 2.8, 2.1],
  [0.33, .02, .12, .50, 0, .07, .13, 30, 2.4, 1.8],
  [0.37, .05, .115, .45, 0, .062, .15, 30, 2.2, 1.6],
  [0.62, -.04, .118, .45, 0, .062, .15, 30, 2.2, 1.6],
  [0.68, .00, .36, .64, 0, .05, .13, 30, 2.8, 2.1],
  [0.80, .00, .40, .62, 0, .05, .14, 30, 2.8, 2.1],
  [0.90, .00, .17, .64, 0, .075, .17, 30, 2.6, 2.0],
  [1.00, .00, .15, .60, 0, .075, .17, 30, 2.6, 2.0],
];
const shot = track(SHOTS.map(k => [k[0], k.slice(1)]));
function cameraAt(p) {
  const v = shot(p), pos = new THREE.Vector3(v[0], v[1], v[2]), tgt = new THREE.Vector3(v[3], v[4], v[5]);
  const a = cam.aspect, pull = a < 1 ? lerp(v[8], 1, clamp((a - .45) / .55)) : 1;
  pos.sub(tgt).multiplyScalar(pull).add(tgt);
  cam.position.copy(pos); cam.fov = a < 1 ? v[6] + 10 : v[6]; cam.lookAt(tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  post.dof.focus = pos.distanceTo(tgt); post.dof.aper = v[7] * (a < 1 ? .7 : 1);
}

// ---------- the story ----------
const tmp = new THREE.Vector3();
function toScreen(v) { const q = v.clone().project(cam); if (q.z > 1) return null; return [(q.x * .5 + .5) * W, (-q.y * .5 + .5) * H]; }

function frame(p, t) {
  // book opens: the cover swings up and becomes the backdrop
  const op = eio(seg(p, .03, .16));
  book.setOpen(Math.PI / 2 * op + Math.sin(seg(p, .14, .2) * Math.PI) * -.03);

  // page turn to the dusk spread
  const u = seg(p, .72, .83);
  if (u > 0 && u < 1) { book.groundMat.map = T.lawn; book.setLeaf(eio(u)); }
  else { book.setLeaf(0); book.groundMat.map = u >= 1 ? T.lawn : T.ground; }
  book.backMat.map = u >= 1 ? T.dusk : T.sky;

  // pop-ups: rise with overshoot, fold in the reverse order
  for (const pc of pieces) {
    const up = back(seg(p, pc.rise[0], pc.rise[1]), 1.7), dn = 1 - ss(seg(p, pc.fold[0], pc.fold[1]));
    const k = Math.min(up, dn);
    pc.g.visible = k > .002; if (!pc.g.visible) continue;
    pc.g.rotation.x = pc.dir * (Math.PI / 2) * (1 - k) + (pc.lean || 0) * clamp(k) * .8;
    if (pc.sway) pc.g.rotation.z = Math.sin(t * 1.6 + pc.x * 40) * pc.sway * k;
    if (pc.glide) pc.g.position.x = pc.x + pc.glide * Math.sin(p * 9 + pc.x * 20) + Math.sin(t * .8 + pc.x * 30) * .002;
  }

  // the ginkgo leaf: rests on the cover, lifts as the book opens, blows away, then drifts home onto the sign
  if (leaf) {
    const lift = seg(p, .05, .2), away = seg(p, .6, .68), home = seg(p, .88, .97);
    const rest = new THREE.Vector3(0, BD * .73, -.0185);
    book.open.localToWorld(rest);
    let x = lerp(rest.x, -.08, ss(lift)), y = lerp(rest.y + .001, .17, ss(lift)), z = lerp(rest.z, .2, ss(lift));
    x += Math.sin(p * 40) * .01 * lift + away * .55; y += away * .3; z += away * .3;
    if (home > 0) { x = lerp(-.4, .02, ss(home)); y = lerp(.3, PG + .145, ss(home)) + Math.sin(home * 14) * .01 * (1 - home); z = lerp(.4, .16, ss(home)); }
    leaf.position.set(x, y, z);
    const wob = lift * (1 - home) + (home > 0 && home < 1 ? 1 - home : 0);
    leaf.rotation.set(-Math.PI / 2 + (1 - lift) * 0 + Math.sin(p * 22) * .6 * wob + (home >= 1 ? Math.PI / 2 - .25 : 0), p * 8 * wob, Math.sin(p * 17) * .5 * wob);
    leaf.visible = !(away >= 1 && home <= 0);
    const gold = seg(p, .85, .95); leaf.userData.front.material.color.setRGB(1, lerp(1, .82, gold), lerp(1, .45, gold));
  }

  // light: the desk lamp in the real room; a paper sun inside the story that sinks to dusk at Kew
  const inStory = seg(p, .04, .16), real = 1 - inStory, dusk = seg(p, .78, .9);
  sun.intensity = inStory * (2.6 - dusk * 1.5);
  sun.color.set('#fff3e0').lerp(new THREE.Color('#ffae6b'), dusk);
  spot.intensity = real * 1.0 + inStory * (.12 + dusk * 1.1); bulb.intensity = spot.intensity * .6;
  hemi.intensity = .15 + inStory * (.55 - dusk * .3);
  scene.environmentIntensity = .42 * real + inStory * (.35 - dusk * .12);
  renderer.toneMappingExposure = 1 - dusk * .08;

  cameraAt(p);
  camE.setFromQuaternion(cam.quaternion);
  dust.userData.update(t); sparkle.userData.update(p);
  post.vig.uniforms.warm.value = .12 + dusk * .1;
  post.bloom.strength = .22 + seg(p, .08, .14) * (1 - seg(p, .18, .26)) * .15 + dusk * .1;
  post.dof.maxCoc = 14 * H / 1080;
  if (params.has("nopost")) renderer.render(scene, cam); else post.composer.render();

  // overlay: comic captions and speech bubbles
  OX.clearRect(0, 0, W, H);
  const s = clamp(Math.min(W / 1400, H / 800), .55, 1.6) * (MOBILE ? 1.15 : 1);
  for (const [name, key] of [['miggy', 'miggy'], ['kayiu', 'kayiu'], ['miggy2', 'miggy'], ['kayiu2', 'kayiu']]) {
    const pc = heads[name]; if (!pc || !pc.g.visible) continue;
    const h = pc.g.userData.h; tmp.set(0, h * .96, 0); pc.g.localToWorld(tmp);
    const sc = toScreen(tmp); if (sc) anchors[key] = sc;
  }
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
  drawCaptions(OX, p, W, H, s, top * DPR);
  drawBubbles(OX, p, W, H, s, anchors);
  document.getElementById('hint').style.opacity = p < .02 ? .85 : 0;
}

// ---------- scroll, resize, loop ----------
const bookEl = document.getElementById('book');
let target = 0, cur = 0;
function readScroll() { const r = bookEl.getBoundingClientRect(); target = clamp(-r.top / (r.height - innerHeight)); }
addEventListener('scroll', readScroll, { passive: true });
function resize() {
  const w = glCanvas.clientWidth, h = glCanvas.clientHeight;
  W = Math.round(w * DPR); H = Math.round(h * DPR);
  renderer.setSize(W, H, false); ov.width = W; ov.height = H;
  cam.aspect = w / h; cam.updateProjectionMatrix();
  resizePost(post, W, H);
}
addEventListener('resize', resize);
resize(); readScroll(); cur = target;
build().catch(e => { console.error(e); document.getElementById('loading').textContent = 'Something went wrong loading the book.'; });
renderer.setAnimationLoop(ms => {
  if (!book) return;
  cur = fixedP !== null ? fixedP : cur + (target - cur) * .12;
  frame(cur, ms / 1000);
});
