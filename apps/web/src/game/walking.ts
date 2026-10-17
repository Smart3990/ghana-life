import type { GeoJSONSource, Map } from 'maplibre-gl';
import { Avatar, speedFor } from './avatar';
import { metresBetween, type LngLat } from './roads';
import { StreetAreas } from './streetAreas';
import { mark } from '../net/live';

const BLACK_STAR_SQUARE: LngLat = [-0.1926, 5.5474];

// Each player starts somewhere on the square, up to about 40 m from its centre,
// so new arrivals do not stand on top of each other.
function startSpot(): LngLat {
  const a = Math.random() * 2 * Math.PI;
  const r = Math.random() * 0.00036;
  return [BLACK_STAR_SQUARE[0] + r * Math.cos(a), BLACK_STAR_SQUARE[1] + r * Math.sin(a)];
}

const PROBLEMS = {
  far: 'That is too far to walk. Tap somewhere closer (rides are coming soon).',
  unmapped: 'There are no mapped streets there yet.',
  none: 'No way to walk there. Try a spot on a street.',
};

// Tap anywhere in Greater Accra: the avatar walks there along real streets, and the camera follows.
// onWalk is told about every walk, so it can be shared with other players.
export function enableWalking(
  map: Map,
  toast: (text: string) => void,
  onWalk: (path: LngLat[], speed: number) => void,
  start: LngLat = startSpot(),
): Avatar {
  const streets = new StreetAreas();
  streets.warmUp(start); // load the streets around the player before the first tap
  const avatar = new Avatar(map, start);
  let following = false;
  let walkId = 0;

  map.on('dragstart', () => (following = false)); // the player is looking around: stop chasing the avatar

  const showRoute = (path: LngLat[]) => {
    const source = map.getSource<GeoJSONSource>('route');
    source?.setData({
      type: 'FeatureCollection',
      features: path.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: path } }] : [],
    });
  };

  map.on('click', async (e) => {
    mark('tapped');
    const target: LngLat = [e.lngLat.lng, e.lngLat.lat];
    let found: Awaited<ReturnType<StreetAreas['route']>>;
    try {
      found = await streets.route(avatar.position, target);
    } catch {
      toast('Could not load the streets. Check your connection.');
      return;
    }
    if ('problem' in found) {
      toast(PROBLEMS[found.problem]);
      return;
    }
    const path = found.path;
    path.unshift(avatar.position); // start exactly where the avatar stands

    const id = ++walkId;
    following = true;
    showRoute(path);
    // Bring the avatar into view first, then follow it step by step.
    const arrived = new Promise<void>((resolve) => map.once('moveend', () => resolve()));
    map.easeTo({ center: avatar.position, duration: 600 });
    await arrived;
    if (id !== walkId) return; // the player tapped somewhere else meanwhile
    const metres = path.slice(1).reduce((sum, p, i) => sum + metresBetween(path[i], p), 0);
    const speed = speedFor(metres);
    onWalk(path, speed);
    // The camera glides after the avatar (closing a fifth of the gap each frame)
    // instead of snapping to it, which looks smoother.
    await avatar.walk(path, speed, ([lon, lat]) => {
      if (!following || id !== walkId) return;
      const c = map.getCenter();
      map.jumpTo({ center: [c.lng + (lon - c.lng) * 0.2, c.lat + (lat - c.lat) * 0.2] });
    });
    if (id === walkId) showRoute([]);
  });

  return avatar;
}
