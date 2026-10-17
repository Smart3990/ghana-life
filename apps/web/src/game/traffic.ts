// T7: simulated traffic on real roads. Every vehicle's position comes from the shared clock
// (server time) and a fixed starting offset, so every phone shows the same traffic
// without sending a single message.
import type { GeoJSONSource, Map } from 'maplibre-gl';
import type { Tier } from '../map/style';

const ROUTES_URL = '/data/traffic-central.json';
const VEHICLES = 420; // across the whole area; only the nearest few are drawn
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

type Kind = 'car' | 'taxi' | 'trotro' | 'tricycle';

// Sizes in metres, speeds in metres per second, and Accra-looking colours.
const KINDS: Record<Kind, { length: number; width: number; height: number; speed: number; colours: string[]; cabin?: string }> = {
  car: { length: 4.4, width: 1.8, height: 1.45, speed: 10, colours: ['#f4f4f2', '#c0c4c8', '#2b2f36', '#8e1b1b', '#1f4f8a'], cabin: '#33404d' },
  taxi: { length: 4.4, width: 1.8, height: 1.45, speed: 9, colours: ['#f2a922'], cabin: '#33404d' },
  trotro: { length: 6.2, width: 2.1, height: 2.4, speed: 7.5, colours: ['#f1ece0', '#e9e4d6', '#d9dde0'] },
  tricycle: { length: 2.6, width: 1.3, height: 1.7, speed: 6, colours: ['#1f8a5b', '#2f6fd0', '#c8102e'] },
};
// Roughly how Accra's streets mix: many cars and taxis, plenty of trotros, some tricycles.
const MIX: Kind[] = ['car', 'car', 'car', 'taxi', 'taxi', 'trotro', 'trotro', 'tricycle'];

type VehicleShape = {
  type: 'Feature';
  properties: { colour: string; base: number; top: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};
type Route = { lon: Float64Array; lat: Float64Array; at: Float64Array; total: number }; // at = metres along the route
type Vehicle = { route: number; kind: Kind; colour: string; offset: number; speed: number };

function prepare(raw: number[][][], scale: number): Route[] {
  return raw.map((points) => {
    const lon = Float64Array.from(points, (p) => p[0] / scale);
    const lat = Float64Array.from(points, (p) => p[1] / scale);
    const at = new Float64Array(points.length);
    for (let i = 1; i < points.length; i++) {
      at[i] = at[i - 1] + Math.hypot((lon[i] - lon[i - 1]) * M_LON, (lat[i] - lat[i - 1]) * M_LAT);
    }
    return { lon, lat, at, total: at[points.length - 1] };
  });
}

// Fixed pseudo-random numbers from a vehicle number, the same on every phone.
const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// Where a vehicle is, and which way it faces, at a distance along its route.
function placeOn(r: Route, s: number): { lon: number; lat: number; heading: number } {
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
  const rx = Math.cos(heading) * LANE_OFFSET_M;
  const ry = -Math.sin(heading) * LANE_OFFSET_M;
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

export async function startTraffic(map: Map, getTier: () => Tier, serverNow: () => number) {
  let routes: Route[];
  try {
    const file = await (await fetch(ROUTES_URL)).json();
    routes = prepare(file.routes, file.scale);
  } catch {
    return; // no traffic is better than a broken game
  }
  if (!routes.length) return;

  const vehicles: Vehicle[] = Array.from({ length: VEHICLES }, (_, i) => {
    const kind = MIX[Math.floor(hash(i * 3 + 1) * MIX.length)];
    const k = KINDS[kind];
    const route = i % routes.length;
    return {
      route,
      kind,
      colour: k.colours[Math.floor(hash(i * 3 + 2) * k.colours.length)],
      offset: hash(i * 3 + 3) * routes[route].total,
      speed: k.speed * (0.85 + hash(i * 7) * 0.3),
    };
  });

  let last = 0;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (now - last < FRAME_MS) return;
    last = now;
    const source = map.getSource<GeoJSONSource>('traffic');
    if (!source) return; // the style is being swapped

    const tier = getTier();
    const centre = map.getCenter();
    const t = serverNow() / 1000;
    const near: { d: number; v: Vehicle; p: ReturnType<typeof placeOn> }[] = [];
    for (const v of vehicles) {
      const r = routes[v.route];
      const p = placeOn(r, (v.offset + v.speed * t) % r.total);
      const d = Math.hypot((p.lon - centre.lng) * M_LON, (p.lat - centre.lat) * M_LAT);
      if (d < DRAW_RADIUS_M[tier]) near.push({ d, v, p });
    }
    near.sort((a, b) => a.d - b.d);

    const features: VehicleShape[] = [];
    for (const { v, p } of near.slice(0, DRAW_LIMIT[tier])) {
      const real = KINDS[v.kind];
      const k = { ...real, length: real.length * SIZE, width: real.width * SIZE, height: real.height * SIZE };
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
          geometry: { type: 'Polygon', coordinates: box(p.lon, p.lat, p.heading, k.length * 0.55, k.width * 0.9, -0.2 * SIZE) },
        });
      }
      if (v.kind === 'taxi') {
        // Accra taxis: a darker band along the sides.
        features.push({
          type: 'Feature',
          properties: { colour: '#c8102e', base: 0.55 * SIZE, top: 0.75 * SIZE },
          geometry: { type: 'Polygon', coordinates: box(p.lon, p.lat, p.heading, k.length * 0.98, k.width + 0.04) },
        });
      }
    }
    source.setData({ type: 'FeatureCollection', features });
  };
  requestAnimationFrame(frame);
}
