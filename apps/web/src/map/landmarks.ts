import type { LayerSpecification, SourceSpecification } from 'maplibre-gl';

// Hero landmarks drawn by us, because the map data only marks them as points.
// Sizes are approximate, chosen to read well in the game, not survey-accurate.

type Box = {
  east: number; // metres east of the landmark centre
  north: number; // metres north of the landmark centre
  width: number; // east-west size in metres
  depth: number; // north-south size in metres
  base: number; // metres above ground
  top: number; // metres above ground
  color: string;
  flat?: boolean; // hidden on the flat (Light) map, e.g. upright shapes
};

const WHITE = '#f4f1ea';
const STONE = '#e2dccf';
const BLACK = '#1b1b1b';
const GOLD = '#e8b10d';

// An upright five-pointed star facing south, built from thin horizontal bars,
// because the map can only raise flat shapes straight up.
function uprightStar(centreHeight: number, radius: number, north: number, depth: number, color: string): Box[] {
  const corners: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.4;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    corners.push([r * Math.cos(a), centreHeight + r * Math.sin(a)]);
  }
  const slice = radius / 14;
  const boxes: Box[] = [];
  for (let z = centreHeight - radius; z < centreHeight + radius; z += slice) {
    const mid = z + slice / 2;
    // Where this height crosses the star's outline, as pairs of left/right edges.
    const xs: number[] = [];
    for (let i = 0; i < corners.length; i++) {
      const [x1, z1] = corners[i];
      const [x2, z2] = corners[(i + 1) % corners.length];
      if ((z1 <= mid && z2 > mid) || (z2 <= mid && z1 > mid)) xs.push(x1 + ((mid - z1) / (z2 - z1)) * (x2 - x1));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      boxes.push({ east: (xs[k] + xs[k + 1]) / 2, north, width: xs[k + 1] - xs[k], depth, base: z, top: z + slice, color, flat: true });
    }
  }
  return boxes;
}

// Black Star Gate: two big pillars and a beam, facing south onto the square, with the black star on top.
const BLACK_STAR_GATE = {
  center: [-0.19286, 5.549] as [number, number],
  boxes: [
    { east: 0, north: 0, width: 52, depth: 12, base: 0, top: 1.5, color: STONE }, // platform
    { east: -18, north: 0, width: 11, depth: 8, base: 1.5, top: 20, color: WHITE }, // west pillar
    { east: 18, north: 0, width: 11, depth: 8, base: 1.5, top: 20, color: WHITE }, // east pillar
    { east: 0, north: 0, width: 48, depth: 8, base: 20, top: 27, color: WHITE }, // beam
    { east: 0, north: -4.1, width: 48, depth: 0.4, base: 21.5, top: 23, color: BLACK }, // band on the face
    { east: 0, north: 0, width: 14, depth: 6, base: 27, top: 29, color: WHITE }, // stand for the star
    ...uprightStar(35.2, 7.4, 0.6, 1, GOLD), // gold edge, just behind
    ...uprightStar(35, 6.4, -0.4, 1.2, BLACK), // the black star
  ] as Box[],
};

// Independence Arch: three openings under a wide top, at the south end of the square.
const INDEPENDENCE_ARCH = {
  center: [-0.19241, 5.54647] as [number, number],
  boxes: [
    { east: 0, north: 0, width: 34, depth: 9, base: 0, top: 1, color: STONE },
    { east: -14, north: 0, width: 4, depth: 6, base: 1, top: 11, color: WHITE },
    { east: -4.7, north: 0, width: 4, depth: 6, base: 1, top: 11, color: WHITE },
    { east: 4.7, north: 0, width: 4, depth: 6, base: 1, top: 11, color: WHITE },
    { east: 14, north: 0, width: 4, depth: 6, base: 1, top: 11, color: WHITE },
    { east: 0, north: 0, width: 33, depth: 6, base: 11, top: 15, color: WHITE },
    { east: 0, north: 0, width: 4, depth: 0.6, base: 15, top: 17.5, color: GOLD },
  ] as Box[],
};

// Converts a box in metres around a centre into a map polygon.
function boxFeature([lon, lat]: [number, number], b: Box) {
  const mPerLat = 110574;
  const mPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const x = (m: number) => lon + m / mPerLon;
  const y = (m: number) => lat + m / mPerLat;
  const [w, e] = [x(b.east - b.width / 2), x(b.east + b.width / 2)];
  const [s, n] = [y(b.north - b.depth / 2), y(b.north + b.depth / 2)];
  return {
    type: 'Feature' as const,
    properties: { base: b.base, top: b.top, color: b.color, flat: b.flat ?? false },
    geometry: { type: 'Polygon' as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
  };
}

export function landmarkSources(): Record<string, SourceSpecification> {
  const boxes = [BLACK_STAR_GATE, INDEPENDENCE_ARCH].flatMap((l) => l.boxes.map((b) => boxFeature(l.center, b)));
  return { landmarks: { type: 'geojson', data: { type: 'FeatureCollection', features: boxes } } };
}

export function landmarkLayers(tier: 'light' | 'full'): LayerSpecification[] {
  if (tier === 'light') {
    return [{
      id: 'landmarks',
      type: 'fill',
      source: 'landmarks',
      filter: ['!', ['get', 'flat']],
      paint: { 'fill-color': ['get', 'color'], 'fill-outline-color': '#9c9384' },
    }];
  }
  return [{
    id: 'landmarks',
    type: 'fill-extrusion',
    source: 'landmarks',
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-height': ['get', 'top'],
    },
  }];
}
