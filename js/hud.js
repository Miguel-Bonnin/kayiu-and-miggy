// 2D overlay: comic caption boxes and typed speech bubbles.
// Bubble drawing adapted from lemo-opuscar styles/paper-popup/demo/hud.js (MIT, LemoLab), driven by scroll instead of time.
import { clamp, seg, back, ss, lerp } from './lib.js';

const INK = '#3a2a24';
const FONT = '"Patrick Hand", "Comic Sans MS", cursive';

function wrap(x, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}

// s = overlay scale (1 at a 1400 x 800 desktop view), top = safe-area offset in px
export function drawCaptions(x, p, W, H, s, top, CAPTIONS) {
  for (const [a, b, text] of CAPTIONS) {
    if (p < a - .005 || p > b + .015) continue;
    const kin = back(seg(p, a, a + .012), 2), kout = 1 - ss(seg(p, b, b + .012)), k = kin * kout;
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

// Split "a *b* **c**" into styled words: [{w, i (italic), b (bold)}]
function words(text) {
  const out = []; let i = false, b = false;
  for (const tok of text.split(/(\*\*|\*)/)) {
    if (tok === '**') { b = !b; continue; }
    if (tok === '*') { i = !i; continue; }
    tok.split(/(\s+)/).forEach(w => { if (w) out.push({ w, i, b }); });
  }
  return out;
}
const fontOf = (wd, fs) => `${wd.b ? 'bold ' : ''}${wd.i ? 'italic ' : ''}${Math.round(fs * (wd.b ? 1.08 : 1))}px ${FONT}`;

// anchors: { miggy: [sx, sy], kayiu: [sx, sy] } = screen position of the top of each head, in px
export function drawBubbles(x, p, W, H, s, anchors, BUBBLES) {
  for (const [who, a, b, text, style] of BUBBLES) {
    if (p < a || p > b + (b - a) * .06) continue;
    const an = anchors[who]; if (!an) continue;
    const d = b - a, kin = back(seg(p, a, a + d * .12), 2.2), kout = 1 - ss(seg(p, b - d * .06, b + d * .06)), k = kin * kout;
    if (k <= 0) continue;
    const ws = words(text), total = ws.reduce((n, wd) => n + wd.w.length, 0);
    const n = Math.max(1, Math.ceil(clamp(seg(p, a + d * .04, a + d * .5)) * total));
    x.save();
    const fs = Math.round(32 * s), think = style === 'think';
    // lay out styled words into lines
    const maxW = Math.min(440 * s, W * .66), lines = [[]]; let lw = 0;
    for (const wd of ws) {
      x.font = fontOf(wd, fs); const ww = x.measureText(wd.w).width;
      if (/^\s+$/.test(wd.w) && lw === 0) continue;
      if (lw + ww > maxW && lw > 0 && !/^\s+$/.test(wd.w)) { lines.push([]); lw = 0; }
      if (/^\s+$/.test(wd.w) && lw + ww > maxW) continue;
      lines[lines.length - 1].push({ ...wd, x: lw, ww }); lw += ww;
    }
    const lineW = l => l.length ? l[l.length - 1].x + l[l.length - 1].ww : 0;
    const tw = Math.max(...lines.map(lineW), 120 * s);
    const bw = tw + 46 * s, lh = fs * 1.2, bh = lines.length * lh + 34 * s, r = think ? bh * .48 : 26 * s;
    let bx = clamp(an[0] - bw * .5, 12 * s, W - bw - 12 * s), by = clamp(an[1] - bh - 50 * s, 70 * s, H - bh - 12 * s);
    const tx = clamp(an[0], bx + r * .6 + 10 * s, bx + bw - r * .6 - 10 * s), tipY = Math.max(by + bh + 8 * s, Math.min(an[1] - 8 * s, by + bh + 44 * s));
    x.translate(tx, by + bh); x.scale(k, k); x.translate(-tx, -(by + bh));
    x.globalAlpha = clamp(kout * 1.5);
    x.fillStyle = 'rgba(40,25,15,.22)'; x.beginPath(); x.roundRect(bx + 5 * s, by + 8 * s, bw, bh, r); x.fill();
    x.lineWidth = 3.5 * s; x.strokeStyle = INK; x.lineJoin = 'round'; x.fillStyle = '#fffdf8';
    x.beginPath(); x.roundRect(bx, by, bw, bh, r); x.fill(); x.stroke();
    if (think) {   // a trail of little thought circles down to the head
      for (const [f, rr] of [[.35, 9], [.62, 6], [.85, 4]]) {
        x.beginPath(); x.arc(lerp(tx, an[0], f), lerp(by + bh + 6 * s, tipY + 10 * s, f), rr * s, 0, Math.PI * 2); x.fill(); x.stroke();
      }
    } else {
      x.beginPath(); x.moveTo(tx - 16 * s, by + bh - 2); x.lineTo(lerp(tx, an[0], .7), tipY); x.lineTo(tx + 12 * s, by + bh - 2); x.fill(); x.stroke();
      x.fillRect(tx - 13 * s, by + bh - 6 * s, 24 * s, 8 * s);
    }
    x.fillStyle = '#241814'; x.textBaseline = 'alphabetic';
    let left = n;
    lines.forEach((l, li) => {
      for (const wd of l) {
        if (left <= 0) break;
        const shown = wd.w.slice(0, left); left -= wd.w.length;
        x.font = fontOf(wd, fs); x.fillStyle = wd.b ? '#8a2f1c' : '#241814';
        x.fillText(shown, bx + 23 * s + wd.x, by + 17 * s + fs * .9 + li * lh);
      }
    });
    x.restore();
  }
}
