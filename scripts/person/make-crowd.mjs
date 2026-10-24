// Usage: node make-crowd.mjs <person.glb> <person-crowd.glb> [lite]
// With "lite": a third of the triangles and every move kept, for the player on Light phones.
// A light version of a person for crowds: about a sixth of the triangles, small textures and only
// the moves people in the street need (idle, walk, talk). Same skin and clothes mask as the player.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, simplify, weld, textureCompress, meshopt, dedup } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, out, mode] = process.argv.slice(2);
const lite = mode === 'lite';
const doc = await io.read(src);
const root = doc.getRoot();
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Idle_Talking_Loop'];
if (!lite) for (const a of root.listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
// The eyes are tiny at crowd distance: drop them.
if (!lite) for (const n of root.listNodes()) if (n.getMesh() && /Face\.001/.test(n.getMesh().getName())) n.getMesh().dispose();
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: lite ? 0.33 : 0.16, error: lite ? 0.002 : 0.004, lockBorder: false }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /player_base/, resize: lite ? [1024, 1024] : [512, 512], quality: 85 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /player_normal/, resize: [256, 256], quality: 80 }),
  dedup(),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
let tris = 0;
for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices().getCount() / 3;
await io.write(out, doc);
console.log(out.split('/').pop(), 'triangles', tris, 'animations', root.listAnimations().map((a) => a.getName()).join(' '));
