import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import { landmarkLayers, landmarkSources } from './landmarks';

export type Tier = 'light' | 'full';

// Our own bright Ghana palette, on top of Protomaps' "light" flavor.
const GHANA: Flavor = {
  ...namedFlavor('light'),
  background: '#efe8d8',
  earth: '#f5efe1',
  park_a: '#b9e295',
  park_b: '#a9d982',
  wood_a: '#a3d48c',
  wood_b: '#92ca7b',
  scrub_a: '#c8e3a4',
  scrub_b: '#bddb98',
  water: '#4fb6ea',
  beach: '#f8e0a2',
  sand: '#f2dca9',
  hospital: '#f8d7d5',
  school: '#f4e6b8',
  industrial: '#e9dfd3',
  aerodrome: '#e7e2f0',
  runway: '#cdc5de',
  buildings: '#dcc7ad',
  highway: '#f4a93a',
  highway_casing_early: '#d38326',
  highway_casing_late: '#d38326',
  major: '#ffd36b',
  major_casing_early: '#e3aa3c',
  major_casing_late: '#e3aa3c',
  link: '#ffd36b',
  minor_a: '#ffffff',
  minor_b: '#ffffff',
  bridges_highway: '#f4a93a',
  bridges_major: '#ffd36b',
  railway: '#9c7f63',
  city_label: '#3b2e20',
  city_label_halo: '#ffffff',
  subplace_label: '#6c5641',
  roads_label_major: '#4a3b2a',
  roads_label_minor: '#6c5641',
};

// Layers left out in Light mode: fewer things to draw on weak phones.
const HEAVY = ['landcover', 'address_label', 'roads_oneway', 'roads_shields', 'pois'];

// Most Accra buildings have no recorded height. Give each one a believable
// height of one to three storeys, picked from its id so it never changes.
const buildingId: ExpressionSpecification = ['to-number', ['id'], 0];
const guessedHeight: ExpressionSpecification = ['+', 4, ['*', 3, ['%', buildingId, 3]]];

// Painted walls seen around Accra: cream, white, pale yellow, peach, sky blue, mint, sand.
const wallColour: ExpressionSpecification = [
  'match', ['%', buildingId, 7],
  0, '#f1e3c8',
  1, '#faf7f0',
  2, '#f3dc9a',
  3, '#efc3a4',
  4, '#cfe2ee',
  5, '#d6e9cf',
  '#e6d2b3',
];

// Roofs: rusty zinc, bright zinc, dark zinc, terracotta, blue roofing sheet.
const roofColour: ExpressionSpecification = [
  'match', ['%', ['floor', ['/', buildingId, 7]], 5],
  0, '#8b5a43',
  1, '#a9afb5',
  2, '#6d7379',
  3, '#b75a3c',
  '#5d7f9b',
];

// Flat map (Light) shows roofs from above.
const buildingColour = roofColour;

// Buildings rise out of the ground as you zoom in.
const rise = (height: ExpressionSpecification): ExpressionSpecification =>
  ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, height];
const wallHeight: ExpressionSpecification = ['coalesce', ['get', 'height'], guessedHeight];

const buildings3d: LayerSpecification = {
  id: 'buildings',
  type: 'fill-extrusion',
  source: 'accra',
  'source-layer': 'buildings',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': wallColour,
    'fill-extrusion-height': rise(wallHeight),
    'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
    'fill-extrusion-opacity': 1,
  },
};

// A thin slab on top of each building, in roof colours, so houses read as walls plus a roof.
const roofs3d: LayerSpecification = {
  id: 'roofs',
  type: 'fill-extrusion',
  source: 'accra',
  'source-layer': 'buildings',
  minzoom: 15,
  paint: {
    'fill-extrusion-color': roofColour,
    'fill-extrusion-base': rise(wallHeight),
    'fill-extrusion-height': rise(['+', wallHeight, 0.7]),
    'fill-extrusion-opacity': 1,
  },
};

const buildingsFlat: LayerSpecification = {
  id: 'buildings',
  type: 'fill',
  source: 'accra',
  'source-layer': 'buildings',
  minzoom: 14,
  paint: { 'fill-color': buildingColour, 'fill-outline-color': '#b59c80' },
};

// Where the camera lands: on Black Star Square, looking north across the square
// to Black Star Gate, with Nationalism Park and the city behind it.
export const ACCRA_START = {
  center: [-0.1928, 5.5482] as [number, number],
  zoom: 17.6,
  pitch: 66,
  bearing: -8,
};

// Where the camera starts before gliding down: high above central Accra.
export const ACCRA_OVERVIEW = {
  center: [-0.2, 5.585] as [number, number],
  zoom: 11.5,
  pitch: 0,
  bearing: 0,
};

export function buildStyle(tier: Tier): StyleSpecification {
  const origin = window.location.origin;
  const base = layers('accra', GHANA, { lang: 'en' });
  const kept = tier === 'light' ? base.filter((l) => !HEAVY.includes(l.id)) : base;
  const withBuildings = kept.flatMap((l) => {
    if (l.id !== 'buildings') return [l];
    return tier === 'light' ? [buildingsFlat, ...landmarkLayers('light')] : [buildings3d, roofs3d, ...landmarkLayers('full')];
  });
  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/map/sprites/light`,
    sky: {
      'sky-color': '#7cc6f2',
      'horizon-color': '#e6f3fb',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-color': '#f5efe1',
      'fog-ground-blend': 0.95,
    },
    sources: {
      ...landmarkSources(),
      accra: {
        type: 'vector',
        tiles: [`${origin}/tiles/accra/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: 15,
        bounds: [-0.55, 5.45, 0.72, 6.1],
        attribution:
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a> · <a href="https://protomaps.com" target="_blank">Protomaps</a>',
      },
    },
    layers: withBuildings,
  };
}
