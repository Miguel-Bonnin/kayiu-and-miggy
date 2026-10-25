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
import { SPREADS as WORDS } from './story.js';

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

// ---------- timeline: where each spread sits in the scroll ----------
const OPEN_END = .035;
const LEN = [.13, .13, .13, .13, .13, .11, .205];
const START = []; { let a = OPEN_END; for (const l of LEN) { START.push(a); a += l; } }
const local = (p, k) => (p - START[k]) / LEN[k];
const G = (k, l) => START[k] + l * LEN[k];
const spreadAt = p => { let k = 0; while (k < 6 && p >= START[k + 1]) k++; return k; };

// ---------- the spreads ----------
// piece: { a: asset, w: width (m), x, z, lean?, win?: [rise, fold] (local), walk?, on?: [hostId, height fraction], sink?, head?: [[who, dx, dy]] }
const SP = [
  { sky: 'sky', ground: 'meadow', sun: ['#fff3e0', 2.6], pieces: [
    { a: 's1-backdrop-willows', w: .43, x: 0, z: .012 },
    { a: 's1-river', w: .43, x: 0, z: .07 },
    { a: 's1-swan-1', w: .055, x: -.12, z: .082, glide: .05 },
    { a: 's1-swan-2', w: .065, x: .03, z: .092, glide: -.04 },
    { a: 's1-swan-3', w: .058, x: .14, z: .086, glide: .035 },
    { a: 'pose-teens', w: .1, x: -.01, z: .17, head: [['miggy', -.2, .98], ['kayiu', .12, .9]] },
    { a: 's1-grass-ginkgo-branch', w: .44, x: 0, z: .275, lean: -1, sway: .004 },
  ], eye: [[.05, .115, .45, 0, .062, .15], [-.04, .118, .45, 0, .062, .15]] },
  { sky: 'santorini', ground: 'stone', sun: ['#fff0d6', 2.5], pieces: [
    { a: 's2-backdrop-sea', w: .43, x: 0, z: .012 },
    { a: 's2-far-houses', w: .28, x: .08, z: .05 },
    { a: 's2-mid-dome', w: .21, x: -.1, z: .11 },
    { a: 's2-near-path', w: .22, x: .12, z: .17 },
    { a: 'pose-santorini-side', w: .1, x: -.14, z: .235, walk: { l0: .2, l1: .76, x0: -.15, x1: .1 }, head: [['miggy', -.2, .98], ['kayiu', .2, .9]] },
  ], eye: [[-.12, .115, .5, -.1, .07, .19], [.11, .115, .5, .09, .07, .19]] },
  { sky: 'venice', ground: 'water', sun: ['#fff1e0', 2.4], pieces: [
    { a: 's3-backdrop-canal', w: .43, x: 0, z: .012 },
    { a: 's3-gondola', w: .12, x: .2, z: .12, path: [[.1, .26, .11], [.32, .12, .27], [.5, .03, .27], [.66, -.02, .17], [.82, -.26, .11]] },
    { a: 's3-bridge', w: .26, x: 0, z: .2, id: 'bridge' },
    { a: 'pose-venice-side', w: .07, x: 0, z: .19, on: ['bridge', .74], head: [['kayiu', -.2, .9], ['miggy', .22, .98]] },
    { a: 's3-near-arch-left', w: .14, x: -.17, z: .29 },
    { a: 's3-near-arch-right', w: .1, x: .18, z: .29 },
  ], eye: [[.06, .17, .55, 0, .12, .18], [-.05, .165, .53, 0, .115, .18]] },
  { sky: 'catbells', ground: 'fell', sun: ['#fff6e8', 2.7], pieces: [
    { a: 's4-backdrop-ridge', w: .43, x: 0, z: .012 },
    ...[[1, -.17, .07], [2, -.1, .12], [3, .12, .08], [4, .17, .14], [5, -.15, .17], [6, .08, .12], [7, -.04, .09], [8, .15, .2], [9, -.19, .23], [10, .02, .15], [11, .19, .25]]
      .map(([i, x, z]) => ({ a: `s4-hiker-${String(i).padStart(2, '0')}`, w: .032, x, z })),
    { a: 'char-miggy-catbells', w: .022, x: -.04, z: .205, id: 'miggycb', head: [['miggy', 0, .97]] },
    { a: 'char-kayiu-catbells', w: .035, x: .035, z: .205, head: [['kayiu', -.15, .97]] },
  ], eye: [[-.08, .11, .47, -.02, .065, .17], [.06, .1, .45, .01, .062, .19]] },
  { sky: 'golden', ground: 'lake', sun: ['#ffc27a', 2.2], pieces: [
    { a: 's5-backdrop-lake', w: .43, x: 0, z: .012 },
    { a: 's5-island', w: .2, x: .09, z: .07 },
    { a: 'pose-proposal', w: .11, x: -.02, z: .19, head: [['miggy', -.22, .72], ['kayiu', .28, .98]] },
    { a: 's5-shore', w: .3, x: 0, z: .28, lean: -1.0, sink: .32 },
  ], eye: [[.05, .13, .47, -.01, .065, .16], [-.04, .125, .45, 0, .062, .17]] },
  { sky: 'home', ground: 'floor', sun: ['#fff3e0', 2.3], pieces: [
    { a: 's6-calendar-2022', w: .1, x: -.06, z: .15, id: 'cal' },
    ...[2023, 2024, 2025, 2026].map((y, i) => ({ a: `s6-page-${y}`, w: .082, x: -.058, z: .155 + i * .002, on: ['cal', .1], win: [.18 + i * .1, i < 3 ? .28 + i * .1 : .84], dir: -1, fly: i < 3 })),
    { a: 'char-kayiu-wait', w: .046, x: .08, z: .14, sink: .1, head: [['kayiu', -.05, .97]] },
    { a: 'char-miggy-b-side', w: .055, x: -.13, z: .2, walk: { l0: .48, l1: .6, x0: -.34, x1: -.12 }, head: [['miggy', .05, .97]] },
  ], eye: [[.03, .11, .46, .01, .07, .16], [-.03, .11, .48, -.03, .07, .17]] },
  { sky: 'dusk', ground: 'lawn', sun: ['#ffae6b', 1.4], pieces: [
    { a: 's7-backdrop-dusk', w: .43, x: 0, z: .012 },
    { a: 's7-palm-house', w: .34, x: 0, z: .06, glow: true, win: [.04, 2] },
    { a: 's7-pond', w: .22, x: 0, z: .14, win: [.06, .52] },
    { a: 's7-lawn-path', prefer: 's7-lawn-path-plain', w: .36, x: 0, z: .245, win: [.08, .52] },
    { a: 's7-ginkgo-tree-left', opt: true, w: .12, x: -.175, z: .225, win: [.07, 2] },
    { a: 's7-ginkgo-tree-right', opt: true, w: .12, x: .175, z: .225, win: [.075, 2] },
    { a: 'pose-kew-back', w: .055, x: 0, z: .27, walk: { l0: .14, l1: .44, x0: .02, x1: 0, z0: .275, z1: .16, s0: 1, s1: .72, climb: [.2, .05] }, win: [.1, .5] },
    { sign: true, w: .21, x: 0, z: .19, win: [.6, 2], border: 12, grow: true },
    { a: 'char-miggy-b-front', w: .038, x: -.135, z: .215, win: [.64, 2], head: [['miggy', 0, .97]] },
    { a: 'char-kayiu-b-front', w: .04, x: .13, z: .215, win: [.65, 2], head: [['kayiu', 0, .97]] },
  ] },
];

// captions and bubbles in global scroll terms, for the overlay
const CAPTIONS = WORDS.map((s, k) => [G(k, .06), G(k, k === 6 ? 1.05 : .84), s.caption]);
const BUBBLES = WORDS.flatMap((s, k) => s.bubbles.map(([who, a, b, t, style]) => [who, G(k, a), G(k, b), t, style]));

// ---------- room ----------
const tl = new THREE.TextureLoader(), gl = new GLTFLoader();
const img = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });
const lampGlow = [];

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
  lamp.traverse(o => { if (o.isMesh && o.material.name.includes('light')) { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#ffd9a0'); o.material.emissiveIntensity = 6; lampGlow.push(o.material); } });
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
const signLight = new THREE.PointLight('#ffd49a', 0, .5, 1.6); signLight.position.set(0, PG + .1, .32); scene.add(signLight);

// ---------- page art (watercolour washes on paper) ----------
const PW = MOBILE ? 1024 : 1280, PH = Math.round(PW * BD / BW);
function wash(x, col, cx, cy, rx, ry, a, seed) {
  const R = mulberry(seed);
  for (let i = 0; i < 26; i++) {
    const px = cx + (R() - .5) * rx * 1.6, py = cy + (R() - .5) * ry * 1.6, r = (rx + ry) * (.18 + R() * .3);
    const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, col.replace('A', (a * (.5 + R() * .5)).toFixed(3))); g.addColorStop(1, col.replace('A', '0'));
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
}
const grad = (x, stops) => { const g = x.createLinearGradient(0, 0, 0, PH); stops.forEach(([o, c]) => g.addColorStop(o, c)); x.fillStyle = g; x.fillRect(PW * .02, PW * .02, PW * .96, PH - PW * .04); };
const PAGES = {
  sky: x => { grad(x, [[0, 'rgba(70,140,215,.95)'], [.65, 'rgba(140,195,235,.75)'], [1, 'rgba(225,235,230,.3)']]); for (let i = 0; i < 9; i++) wash(x, 'rgba(255,255,255,A)', PW * (.1 + i * .1), PH * (.12 + (i % 3) * .07), PW * .06, PH * .025, .5, i + 3); },
  santorini: x => { grad(x, [[0, 'rgba(40,110,200,.95)'], [.7, 'rgba(110,175,230,.8)'], [1, 'rgba(250,210,150,.55)']]); wash(x, 'rgba(255,220,150,A)', PW * .8, PH * .75, PW * .12, PH * .1, .35, 5); },
  venice: x => { grad(x, [[0, 'rgba(150,190,225,.9)'], [.6, 'rgba(240,205,190,.75)'], [1, 'rgba(250,225,200,.5)']]); for (let i = 0; i < 6; i++) wash(x, 'rgba(255,255,255,A)', PW * (.15 + i * .14), PH * .2, PW * .07, PH * .03, .45, i + 9); },
  catbells: x => { grad(x, [[0, 'rgba(50,130,215,.95)'], [.6, 'rgba(120,185,235,.8)'], [1, 'rgba(215,232,240,.4)']]); for (let i = 0; i < 7; i++) wash(x, 'rgba(255,255,255,A)', PW * (.12 + i * .12), PH * (.15 + (i % 2) * .08), PW * .07, PH * .03, .55, i + 20); },
  golden: x => { grad(x, [[0, 'rgba(120,150,210,.75)'], [.5, 'rgba(250,190,140,.85)'], [1, 'rgba(255,215,150,.75)']]); wash(x, 'rgba(255,240,180,A)', PW * .65, PH * .6, PW * .15, PH * .12, .5, 31); },
  home: x => { grad(x, [[0, 'rgba(242,222,190,.9)'], [1, 'rgba(236,210,175,.9)']]); x.fillStyle = 'rgba(190,150,110,.18)'; for (let i = 0; i < PW; i += PW / 24) x.fillRect(i, PW * .02, PW / 80, PH - PW * .04); },
  dusk: x => { grad(x, [[0, 'rgba(48,40,98,.92)'], [.55, 'rgba(150,92,140,.75)'], [1, 'rgba(250,170,110,.7)']]); const R = mulberry(5); x.fillStyle = 'rgba(255,248,220,.9)'; for (let i = 0; i < 60; i++) { x.beginPath(); x.arc(PW * .03 + R() * PW * .94, PW * .03 + R() * PH * .45, 1 + R() * 2.5, 0, TAU); x.fill(); } },
  meadow: x => { grad(x, [[0, 'rgba(96,150,72,.6)'], [1, 'rgba(132,180,88,.8)']]); wash(x, 'rgba(70,120,50,A)', PW * .5, PH * .6, PW * .4, PH * .3, .18, 11); },
  stone: x => { grad(x, [[0, 'rgba(235,232,225,.7)'], [1, 'rgba(220,215,205,.8)']]); wash(x, 'rgba(60,110,190,A)', PW * .5, PH * .2, PW * .4, PH * .15, .2, 12); },
  water: x => { grad(x, [[0, 'rgba(70,160,170,.7)'], [1, 'rgba(90,175,180,.8)']]); for (let i = 0; i < 40; i++) wash(x, 'rgba(255,255,255,A)', PW * mulberry(i + 1)(), PH * mulberry(i + 99)(), PW * .04, PH * .006, .4, i); },
  fell: x => { grad(x, [[0, 'rgba(130,150,80,.65)'], [1, 'rgba(160,160,100,.8)']]); wash(x, 'rgba(120,110,100,A)', PW * .4, PH * .5, PW * .3, PH * .2, .2, 14); },
  lake: x => { grad(x, [[0, 'rgba(70,120,170,.7)'], [1, 'rgba(200,170,110,.7)']]); wash(x, 'rgba(255,220,150,A)', PW * .55, PH * .4, PW * .3, PH * .1, .3, 15); },
  floor: x => { grad(x, [[0, 'rgba(170,120,80,.7)'], [1, 'rgba(150,100,62,.8)']]); x.fillStyle = 'rgba(90,55,30,.25)'; for (let i = 0; i < PH; i += PH / 9) x.fillRect(PW * .02, i, PW * .96, 2); },
  lawn: x => { grad(x, [[0, 'rgba(40,78,52,.8)'], [1, 'rgba(60,104,62,.85)']]); wash(x, 'rgba(255,190,110,A)', PW * .5, PH * .45, PW * .3, PH * .2, .12, 21); },
};
const pageCache = {};
function page(kind) {
  if (pageCache[kind]) return pageCache[kind];
  const c = cv(PW, PH), x = c.getContext('2d');
  paperFill(x, PW, PH, '#f5ecd9', kind.length * 7, .05);
  PAGES[kind](x);
  x.save(); x.globalAlpha = .7; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, PW, PH); x.restore();
  return (pageCache[kind] = texOf(c));
}

// The save-the-date, lettered on a big golden ginkgo leaf (Kayiu's idea)
let LEAF_IMG = null, GOLD_LEAF = null;
function signCanvas() {
  const src = GOLD_LEAF || LEAF_IMG, Wc = 1600, Hc = Math.round(Wc * src.height / src.width);
  const c = cv(Wc, Hc), x = c.getContext('2d');
  x.drawImage(src, 0, 0, Wc, Hc);
  if (!GOLD_LEAF) {   // recolour the green leaf to autumn gold until the gold art arrives
    x.globalCompositeOperation = 'color'; x.fillStyle = '#d9a21e'; x.fillRect(0, 0, Wc, Hc);
    x.globalCompositeOperation = 'soft-light'; x.fillStyle = 'rgba(255,236,170,.5)'; x.fillRect(0, 0, Wc, Hc);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(src, 0, 0, Wc, Hc);
    x.globalCompositeOperation = 'source-over';
  }
  // a soft light patch behind the words so they read on the veins
  const g = x.createRadialGradient(Wc / 2, Hc * .42, 0, Wc / 2, Hc * .42, Wc * .38);
  g.addColorStop(0, 'rgba(255,246,214,.55)'); g.addColorStop(1, 'rgba(255,246,214,0)');
  x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = g; x.fillRect(0, 0, Wc, Hc); x.restore();
  x.textAlign = 'center'; x.fillStyle = '#4a2a14'; x.shadowColor = 'rgba(255,240,200,.8)'; x.shadowBlur = 10;
  const line = (font, text, y) => { x.font = font; x.fillText(text, Wc / 2, Hc * y); };
  line('italic 64px "IM Fell English"', 'Save the date', .2);
  line('500 150px "Cormorant Garamond"', 'Miggy & Kayiu', .34);
  line('600 74px "Cormorant Garamond"', 'Monday 15 May 2028', .46);
  line('500 64px "Cormorant Garamond"', 'Kew Gardens', .55);
  line('italic 48px "IM Fell English"', 'eighteen years to the day', .64);
  return c;
}

// ---------- building cards ----------
let book, leaf;
const pieces = [];   // built pieces across all spreads
const byId = {};

function cardFrom(source, width, o = {}) {
  const scale = MOBILE && source.width > 700 ? .7 : 1;
  const border = Math.round((o.border ?? Math.max(8, Math.round(Math.max(source.width, source.height) * .012))) * scale), pad = border + 8;
  const sw = Math.round(source.width * scale), sh = Math.round(source.height * scale);
  const padded = cv(sw + pad * 2, sh + pad * 2); padded.getContext('2d').drawImage(source, pad, pad, sw, sh);
  const art = finishCut(padded, border);
  return cutMesh({ c: art, w: width, h: width * art.height / art.width, ax: .5, ay: 1 });   // ay = 1: anchored at the bottom edge
}

function buildSpread(k, images) {
  const specs = SP[k].pieces, sorted = [...specs].sort((a, b) => a.z - b.z);
  for (const spec of specs) {
    const src = spec.sign ? signCanvas() : (spec.prefer && images[spec.prefer]) || images[spec.a];
    if (!src) continue;
    const g = cardFrom(src, spec.w, spec);
    g.position.set(spec.x, 0, spec.z); g.visible = false; book.stage.add(g);
    const order = sorted.indexOf(spec);
    const rise = spec.win ? spec.win[0] : .015 + order * .012;
    const fold = spec.win ? spec.win[1] : .8 + (.3 - spec.z) * .12;
    const pc = { ...spec, g, k, rise, fold, dir: spec.dir ?? (spec.z > .15 ? -1 : 1), baseY: 0 };
    if (spec.glow) {
      const m = g.userData.front.material = g.userData.front.material.clone();
      m.emissiveMap = m.map; m.emissive = new THREE.Color('#ffd28a'); m.emissiveIntensity = 0; pc.glowMat = m;
    }
    if (spec.id) byId[spec.id] = pc;
    pieces.push(pc);
  }
  for (const pc of pieces) if (pc.k === k && pc.on) { const host = byId[pc.on[0]]; if (host) pc.baseY = host.g.userData.h * pc.on[1]; }
  for (const pc of pieces) if (pc.k === k && pc.sink) pc.baseY = -pc.g.userData.h * pc.sink;
}

const assetsOf = k => [...new Set(SP[k].pieces.flatMap(s => [s.a, s.prefer]).filter(Boolean))];
// missing files are skipped (art that hasn't been made yet), not fatal
const loadImages = async names => Object.fromEntries(await Promise.all(names.map(async n => [n, await img(`assets/art/${n}.webp`).catch(() => null)])));

async function build() {
  await Promise.all(['500 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', 'italic 40px "IM Fell English"', '40px "Patrick Hand"'].map(f => document.fonts.load(f))).catch(() => {});
  const [im] = await Promise.all([loadImages([...assetsOf(0), 'leaf-green']), room()]);
  book = makeBook(coverCanvases(im['leaf-green']));
  scene.add(book.root);
  book.backMat.color.setScalar(.62); book.groundMat.color.setScalar(.9);   // the standing page faces the sun; keep its sky from blowing out
  LEAF_IMG = im['leaf-green'];
  buildSpread(0, im);
  makeFalling(im['leaf-green']);
  leaf = cardFrom(im['leaf-green'], .032, { border: 10 });
  leaf.userData.front.material = leaf.userData.front.material.clone(); leaf.userData.front.material.side = THREE.DoubleSide;
  leaf.userData.back.visible = false;
  scene.add(leaf);
  document.getElementById('loading').classList.add('done');
  window.__ready = true;
  // the rest of the book loads in the background, one spread at a time
  for (let k = 1; k < SP.length; k++) {
    if (k === 6) GOLD_LEAF = await img('assets/art/leaf-gold-hero.webp').catch(() => null);
    buildSpread(k, await loadImages(assetsOf(k)));
  }
  window.__all = true;
}

// ---------- particles (from the demo): lamp-beam dust and sparkles ----------
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
const sparkle = particles(quad, addMat(starTex, new THREE.Color(2.4, 1.9, .9)), 90, (i, p) => {   // when the book opens, and when the save-the-date rises
  const R = mulberry(i * 13 + 5), first = i < 50, p0 = first ? .012 + R() * .03 : G(6, .6) + R() * .03, life = first ? .012 + R() * .012 : .02 + R() * .02, k = (p - p0) / life;
  if (k < 0 || k > 1) return null;
  return { x: lerp(-.2, .2, R()) + Math.sin(k * 6 + i) * .01, y: PG + k * (.08 + R() * .1), z: lerp(.02, .28, R()), s: .006 * Math.sin(k * Math.PI) * (.5 + R()), rx: camE.x, ry: camE.y, rz: camE.z + p * 40 + i };
});
scene.add(sparkle);

// ---------- camera: [p, px,py,pz, tx,ty,tz, fov, aperture, portrait pull-back] ----------
const HIGH = [0, .40, .64, 0, .05, .14, 30, 2.8, 2.1], MID = [0, .25, .6, 0, .07, .13, 30, 2.6, 2.0];
const SHOTS = [
  [0.000, .22, .42, .95, 0, .02, .15, 32, 3.0, 1.6],
  [0.012, .14, .40, .82, 0, .03, .14, 30, 3.0, 1.7],
  [OPEN_END, .02, .34, .68, 0, .06, .13, 30, 2.8, 2.1],
];
for (let k = 0; k < 6; k++) {
  const [A, B] = SP[k].eye;
  if (k > 0) SHOTS.push([G(k, .02), ...HIGH]);
  SHOTS.push([G(k, .12), ...MID], [G(k, .24), ...A, 30, 2.2, 1.6], [G(k, .74), ...B, 30, 2.2, 1.6], [G(k, .84), ...HIGH]);
}
SHOTS.push([G(6, .02), ...HIGH], [G(6, .12), ...MID], [G(6, .3), 0, .12, .5, 0, .08, .12, 30, 2.4, 1.8], [G(6, .5), 0, .2, .62, 0, .08, .12, 30, 2.6, 2.0],
  [G(6, .66), 0, .2, .72, 0, .09, .17, 30, 2.6, 1.9], [1.0, 0, .18, .68, 0, .09, .17, 30, 2.6, 1.9]);
const shot = track(SHOTS.map(k => [k[0], k.slice(1)]));
function cameraAt(p) {
  const v = shot(p), pos = new THREE.Vector3(v[0], v[1], v[2]), tgt = new THREE.Vector3(v[3], v[4], v[5]);
  const a = cam.aspect, pull = a < 1 ? lerp(v[8], 1, clamp((a - .45) / .55)) : 1;
  pos.sub(tgt).multiplyScalar(pull).add(tgt);
  cam.position.copy(pos); cam.fov = a < 1 ? v[6] + 10 : v[6]; cam.lookAt(tgt); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  post.dof.focus = pos.distanceTo(tgt); post.dof.aper = v[7] * (a < 1 ? .7 : 1);
}

// ---------- the leaf's journey: one thread through every page ----------
const hostPos = new THREE.Vector3();
function hostOf(k) { return pieces.find(pc => pc.k === k && pc.head && pc.g.visible); }
function leafAt(p, t) {
  const k = spreadAt(p), l = local(p, k);
  let pos = null, flat = 0, wob = 1, vis = true;
  const enter = ss(seg(l, .03, .16)), exit = ss(seg(l, .8, .88));
  const follow = () => {   // flutter just above and beside whoever is on the page
    const h = hostOf(k); if (!h) return null;
    h.g.getWorldPosition(hostPos);
    const sc = h.g.scale.x, v = hostPos.clone().add(new THREE.Vector3(h.g.userData.w * .55 * sc, h.g.userData.h * 1.08 * sc, .015));
    v.x += Math.sin(t * .9 + l * 12) * .018; v.y += Math.sin(t * 1.3 + l * 17) * .01; v.z += Math.cos(t * .7 + l * 9) * .012;
    return v;
  };
  const inOut = v => {   // blow in from the left, blow out to the right before the page turns
    if (!v) return null;
    v.lerpVectors(new THREE.Vector3(-.32, .28, .32), v, enter);
    return v.lerp(new THREE.Vector3(.36, .3, .3), exit);
  };
  if (k === 0) {               // Staines: lifts off the cover, then settles in beside the two of you
    const rest = new THREE.Vector3(0, BD * .73, -.0185); book.open.localToWorld(rest);
    const lift = seg(p, .005, G(0, .12)), f = follow() || new THREE.Vector3(-.06, .15, .2);
    pos = rest.clone().lerp(f, ss(lift)).lerp(new THREE.Vector3(.36, .3, .3), exit);
    flat = 1 - lift; wob = lift; vis = exit < 1;
  } else if (k === 4) {        // Derwentwater: drifts down and settles on the water by the proposal, then lifts away
    const fall = seg(l, .06, .42);
    pos = new THREE.Vector3(lerp(-.35, .07, ss(fall)), lerp(.3, PG + .003, ss(fall)) + Math.sin(fall * 12) * .012 * (1 - fall), lerp(.3, .13, ss(fall)));
    pos.lerp(new THREE.Vector3(.36, .3, .3), exit);
    flat = ss(seg(l, .32, .42)) * (1 - exit); wob = 1 - flat; vis = l > .06 && exit < 1;
  } else if (k === 6) {        // Kew: follows you up the path and in through the door, then falls with the others and becomes the save-the-date
    const intoDoor = ss(seg(l, .32, .44)), fall = seg(l, .5, .61);
    pos = inOut(follow()) || new THREE.Vector3(0, .12, .15);
    pos.lerp(new THREE.Vector3(0, .085, .07), intoDoor);
    if (fall > 0) { pos = new THREE.Vector3(Math.sin(fall * 10) * .04 * (1 - fall), lerp(.32, .12, ss(fall)), lerp(.25, .19, fall)); wob = 2 * (1 - fall); }
    vis = (l > .03 && l < .44) || (fall > 0 && fall < 1);
    const gold = seg(l, .2, .45), lm = leaf.userData.front.material; lm.color.setRGB(1, lerp(1, .82, gold), lerp(1, .45, gold));
    if (!lm.emissiveMap) { lm.emissiveMap = lm.map; lm.emissive.set('#ffcf70'); lm.needsUpdate = true; }
    lm.emissiveIntensity = fall > 0 ? .8 * fall : 0;
    leaf.scale.setScalar(1 + ss(seg(fall, .7, 1)) * 3);
  } else {                     // Santorini, Venice, Catbells, the long engagement: just there, always
    pos = inOut(follow()); vis = !!pos && l > .03 && exit < 1;
  }
  if (k !== 6) { leaf.scale.setScalar(1); leaf.userData.front.material.emissiveIntensity = 0; leaf.userData.front.material.color.setRGB(1, lerp(1, .9, k / 6), lerp(1, .75, k / 6)); }
  leaf.visible = vis && !!pos; if (!leaf.visible) return;
  leaf.position.copy(pos);
  leaf.rotation.set(-Math.PI / 2 * flat + Math.sin(p * 220) * .6 * wob, p * 80 * wob, Math.sin(p * 170) * .5 * wob);
}

// ---------- falling ginkgo leaves at Kew ----------
let falling = null;
function makeFalling(leafImg) {
  const c = cv(128, Math.round(128 * leafImg.height / leafImg.width)), x = c.getContext('2d');
  x.drawImage(leafImg, 0, 0, c.width, c.height); x.globalCompositeOperation = 'color'; x.fillStyle = '#e0a82a'; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(leafImg, 0, 0, c.width, c.height);
  const tx = texOf(c), mat = new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: new THREE.Color('#ffcf70'), emissiveIntensity: .45, alphaTest: .5, side: THREE.DoubleSide, roughness: .8 });
  falling = particles(new THREE.PlaneGeometry(1, c.height / c.width), mat, MOBILE ? 24 : 48, (i, p) => {
    const l = local(p, 6), R = mulberry(i * 31 + 7), l0 = .46 + R() * .26, life = .14 + R() * .1, f = (l - l0) / life;
    if (f < 0 || f > 1) return null;
    const side = R() < .5 ? -1 : 1, x0 = side * (.15 + R() * .05);
    return { x: x0 + Math.sin(f * 8 + i) * .03 - side * f * .06, y: lerp(.21 + R() * .05, PG + .002, f), z: .2 + (R() - .5) * .08 + Math.cos(f * 6 + i) * .015,
      rx: f * 9 + i, ry: f * 5, rz: Math.sin(f * 7 + i), s: .014 + R() * .008 };
  });
  scene.add(falling);
}

// ---------- the story ----------
const tmp = new THREE.Vector3(), anchors = {};
const toScreen = v => { const q = v.clone().project(cam); if (q.z > 1) return null; return [(q.x * .5 + .5) * W, (-q.y * .5 + .5) * H]; };
const col = new THREE.Color(), col2 = new THREE.Color();

function frame(p, t) {
  const k = spreadAt(p), l = local(p, k);

  // the book opens: the cover swings up and becomes the backdrop
  const op = eio(seg(p, .003, OPEN_END - .004));
  book.setOpen(Math.PI / 2 * op + Math.sin(seg(p, OPEN_END - .008, OPEN_END + .006) * Math.PI) * -.03);

  // page turn at the end of each spread: old ground on the front, next sky on the back
  const u = k < 6 ? seg(l, .88, 1) : 0, nk = Math.min(k + 1, 6);
  book.leafFront.material.map = page(SP[k].ground); book.leafBack.material.map = page(SP[nk].sky);
  if (u > 0 && u < 1) { book.groundMat.map = page(SP[nk].ground); book.backMat.map = page(SP[k].sky); book.setLeaf(eio(u)); }
  else { book.setLeaf(0); book.groundMat.map = page(SP[k].ground); book.backMat.map = page(SP[k].sky); }

  // pop-ups: rise with overshoot, fold in the reverse order
  for (const pc of pieces) {
    const lk = local(p, pc.k);
    if (lk < -.05 || lk > 1.05) { pc.g.visible = false; continue; }
    const up = back(seg(lk, pc.rise, pc.rise + .06), 1.7), dn = pc.fly ? (lk > pc.fold + .08 ? 0 : 1) : 1 - ss(seg(lk, pc.fold, pc.fold + .045));
    const kk = Math.min(up, dn);
    pc.g.visible = kk > .002; if (!pc.g.visible) continue;
    pc.g.rotation.x = pc.dir * (Math.PI / 2) * (1 - kk) + (pc.lean || 0) * clamp(kk) * .8;
    if (pc.grow) { const gk = back(seg(lk, pc.rise, pc.rise + .07), 1.4); pc.g.visible = gk > .01; pc.g.rotation.x = 0; pc.g.rotation.y = (1 - clamp(gk)) * Math.PI * 3; pc.g.scale.setScalar(Math.max(gk, .01)); }
    pc.g.position.y = pc.baseY;
    if (pc.sway) pc.g.rotation.z = Math.sin(t * 1.6 + pc.x * 40) * pc.sway * kk;
    if (pc.glide) pc.g.position.x = pc.x + pc.glide * Math.sin(lk * 9 + pc.x * 20) + Math.sin(t * .8 + pc.x * 30) * .002;
    if (pc.walk) {
      const w = pc.walk, s = ss(seg(lk, w.l0, w.l1));
      pc.g.position.x = lerp(w.x0, w.x1, s);
      if (w.z0 !== undefined) pc.g.position.z = lerp(w.z0, w.z1, s);
      if (w.s0 !== undefined) pc.g.scale.setScalar(lerp(w.s0, w.s1, s));
      if (s > 0 && s < 1) pc.g.position.y += Math.abs(Math.sin(lk * 140)) * .0025;
      if (w.climb) pc.g.position.y += w.climb[1] * Math.sin(Math.PI * clamp((s - w.climb[0] + .17) / .34));   // up over the front card, down behind it
    }
    if (pc.path) {
      if (!pc.track) pc.track = track(pc.path.map(([a, x, z]) => [a, [x, z]]));
      const [x, z] = pc.track(lk); pc.g.position.x = x; pc.g.position.z = z;
      pc.g.position.y += Math.sin(t * 1.4 + pc.x) * .0012;
    }
    if (pc.fly) {   // calendar pages tear off and fly away instead of folding
      const f = seg(lk, pc.fold, pc.fold + .08);
      if (f > 0) { pc.g.visible = f < 1; pc.g.rotation.x = 0; pc.g.position.x = pc.x + f * .25; pc.g.position.y = pc.baseY + f * .2 + Math.sin(f * 9) * .01; pc.g.rotation.z = -f * 2.5; pc.g.position.z = pc.z + f * .08; }
    }
    if (pc.glowMat) pc.glowMat.emissiveIntensity = .55 * seg(lk, .1, .25) * (1 - seg(lk, .46, .52));
  }
  leafAt(p, t);
  if (falling) falling.userData.update(p);

  // light: the desk lamp in the room; a paper sun in the story with its own colour per spread; lights out at Kew
  const inStory = seg(p, .004, OPEN_END), real = 1 - inStory;
  const [c0, i0] = SP[k].sun, [c1, i1] = SP[nk].sun;
  col.set(c0).lerp(col2.set(c1), u);
  const out = k === 6 ? seg(l, .46, .54) : 0, signOn = k === 6 ? seg(l, .56, .7) : 0;
  sun.color.copy(col); sun.intensity = inStory * lerp(i0, i1, u) * (1 - out * .92);
  spot.intensity = (real * 1.0 + inStory * .12) * (1 - out * .7) + signOn * .22; bulb.intensity = spot.intensity * .6;
  lampGlow.forEach(m => { m.emissiveIntensity = 6 * (1 - out * .8) + signOn * 1.5; });
  hemi.intensity = (.15 + inStory * .5) * (1 - out * .75) + signOn * .05;
  scene.environmentIntensity = (.42 * real + inStory * .33) * (1 - out * .7) + signOn * .03;
  signLight.intensity = signOn * .06;
  renderer.toneMappingExposure = 1 - out * .12;

  cameraAt(p);
  camE.setFromQuaternion(cam.quaternion);
  dust.userData.update(t); sparkle.userData.update(p);
  post.vig.uniforms.warm.value = .12 + (k === 6 ? .12 : k === 4 ? .08 : 0);
  post.vig.uniforms.amt.value = .35 + out * .25;
  post.bloom.strength = .22 + seg(p, .005, .02) * (1 - seg(p, .03, .05)) * .15 + (k === 6 ? .06 : 0);
  post.dof.maxCoc = 14 * H / 1080;
  if (params.has('nopost')) renderer.render(scene, cam); else post.composer.render();

  // overlay: comic captions and speech bubbles
  OX.clearRect(0, 0, W, H);
  const s = clamp(Math.min(W / 1400, H / 800), .55, 1.6) * (MOBILE ? 1.15 : 1);
  for (const key in anchors) delete anchors[key];
  for (const pc of pieces) {
    if (!pc.head || !pc.g.visible || pc.k !== k) continue;
    for (const [who, dx, dy] of pc.head) {
      tmp.set(dx * pc.g.userData.w, pc.g.userData.h * dy, 0); pc.g.localToWorld(tmp);
      const sc = toScreen(tmp); if (sc) anchors[who] = sc;
    }
  }
  drawCaptions(OX, p, W, H, s, 0, CAPTIONS);
  drawBubbles(OX, p, W, H, s, anchors, BUBBLES);
  document.getElementById('hint').style.opacity = p < .004 ? .85 : 0;
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
window.__dbg = { scene, pieces, START, LEN };
