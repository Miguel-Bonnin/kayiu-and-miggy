// 2D overlay: comic caption boxes and typed speech bubbles.
// Bubble drawing adapted from lemo-opuscar styles/paper-popup/demo/hud.js (MIT, LemoLab), driven by scroll instead of time.
import { CAPTIONS, BUBBLES } from './story.js';
import { clamp, seg, back, ss, lerp } from './lib.js';

const INK = '#3a2a24';
const FONT = '"Patrick Hand", "Comic Sans MS", cursive';

function wrap(x, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

// s = overlay scale (1 at a 1400 x 800 desktop view), top = safe-area offset in px
export function drawCaptions(x, p, W, H, s, top) {
  for (const [a, b, text] of CAPTIONS) {
    if (p < a - .01 || p > b + .03) continue;
    const kin = back(seg(p, a, a + .03), 2), kout = 1 - ss(seg(p, b, b + .03)), k = kin * kout;
    if (k <= 0) continue;
    x.save();
    x.font = `${Math.round(34 * s)}px ${FONT}`;
    const pad = 22 * s, tw = x.measureText(text).width, bw = tw + pad * 2, bh = 58 * s;
    const bx = 22 * s, by = top + 22 * s;
    x.translate(bx, by); x.rotate(-.012); x.scale(k, k);
    x.fillStyle = 'rgba(40,25,15,.25)'; x.fillRect(6 * s, 7 * s, bw, bh);
    x.fillStyle = '#fff3c9'; x.fillRect(0, 0, bw, bh);
    x.lineWidth = 3.5 * s; x.strokeStyle = INK; x.strokeRect(0, 0, bw, bh);
    x.fillStyle = INK; x.textBaseline = 'middle'; x.fillText(text, pad, bh / 2 + 2 * s);
    x.restore();
  }
}

// anchors: { miggy: [sx, sy], kayiu: [sx, sy] } = screen position of the top of each head, in px
export function drawBubbles(x, p, W, H, s, anchors) {
  for (const [who, a, b, text] of BUBBLES) {
    if (p < a - .005 || p > b + .01) continue;
    const an = anchors[who]; if (!an) continue;
    const kin = back(seg(p, a, a + .012), 2.2), kout = 1 - ss(seg(p, b - .004, b + .008)), k = kin * kout;
    if (k <= 0) continue;
    const n = Math.floor(clamp(seg(p, a + .006, a + (b - a) * .55)) * text.length);
    x.save();
    const fs = Math.round(32 * s); x.font = `${fs}px ${FONT}`;
    const maxW = Math.min(420 * s, W * .62), lines = wrap(x, text, maxW);
    const tw = Math.max(...lines.map(l => x.measureText(l).width), 120 * s);
    const bw = tw + 46 * s, lh = fs * 1.15, bh = lines.length * lh + 34 * s, r = 26 * s;
    let bx = clamp(an[0] - bw * .5, 12 * s, W - bw - 12 * s), by = clamp(an[1] - bh - 46 * s, 70 * s, H - bh - 12 * s);
    const tx = clamp(an[0], bx + r + 10 * s, bx + bw - r - 10 * s), tipY = Math.max(by + bh + 8 * s, Math.min(an[1] - 8 * s, by + bh + 44 * s));
    x.translate(tx, by + bh); x.scale(k, k); x.translate(-tx, -(by + bh));
    x.globalAlpha = clamp(kout * 1.5);
    x.fillStyle = 'rgba(40,25,15,.22)'; x.beginPath(); x.roundRect(bx + 5 * s, by + 8 * s, bw, bh, r); x.fill();
    const body = () => { x.beginPath(); x.roundRect(bx, by, bw, bh, r); };
    const tail = () => { x.beginPath(); x.moveTo(tx - 16 * s, by + bh - 2); x.lineTo(lerp(tx, an[0], .7), tipY); x.lineTo(tx + 12 * s, by + bh - 2); };
    x.fillStyle = '#fffdf8'; body(); x.fill(); tail(); x.fill();
    x.lineWidth = 3.5 * s; x.strokeStyle = INK; x.lineJoin = 'round';
    body(); x.stroke(); tail(); x.stroke();
    x.fillStyle = '#fffdf8'; x.fillRect(tx - 13 * s, by + bh - 6 * s, 24 * s, 8 * s);
    x.fillStyle = '#241814'; x.textBaseline = 'alphabetic';
    let left = n;
    lines.forEach((l, i) => { const shown = l.slice(0, Math.max(0, left)); left -= l.length + 1; x.fillText(shown, bx + 23 * s, by + 17 * s + fs * .9 + i * lh); });
    x.restore();
  }
}
