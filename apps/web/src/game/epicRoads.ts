// Accra's real roads, built in the Low Poly Epic City pack's road design (step 2 of the Epic City plan).
//
// The pack's roads are square pieces; Accra's roads bend at every angle. So the pack's road is
// measured (its colours, kerb, pavement, lines) and laid along every real road from the map:
//   - the tarmac sits 15 cm below the pavement, with a kerb face between (the pack's kerb is 20 cm);
//   - pavements in the pack's grey; at every junction the kerb turns the corner in a smooth curve;
//   - main roads and highways get the pack's unbroken yellow centre line and white lane dashes
//     (a 1.67 m dash every 5 m), which stop short of junctions; side roads have no lines, as in the pack;
//   - lanes and service roads are flat tarmac, with the pavement of the road they join running
//     across their mouth like a driveway.
// Bridges are built by flyovers.ts. All of it uses the pack's one texture sheet, so it shares the
// pack's day and night look. Widths stay Accra's (main road 11 m of tarmac, side road 7.6 m).
import * as THREE from 'three';
import { epicMaterial, EPIC_UV } from './epicKit';

export const ROAD_DIP = 0.15; // how far the tarmac is below the pavement
const PAVE_Y = 0.012; // pavement top (just above the map's ground)
const LANE_Y = 0.008; // lanes and service roads: flat
const MARK_LIFT = 0.008; // lines just above the tarmac
const GUTTER = 0.55; // as streetLife: the tarmac runs to the road's half width plus this

// Road sizes (as streetLife.ts): half the road's width, and the pavement's width.
const SIZE: Record<string, { half: number; walk: number; lines: boolean }> = {
  highway: { half: 7 + GUTTER, walk: 2.5, lines: true },
  major_road: { half: 5 + GUTTER, walk: 2.5, lines: true },
  minor_road: { half: 3.25 + GUTTER, walk: 1.8, lines: false },
};
const LANE_HALF = 2.4;

type Road = { kind: string; pts: Float32Array; bridge?: boolean };
type V2 = [number, number];
type Arm = { piece: Piece; atStart: boolean; d: V2; half: number; walk: number; ang: number };
type Piece = { pts: V2[]; half: number; walk: number; lines: boolean; trim: { s: [number, number]; e: [number, number]; markS: number; markE: number } };

const BLOCK = 120; // metres: roads are drawn in blocks this size, near ones only

/** Fewer points on a polyline (Douglas-Peucker within `tol` metres), always keeping the ends and `keep` points. */
function simplify(pts: V2[], tol: number, keep: (p: V2) => boolean): V2[] {
  if (pts.length <= 2) return pts;
  const mark = new Uint8Array(pts.length);
  mark[0] = mark[pts.length - 1] = 1;
  pts.forEach((p, i) => { if (keep(p)) mark[i] = 1; });
  const stack: [number, number][] = [];
  let a = 0;
  for (let i = 1; i < pts.length; i++) if (mark[i]) { stack.push([a, i]); a = i; }
  while (stack.length) {
    const [i0, i1] = stack.pop()!;
    const [ax, az] = pts[i0], [bx, bz] = pts[i1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    let worst = -1, far = tol;
    for (let i = i0 + 1; i < i1; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - az) * dz) / l2));
      const d = Math.hypot(ax + dx * t - pts[i][0], az + dz * t - pts[i][1]);
      if (d > far) { far = d; worst = i; }
    }
    if (worst > 0) { mark[worst] = 1; stack.push([i0, worst], [worst, i1]); }
  }
  return pts.filter((_, i) => mark[i]);
}
const key = (x: number, z: number) => `${Math.round(x * 2)},${Math.round(z * 2)}`;
const left = (d: V2): V2 => [-d[1], d[0]];
const norm = (x: number, z: number): V2 => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

/** Collects triangles (positions, normals, texture positions) for one batch of roads. */
class Shapes {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  /** A triangle, turned so it faces `n` (for flat ground pass up). */
  tri(a: number[], b: number[], c: number[], n: number[], uv: readonly number[]) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    if (fx * n[0] + fy * n[1] + fz * n[2] < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.nor.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); }
  }
  quad(a: number[], b: number[], c: number[], d: number[], n: number[], uv: readonly number[]) {
    this.tri(a, b, c, n, uv);
    this.tri(a, c, d, n, uv);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere();
    return g;
  }
}
const UP = [0, 1, 0];

/** The part of a polyline between distances s0 and s1 along it. */
function cut(pts: V2[], s0: number, s1: number): V2[] {
  const out: V2[] = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    const a = acc, b = acc + l;
    if (b >= s0 && a <= s1) {
      const t0 = Math.max(0, (s0 - a) / l), t1 = Math.min(1, (s1 - a) / l);
      const p0: V2 = [ax + (bx - ax) * t0, az + (bz - az) * t0];
      if (!out.length) out.push(p0);
      out.push([ax + (bx - ax) * t1, az + (bz - az) * t1]);
    }
    acc = b;
  }
  return out;
}
const length = (pts: V2[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/** The polyline moved sideways by `off` (+ to the left), with mitred corners. */
function offset(pts: V2[], off: number): V2[] {
  const n = pts.length;
  const out: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i], c = pts[Math.min(n - 1, i + 1)];
    const d1 = i > 0 ? norm(b[0] - a[0], b[1] - a[1]) : norm(c[0] - b[0], c[1] - b[1]);
    const d2 = i < n - 1 ? norm(c[0] - b[0], c[1] - b[1]) : d1;
    const n1 = left(d1), n2 = left(d2);
    let mx = n1[0] + n2[0], mz = n1[1] + n2[1];
    const ml = Math.hypot(mx, mz);
    if (ml < 1e-3) { mx = n1[0]; mz = n1[1]; } else { mx /= ml; mz /= ml; }
    const k = Math.min(2.5, 1 / Math.max(0.2, mx * n1[0] + mz * n1[1]));
    out.push([b[0] + mx * off * k, b[1] + mz * off * k]);
  }
  return out;
}

/** A flat band between two sideways offsets of a polyline. */
function band(sh: Shapes, pts: V2[], o1: number, o2: number, y: number, uv: readonly number[]) {
  if (pts.length < 2) return;
  const A = offset(pts, o1), B = offset(pts, o2);
  for (let i = 1; i < pts.length; i++) sh.quad([A[i - 1][0], y, A[i - 1][1]], [A[i][0], y, A[i][1]], [B[i][0], y, B[i][1]], [B[i - 1][0], y, B[i - 1][1]], UP, uv);
}
/** The kerb's face along an offset of a polyline, facing the road's middle. */
function kerbFace(sh: Shapes, pts: V2[], o: number) {
  if (pts.length < 2) return;
  const A = offset(pts, o);
  for (let i = 1; i < pts.length; i++) {
    const d = norm(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const n = left(d);
    const s = -Math.sign(o);
    sh.quad([A[i - 1][0], -ROAD_DIP, A[i - 1][1]], [A[i][0], -ROAD_DIP, A[i][1]], [A[i][0], PAVE_Y, A[i][1]], [A[i - 1][0], PAVE_Y, A[i - 1][1]], [n[0] * s, 0, n[1] * s], EPIC_UV.kerb);
  }
}
/** Dashes along an offset of a polyline: `dash` long, one every `every` metres. */
function dashes(sh: Shapes, pts: V2[], o: number, width: number, dash: number, every: number, y: number, uv: readonly number[]) {
  const L = length(pts);
  for (let s = every / 2 - dash / 2; s + dash <= L; s += every) band(sh, cut(pts, s, s + dash), o - width / 2, o + width / 2, y, uv);
}
/** Points on an arc about (cx, cz) from angle a0, turning by `sweep`. */
function arc(cx: number, cz: number, r: number, a0: number, sweep: number): V2[] {
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / 0.3));
  return Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + (sweep * i) / n) * r, cz + Math.sin(a0 + (sweep * i) / n) * r] as V2);
}
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Solve p + d1*s = q + d2*t: returns [s, t] or null if parallel. */
function meet(p: V2, d1: V2, q: V2, d2: V2): [number, number] | null {
  const det = d1[0] * -d2[1] + d2[0] * d1[1];
  if (Math.abs(det) < 1e-6) return null;
  const rx = q[0] - p[0], rz = q[1] - p[1];
  return [(rx * -d2[1] + d2[0] * rz) / det, (d1[0] * rz - d1[1] * rx) / det];
}

export class EpicRoads {
  readonly group = new THREE.Group();
  /** Tarmac that is sunk (for heights): segments in 25 m cells, [ax, az, bx, bz, half, piece id]. */
  private grid = new Map<string, number[]>();
  private nextId = 1;
  triangles = 0;
  /** Time spent building, and the slowest single tile (milliseconds), to keep loading smooth. */
  buildMs = 0;
  slowestMs = 0;
  tilesBuilt = 0;
  roundabouts = 0;
  ringsAt: [number, number, number][] = [];

  /** Roads are shown this far from the player (further out, the map's flat roads in the same colours). */
  showRadius = 300;
  private jobs: { job: Generator<void>; x: number; z: number }[] = [];
  private busy: { job: Generator<void>; x: number; z: number } | null = null;
  private blocks = new Map<string, { x: number; z: number; meshes: THREE.Mesh[] }>();
  private shownAt: V2 = [1e9, 1e9];

  /** Queue one batch of roads (one map tile); it is built a little each frame in update(). */
  add(roads: Road[]) {
    const r = roads.find((q) => q.pts.length >= 2);
    if (r) this.jobs.push({ job: this.build(roads), x: r.pts[0], z: r.pts[1] });
  }
  /** Still building roads? */
  get loading() {
    return this.jobs.length > 0;
  }

  /** Each frame: build for at most `budgetMs`, and show only the blocks of road near (x, z). */
  update(x: number, z: number, budgetMs = 3) {
    const t0 = performance.now();
    let built = false;
    while (this.jobs.length && performance.now() - t0 < budgetMs) {
      // The map square nearest the player first (a square is built over several frames).
      if (!this.busy) {
        let best = 0;
        this.jobs.forEach((j, i) => { if (Math.hypot(j.x - x, j.z - z) < Math.hypot(this.jobs[best].x - x, this.jobs[best].z - z)) best = i; });
        this.busy = this.jobs[best];
      }
      if (this.busy.job.next().done) {
        this.jobs.splice(this.jobs.indexOf(this.busy), 1);
        this.busy = null;
      }
      built = true;
    }
    if (built) {
      const ms = performance.now() - t0;
      this.buildMs += ms;
      this.slowestMs = Math.max(this.slowestMs, ms);
    }
    if (built || Math.hypot(x - this.shownAt[0], z - this.shownAt[1]) > 15) {
      this.shownAt = [x, z];
      const r = this.showRadius + BLOCK * 0.71;
      this.triangles = 0;
      for (const b of this.blocks.values()) {
        const on = Math.hypot(b.x - x, b.z - z) < r;
        for (const m of b.meshes) {
          m.visible = on;
          if (on) this.triangles += m.geometry.getAttribute('position').count / 3;
        }
      }
    }
  }

  private *build(roads: Road[]): Generator<void> {
    // Shapes go into blocks of road BLOCK metres square, so only the blocks near you are drawn.
    const shapes = new Map<string, Shapes>();
    const shAt = (x: number, z: number) => {
      const k = `${Math.floor(x / BLOCK)},${Math.floor(z / BLOCK)}`;
      return shapes.get(k) ?? shapes.set(k, new Shapes()).get(k)!;
    };
    const sunk = roads.filter((r) => SIZE[r.kind] && !r.bridge && r.pts.length >= 4);
    const lanes = roads.filter((r) => r.kind === 'other' && !r.bridge && r.pts.length >= 4);
    let lines: V2[][] = sunk.map((r) => Array.from({ length: r.pts.length / 2 }, (_, i) => [r.pts[i * 2], r.pts[i * 2 + 1]] as V2));

    // 1. Junctions: places where roads meet (the same point on more than one road, or three arms).
    const at = new Map<string, { li: number; vi: number }[]>();
    lines.forEach((pts, li) => pts.forEach(([x, z], vi) => { const k = key(x, z); (at.get(k) ?? at.set(k, []).get(k)!).push({ li, vi }); }));
    const nodes = new Map<string, V2>();
    for (const [k, list] of at) {
      const arms = list.reduce((s, o) => s + (o.vi === 0 || o.vi === lines[o.li].length - 1 ? 1 : 2), 0);
      if (arms >= 3 || (arms === 2 && list.length >= 2)) nodes.set(k, lines[list[0].li][list[0].vi]);
    }
    const isNode = (k: string) => nodes.has(k);
    // Curvy roads come with a point every metre or so: keep only the points the shape needs
    // (within 25 cm), and every junction.
    lines = lines.map((pts) => simplify(pts, 0.25, (p) => isNode(key(...p))));
    yield;

    // 2. Cut each road into pieces between junctions.
    const pieces: Piece[] = [];
    const arms = new Map<string, Arm[]>();
    lines.forEach((pts, li) => {
      const s = SIZE[sunk[li].kind];
      let start = 0;
      for (let i = 1; i < pts.length; i++) {
        if (i < pts.length - 1 && !isNode(key(...pts[i]))) continue;
        const p = pts.slice(start, i + 1);
        start = i;
        if (length(p) < 0.3) continue;
        const piece: Piece = { pts: p, half: s.half, walk: s.walk, lines: s.lines, trim: { s: [0, 0], e: [0, 0], markS: 0, markE: 0 } };
        pieces.push(piece);
        for (const atStart of [true, false]) {
          const [a, b] = atStart ? [p[0], p[1]] : [p[p.length - 1], p[p.length - 2]];
          const k = key(...a);
          if (!isNode(k)) continue;
          const d = norm(b[0] - a[0], b[1] - a[1]);
          (arms.get(k) ?? arms.set(k, []).get(k)!).push({ piece, atStart, d, half: s.half, walk: s.walk, ang: Math.atan2(d[1], d[0]) });
        }
      }
    });

    // 3. Each junction: the kerb turns every corner in a curve; the tarmac fills the middle.
    // Sides: an arm's ccw side is the piece's left (+) at its start and its right (-) at its end.
    const setTrim = (a: Arm, ccw: boolean, v: number) => {
      const plus = a.atStart ? ccw : !ccw;
      const t = a.atStart ? a.piece.trim.s : a.piece.trim.e;
      t[plus ? 0 : 1] = Math.max(t[plus ? 0 : 1], v);
    };
    let work = 0;
    for (const [k, list] of arms) {
      if (list.length < 2) continue;
      list.sort((a, b) => a.ang - b.ang);
      const node = nodes.get(k)!;
      const sh = shAt(node[0], node[1]);
      const middle: V2[] = [];
      if (++work % 25 === 0) yield;
      for (let i = 0; i < list.length; i++) {
        const A = list[i], B = list[(i + 1) % list.length];
        let gap = B.ang - A.ang;
        if (i === list.length - 1) gap += Math.PI * 2;
        const nA = left(A.d), nB = left(B.d);
        const w = Math.min(A.walk, B.walk);
        if (gap > 0.35 && gap < 2.8) {
          // A curved kerb corner of radius R, touching both kerbs.
          const R = w + 0.8;
          const o = meet([node[0] + nA[0] * (A.half + R), node[1] + nA[1] * (A.half + R)], A.d, [node[0] - nB[0] * (B.half + R), node[1] - nB[1] * (B.half + R)], B.d);
          const c = meet([node[0] + nA[0] * A.half, node[1] + nA[1] * A.half], A.d, [node[0] - nB[0] * B.half, node[1] - nB[1] * B.half], B.d);
          if (!o || !c || o[0] < 0 || o[1] < 0 || o[0] > 60 || o[1] > 60) { setTrim(A, true, A.half + B.half); setTrim(B, false, A.half + B.half); continue; }
          const O: V2 = [node[0] + A.d[0] * o[0] + nA[0] * (A.half + R), node[1] + A.d[1] * o[0] + nA[1] * (A.half + R)];
          const C: V2 = [node[0] + A.d[0] * c[0] + nA[0] * A.half, node[1] + A.d[1] * c[0] + nA[1] * A.half];
          const Ta: V2 = [node[0] + A.d[0] * o[0] + nA[0] * A.half, node[1] + A.d[1] * o[0] + nA[1] * A.half];
          const Tb: V2 = [node[0] + B.d[0] * o[1] - nB[0] * B.half, node[1] + B.d[1] * o[1] - nB[1] * B.half];
          setTrim(A, true, o[0]);
          setTrim(B, false, o[1]);
          const a0 = Math.atan2(Ta[1] - O[1], Ta[0] - O[0]);
          const sweep = wrap(Math.atan2(Tb[1] - O[1], Tb[0] - O[0]) - a0);
          const kerb = arc(O[0], O[1], R, a0, sweep);
          const inner = arc(O[0], O[1], R - w, a0, sweep);
          for (let j = 1; j < kerb.length; j++) {
            // Tarmac out to the curved kerb, pavement round the corner, and the kerb's face.
            sh.tri([C[0], -ROAD_DIP, C[1]], [kerb[j - 1][0], -ROAD_DIP, kerb[j - 1][1]], [kerb[j][0], -ROAD_DIP, kerb[j][1]], UP, EPIC_UV.asphalt);
            sh.quad([kerb[j - 1][0], PAVE_Y, kerb[j - 1][1]], [kerb[j][0], PAVE_Y, kerb[j][1]], [inner[j][0], PAVE_Y, inner[j][1]], [inner[j - 1][0], PAVE_Y, inner[j - 1][1]], UP, EPIC_UV.pavement);
            const mx = (kerb[j - 1][0] + kerb[j][0]) / 2 - O[0], mz = (kerb[j - 1][1] + kerb[j][1]) / 2 - O[1];
            const ml = Math.hypot(mx, mz) || 1;
            sh.quad([kerb[j - 1][0], -ROAD_DIP, kerb[j - 1][1]], [kerb[j][0], -ROAD_DIP, kerb[j][1]], [kerb[j][0], PAVE_Y, kerb[j][1]], [kerb[j - 1][0], PAVE_Y, kerb[j - 1][1]], [mx / ml, 0, mz / ml], EPIC_UV.kerb);
          }
          middle.push(C);
        } else if (gap >= 2.8) {
          // Nearly straight on (or the outside of a bend): the pavement carries on round.
          const h = Math.min(A.half, B.half);
          middle.push([node[0] + nA[0] * h, node[1] + nA[1] * h], [node[0] - nB[0] * h, node[1] - nB[1] * h]);
          if (gap > 3.3) {
            const a0 = Math.atan2(nA[1], nA[0]);
            const sweep = gap - Math.PI;
            const kerb = arc(node[0], node[1], h, a0, sweep);
            const outer = arc(node[0], node[1], h + w, a0, sweep);
            for (let j = 1; j < kerb.length; j++) {
              sh.tri([node[0], -ROAD_DIP, node[1]], [kerb[j - 1][0], -ROAD_DIP, kerb[j - 1][1]], [kerb[j][0], -ROAD_DIP, kerb[j][1]], UP, EPIC_UV.asphalt);
              sh.quad([kerb[j - 1][0], PAVE_Y, kerb[j - 1][1]], [kerb[j][0], PAVE_Y, kerb[j][1]], [outer[j][0], PAVE_Y, outer[j][1]], [outer[j - 1][0], PAVE_Y, outer[j - 1][1]], UP, EPIC_UV.pavement);
              const mx = (kerb[j - 1][0] + kerb[j][0]) / 2 - node[0], mz = (kerb[j - 1][1] + kerb[j][1]) / 2 - node[1];
              const ml = Math.hypot(mx, mz) || 1;
              sh.quad([kerb[j - 1][0], -ROAD_DIP, kerb[j - 1][1]], [kerb[j][0], -ROAD_DIP, kerb[j][1]], [kerb[j][0], PAVE_Y, kerb[j][1]], [kerb[j - 1][0], PAVE_Y, kerb[j - 1][1]], [-mx / ml, 0, -mz / ml], EPIC_UV.kerb);
            }
          }
        } else {
          // Two roads meeting at a very sharp angle: keep their pavements apart.
          setTrim(A, true, (A.half + B.half) * 2);
          setTrim(B, false, (A.half + B.half) * 2);
        }
      }
      // The tarmac in the middle of the junction.
      for (let j = 0; j < middle.length; j++) {
        const p = middle[j], q = middle[(j + 1) % middle.length];
        sh.tri([node[0], -ROAD_DIP, node[1]], [p[0], -ROAD_DIP, p[1]], [q[0], -ROAD_DIP, q[1]], UP, EPIC_UV.asphalt);
      }
      // Lines stop short of a junction of three or more roads.
      if (list.length >= 3) {
        const widest = Math.max(...list.map((a) => a.half));
        for (const a of list) {
          const t = a.atStart ? a.piece.trim.s : a.piece.trim.e;
          const m = Math.max(t[0], t[1], widest) + 1.5;
          if (a.atStart) a.piece.trim.markS = m;
          else a.piece.trim.markE = m;
        }
      }
    }

    // 4. Each piece: tarmac, kerbs, pavements, lines. Pavements, kerbs and lines also stop wherever
    // they would cross another road's tarmac (roads that cross without the map marking a junction).
    const ids = pieces.map((p) => this.toGrid(p.pts, p.half));
    for (let n = 0; n < pieces.length; n++) {
      const p = pieces[n];
      const L = length(p.pts);
      const id = ids[n];
      const mid = p.pts[p.pts.length >> 1];
      const sh = shAt(mid[0], mid[1]);
      if (n % 12 === 11) yield;
      band(sh, p.pts, -p.half, p.half, -ROAD_DIP, EPIC_UV.asphalt);
      for (const [side, sign] of [[0, 1], [1, -1]] as const) {
        const s0 = p.trim.s[side], s1 = L - p.trim.e[side];
        if (s1 - s0 < 0.2) continue;
        for (const part of this.clear(cut(p.pts, s0, s1), [sign * (p.half + 0.3), sign * (p.half + p.walk - 0.2)], id)) {
          kerbFace(sh, part, sign * p.half);
          band(sh, part, sign > 0 ? p.half : -p.half - p.walk, sign > 0 ? p.half + p.walk : -p.half, PAVE_Y, EPIC_UV.pavement);
        }
      }
      if (p.lines) {
        const m0 = p.trim.markS, m1 = L - p.trim.markE;
        if (m1 - m0 > 2) {
          for (const part of this.clear(cut(p.pts, m0, m1), [0, p.half / 2, -p.half / 2], id)) {
            if (length(part) < 2) continue;
            const y = -ROAD_DIP + MARK_LIFT;
            band(sh, part, -0.15, 0.15, y, EPIC_UV.yellow);
            for (const o of [p.half / 2, -p.half / 2]) dashes(sh, part, o, 0.2, 1.67, 5, y, EPIC_UV.white);
          }
        }
      }
    }

    // 5. Roundabouts (a road that comes back to where it started): an island in the middle, inside
    // the pavement: grass as in the pack, or paved when it is big.
    for (let li = 0; li < lines.length; li++) {
      const pts = lines[li];
      if (pts.length < 6 || key(...pts[0]) !== key(...pts[pts.length - 1])) continue;
      const L = length(pts);
      if (L > 700 || L < 25) continue;
      const s0 = SIZE[sunk[li].kind];
      const area = pts.reduce((a, p, i) => (i ? a + (pts[i - 1][0] * p[1] - p[0] * pts[i - 1][1]) : 0), 0) / 2;
      // The island's edge: the inside of the pavement (left of the road when it turns that way).
      const inset = (s0.half + s0.walk) * (area > 0 ? 1 : -1);
      const ring = offset(pts.slice(0, -1), inset);
      const contour = ring.map(([x, z]) => new THREE.Vector2(x, z));
      if (Math.abs(THREE.ShapeUtils.area(contour)) < 20) continue;
      const tris = THREE.ShapeUtils.triangulateShape(contour, []);
      const sh = shAt(pts[0][0], pts[0][1]);
      // Small islands are grass; a big one (like Circle's, full of traders) is paved like the pavements.
      const uv = Math.abs(THREE.ShapeUtils.area(contour)) > 1500 ? EPIC_UV.pavement : EPIC_UV.grass;
      for (const [a, b, c] of tris) sh.tri([ring[a][0], PAVE_Y + 0.004, ring[a][1]], [ring[b][0], PAVE_Y + 0.004, ring[b][1]], [ring[c][0], PAVE_Y + 0.004, ring[c][1]], UP, uv);
      this.roundabouts++;
      this.ringsAt.push([pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length, L]);
    }

    // 6. Lanes and service roads: flat tarmac, stopping at the pavement of the road they join.
    for (let li = 0; li < lanes.length; li++) {
      const r = lanes[li];
      if (li % 40 === 39) yield;
      const pts = simplify(Array.from({ length: r.pts.length / 2 }, (_, i) => [r.pts[i * 2], r.pts[i * 2 + 1]] as V2), 0.3, () => false);
      const sh = shAt(pts[pts.length >> 1][0], pts[pts.length >> 1][1]);
      const L = length(pts);
      const back = (p: V2) => {
        const list = at.get(key(...p));
        if (!list) return 0;
        return Math.max(...list.map((o) => SIZE[sunk[o.li].kind].half + SIZE[sunk[o.li].kind].walk));
      };
      const s0 = back(pts[0]), s1 = L - back(pts[pts.length - 1]);
      if (s1 - s0 > 0.5) band(sh, cut(pts, s0, s1), -LANE_HALF, LANE_HALF, LANE_Y, EPIC_UV.asphalt);
    }

    for (const [k, sh] of shapes) {
      if (!sh.pos.length) continue;
      const mesh = new THREE.Mesh(sh.geometry(), epicMaterial());
      mesh.matrixAutoUpdate = false;
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      const [bx, bz] = k.split(',').map(Number);
      const b = this.blocks.get(k) ?? this.blocks.set(k, { x: (bx + 0.5) * BLOCK, z: (bz + 0.5) * BLOCK, meshes: [] }).get(k)!;
      b.meshes.push(mesh);
    }
    this.shownAt = [1e9, 1e9]; // show the new blocks on the next update
    this.tilesBuilt++;
  }

  private toGrid(pts: V2[], half: number) {
    const id = this.nextId++;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const cells = new Set<string>();
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 10) + 1;
      for (let j = 0; j <= n; j++) {
        const x = ax + ((bx - ax) * j) / n, z = az + ((bz - az) * j) / n;
        for (const [ox, oz] of [[0, 0], [half, 0], [-half, 0], [0, half], [0, -half]]) cells.add(`${Math.floor((x + ox) / 25)},${Math.floor((z + oz) / 25)}`);
      }
      for (const c of cells) (this.grid.get(c) ?? this.grid.set(c, []).get(c)!).push(ax, az, bx, bz, half, id);
    }
    return id;
  }

  /** The tarmac half-width of the road (other than piece `not`) whose tarmac covers this point, or 0. */
  private onTarmac(x: number, z: number, not = 0) {
    const list = this.grid.get(`${Math.floor(x / 25)},${Math.floor(z / 25)}`);
    if (!list) return 0;
    for (let k = 0; k < list.length; k += 6) {
      if (list[k + 5] === not) continue;
      const ax = list[k], az = list[k + 1], dx = list[k + 2] - ax, dz = list[k + 3] - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      if (Math.hypot(ax + dx * t - x, az + dz * t - z) < list[k + 4] - 0.05) return list[k + 4];
    }
    return 0;
  }

  /** The parts of a polyline where none of the sideways points `offs` lies on another road's tarmac. */
  private clear(pts: V2[], offs: number[], id: number): V2[][] {
    // Test a point about every metre along the line.
    const at: number[] = [];
    const ok: boolean[] = [];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 1e-6) continue;
      const dx = (bx - ax) / l, dz = (bz - az) / l;
      const n = Math.max(1, Math.ceil(l));
      for (let j = at.length ? 1 : 0; j <= n; j++) {
        const t = (l * j) / n;
        const cx = ax + dx * t, cz = az + dz * t;
        at.push(acc + t);
        ok.push(offs.every((o) => !this.onTarmac(cx - dz * o, cz + dx * o, id)));
      }
      acc += l;
    }
    if (ok.every(Boolean)) return acc > 0.2 ? [pts] : [];
    const out: V2[][] = [];
    let from = -1;
    for (let i = 0; i <= ok.length; i++) {
      if (i < ok.length && ok[i]) { if (from < 0) from = i; continue; }
      if (from >= 0) {
        const s0 = from === 0 ? 0 : (at[from - 1] + at[from]) / 2;
        const s1 = i === ok.length ? acc : (at[i - 1] + at[i]) / 2;
        if (s1 - s0 > 0.3) out.push(cut(pts, s0, s1));
        from = -1;
      }
    }
    return out;
  }

  /** How far below the pavement the ground is here: ROAD_DIP on sunk tarmac, else 0. */
  dipAt(x: number, z: number) {
    return this.onTarmac(x, z) ? ROAD_DIP : 0;
  }
}
