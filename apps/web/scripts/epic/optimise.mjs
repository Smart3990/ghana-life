// Shrinks the converted Epic City GLBs for phones: joins identical corners (weld), drops unused data,
// stores positions in smaller numbers (quantize) and packs them with meshopt (three.js reads it with
// MeshoptDecoder). The shape is not simplified, so nothing changes in how a model looks.
//   node scripts/epic/optimise.mjs <converted folder> <out folder>
// Needs @gltf-transform/core, /functions, /extensions and meshoptimizer (npm i in a tools folder,
// then run with NODE_PATH pointing at its node_modules).
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(process.env.NODE_PATH ? path.join(process.env.NODE_PATH, 'x.js') : import.meta.url);
const { NodeIO } = require('@gltf-transform/core');
const { ALL_EXTENSIONS } = require('@gltf-transform/extensions');
const { weld, dedup, prune, quantize, meshopt, reorder } = require('@gltf-transform/functions');
const { MeshoptEncoder } = require('meshoptimizer');

const [src, out] = process.argv.slice(2).map((p) => path.resolve(p));
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
let before = 0, after = 0;
for (const f of walk(src).filter((f) => f.endsWith('.glb'))) {
  const rel = path.relative(src, f);
  const doc = await io.read(f);
  const skinned = doc.getRoot().listSkins().length > 0;
  await doc.transform(
    dedup(),
    weld(),
    reorder({ encoder: MeshoptEncoder }),
    // People and their animations keep full-size numbers for the joints; everything else is quantized.
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, ...(skinned || rel.includes('animations') ? { pattern: /^(POSITION|NORMAL|TEXCOORD_0)$/ } : {}) }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
    prune({ keepAttributes: true }), // keep the texture positions: the atlas is added by the game
  );
  const dest = path.join(out, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await io.write(dest, doc);
  before += fs.statSync(f).size;
  after += fs.statSync(dest).size;
}
console.log('before', (before / 1e6).toFixed(1), 'MB  after', (after / 1e6).toFixed(1), 'MB');
