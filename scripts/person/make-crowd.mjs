// Usage: node make-crowd.mjs <person.glb> <person-crowd.glb> [lite]
// With "lite": a third of the triangles and every move kept, for the player on Light phones.
// With "mass": about 1,000 to 2,000 triangles, for crowds of hundreds drawn in one go.
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
const mass = mode === 'mass'; // very light, for big crowds drawn all at once
const doc = await io.read(src);
const root = doc.getRoot();
// Street moves for crowds (the "mass" models also get the moves people do at places).
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Idle_Talking_Loop'];
const MASS_KEEP = [...KEEP, 'Jog_Fwd_Loop', 'Idle_TalkingPhone_Loop', 'Consume', 'Idle_FoldArms_Loop', 'Walk_Carry_Loop', 'Yes', 'Idle_No_Loop',
  'Idle_Rail_Call', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Dance_Loop', 'PickUp_Table', 'Farm_Harvest', 'Push_Loop', 'Fixing_Kneeling', 'Interact'];
if (!lite) for (const a of root.listAnimations()) if (!(mass ? MASS_KEEP : KEEP).includes(a.getName())) a.dispose();
// The eyes are kept (owner, 28 Oct 2026: close up, the crowd must have faces); the simplifier makes
// them a few dozen triangles. The game draws their white, iris and eyelids itself (crowd.ts).
await doc.transform(
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio: lite ? 0.33 : mass ? (/female/.test(src) ? 0.03 : 0.055) : 0.16, error: lite ? 0.002 : mass ? 0.03 : 0.004, lockBorder: false }),
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
