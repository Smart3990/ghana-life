// T7a: ambient planes on approach to and from Kotoka International Airport, driven by the
// shared clock, so every phone sees the same plane in the same place with no network messages.
// The paths are approximate (master plan: "an approximate approach line, not real flight data").
import type { GeoJSONSource, Map } from 'maplibre-gl';

const M_LAT = 110574;
const M_LON = 111320 * Math.cos((5.6 * Math.PI) / 180);

// Runway 03/21, from the map data: centreline 5.59069,-0.17319 (south-west end) to
// 5.61911,-0.16150 (north-east end), true heading about 202°. With Accra's usual south-west
// wind, planes land and take off on runway 21: arrivals come in from the north-east,
// departures climb out south-west over Airport, Ridge and central Accra towards the sea.
const RUNWAY_NE_END: [number, number] = [-0.1615, 5.61911];
const HEADING_DEG = 202;
const RUNWAY_M = 3400;

const EVERY_S = 150; // a flight every two and a half minutes
const SPEED_M_PER_S = 75;
const PATH_M = 22_000; // how far out we follow each plane
const GLIDE = Math.tan((3 * Math.PI) / 180); // standard 3° approach
const CLIMB = 0.09;
const SHOW_WITHIN_M = 9000;
const SIZE = 2.2; // drawn larger than life so it reads from the ground, like the vehicles

// Top view of a jet in metres: x to the right, y forward (nose at +y).
const OUTLINE: [number, number][] = [
  [0, 20], [2, 17], [2, 4], [18, -2], [18, -4], [2, -2], [2, -14], [6, -18], [6, -20], [0, -19],
  [-6, -20], [-6, -18], [-2, -14], [-2, -2], [-18, -4], [-18, -2], [-2, 4], [-2, 17], [0, 20],
];

type Shape = {
  type: 'Feature';
  properties: { base: number; top: number; shadow: number };
  geometry: { type: 'Polygon'; coordinates: number[][][] };
};

// The point `metres` from `from` in compass direction `bearingDeg`.
function move([lon, lat]: [number, number], metres: number, bearingDeg: number): [number, number] {
  const a = (bearingDeg * Math.PI) / 180;
  return [lon + (Math.sin(a) * metres) / M_LON, lat + (Math.cos(a) * metres) / M_LAT];
}

function outline(centre: [number, number], headingDeg: number): number[][][] {
  const a = (headingDeg * Math.PI) / 180;
  const f = [Math.sin(a), Math.cos(a)];
  const r = [Math.cos(a), -Math.sin(a)];
  return [OUTLINE.map(([x, y]) => [
    centre[0] + ((f[0] * y + r[0] * x) * SIZE) / M_LON,
    centre[1] + ((f[1] * y + r[1] * x) * SIZE) / M_LAT,
  ])];
}

// Where flight number k is, t seconds after it started, or null if it is out of range.
function flight(k: number, t: number): { at: [number, number]; altitude: number } | null {
  const travelled = t * SPEED_M_PER_S;
  if (travelled < 0 || travelled > PATH_M) return null;
  if (k % 2 === 0) {
    // Arrival: from PATH_M out along the approach, down the 3° slope to the runway.
    const toGo = PATH_M - travelled;
    const at = move(RUNWAY_NE_END, toGo, HEADING_DEG + 180);
    return { at, altitude: toGo * GLIDE };
  }
  // Departure: roll down the runway, lift off halfway, then climb out south-west.
  const at = move(RUNWAY_NE_END, travelled, HEADING_DEG);
  const airborne = Math.max(0, travelled - RUNWAY_M / 2);
  return { at, altitude: airborne * CLIMB };
}

export function startPlanes(map: Map, serverNow: () => number) {
  const frame = () => {
    requestAnimationFrame(frame);
    const planes = map.getSource<GeoJSONSource>('planes');
    if (!planes) return; // the style is being swapped
    const now = serverNow() / 1000;
    const centre = map.getCenter();
    const latest = Math.floor(now / EVERY_S);
    const shapes: Shape[] = [];
    // A flight lasts longer than the gap between flights, so look back a few slots.
    for (let k = latest; k > latest - 4; k--) {
      const f = flight(k, now - k * EVERY_S);
      if (!f) continue;
      const away = Math.hypot((f.at[0] - centre.lng) * M_LON, (f.at[1] - centre.lat) * M_LAT);
      if (away > SHOW_WITHIN_M) continue;
      const shape = outline(f.at, HEADING_DEG);
      shapes.push({ type: 'Feature', properties: { base: f.altitude, top: f.altitude + 3 * SIZE, shadow: 0 }, geometry: { type: 'Polygon', coordinates: shape } });
      // A soft shadow on the ground while the plane is low.
      if (f.altitude < 500) {
        shapes.push({ type: 'Feature', properties: { base: 0, top: 0, shadow: 0.35 * (1 - f.altitude / 500) }, geometry: { type: 'Polygon', coordinates: shape } });
      }
    }
    planes.setData({ type: 'FeatureCollection', features: shapes });
  };
  requestAnimationFrame(frame);
}
