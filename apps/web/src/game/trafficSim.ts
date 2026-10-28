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
import { typeFor } from './vehicleTypes';

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
  obstacles: { x: number; z: number; r: number }[] = [];
  /** Called every frame a vehicle is waiting for the player in front of it (the game hoots and shouts). */
  onWaitForPlayer: ((v: { id: number; x: number; z: number; heading: number; kind: string; halfW: number; half: number; waited: number }) => void) | null = null;
  /** Is obstacles[0] the player? */
  playerFirst = false;
  /** Vehicles that must not move (a driver who got out). */
  hold = new Set<number>();

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
    this.active = out;
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
    const options = lane.next.filter((l) => !l.dead);
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
      return { gap: along - a.len / 2 - ((b.len / 2) * Math.abs(dot) + b.halfW * cross), dot };
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
      // 2. The end of the lane: stop at the line for red, or to give way, or with nowhere to go.
      if (!seg.link) {
        if (!car.plan || car.plan.dead) this.choose(car);
        const toEnd = seg.len - car.s - car.len / 2;
        if (toEnd < LOOK && !car.committed) {
          let stop = !car.plan;
          let extra = 0;
          if (!stop && this.redLight) {
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
              if (this.mayGo(car, t)) {
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
            if (!f || f.dot < -0.6) continue;
            if (f.dot < 0.6) {
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
      const p = this.pointAt(car.seg, car.s);
      const d2 = (p.x - x) ** 2 + (p.z - z) ** 2;
      if (d2 > r2 || (car.stuck > 25 && !car.seg.link && !car.plan && d2 > this.opts.seen ** 2)) this.drop(car);
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
  /** Where a vehicle is (x, z, heading), or null if it has gone. */
  where(id: number): { x: number; z: number; heading: number } | null {
    const car = this.cars.find((c) => c.id === id);
    if (!car) return null;
    const p = this.pointAt(car.seg, car.s);
    return { x: p.x, z: p.z, heading: Math.atan2(p.fx, -p.fz) };
  }
  remove_(id: number) {
    const car = this.cars.find((c) => c.id === id);
    if (car) this.drop(car);
  }

  /** The vehicles nearest the player, nearest first, in the shape the drawing code takes. */
  near(x: number, z: number, radius: number, limit: number): Placed[] {
    const out: Placed[] = [];
    for (const car of this.cars) {
      const p = this.pointAt(car.seg, car.s);
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

  /** For tests: how many vehicles, lanes and junctions. */
  get stats() {
    return { cars: this.cars.length, lanes: this.lanes.length, nodes: this.nodes.length, active: this.active.length, oneways: this.oneways };
  }
}
