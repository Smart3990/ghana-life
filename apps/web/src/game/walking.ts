import type { GeoJSONSource, Map } from 'maplibre-gl';
import { Avatar, WALK_SPEED_M_PER_S } from './avatar';
import { Roads, type LngLat } from './roads';
import { mark } from '../net/live';

const ROADS_URL = '/data/roads-central.json';
const BLACK_STAR_SQUARE: LngLat = [-0.1926, 5.5474];

// Each player starts somewhere on the square, up to about 40 m from its centre,
// so new arrivals do not stand on top of each other.
function startSpot(): LngLat {
  const a = Math.random() * 2 * Math.PI;
  const r = Math.random() * 0.00036;
  return [BLACK_STAR_SQUARE[0] + r * Math.cos(a), BLACK_STAR_SQUARE[1] + r * Math.sin(a)];
}

// Tap anywhere in central Accra: the avatar walks there along real streets, and the camera follows.
// onWalk is told about every walk, so it can be shared with other players.
export function enableWalking(map: Map, toast: (text: string) => void, onWalk: (path: LngLat[], speed: number) => void): Avatar {
  const roadsReady = Roads.load(ROADS_URL);
  const avatar = new Avatar(map, startSpot());
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
    let roads: Roads;
    try {
      roads = await roadsReady;
    } catch {
      toast('Could not load the streets. Check your connection.');
      return;
    }
    if (!roads.contains(target)) {
      toast('For now you can walk in central Accra, from Jamestown to Osu.');
      return;
    }
    const path = roads.route(roads.nearest(avatar.position), roads.nearest(target));
    if (!path) {
      toast('No way to walk there. Try a spot on a street.');
      return;
    }
    path.unshift(avatar.position); // start exactly where the avatar stands

    const id = ++walkId;
    following = true;
    showRoute(path);
    // Bring the avatar into view first, then follow it step by step.
    const arrived = new Promise<void>((resolve) => map.once('moveend', () => resolve()));
    map.easeTo({ center: avatar.position, duration: 600 });
    await arrived;
    if (id !== walkId) return; // the player tapped somewhere else meanwhile
    onWalk(path, WALK_SPEED_M_PER_S);
    await avatar.walk(path, (p) => {
      if (following && id === walkId) map.jumpTo({ center: p });
    });
    if (id === walkId) showRoute([]);
  });

  return avatar;
}
