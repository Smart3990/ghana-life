// Makes the vehicle model files small for phones: joins duplicate points, packs positions and
// colours into fewer bytes, and compresses the result (meshopt). Same look, about a quarter of the size.
// Usage (after npm install in scripts/vehicles): node scripts/vehicles/optimise-vehicles.mjs <in folder> <out folder>
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, weld, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [src, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
for (const f of readdirSync(src).filter((f) => f.endsWith('.glb'))) {
  const doc = await io.read(join(src, f));
  await doc.transform(dedup(), weld(), quantize({ quantizeColor: 8 }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  await io.write(join(out, f), doc);
  console.log('optimised', f);
}
