// Builds walkable street networks for all of Greater Accra, cut into area files
// (0.05° squares, about 5.5 km, the same areas as the live rooms). Phones load only the
// areas a walk needs. Streets that cross an area edge appear in both files with the same
// points, so the game can join neighbouring areas seamlessly.
//
// Usage: node scripts/build-roads-areas.mjs apps/web/public/data/roads

import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = process.argv[2];
if (!outDir) {
  console.error('Usage: node scripts/build-roads-areas.mjs <output folder>');
  process.exit(1);
}

const REGION = { south: 5.45, west: -0.55, north: 6.1, east: 0.72 }; // Greater Accra, as the map tiles
const BLOCK = 0.2; // download in blocks of this size, to keep each request reasonable
const AREA = 0.05; // area file size
const SCALE = 1e5;
const WALKABLE =
  'trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street|service|pedestrian|footway|path|steps|track';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

async function download(s, w, n, e) {
  const query = `[out:json][timeout:180];
way["highway"~"^(${WALKABLE})$"]["access"!~"^(private|no)$"](${s},${w},${n},${e});
(._;>;);
out skel qt;`;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const server of SERVERS) {
      try {
        const res = await fetch(server, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'ghana-life-build-script' } });
        if (res.ok) return await res.json();
      } catch {
        // try the next server
      }
    }
    await new Promise((r) => setTimeout(r, 30_000 * (attempt + 1)));
  }
  throw new Error(`Could not download block ${s},${w}. Try again later.`);
}

// area key -> { points: Map(coordKey -> index), nodes: [], edges: Set }
const areas = new Map();
const areaOf = (lon, lat) => `${Math.floor(lon / AREA)}_${Math.floor(lat / AREA)}`;
function areaData(key) {
  if (!areas.has(key)) areas.set(key, { index: new Map(), nodes: [], edges: new Set() });
  return areas.get(key);
}
function pointIn(area, lon, lat) {
  const qx = Math.round(lon * SCALE);
  const qy = Math.round(lat * SCALE);
  const k = `${qx},${qy}`;
  if (!area.index.has(k)) {
    area.index.set(k, area.nodes.length / 2);
    area.nodes.push(qx, qy);
  }
  return area.index.get(k);
}

let blocks = 0;
const seenWays = new Set();
for (let s = REGION.south; s < REGION.north; s += BLOCK) {
  for (let w = REGION.west; w < REGION.east; w += BLOCK) {
    const n = Math.min(s + BLOCK, REGION.north);
    const e = Math.min(w + BLOCK, REGION.east);
    blocks++;
    process.stdout.write(`\rBlock ${blocks}: ${s.toFixed(2)},${w.toFixed(2)}…          `);
    const osm = await download(s, w, n, e);
    const coords = new Map();
    for (const el of osm.elements) if (el.type === 'node') coords.set(el.id, [el.lon, el.lat]);
    for (const el of osm.elements) {
      if (el.type !== 'way' || seenWays.has(el.id)) continue; // ways on block edges come twice
      seenWays.add(el.id);
      const pts = el.nodes.map((id) => coords.get(id)).filter(Boolean);
      // Every area this street touches gets the whole street, so areas join up at the edges.
      const touched = new Set(pts.map(([lon, lat]) => areaOf(lon, lat)));
      for (const key of touched) {
        const area = areaData(key);
        for (let i = 1; i < pts.length; i++) {
          const a = pointIn(area, ...pts[i - 1]);
          const b = pointIn(area, ...pts[i]);
          if (a !== b) area.edges.add(a < b ? `${a},${b}` : `${b},${a}`);
        }
      }
    }
  }
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const list = [];
let bytes = 0;
for (const [key, area] of areas) {
  if (area.edges.size < 5) continue; // nearly empty: skip
  const edges = [...area.edges].flatMap((e) => e.split(',').map(Number));
  const json = JSON.stringify({ scale: SCALE, nodes: area.nodes, edges });
  await writeFile(join(outDir, `${key}.json`), json);
  bytes += json.length;
  list.push(key);
}
await writeFile(join(outDir, 'areas.json'), JSON.stringify({ size: AREA, areas: list.sort(), credit: '© OpenStreetMap contributors' }));
console.log(`\nWrote ${list.length} area files, ${(bytes / 1048576).toFixed(1)} MiB in total, to ${outDir}`);
