// Street-level traffic routes, built from the very streets the map draws (so a vehicle can never be
// off the road), with every junction joined up so traffic flows through it instead of turning round.
//
// How it works, for each tile of streets:
//  1. Streets are cut into pieces between junctions (points shared by two or more streets).
//  2. Every piece can be driven both ways. At each junction, every way in is matched with a different
//     way out, as straight as possible and never back the way it came (a T-junction or crossroads
//     sends some traffic round the corner, the rest straight on).
//  3. Following those matches gives routes: closed loops round the blocks (vehicles circle for ever,
//     never appearing or vanishing) and a few open routes from dead ends or the tile's edge.
// Each piece of street, in each direction, belongs to exactly one route, so routes never overlap.
// Positions come from the shared clock, the same on every phone. Flyovers are included: vehicles on
// them are marked "bridge" and drawn at the deck's height.
import { KINDS, kindFor, type Kind, type Placed, type Traffic, type Vehicle } from './traffic';

const M_LAT = 110574;
const M_LON = 111320 * Math.cos((5.56 * Math.PI) / 180);
const SPACING_M: [number, number] = [6, 10]; // busy but moving: a vehicle every 6 to 10 m in each lane
const END_HIDE_M = 7; // vehicles are not shown this close to the start or end of an open route

type Route = {
  key: number;
  lon: Float64Array;
  lat: Float64Array;
  at: Float64Array; // metres along the route
  half: Float32Array; // road half-width at each point (for the lane position)
  bridge: Uint8Array; // 1 if the piece from this point to the next is on a flyover
  total: number;
  closed: boolean;
  lanes: 1 | 2;
  speed: number;
  slots: number;
  gap: number;
};

const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
const hashPoint = (lon: number, lat: number) => Math.imul(Math.round(lon * 1e5), 73856093) ^ Math.imul(Math.round(lat * 1e5), 19349663);

type In = { pts: [number, number][]; lanes: 1 | 2; half?: number; bridge?: boolean };
type Edge = { pts: [number, number][]; half: number; lanes: 1 | 2; bridge: boolean; a: string; b: string };
type Dir = { e: number; fwd: boolean };

const keyOf = (p: [number, number]) => `${Math.round(p[0] * 1e5)},${Math.round(p[1] * 1e5)}`;
const angleOf = (from: [number, number], to: [number, number]) => Math.atan2((to[0] - from[0]) * M_LON, (to[1] - from[1]) * M_LAT);
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));

function permutations(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}
const PERMS = [[], [[0]], permutations(2), permutations(3), permutations(4)];

/** Routes for one batch of streets (one tile). */
function buildRoutes(roads: In[]): Omit<Route, 'speed' | 'slots' | 'gap'>[] {
  // 1. Junctions: points used by more than one street, plus every street's two ends.
  const use = new Map<string, number>();
  for (const r of roads) for (const p of r.pts) use.set(keyOf(p), (use.get(keyOf(p)) ?? 0) + 1);
  const edges: Edge[] = [];
  for (const r of roads) {
    let cur: [number, number][] = [r.pts[0]];
    for (let i = 1; i < r.pts.length; i++) {
      cur.push(r.pts[i]);
      const k = keyOf(r.pts[i]);
      if (i === r.pts.length - 1 || (use.get(k) ?? 0) > 1) {
        if (cur.length >= 2) edges.push({ pts: cur, half: r.half ?? (r.lanes === 2 ? 5 : 3.25), lanes: r.lanes, bridge: !!r.bridge, a: keyOf(cur[0]), b: k });
        cur = [r.pts[i]];
      }
    }
  }
  // 2. At each junction, match ways in to ways out.
  const at = new Map<string, { ins: Dir[]; outs: Dir[] }>();
  const node = (k: string) => {
    let n = at.get(k);
    if (!n) at.set(k, (n = { ins: [], outs: [] }));
    return n;
  };
  edges.forEach((e, i) => {
    node(e.b).ins.push({ e: i, fwd: true });
    node(e.a).outs.push({ e: i, fwd: true });
    node(e.a).ins.push({ e: i, fwd: false });
    node(e.b).outs.push({ e: i, fwd: false });
  });
  const pts = (d: Dir) => (d.fwd ? edges[d.e].pts : [...edges[d.e].pts].reverse());
  const id = (d: Dir) => d.e * 2 + (d.fwd ? 0 : 1);
  const next = new Map<number, Dir>();
  for (const { ins, outs } of at.values()) {
    if (ins.length < 2) continue; // a dead end: the route ends here
    const inAngle = ins.map((d) => {
      const p = pts(d);
      return angleOf(p[p.length - 2], p[p.length - 1]);
    });
    const outAngle = outs.map((d) => {
      const p = pts(d);
      return angleOf(p[0], p[1]);
    });
    const cost = (i: number, o: number) => (ins[i].e === outs[o].e ? Infinity : turn(inAngle[i], outAngle[o]) ** 2);
    const n = ins.length;
    let best: number[] | null = null;
    let bestCost = Infinity;
    if (n <= 4) {
      for (const p of PERMS[n]) {
        let c = 0;
        for (let i = 0; i < n && c < bestCost; i++) c += cost(i, p[i]);
        if (c < bestCost) [best, bestCost] = [p, c];
      }
    } else {
      // Big junctions: each way in takes the straightest way out still free.
      const free = new Set(outs.map((_, o) => o));
      best = ins.map((_, i) => {
        let pick = -1;
        for (const o of free) if (cost(i, o) < Infinity && (pick < 0 || cost(i, o) < cost(i, pick))) pick = o;
        if (pick >= 0) free.delete(pick);
        return pick;
      });
    }
    if (!best) continue;
    best.forEach((o, i) => o >= 0 && cost(i, o) < Infinity && next.set(id(ins[i]), outs[o]));
  }
  // 3. Follow the matches into routes.
  const hasPrev = new Set<number>();
  for (const d of next.values()) hasPrev.add(id(d));
  const done = new Set<number>();
  const routes: Omit<Route, 'speed' | 'slots' | 'gap'>[] = [];
  const all: Dir[] = edges.flatMap((_, e) => [{ e, fwd: true }, { e, fwd: false }]);
  // Open routes first (from a way with nothing before it), then the closed loops that are left.
  const starts = [...all.filter((d) => !hasPrev.has(id(d))), ...all];
  for (const start of starts) {
    if (done.has(id(start))) continue;
    const chain: Dir[] = [];
    let d: Dir | undefined = start;
    let closed = false;
    while (d && !done.has(id(d))) {
      done.add(id(d));
      chain.push(d);
      d = next.get(id(d));
      if (d && id(d) === id(start)) closed = true;
    }
    const lon: number[] = [];
    const lat: number[] = [];
    const half: number[] = [];
    const bridge: number[] = [];
    let twoLane = 0;
    let length = 0;
    for (const c of chain) {
      const p = pts(c);
      const e = edges[c.e];
      for (let i = lon.length ? 1 : 0; i < p.length; i++) {
        lon.push(p[i][0]);
        lat.push(p[i][1]);
        half.push(e.half);
        bridge.push(e.bridge ? 1 : 0);
      }
      const len = p.reduce((n, q, i) => (i ? n + Math.hypot((q[0] - p[i - 1][0]) * M_LON, (q[1] - p[i - 1][1]) * M_LAT) : 0), 0);
      length += len;
      if (e.lanes === 2) twoLane += len;
    }
    if (lon.length < 2) continue;
    const atArr = new Float64Array(lon.length);
    for (let i = 1; i < lon.length; i++) atArr[i] = atArr[i - 1] + Math.hypot((lon[i] - lon[i - 1]) * M_LON, (lat[i] - lat[i - 1]) * M_LAT);
    const total = atArr[lon.length - 1];
    if (total < (closed ? 20 : 2 * END_HIDE_M + 10)) continue;
    routes.push({
      key: hashPoint(lon[0], lat[0]) ^ Math.imul(Math.round(total), 2654435761),
      lon: Float64Array.from(lon),
      lat: Float64Array.from(lat),
      at: atArr,
      half: Float32Array.from(half),
      bridge: Uint8Array.from(bridge),
      total,
      closed,
      lanes: twoLane > length / 2 ? 2 : 1,
    });
  }
  return routes;
}

// The lane's distance from the middle of the road: the inner lane, and the outer lane on wide roads.
const laneOffset = (half: number, lane: 0 | 1, base: number) => (lane === 1 && half >= 4.5 ? half * 0.74 : Math.min(base, half * 0.45));

function placeOn(r: Route, s: number, lane: 0 | 1, base: number) {
  let lo = 0;
  let hi = r.at.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (r.at[mid] <= s) lo = mid;
    else hi = mid;
  }
  const seg = r.at[hi] - r.at[lo] || 1;
  const t = Math.max(0, Math.min(1, (s - r.at[lo]) / seg));
  const dx = (r.lon[hi] - r.lon[lo]) * M_LON;
  const dy = (r.lat[hi] - r.lat[lo]) * M_LAT;
  const heading = Math.atan2(dx, dy);
  const off = laneOffset(Math.min(r.half[lo], r.half[hi]), lane, base);
  return {
    lon: r.lon[lo] + (r.lon[hi] - r.lon[lo]) * t + (Math.cos(heading) * off) / M_LON,
    lat: r.lat[lo] + (r.lat[hi] - r.lat[lo]) * t - (Math.sin(heading) * off) / M_LAT,
    heading,
    bridge: !!r.bridge[lo],
  };
}

/** spacing: how far apart vehicles are in each lane, times the base 6 to 10 m (more on cheaper phones). */
export function createStreetNetwork(spacingScale = 1): Traffic {
  const routes: Route[] = [];
  const seen = new Set<number>();
  const wrap = (r: Route, s: number) => (r.closed ? ((s % r.total) + r.total) % r.total : Math.max(0, Math.min(r.total, s)));
  const vehicle = (ri: number, slot: number): Vehicle => {
    const r = routes[ri];
    const id = (r.key >>> 0) * 4096 + slot;
    const kind: Kind = kindFor(hash(id * 3 + 1));
    const k = KINDS[kind];
    return { id, route: ri, lane: (r.lanes === 2 ? slot % 2 : 0) as 0 | 1, kind, colour: k.colours[Math.floor(hash(id * 3 + 2) * k.colours.length)], offset: (slot + 0.3 * hash(id * 3 + 3)) * r.gap, speed: r.speed };
  };
  const smoothHeading = (r: Route, s: number, lane: 0 | 1, base: number) => {
    const a = placeOn(r, wrap(r, s + 3), lane, base);
    const b = placeOn(r, wrap(r, s - 3), lane, base);
    return Math.atan2((a.lon - b.lon) * M_LON, (a.lat - b.lat) * M_LAT);
  };

  let cache: { lon: number; lat: number; radius: number; n: number; spans: [number, number, number][] } | null = null;
  const spansNear = (lon: number, lat: number, radiusM: number) => {
    if (cache && cache.radius === radiusM && cache.n === routes.length && Math.hypot((cache.lon - lon) * M_LON, (cache.lat - lat) * M_LAT) < 40) return cache.spans;
    const reach = radiusM + 40;
    const spans: [number, number, number][] = [];
    routes.forEach((r, ri) => {
      let start = -1;
      for (let i = 0; i < r.at.length; i++) {
        const d = Math.hypot((r.lon[i] - lon) * M_LON, (r.lat[i] - lat) * M_LAT);
        const seg = i + 1 < r.at.length ? r.at[i + 1] - r.at[i] : 0;
        const inside = d < reach + seg;
        if (inside && start < 0) start = Math.max(0, r.at[i] - seg);
        if (!inside && start >= 0) {
          spans.push([ri, start, r.at[i]]);
          start = -1;
        }
      }
      if (start >= 0) spans.push([ri, start, r.total]);
    });
    cache = { lon, lat, radius: radiusM, n: routes.length, spans };
    return spans;
  };

  return {
    near(lon, lat, t, radiusM, limit, base = 1.35) {
      const found: Placed[] = [];
      const taken = new Set<number>(); // a short route has few slots: never list one vehicle twice
      for (const [ri, a, b] of spansNear(lon, lat, radiusM)) {
        const r = routes[ri];
        const travel = (r.speed * t) % r.total;
        const first = Math.floor((a - travel) / r.gap) - 1;
        const last = Math.ceil((b - travel) / r.gap) + 1;
        for (let m = first; m <= last; m++) {
          const slot = ((m % r.slots) + r.slots) % r.slots;
          const v = vehicle(ri, slot);
          if (taken.has(v.id)) continue;
          const s = (((v.offset + travel) % r.total) + r.total) % r.total;
          if (s < a || s > b) continue;
          taken.add(v.id);
          if (!r.closed && (s < END_HIDE_M || s > r.total - END_HIDE_M)) continue;
          const pos = placeOn(r, s, v.lane, base);
          const d = Math.hypot((pos.lon - lon) * M_LON, (pos.lat - lat) * M_LAT);
          if (d > radiusM) continue;
          found.push({ v, d, lon: pos.lon, lat: pos.lat, heading: smoothHeading(r, s, v.lane, base), s, bridge: pos.bridge });
        }
      }
      found.sort((x, y) => x.d - y.d);
      return found.slice(0, limit);
    },
    at(v, s, base = 1.35) {
      const r = routes[v.route];
      const w = wrap(r, s);
      const p = placeOn(r, w, v.lane, base);
      return { lon: p.lon, lat: p.lat, heading: smoothHeading(r, w, v.lane, base), bridge: p.bridge };
    },
    addRoads(roads) {
      // Each tile's streets arrive once (a tile seen again is skipped, so nothing is ever doubled).
      if (!roads.length) return;
      const sig = roads.reduce((n, r) => n ^ hashPoint(r.pts[0][0], r.pts[0][1]) ^ Math.imul(r.pts.length, 40503), 0);
      if (seen.has(sig)) return;
      seen.add(sig);
      for (const r of buildRoutes(roads)) {
        const i = routes.length;
        // Flyovers are fast and open: their vehicles are further apart.
        const onBridge = r.bridge.some((b) => b);
        const spacing = (SPACING_M[0] + hash(r.key + 3) * (SPACING_M[1] - SPACING_M[0])) * (r.lanes === 1 ? 1.6 : 1) * spacingScale * (onBridge ? 2.5 : 1);
        const slots = Math.max(1, Math.floor(r.total / spacing));
        // Accra pace: from a crawl to a steady roll (metres per second); faster on flyovers.
        const speed = (onBridge ? 7 : 2.5) + hash(r.key + 5) * 4;
        routes.push({ ...r, speed, slots, gap: r.total / slots });
        void i;
      }
      cache = null;
    },
  };
}
