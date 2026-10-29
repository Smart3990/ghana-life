// Traffic that drives by the rules (owner, 28 Oct 2026: "move forever based on AI traffic rules, like
// the pack"). Each vehicle is its own driver, as in the Low Poly Epic City pack's CarBehavior:
//   - Every road is cut into lanes (Ghana drives on the right): main roads two lanes each way, side
//     roads one. A vehicle stays in its lane; it only turns at a real junction, along a smooth curve
//     from its lane into the lane it turns into (left turns from the inner lane, right from the outer).
//   - It keeps its distance from whatever is ahead (the vehicle in front, a queue, someone standing in
//     the road), speeding up and braking smoothly (the "intelligent driver" rule real traffic
//     simulators use).
//   - It stops at the line on red, and before entering a junction it gives way: it goes only when no
//     vehicle on a crossing path is in the junction, and when there is room in the lane it turns into.
//     So two vehicles never pass through each other.
//   - It picks its way at every junction (straight on most often) and drives on for ever. Around the
//     player the roads are kept full (fuller in the rush hours): new vehicles join out of sight, and
//     vehicles that drive far away are let go.
// All of this is worked out on the phone itself, only for the streets around the player.
import { KINDS, kindFor, type Kind, type Placed, type Vehicle } from './traffic';
import { TYPE_BY_KEY, typeFor } from './vehicleTypes';

type V2 = [number, number];
type Road = { pts: [number, number][]; lanes: 1 | 2; half?: number; bridge?: boolean; oneway?: boolean };

export type SimJunction = { x: number; z: number };
type Node = { id: number; x: number; z: number; ins: Seg[]; outs: Seg[]; links: Seg[]; busy: Set<Car>; edges: number; clear: number };
type Seg = {
  id: number;
  link: boolean; // a turning curve through a junction (else a lane)
  pts: Float32Array; // x, z pairs (local metres)
  cum: Float32Array;
  len: number;
  next: Seg[]; // lane: the links out of its end; link: the lane it leads into
  node: Node | null; // lane: the junction at its end; link: the junction it crosses
  conflicts: Set<Seg>; // links only: other links of the same junction whose path crosses this one
  from: Seg | null; // links only: the lane it comes from
  speed: number; // the speed limit here (m/s)
  bridge: boolean;
  cars: Car[]; // on this piece, in order along it
  cx: number;
  cz: number;
  dead: boolean;
  /** Runs through something solid (under a low flyover ramp, through a building): never used. */
  walled?: boolean;
  wallAt?: number; // how far along it the first solid point is
  checked?: number; // the blockVersion it was last checked against
  start?: Node; // lanes: the junction at its start
  edge: number; // the road piece it belongs to (lanes of the same edge and direction share it)
  dir: number; // +1 / -1 along the edge
  index: number; // lane number from the middle of the road (0 = inner)
  lanes: number; // lanes this way
};
type Car = {
  id: number;
  kind: Kind;
  type: string; // the model (vehicleTypes.ts)
  colour: string;
  seg: Seg;
  s: number; // metres along the piece (the vehicle's middle)
  v: number;
  v0: number; // how fast this driver likes to go (m/s, before the speed limit)
  len: number;
  halfW: number;
  plan: Seg | null; // the link this driver will take at the end of its lane
  committed: boolean; // has the right of way through the junction ahead
  stuck: number; // seconds without moving
  special?: 'ambulance';
  /** A story vehicle (the trotro you arrive in, Uncle Kwame's car): a real driver in the traffic,
   *  steered to its stop and along its way; never let go until the story releases it. */
  story?: { stop: { seg: Seg; s: number } | null; guide: Float32Array | null; released: boolean; side?: number; sideNow?: number; yaw?: number };
};

// Driving behaviour (intelligent driver model): comfortable, Accra-busy.
const ACC = 1.8; // m/s² speeding up
const BRAKE = 3; // m/s² comfortable braking
const HEADWAY = 1.0; // seconds behind the vehicle in front
const MIN_GAP = 1.6; // metres left when stopped in a queue
const LOOK = 70; // metres a driver looks ahead
// Lengths and widths of the vehicles (the Epic City pack's, as vehicles3d.ts draws them).
const LEN: Record<Kind, number> = { car: 4.7, taxi: 5.35, trotro: 4.4, tricycle: 3, okada: 2.2, bus: 11.3, truck: 6.3, pickup: 5.3, suv: 4.7 };
const WIDTH: Record<Kind, number> = { car: 2.1, taxi: 2.2, trotro: 1.85, tricycle: 1.4, okada: 0.85, bus: 2.85, truck: 2.3, pickup: 2.0, suv: 2.1 };

const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
const norm = (x: number, z: number): V2 => {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
};

function cumulative(pts: Float32Array) {
  const n = pts.length / 2;
  const cum = new Float32Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
  return cum;
}
/** A polyline moved sideways by `off` metres (+ = to the right of travel), mitred at the corners. */
function offsetLine(pts: V2[], off: number): V2[] {
  const n = pts.length;
  return pts.map((b, i) => {
    const a = pts[Math.max(0, i - 1)], c = pts[Math.min(n - 1, i + 1)];
    const d1 = i > 0 ? norm(b[0] - a[0], b[1] - a[1]) : norm(c[0] - b[0], c[1] - b[1]);
    const d2 = i < n - 1 ? norm(c[0] - b[0], c[1] - b[1]) : d1;
    // Right of the direction (x east, z south): (-dz, dx).
    let rx = -d1[1] - d2[1], rz = d1[0] + d2[0];
    const rl = Math.hypot(rx, rz);
    if (rl < 1e-3) { rx = -d1[1]; rz = d1[0]; } else { rx /= rl; rz /= rl; }
    const k = Math.min(2.2, 1 / Math.max(0.3, rx * -d1[1] + rz * d1[0]));
    return [b[0] + rx * off * k, b[1] + rz * off * k];
  });
}
/** The part of a polyline between distances s0 and s1 along it. */
function cut(pts: V2[], s0: number, s1: number): V2[] {
  const out: V2[] = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 1e-6) continue;
    if (acc + l >= s0 && acc <= s1) {
      const t0 = Math.max(0, (s0 - acc) / l), t1 = Math.min(1, (s1 - acc) / l);
      if (!out.length) out.push([ax + (bx - ax) * t0, az + (bz - az) * t0]);
      out.push([ax + (bx - ax) * t1, az + (bz - az) * t1]);
    }
    acc += l;
  }
  return out;
}
const polyLength = (pts: V2[]) => pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
function segmentsCross(a: Float32Array, b: Float32Array) {
  for (let i = 0; i + 3 < a.length; i += 2)
    for (let j = 0; j + 3 < b.length; j += 2) {
      const [p1x, p1z, p2x, p2z] = [a[i], a[i + 1], a[i + 2], a[i + 3]];
      const [q1x, q1z, q2x, q2z] = [b[j], b[j + 1], b[j + 2], b[j + 3]];
      const d = (p2x - p1x) * (q2z - q1z) - (p2z - p1z) * (q2x - q1x);
      if (Math.abs(d) < 1e-9) continue;
      const t = ((q1x - p1x) * (q2z - q1z) - (q1z - p1z) * (q2x - q1x)) / d;
      const u = ((q1x - p1x) * (p2z - p1z) - (q1z - p1z) * (p2x - p1x)) / d;
      if (t > 0.02 && t < 0.98 && u > 0.02 && u < 0.98) return true;
    }
  return false;
}

export class TrafficSim {
  private nodes: Node[] = [];
  private nodeGrid = new Map<string, Node[]>();
  private segs: Seg[] = [];
  private lanes: Seg[] = [];
  private laneGrid = new Map<string, Seg[]>();
  private cars: Car[] = [];
  private nextId = 1;
  private edgeCount = 0;
  private oneways = 0;
  private active: Seg[] = [];
  private activeAt: V2 = [1e9, 1e9];
  private started = 0;
  /** Seconds of sim time. */
  time = 0;

  /** How many vehicles at most, how far round the player the roads are kept full, and how far they are seen. */
  constructor(
    private toLocal: (lon: number, lat: number) => [number, number],
    private toLngLat: (x: number, z: number) => [number, number],
    public opts: { max: number; radius: number; seen: number },
  ) {}

  /** How full the roads are (0-1: the share of room filled; the hour of the day sets it). */
  fill = 0.8;
  /** Traffic lights: is it red (or amber) for traffic leaving lane end (x, z) heading `heading`? */
  redLight: ((x: number, z: number, heading: number, t: number) => { stop: boolean; extra: number } | null) | null = null;
  /** Things in the road that vehicles wait behind (the player, the story's vehicles): centre, half length, half width. */
  obstacles: { x: number; z: number; r: number; heading?: number; half?: number; halfW?: number }[] = [];
  /** Called every frame a vehicle is waiting for the player in front of it (the game hoots and shouts). */
  onWaitForPlayer: ((v: { id: number; x: number; z: number; heading: number; kind: string; halfW: number; half: number; waited: number }) => void) | null = null;
  /** Is obstacles[0] the player? */
  playerFirst = false;
  /** For tests: vehicles taken off the road close to the player by the 10-second rule's last resort. */
  nearDrops = 0;
  /** Vehicles that must not move (a driver who got out). */
  hold = new Set<number>();
  /**
   * Is this point inside something solid (a low flyover ramp, a building)? Set by the game. A ground
   * lane with any point inside is never used (owner, 28 Oct 2026: vehicles and riders never pass
   * through walls, strictly). Change `blockVersion` when more of the solid things have loaded.
   */
  blocked: ((x: number, z: number) => boolean) | null = null;
  blockVersion = 0;
  private seenBlockVersion = -1;
  /**
   * Where the map has two roads drawn almost on top of each other, a lane of one runs right along a lane
   * of the other the opposite way: vehicles on them would meet head-on and pass through each other.
   * The second of each such pair is not used (the first carries the traffic).
   */
  private duplicate(seg: Seg) {
    if (seg.link || seg.len < 6) return false;
    let close = 0;
    const N = 5;
    for (let k = 0; k < N; k++) {
      const p = this.pointAt(seg, ((k + 0.5) / N) * seg.len);
      const cx = Math.floor(p.x / 60), cz = Math.floor(p.z / 60);
      let found = false;
      for (let i = -1; i <= 1 && !found; i++)
        for (let j = -1; j <= 1 && !found; j++)
          for (const o of this.laneGrid.get(`${cx + i},${cz + j}`) ?? []) {
            if (o === seg || o.edge === seg.edge || o.bridge !== seg.bridge || o.id > seg.id || o.walled) continue;
            if (Math.abs(o.cx - p.x) > o.len + 4 || Math.abs(o.cz - p.z) > o.len + 4) continue;
            const pr = project(o, p.x, p.z);
            if (pr.d > 1.6) continue;
            const q = this.pointAt(o, pr.s);
            if (q.fx * p.fx + q.fz * p.fz < -0.8) {
              found = true;
              break;
            }
          }
      if (found) close++;
    }
    return close >= 3;
  }
  /** Lanes (and curves) closed because they pass through something solid, so far (for tests). */
  walledCount = 0;
  private isWalled(seg: Seg) {
    if (seg.checked === this.blockVersion) return !!seg.walled;
    seg.checked = this.blockVersion;
    const was = !!seg.walled;
    seg.walled = this.duplicate(seg);
    seg.wallAt = undefined;
    if (!seg.walled && this.blocked && !seg.bridge) {
      const step = 2;
      for (let i = 1; i < seg.pts.length / 2 && !seg.walled; i++) {
        const ax = seg.pts[i * 2 - 2], az = seg.pts[i * 2 - 1], bx = seg.pts[i * 2], bz = seg.pts[i * 2 + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
        for (let k = 0; k <= n; k++)
          if (this.blocked(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n)) {
            seg.walled = true;
            seg.wallAt = seg.cum[i - 1] + (Math.hypot(bx - ax, bz - az) * k) / n;
            break;
          }
      }
    }
    if (seg.walled !== was) this.walledCount += seg.walled ? 1 : -1;
    return seg.walled;
  }

  // ---------- Building the lanes ----------

  private nodeAt(x: number, z: number, make = true): Node | null {
    const cx = Math.floor(x / 4), cz = Math.floor(z / 4);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const n of this.nodeGrid.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(n.x - x, n.z - z) < 1.2) return n;
    if (!make) return null;
    const n: Node = { id: this.nodes.length, x, z, ins: [], outs: [], links: [], busy: new Set(), edges: 0, clear: 0 };
    this.nodes.push(n);
    const k = `${cx},${cz}`;
    (this.nodeGrid.get(k) ?? this.nodeGrid.set(k, []).get(k)!).push(n);
    return n;
  }

  /** New streets (one map tile): each becomes lanes both ways, joined at its junctions. */
  addRoads(roads: Road[]) {
    const lines = roads
      .map((r) => ({ r, pts: r.pts.map(([lon, lat]) => this.toLocal(lon, lat) as V2) }))
      .filter((l) => l.pts.length >= 2);
    // 1. Junctions: points shared by two or more streets, and every street's ends.
    const key = (p: V2) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
    const count = new Map<string, number>();
    for (const l of lines) for (const p of l.pts) count.set(key(p), (count.get(key(p)) ?? 0) + 1);
    const touched = new Set<Node>();
    type Piece = { pts: V2[]; a: Node; b: Node; r: Road };
    const pieces: Piece[] = [];
    for (const l of lines) {
      let start = 0;
      for (let i = 1; i < l.pts.length; i++) {
        if (i < l.pts.length - 1 && (count.get(key(l.pts[i])) ?? 0) < 2) continue;
        const pts = l.pts.slice(start, i + 1);
        start = i;
        if (polyLength(pts) < 0.5) continue;
        const a = this.nodeAt(...pts[0])!, b = this.nodeAt(...pts[pts.length - 1])!;
        if (a === b) continue;
        pieces.push({ pts, a, b, r: l.r });
        a.edges++;
        b.edges++;
        touched.add(a);
        touched.add(b);
      }
    }
    // 2. How far back from each junction the lanes stop (the junction box): wide junctions further.
    const halfOf = (r: Road) => r.half ?? (r.lanes === 2 ? 5 : 3.25);
    const widest = new Map<Node, number>();
    for (const p of pieces) for (const n of [p.a, p.b]) widest.set(n, Math.max(widest.get(n) ?? 0, halfOf(p.r)));
    for (const n of touched) n.clear = n.edges >= 3 ? (widest.get(n) ?? 4) + 1.5 : 0.6;
    // 3. Lanes: each piece both ways, two lanes each way on main roads.
    for (const p of pieces) {
      const edge = this.edgeCount++;
      if (p.r.oneway) this.oneways++;
      const half = halfOf(p.r);
      const per = p.r.lanes;
      const kindSpeed = half >= 6.5 ? 17 : half >= 4.5 ? 13 : 9; // highway / main road / side street (m/s)
      // A one-way street (each side of a dual carriageway is one on the map): its lanes all go one way,
      // across its whole width.
      const oneway = !!p.r.oneway;
      for (const dir of oneway ? [1] : [1, -1]) {
        const path = dir > 0 ? p.pts : [...p.pts].reverse();
        const from = dir > 0 ? p.a : p.b, to = dir > 0 ? p.b : p.a;
        const L = polyLength(path);
        const s0 = Math.min(from.clear, L * 0.35), s1 = Math.max(L - to.clear, L * 0.65);
        const n = oneway ? Math.max(2, per) : per;
        for (let i = 0; i < n; i++) {
          // To the right of travel; on a one-way street spread over the whole road.
          const off = oneway ? -half + ((i + 0.5) * 2 * half) / n : n === 1 ? half * 0.5 : half * (0.32 + 0.42 * i); // (inner lanes clear of the centre line: the pack's vehicles are wide)
          const line = cut(offsetLine(path, off), s0 * (1 + 0.0), s1);
          if (line.length < 2) continue;
          const pts = Float32Array.from(line.flat());
          const cum = cumulative(pts);
          const mid = line[line.length >> 1];
          const seg: Seg = { id: this.segs.length, link: false, pts, cum, len: cum[cum.length - 1], next: [], node: to, conflicts: new Set(), from: null, speed: kindSpeed, bridge: !!p.r.bridge, cars: [], cx: mid[0], cz: mid[1], dead: false, edge, dir, index: i, lanes: n }; // (0: the inner lane, nearest the middle or the left edge)
          seg.start = from;
          this.segs.push(seg);
          this.lanes.push(seg);
          from.outs.push(seg);
          to.ins.push(seg);
          const gk = `${Math.floor(mid[0] / 60)},${Math.floor(mid[1] / 60)}`;
          (this.laneGrid.get(gk) ?? this.laneGrid.set(gk, []).get(gk)!).push(seg);
        }
      }
    }
    // 4. The turning curves through every junction these streets touch.
    for (const n of touched) this.linkNode(n);
    this.activeAt = [1e9, 1e9];
  }

  /** (Re)build the curves through a junction: from every lane in to the lanes out of it. */
  private linkNode(n: Node) {
    for (const l of n.links) l.dead = true; // (vehicles already on them carry on)
    n.links = [];
    for (const lane of n.ins) lane.next = [];
    for (const inn of n.ins) {
      const ix = inn.pts[inn.pts.length - 2], iz = inn.pts[inn.pts.length - 1];
      const [dix, diz] = norm(ix - inn.pts[inn.pts.length - 4], iz - inn.pts[inn.pts.length - 3]);
      // Ways out: every other street (back the way it came only at a dead end).
      let outs = n.outs.filter((o) => o.edge !== inn.edge);
      if (!outs.length) outs = n.outs.filter((o) => o.edge === inn.edge);
      for (const out of outs) {
        const ox = out.pts[0], oz = out.pts[1];
        const [dox, doz] = norm(out.pts[2] - ox, out.pts[3] - oz);
        const turn = dix * doz - diz * dox; // > 0: turning right (x east, z south)
        const straight = dix * dox + diz * doz > 0.7;
        // Lanes: left turns from the inner lane, right turns from the outer, straight on lane to lane.
        if (inn.lanes > 1 && !straight && out.edge !== inn.edge) {
          if (turn < 0 && inn.index !== 0) continue;
          if (turn > 0 && inn.index !== inn.lanes - 1) continue;
        }
        if (out.lanes > 1 && straight && out.index !== Math.min(inn.index, out.lanes - 1)) continue;
        if (out.lanes > 1 && !straight && out.index !== (turn < 0 ? 0 : out.lanes - 1)) continue;
        // A smooth curve from the end of one lane to the start of the other.
        const d = Math.hypot(ox - ix, oz - iz);
        const k = Math.max(0.5, d * 0.42);
        const pts: number[] = [];
        const steps = d < 1.5 ? 1 : 8;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps, u = 1 - t;
          const p1x = ix + dix * k, p1z = iz + diz * k, p2x = ox - dox * k, p2z = oz - doz * k;
          pts.push(u * u * u * ix + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * ox, u * u * u * iz + 3 * u * u * t * p1z + 3 * u * t * t * p2z + t * t * t * oz);
        }
        const arr = Float32Array.from(pts);
        const cum = cumulative(arr);
        const link: Seg = { id: this.segs.length, link: true, pts: arr, cum, len: Math.max(0.05, cum[cum.length - 1]), next: [out], node: n, conflicts: new Set(), from: inn, speed: Math.min(inn.speed, out.speed, straight ? 14 : 7), bridge: inn.bridge && out.bridge, cars: [], cx: (ix + ox) / 2, cz: (iz + oz) / 2, dead: false, edge: -1, dir: 0, index: 0, lanes: 1 };
        this.segs.push(link);
        n.links.push(link);
        inn.next.push(link);
      }
    }
    // Which curves cross (or end in the same lane): only one of each such pair may be in use at once.
    for (const a of n.links)
      for (const b of n.links) {
        if (a === b || a.from === b.from) continue;
        if (a.next[0] === b.next[0] || segmentsCross(a.pts, b.pts)) a.conflicts.add(b);
      }
  }

  // ---------- Moving ----------

  private pointAt(seg: Seg, s: number): { x: number; z: number; fx: number; fz: number } {
    const cum = seg.cum;
    const n = cum.length;
    s = Math.max(0, Math.min(seg.len, s));
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m;
      else hi = m;
    }
    const seg0 = cum[hi] - cum[lo] || 1;
    const t = (s - cum[lo]) / seg0;
    const ax = seg.pts[lo * 2], az = seg.pts[lo * 2 + 1], bx = seg.pts[hi * 2], bz = seg.pts[hi * 2 + 1];
    const [fx, fz] = norm(bx - ax, bz - az);
    return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, fx, fz };
  }

  /** The lanes near (x, z) that are kept full. */
  private refreshActive(x: number, z: number) {
    if (Math.hypot(x - this.activeAt[0], z - this.activeAt[1]) < 15) return;
    this.activeAt = [x, z];
    const r = this.opts.radius;
    const out: Seg[] = [];
    const cells = Math.ceil(r / 60);
    const cx = Math.floor(x / 60), cz = Math.floor(z / 60);
    for (let i = -cells; i <= cells; i++)
      for (let j = -cells; j <= cells; j++)
        for (const l of this.laneGrid.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(l.cx - x, l.cz - z) < r) out.push(l);
    // Only lanes clear of anything solid are filled (their curves are checked when chosen).
    this.active = out.filter((l) => !this.isWalled(l));
  }

  private newCar(seg: Seg, s: number, kind?: Kind): Car {
    const id = this.nextId++;
    const k = kind ?? kindFor(hash(id * 7 + 1));
    const spec = KINDS[k];
    const type = typeFor(k, id);
    return {
      id, kind: k, type: type.key, colour: spec.colours[Math.floor(hash(id * 3 + 2) * spec.colours.length)], seg, s,
      v: 0, v0: spec.speed * (1.15 + hash(id * 5) * 0.35) * (type.speed ?? 1), len: type.len, halfW: type.width / 2, plan: null, committed: false, stuck: 0,
    };
  }
  private insert(car: Car, seg: Seg) {
    car.seg = seg;
    const list = seg.cars;
    let i = list.length;
    while (i > 0 && list[i - 1].s > car.s) i--;
    list.splice(i, 0, car);
  }
  private remove(car: Car) {
    const list = car.seg.cars;
    const i = list.indexOf(car);
    if (i >= 0) list.splice(i, 1);
    if (car.seg.link && car.seg.node) car.seg.node.busy.delete(car);
    if (car.committed && car.plan?.node) car.plan.node.busy.delete(car);
  }
  /** Is there room at s on this piece for a vehicle `len` long? */
  private roomAt(seg: Seg, s: number, len: number) {
    for (const c of seg.cars) if (Math.abs(c.s - s) < (c.len + len) / 2 + 3) return false;
    return true;
  }
  /** Is any vehicle (on any road) within r metres of (x, z)? */
  private crowded(x: number, z: number, r: number, bridge: boolean) {
    for (const c of this.cars) {
      if (c.seg.bridge !== bridge) continue;
      const p = this.pointAt(c.seg, c.s);
      if (Math.abs(p.x - x) < r + c.len / 2 && Math.abs(p.z - z) < r + c.len / 2 && Math.hypot(p.x - x, p.z - z) < r + c.len / 2) return true;
    }
    return false;
  }
  /** Pick the way this driver will turn at the end of its lane (straight on most often). */
  private choose(car: Car) {
    const lane = car.seg;
    const options = lane.next.filter((l) => !l.dead && !this.isWalled(l) && !this.isWalled(l.next[0]));
    if (!options.length) {
      car.plan = null;
      return;
    }
    const [ex, ez] = [lane.pts[lane.pts.length - 2] - lane.pts[lane.pts.length - 4], lane.pts[lane.pts.length - 1] - lane.pts[lane.pts.length - 3]];
    const [dx, dz] = norm(ex, ez);
    const weight = (l: Seg) => {
      const out = l.next[0];
      const [ox, oz] = norm(out.pts[2] - out.pts[0], out.pts[3] - out.pts[1]);
      const dot = dx * ox + dz * oz;
      return (dot > 0.7 ? 4 : dot > -0.5 ? 1.4 : 0.15) * (out.lanes > 1 ? 1.6 : 1); // straight on, then main roads
    };
    // A story vehicle on its way: the turn whose next lane stays closest to the way.
    const guide = car.story?.guide;
    if (guide) {
      let best = options[0], bestD = Infinity;
      for (const l of options) {
        const out = l.next[0];
        const d = distToLine(guide, out.pts[out.pts.length - 2], out.pts[out.pts.length - 1]) + distToLine(guide, out.pts[(out.pts.length >> 2) * 2], out.pts[(out.pts.length >> 2) * 2 + 1]);
        if (d < bestD) [best, bestD] = [l, d];
      }
      car.plan = best;
      return;
    }
    const total = options.reduce((s, l) => s + weight(l), 0);
    let r = hash(car.id * 13 + lane.id) * total;
    for (const l of options) if ((r -= weight(l)) <= 0) { car.plan = l; return; }
    car.plan = options[options.length - 1];
  }

  /** Room for a vehicle to join the start of a lane? */
  private entryFree(lane: Seg, len: number) {
    const first = lane.cars[0];
    return !first || first.s - first.len / 2 > len * 0.6 + 1;
  }
  /** May this driver enter the junction ahead now? (green, nothing crossing, room on the far side) */
  private mayGo(car: Car, t: number): boolean {
    const link = car.plan;
    if (!link) return false;
    const node = link.node!;
    for (const other of node.busy) {
      if (other === car) continue;
      const seg = other.committed ? other.plan : other.seg.link ? other.seg : null;
      if (seg && link.conflicts.has(seg)) return false;
    }
    if (!this.entryFree(link.next[0], car.len)) return false;
    return true;
  }

  /** Move every vehicle on by dt seconds. (x, z): the player. */
  update(dt: number, x: number, z: number) {
    dt = Math.min(0.1, Math.max(0, dt));
    this.time += dt;
    if (this.seenBlockVersion !== this.blockVersion) {
      // More solid things have loaded: which lanes are in use is worked out again.
      this.seenBlockVersion = this.blockVersion;
      this.activeAt = [1e9, 1e9];
    }
    const t = this.time;
    this.refreshActive(x, z);
    this.keepFull(x, z);
    const r2 = (this.opts.radius + 50) ** 2;
    // Where everyone is now, in 8 m cells: each driver also looks out of the windscreen (below).
    const at = new Map<Car, { x: number; z: number; fx: number; fz: number }>();
    const grid = new Map<number, Car[]>();
    for (const car of this.cars) {
      const p = this.pointAt(car.seg, car.s);
      at.set(car, p);
      const k = Math.floor(p.x / 8) * 100003 + Math.floor(p.z / 8);
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(car);
    }
    /** Is b in the space just ahead of a (the width of a's body, up to `reach` metres)? Returns the gap. */
    const inFront = (a: Car, pa: { x: number; z: number; fx: number; fz: number }, b: Car, pb: { x: number; z: number; fx: number; fz: number }, reach: number) => {
      const dx = pb.x - pa.x, dz = pb.z - pa.z;
      const along = dx * pa.fx + dz * pa.fz;
      if (along <= 0 || along > reach) return null;
      const dot = pa.fx * pb.fx + pa.fz * pb.fz;
      const cross = Math.sqrt(Math.max(0, 1 - dot * dot));
      const side = Math.abs(dx * -pa.fz + dz * pa.fx);
      if (side > a.halfW + b.halfW * Math.abs(dot) + (b.len / 2) * cross + 0.25) return null;
      return { gap: along - a.len / 2 - ((b.len / 2) * Math.abs(dot) + b.halfW * cross), dot, side };
    };
    // Each driver: how hard to speed up or brake, from what is ahead.
    for (const car of this.cars) {
      const seg = car.seg;
      const me = at.get(car)!;
      let gap = Infinity;
      let lead = 0;
      // 1. The vehicle in front on this piece, else on the way ahead (the curve and the next lane).
      const i = seg.cars.indexOf(car);
      const ahead = seg.cars[i + 1];
      if (ahead) {
        gap = ahead.s - ahead.len / 2 - (car.s + car.len / 2);
        lead = ahead.v;
      } else {
        let dist = seg.len - car.s - car.len / 2;
        let next: Seg | null = seg.link ? seg.next[0] : car.plan;
        for (let k = 0; k < 3 && next && dist < LOOK; k++) {
          const first = next.cars[0];
          if (first && first !== car) {
            gap = dist + first.s - first.len / 2;
            lead = first.v;
            break;
          }
          dist += next.len;
          next = next.link ? next.next[0] : null;
        }
      }
      // Nobody waits more than 10 seconds, anywhere (owner, 29 Oct 2026, a strict rule): after 6.5 s
      // standing, a driver stops waiting for the light (still giving way to anyone in the junction, and
      // never driving into anyone).
      const impatient = car.stuck > 6.5 && !car.story && !this.hold.has(car.id);
      // 2. The end of the lane: stop at the line for red, or to give way, or with nowhere to go.
      if (!seg.link) {
        if (!car.plan || car.plan.dead) this.choose(car);
        const toEnd = seg.len - car.s - car.len / 2;
        if (toEnd < LOOK && !car.committed) {
          let stop = !car.plan;
          let extra = 0;
          if (!stop && this.redLight && !impatient) {
            const end = this.pointAt(seg, seg.len);
            const red = this.redLight(end.x, end.z, Math.atan2(end.fx, -end.fz), t);
            if (red) {
              extra = red.extra;
              // Once at or past the line it is too late to stop: carry on through.
              if (red.stop && toEnd - extra > -0.5) stop = true;
            }
          }
          if (!stop) {
            // Take the right of way when close enough to need it (and keep it through the junction).
            const need = (car.v * car.v) / (2 * BRAKE) + 4;
            if (toEnd < need) {
              // (Someone who has waited 6.5 s edges through a jammed junction: the windscreen check below
              // still keeps them from ever touching anyone.)
              if (impatient || this.mayGo(car, t)) {
                car.committed = true;
                car.plan!.node!.busy.add(car);
              } else stop = true;
            }
          }
          if (stop) {
            const g = toEnd - extra - 0.3;
            if (g < gap) {
              gap = g;
              lead = 0;
            }
          }
        }
      }
      // 3. Out of the windscreen: any vehicle in the space ahead, whatever road it is on (where two
      //    roads of the map run side by side, a slip road merging, roads crossing with no junction on
      //    the map). Oncoming traffic is in other lanes; when two would each drive into the other,
      //    the one already further in goes first (else the lower number).
      const gx = Math.floor(me.x / 8), gz = Math.floor(me.z / 8);
      for (let ix = -2; ix <= 2; ix++)
        for (let iz = -2; iz <= 2; iz++)
          for (const other of grid.get((gx + ix) * 100003 + gz + iz) ?? []) {
            if (other === car || other.seg.bridge !== seg.bridge) continue;
            const po = at.get(other)!;
            const f = inFront(car, me, other, po, 16);
            if (!f) continue;
            // Already touching (a lane starting on top of another road, a junction curve over a lane):
            // one of the two moves out of it (the lower number), the other waits, so it clears at once.
            if (f.gap < -0.3 && car.id < other.id && f.dot < 0.6) continue;
            // Two who have both waited 6.5 s across each other's way (a standoff in a junction): the lower
            // number goes first, the other waits (the 10-second rule).
            if (impatient && other.stuck > 6.5 && f.dot < 0.9 && car.id < other.id) continue;
            // Oncoming in its own lane, passing beside: not in the way. Oncoming in this car's path (two
            // roads drawn on top of each other, a narrow bend): it is.
            if (f.dot < -0.85 && f.side > car.halfW + other.halfW - 0.5) continue;
            // Crossing paths: the one further in goes first, but never into a vehicle it is about to touch.
            if (f.dot < 0.6 && f.gap > 2.5) {
              const back = inFront(other, po, car, me, 16);
              if (back && (back.gap > f.gap + 0.5 || (Math.abs(back.gap - f.gap) <= 0.5 && car.id < other.id))) continue; // I go first
            }
            if (f.gap < gap) {
              gap = f.gap;
              lead = Math.max(0, other.v * f.dot);
            }
          }
      // 4. Someone or something standing in the road ahead (the player, a parked story vehicle).
      for (const o of this.obstacles) {
        if (o.heading !== undefined) {
          // A story vehicle, by its true outline: how far this driver can go before its body would touch it.
          const ddx = o.x - me.x, ddz = o.z - me.z;
          if (Math.abs(ddx) > 32 || Math.abs(ddz) > 32) continue;
          const ofx = Math.sin(o.heading), ofz = -Math.cos(o.heading);
          const dot = Math.abs(me.fx * ofx + me.fz * ofz), cr = Math.sqrt(Math.max(0, 1 - dot * dot));
          const reachAlong = o.half! + (car.len / 2) * dot + car.halfW * cr;
          const reachSide = o.halfW! + car.halfW * dot + (car.len / 2) * cr;
          const touching = (k: number) => {
            const cx = me.x + me.fx * k - o.x, cz = me.z + me.fz * k - o.z;
            return Math.abs(cx * ofx + cz * ofz) < reachAlong + 0.2 && Math.abs(cx * -ofz + cz * ofx) < reachSide + 0.2;
          };
          if (touching(0)) continue; // (already beside it: drive on out, never stuck in it)
          for (let k = 0.5; k <= 25; k += 0.5)
            if (touching(k)) {
              if (k - 0.5 < gap) {
                gap = Math.max(0, k - 0.5);
                lead = 0;
              }
              break;
            }
          continue;
        }
        const dx = o.x - me.x, dz = o.z - me.z;
        const along = dx * me.fx + dz * me.fz;
        if (along <= 0 || along > 25) continue;
        const side = Math.abs(dx * -me.fz + dz * me.fx);
        if (side > car.halfW + o.r * 0.6 + 0.4) continue;
        const g = along - car.len / 2 - o.r;
        if (g < gap) {
          gap = g;
          lead = 0;
        }
      }
      // A lane found to run into something solid (more buildings loaded): stop before it (the vehicle
      // is taken away once out of sight, never in front of you).
      if (seg.walled && seg.wallAt !== undefined && seg.wallAt > car.s) {
        const g = seg.wallAt - car.s - car.len / 2 - 1;
        if (g < gap) {
          gap = Math.max(0, g);
          lead = 0;
        }
      }
      // 5. A story vehicle's stop: it comes to rest with its middle there.
      if (car.story) {
        // Pulling over to the kerb (drawn that far to the right of its lane): in over its last 16 m,
        // back out gently once it drives on.
        const st = car.story;
        const d0 = st.stop && st.side ? this.distAlong(car, st.stop) : null;
        const want = d0 !== null && !st.released ? (st.side ?? 0) * smooth01(1 - Math.max(0, d0) / 16) : st.released ? 0 : (st.sideNow ?? 0);
        const now = st.sideNow ?? 0;
        // (Back out only as it rolls forward: a vehicle never moves sideways on the spot.)
        st.sideNow = st.released ? now + Math.max(-0.14 * car.v * dt, Math.min(0.14 * car.v * dt, want - now)) : want;
        // It steers: the nose turns the way it is moving across, and straightens as it stops.
        const ds = car.v * dt;
        const aim = ds > 0.001 ? Math.atan2(st.sideNow - now, ds) : 0;
        st.yaw = (st.yaw ?? 0) + (aim - (st.yaw ?? 0)) * Math.min(1, dt * 5);
      }
      if (car.story?.stop) {
        const d = this.distAlong(car, car.story.stop);
        if (d === null || d < -1) car.story.stop = null;
        else if (d + MIN_GAP < gap) {
          gap = Math.max(0, d + MIN_GAP - 0.05);
          lead = 0;
        }
      }
      if (this.hold.has(car.id)) {
        gap = 0;
        lead = 0;
      }
      // The driver's rule: speed up towards the speed they like, brake for what is ahead.
      const v0 = Math.min(car.v0, seg.speed) * (car.special ? 1.4 : 1);
      const dv = car.v - lead;
      const want = MIN_GAP + Math.max(0, car.v * HEADWAY + (car.v * dv) / (2 * Math.sqrt(ACC * BRAKE)));
      let a = ACC * (1 - (car.v / Math.max(0.5, v0)) ** 4);
      if (gap < Infinity) a -= ACC * (want / Math.max(0.1, gap)) ** 2;
      a = Math.max(-9, Math.min(ACC, a));
      car.v = Math.max(0, car.v + a * dt);
      if (gap < 0.2) car.v = Math.min(car.v, 0.3);
      car.stuck = car.v < 0.2 ? car.stuck + dt : 0;
    }
    // Move, and on into the next piece at the end of this one.
    for (const car of [...this.cars]) {
      car.s += car.v * dt;
      let guard = 0;
      while (car.s > car.seg.len && guard++ < 4) {
        const over = car.s - car.seg.len;
        const seg = car.seg;
        let next: Seg | null = null;
        if (seg.link) next = seg.next[0];
        else if (car.committed && car.plan) next = car.plan;
        if (!next) {
          car.s = seg.len;
          car.v = 0;
          break;
        }
        this.remove(car);
        if (seg.link) seg.node?.busy.delete(car);
        if (!seg.link) {
          car.committed = false;
          next.node?.busy.add(car); // in the junction now
        }
        car.s = over;
        car.plan = null;
        this.insert(car, next);
      }
      // Drivers stuck at a dead end, and vehicles far away, leave (never where the player can see).
      // A vehicle on a piece found to pass through something solid leaves at once (never seen in a wall).
      const p = this.pointAt(car.seg, car.s);
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      const keep = car.story && !car.story.released;
      const seen = d2 <= this.opts.seen ** 2;
      // Taken away only out of sight: far away, stuck at a dead end, or on a lane closed since it joined
      // (unless it is already inside something solid, where nobody may see it).
      const walledNow = this.isWalled(car.seg);
      const inside = walledNow && car.seg.wallAt !== undefined && Math.abs(car.seg.wallAt - car.s) < car.len / 2;
      // (And anyone who has waited 8.5 s more than 20 m from the player, or at a dead end where the map's
      // road stops, leaves, so a jam dissolves; as a last resort, anyone at all at 9.5 s: the 10-second rule.)
      if (!keep && !this.hold.has(car.id) && ((walledNow && (!seen || inside)) || d2 > r2 || (car.stuck > 8.5 && (d2 > 20 * 20 || (!car.seg.link && !car.plan))) || (car.stuck > 9.5 && ++this.nearDrops > 0) || (car.stuck > 25 && !car.seg.link && !car.plan && !seen))) this.drop(car);
    }
    // Keep each piece's list in order (vehicles only move forward, so this is cheap).
    for (const seg of this.active) seg.cars.sort((a, b) => a.s - b.s);
    // Waiting for the player: tell the game (it hoots).
    const o = this.obstacles[0];
    if (this.onWaitForPlayer && o && this.playerFirst) {
      for (const car of this.cars) {
        if (car.stuck < 0.3) continue;
        const p = this.pointAt(car.seg, car.s);
        const dx = o.x - p.x, dz = o.z - p.z;
        const along = dx * p.fx + dz * p.fz;
        if (along < 0 || along > car.len / 2 + 6 || Math.abs(dx * -p.fz + dz * p.fx) > car.halfW + 0.8) continue;
        this.onWaitForPlayer({ id: car.id, x: p.x, z: p.z, heading: Math.atan2(p.fx, -p.fz), kind: car.kind, halfW: car.halfW, half: car.len / 2, waited: car.stuck });
      }
    }
  }

  private drop(car: Car) {
    this.remove(car);
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  /** Keep the roads round the player full: join new vehicles out of sight, up to the limit. */
  private keepFull(x: number, z: number) {
    if (!this.started) this.started = this.time || 0.0001;
    const early = this.time - this.started < 6; // at the start, fill everywhere at once
    const seen2 = this.opts.seen ** 2;
    let budget = early ? 400 : 6; // vehicles added per frame
    if (this.cars.length >= this.opts.max) return;
    // About one vehicle every 7.5 m of lane in the rush (more room between them at quiet hours).
    const every = 7.5 / Math.max(0.15, this.fill);
    for (let k = 0; k < this.active.length && budget > 0 && this.cars.length < this.opts.max; k++) {
      const lane = this.active[(k + Math.floor(this.time * 7)) % this.active.length];
      const want = Math.floor(lane.len / every);
      if (lane.cars.length >= want) continue;
      // A free place along the lane, out of the player's sight (except at the start).
      for (let tries = 0; tries < 3; tries++) {
        const s = hash(this.nextId * 31 + tries + lane.id) * lane.len;
        const p = this.pointAt(lane, s);
        if (!early && (p.x - x) ** 2 + (p.z - z) ** 2 < seen2) continue;
        const kind = kindFor(hash(this.nextId * 7 + 1));
        const len = typeFor(kind, this.nextId).len;
        if (!this.roomAt(lane, s, len) || this.crowded(p.x, p.z, len / 2 + 3, lane.bridge)) continue;
        // Never in front of a story vehicle on its way to its stop (the trotro must reach the kerb).
        if (lane.cars.some((c) => c.story?.stop && !c.story.released && s > c.s - 5 && s < (c.story.stop.seg === lane ? c.story.stop.s : lane.len) + 25)) continue;
        const car = this.newCar(lane, s, kind);
        car.v = Math.min(car.v0, lane.speed) * 0.6;
        this.insert(car, lane);
        this.cars.push(car);
        budget--;
        break;
      }
    }
  }

  /** A special vehicle (the story's ambulance) on a lane near (x, z), `back` metres behind the player. */
  addSpecial(kind: Kind, x: number, z: number, minD: number, maxD: number): number | null {
    const lanes = this.active.filter((l) => !l.bridge && l.len > 30);
    let best: Seg | null = null;
    for (const l of lanes) {
      const d = Math.hypot(l.cx - x, l.cz - z);
      if (d > minD && d < maxD && (!best || hash(l.id + this.nextId) > 0.5)) best = l;
    }
    if (!best || !this.roomAt(best, 4, LEN[kind])) return null;
    const car = this.newCar(best, 4, kind);
    car.special = 'ambulance';
    car.type = 'ambulance';
    car.colour = '#f6f6f2';
    this.insert(car, best);
    this.cars.push(car);
    return car.id;
  }
  /**
   * Clear a path for the story's own vehicles (the trotro you arrive in, the chase taxi, Uncle's car):
   * vehicles within `width` metres of the line are let go. Called when the scene starts, at a camera
   * cut, so nobody sees them go.
   */
  clearAlong(pts: [number, number][], width: number) {
    for (const car of [...this.cars]) {
      const p = this.pointAt(car.seg, car.s);
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(ax + dx * t - p.x, az + dz * t - p.z) < width + car.len / 2) {
          this.drop(car);
          break;
        }
      }
    }
  }

  /** How far along its way a car's middle is from a point on a lane ahead (null: not on its way). */
  private distAlong(car: Car, t: { seg: Seg; s: number }): number | null {
    if (car.seg === t.seg) return t.s - car.s;
    let d = car.seg.len - car.s;
    let next: Seg | null = car.seg.link ? car.seg.next[0] : car.plan;
    for (let k = 0; k < 4 && next; k++) {
      if (next === t.seg) return d + t.s;
      d += next.len;
      if (next.link) next = next.next[0];
      else break; // (the turn after that is not chosen yet)
    }
    return null;
  }
  /** The ground lane nearest (x, z) going the way `heading` (clockwise from north), and where on it. */
  private laneAt(x: number, z: number, heading: number, within = 25): { seg: Seg; s: number; d: number } | null {
    const fx = Math.sin(heading), fz = -Math.cos(heading);
    let best: { seg: Seg; s: number; d: number } | null = null;
    for (const seg of this.lanes) {
      if (seg.bridge || seg.dead || Math.abs(seg.cx - x) > seg.len + within || Math.abs(seg.cz - z) > seg.len + within || this.isWalled(seg)) continue;
      const pr = project(seg, x, z);
      if (pr.d > within) continue;
      const p = this.pointAt(seg, pr.s);
      if (p.fx * fx + p.fz * fz < 0.75) continue;
      if (!best || pr.d < best.d) best = { seg, s: pr.s, d: pr.d };
    }
    return best;
  }
  /**
   * A story vehicle that drives in the traffic like everyone (lights, queues, right of way): on the
   * lane nearest (x, z) going the way `heading`, `back` metres before that point (at most to the
   * lane's start). Vehicles in its place are let go (call it at a camera cut). `guide`: the way it
   * should go at junctions. Returns its number, or null when there is no lane there.
   */
  addStory(o: { kind: Kind; type: string; colour: string; x: number; z: number; heading: number; back: number; guide?: [number, number][] }): number | null {
    const at = this.laneAt(o.x, o.z, o.heading);
    if (!at) return null;
    const car = this.newCar(at.seg, 0, o.kind);
    car.type = o.type;
    car.colour = o.colour;
    car.len = TYPE_BY_KEY.get(o.type)?.len ?? car.len;
    car.halfW = (TYPE_BY_KEY.get(o.type)?.width ?? car.halfW * 2) / 2;
    car.s = Math.max(car.len / 2 + 0.5, Math.min(at.seg.len - car.len / 2, at.s - o.back));
    car.story = { stop: null, guide: o.guide ? Float32Array.from(o.guide.flat()) : null, released: false };
    // Room for it: anyone where it appears is let go, and (called at a camera cut) anyone on its lane
    // between there and the point it is sent to, so it never queues behind them on its way in.
    for (const c of [...at.seg.cars]) if (Math.abs(c.s - car.s) < (c.len + car.len) / 2 + 2 || (c.s > car.s && c.s < at.s + 30)) this.drop(c);
    const p = this.pointAt(at.seg, car.s);
    for (const c of [...this.cars]) {
      const q = this.pointAt(c.seg, c.s);
      if (!c.seg.bridge && Math.hypot(q.x - p.x, q.z - p.z) < (c.len + car.len) / 2 + 0.5) this.drop(c);
    }
    this.insert(car, at.seg);
    this.cars.push(car);
    return car.id;
  }
  /** A point on the traffic lane nearest (x, z) going the way `heading`, `ahead` metres on along it. */
  lanePose(x: number, z: number, heading: number, ahead = 0): { x: number; z: number; heading: number } | null {
    const at = this.laneAt(x, z, heading);
    if (!at) return null;
    const p = this.pointAt(at.seg, Math.max(0, Math.min(at.seg.len, at.s + ahead)));
    return { x: p.x, z: p.z, heading: Math.atan2(p.fx, -p.fz) };
  }
  /** How far (x, z) is from the middle of the nearest ground lane in use (Infinity: none within 30 m). */
  laneClearance(x: number, z: number) {
    let best = Infinity;
    const cx = Math.floor(x / 60), cz = Math.floor(z / 60);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (const seg of this.laneGrid.get(`${cx + i},${cz + j}`) ?? []) {
          if (seg.bridge || seg.walled || seg.dead) continue;
          best = Math.min(best, project(seg, x, z).d);
        }
    return best;
  }
  /** For tests: vehicles whose bodies overlap a box (a story vehicle's body) at (x, z) facing `heading`. */
  overlapsBox(x: number, z: number, heading: number, half: number, halfW: number, not = -1) {
    const fx = Math.sin(heading), fz = -Math.cos(heading);
    let n = 0;
    for (const c of this.cars) {
      if (c.id === not || c.seg.bridge) continue;
      const p = this.pointAt(c.seg, c.s);
      const dx = p.x - x, dz = p.z - z;
      if (Math.abs(dx) > 12 || Math.abs(dz) > 12) continue;
      const dot = Math.abs(p.fx * fx + p.fz * fz), cross = Math.sqrt(Math.max(0, 1 - dot * dot));
      const along = Math.abs(dx * fx + dz * fz), side = Math.abs(dx * -fz + dz * fx);
      if (along < half + (c.len / 2) * dot + c.halfW * cross - 0.4 && side < halfW + c.halfW * dot + (c.len / 2) * cross - 0.4) n++;
    }
    return n;
  }
  /** Is there a vehicle (any) within r metres of (x, z)? (For a story vehicle easing in or out.) */
  vehicleNear(x: number, z: number, r: number, not = -1) {
    for (const c of this.cars) {
      if (c.id === not || c.seg.bridge) continue;
      const p = this.pointAt(c.seg, c.s);
      if (Math.hypot(p.x - x, p.z - z) < r + c.len / 2) return true;
    }
    return false;
  }
  /** A story vehicle stops with its middle level with (x, z), on its lane or the next ones. */
  stopAt(id: number, x: number, z: number) {
    const car = this.cars.find((c) => c.id === id);
    if (!car?.story) return false;
    const cands: Seg[] = [car.seg];
    if (car.seg.link) cands.push(car.seg.next[0]);
    else if (car.plan) cands.push(car.plan.next[0]);
    for (const seg of cands) {
      const pr = project(seg, x, z);
      if (pr.d < 12 && (seg !== car.seg || pr.s > car.s)) {
        car.story.stop = { seg, s: pr.s };
        return true;
      }
    }
    return false;
  }
  /** The story vehicle pulls over to the kerb as it comes to its stop: `metres` to the right of its lane. */
  pullOver(id: number, metres: number) {
    const car = this.cars.find((c) => c.id === id);
    if (car?.story) car.story.side = metres;
  }
  /** Where a vehicle is drawn: a story vehicle pulling over is that far to the right of its lane. */
  private drawnAt(car: Car) {
    const p = this.pointAt(car.seg, car.s);
    const side = car.story?.sideNow ?? 0;
    if (!side && !car.story?.yaw) return p;
    // Turned by its steering (yaw: to the right is positive, as headings turn clockwise).
    const y = car.story?.yaw ?? 0, c = Math.cos(y), sn = Math.sin(y);
    return { x: p.x - p.fz * side, z: p.z + p.fx * side, fx: p.fx * c - p.fz * sn, fz: p.fz * c + p.fx * sn };
  }
  /** Has the story vehicle come to rest at its stop (or is it waiting in a queue)? */
  storyState(id: number): { stopped: boolean; atStop: boolean; v: number } | null {
    const car = this.cars.find((c) => c.id === id);
    if (!car) return null;
    const d = car.story?.stop ? this.distAlong(car, car.story.stop) : null;
    return { stopped: car.v < 0.15, atStop: d !== null && Math.abs(d) < 0.8, v: car.v };
  }
  /** The story is done with it: it drives on as one of the traffic (and leaves when far away). */
  release(id: number) {
    const car = this.cars.find((c) => c.id === id);
    if (car?.story) {
      car.story.stop = null;
      car.story.released = true;
      car.story.guide = null;
    }
  }

  /** Where a vehicle is (x, z, heading), or null if it has gone. */
  where(id: number): { x: number; z: number; heading: number; bridge: boolean } | null {
    const car = this.cars.find((c) => c.id === id);
    if (!car) return null;
    const p = this.drawnAt(car);
    return { x: p.x, z: p.z, heading: Math.atan2(p.fx, -p.fz), bridge: car.seg.bridge };
  }
  remove_(id: number) {
    const car = this.cars.find((c) => c.id === id);
    if (car) this.drop(car);
  }

  /** The vehicles nearest the player, nearest first, in the shape the drawing code takes. */
  near(x: number, z: number, radius: number, limit: number): Placed[] {
    const out: Placed[] = [];
    for (const car of this.cars) {
      const p = this.drawnAt(car);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d > radius) continue;
      const [lon, lat] = this.toLngLat(p.x, p.z);
      const v: Vehicle = { id: car.id, route: car.seg.id, lane: 0, kind: car.kind, colour: car.colour, offset: 0, speed: car.v, type: car.type };
      out.push({ v, d, lon, lat, heading: Math.atan2(p.fx, -p.fz), s: car.s, bridge: car.seg.bridge });
    }
    out.sort((a, b) => a.d - b.d);
    return out.slice(0, limit);
  }

  /** For tests: vehicles whose bodies overlap (pairs), and vehicles stuck still for over 20 seconds. */
  check() {
    const pos = this.cars.map((c) => ({ c, p: this.pointAt(c.seg, c.s) }));
    const pairs: string[] = [];
    for (let i = 0; i < pos.length; i++)
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i], b = pos[j];
        if (a.c.seg.bridge !== b.c.seg.bridge) continue;
        const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z;
        if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
        // In a's own frame: overlapping along and across?
        const along = Math.abs(dx * a.p.fx + dz * a.p.fz), side = Math.abs(dx * -a.p.fz + dz * a.p.fx);
        if (along < (a.c.len + b.c.len) / 2 - 0.6 && side < a.c.halfW + b.c.halfW - 0.5) {
          const dot = (a.p.fx * b.p.fx + a.p.fz * b.p.fz).toFixed(2);
          const info = (c: Car) => `${c.seg.link ? 'L' : 'l'}${c.seg.id}e${c.seg.edge}d${c.seg.dir}i${c.seg.index}/${c.seg.lanes} s${c.s.toFixed(1)}/${c.seg.len.toFixed(0)} v${c.v.toFixed(1)}`;
          pairs.push(`${info(a.c)} | ${info(b.c)} dot${dot} at ${a.p.x.toFixed(0)},${a.p.z.toFixed(0)}`);
        }
      }
    return { overlaps: pairs.slice(0, 6), n: pairs.length, stuck: this.cars.filter((c) => c.stuck > 20).length };
  }

  /** For tests: the longest any driver (not the story's, not one held) has been standing still, and how many over 10 s. */
  waits() {
    const list = this.cars.filter((c) => !c.story && !this.hold.has(c.id)).map((c) => c.stuck);
    return { longest: Math.max(0, ...list), over10: list.filter((w) => w > 10).length, nearDrops: this.nearDrops };
  }

  /** For tests: how many vehicles, lanes and junctions. */
  get stats() {
    return { cars: this.cars.length, lanes: this.lanes.length, nodes: this.nodes.length, active: this.active.length, oneways: this.oneways };
  }
}

const smooth01 = (t: number) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};
/** The nearest point of a piece to (x, z): how far along it, and how far away. */
function project(seg: { pts: Float32Array; cum: Float32Array | number[] }, x: number, z: number) {
  let best = { s: 0, d: Infinity };
  for (let i = 1; i < seg.pts.length / 2; i++) {
    const ax = seg.pts[i * 2 - 2], az = seg.pts[i * 2 - 1], bx = seg.pts[i * 2], bz = seg.pts[i * 2 + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
    if (d < best.d) best = { s: seg.cum[i - 1] + t * Math.sqrt(l2), d };
  }
  return best;
}
/** How far (x, z) is from a line of points (x0, z0, x1, z1, ...). */
function distToLine(pts: Float32Array, x: number, z: number) {
  let best = Infinity;
  for (let i = 1; i < pts.length / 2; i++) {
    const ax = pts[i * 2 - 2], az = pts[i * 2 - 1], bx = pts[i * 2], bz = pts[i * 2 + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}
