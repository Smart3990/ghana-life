// T7: simulated traffic on real roads. Every vehicle's position comes from the shared clock
// (server time) and a fixed starting offset, so every phone shows the same traffic
// without sending a single message.
import type { GeoJSONSource, Map } from 'maplibre-gl';
import type { Tier } from '../map/style';

const ROUTES_URL = '/data/traffic-central.json';
// Choked Accra: two lanes each way, nose to tail. Slots alternate between the two lanes, so each lane
// has a vehicle every 9 to 14 metres (about 100,000 vehicles in all). Only the ones near the player
// are ever worked out.
const SPACING_M: [number, number] = [4.5, 7];
// The outer (kerb-side) lane is this many lane-widths further out than the inner one.
const OUTER_LANE = 1.9;
// Vehicles are drawn about twice real size, like most map games, so they read clearly
// next to the (screen-sized) characters.
const SIZE = 2.1;
// Vehicles drawn at once, per tier (master plan performance budget: 15 / 40 / 100).
const DRAW_LIMIT: Record<Tier, number> = { light: 15, standard: 40, ultra: 100 };
const DRAW_RADIUS_M: Record<Tier, number> = { light: 600, standard: 900, ultra: 1300 };
const FRAME_MS = 50; // update about 20 times a second
const LANE_OFFSET_M = 3.2; // Ghana drives on the right (wider than real, to match the bigger vehicles)

const M_LAT = 110574;
const M_LON = 111320 * Math.cos((5.56 * Math.PI) / 180);

export type Kind = 'car' | 'taxi' | 'trotro' | 'tricycle' | 'okada' | 'bus' | 'truck' | 'pickup' | 'suv';

// Sizes in metres, speeds in metres per second, and Accra-looking colours.
export const KINDS: Record<Kind, { length: number; width: number; height: number; speed: number; colours: string[]; cabin?: string }> = {
  car: { length: 4.4, width: 1.8, height: 1.45, speed: 10, colours: ['#f4f4f2', '#c0c4c8', '#2b2f36', '#8e1b1b', '#1f4f8a'], cabin: '#33404d' },
  taxi: { length: 4.4, width: 1.8, height: 1.45, speed: 9, colours: ['#6e1a24', '#1d2f5c', '#2a2c33', '#5a1a3a', '#1f4f8a', '#2f4a3a'], cabin: '#33404d' }, // Accra taxis (dark body colours, as at Circle): any body colour, yellow corners
  trotro: { length: 6.2, width: 2.1, height: 2.4, speed: 7.5, colours: ['#f1ece0', '#e9e4d6', '#3d7cc0', '#3d7cc0', '#d9dde0'] }, // lower body: white or blue
  tricycle: { length: 2.6, width: 1.3, height: 1.7, speed: 6, colours: ['#1f8a5b', '#e8701c', '#2f6fd0', '#e8701c', '#c8102e'] }, // motor kings: mostly orange
  okada: { length: 2.0, width: 0.8, height: 1.6, speed: 9, colours: ['#c8442e', '#1f5fa8', '#e3a92b', '#2f7d55', '#151515', '#f2efe6'] },
  bus: { length: 11, width: 2.5, height: 3.1, speed: 7, colours: ['#e8b820', '#e8b820', '#e8b820', '#f2efe6'] }, // mostly Metro yellow
  truck: { length: 8, width: 2.4, height: 3.0, speed: 6.5, colours: ['#c8442e', '#1f5fa8', '#2f7d55', '#e3a92b'] },
  pickup: { length: 5.2, width: 1.85, height: 1.8, speed: 9, colours: ['#f4f4f2', '#c0c4c8', '#2b2f36', '#7a1f2b'], cabin: '#33404d' },
  suv: { length: 4.8, width: 1.9, height: 1.8, speed: 10, colours: ['#151515', '#f4f4f2', '#2b2f36', '#c0c4c8', '#5a1f1f'], cabin: '#33404d' },
};
// Roughly how Accra's streets mix (out of 100).
const MIX_WEIGHTS: [Kind, number][] = [['car', 28], ['taxi', 17], ['trotro', 14], ['okada', 15], ['tricycle', 6], ['bus', 3], ['truck', 5], ['pickup', 6], ['suv', 6]];
const MIX_TOTAL = MIX_WEIGHTS.reduce((n, [, w]) => n + w, 0);
export const kindFor = (r: number): Kind => {
  let left = r * MIX_TOTAL;
  for (const [k, w] of MIX_WEIGHTS) if ((left -= w) < 0) return k;
  return 'car';
};

type VehicleShape = {
  type: 'Feature';
  properties: { colour: string; base: number; top: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};
type Route = { lon: Float64Array; lat: Float64Array; at: Float64Array; total: number; lanes: 1 | 2 }; // at = metres along the route
export type Vehicle = { id: number; route: number; lane: 0 | 1; kind: Kind; colour: string; offset: number; speed: number };

function prepare(raw: number[][][], scale: number, lanes: 1 | 2 = 2): Route[] {
  return raw.map((points) => {
    const lon = Float64Array.from(points, (p) => p[0] / scale);
    const lat = Float64Array.from(points, (p) => p[1] / scale);
    const at = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      at[i] = at[i - 1] + Math.hypot((lon[i] - lon[i - 1]) * M_LON, (lat[i] - lat[i - 1]) * M_LAT);
    }
    return { lon, lat, at, total: at[points.length - 1], lanes };
  });
}

// Fixed pseudo-random numbers from a vehicle number, the same on every phone.
const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// Where a vehicle is, and which way it faces, at a distance along its route.
function placeOn(r: Route, s: number, lane = LANE_OFFSET_M): { lon: number; lat: number; heading: number } {
  let lo = 0;
  let hi = r.at.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (r.at[mid] <= s) lo = mid;
    else hi = mid;
  }
  const seg = r.at[hi] - r.at[lo] || 1;
  const t = (s - r.at[lo]) / seg;
  const dx = (r.lon[hi] - r.lon[lo]) * M_LON;
  const dy = (r.lat[hi] - r.lat[lo]) * M_LAT;
  const heading = Math.atan2(dx, dy); // radians clockwise from north
  // Shift to the right-hand side of the road.
  const rx = Math.cos(heading) * lane;
  const ry = -Math.sin(heading) * lane;
  return {
    lon: r.lon[lo] + (r.lon[hi] - r.lon[lo]) * t + rx / M_LON,
    lat: r.lat[lo] + (r.lat[hi] - r.lat[lo]) * t + ry / M_LAT,
    heading,
  };
}

// A rectangle in the map, length along the heading, centred `forward` metres ahead of the point.
function box(lon: number, lat: number, heading: number, length: number, width: number, forward = 0) {
  const f = [Math.sin(heading), Math.cos(heading)]; // forward (east, north)
  const r = [Math.cos(heading), -Math.sin(heading)]; // right
  const corner = (along: number, across: number) => [
    lon + (f[0] * (along + forward) + r[0] * across) / M_LON,
    lat + (f[1] * (along + forward) + r[1] * across) / M_LAT,
  ];
  const l = length / 2;
  const w = width / 2;
  return [[corner(l, -w), corner(l, w), corner(-l, w), corner(-l, -w), corner(l, -w)]];
}

export type Placed = { v: Vehicle; d: number; lon: number; lat: number; heading: number; s: number; bridge?: boolean };
export type Traffic = {
  /** The nearest vehicles to a point at a moment (seconds of shared time), nearest first. */
  near: (lon: number, lat: number, t: number, radiusM: number, limit: number, lane?: number) => Placed[];
  /** Where a vehicle is at a distance s along its route (for vehicles held back near the player). */
  at: (v: Vehicle, s: number, lane?: number) => { lon: number; lat: number; heading: number; bridge?: boolean };
  /** More roads to fill with traffic (each driven both ways): [longitude, latitude] points, and how many lanes each way. */
  addRoads: (roads: { pts: [number, number][]; lanes: 1 | 2; half?: number; bridge?: boolean }[]) => void;
};

// Loads the routes and sets up every vehicle. The same on every phone: positions come from the shared clock.
export async function loadTraffic(): Promise<Traffic | null> {
  let routes: Route[];
  try {
    const file = await (await fetch(ROUTES_URL)).json();
    routes = prepare(file.routes, file.scale);
  } catch {
    return null; // no traffic is better than a broken game
  }
  if (!routes.length) return null;

  // Each route: its own pace and its own spacing. Vehicles on a route share its speed and are
  // spaced evenly (with a little jitter), so they never drive through each other. A vehicle is
  // known by its route and its slot, so nothing needs storing for the 20,000 of them.
  const paceFor = (r: Route, i: number) => {
    // One-lane roads have one queue, so their slots are twice as far apart.
    const spacing = (SPACING_M[0] + hash(i * 17 + 3) * (SPACING_M[1] - SPACING_M[0])) * (r.lanes === 1 ? 2 : 1);
    const slots = Math.max(1, Math.floor(r.total / spacing));
    // Rush-hour pace: from a crawl to a slow roll (metres per second).
    return { speed: 2.2 + hash(i * 13 + 5) * 4.3, slots, gap: r.total / slots };
  };
  const pace = routes.map(paceFor);
  const vehicle = (route: number, slot: number): Vehicle => {
    const id = route * 100000 + slot;
    const kind = kindFor(hash(id * 3 + 1));
    const k = KINDS[kind];
    const p = pace[route];
    return { id, route, lane: (routes[route].lanes === 2 ? slot % 2 : 0) as 0 | 1, kind, colour: k.colours[Math.floor(hash(id * 3 + 2) * k.colours.length)], offset: (slot + 0.3 * hash(id * 3 + 3)) * p.gap, speed: p.speed };
  };

  // Which stretches of each route are near a point (worked out again after moving 40 m).
  let cache: { lon: number; lat: number; radius: number; spans: [number, number, number][] } | null = null;
  const spansNear = (lon: number, lat: number, radiusM: number) => {
    if (cache && cache.radius === radiusM && Math.hypot((cache.lon - lon) * M_LON, (cache.lat - lat) * M_LAT) < 40) return cache.spans;
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
    cache = { lon, lat, radius: radiusM, spans };
    return spans;
  };

  const near: Traffic['near'] = (lon, lat, t, radiusM, limit, lane = LANE_OFFSET_M) => {
    const found: Placed[] = [];
    for (const [ri, a, b] of spansNear(lon, lat, radiusM)) {
      const r = routes[ri];
      const p = pace[ri];
      const base = (p.speed * t) % r.total;
      // Slots whose vehicle is between a and b right now (allowing for the jitter).
      {
        const first = Math.floor((a - base) / p.gap) - 1;
        const last = Math.ceil((b - base) / p.gap) + 1;
        for (let m = first; m <= last; m++) {
          const slot = ((m % p.slots) + p.slots) % p.slots;
          const v = vehicle(ri, slot);
          const s = (((v.offset + base) % r.total) + r.total) % r.total;
          if (s < a || s > b) continue;
          const off = lane * (1 + v.lane * OUTER_LANE);
          const pos = placeOn(r, s, off);
          const d = Math.hypot((pos.lon - lon) * M_LON, (pos.lat - lat) * M_LAT);
          if (d > radiusM) continue;
          // Facing: along the road a few metres either side, so turns are smooth instead of snapping.
          const ahead = placeOn(r, Math.min(r.total, s + 3), off);
          const behind = placeOn(r, Math.max(0, s - 3), off);
          const heading = Math.atan2((ahead.lon - behind.lon) * M_LON, (ahead.lat - behind.lat) * M_LAT);
          found.push({ v, d, lon: pos.lon, lat: pos.lat, heading, s });
        }
      }
    }
    found.sort((x, y) => x.d - y.d);
    return found.slice(0, limit);
  };
  const at: Traffic['at'] = (v, s, lane = LANE_OFFSET_M) => {
    const r = routes[v.route];
    const t = ((s % r.total) + r.total) % r.total;
    const off = lane * (1 + v.lane * OUTER_LANE);
    const p = placeOn(r, t, off);
    const ahead = placeOn(r, Math.min(r.total, t + 3), off);
    const behind = placeOn(r, Math.max(0, t - 3), off);
    return { lon: p.lon, lat: p.lat, heading: Math.atan2((ahead.lon - behind.lon) * M_LON, (ahead.lat - behind.lat) * M_LAT) };
  };
  const addRoads: Traffic['addRoads'] = (roads) => {
    for (const road of roads) {
      if (road.pts.length < 2) continue;
      // There and back again, so the road gets traffic both ways.
      const loop = [...road.pts, ...road.pts.slice(0, -1).reverse()];
      const [r] = prepare([loop], 1, road.lanes);
      if (r.total < 30) continue;
      routes.push(r);
      pace.push(paceFor(r, routes.length - 1));
    }
    cache = null;
  };
  return { near, at, addRoads };
}

// The overview map's traffic: simple blocks in the map's own "traffic" layer.
// size: how much bigger than real the vehicles are drawn.
export async function startTraffic(map: Map, getTier: () => Tier, serverNow: () => number, size = SIZE) {
  const lane = (LANE_OFFSET_M * size) / SIZE;
  const traffic = await loadTraffic();
  if (!traffic) return;

  let last = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    const source = map.getSource<GeoJSONSource>('traffic');
    if (!source) return; // the style is being swapped

    const tier = getTier();
    const centre = map.getCenter();
    const near = traffic.near(centre.lng, centre.lat, serverNow() / 1000, DRAW_RADIUS_M[tier], DRAW_LIMIT[tier], lane);

    const features: VehicleShape[] = [];
    for (const p of near) {
      const v = p.v;
      const real = KINDS[v.kind];
      const k = { ...real, length: real.length * size, width: real.width * size, height: real.height * size };
      features.push({
        type: 'Feature',
        properties: { colour: v.colour, base: 0.3, top: k.cabin ? k.height * 0.55 : k.height },
        geometry: { type: 'Polygon', coordinates: box(p.lon, p.lat, p.heading, k.length, k.width) },
      });
      if (k.cabin) {
        // A smaller, darker block on top: the windows and roof of a car or taxi.
        features.push({
          type: 'Feature',
          properties: { colour: k.cabin, base: k.height * 0.55, top: k.height },
          geometry: { type: 'Polygon', coordinates: box(p.lon, p.lat, p.heading, k.length * 0.55, k.width * 0.9, -0.2 * size) },
        });
      }
      if (v.kind === 'taxi') {
        // Accra taxis: a darker band along the sides.
        features.push({
          type: 'Feature',
          properties: { colour: '#c8102e', base: 0.55 * size, top: 0.75 * size },
          geometry: { type: 'Polygon', coordinates: box(p.lon, p.lat, p.heading, k.length * 0.98, k.width + 0.04) },
        });
      }
    }
    source.setData({ type: 'FeatureCollection', features });
  };
  requestAnimationFrame(frame);
}
