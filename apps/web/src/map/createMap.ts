import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { ACCRA_START, buildStyle, type Tier } from './style';

// MapLibre draws tiles in a separate worker file; ship it with the build.
maplibregl.setWorkerUrl(workerUrl);

// Light mode draws fewer pixels: phones gain little from full density.
export const pixelRatioFor = (tier: Tier) => Math.min(window.devicePixelRatio, tier === 'light' ? 1.5 : 2);

// Light looks straight down at flat buildings; Full tilts to show them in 3D.
export const pitchFor = (tier: Tier) => (tier === 'light' ? 0 : ACCRA_START.pitch);

export function createMap(container: HTMLElement, tier: Tier) {
  const map = new maplibregl.Map({
    container,
    style: buildStyle(tier),
    center: ACCRA_START.center,
    zoom: ACCRA_START.zoom,
    pitch: pitchFor(tier),
    bearing: tier === 'light' ? 0 : ACCRA_START.bearing,
    minZoom: 12,
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
