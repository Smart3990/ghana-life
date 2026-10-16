import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { ACCRA_CENTER, buildStyle, type Tier } from './style';

// MapLibre draws tiles in a separate worker file; ship it with the build.
maplibregl.setWorkerUrl(workerUrl);

// Light mode draws fewer pixels: phones gain little from full density.
export const pixelRatioFor = (tier: Tier) => Math.min(window.devicePixelRatio, tier === 'light' ? 1.5 : 2);

export function createMap(container: HTMLElement, tier: Tier) {
  return new maplibregl.Map({
    container,
    style: buildStyle(tier),
    center: ACCRA_CENTER,
    zoom: 13,
    minZoom: 9,
    maxZoom: 18,
    // Keep players around Greater Accra, where we have map data.
    maxBounds: [-0.8, 5.25, 0.95, 6.3],
    pixelRatio: pixelRatioFor(tier),
    attributionControl: { compact: true },
  });
}
