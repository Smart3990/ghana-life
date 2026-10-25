// Copies the generated map data that is not stored in Git (map tiles and Greater Accra street files)
// from the live site onto this computer, so any computer can build and deploy the game safely.
// Without these files a deploy would publish the game without its map.
//
// Usage (from the ghana-life folder): node scripts/fetch-live-data.mjs
// Takes a few minutes; files already on this computer are skipped, so it can be run again.

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SITE = 'https://ghana-life-web.ghana-life-web.workers.dev';
const PUBLIC = join(import.meta.dirname, '..', 'apps', 'web', 'public');
const BBOX = [-0.55, 5.45, 0.72, 6.1]; // Greater Accra, as in the README's tile export
const MAX_ZOOM = 15;
const PARALLEL = 12;

const tileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** z);
};

const exists = (path) => access(path).then(() => true, () => false);

async function save(urlPath) {
  const file = join(PUBLIC, ...urlPath.split('/'));
  if (await exists(file)) return 'kept';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(SITE + '/' + urlPath);
      if (res.status === 404) return 'none'; // empty sea or countryside tile: there is nothing to copy
      if (!res.ok) throw new Error(String(res.status));
      const body = Buffer.from(await res.arrayBuffer());
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, body);
      return 'saved';
    } catch {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return 'failed';
}

async function run(label, paths) {
  const counts = { saved: 0, kept: 0, none: 0, failed: 0 };
  let done = 0;
  for (let i = 0; i < paths.length; i += PARALLEL) {
    const results = await Promise.all(paths.slice(i, i + PARALLEL).map(save));
    for (const r of results) counts[r]++;
    done += results.length;
    if (done % 600 < PARALLEL || done === paths.length) process.stdout.write(`\r${label}: ${done} of ${paths.length}`);
  }
  console.log(`\n${label}: ${counts.saved} copied, ${counts.kept} already here, ${counts.none} empty, ${counts.failed} failed`);
  return counts.failed;
}

const tiles = [];
for (let z = 0; z <= MAX_ZOOM; z++) {
  for (let x = tileX(BBOX[0], z); x <= tileX(BBOX[2], z); x++) {
    for (let y = tileY(BBOX[3], z); y <= tileY(BBOX[1], z); y++) tiles.push(`tiles/accra/${z}/${x}/${y}.pbf`);
  }
}
let failed = await run('Map tiles', tiles);

const index = await (await fetch(`${SITE}/data/roads/areas.json`)).json();
failed += await run('Street files', ['data/roads/areas.json', ...index.areas.map((a) => `data/roads/${a}.json`)]);

if (failed) {
  console.log('Some files could not be copied. Check the internet connection and run this again.');
  process.exit(1);
}
console.log('All done: this computer now has the map and street data, and can deploy safely.');
