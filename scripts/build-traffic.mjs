// Builds fixed driving routes for simulated traffic in central Accra (master plan T7).
// Every phone moves vehicles along these routes from the shared clock, so everyone sees
// the same traffic with no network messages.
//
// Usage: node scripts/build-traffic.mjs apps/web/public/data/traffic-central.json

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/build-traffic.mjs <output.json>');
  process.exit(1);
}

const BBOX = { south: 5.525, west: -0.24, north: 5.59, east: -0.165 }; // same area as walking
const DRIVABLE = 'trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential';
const ROUTES = 80;
const MIN_M = 1500;
const MAX_M = 5000;

const query = `[out:json][timeout:120];
way["highway"~"^(${DRIVABLE})$"]["access"!~"^(private|no)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
(._;>;);
out skel qt;`;

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function download() {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const server of SERVERS) {
      console.log(`Downloading roads from ${new URL(server).host}…`);
      try {
        const res = await fetch(server, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'ghana-life-build-script' } });
        if (res.ok) return await res.json();
        console.log(`  busy (${res.status})`);
      } catch (e) {
        console.log(`  failed (${e.message})`);
      }
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
  throw new Error('Every Overpass server was busy. Try again in a few minutes.');
}

const osm = await download();

// Road graph: node id -> neighbours.
const coords = new Map();
for (const el of osm.elements) if (el.type === 'node') coords.set(el.id, [el.lon, el.lat]);
const adj = new Map();
const link = (a, b) => {
  if (!adj.has(a)) adj.set(a, new Set());
  adj.get(a).add(b);
};
for (const el of osm.elements) {
  if (el.type !== 'way') continue;
  const ids = el.nodes.filter((n) => coords.has(n));
  for (let i = 1; i < ids.length; i++) {
    link(ids[i - 1], ids[i]);
    link(ids[i], ids[i - 1]);
  }
}

const M_LAT = 110574;
const M_LON = 111320 * Math.cos((5.56 * Math.PI) / 180);
const dist = (a, b) => {
  const [x1, y1] = coords.get(a);
  const [x2, y2] = coords.get(b);
  return Math.hypot((x1 - x2) * M_LON, (y1 - y2) * M_LAT);
};

// Main connected network only.
const ids = [...adj.keys()];
const seen = new Set();
let main = [];
for (const start of ids) {
  if (seen.has(start)) continue;
  const comp = [start];
  seen.add(start);
  for (let i = 0; i < comp.length; i++) {
    for (const n of adj.get(comp[i])) if (!seen.has(n)) { seen.add(n); comp.push(n); }
  }
  if (comp.length > main.length) main = comp;
}

// Seeded random numbers, so the routes are the same every time the script runs.
let seed = 20261017;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

// Shortest path (A*) between two road points.
function route(from, to) {
  const cost = new Map([[from, 0]]);
  const came = new Map();
  const open = [[dist(from, to), from]];
  const done = new Set();
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]);
    const [, cur] = open.shift();
    if (cur === to) {
      const path = [to];
      while (came.has(path[0])) path.unshift(came.get(path[0]));
      return path;
    }
    if (done.has(cur)) continue;
    done.add(cur);
    for (const n of adj.get(cur)) {
      const c = cost.get(cur) + dist(cur, n);
      if (c < (cost.get(n) ?? Infinity)) {
        cost.set(n, c);
        came.set(n, cur);
        open.push([c + dist(n, to), n]);
      }
    }
    if (done.size > 60_000) return null;
  }
  return null;
}

const routes = [];
let tries = 0;
while (routes.length < ROUTES && tries++ < ROUTES * 20) {
  const a = main[Math.floor(random() * main.length)];
  const b = main[Math.floor(random() * main.length)];
  const straight = dist(a, b);
  if (straight < MIN_M * 0.7 || straight > MAX_M) continue;
  const path = route(a, b);
  if (!path) continue;
  let length = 0;
  for (let i = 1; i < path.length; i++) length += dist(path[i - 1], path[i]);
  if (length < MIN_M || length > MAX_M * 1.4) continue;
  // Drive there and back, so each route is a loop a vehicle can repeat forever.
  const loop = [...path, ...path.slice(0, -1).reverse()];
  routes.push(loop.map((id) => coords.get(id).map((v) => Math.round(v * 1e5))));
  process.stdout.write(`\r${routes.length} routes`);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({ scale: 1e5, routes, credit: '© OpenStreetMap contributors' }));
console.log(`\nWrote ${routes.length} driving routes to ${out}`);
