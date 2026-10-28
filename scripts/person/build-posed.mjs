// Builds the still crowd (step 5 of the Epic City plan) from "Posed Background Characters" by
// Quaternius (CC0, https://quaternius.com): people standing, hands on hips, waving, looking up, covering
// their eyes, picking something up, sitting and cheering. They do not move (no skeleton), so hundreds
// can stand in the streets for almost nothing.
//
// For every pose it:
//   - scales the person to a real height (men 1.72 m, women 1.62 m), feet on the ground, facing +z;
//   - fits a hairstyle from the same pack onto the head, turned with the head (the head's own points,
//     matched between poses of the same body);
//   - adds a face: the white of each eye, a dark iris, the brows and the mouth, laid on the face's surface;
//   - marks each part (skin, top, bottom, shoes, hair, eye white, iris), so the game colours every
//     person differently (Ghanaian skin tones, Accra clothes) from one shape.
// Usage: node build-posed.mjs "<Posed Background Characters folder>" <out folder>
// Writes posed-male.glb and posed-female.glb (one mesh per pose, attribute _PART).
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);

const [src, outDir] = process.argv.slice(2);
const PART = { Skin: 0, Shirt: 1, Pants: 2, Shoes: 3, Hair: 4, 'Hair.001': 4, HairTie: 4, White: 5, Iris: 6, Lips: 7 };

function readObj(file) {
  const v = [];
  const tris = []; // [a, b, c, part]
  let part = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (line.startsWith('v ')) v.push(line.split(/\s+/).slice(1, 4).map(Number));
    else if (line.startsWith('usemtl')) part = PART[line.split(/\s+/)[1]] ?? 0;
    else if (line.startsWith('f ')) {
      const idx = line.trim().split(/\s+/).slice(1).map((t) => parseInt(t.split('/')[0], 10) - 1);
      for (let i = 1; i < idx.length - 1; i++) tris.push([idx[0], idx[i], idx[i + 1], part]);
    }
  }
  return { v, tris };
}

// Small vector helpers.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));
const mean = (pts) => mul(pts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / pts.length);

/** The rotation (3x3, rows) and shift that best carry points A onto points B (Kabsch, via Horn's quaternion). */
function fit(A, B) {
  const ca = mean(A), cb = mean(B);
  const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  A.forEach((a, i) => {
    const p = sub(a, ca), q = sub(B[i], cb);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r][c] += p[r] * q[c];
  });
  const [[xx, xy, xz], [yx, yy, yz], [zx, zy, zz]] = S;
  const N = [
    [xx + yy + zz, yz - zy, zx - xz, xy - yx],
    [yz - zy, xx - yy - zz, xy + yx, zx + xz],
    [zx - xz, xy + yx, -xx + yy - zz, yz + zy],
    [xy - yx, zx + xz, yz + zy, -xx - yy + zz],
  ];
  // The largest eigenvector of N by power iteration (shifted so it is the largest in size too).
  let q = [1, 0, 0, 0];
  const shift = Math.abs(N[0][0]) + Math.abs(N[1][1]) + Math.abs(N[2][2]) + Math.abs(N[3][3]) + 1;
  for (let it = 0; it < 200; it++) {
    const n = [0, 1, 2, 3].map((r) => N[r].reduce((s, x, c) => s + x * q[c], 0) + shift * q[r]);
    const l = Math.hypot(...n);
    q = n.map((x) => x / l);
  }
  const [w, x, y, z] = q;
  const R = [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
  return { R, ca, cb };
}
const apply = (T, p) => {
  const d = sub(p, T.ca);
  return add(T.cb, [dot(T.R[0], d), dot(T.R[1], d), dot(T.R[2], d)]);
};
const turn = (T, d) => [dot(T.R[0], d), dot(T.R[1], d), dot(T.R[2], d)];

/** Where a ray from `o` along `d` first meets the shape's skin (nearest hit), and the surface's direction there. */
function hit(obj, o, d) {
  let best = null;
  for (const [a, b, c, part] of obj.tris) {
    if (part !== 0) continue;
    const A = obj.v[a], B = obj.v[b], C = obj.v[c];
    const e1 = sub(B, A), e2 = sub(C, A), p = cross(d, e2), det = dot(e1, p);
    if (Math.abs(det) < 1e-9) continue;
    const t0 = sub(o, A), u = dot(t0, p) / det;
    if (u < 0 || u > 1) continue;
    const qv = cross(t0, e1), v = dot(d, qv) / det;
    if (v < 0 || u + v > 1) continue;
    const t = dot(e2, qv) / det;
    if (t > 0 && (!best || t < best.t)) {
      let n = norm(cross(e1, e2));
      if (dot(n, d) < 0) n = mul(n, -1); // pointing out of the face (the way the ray goes)
      best = { t, p: add(o, mul(d, t)), n };
    }
  }
  return best;
}

/** A flat oval facing `n` at `c`: rx across (along `side`), ry up; `seg` corners. */
function oval(c, n, side, rx, ry, seg, part, out) {
  const up = norm(cross(n, side));
  const s = norm(cross(up, n));
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push(add(c, add(mul(s, Math.cos(a) * rx), mul(up, Math.sin(a) * ry))));
  }
  for (let i = 0; i < seg; i++) out.push([c, pts[i], pts[(i + 1) % seg], part]);
}

/** The body with fewer triangles (each part on its own, its edges kept, so parts still meet). */
function lighter(o, ratio) {
  if (ratio >= 1) return o.tris;
  const positions = new Float32Array(o.v.flat());
  const out = [];
  for (const part of new Set(o.tris.map((t) => t[3]))) {
    const mine = o.tris.filter((t) => t[3] === part);
    const idx = new Uint32Array(mine.flatMap((t) => t.slice(0, 3)));
    const target = Math.max(3, Math.floor((idx.length * ratio) / 3) * 3);
    const [kept] = MeshoptSimplifier.simplify(idx, positions, 3, target, 0.01, ['LockBorder']);
    for (let i = 0; i < kept.length; i += 3) out.push([kept[i], kept[i + 1], kept[i + 2], part]);
  }
  return out;
}

function build(gender) {
  const G = gender === 'male' ? 'Male' : 'Female';
  const dir = path.join(src, G, `${G} Poses`, 'OBJ');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.obj'));
  const poses = Object.fromEntries(files.map((f) => [f.replace(/^(Male|Female|Woman)_/, '').replace('.obj', ''), readObj(path.join(dir, f))]));
  // People are shown in these poses (walking and running are left to the moving crowd).
  const USE = ['Standing', 'Standing_Hips', 'Standing_Waving', 'LookingUp', 'Standing_CoveringEyes', 'PickingUp', 'Sitting', 'Sitting_Cheering'];
  const height = gender === 'male' ? 1.72 : 1.62;
  const k = height / Math.max(...poses.Standing.v.map((p) => p[1]));
  // A pose of each body shape, standing upright with arms down: where the head's points are.
  const refFor = (n) => [poses.Standing, poses.Standing_Hips, poses.Running].find((r) => r && r.v.length === n);
  const headOf = (o) => {
    const skin = new Set(o.tris.filter((t) => t[3] === 0).flatMap((t) => t.slice(0, 3)));
    const top = Math.max(...[...skin].map((i) => o.v[i][1]));
    return [...skin].filter((i) => o.v[i][1] > top - 0.6 && Math.abs(o.v[i][0]) < 0.35);
  };
  // The face on the standing person (eyes, brows) and the hair on its head.
  const ref = poses.Standing;
  const headIdx = headOf(ref);
  const head = headIdx.map((i) => ref.v[i]);
  const hx = [Math.min(...head.map((p) => p[0])), Math.max(...head.map((p) => p[0]))];
  const hy = [Math.min(...head.map((p) => p[1])), Math.max(...head.map((p) => p[1]))];
  const hz = [Math.min(...head.map((p) => p[2])), Math.max(...head.map((p) => p[2]))];
  const W = hx[1] - hx[0], H = hy[1] - hy[0];
  const centre = [(hx[0] + hx[1]) / 2, hy[0] + H * 0.55, (hz[0] + hz[1]) / 2];
  const face = [];
  const eyeY = hy[1] - H * (gender === 'male' ? 0.47 : 0.5);
  for (const sx of [-1, 1]) {
    const o = [centre[0] + sx * W * 0.2, eyeY, centre[2]];
    const h = hit(ref, o, [0, 0, 1]);
    if (!h) continue;
    const n = norm(add(h.n, [0, 0, 1]));
    const side = [1, 0, 0];
    oval(add(h.p, mul(n, 0.006)), n, side, W * 0.105, W * 0.058, 10, PART.White, face);
    oval(add(h.p, mul(n, 0.011)), n, side, W * 0.05, W * 0.05, 8, PART.Iris, face);
    // The brow above.
    const b = hit(ref, [o[0], eyeY + H * 0.12, centre[2]], [0, 0, 1]);
    if (b) {
      const bn = norm(add(b.n, [0, 0, 1]));
      oval(add(b.p, mul(bn, 0.008)), bn, side, W * 0.12, W * 0.022, 6, PART.Hair, face);
    }
  }
  // The mouth, below the nose.
  const mouthAt = hit(ref, [centre[0], eyeY - H * (gender === 'male' ? 0.3 : 0.28), centre[2]], [0, 0, 1]);
  if (mouthAt) {
    const n = norm(add(mouthAt.n, [0, 0, 1]));
    oval(add(mouthAt.p, mul(n, 0.007)), n, [1, 0, 0], W * 0.13, W * 0.032, 8, PART.Lips, face);
  }
  // Hairstyles from the pack, sat on the standing head (their own middle on the head's middle, their
  // top just above the head's top).
  const hairDir = path.join(src, G, `${G} Hairstyles`, 'OBJ');
  const hairs = fs.readdirSync(hairDir).filter((f) => f.endsWith('.obj')).sort().map((f) => readObj(path.join(hairDir, f)));
  const hairOn = hairs.map((h) => {
    const top = Math.max(...h.v.map((p) => p[1]));
    const shift = [centre[0], hy[1] + 0.03 - top, centre[2]];
    return { v: h.v.map((p) => add(p, shift)), tris: h.tris.map((t) => [t[0], t[1], t[2], PART.Hair]) };
  });
  // Which hairstyle goes with which pose (variety across poses; colours vary per person in the game).
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const list = [];
  USE.forEach((name, pi) => {
    const o = poses[name];
    if (!o) return;
    // The head's turn from the standing person to this pose (matched on the same body's points).
    const r = refFor(o.v.length);
    let T = { R: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], ca: [0, 0, 0], cb: [0, 0, 0] };
    if (r) {
      const idx = headOf(r);
      // The head's turn from this body's upright pose to this pose (the same points on both).
      T = fit(idx.map((i) => r.v[i]), idx.map((i) => o.v[i]));
      if (r !== ref) {
        // Standing person -> this body's reference: by the head's bounding middle and height (no shared points).
        const rh = idx.map((i) => r.v[i]);
        const rtop = Math.max(...rh.map((p) => p[1]));
        const rc = [(Math.min(...rh.map((p) => p[0])) + Math.max(...rh.map((p) => p[0]))) / 2, rtop - H * 0.45, (Math.min(...rh.map((p) => p[2])) + Math.max(...rh.map((p) => p[2]))) / 2];
        const sc = [centre[0], hy[1] - H * 0.45, centre[2]];
        const d = sub(rc, sc);
        const T2 = T;
        T = { R: T2.R, ca: sub(T2.ca, d), cb: T2.cb };
      }
    }
    const hair = hairOn[(pi + (gender === 'male' ? 0 : 1)) % hairOn.length];
    const pos = [], part = [];
    const push = (p, pt) => {
      pos.push(p[0] * k, p[1] * k, p[2] * k);
      part.push(pt);
    };
    for (const [a, b, c, pt] of lighter(o, gender === 'female' ? 0.62 : 1)) for (const i of [a, b, c]) push(o.v[i], pt);
    for (const [a, b, c, pt] of hair.tris) for (const i of [a, b, c]) push(apply(T, hair.v[i]), pt);
    for (const [a, b, c, pt] of face) for (const p of [a, b, c]) push(apply(T, p), pt);
    // Feet on the ground.
    let minY = Infinity;
    for (let i = 1; i < pos.length; i += 3) minY = Math.min(minY, pos[i]);
    for (let i = 1; i < pos.length; i += 3) pos[i] -= minY;
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
      .setAttribute('_PART', doc.createAccessor().setType('SCALAR').setArray(new Float32Array(part)).setBuffer(buffer));
    const mesh = doc.createMesh(name).addPrimitive(prim);
    scene.addChild(doc.createNode(name).setMesh(mesh));
    list.push(`${name} ${pos.length / 9} triangles`);
  });
  return { doc, list };
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
for (const gender of ['male', 'female']) {
  const { doc, list } = build(gender);
  // (The women's bodies were made about 60% as heavy above.) Every shape packed small.
  await doc.transform(weld(), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  let tris = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) tris += p.getIndices() ? p.getIndices().getCount() / 3 : p.getAttribute('POSITION').getCount() / 3;
  const out = path.join(outDir, `posed-${gender}.glb`);
  await io.write(out, doc);
  console.log(out, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`, `${tris} triangles in all;`, list.join(', '));
}
