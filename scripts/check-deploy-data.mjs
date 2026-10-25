// Safety check before every deploy: stops if the map tiles or street files are missing on this
// computer, because a deploy without them would publish the game without its map.
// Run automatically by "npm run deploy" in apps/web.

import { readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

const PUBLIC = join(import.meta.dirname, '..', 'apps', 'web', 'public');

async function countFiles(dir) {
  let n = 0;
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) n += entry.isDirectory() ? await countFiles(join(dir, entry.name)) : 1;
  } catch {
    return 0;
  }
  return n;
}

const tiles = await countFiles(join(PUBLIC, 'tiles', 'accra'));
const roadsIndex = await access(join(PUBLIC, 'data', 'roads', 'areas.json')).then(() => true, () => false);
const roads = await countFiles(join(PUBLIC, 'data', 'roads'));

// The full set is about 9,654 tiles and a few hundred street files.
if (tiles < 9000 || !roadsIndex || roads < 100) {
  console.error(`
STOP: this computer does not have the full map data, so deploying now would break the live map.
  Map tiles found:    ${tiles} (need about 9,654)
  Street files found: ${roads}${roadsIndex ? '' : ' (areas.json missing)'}

Fix: from the ghana-life folder, run
  node scripts/fetch-live-data.mjs
then run "npm run deploy" again.
`);
  process.exit(1);
}
console.log(`Map data check: ${tiles} tiles and ${roads} street files present. OK to deploy.`);
