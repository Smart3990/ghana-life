import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';

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

// Wall and roof colours seen around Accra: cream, terracotta, zinc, yellow, blue, white.
const buildingColour: ExpressionSpecification = [
  'match', ['%', buildingId, 6],
  0, '#efe0c4',
  1, '#d9825b',
  2, '#b8bcc2',
  3, '#f0d48f',
  4, '#c9dde8',
  '#f7f2ea',
];

const buildings3d: LayerSpecification = {
  id: 'buildings',
  type: 'fill-extrusion',
  source: 'accra',
  'source-layer': 'buildings',
  minzoom: 14,
  paint: {
    'fill-extrusion-color': buildingColour,
    // Buildings rise out of the ground as you zoom in.
    'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, ['coalesce', ['get', 'height'], guessedHeight]],
    'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
    'fill-extrusion-opacity': 0.95,
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

// Where the camera lands: Osu, near Oxford Street, looking across the street
// from low down so the houses are seen from the side with sky on the horizon.
export const ACCRA_START = {
  center: [-0.1812, 5.5566] as [number, number],
  zoom: 17.4,
  pitch: 72,
  bearing: -20,
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
  const withBuildings = kept.map((l) => (l.id === 'buildings' ? (tier === 'light' ? buildingsFlat : buildings3d) : l));
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
      'fog-ground-blend': 0.85,
    },
    sources: {
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
