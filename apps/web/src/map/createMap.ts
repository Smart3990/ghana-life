import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { ACCRA_OVERVIEW, ACCRA_START, buildStyle, type Tier } from './style';

// MapLibre draws tiles in a separate worker file; ship it with the build.
maplibregl.setWorkerUrl(workerUrl);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Light mode draws fewer pixels: phones gain little from full density.
const pixelRatioFor = (tier: Tier) => Math.min(window.devicePixelRatio, tier === 'light' ? 1.5 : 2);

// Light looks straight down at flat buildings; Full tilts to show them in 3D.
const landingFor = (tier: Tier) =>
  tier === 'light' ? { ...ACCRA_START, zoom: 16.5, pitch: 0, bearing: 0 } : ACCRA_START;

export function createMap(container: HTMLElement, tier: Tier) {
  const map = new maplibregl.Map({
    container,
    style: buildStyle(tier),
    ...(reducedMotion ? landingFor(tier) : ACCRA_OVERVIEW),
    minZoom: 10,
    maxZoom: 19,
    maxPitch: 70,
    // Keep players around Greater Accra, where we have map data.
    maxBounds: [-0.8, 5.25, 0.95, 6.3],
    pixelRatio: pixelRatioFor(tier),
    attributionControl: { compact: true },
  });
  // Compass: tap to face north again; shows the tilt.
  map.addControl(new maplibregl.NavigationControl({ showZoom: false, visualizePitch: true }), 'bottom-right');
  return map;
}

// The opening swoop: glide from above Accra down to the streets of Osu.
export function flyIn(map: maplibregl.Map, tier: Tier): Promise<void> {
  return new Promise((resolve) => {
    if (reducedMotion) return resolve();
    map.once('moveend', () => resolve());
    map.flyTo({ ...landingFor(tier), duration: 5500, curve: 1.3, essential: true });
  });
}

// A slow circle around the street after landing. Stops for good once the player touches the map.
export function startIdleOrbit(map: maplibregl.Map) {
  if (reducedMotion) return () => {};
  let running = true;
  let frame = 0;
  let last = performance.now();
  const step = (now: number) => {
    if (!running) return;
    map.setBearing(map.getBearing() + ((now - last) / 1000) * 2); // 2 degrees a second
    last = now;
    frame = requestAnimationFrame(step);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };
  for (const event of ['mousedown', 'touchstart', 'wheel'] as const) map.once(event, stop);
  frame = requestAnimationFrame(step);
  return stop;
}

// Switch to Light in place: flat buildings, fewer layers, fewer pixels, camera from above.
export function applyLight(map: maplibregl.Map) {
  map.setPixelRatio(pixelRatioFor('light'));
  map.setStyle(buildStyle('light'));
  map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
}
