// Builds a walkable road network for part of Accra from OpenStreetMap (via the Overpass API).
// Output: a compact JSON file the game uses to find walking routes along real streets.
//
// Usage: node scripts/build-roads.mjs apps/web/public/data/roads-central.json
// The area is central Accra, from Korle Bu and Jamestown to Osu and Ridge (about 7 x 7 km).

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/build-roads.mjs <output.json>');
  process.exit(1);
}

const BBOX = { south: 5.525, west: -0.24, north: 5.59, east: -0.165 };

// Streets a person can walk on. Motorways are left out.
const WALKABLE =
  'trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|pedestrian|footway|path|steps|track';

const query = `[out:json][timeout:120];
way["highway"~"^(${WALKABLE})$"]["access"!~"^(private|no)$"](${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east});
(._;>;);
out skel qt;`;

// Public Overpass servers are often busy, so try each in turn.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function download() {
  for (const server of SERVERS) {
    console.log(`Downloading streets from ${new URL(server).host}…`);
    try {
      const res = await fetch(server, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        headers: { 'User-Agent': 'ghana-life-build-script' },
      });
      if (res.ok) return await res.json();
      console.log(`  busy (${res.status}), trying the next server`);
    } catch (e) {
      console.log(`  failed (${e.message}), trying the next server`);
    }
  }
  throw new Error('Every Overpass server was busy. Try again in a few minutes.');
}

const osm = await download();

// Give every OSM node used by a street a small index number.
const coords = new Map();
for (const el of osm.elements) if (el.type === 'node') coords.set(el.id, [el.lon, el.lat]);

const index = new Map();
const nodes = [];
const edges = new Set();
const idOf = (osmId) => {
  if (!index.has(osmId)) {
    index.set(osmId, nodes.length / 2); // two numbers (lon, lat) per point
    const [lon, lat] = coords.get(osmId);
    // About 1 m precision is plenty for walking.
    nodes.push(Math.round(lon * 1e5), Math.round(lat * 1e5));
  }
  return index.get(osmId);
};

for (const el of osm.elements) {
  if (el.type !== 'way') continue;
  const ids = el.nodes.filter((n) => coords.has(n));
  for (let i = 1; i < ids.length; i++) {
    const a = idOf(ids[i - 1]);
    const b = idOf(ids[i]);
    if (a !== b) edges.add(a < b ? `${a},${b}` : `${b},${a}`);
  }
}

// Keep only the main connected street network. Small islands (gated compounds,
// paths cut off at the edge of the area) would leave the avatar unable to go anywhere.
const pairs = [...edges].map((e) => e.split(',').map(Number));
const count = nodes.length / 2;
const parent = Int32Array.from({ length: count }, (_, i) => i);
const root = (x) => {
  while (parent[x] !== x) x = parent[x] = parent[parent[x]];
  return x;
};
for (const [a, b] of pairs) parent[root(a)] = root(b);
const sizes = new Map();
for (let i = 0; i < count; i++) sizes.set(root(i), (sizes.get(root(i)) ?? 0) + 1);
const main = [...sizes.entries()].sort((p, q) => q[1] - p[1])[0][0];

const renumber = new Int32Array(count).fill(-1);
const keptNodes = [];
for (let i = 0; i < count; i++) {
  if (root(i) !== main) continue;
  renumber[i] = keptNodes.length / 2;
  keptNodes.push(nodes[2 * i], nodes[2 * i + 1]);
}
const keptEdges = pairs.filter(([a]) => renumber[a] >= 0).flatMap(([a, b]) => [renumber[a], renumber[b]]);

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify({
  bbox: [BBOX.west, BBOX.south, BBOX.east, BBOX.north],
  scale: 1e5, // node coordinates are longitude and latitude times this number
  nodes: keptNodes, // [lon, lat, lon, lat, ...]
  edges: keptEdges, // [from, to, from, to, ...] node index pairs, walkable both ways
  credit: '© OpenStreetMap contributors',
}));
console.log(`Wrote ${keptNodes.length / 2} street points and ${keptEdges.length / 2} street segments to ${out} (dropped ${sizes.size - 1} small islands)`);
