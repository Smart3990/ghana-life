// Our own highlife tune, made entirely in code (no samples): two palm-wine guitars, bass, the bell,
// shaker and soft drums. Writes public/music/arrival.mp3 (needs ffmpeg).
// Run: node scripts/music/highlife.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SR = 32000;
const BPM = 118;
const STEP = 60 / BPM / 4; // a sixteenth
const BARS = 32;
const N = Math.ceil((BARS * 16 * STEP + 2) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

function add(buf, at, sig, gain, pan = 0) {
  const s = Math.floor(at * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < sig.length && s + i < N; i++) {
    L[s + i] += sig[i] * gl;
    R[s + i] += sig[i] * gr;
  }
}
// A plucked string (Karplus-Strong), bright then mellow.
function pluck(f, dur, bright = 0.5) {
  const n = Math.floor(dur * SR);
  const p = Math.max(2, Math.round(SR / f));
  const ring = new Float32Array(p);
  for (let i = 0; i < p; i++) ring[i] = rnd() * 2 - 1;
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const k = i % p;
    const v = ring[k];
    const nv = 0.996 * (bright * v + (1 - bright) * 0.5 * (v + last));
    last = v;
    ring[k] = nv;
    out[i] = v * Math.min(1, i / 40);
  }
  return out;
}
function bassNote(f, dur) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t * 200) * Math.exp(-t * 3.2);
    out[i] = env * (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t) + 0.1 * Math.sin(6 * Math.PI * f * t));
  }
  return out;
}
function bell(f, dur = 0.35) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    out[i] = Math.exp(-t * 14) * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * t) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * t));
  }
  return out;
}
function shaker(dur = 0.07) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const x = rnd() * 2 - 1;
    hp = 0.85 * (hp + x - prev);
    prev = x;
    out[i] = hp * Math.exp((-i / SR) * 55) * Math.min(1, i / 60);
  }
  return out;
}
function drum(f0, dur, noise = 0) {
  const n = Math.floor(dur * SR);
  const out = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f0 * (1 + 1.5 * Math.exp(-t * 30));
    ph += (2 * Math.PI * f) / SR;
    out[i] = Math.exp(-t * 9) * (Math.sin(ph) + noise * (rnd() * 2 - 1) * Math.exp(-t * 40));
  }
  return out;
}

// Highlife changes: I - IV - I - V (G C G D), one bar each.
const CHORDS = [
  [55, 59, 62, 67], // G
  [60, 64, 67, 72], // C
  [55, 59, 62, 67], // G
  [62, 66, 69, 74], // D
];
const ROOT = [43, 48, 43, 50];
// Guitar 1: a rolling sixteenth pattern (chord tone index, or -1 for rest).
const G1 = [0, 2, 1, 3, 2, 1, 3, 2, 0, 2, 1, 3, 2, 3, 1, 2];
// Guitar 2: the sweet answering riff, up high, two bars long.
const G2 = [
  [0, 79], [3, 81], [6, 83], [8, 81], [10, 79], [12, 76], [14, 79],
  [16, 78], [19, 76], [22, 74], [24, 76], [26, 78], [28, 81], [30, 79],
];
const BELL = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0];
const BASS = [[0, 0], [3, 7], [6, 0], [8, 12], [11, 7], [14, 0]]; // [step, semitones above root]

for (let bar = 0; bar < BARS; bar++) {
  const c = bar % 4;
  const t0 = bar * 16 * STEP;
  const intro = bar < 2;
  const swing = (s) => t0 + s * STEP + (s % 2 ? STEP * 0.12 : 0);
  // Guitar 1
  for (let s = 0; s < 16; s++) {
    const note = CHORDS[c][G1[s]] + 12;
    add(L, swing(s), pluck(hz(note), 0.5, 0.55), (s % 4 === 0 ? 0.22 : 0.15) * (0.85 + 0.3 * rnd()), -0.35);
  }
  if (intro) continue;
  // Guitar 2 (every two bars; transposed with the chord)
  if (bar % 2 === 0 && bar >= 4) {
    const shift = c === 1 ? 5 : c === 3 ? 7 : 0;
    for (const [s, m] of G2) if (s < 32) add(L, t0 + s * STEP, pluck(hz(m + (bar % 8 >= 4 ? shift : 0) - 12), 0.8, 0.7), 0.16, 0.4);
  }
  // Bass
  for (const [s, iv] of BASS) add(L, swing(s), bassNote(hz(ROOT[c] + iv - 12), STEP * 3), 0.42, 0);
  // Bell, shaker, drums
  for (let s = 0; s < 16; s++) {
    if (BELL[s]) add(L, swing(s), bell(s === 0 ? 1180 : 1560), 0.07, 0.2);
    add(L, swing(s), shaker(), s % 4 === 2 ? 0.12 : 0.06, -0.15);
  }
  for (const s of [0, 8]) add(L, t0 + s * STEP, drum(60, 0.4), 0.5, 0);
  for (const s of [6, 7, 14]) add(L, swing(s), drum(190, 0.25, 0.3), 0.22, 0.25); // conga
  for (const s of [4, 12]) add(L, t0 + s * STEP, drum(260, 0.2, 0.9), 0.18, -0.1); // soft snare
}
// The mono adds above went to L only: spread them with a little room (short echoes on R).
for (let i = 0; i < N; i++) R[i] = L[i];
const D1 = Math.floor(0.031 * SR);
const D2 = Math.floor(0.047 * SR);
for (let i = N - 1; i >= D2; i--) {
  R[i] = 0.75 * R[i] + 0.3 * L[i - D1];
  L[i] = 0.8 * L[i] + 0.22 * L[i - D2];
}
// Normalise.
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const g = 0.9 / peak;
const pcm = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g)) * 32767), i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g)) * 32767), i * 4 + 2);
}
const web = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const raw = path.join(web, 'scripts/music/.arrival.raw');
fs.writeFileSync(raw, pcm);
fs.mkdirSync(path.join(web, 'public/music'), { recursive: true });
const out = path.join(web, 'public/music/arrival.mp3');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(SR), '-ac', '2', '-i', raw, '-b:a', '64k', out]);
fs.unlinkSync(raw);
console.log('wrote', out, Math.round(fs.statSync(out).size / 1024), 'KB,', (N / SR).toFixed(1), 's');
