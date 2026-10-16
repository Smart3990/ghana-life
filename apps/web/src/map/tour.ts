import type { Map } from 'maplibre-gl';
import type { Tier } from './style';

// A tour of Greater Accra: fly to each area, then glide sideways along its streets.
type Stop = {
  name: string;
  center: [number, number];
  bearing: number; // which way the camera faces
  zoom?: number;
  glide: 'orbit' | 'slide'; // circle a monument, or slide sideways along the streets
};

export const TOUR: Stop[] = [
  { name: 'Black Star Square, Accra', center: [-0.1928, 5.5482], bearing: -8, zoom: 17.6, glide: 'orbit' },
  { name: 'Jamestown', center: [-0.2125, 5.5345], bearing: 200, glide: 'slide' },
  { name: 'Makola Market', center: [-0.2069, 5.5481], bearing: 30, glide: 'slide' },
  { name: 'Osu', center: [-0.1812, 5.5566], bearing: -20, glide: 'slide' },
  { name: 'Labadi Beach', center: [-0.144, 5.5625], bearing: 70, glide: 'slide' }, // along the coast, sea on the right
  { name: 'Airport City', center: [-0.1752, 5.6007], bearing: 10, glide: 'slide' },
  { name: 'East Legon', center: [-0.1601, 5.6354], bearing: -30, glide: 'slide' },
  { name: 'University of Ghana, Legon', center: [-0.188, 5.6466], bearing: 0, glide: 'slide' },
  { name: 'Tema', center: [0.02, 5.655], bearing: 220, glide: 'slide' }, // Community 1, facing the harbour
];

const STAY_MS = 10_000;
const FLY_MS = 5_000;
const SLIDE_METRES = 400;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The point a given number of metres away in a compass direction.
function offset([lon, lat]: [number, number], metres: number, bearingDeg: number): [number, number] {
  const a = (bearingDeg * Math.PI) / 180;
  const dNorth = metres * Math.cos(a);
  const dEast = metres * Math.sin(a);
  return [lon + dEast / (111320 * Math.cos((lat * Math.PI) / 180)), lat + dNorth / 110574];
}

const linear = (t: number) => t;

// Runs the tour once, starting at Black Star Square (where the camera already is),
// and ends back there. Returns a stop function; touching the map also stops it.
export function startTour(map: Map, getTier: () => Tier, onPlace: (name: string) => void) {
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    map.stop();
  };
  for (const event of ['mousedown', 'touchstart', 'wheel'] as const) map.once(event, stop);

  // Resolves when the current camera move ends (or is cut short).
  const moveDone = () => new Promise<void>((resolve) => map.once('moveend', () => resolve()));
  const pitch = () => (getTier() === 'light' ? 0 : 65);

  const glide = async (s: Stop) => {
    const done = moveDone();
    if (s.glide === 'orbit') {
      map.easeTo({ bearing: map.getBearing() + 40, duration: STAY_MS, easing: linear });
    } else {
      // Slide to the camera's right, turning a little, like a car driving past.
      const side = map.getBearing() + 90;
      map.easeTo({ center: offset(map.getCenter().toArray() as [number, number], SLIDE_METRES, side), bearing: map.getBearing() + 12, duration: STAY_MS, easing: linear });
    }
    await done;
  };

  const run = async () => {
    if (reducedMotion) return;
    const route = [...TOUR, TOUR[0]];
    for (let i = 0; i < route.length && !stopped; i++) {
      const s = route[i];
      if (i > 0) {
        const done = moveDone();
        map.flyTo({ center: s.center, zoom: s.zoom ?? 16.6, pitch: pitch(), bearing: s.bearing, duration: FLY_MS, curve: 1.2, essential: true });
        await done;
        if (stopped) break;
      }
      onPlace(s.name);
      if (i === route.length - 1) break; // back at Black Star Square: stay put
      await glide(s);
    }
    // Back home: keep circling the monument slowly until the player touches the map.
    if (!stopped) map.easeTo({ bearing: map.getBearing() + 360, duration: 180_000, easing: linear });
  };
  run();
  return stop;
}
