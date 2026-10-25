// Finds the real road route from Kwame Nkrumah Circle to Nima on our own map tiles (OpenStreetMap
// data), and writes public/data/route-nima.json: the path, and the roads, areas and public landmarks
// passed on the way (for the ride's signboards). Run: node scripts/route/nima-route.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PbfReader as Protobuf } from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const web = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FROM = [-0.2166, 5.5694]; // Circle
const TO = [-0.1982, 5.5813]; // Nima
const Z = 15;
const M_LAT = 110574;
const M_LON = 111320 * Math.cos((5.575 * Math.PI) / 180);
const tx = (lng) => Math.floor(((lng + 180) / 360) * 2 ** Z);
const ty = (lat) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z);
const toXZ = ([lng, lat]) => [(lng - FROM[0]) * M_LON, (FROM[1] - lat) * M_LAT];

const roads = [];
const pois = [];
const places = [];
for (let x = tx(-0.226); x <= tx(-0.188); x++)
  for (let y = ty(5.592); y <= ty(5.562); y++) {
    const f = path.join(web, `public/tiles/accra/${Z}/${x}/${y}.pbf`);
    if (!fs.existsSync(f)) continue;
    const tile = new VectorTile(new Protobuf(fs.readFileSync(f)));
    for (const [name, layer] of Object.entries(tile.layers)) {
      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i);
        const gj = feat.toGeoJSON(x, y, Z);
        if (name === 'roads' && gj.geometry.type.includes('LineString')) {
          const lines = gj.geometry.type === 'LineString' ? [gj.geometry.coordinates] : gj.geometry.coordinates;
          for (const l of lines) roads.push({ kind: feat.properties.kind, detail: feat.properties.kind_detail, name: feat.properties.name ?? '', ref: feat.properties.ref ?? '', pts: l.map(toXZ) });
        } else if (name === 'pois' && gj.geometry.type === 'Point') pois.push({ kind: feat.properties.kind, name: feat.properties.name ?? '', at: toXZ(gj.geometry.coordinates) });
        else if (name === 'places' && gj.geometry.type === 'Point') places.push({ kind: feat.properties.kind, name: feat.properties.name ?? '', at: toXZ(gj.geometry.coordinates) });
      }
    }
  }
console.log('roads', roads.length, 'pois', pois.length, 'places', places.length, 'layers seen');

// A grid of 4 m squares over the roads (roads that cross always join), cost by road kind.
const CELL = 4;
const cost = { highway: 1, major_road: 1, medium_road: 1.1, minor_road: 1.6, other: 2.5, path: 6 };
const grid = new Map(); // key -> { c: cost, road index }
const K = (i, j) => `${i},${j}`;
roads.forEach((r, ri) => {
  if (r.kind === 'path' && r.detail === 'steps') return;
  const c = cost[r.kind] ?? 2;
  for (let k = 1; k < r.pts.length; k++) {
    const [ax, az] = r.pts[k - 1];
    const [bx, bz] = r.pts[k];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
    for (let s = 0; s <= n; s++) {
      const key = K(Math.round((ax + ((bx - ax) * s) / n) / CELL), Math.round((az + ((bz - az) * s) / n) / CELL));
      const old = grid.get(key);
      if (!old || c < old.c) grid.set(key, { c, ri });
    }
  }
});
const nearest = ([x, z]) => {
  let best = null;
  let bd = Infinity;
  for (const key of grid.keys()) {
    const [i, j] = key.split(',').map(Number);
    const d = Math.hypot(i * CELL - x, j * CELL - z);
    if (d < bd && (grid.get(key).c <= 1.1 || bd === Infinity)) [best, bd] = [[i, j], d];
  }
  return best;
};
const start = nearest([0, 0]);
const goal = nearest(toXZ(TO));
// A* (a plain sorted frontier is fine here: a few thousand cells).
const open = [[0, start[0], start[1]]];
const g = new Map([[K(...start), 0]]);
const came = new Map();
const h = (i, j) => Math.hypot(i - goal[0], j - goal[1]);
let found = false;
while (open.length) {
  open.sort((a, b) => a[0] - b[0]);
  const [, i, j] = open.shift();
  if (i === goal[0] && j === goal[1]) {
    found = true;
    break;
  }
  const base = g.get(K(i, j));
  for (let di = -1; di <= 1; di++)
    for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      const cell = grid.get(K(i + di, j + dj));
      if (!cell) continue;
      const c = base + (di && dj ? 1.414 : 1) * cell.c;
      if (c < (g.get(K(i + di, j + dj)) ?? Infinity)) {
        g.set(K(i + di, j + dj), c);
        came.set(K(i + di, j + dj), K(i, j));
        open.push([c + h(i + di, j + dj), i + di, j + dj]);
      }
    }
}
if (!found) throw new Error('no route found');
const cells = [];
for (let k = K(...goal); k; k = came.get(k)) cells.push(k.split(',').map(Number));
cells.reverse();
const pts = cells.map(([i, j]) => [i * CELL, j * CELL]);
// Smooth (Ramer–Douglas–Peucker, 3 m).
const simple = (p, eps) => {
  if (p.length < 3) return p;
  const [a, b] = [p[0], p[p.length - 1]];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  let w = 0;
  let at = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / len;
    if (d > w) [w, at] = [d, i];
  }
  return w < eps ? [a, b] : [...simple(p.slice(0, at + 1), eps).slice(0, -1), ...simple(p.slice(at), eps)];
};
const line = simple(pts, 3);
let total = 0;
for (let i = 1; i < line.length; i++) total += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
// What is passed on the way: road names in order, areas and public landmarks within 120 m.
const along = [];
let walked = 0;
for (let i = 0; i < cells.length; i++) {
  const cell = grid.get(K(...cells[i]));
  if (i) walked += Math.hypot(cells[i][0] - cells[i - 1][0], cells[i][1] - cells[i - 1][1]) * CELL;
  const r = roads[cell.ri];
  const label = r.name || r.ref;
  if (label && (!along.length || along[along.length - 1].name !== label)) along.push({ type: 'road', name: label, at: Math.round(walked) });
}
const near = (p, r) => {
  let best = Infinity;
  let at = 0;
  let w = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) w += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const d = Math.hypot(pts[i][0] - p[0], pts[i][1] - p[1]);
    if (d < best) [best, at] = [d, w];
  }
  return best < r ? Math.round(at) : null;
};
const areaList = places.filter((p) => p.name).map((p) => ({ type: 'area', name: p.name, kind: p.kind, at: near(p.at, 450) })).filter((p) => p.at !== null);
const PUBLIC = ['marketplace', 'police', 'hospital', 'clinic', 'bus_station', 'place_of_worship', 'school', 'university', 'stadium', 'park', 'fire_station', 'post_office', 'fuel'];
const marks = pois.filter((p) => p.name && PUBLIC.includes(p.kind)).map((p) => ({ type: 'landmark', kind: p.kind, name: p.name, at: near(p.at, 90) })).filter((p) => p.at !== null);
const out = { from: 'Kwame Nkrumah Circle', to: 'Nima', lengthM: Math.round(total), path: line.map(([x, z]) => [+(FROM[0] + x / M_LON).toFixed(6), +(FROM[1] - z / M_LAT).toFixed(6)]), along: [...along, ...areaList, ...marks].sort((a, b) => a.at - b.at) };
fs.mkdirSync(path.join(web, 'public/data'), { recursive: true });
fs.writeFileSync(path.join(web, 'public/data/route-nima.json'), JSON.stringify(out, null, 1));
console.log('length', out.lengthM, 'm, points', out.path.length);
for (const a of out.along) console.log(a.at, a.type, a.kind ?? '', a.name);
