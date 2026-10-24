// Miggy & Kayiu: a scroll-driven pop-up book.
// Everything on screen is a pure function of p (0 to 1, scroll progress), so scrolling scrubs the story.
import * as THREE from 'three';

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (p, a, b) => clamp((p - a) / (b - a));            // 0..1 across [a, b]
const ease = k => k * k * (3 - 2 * k);
const back = k => { const s = 1.6; k -= 1; return k * k * ((s + 1) * k + s) + 1; };  // overshoot for pop-ups
const TAU = Math.PI * 2;
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }
function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }

// ---------- WebGL check ----------
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  document.body.classList.add('nogl');
  document.getElementById('fallback').hidden = false;
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20);

// ---------- paper ----------
const GRAIN = (() => {
  const n = 256, c = cv(n, n), x = c.getContext('2d'), R = rng(7), img = x.createImageData(n, n), d = img.data;
  for (let i = 0; i < n * n; i++) { const v = R(); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v < .5 ? 0 : 255; d[i * 4 + 3] = Math.abs(v - .5) * 30; }
  x.putImageData(img, 0, 0);
  return c;
})();

// White paper border + grey card edge around a cut-out. Adapted from lemo-opuscar paper.js finishCut (MIT, LemoLab).
function finishCut(img, rel = .012) {
  const border = Math.round(Math.max(img.width, img.height) * rel) + 3, pad = border + 6;
  const w = img.width + pad * 2, h = img.height + pad * 2;
  const art = cv(w, h); art.getContext('2d').drawImage(img, pad, pad);
  const out = cv(w, h), x = out.getContext('2d');
  const dil = (r, col) => {
    const c = cv(w, h), y = c.getContext('2d'), n = Math.max(16, Math.round(r * 1.2));
    for (const rr of [r, r * .66, r * .33]) for (let i = 0; i < n; i++) { const a = i / n * TAU; y.drawImage(art, Math.cos(a) * rr, Math.sin(a) * rr); }
    y.globalCompositeOperation = 'source-in'; y.fillStyle = col; y.fillRect(0, 0, w, h); return c;
  };
  x.drawImage(dil(border + 2.5, '#b9ad9c'), 0, 2);
  x.drawImage(dil(border, '#fffdf7'), 0, 0);
  x.drawImage(art, 0, 0);
  x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = .8;
  x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, w, h); x.restore();
  return out;
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// A cut-out card standing on its bottom edge. Front = art, back = plain paper, shadow = the cut-out silhouette.
function card(canvasArt, width) {
  const t = tex(canvasArt), h = width * canvasArt.height / canvasArt.width;
  const g = new THREE.PlaneGeometry(width, h); g.translate(0, h / 2, 0);
  const front = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, roughness: .9, side: THREE.FrontSide }));
  const backMat = new THREE.MeshStandardMaterial({ map: t, alphaTest: .5, roughness: .95, side: THREE.BackSide, color: 0xffffff });
  backMat.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = vec3(.93, .9, .84);'); };
  const backM = new THREE.Mesh(g, backMat);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: .5, side: THREE.DoubleSide });
  for (const m of [front, backM]) { m.castShadow = true; m.receiveShadow = true; m.customDepthMaterial = depth; }
  const pivot = new THREE.Group(); pivot.add(front, backM);
  pivot.userData.h = h;
  return pivot;
}

// ---------- room: walnut desk + warm blurred background ----------
function walnut() {
  const c = cv(1024, 1024), x = c.getContext('2d'), R = rng(3);
  x.fillStyle = '#6b3e1e'; x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) {
    const y0 = R() * 1024, amp = 4 + R() * 18, f = .002 + R() * .006, ph = R() * TAU;
    x.strokeStyle = `rgba(${R() < .5 ? '40,20,8' : '140,85,45'},${.05 + R() * .12})`; x.lineWidth = .6 + R() * 3;
    x.beginPath(); for (let X = 0; X <= 1024; X += 8) x.lineTo(X, y0 + Math.sin(X * f + ph) * amp + Math.sin(X * f * 3.1) * amp * .3); x.stroke();
  }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2);
  return t;
}
const desk = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ map: walnut(), roughness: .55, metalness: 0 }));
desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

const bgCanvas = cv(512, 512); {
  const x = bgCanvas.getContext('2d'), g = x.createRadialGradient(256, 180, 20, 256, 256, 420);
  g.addColorStop(0, '#d9b98a'); g.addColorStop(.45, '#8a5a34'); g.addColorStop(1, '#2a1a10');
  x.fillStyle = g; x.fillRect(0, 0, 512, 512);
}
scene.background = tex(bgCanvas);
scene.fog = new THREE.Fog(0x4a2e1a, 1.4, 4.5);

const hemi = new THREE.HemisphereLight(0xfff1dc, 0x5a3a22, .9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
sun.position.set(-.9, 1.6, 1.0); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -.5, right: .5, top: .5, bottom: -.5, near: .1, far: 4 });
sun.shadow.bias = -.0004; sun.shadow.normalBias = .002; sun.shadow.radius = 4;
scene.add(sun);

// ---------- the book ----------
const BW = .44, BD = .30, BT = .004, HB = .014, PG = BT + HB;  // page width, depth, board thickness, half page block, page height

function cloth() {
  const c = cv(1024, 700), x = c.getContext('2d'), R = rng(11);
  x.fillStyle = '#2f4a3a'; x.fillRect(0, 0, 1024, 700);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${R() < .5 ? '0,0,0' : '255,255,255'},${R() * .05})`; x.fillRect(R() * 1024, R() * 700, 1 + R() * 3, 1); }
  x.strokeStyle = '#c9a25a'; x.lineWidth = 4; x.strokeRect(40, 40, 944, 620);
  x.lineWidth = 1.5; x.strokeRect(54, 54, 916, 592);
  x.fillStyle = '#d8b46a'; x.textAlign = 'center';
  x.font = '500 96px "Cormorant Garamond", Georgia, serif'; x.fillText('Miggy & Kayiu', 512, 300);
  x.font = 'italic 40px "IM Fell English", Georgia, serif'; x.fillText('a story in pages', 512, 372);
  x.font = '500 30px "Cormorant Garamond", Georgia, serif'; x.fillText('15 · V · 2010', 512, 590);
  return tex(c);
}
function paperPage(sky) {
  const c = cv(1024, 700), x = c.getContext('2d'), R = rng(sky ? 5 : 9);
  x.fillStyle = '#f6efe2'; x.fillRect(0, 0, 1024, 700);
  if (sky) {
    const g = x.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, 'rgba(120,175,220,.75)'); g.addColorStop(.75, 'rgba(190,220,240,.45)'); g.addColorStop(1, 'rgba(246,239,226,0)');
    x.fillStyle = g; x.fillRect(30, 30, 964, 640);
    for (let i = 0; i < 7; i++) { x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(120 + R() * 800, 120 + R() * 200, 60 + R() * 70, 18 + R() * 14, 0, 0, TAU); x.fill(); }
  } else {
    const g = x.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, 'rgba(110,160,80,.55)'); g.addColorStop(1, 'rgba(140,185,95,.75)');
    x.fillStyle = g; x.fillRect(24, 24, 976, 652);
  }
  x.save(); x.globalAlpha = .9; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.fillRect(0, 0, 1024, 700); x.restore();
  return tex(c);
}

const book = new THREE.Group(); scene.add(book);
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xeee6d6, roughness: .9 });
const boardMat = new THREE.MeshStandardMaterial({ color: 0x2b4335, roughness: .8 });
// lower board + page block, with the ground page on top
const lower = new THREE.Mesh(new THREE.BoxGeometry(BW + .01, BT, BD + .006), boardMat); lower.position.set(0, BT / 2, BD / 2); lower.castShadow = lower.receiveShadow = true; book.add(lower);
const block = new THREE.Mesh(new THREE.BoxGeometry(BW - .004, HB, BD - .004), edgeMat); block.position.set(0, BT + HB / 2, BD / 2); block.receiveShadow = block.castShadow = true; book.add(block);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(BW - .006, BD - .006), new THREE.MeshStandardMaterial({ map: paperPage(false), roughness: .95 }));
ground.rotation.x = -Math.PI / 2; ground.position.set(0, PG + .0004, BD / 2); ground.receiveShadow = true; book.add(ground);

// upper board: closed it lies over the ground page; open it stands up at the spine as the backdrop
const hinge = new THREE.Group(); hinge.position.set(0, PG, 0); book.add(hinge);
const coverTex = cloth(), skyTex = paperPage(true);
const upperBlock = new THREE.Mesh(new THREE.BoxGeometry(BW - .004, HB, BD - .004), edgeMat);
upperBlock.position.set(0, HB / 2, BD / 2); upperBlock.castShadow = upperBlock.receiveShadow = true; hinge.add(upperBlock);
const coverBoard = new THREE.Mesh(new THREE.BoxGeometry(BW + .01, BT, BD + .006), boardMat);
coverBoard.position.set(0, HB + BT / 2, BD / 2); coverBoard.castShadow = coverBoard.receiveShadow = true; hinge.add(coverBoard);
const coverFace = new THREE.Mesh(new THREE.PlaneGeometry(BW + .006, BD + .002), new THREE.MeshStandardMaterial({ map: coverTex, roughness: .85, metalness: .05 }));
coverFace.rotation.x = -Math.PI / 2; coverFace.position.set(0, HB + BT + .0003, BD / 2); hinge.add(coverFace);
const skyFace = new THREE.Mesh(new THREE.PlaneGeometry(BW - .006, BD - .006), new THREE.MeshStandardMaterial({ map: skyTex, roughness: .95 }));
skyFace.rotation.x = Math.PI / 2; skyFace.rotation.z = Math.PI; skyFace.position.set(0, -.0004, BD / 2); skyFace.receiveShadow = true; hinge.add(skyFace);

// ---------- load art ----------
const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const ART = {
  backdrop: 'assets/s1/backdrop.webp', river: 'assets/s1/river.webp', grass: 'assets/s1/grass.webp',
  swan1: 'assets/s1/swan-1.webp', swan2: 'assets/s1/swan-2.webp', swan3: 'assets/s1/swan-3.webp',
  miggy: 'assets/char/miggy-front.webp', kayiu: 'assets/char/kayiu-front.webp', leaf: 'assets/misc/leaf-green.webp',
};

const pieces = [];   // {obj, x, z, rise:[a,b], fold:[a,b], lean, sway}
let leaf, sign;

function place(name, img, width, x, z, rise, fold, extra = {}) {
  const c = card(finishCut(img), width);
  c.position.set(x, PG, z); c.visible = false; book.add(c);
  const piece = { obj: c, name, x, z, rise, fold, ...extra }; pieces.push(piece); return piece;
}

function signCanvas() {
  const c = cv(900, 620), x = c.getContext('2d');
  x.fillStyle = '#fbf6ea'; x.beginPath(); x.roundRect(10, 10, 880, 600, 26); x.fill();
  x.strokeStyle = '#b8893a'; x.lineWidth = 5; x.beginPath(); x.roundRect(36, 36, 828, 548, 18); x.stroke();
  x.fillStyle = '#3a2a24'; x.textAlign = 'center';
  x.font = 'italic 50px "IM Fell English", Georgia, serif'; x.fillStyle = '#b8893a'; x.fillText('Save the date', 450, 135);
  x.fillStyle = '#3a2a24'; x.font = '500 104px "Cormorant Garamond", Georgia, serif'; x.fillText('Miggy & Kayiu', 450, 270);
  x.font = '600 52px "Cormorant Garamond", Georgia, serif'; x.fillText('Saturday 15 May 2027', 450, 370);
  x.font = '500 46px "Cormorant Garamond", Georgia, serif'; x.fillText('Kew Gardens', 450, 440);
  x.font = 'italic 36px "IM Fell English", Georgia, serif'; x.fillText('seventeen years to the day', 450, 520);
  return c;
}

async function build() {
  await Promise.all([document.fonts.load('500 40px "Cormorant Garamond"'), document.fonts.load('italic 40px "IM Fell English"')]).catch(() => {});
  coverTex.image = cloth().image; coverTex.needsUpdate = true;   // redraw once fonts are in
  const im = Object.fromEntries(await Promise.all(Object.entries(ART).map(async ([k, v]) => [k, await load(v)])));

  // back to front: each rises a little after the one behind it
  place('backdrop', im.backdrop, .43, 0, .012, [.16, .24], [.70, .76]);
  place('river', im.river, .43, 0, .075, [.19, .27], [.70, .76]);
  place('swan1', im.swan1, .055, -.12, .085, [.22, .29], [.70, .75], { glide: .05 });
  place('swan2', im.swan2, .065, .02, .095, [.23, .30], [.70, .75], { glide: -.04 });
  place('swan3', im.swan3, .058, .14, .088, [.24, .31], [.70, .75], { glide: .035 });
  place('miggy', im.miggy, .052, -.035, .165, [.27, .34], [.71, .77]);
  place('kayiu', im.kayiu, .04, .03, .165, [.28, .35], [.71, .77]);
  place('grass', im.grass, .44, 0, .27, [.30, .37], [.69, .75], { lean: -1.0 });
  sign = place('sign', signCanvas(), .2, 0, .19, [.78, .86], [2, 3]);

  const lc = card(finishCut(im.leaf, .02), .045);
  lc.children.forEach(m => { m.material.side = THREE.DoubleSide; });
  lc.children[1].visible = false;
  book.add(lc); leaf = lc;

  document.getElementById('loading').classList.add('done');
}

// ---------- camera path: [p, position, target] ----------
const KEYS = [   // [p, camera position, look-at target, how far to step back on a portrait phone]
  [0.00, [0.00, 0.62, 0.78], [0, 0.00, 0.15], 1.5],
  [0.10, [0.00, 0.52, 0.70], [0, 0.03, 0.14], 1.7],
  [0.24, [0.00, 0.30, 0.62], [0, 0.07, 0.12], 2.2],
  [0.40, [0.06, 0.115, 0.44], [-0.01, 0.055, 0.12], 1.7],
  [0.52, [-0.05, 0.12, 0.42], [0.01, 0.06, 0.13], 1.7],
  [0.64, [0.00, 0.34, 0.62], [0, 0.04, 0.13], 2.2],
  [0.80, [0.00, 0.30, 0.58], [0, 0.05, 0.15], 2.0],
  [0.92, [0.00, 0.14, 0.50], [0, 0.07, 0.17], 1.8],
  [1.00, [0.00, 0.13, 0.46], [0, 0.07, 0.17], 1.8],
];
const _p = new THREE.Vector3(), _t = new THREE.Vector3();
function cameraAt(p) {
  let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
  const [p0, a0, b0, m0] = KEYS[i], [p1, a1, b1, m1] = KEYS[i + 1], k = ease(seg(p, p0, p1));
  _p.set(lerp(a0[0], a1[0], k), lerp(a0[1], a1[1], k), lerp(a0[2], a1[2], k));
  _t.set(lerp(b0[0], b1[0], k), lerp(b0[1], b1[1], k), lerp(b0[2], b1[2], k));
  // portrait phones: step back so the whole spread fits
  const aspect = camera.aspect, pull = aspect < 1 ? lerp(lerp(m0, m1, k), 1, clamp((aspect - .45) / .55)) : 1;
  _p.sub(_t).multiplyScalar(pull).add(_t);
  camera.position.copy(_p); camera.lookAt(_t);
}

// ---------- the story as a function of p ----------
function frame(p, time) {
  // cover opens: 0 = closed (lying flat), -90 degrees = standing as the backdrop
  const open = ease(seg(p, .03, .17));
  hinge.rotation.x = -Math.PI / 2 * open;

  for (const pc of pieces) {
    const up = back(seg(p, pc.rise[0], pc.rise[1])), down = ease(seg(p, pc.fold[0], pc.fold[1]));
    const k = clamp(up) * (1 - down);
    pc.obj.visible = k > .001;
    const stand = (1 - k) * -Math.PI / 2 + (pc.lean || 0) * k;
    pc.obj.rotation.x = Math.min(stand + (up > 1 ? (up - 1) * .6 : 0), .3);
    if (pc.glide) pc.obj.position.x = pc.x + pc.glide * Math.sin(p * 9 + pc.x * 20) + Math.sin(time * .8 + pc.x * 30) * .002;
    if (pc.name === 'grass') pc.obj.rotation.z = Math.sin(time * 1.1) * .004;
  }

  // the leaf: rests on the cover, lifts as the book opens, drifts over the spread, then away on the wind
  if (leaf) {
    const coverTop = new THREE.Vector3(.11, HB + BT + .002, .2);
    coverTop.applyEuler(hinge.rotation).add(hinge.position);
    const lift = seg(p, .06, .2), drift = seg(p, .2, .5), away = seg(p, .5, .64);
    const x = lerp(lerp(coverTop.x, -.06, ease(lift)), .05, drift) + away * .5;
    const y = lerp(coverTop.y, .16, ease(lift)) - drift * .05 + away * .25 + Math.sin(p * 30) * .006 * lift;
    const z = lerp(coverTop.z, .2, ease(lift)) + away * .2;
    leaf.position.set(x, y, z);
    leaf.rotation.set(-Math.PI / 2 * (1 - lift) + Math.sin(p * 22) * .5 * lift, p * 9 * lift, Math.sin(p * 17) * .6 * lift);
    leaf.visible = away < 1;
  }

  // lights come down a little as the save-the-date rises
  const dusk = seg(p, .74, .9);
  sun.intensity = lerp(2.4, 1.5, dusk);
  sun.color.setRGB(1, lerp(.96, .86, dusk), lerp(.88, .7, dusk));
  hemi.intensity = lerp(.9, .6, dusk);

  cameraAt(p);
  document.getElementById('hint').style.opacity = p < .02 ? .85 : 0;
}

// ---------- scroll + loop ----------
const bookEl = document.getElementById('book');
let target = 0, cur = 0;
function readScroll() {
  const r = bookEl.getBoundingClientRect(), span = r.height - innerHeight;
  target = clamp(-r.top / span);
}
addEventListener('scroll', readScroll, { passive: true });

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 48 : 35; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

const params = new URLSearchParams(location.search);   // ?p=0.4 freezes a frame (for screenshots)
const fixedP = params.has('p') ? parseFloat(params.get('p')) : null;

resize(); readScroll(); cur = target;
build().then(() => { window.__ready = true; });
renderer.setAnimationLoop(t => {
  if (fixedP !== null) cur = fixedP; else cur += (target - cur) * .12;
  frame(cur, t / 1000);
  renderer.render(scene, camera);
});
