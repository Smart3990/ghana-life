// Usage: node optimise-person.mjs <blender-export.glb> <person.glb>
// Shrinks the Blender export for the web: drops unused vertex data, shrinks and converts textures
// to WebP (keeping the clothes mask in the alpha channel exact), samples animations more sparsely
// and compresses everything with meshopt.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [src, out] = process.argv.slice(2);
const doc = await io.read(src);
const root = doc.getRoot();
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  for (const sem of p.listSemantics()) if (/^COLOR_|^TEXCOORD_[1-9]/.test(sem)) p.setAttribute(sem, null);
}
// Name materials plainly for the game code.
for (const m of root.listMaterials()) {
  const n = m.getName();
  m.setName(/Superhero/.test(n) ? 'body' : /Eyes/.test(n) ? 'eyes' : 'hair');
  m.setDoubleSided(false);
}
// Animation tracks that never move a bone away from its rest pose are dropped: they only make the
// file's index (JSON) bigger. Leaf bones (finger tips, toe ends) never deform anything either.
let dropped = 0;
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    const path = ch.getTargetPath();
    const out = ch.getSampler().getOutput().getArray();
    const rest = path === 'rotation' ? node.getRotation() : path === 'translation' ? node.getTranslation() : path === 'scale' ? node.getScale() : null;
    if (!rest) continue;
    const n = rest.length;
    let still = /leaf/i.test(node.getName());
    if (!still) {
      still = true;
      for (let i = 0; i < out.length && still; i += n) {
        let d = 0;
        for (let k = 0; k < n; k++) d = Math.max(d, Math.abs(out[i + k] - rest[k]));
        if (path === 'rotation') { // q and -q are the same rotation
          let d2 = 0;
          for (let k = 0; k < n; k++) d2 = Math.max(d2, Math.abs(out[i + k] + rest[k]));
          d = Math.min(d, d2);
        }
        if (d > (path === 'translation' ? 0.0005 : 0.0008)) still = false;
      }
    }
    if (still) { ch.getSampler().dispose(); ch.dispose(); dropped++; }
  }
}
console.log('animation tracks dropped', dropped);
await doc.transform(dedup(), prune());
const body = root.listMaterials().find((m) => m.getName() === 'body');
const bodyTex = new Set([body.getBaseColorTexture(), body.getNormalTexture()]);
for (const t of root.listTextures()) t.setName(bodyTex.has(t) ? (t === body.getBaseColorTexture() ? 'player_base' : 'player_normal') : t.getName());
await doc.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^baseColor/, pattern: /^player_base$/, resize: [1024, 1024], quality: 88, effort: 100, nearLossless: false, lossless: false }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^normal/, pattern: /^player_normal$/, resize: [1024, 1024], quality: 85 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /Hair/, resize: [256, 256], quality: 80 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', pattern: /Eye/, resize: [128, 128], quality: 85 }),
  resample({ tolerance: 0.0015 }),
  prune(),
  prune(),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
);
await io.write(out, doc);
for (const t of root.listTextures()) console.log('texture', t.getName(), t.getMimeType(), t.getSize()?.join('x'), Math.round(t.getImage().byteLength / 1024) + ' KB');
console.log('animations', root.listAnimations().map((a) => a.getName()).join(' '));
