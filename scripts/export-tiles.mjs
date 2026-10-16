// Turns one .pmtiles map file into plain tile files: <out>/{z}/{x}/{y}.pbf
// Why: Cloudflare static hosting does not serve parts of a file, so the map
// is published as many small files instead (see docs/PROGRESS.md, T0a).
//
// Usage: node scripts/export-tiles.mjs data/accra.pmtiles apps/web/public/tiles/accra

import { open } from 'node:fs/promises';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PMTiles } from 'pmtiles';

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error('Usage: node scripts/export-tiles.mjs <input.pmtiles> <output folder>');
  process.exit(1);
}

// Reads byte ranges from a local file, which is what the pmtiles library expects.
class FileSource {
  constructor(handle, path) { this.handle = handle; this.path = path; }
  getKey() { return this.path; }
  async getBytes(offset, length) {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await this.handle.read(buf, 0, length, offset);
    return { data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead) };
  }
}

// Web Mercator tile numbers for a longitude/latitude at zoom z.
const tileX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const tileY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

const handle = await open(input, 'r');
const archive = new PMTiles(new FileSource(handle, input));
const header = await archive.getHeader();
const metadata = await archive.getMetadata();

await rm(outDir, { recursive: true, force: true });

let files = 0, bytes = 0, largest = 0;
for (let z = header.minZoom; z <= header.maxZoom; z++) {
  const [x0, x1] = [tileX(header.minLon, z), tileX(header.maxLon, z)];
  const [y0, y1] = [tileY(header.maxLat, z), tileY(header.minLat, z)];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const tile = await archive.getZxy(z, x, y);
      if (!tile) continue;
      const data = Buffer.from(tile.data);
      const dir = join(outDir, String(z), String(x));
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${y}.pbf`), data);
      files++; bytes += data.length; largest = Math.max(largest, data.length);
    }
  }
}

// Map settings the game needs later: zoom range, bounds and the data layers.
await writeFile(join(outDir, 'metadata.json'), JSON.stringify({
  minzoom: header.minZoom,
  maxzoom: header.maxZoom,
  bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat],
  center: [header.centerLon, header.centerLat, header.centerZoom],
  vector_layers: metadata.vector_layers,
  attribution: metadata.attribution,
}, null, 2));

await handle.close();
const mib = (n) => (n / 1048576).toFixed(1) + ' MiB';
console.log(`Wrote ${files} tiles, ${mib(bytes)} uncompressed, largest tile ${(largest / 1024).toFixed(0)} KiB`);
