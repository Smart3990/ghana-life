import type { StyleSpecification } from 'maplibre-gl';
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
  buildings: '#e4d4c0',
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
const HEAVY = ['buildings', 'landcover', 'address_label', 'roads_oneway', 'roads_shields', 'pois'];

export const ACCRA_CENTER: [number, number] = [-0.205, 5.556];

export function buildStyle(tier: Tier): StyleSpecification {
  const origin = window.location.origin;
  const all = layers('accra', GHANA, { lang: 'en' });
  return {
    version: 8,
    glyphs: `${origin}/map/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/map/sprites/light`,
    sources: {
      accra: {
        type: 'vector',
        tiles: [`${origin}/tiles/accra/{z}/{x}/{y}.pbf`],
        minzoom: 0,
        maxzoom: 14,
        bounds: [-0.55, 5.45, 0.72, 6.1],
        attribution:
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a> · <a href="https://protomaps.com" target="_blank">Protomaps</a>',
      },
    },
    layers: tier === 'light' ? all.filter((l) => !HEAVY.includes(l.id)) : all,
  };
}
