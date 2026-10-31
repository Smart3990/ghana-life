// Trains on the real Accra railway (step 7 of the Epic City plan: "the living world").
//
// The track comes from the map tiles (railway.ts) in pieces, one per tile, overlapping a little at the
// tiles' edges. Rather than joining the pieces, the train's way is traced along the track: from a
// point on it, step a metre and a half forward and snap back onto the nearest rail running the same way,
// until the track ends. The way runs at most ROUTE metres each side of where it was first traced
// near you, so a train passes every couple of minutes.
//
// One passenger train (the Epic City pack's engine and three coaches) shuttles along it on the game
// clock: out to one end, a short stop as at a platform, and back, the engine always in front. At
// every place where the line crosses a road there is a level crossing: a red and white barrier each
// side of the track and two flashing red lights. As the train comes the lights flash and the barriers
// come down; road traffic stops at them (they are obstacles to the drivers) and goes on once the
// train has passed and the barriers are up again.
import * as THREE from 'three';
import { epicGeometry, epicMaterial } from './epicKit';
import type { Railway } from './railway';

const STEP = 1.5; // metres between the traced points
const ROUTE = 650; // metres traced each way from the start
const SPEED = 11; // metres a second (about 40 km/h)
const DWELL = 10; // seconds stopped at each end
const RAIL_Y = 0.2; // the wheels on top of the rails
const CLOSE_AHEAD = 150; // the barriers come down when the train is this far off (metres)...
const CLOSE_BEHIND = 25; // ...and go up once it is this far past
const CARS = ['vehicles/train-passenger.glb', 'vehicles/train-passenger-wagon.glb', 'vehicles/train-passenger-wagon.glb', 'vehicles/train-passenger-wagon.glb'];

type Way = { xs: Float32Array; zs: Float32Array; cum: Float32Array; length: number };
type Crossing = {
  edges: number[]; // for each side of the track (-1, +1): which edge of the road its barrier closes from
  s: number; // where along the way
  x: number; z: number;
  road: { x: number; z: number }; // the road's direction (along it)
  back: number; // how far back along the road from the middle of the track each barrier stands
  half: number; // the road's half width
  gates: THREE.Group[]; // the two barriers (each turns about its post)
  lamps: THREE.Mesh[];
  closed: number; // 0 open .. 1 down
};

export class Trains {
  readonly group = new THREE.Group();
  private way: Way | null = null;
  private tracedFrom: { x: number; z: number; lines: number } | null = null;
  private cars: { mesh: THREE.Mesh; len: number }[] = [];
  private crossings: Crossing[] = [];
  private crossingGroup = new THREE.Group();
  /** Where each coach is now (centre, facing, half length), for collisions and tests. */
  readonly boxes: { x: number; z: number; fx: number; fz: number; half: number; halfW: number }[] = [];
  /** Points across the roads at closed crossings: the drivers stop before them. */
  readonly blockers: { x: number; z: number; r: number }[] = [];

  constructor(
    private railway: Railway,
    /** Is this point on a road? And the nearest road there (its direction and half width). */
    private road: { at: (x: number, z: number) => boolean; near: (x: number, z: number) => { dx: number; dz: number; half: number } | null },
  ) {
    this.group.add(this.crossingGroup);
    void Promise.all(CARS.map((f) => epicGeometry(f))).then((geos) => {
      for (const g of geos) {
        g.computeBoundingBox();
        const b = g.boundingBox!;
        // (The pack's vehicles face +z.)
        const mesh = new THREE.Mesh(g, epicMaterial());
        mesh.castShadow = true;
        mesh.visible = false;
        mesh.matrixAutoUpdate = false;
        this.group.add(mesh);
        this.cars.push({ mesh, len: b.max.z - b.min.z });
      }
    });
  }

  /** Move the train on to time t (seconds of game time); (px, pz): the player. */
  update(t: number, px: number, pz: number) {
    // (Re)trace the way when the track near you has loaded, or when you have gone far from it.
    const lines = this.railway.lines.length;
    if (lines && (!this.way || (this.tracedFrom && (lines !== this.tracedFrom.lines && this.farFrom(px, pz) > 60)) || this.farFrom(px, pz) > 500)) {
      const near = this.nearestOnTrack(px, pz, 400);
      if (near) this.trace(near.x, near.z, near.fx, near.fz, lines);
      else if (!this.way) return;
    }
    const way = this.way;
    if (!way || !this.cars.length || way.length < 120) {
      for (const c of this.cars) c.mesh.visible = false;
      this.blockers.length = 0;
      this.boxes.length = 0;
      return;
    }
    // Where the front (the engine) is: out (rising), a stop, back (falling, the engine at the rear, as
    // on a push-pull commuter train: the coaches never swap round), a stop.
    const trainLen = this.cars.reduce((s, c) => s + c.len, 0);
    const run = (way.length - trainLen) / SPEED;
    const period = 2 * (run + DWELL);
    const k = ((t % period) + period) % period;
    let head: number, dir: number;
    if (k < run) [head, dir] = [trainLen + k * SPEED, 1];
    else if (k < run + DWELL) [head, dir] = [way.length, 0];
    else if (k < 2 * run + DWELL) [head, dir] = [way.length - (k - run - DWELL) * SPEED, -1];
    else [head, dir] = [trainLen, 0];
    const tail = head - trainLen;
    // Each coach, behind the engine, facing along the line (smooth through the bends).
    this.boxes.length = 0;
    let at = head;
    const p = { x: 0, z: 0, fx: 0, fz: 1 };
    for (const c of this.cars) {
      this.pointAt(at - 0.5, p);
      const [ax, az] = [p.x, p.z];
      this.pointAt(at - c.len + 0.5, p);
      const [bx, bz] = [p.x, p.z];
      const cx = (ax + bx) / 2, cz = (az + bz) / 2;
      const heading = Math.atan2(ax - bx, -(az - bz));
      this.q.setFromAxisAngle(this.up, Math.PI - heading);
      c.mesh.matrix.compose(this.v.set(cx, RAIL_Y, cz), this.q, this.one);
      c.mesh.visible = (cx - px) ** 2 + (cz - pz) ** 2 < 400 * 400;
      this.boxes.push({ x: cx, z: cz, fx: Math.sin(heading), fz: -Math.cos(heading), half: c.len / 2, halfW: 1.5 });
      at -= c.len;
    }
    // The level crossings: down while the train is coming, on them, or just past.
    this.blockers.length = 0;
    for (const cr of this.crossings) {
      const on = cr.s >= tail - 2 && cr.s <= head + 2;
      const coming = dir > 0 ? cr.s > head && cr.s - head < CLOSE_AHEAD : dir < 0 ? cr.s < tail && tail - cr.s < CLOSE_AHEAD : false;
      const gone = dir > 0 ? cr.s < tail && tail - cr.s < CLOSE_BEHIND : dir < 0 ? cr.s > head && cr.s - head < CLOSE_BEHIND : false;
      const down = on || coming || gone;
      cr.closed += ((down ? 1 : 0) - cr.closed) * 0.06;
      const lift = (1 - cr.closed) * (Math.PI / 2) * 0.95;
      for (const g of cr.gates) g.rotation.z = -lift;
      const flash = down && Math.floor(t * 2.4) % 2 === 0;
      cr.lamps.forEach((l, i) => (l.visible = down && flash === (i % 2 === 0)));
      if (cr.closed > 0.3) {
        // At each barrier, across the half of the road leading onto the track: the drivers stop there.
        for (const g of cr.gates) {
          const { bx, bz, nx, nz } = g.userData as { bx: number; bz: number; nx: number; nz: number };
          for (let o = 0.4; o <= cr.half; o += 1.3) this.blockers.push({ x: bx + nx * o, z: bz + nz * o, r: 0.8 });
        }
      }
    }
  }
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);

  /** Is (x, z) inside a coach (with room around it)? */
  solid(x: number, z: number, room: number) {
    for (const b of this.boxes) {
      const dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx * b.fx + dz * b.fz) < b.half + room && Math.abs(dx * -b.fz + dz * b.fx) < b.halfW + room) return true;
    }
    return false;
  }

  /** For tests: the way's length, where the crossings are and whether they are down. */
  get info() {
    return { length: this.way?.length ?? 0, crossings: this.crossings.map((c) => ({ x: Math.round(c.x), z: Math.round(c.z), closed: +c.closed.toFixed(2) })), cars: this.boxes.map((b) => [Math.round(b.x), Math.round(b.z)]) };
  }

  // ---------- The way along the track ----------

  private farFrom(x: number, z: number) {
    const w = this.way;
    if (!w) return Infinity;
    let best = Infinity;
    for (let i = 0; i < w.xs.length; i += 4) best = Math.min(best, Math.hypot(w.xs[i] - x, w.zs[i] - z));
    return best;
  }

  /** The nearest point on the track (and its direction) within `reach`. */
  private nearestOnTrack(x: number, z: number, reach: number, fx = 0, fz = 0) {
    let best: { x: number; z: number; fx: number; fz: number; d: number } | null = null;
    for (const p of this.railway.lines) {
      for (let i = 0; i + 3 < p.length; i += 2) {
        const [ax, az, bx, bz] = [p[i], p[i + 1], p[i + 2], p[i + 3]];
        if (Math.min(ax, bx) - reach > x || Math.max(ax, bx) + reach < x || Math.min(az, bz) - reach > z || Math.max(az, bz) + reach < z) continue;
        const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
        if (len < 0.01) continue;
        let ux = dx / len, uz = dz / len;
        if (fx || fz) {
          // Only rails running the way we are going (at a junction of lines, the straightest one).
          const dot = ux * fx + uz * fz;
          if (Math.abs(dot) < 0.8) continue;
          if (dot < 0) [ux, uz] = [-ux, -uz];
        }
        const tt = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (len * len)));
        const qx = ax + dx * tt, qz = az + dz * tt;
        const d = Math.hypot(qx - x, qz - z);
        if (d < reach && (!best || d < best.d)) best = { x: qx, z: qz, fx: ux, fz: uz, d };
      }
    }
    return best;
  }

  private trace(x: number, z: number, fx: number, fz: number, lines: number) {
    const walk = (dx: number, dz: number) => {
      const pts: [number, number][] = [];
      let [cx, cz, ux, uz] = [x, z, dx, dz];
      for (let s = 0; s < ROUTE; s += STEP) {
        const n = this.nearestOnTrack(cx + ux * STEP, cz + uz * STEP, 2.2, ux, uz);
        if (!n) break;
        // (Turn gently towards the rail's direction.)
        [ux, uz] = [ux * 0.5 + n.fx * 0.5, uz * 0.5 + n.fz * 0.5];
        const l = Math.hypot(ux, uz) || 1;
        [ux, uz] = [ux / l, uz / l];
        [cx, cz] = [n.x, n.z];
        pts.push([cx, cz]);
      }
      return pts;
    };
    const back = walk(-fx, -fz).reverse();
    const pts = [...back, [x, z] as [number, number], ...walk(fx, fz)];
    const n = pts.length;
    const xs = new Float32Array(n), zs = new Float32Array(n), cum = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      [xs[i], zs[i]] = pts[i];
      cum[i] = i ? cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]) : 0;
    }
    this.way = { xs, zs, cum, length: cum[n - 1] };
    this.tracedFrom = { x, z, lines };
    this.findCrossings();
  }

  /** Point at distance s along the way (clamped), with its direction. */
  private pointAt(s: number, out: { x: number; z: number; fx: number; fz: number }) {
    const w = this.way!;
    s = Math.max(0, Math.min(w.length, s));
    let lo = 0, hi = w.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (w.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = w.cum[hi] - w.cum[lo] || 1;
    const k = (s - w.cum[lo]) / seg;
    out.x = w.xs[lo] + (w.xs[hi] - w.xs[lo]) * k;
    out.z = w.zs[lo] + (w.zs[hi] - w.zs[lo]) * k;
    out.fx = (w.xs[hi] - w.xs[lo]) / seg;
    out.fz = (w.zs[hi] - w.zs[lo]) / seg;
    return true;
  }

  private trackSide(cr: { s: number }) {
    // Along the track at the crossing (the barriers stand either side of it, along the road).
    const p = { x: 0, z: 0, fx: 0, fz: 1 };
    this.pointAt(cr.s, p);
    return { x: p.fx, z: p.fz };
  }

  // ---------- Level crossings ----------

  private findCrossings() {
    for (const c of this.crossings) for (const g of [...c.gates, ...c.lamps]) g.removeFromParent();
    this.crossingGroup.clear();
    this.crossings = [];
    const w = this.way!;
    let runStart = -1;
    for (let i = 0; i <= w.xs.length; i++) {
      const on = i < w.xs.length && this.road.at(w.xs[i], w.zs[i]);
      if (on && runStart < 0) runStart = i;
      if (!on && runStart >= 0) {
        const a = runStart, b = i - 1;
        runStart = -1;
        // (A real crossing: the line cuts across the road, over a short stretch. A line running along
        // beside a road, touching its edge, is not one.)
        if (w.cum[b] - w.cum[a] < 3 || w.cum[b] - w.cum[a] > 40) continue;
        const mi = (a + b) >> 1;
        const x = w.xs[mi], z = w.zs[mi];
        const r = this.road.near(x, z);
        if (!r) continue;
        const rail = { x: 0, z: 0, fx: 0, fz: 1 };
        this.pointAt(w.cum[mi], rail);
        if (Math.abs(rail.fx * r.dx + rail.fz * r.dz) > 0.75) continue;
        if (this.crossings.some((c) => Math.hypot(c.x - x, c.z - z) < 15)) continue;
        this.addCrossing(w.cum[mi], x, z, { x: r.dx, z: r.dz }, r.half);
      }
    }
  }

  private addCrossing(s: number, x: number, z: number, road: { x: number; z: number }, half: number) {
    const t = this.trackSide({ s } as Crossing);
    // Each barrier stands back from the track along the road (further where the line crosses at a
    // slant, so the whole track stays clear), the cars stopping in front of it.
    const slant = Math.abs(road.x * t.z - road.z * t.x) || 1;
    const back = Math.min(12, 3.6 / Math.max(0.45, slant) + 0.8);
    const cr: Crossing = { s, x, z, road, back, half, gates: [], lamps: [], closed: 0, edges: [] };
    const white = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.6 });
    const red = new THREE.MeshStandardMaterial({ color: '#c8102e', roughness: 0.6 });
    const grey = new THREE.MeshStandardMaterial({ color: '#5a5d61', roughness: 0.7 });
    const glow = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
    const len = half + 0.4;
    // Across the road (its normal).
    const N = { x: -road.z, z: road.x };
    for (const side of [-1, 1]) {
      // Half-barriers, as on real crossings: traffic coming towards the track on this side drives
      // along -side x road, on the right; its barrier's post stands at its right-hand edge and the
      // striped boom swings down across its half of the road (a vehicle already on the crossing can
      // always drive off it). The right of a direction (dx, dz) here is (-dz, dx).
      const dx = -side * road.x, dz = -side * road.z;
      const e = Math.sign(N.x * -dz + N.z * dx) || 1;
      cr.edges.push(e);
      const bx = x + road.x * side * back, bz = z + road.z * side * back; // the barrier's line, in the middle of the road
      const ox = bx + N.x * e * (half + 0.5), oz = bz + N.z * e * (half + 0.5); // its post
      const pivot = new THREE.Group();
      pivot.position.set(ox, 1.05, oz);
      // Its local -x points from the post across the road (towards -e N); it lifts by turning about z.
      pivot.rotation.order = 'YXZ';
      pivot.rotation.y = Math.atan2(-e * N.z, e * N.x);
      pivot.userData = { bx, bz, nx: N.x * e, nz: N.z * e };
      for (let k = 0; k < Math.ceil(len / 0.8); k++) {
        const w = Math.min(0.8, len - k * 0.8);
        const seg = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.08), k % 2 ? white : red);
        seg.position.x = -(k * 0.8 + w / 2);
        pivot.add(seg);
      }
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.22), grey);
      post.position.set(ox, 0.55, oz);
      // Beside it, facing the coming traffic: a post with a black board of two red lamps and the white
      // cross sign above.
      const lx = ox + road.x * side * 0.7 + N.x * e * 0.3, lz = oz + road.z * side * 0.7 + N.z * e * 0.3;
      const face = Math.atan2(side * road.x, side * road.z); // (the board's front looks along +side x road)
      const lightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 6), grey);
      lightPost.position.set(lx, 1.5, lz);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.06), new THREE.MeshStandardMaterial({ color: '#16181a' }));
      board.position.set(lx, 2.3, lz);
      board.rotation.y = face;
      const xa = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.04), white);
      const xb = xa.clone();
      xa.position.set(lx, 2.9, lz);
      xb.position.set(lx, 2.9, lz);
      xa.rotation.set(0, face, 0, 'YXZ');
      xb.rotation.set(0, face, 0, 'YXZ');
      xa.rotateZ(0.6);
      xb.rotateZ(-0.6);
      this.crossingGroup.add(pivot, post, lightPost, board, xa, xb);
      cr.gates.push(pivot);
      for (const o of [-0.22, 0.22]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), glow);
        // (On the board's front, left and right.)
        lamp.position.set(lx + Math.cos(face) * o + Math.sin(face) * 0.05, 2.3, lz - Math.sin(face) * o + Math.cos(face) * 0.05);
        lamp.visible = false;
        this.crossingGroup.add(lamp);
        cr.lamps.push(lamp);
      }
    }
    this.crossings.push(cr);
  }
}
