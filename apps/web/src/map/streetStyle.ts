// Street-level look for the map: what you see when the camera is down among the people.
// Roads get their real widths in metres at every zoom, with pavements, open gutters, kerbs and a
// centre line; the ground gets a dusty texture; the floating labels (house numbers, road names,
// shop icons) are switched off, because up close they float in mid-air and make the view flicker.
import type { Map as MapLibreMap, ExpressionSpecification, FilterSpecification } from 'maplibre-gl';

const LAT = 5.56;
// Metres per screen pixel at zoom 0 for 512-pixel tiles, here in Accra.
const MPP0 = (40075016.686 * Math.cos((LAT * Math.PI) / 180)) / 512;

// A width in metres, correct at every zoom (doubles with each zoom level, like the ground).
export const metres = (m: number): ExpressionSpecification => ['interpolate', ['exponential', 2], ['zoom'], 10, m / (MPP0 / 2 ** 10), 24, m / (MPP0 / 2 ** 24)];

// Road widths (metres) by kind, as found around Accra.
const ROAD: Record<string, { width: number; walk: number; colour: string }> = {
  // In the Low Poly Epic City pack's colours, so the far roads match the 3D ones near you (epicRoads.ts).
  highway: { width: 14, walk: 2.5, colour: '#3f3c3c' },
  major_road: { width: 10, walk: 2.5, colour: '#3f3c3c' },
  minor_road: { width: 6.5, walk: 1.8, colour: '#3f3c3c' },
  other: { width: 4.5, walk: 0, colour: '#4a4646' }, // lanes and service roads
  path: { width: 1.8, walk: 0, colour: '#a99f8c' },
};
const kindOf = (id: string) =>
  /highway/.test(id) ? 'highway' : /major/.test(id) ? 'major_road' : /minor_service|other/.test(id) ? 'other' : /minor/.test(id) ? 'minor_road' : /path/.test(id) ? 'path' : null;

function dustPattern(): ImageData {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#cdbf9f';
  g.fillRect(0, 0, size, size);
  // Specks of red laterite, grit and darker patches.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 380; i++) {
    const shade = rnd();
    g.fillStyle = shade < 0.35 ? 'rgba(160,104,70,0.22)' : shade < 0.7 ? 'rgba(90,80,60,0.16)' : 'rgba(255,248,230,0.25)';
    const s = 1 + rnd() * 3;
    g.fillRect(rnd() * size, rnd() * size, s, s);
  }
  return g.getImageData(0, 0, size, size);
}

export function applyStreetStyle(map: MapLibreMap) {
  const layers = map.getStyle().layers;
  // 1. Labels off.
  for (const l of layers) if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', 'none');

  // 2. Roads at real width, in tarmac colours; kerbs as thin pale edges.
  for (const l of layers) {
    if (l.type !== 'line' || !l.id.startsWith('roads_') || /rail|runway|taxiway|pier/.test(l.id)) continue;
    const kind = kindOf(l.id);
    if (!kind) continue;
    const road = ROAD[kind];
    if (/casing/.test(l.id)) {
      map.setPaintProperty(l.id, 'line-gap-width', metres(road.width));
      map.setPaintProperty(l.id, 'line-width', metres(0.25));
      map.setPaintProperty(l.id, 'line-color', '#a7a19e');
    } else {
      map.setPaintProperty(l.id, 'line-width', metres(road.width));
      map.setPaintProperty(l.id, 'line-color', road.colour);
    }
  }

  // 3. Pavements and open gutters under the roads, and a centre line on top of the big roads.
  const firstRoad = layers.find((l) => l.id.startsWith('roads_') && l.type === 'line' && !/runway|taxiway/.test(l.id))?.id;
  const kinds = (list: string[]): ExpressionSpecification => ['in', ['get', 'kind'], ['literal', list]];
  for (const kind of ['highway', 'major_road', 'minor_road']) {
    const road = ROAD[kind];
    const filter = kinds([kind]);
    map.addLayer(
      {
        id: `street_walk_${kind}`,
        type: 'line',
        source: 'accra',
        'source-layer': 'roads',
        filter,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#a7a19e', 'line-width': metres(road.width + road.walk * 2 + 1.2) },
      },
      firstRoad,
    );
    map.addLayer(
      {
        id: `street_gutter_${kind}`,
        type: 'line',
        source: 'accra',
        'source-layer': 'roads',
        filter,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: { 'line-color': '#3f3c3c', 'line-width': metres(road.width + 1.1) },
      },
      firstRoad,
    );
  }
  map.addLayer({
    id: 'street_centre_line',
    type: 'line',
    source: 'accra',
    'source-layer': 'roads',
    filter: ['all', kinds(['highway', 'major_road']), ['!=', ['get', 'oneway'], 'yes']] as FilterSpecification,
    paint: { 'line-color': '#fdcf24', 'line-width': metres(0.3) },
  });

  // 4. Dusty ground.
  if (!map.hasImage('street-dust')) map.addImage('street-dust', dustPattern());
  for (const id of ['earth', 'background']) {
    const l = map.getLayer(id);
    if (!l) continue;
    if (l.type === 'fill') map.setPaintProperty(id, 'fill-pattern', 'street-dust');
    if (l.type === 'background') map.setPaintProperty(id, 'background-pattern', 'street-dust');
  }
  const paint = (id: string, prop: 'fill-color', value: string) => map.getLayer(id) && map.setPaintProperty(id, prop, value);
  paint('landuse_pedestrian', 'fill-color', '#bdb4a2');
  paint('landuse_urban_green', 'fill-color', '#8f9f62');
  paint('landuse_park', 'fill-color', '#86a05c');
}
