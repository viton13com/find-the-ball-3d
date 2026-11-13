#!/usr/bin/env node
/* Sound for "Find the Ball", all synthesized (nothing licensed). Follows js/timeline.js exactly.
 * Music: dark pulse in A minor, 120 BPM; energy rises per level; drops to ticks during the countdown.
 * Foley: cups arriving, ceramic thud on the table, whooshes per swap, countdown ticks, reveal chime. Output: out/sound.wav */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { LEVELS, DURATION } from '../js/timeline.js';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000, DUR = Math.ceil(DURATION * 10) / 10 + 0.4, N = Math.round(DUR * SR), TAU = Math.PI * 2;
const L = new Float32Array(N), R = new Float32Array(N), VL = new Float32Array(N), VR = new Float32Array(N);
let seed = 13; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const at = (t) => Math.round(t * SR), clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12), lpA = (fc) => 1 - Math.exp(-TAU * Math.min(fc, 20000) / SR);
const put = (i, l, r, send = 0) => { if (i >= 0 && i < N) { L[i] += l; R[i] += r; VL[i] += l * send; VR[i] += r * send; } };

// ---------- instruments ----------
function bell(t0, f0, { amp = 0.1, dur = 2, pan = 0, send = 0.45, partials = [[1, 1, 1], [2.76, 0.5, 0.6], [5.4, 0.25, 0.4], [8.93, 0.12, 0.25]] } = {}) {
  const s = at(t0), n = at(dur); for (let k = 0; k < n; k++) { const t = k / SR; let v = 0; for (const [m, a, d] of partials) v += Math.sin(TAU * f0 * m * t) * a * Math.exp(-t / (dur * 0.35 * d)); v *= Math.min(1, t / 0.0015) * amp; put(s + k, v * (1 - pan), v * (1 + pan), send); } }
const glock = (t0, m, amp = 0.06, pan = 0) => bell(t0, hz(m), { amp, dur: 1.3, pan, send: 0.5, partials: [[1, 1, 1], [2, 0.15, 0.3], [5.4, 0.06, 0.15]] });
function noise(t0, { dur = 0.08, amp = 0.1, lo = 2000, hi = 9000, pan = 0, send = 0.1, decay = 0.02, att = 0.0005 } = {}) {
  const s = at(t0), n = at(dur); let a = 0, b = 0; for (let k = 0; k < n; k++) { const t = k / SR; a += (rnd() - a) * lpA(hi); b += (a - b) * lpA(lo); const v = (a - b) * Math.exp(-t / decay) * Math.min(1, t / att) * amp; put(s + k, v * (1 - pan), v * (1 + pan), send); } }
function kick(t0, amp = 0.5, f = 46) { const s = at(t0); let ph = 0; for (let k = 0; k < at(0.35); k++) { const t = k / SR; ph += TAU * (f + 120 * Math.exp(-t / 0.028)) / SR; const v = Math.tanh(Math.sin(ph) * Math.exp(-t / 0.15) * 1.4) * amp; put(s + k, v, v, 0.02); } }
function thud(t0, amp = 0.5, pan = 0) { // ceramic cup landing on a table: low body + bright click
  const s = at(t0); let ph = 0; for (let k = 0; k < at(0.25); k++) { const t = k / SR; ph += TAU * (95 + 60 * Math.exp(-t / 0.01)) / SR; const v = Math.sin(ph) * Math.exp(-t / 0.05) * amp * 0.8; put(s + k, v * (1 - pan), v * (1 + pan), 0.12); }
  noise(t0, { dur: 0.06, amp: amp * 0.55, lo: 1800, hi: 7000, decay: 0.008, pan, send: 0.15 });
  bell(t0, 1180 + rnd() * 60, { amp: amp * 0.05, dur: 0.35, pan, send: 0.2, partials: [[1, 1, 1], [2.3, 0.4, 0.5]] }); }
function whoosh(t0, dur, { amp = 0.12, pan0 = -0.4, pan1 = 0.4, f0 = 400, f1 = 2600 } = {}) { // swept band-passed noise
  const s = at(t0), n = at(dur); let a = 0, b = 0; for (let k = 0; k < n; k++) { const p = k / n, env = Math.sin(Math.PI * p) ** 1.6, fc = f0 + (f1 - f0) * Math.sin(Math.PI * p), pan = pan0 + (pan1 - pan0) * p;
    a += (rnd() - a) * lpA(fc * 2); b += (a - b) * lpA(fc * 0.5); const v = (a - b) * env * amp; put(s + k, v * (1 - pan), v * (1 + pan), 0.18); } }
function saw(t0, dur, m, { amp = 0.05, fc = 900, send = 0.3, att = 0.01, rel = 0.15, det = 0.007 } = {}) {
  const s = at(t0), n = at(dur + rel); for (const d of [-det, det]) { const f = hz(m) * (1 + d), pan = d * 50; let ph = Math.abs(rnd()), y = 0, y2 = 0;
    for (let k = 0; k < n; k++) { const t = k / SR; ph += f / SR; if (ph > 1) ph -= 1; y += (2 * ph - 1 - y) * lpA(fc); y2 += (y - y2) * lpA(fc); const env = Math.min(1, t / att) * (t > dur ? Math.exp(-(t - dur) / (rel / 3)) : 1); const v = y2 * env * amp; put(s + k, v * (1 - pan), v * (1 + pan), send); } } }
const hat = (t, amp = 0.035, pan = 0.25) => noise(t, { dur: 0.05, amp, lo: 7000, hi: 16000, decay: 0.012, pan, send: 0.05 });
const riser = (t0, dur, amp = 0.05) => whoosh(t0, dur, { amp, pan0: 0, pan1: 0, f0: 300, f1: 5000 });

// ---------- score ----------
const BEAT = 0.5, CH = [[57, [60, 64, 69]], [53, [60, 65, 69]], [48, [60, 64, 67]], [55, [59, 62, 67]]]; // Am F C G
const busy = (t) => { const Lv = LEVELS.find((x) => t < x.t1) || LEVELS[2]; return { Lv, music: t >= Lv.tCard && t < Lv.tAsk, ask: t >= Lv.tAsk && t < (Lv.tReveal ?? Lv.t1) }; };
for (let b = 0; b * BEAT < DURATION; b++) {
  const t = b * BEAT, { Lv, music } = busy(t), lvl = Lv.i, shuf = t >= Lv.tShuf && t < Lv.tAsk;
  const [bass, tri] = CH[Math.floor(b / 8) % 4];
  if (music) {
    if (b % 2 === 0 || shuf) kick(t, shuf ? 0.42 : 0.3);
    if (b % 8 === 0) saw(t, BEAT * 7.6, bass - 12, { amp: 0.07, fc: 260, send: 0.05, att: 0.02, rel: 0.3 });
    for (let k = 0; k < (shuf ? 2 + lvl : 1); k++) hat(t + k * BEAT / (shuf ? 2 + lvl : 1), 0.022 + 0.008 * lvl, k % 2 ? -0.3 : 0.3);
    if (b % 2 === 1) noise(t, { dur: 0.18, amp: 0.05 + 0.02 * lvl, lo: 900, hi: 6000, decay: 0.05, send: 0.25 }); // clap-ish snare
    if (b % 8 === 0) tri.forEach((m, i) => saw(t + i * 0.01, BEAT * 7.4, m, { amp: 0.012, fc: 1100 + 500 * lvl, send: 0.5, att: 0.4, rel: 0.6 }));
    if (shuf && b % 2 === 0) glock(t + BEAT / 2, tri[(b / 2) % 3] + 24, 0.016 + 0.006 * lvl, 0.3);
  }
}

// ---------- foley + stingers ----------
// intro hit
kick(0.02, 0.55, 40); bell(0.05, hz(81), { amp: 0.05, dur: 2.5 }); riser(0, 0.9, 0.04);
for (const Lv of LEVELS) {
  const { n } = Lv;
  if (Lv.i > 0) { riser(Lv.tCard - 0.8, 0.9, 0.05); kick(Lv.tCard + 0.1, 0.5, 40); [69, 72, 76].forEach((m, i) => glock(Lv.tCard + 0.15 + i * 0.07, m + 12 + Lv.i * 2, 0.05, -0.3 + i * 0.3)); }
  for (let c = 0; c < n; c++) whoosh(Lv.tCard + 0.15 + c * 0.08, 0.9, { amp: 0.05, f0: 250, f1: 1400, pan0: (c / (n - 1) - 0.5), pan1: (c / (n - 1) - 0.5) });
  glock(Lv.tCard + 1.0, 76, 0.08, -0.2); glock(Lv.tCard + 1.16, 81, 0.08, 0.2); // ball pops
  glock(Lv.tShow + 0.15, Lv.target === 'red' ? 84 : 88, 0.05, 0); // "watch this one"
  riser(Lv.tDrop - 0.4, 0.55, 0.035);
  for (let c = 0; c < n; c++) thud(Lv.tDrop + 0.55 * 0.78 + c * 0.004, 0.42, (c / (n - 1) - 0.5) * 0.8);
  for (const w of Lv.swaps) { const pa = (w.a / (n - 1) - 0.5) * 0.9, pb = (w.b / (n - 1) - 0.5) * 0.9, d = w.t1 - w.t0;
    whoosh(w.t0, d, { amp: 0.1, pan0: pa, pan1: pb, f0: 350, f1: 1800 + 900 * Lv.i }); whoosh(w.t0 + 0.01, d, { amp: 0.06, pan0: pb, pan1: pa, f0: 250, f1: 1200 });
    noise(w.t1 - 0.02, { dur: 0.04, amp: 0.05, lo: 2500, hi: 9000, decay: 0.006, pan: (pa + pb) / 2, send: 0.1 }); }
  // countdown ticks
  for (let k = 0; k < 3; k++) { bell(Lv.tAsk + 0.4 + k, k === 2 ? 1320 : 990, { amp: 0.07, dur: 0.4, send: 0.15, partials: [[1, 1, 1], [2, 0.3, 0.4]] }); noise(Lv.tAsk + 0.4 + k, { dur: 0.03, amp: 0.05, lo: 3000, hi: 10000, decay: 0.004 }); }
  saw(Lv.tAsk + 0.3, 3.1, 45, { amp: 0.035, fc: 200, send: 0.1, att: 1.5, rel: 0.3 }); // tension drone
  if (Lv.reveal) {
    for (let c = 0; c < n; c++) whoosh(Lv.tReveal + 0.15 + c * 0.07, 0.6, { amp: 0.045, f0: 300, f1: 1600 });
    kick(Lv.tReveal + 0.55, 0.45, 42); [72, 76, 79, 84].forEach((m, i) => glock(Lv.tReveal + 0.55 + i * 0.06, m + 12, 0.06, -0.3 + i * 0.2)); bell(Lv.tReveal + 0.55, hz(84), { amp: 0.05, dur: 2.2 });
    riser(Lv.tExit - 0.1, 0.8, 0.04);
  } else {
    kick(Lv.tEnd + 0.1, 0.55, 38); saw(Lv.tEnd + 0.1, 3.2, 45, { amp: 0.06, fc: 500, send: 0.4, att: 0.05, rel: 0.5 });
    [57, 60, 64, 69].forEach((m, i) => saw(Lv.tEnd + 0.1, 3.2, m, { amp: 0.016, fc: 1500, send: 0.6, att: 0.3, rel: 0.6 }));
    glock(Lv.tEnd + 0.2, 81, 0.05); glock(Lv.tEnd + 0.7, 88, 0.04); glock(Lv.tEnd + 1.3, 93, 0.03);
  }
}

// ---------- reverb + write ----------
function verb(inp, out, off) { const combs = [1557, 1617, 1491, 1422].map((d) => ({ b: new Float32Array(d + off), i: 0, f: 0 })), aps = [225, 556].map((d) => ({ b: new Float32Array(d + off), i: 0 }));
  for (let n = 0; n < N; n++) { let s = 0; for (const c of combs) { const y = c.b[c.i]; c.f = y * 0.75 + c.f * 0.25; c.b[c.i] = inp[n] + c.f * 0.82; c.i = (c.i + 1) % c.b.length; s += y; } s *= 0.25;
    for (const a of aps) { const y = a.b[a.i]; const x = s + y * 0.5; a.b[a.i] = x; a.i = (a.i + 1) % a.b.length; s = y - x * 0.5; } out[n] += s * 0.8; } }
verb(VL, L, 0); verb(VR, R, 23);
let peak = 0; for (let i = 0; i < N; i++) { const t = i / SR, g = smooth(t / 0.03) * (1 - smooth((t - (DUR - 1.2)) / 1.2)); L[i] = Math.tanh(L[i] * g * 1.2); R[i] = Math.tanh(R[i] * g * 1.2); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
const norm = 0.9 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(clamp(L[i] * norm, -1, 1) * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(clamp(R[i] * norm, -1, 1) * 32767), 46 + i * 4); }
fs.mkdirSync(path.join(ROOT, 'out'), { recursive: true }); fs.writeFileSync(path.join(ROOT, 'out', 'sound.wav'), buf); console.log('wrote out/sound.wav', DUR.toFixed(2), 's, peak', peak.toFixed(2));
