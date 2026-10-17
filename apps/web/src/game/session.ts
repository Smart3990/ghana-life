// Remembers where the player is, so a refresh (or coming back soon after)
// returns them to the same spot instead of replaying the welcome screen and tour.
import type { Map } from 'maplibre-gl';
import type { LngLat } from './roads';

const KEY = 'gl.session';
const FRESH_FOR_MS = 3 * 60 * 60 * 1000; // 3 hours

export type Session = {
  avatar: LngLat;
  camera: { center: LngLat; zoom: number; pitch: number; bearing: number };
  savedAt: number;
};

export function loadSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
    if (!s || Date.now() - s.savedAt > FRESH_FOR_MS) return null;
    return s;
  } catch {
    return null;
  }
}

// Saves now, every few seconds, and when the page is hidden or closed.
export function keepSessionSaved(map: Map, avatarPosition: () => LngLat) {
  const save = () => {
    const c = map.getCenter();
    const session: Session = {
      avatar: avatarPosition(),
      camera: { center: [c.lng, c.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() },
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      // Storage blocked: a refresh will show the welcome screen again.
    }
  };
  save();
  setInterval(save, 4000);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && save());
}
