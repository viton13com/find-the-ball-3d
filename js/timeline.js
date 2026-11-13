// Shared timeline for picture (main.js) and sound (tools/sound.mjs). Pure JS, no DOM.
export const SP = 1.25;      // slot spacing
export const UP = 1.3;      // cup hover height while showing the balls
export const BALL_R = 0.25;

const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
export const easeIn = (x) => Math.pow(clamp(x), 3);
export const slotX = (n, i) => (i - (n - 1) / 2) * SP;

const CFG = [
  { n: 3, swaps: 5, sw: 0.9, target: 'red', reveal: true, dist: 9.0, seed: 5, card: 2.6 },
  { n: 4, swaps: 9, sw: 0.56, target: 'blue', reveal: true, dist: 11.2, seed: 19, card: 1.6 },
  { n: 5, swaps: 15, sw: 0.34, target: 'red', reveal: false, dist: 13.4, seed: 41, card: 1.6 },
];
const D = { show: 2.4, drop: 0.55, pre: 0.3, post: 0.25, ask: 3.4, reveal: 2.6, exit: 0.75, end: 3.6 };

export const LEVELS = []; let t = 0;
for (const [i, c] of CFG.entries()) {
  const r = rng(c.seed), L = { ...c, i, t0: t };
  L.red = Math.floor(r() * c.n); do { L.blue = Math.floor(r() * c.n); } while (L.blue === L.red);
  L.tCard = t; t += c.card; L.tShow = t; t += D.show; L.tDrop = t; t += D.drop + D.pre; L.tShuf = t;
  L.swaps = []; let prev = '';
  for (let k = 0; k < c.swaps; k++) {
    let a, b, key;
    do { a = Math.floor(r() * c.n); b = Math.floor(r() * c.n); key = Math.min(a, b) + '-' + Math.max(a, b); } while (a === b || key === prev);
    prev = key; L.swaps.push({ a: Math.min(a, b), b: Math.max(a, b), t0: t, t1: t + c.sw }); t += c.sw;
  }
  t += D.post; L.tAsk = t; t += D.ask;
  if (c.reveal) { L.tReveal = t; t += D.reveal; L.tExit = t; t += D.exit; } else { L.tEnd = t; t += D.end; }
  L.t1 = t;
  const s = [...Array(c.n).keys()];
  for (const w of L.swaps) { const ca = s.indexOf(w.a), cb = s.indexOf(w.b); s[ca] = w.b; s[cb] = w.a; }
  L.finalSlot = s; L.targetCup = c.target === 'red' ? L.red : L.blue; L.answer = s[L.targetCup] + 1;
  LEVELS.push(L);
}
export const DURATION = t;
export const levelAt = (tt) => LEVELS.find((L) => tt < L.t1) || LEVELS[LEVELS.length - 1];

// cup pose on the table plane: x, z and travel phase (0..1 while moving, for tilt)
export function cupXZ(L, cup, tt) {
  const s = [...Array(L.n).keys()];
  for (const w of L.swaps) {
    if (tt >= w.t1) { const ca = s.indexOf(w.a), cb = s.indexOf(w.b); s[ca] = w.b; s[cb] = w.a; continue; }
    if (tt >= w.t0) {
      const ca = s.indexOf(w.a), cb = s.indexOf(w.b), p = (tt - w.t0) / (w.t1 - w.t0), e = ease(p);
      const arc = w.b - w.a === 1 ? 0.62 : 1.18;
      if (cup === ca) return { x: lerp(slotX(L.n, w.a), slotX(L.n, w.b), e), z: arc * Math.sin(Math.PI * e), moving: Math.sin(Math.PI * p), dir: 1 };
      if (cup === cb) return { x: lerp(slotX(L.n, w.b), slotX(L.n, w.a), e), z: -arc * Math.sin(Math.PI * e), moving: Math.sin(Math.PI * p), dir: -1 };
    }
    break;
  }
  return { x: slotX(L.n, s[cup]), z: 0, moving: 0, dir: 0 };
}

// cup height above the table
export function cupY(L, cup, tt, slot) {
  if (tt < L.tShow) { const p = (tt - L.tCard - 0.15 - cup * 0.08) / 0.9; return lerp(6.5, UP, easeOut(p)); }
  if (tt < L.tDrop) return UP + Math.sin((tt - L.tShow) * 2.2 + cup) * 0.035;
  if (tt < L.tDrop + D.drop) { const p = (tt - L.tDrop) / D.drop; return p < 0.78 ? UP * (1 - easeIn(p / 0.78)) : Math.sin((p - 0.78) / 0.22 * Math.PI) * 0.035; }
  if (L.reveal && tt >= L.tReveal) {
    if (tt >= L.tExit) return lerp(UP * 0.95, 7, easeIn((tt - L.tExit - slot * 0.04) / D.exit));
    return UP * 0.95 * easeOut((tt - L.tReveal - 0.15 - slot * 0.07) / 0.6);
  }
  return 0;
}
