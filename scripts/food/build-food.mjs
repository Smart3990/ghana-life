// Builds the market's food (public/models/food/food.glb) from two free food packs:
//   - "Low Poly Food Pack" by reodesuxz (free for games, files not to be given out on their own)
//   - "Ultimate Food Pack" by Quaternius (CC0)
// and our own shapes (tables, enamel basins, egg trays, the kelewele itself: no pack has plantain).
//
// Every piece in the file is one mesh with its colours painted on (COLOR_0), so the game draws all the
// copies of a display at once with one plain material. Items in piles are simplified first (a tomato in
// a pile 10 m away needs 30 triangles, not 340), so a whole stall stays a few hundred triangles.
//
// Pieces:
//   stall-*   a wooden table with goods, fitted under the pack's market stand (3 m wide, front is +z)
//   table-*   goods for the small umbrella tables (their top is 0.78 m up, 0.9 x 0.6 m)
//   head-*    a seller's head load (basin of oranges / tomatoes, tray of bread)
//   kelewele-wrap, kelewele-pan   Mission 1: the paper of kelewele and Auntie Dede's pan
//
// Usage: node build-food.mjs "<Low Poly Food Pack GLB folder>" "<Ultimate Food Pack folder>" <out.glb>
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);

const [lowDir, ultDir, outFile] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

// ---------- A shape: lists of corners (position, normal, colour) and triangles ----------
const shape = () => ({ p: [], n: [], c: [], i: [] });
function append(dst, src) {
  const base = dst.p.length / 3;
  dst.p.push(...src.p);
  dst.n.push(...src.n);
  dst.c.push(...src.c);
  for (const k of src.i) dst.i.push(k + base);
  return dst;
}
const tris = (s) => s.i.length / 3;
// Move, turn (about up), scale and recolour a copy.
function placed(s, { x = 0, y = 0, z = 0, yaw = 0, tilt = 0, scale = 1, tint = null } = {}) {
  const out = shape();
  const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
  const rot = (a, b, c) => {
    // tilt about x, then yaw about y
    const b1 = b * ct - c * st, c1 = b * st + c * ct;
    return [a * cy + c1 * sy, b1, -a * sy + c1 * cy];
  };
  for (let k = 0; k < s.p.length; k += 3) {
    const [a, b, c] = rot(s.p[k] * scale, s.p[k + 1] * scale, s.p[k + 2] * scale);
    out.p.push(a + x, b + y, c + z);
    out.n.push(...rot(s.n[k], s.n[k + 1], s.n[k + 2]));
    out.c.push(...(tint ? mix([s.c[k], s.c[k + 1], s.c[k + 2]], tint) : [s.c[k], s.c[k + 1], s.c[k + 2]]));
  }
  out.i = s.i.slice();
  return out;
}
// Recolour keeping the light and dark of the original: tint is [r, g, b] (linear) or a function.
function mix(c, tint) {
  if (typeof tint === 'function') return tint(c);
  const l = 0.35 + 0.65 * Math.min(1, (c[0] + c[1] + c[2]) / 1.1);
  return [tint[0] * l, tint[1] * l, tint[2] * l];
}
// Colours are written as sRGB hex and stored linear (as glTF and three.js expect).
const lin = (hex) => {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((u) => {
    const s = u / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
};

// ---------- Our own simple shapes (flat faces) ----------
function quad(s, a, b, c, d, col) {
  const base = s.p.length / 3;
  const u = a.map((v, k) => b[k] - v), w = a.map((v, k) => d[k] - v);
  let nx = u[1] * w[2] - u[2] * w[1], ny = u[2] * w[0] - u[0] * w[2], nz = u[0] * w[1] - u[1] * w[0];
  const l = Math.hypot(nx, ny, nz) || 1;
  for (const v of [a, b, c, d]) {
    s.p.push(...v);
    s.n.push(nx / l, ny / l, nz / l);
    s.c.push(...col);
  }
  s.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
}
function box(w, h, d, x, y, z, hex, noBottom = false) {
  const s = shape(), col = typeof hex === 'string' ? lin(hex) : hex;
  const X = [x - w / 2, x + w / 2], Y = [y - h / 2, y + h / 2], Z = [z - d / 2, z + d / 2];
  const v = (i, j, k) => [X[i], Y[j], Z[k]];
  quad(s, v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1), col); // top
  if (!noBottom) quad(s, v(0, 0, 1), v(1, 0, 1), v(1, 0, 0), v(0, 0, 0), col); // bottom
  quad(s, v(0, 0, 1), v(0, 1, 1), v(1, 1, 1), v(1, 0, 1), col); // front
  quad(s, v(1, 0, 0), v(1, 1, 0), v(0, 1, 0), v(0, 0, 0), col); // back
  quad(s, v(1, 0, 1), v(1, 1, 1), v(1, 1, 0), v(1, 0, 0), col); // right
  quad(s, v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1), col); // left
  return s;
}
// A tube from radius r0 at y0 to r1 at y1 (open), plus an optional bottom disc.
function ring(r0, r1, y0, y1, seg, hex, bottom = false, x = 0, z = 0) {
  const s = shape(), col = typeof hex === 'string' ? lin(hex) : hex;
  for (let k = 0; k < seg; k++) {
    const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
    const P = (r, y, a) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
    // Outside face, then the same face turned in (a basin is seen from inside too).
    quad(s, P(r0, y0, a1), P(r0, y0, a0), P(r1, y1, a0), P(r1, y1, a1), col);
    quad(s, P(r0, y0, a0), P(r0, y0, a1), P(r1, y1, a1), P(r1, y1, a0), col.map((v) => v * 0.8));
    if (bottom) {
      const base = s.p.length / 3;
      for (const v of [[x, y0 + 0.002, z], P(r0, y0 + 0.002, a0), P(r0, y0 + 0.002, a1)]) {
        s.p.push(...v);
        s.n.push(0, 1, 0);
        s.c.push(...col.map((u) => u * 0.85));
      }
      s.i.push(base, base + 2, base + 1);
    }
  }
  return s;
}
// A low mound (a pile seen from the side): a flattened half ball.
function mound(r, h, y, hex, seg = 8, x = 0, z = 0) {
  const s = shape(), col = typeof hex === 'string' ? lin(hex) : hex;
  const rows = 3;
  const P = (ring, a) => {
    const t = (ring / rows) * (Math.PI / 2);
    return [x + Math.cos(a) * Math.cos(t) * r, y + Math.sin(t) * h, z + Math.sin(a) * Math.cos(t) * r];
  };
  for (let j = 0; j < rows; j++)
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2, a1 = ((k + 1) / seg) * Math.PI * 2;
      quad(s, P(j, a1), P(j, a0), P(j + 1, a0), P(j + 1, a1), col);
    }
  return s;
}
function table(w, d, top, hex = '#7a5636') {
  const s = box(w, 0.05, d, 0, top - 0.025, 0, hex);
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) append(s, box(0.06, top - 0.05, 0.06, sx * (w / 2 - 0.06), (top - 0.05) / 2, sz * (d / 2 - 0.06), '#5a3f28'));
  return s;
}
// An enamel basin (white with a blue rim, or a tint): goods are piled on top of it.
const basin = (r, h, hex = '#e6e8ea', rim = '#2a5aa8') => append(ring(r * 0.7, r, 0, h, 10, hex, true), ring(r, r * 1.03, h - 0.012, h, 10, rim));

// ---------- The packs' items ----------
// Ultimate Food Pack is not in real sizes: the largest side of each, in metres.
const REAL = {
  'Apple Green': 0.08, Avocado: 0.11, Banana: 0.2, Bottle: 0.3, 'Bottle-Pc8dM9Ja4V': 0.3, 'Bread Slice': 0.12, Bread: 0.26,
  Carrot: 0.2, 'Chicken Leg': 0.14, 'Cooking Pot': 0.6, Corndog: 0.22, Croissant: 0.14, Cupcake: 0.08, Donut: 0.09, Egg: 0.06,
  Eggplant: 0.09, Fries: 0.15, 'Frying Pan': 0.62, 'Pepper Green': 0.09, 'Plate Square': 0.26, Pumpkin: 0.3, Soda: 0.12,
  Tomato: 0.07, 'Egg Fried': 0.1, Lettuce: 0.22, Broccoli: 0.15, 'Ketchup Bottle': 0.2, Waffle: 0.15,
};
async function readItem(file, realMax) {
  const doc = await io.read(file);
  const s = shape();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const W = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION'), nrm = prim.getAttribute('NORMAL'), idx = prim.getIndices();
      let col = (prim.getMaterial()?.getBaseColorFactor() ?? [0.8, 0.8, 0.8, 1]).slice(0, 3);
      // The Ultimate pack's colours are dark (they look dull grey in the street's light): brighter.
      if (realMax) col = col.map((v) => Math.min(1, v * 1.7));
      const base = s.p.length / 3;
      for (let k = 0; k < pos.getCount(); k++) {
        const v = pos.getElement(k, []);
        s.p.push(...[0, 1, 2].map((a) => W[a] * v[0] + W[4 + a] * v[1] + W[8 + a] * v[2] + W[12 + a]));
        const m = nrm ? nrm.getElement(k, []) : [0, 1, 0];
        const n = [0, 1, 0].map((_, a) => W[a] * m[0] + W[4 + a] * m[1] + W[8 + a] * m[2]);
        const l = Math.hypot(...n) || 1;
        s.n.push(n[0] / l, n[1] / l, n[2] / l);
        s.c.push(...col);
      }
      const list = idx ? Array.from(idx.getArray()) : [...Array(pos.getCount()).keys()];
      for (const k of list) s.i.push(k + base);
    }
  }
  // Base on the ground, centred, and (for the Ultimate pack) shrunk to its real size.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < s.p.length; k += 3) for (let a = 0; a < 3; a++) (mn[a] = Math.min(mn[a], s.p[k + a])), (mx[a] = Math.max(mx[a], s.p[k + a]));
  const scale = realMax ? realMax / Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) : 1;
  for (let k = 0; k < s.p.length; k += 3) {
    s.p[k] = (s.p[k] - (mn[0] + mx[0]) / 2) * scale;
    s.p[k + 1] = (s.p[k + 1] - mn[1]) * scale;
    s.p[k + 2] = (s.p[k + 2] - (mn[2] + mx[2]) / 2) * scale;
  }
  return s;
}
// Fewer triangles for items in a pile (each colour part on its own, so colours never run together).
function simpler(s, share) {
  if (share >= 1) return s;
  const out = shape();
  // Split the triangles by colour, and join the corners at the same place (the packs' models are
  // flat-shaded, so every triangle has its own corners and nothing could be merged otherwise).
  const groups = new Map();
  for (let t = 0; t < s.i.length; t += 3) {
    const k = s.c.slice(s.i[t] * 3, s.i[t] * 3 + 3).map((v) => v.toFixed(3)).join();
    if (!groups.has(k)) groups.set(k, { col: s.c.slice(s.i[t] * 3, s.i[t] * 3 + 3), tri: [] });
    groups.get(k).tri.push(s.i[t], s.i[t + 1], s.i[t + 2]);
  }
  for (const { col, tri } of groups.values()) {
    const at = new Map(), pos = [], idx = [];
    for (const v of tri) {
      const key = [0, 1, 2].map((a) => Math.round(s.p[v * 3 + a] * 1e4)).join();
      if (!at.has(key)) (at.set(key, pos.length / 3), pos.push(s.p[v * 3], s.p[v * 3 + 1], s.p[v * 3 + 2]));
      idx.push(at.get(key));
    }
    const P = new Float32Array(pos), I = new Uint32Array(idx);
    const target = Math.max(24, Math.floor((I.length * share) / 3) * 3);
    let kept = target >= I.length ? I : MeshoptSimplifier.simplify(I, P, 3, target, 1, [])[0];
    if (kept.length < 3) kept = I;
    // Back to flat faces, each with its own corners and its own facing.
    for (let t = 0; t < kept.length; t += 3) {
      const [a, b, c] = [kept[t], kept[t + 1], kept[t + 2]].map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]);
      const u = b.map((v, k) => v - a[k]), w = c.map((v, k) => v - a[k]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const l = Math.hypot(...n);
      if (l < 1e-12) continue;
      const base = out.p.length / 3;
      for (const q of [a, b, c]) (out.p.push(...q), out.n.push(n[0] / l, n[1] / l, n[2] / l), out.c.push(...col));
      out.i.push(base, base + 1, base + 2);
    }
  }
  return out;
}

const LOW = (n) => readItem(path.join(lowDir, n + '.glb'), 0);
const ULT = (n) => readItem(path.join(ultDir, n + '.glb'), REAL[n]);
const item = {
  tomato: simpler(await ULT('Tomato'), 0.12),
  pepper: simpler(await ULT('Pepper Green'), 0.04),
  gardenEgg: simpler(await LOW('egg'), 0.3), // garden eggs: small, round and cream (painted below)
  banana: simpler(await LOW('banana'), 0.15),
  orange: simpler(await LOW('lemon'), 0.15), // Ghana oranges: green-yellow, round
  avocado: simpler(await ULT('Avocado'), 0.1),
  carrot: simpler(await LOW('carrot'), 0.25),
  apple: simpler(await LOW('apple'), 0.12),
  pear: simpler(await LOW('pear'), 0.15),
  melon: simpler(await LOW('watermelon_slice'), 0.3),
  pumpkin: simpler(await ULT('Pumpkin'), 0.05),
  egg: simpler(await LOW('egg'), 0.1),
  loaf: simpler(await ULT('Bread'), 0.12), // tea bread / sugar bread
  sliced: simpler(await LOW('bread_loaf'), 1),
  bofrot: simpler(await ULT('Tomato'), 0.06), // bofrot (puff-puff): a round ball, painted brown
  croissant: simpler(await LOW('croissant'), 0.2),
  bottle: simpler(await ULT('Bottle'), 0.15),
  bottleRed: simpler(await ULT('Bottle-Pc8dM9Ja4V'), 0.15),
  soda: simpler(await ULT('Soda'), 0.08),
  juice: await LOW('juice_box'),
  milk: simpler(await LOW('milk_bottle'), 0.2),
  chicken: simpler(await LOW('drumstick'), 0.3),
  friedEgg: simpler(await LOW('fried_egg'), 0.25),
  pot: simpler(await ULT('Cooking Pot'), 0.4),
  pan: simpler(await ULT('Frying Pan'), 0.45),
  plate: box(0.24, 0.015, 0.24, 0, 0.0075, 0, '#f2efe6'), // a plain plate (the pack's is 200 triangles)
  fries: simpler(await ULT('Fries'), 0.25),
  corndog: simpler(await ULT('Corndog'), 0.15), // a khebab stick at a glance
  lettuce: simpler(await ULT('Lettuce'), 0.12),
  cupcake: simpler(await LOW('cupcake'), 0.25),
  ice: simpler(await LOW('ice_cream_cone'), 0.4),
  coffee: simpler(await LOW('coffee_cup'), 0.12),
};
console.log('items', Object.fromEntries(Object.entries(item).map(([k, s]) => [k, tris(s)])));

// ---------- Placing many ----------
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// A pile: n items in a mound of radius r on a surface at height y (a pyramid like the sellers make).
function pile(it, n, x, z, r, y, { scale = 1, tint = null, lift = 0.6, tilt = 0.4 } = {}) {
  const s = shape();
  for (let k = 0; k < n; k++) {
    const t = Math.sqrt((k + 0.5) / n); // inside first (on top), outside last
    const a = k * 2.399963 + rnd() * 0.4; // golden angle
    const d = r * t;
    const h = (1 - t) * r * lift;
    const sc = scale * (0.88 + rnd() * 0.24);
    const col = typeof tint === 'function' ? tint(k) : tint;
    append(s, placed(it, { x: x + Math.cos(a) * d, y: y + h, z: z + Math.sin(a) * d, yaw: rnd() * 6.28, tilt: (rnd() - 0.5) * tilt, scale: sc, tint: col }));
  }
  return s;
}
const T = (hex) => lin(hex);
// Garden eggs: cream with a green top; plantain: green to yellow; oranges: green-yellow.
const creamGreen = (k) => (k % 4 === 3 ? lin('#c9d9a0') : lin('#f1edd2'));
const plantainTint = (k) => [T('#7fa53a'), T('#a9b545'), T('#d9b94a'), T('#e2c255')][k % 4];
// Ripe tomatoes: bright red with the green top kept.
const ripe = (c) => (c[1] > c[0] ? c : lin('#d8321e'));
const orangeTint = (k) => [T('#b8c34a'), T('#d6b33e'), T('#9fbf45')][k % 3];

// Kelewele: cubes of ripe plantain fried dark orange-brown, with roasted groundnuts. Our own shape.
function keleweleCubes(n, x, z, r, y, size = 0.022, lift = 0.35) {
  const s = shape();
  const cols = ['#b4521a', '#c8641c', '#8f3c12', '#d9782a', '#a24614'].map(lin);
  for (let k = 0; k < n; k++) {
    const t = Math.sqrt((k + 0.5) / n), a = k * 2.399963 + rnd() * 0.5, d = r * t;
    const sz = size * (0.8 + rnd() * 0.45);
    const c = placed(box(sz, sz * 0.9, sz * 1.15, 0, sz * 0.45, 0, cols[k % cols.length], true), { x: x + Math.cos(a) * d, y: y + (1 - t) * r * lift, z: z + Math.sin(a) * d, yaw: rnd() * 6.28, tilt: (rnd() - 0.5) * 0.9 });
    append(s, c);
  }
  return s;
}
function groundnuts(n, x, z, r, y) {
  const s = shape();
  for (let k = 0; k < n; k++) {
    const a = rnd() * 6.28, d = r * Math.sqrt(rnd());
    append(s, box(0.012, 0.009, 0.016, x + Math.cos(a) * d, y + 0.005, z + Math.sin(a) * d, '#c79a62'));
  }
  return s;
}

// ---------- The pieces ----------
const pieces = {};
const TOP = 0.8; // the stall tables' top
const stallTable = () => table(2.5, 0.95, TOP);
// Market stand fronts face +z: goods towards the front, a crate or basin behind.
pieces['stall-tomato'] = [
  stallTable(),
  placed(basin(0.24, 0.1), { x: -0.8, y: TOP, z: 0.1 }),
  mound(0.2, 0.07, TOP + 0.07, '#9c1a10', 8, -0.8, 0.1),
  pile(item.tomato, 10, -0.8, 0.1, 0.2, TOP + 0.09, { tint: ripe }),
  pile(item.tomato, 4, -0.25, 0.25, 0.07, TOP, { tint: ripe }), // small heaps sold by the pile
  pile(item.tomato, 4, 0.1, 0.25, 0.07, TOP, { tint: ripe }),
  placed(basin(0.22, 0.09), { x: 0.65, y: TOP, z: 0.05 }),
  mound(0.19, 0.05, TOP + 0.07, '#2f5a1c', 8, 0.65, 0.05),
  pile(item.pepper, 9, 0.65, 0.05, 0.18, TOP + 0.08),
  pile(item.gardenEgg, 10, -0.05, -0.18, 0.14, TOP, { tint: creamGreen, scale: 1.25 }),
];
pieces['stall-plantain'] = [
  stallTable(),
  // Bunches of plantain lying across the table, ripe ones at the front.
  pile(item.banana, 12, -0.6, 0.05, 0.3, TOP, { scale: 1.7, tint: plantainTint, lift: 0.3 }),
  pile(item.banana, 8, 0.15, 0.1, 0.22, TOP, { scale: 1.7, tint: plantainTint, lift: 0.3 }),
  placed(basin(0.22, 0.09), { x: 0.8, y: TOP, z: 0.1 }),
  mound(0.19, 0.06, TOP + 0.07, '#a8a83a', 8, 0.8, 0.1),
  pile(item.orange, 10, 0.8, 0.1, 0.18, TOP + 0.09, { scale: 0.85, tint: orangeTint }),
];
pieces['stall-bread'] = [
  stallTable(),
  // Tea bread and sugar bread in rows, sliced loaves in their bags behind.
  ...[-0.9, -0.6, -0.3].flatMap((x) => [placed(item.loaf, { x, y: TOP, z: 0.2, yaw: 1.57 }), placed(item.loaf, { x, y: TOP, z: -0.12, yaw: 1.57 })]),
  placed(item.loaf, { x: -0.6, y: TOP + 0.09, z: 0.04, yaw: 1.57 }),
  ...[0.1, 0.35].map((x) => placed(item.sliced, { x, y: TOP, z: -0.1, yaw: 1.57, scale: 1.3 })),
  placed(box(0.5, 0.03, 0.35, 0.75, TOP + 0.015, 0.12, '#c9ccd0')), // a tray of bofrot
  pile(item.bofrot, 14, 0.75, 0.12, 0.16, TOP + 0.03, { scale: 0.7, tint: T('#b8692a'), lift: 0.5 }),
  ...[0.2, 0.35].map((x) => placed(item.croissant, { x, y: TOP, z: 0.25, yaw: 0.3 })),
];
pieces['stall-drinks'] = [
  stallTable(),
  // A cooler box, crates of bottles, a row of juice packs.
  box(0.6, 0.42, 0.45, -0.8, TOP + 0.21, -0.1, '#2a68c8'),
  box(0.62, 0.05, 0.47, -0.8, TOP + 0.445, -0.1, '#f2efe6'),
  box(0.5, 0.12, 0.35, 0.1, TOP + 0.06, -0.1, '#c8442e'),
  ...[0, 1, 2].flatMap((i) => [placed(item.bottle, { x: -0.07 + i * 0.11, y: TOP + 0.02, z: -0.16 }), placed(item.bottleRed, { x: -0.07 + i * 0.11, y: TOP + 0.02, z: -0.04 })]),
  ...[0, 1, 2, 3].map((i) => placed(item.soda, { x: 0.55 + i * 0.1, y: TOP, z: 0.25 })),
  ...[0, 1, 2, 3, 4, 5].map((i) => placed(item.juice, { x: -0.55 + i * 0.07, y: TOP, z: 0.3, scale: 1.2 })),
  ...[0, 1, 2].map((i) => placed(item.milk, { x: 0.6 + i * 0.12, y: TOP, z: 0.02, scale: 1.3 })),
];
function eggTray(x, z, y) {
  const s = box(0.3, 0.02, 0.3, x, y + 0.01, z, '#c9b48a');
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) append(s, placed(item.egg, { x: x - 0.11 + a * 0.073, y: y + 0.015, z: z - 0.11 + b * 0.073, scale: 1.05 }));
  return s;
}
pieces['stall-eggs'] = [
  stallTable(),
  box(0.3, 0.06, 0.3, -0.85, TOP + 0.03, 0.1, '#c9b48a'), eggTray(-0.85, 0.1, TOP + 0.06), eggTray(-0.5, 0.15, TOP),
  placed(basin(0.2, 0.08), { x: 0.1, y: TOP, z: 0.1 }),
  pile(item.avocado, 7, 0.1, 0.1, 0.15, TOP + 0.06),
  pile(item.carrot, 10, 0.65, 0.12, 0.18, TOP, { lift: 0.2 }),
  pile(item.lettuce, 2, 0.75, -0.25, 0.12, TOP, { lift: 0.1 }),
];
pieces['stall-fruit'] = [
  stallTable(),
  ...[0, 1, 2, 3, 4].map((i) => placed(item.melon, { x: -1 + i * 0.12, y: TOP, z: 0.25, scale: 1.9, yaw: 1.57 })),
  pile(item.pumpkin, 3, -0.6, -0.15, 0.2, TOP, { lift: 0.1, tint: (c) => (c[1] > c[0] * 0.5 ? lin('#3d5a22') : lin('#e07a1e')) }),
  pile(item.apple, 8, -0.05, 0.12, 0.14, TOP),
  pile(item.pear, 8, 0.35, 0.12, 0.14, TOP),
  placed(basin(0.21, 0.09), { x: 0.85, y: TOP, z: 0.05 }),
  mound(0.19, 0.06, TOP + 0.07, '#a8a83a', 8, 0.85, 0.05),
  pile(item.orange, 10, 0.85, 0.05, 0.18, TOP + 0.09, { scale: 0.85, tint: orangeTint }),
];
pieces['stall-chopbar'] = [
  stallTable(),
  // A big pot of waakye with a lid, plates of fried chicken and eggs: a small chop bar.
  placed(item.pot, { x: -0.75, y: TOP, z: -0.1, scale: 0.9 }),
  ...[0, 1].map((i) => placed(item.plate, { x: -0.05 + i * 0.32, y: TOP, z: 0.15 })),
  pile(item.chicken, 5, -0.05, 0.15, 0.08, TOP + 0.02, { lift: 0.4 }),
  pile(item.friedEgg, 4, 0.27, 0.15, 0.06, TOP + 0.02, { lift: 0.2, tilt: 0.1 }),
  placed(item.pan, { x: 0.8, y: TOP, z: 0.0, yaw: 1.57, scale: 0.75 }),
  mound(0.17, 0.04, TOP + 0.03, '#a8461a', 8, 0.8, 0.0),
  keleweleCubes(20, 0.8, 0.0, 0.15, TOP + 0.04),
  ...[0, 1].map((i) => placed(item.coffee, { x: 0.35 + i * 0.12, y: TOP, z: -0.28 })),
];
pieces['stall-kelewele'] = [
  stallTable(),
  // Kelewele, khebab on sticks and fried yam: the evening snacks.
  placed(item.pan, { x: -0.7, y: TOP, z: 0.05, yaw: 1.57 }),
  mound(0.22, 0.05, TOP + 0.03, '#a8461a', 8, -0.7, 0.05),
  keleweleCubes(32, -0.7, 0.05, 0.2, TOP + 0.045),
  groundnuts(14, -0.15, 0.2, 0.1, TOP + 0.02),
  placed(box(0.42, 0.02, 0.3, 0.3, TOP + 0.01, 0.15, '#c9ccd0')),
  ...[0, 1, 2, 3, 4, 5].map((i) => placed(item.corndog, { x: 0.15 + i * 0.06, y: TOP + 0.02, z: 0.15, tilt: 1.5, yaw: 0.1, tint: T('#7a3a1a') })),
  placed(item.fries, { x: 0.8, y: TOP, z: 0.15, tint: (c) => (c[0] > 0.3 && c[1] > 0.2 ? lin('#e8d39a') : c) }),
  placed(item.fries, { x: 0.95, y: TOP, z: -0.1, tint: (c) => (c[0] > 0.3 && c[1] > 0.2 ? lin('#e8d39a') : c) }),
];

// The umbrella tables (top 0.78 m): one thing each.
const UT = 0.78;
pieces['table-kelewele'] = [placed(item.pan, { y: UT, yaw: 1.57, scale: 0.75 }), mound(0.17, 0.04, UT + 0.03, '#a8461a'), keleweleCubes(18, 0, 0, 0.15, UT + 0.04)];
pieces['table-tomato'] = [placed(basin(0.24, 0.1), { y: UT }), mound(0.21, 0.07, UT + 0.08, '#9c1a10'), pile(item.tomato, 8, 0, 0, 0.2, UT + 0.1, { tint: ripe })];
pieces['table-plantain'] = [pile(item.banana, 9, 0, 0, 0.24, UT, { scale: 1.7, tint: plantainTint, lift: 0.3 })];
pieces['table-oranges'] = [placed(basin(0.24, 0.1), { y: UT }), mound(0.21, 0.07, UT + 0.08, '#a8a83a'), pile(item.orange, 10, 0, 0, 0.2, UT + 0.1, { scale: 0.85, tint: orangeTint })];
pieces['table-bread'] = [...[-0.25, 0, 0.25].map((x) => placed(item.loaf, { x, y: UT, yaw: 1.57 })), placed(item.loaf, { x: -0.12, y: UT + 0.09, yaw: 1.57 })];
pieces['table-bofrot'] = [placed(box(0.5, 0.03, 0.35, 0, UT + 0.015, 0, '#c9ccd0')), pile(item.bofrot, 14, 0, 0, 0.16, UT + 0.03, { scale: 0.7, tint: T('#b8692a'), lift: 0.5 })];
pieces['table-chicken'] = [placed(item.plate, { y: UT }), pile(item.chicken, 5, 0, 0, 0.09, UT + 0.02, { lift: 0.4 }), placed(item.plate, { x: 0.3, y: UT }), pile(item.friedEgg, 3, 0.3, 0, 0.06, UT + 0.02, { lift: 0.2, tilt: 0.1 })];
pieces['table-drinks'] = [...[0, 1, 2, 3].map((i) => placed(i % 2 ? item.bottle : item.bottleRed, { x: -0.18 + i * 0.12, y: UT })), ...[0, 1, 2].map((i) => placed(item.soda, { x: -0.12 + i * 0.12, y: UT, z: 0.18 }))];

// Head loads (sat on the basin/tray the walkers already carry: basin rim 0.15 m, tray 0.05 m).
pieces['head-oranges'] = [ring(0.2, 0.34, 0, 0.15, 10, '#c9ccd0', true), mound(0.3, 0.1, 0.12, '#a8a83a'), pile(item.orange, 9, 0, 0, 0.26, 0.15, { scale: 0.9, tint: orangeTint })];
pieces['head-tomato'] = [ring(0.2, 0.34, 0, 0.15, 10, '#c9ccd0', true), mound(0.3, 0.1, 0.12, '#9c1a10'), pile(item.tomato, 6, 0, 0, 0.26, 0.15, { tint: ripe })];
pieces['head-bread'] = [box(0.62, 0.05, 0.46, 0, 0.025, 0, '#8a6a4a'), ...[-0.2, 0, 0.2].flatMap((x) => [placed(item.loaf, { x, y: 0.05, z: -0.08, yaw: 1.57, scale: 0.85 }), placed(item.loaf, { x, y: 0.05, z: 0.12, yaw: 1.57, scale: 0.85 })])];

// Mission 1: a paper of kelewele with groundnuts (held in the hand: its middle is at 0, 0, 0) and
// Auntie Dede's big pan.
pieces['kelewele-wrap'] = [
  append(box(0.17, 0.006, 0.13, 0, -0.03, 0, '#e9e1c8'), append(box(0.17, 0.05, 0.006, 0, -0.005, 0.062, '#ddd3b4'), box(0.17, 0.05, 0.006, 0, -0.005, -0.062, '#ddd3b4'))),
  keleweleCubes(20, -0.015, 0, 0.06, -0.027, 0.02, 0.6),
  groundnuts(6, 0.05, 0.02, 0.025, -0.02),
];
pieces['kelewele-pan'] = [placed(item.pan, { yaw: 1.57, scale: 0.85 }), mound(0.2, 0.045, 0.03, '#a8461a'), keleweleCubes(36, 0, 0, 0.19, 0.045)];

// ---------- Write one glb ----------
const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene();
const material = doc.createMaterial('food').setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(0.75);
const report = {};
for (const [name, parts] of Object.entries(pieces)) {
  const s = parts.reduce((acc, q) => append(acc, q), shape());
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(s.p)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(s.n)).setBuffer(buffer))
    .setAttribute('COLOR_0', doc.createAccessor().setType('VEC3').setArray(new Float32Array(s.c)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(s.i)).setBuffer(buffer))
    .setMaterial(material);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  report[name] = tris(s);
}
await doc.transform(weld(), quantize({ quantizePosition: 14, quantizeNormal: 8, quantizeColor: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
await io.write(outFile, doc);
console.log('triangles', report);
console.log('wrote', outFile, (fs.statSync(outFile).size / 1024).toFixed(0), 'KB');
