// The Epic City pack's buildings on the real Accra building shapes (step 6b; owner, 28 Oct 2026: "the
// map should display real buildings from the epic pack", the main places and the stores as they are).
// For every building on the map, a pack building that fits its real outline: the bank, the hospital,
// the school, the police and fire stations, the mosque, the hotel, the post office, the cinema, the
// mall, chop bars and cafes where the map has those places; flats where the map's building is tall,
// offices and towers where it is very tall, warehouses for big low sheds, and houses everywhere else:
// small and family houses, and modern luxury houses in the wealthy areas (East Legon, Airport
// Residential, Cantonments, Labone, Roman Ridge, Trasacco).
//
// Each one faces its nearest road and is stretched a little to fill its real outline (never more than
// about a third). Only the ones near you are drawn as pack buildings (one draw per model); further
// away the plain blocks stand in for them (streetBuildings.ts hides each block once its pack building
// is drawn). Every home gets a fixed address number, so a player can own it later (on the server).
import * as THREE from 'three';
import { epicGeometry, epicMaterial } from './epicKit';

// The pack models: [width (x), height, depth (z), x and z of the middle, triangles]. Their fronts face +z.
const MODELS = {
  'house-block': [6.1, 9.9, 9.84, 0.75, 0.58, 1664],
  'house-block-old': [5, 8.1, 13.9, 0.0, -0.25, 1287],
  'house-block-big': [8, 10.04, 13.5, 0.0, 0.0, 1519],
  'house-family-small': [10.87, 8.9, 11.8, 0.03, 0.75, 1746],
  'house-family-large': [15.68, 11.2, 13.6, 0.0, 1.2, 2163],
  'house-modern': [13.3, 7.77, 11.4, -0.35, 1.0, 1395],
  'house-modern-big': [18.8, 7.77, 11.4, -3.1, 1.0, 1605],
  cafe: [10.85, 8.49, 10.48, -0.17, 0.04, 3563],
  restaurant: [14.28, 7.9, 12.9, 0.01, -0.05, 4352],
  'burger-joint': [16.4, 4.8, 15.6, 1.8, 0.0, 1392],
  'block-4floor-front': [11.4, 20.61, 13.4, 0.0, 0.7, 4244],
  'block-4floor-short': [8.9, 20.61, 13.45, 0.0, -0.68, 3447],
  'block-4floor-corner': [11.75, 20.61, 11.75, -0.17, 0.17, 3730],
  'block-5floor': [13.1, 23.81, 15.65, 0.0, -0.09, 6170],
  'block-5floor-front': [13.1, 23.81, 11.92, 0.0, 0.7, 5214],
  'block-5floor-short': [8.1, 23.81, 14.7, 0.0, -0.57, 4752],
  office: [22, 43.7, 14, 0.0, 0.0, 4377],
  'office-big': [22, 52.08, 16.1, 0.0, -0.05, 6717],
  'office-rounded': [20, 39.4, 14.1, 0.0, 0.05, 5771],
  'office-tall': [19.43, 59.58, 14.6, -0.01, 0.0, 8730],
  'office-pyramid': [18, 52.6, 18.5, 0.0, 0.42, 4889],
  bank: [17.1, 13.7, 20.53, 0.0, 0.27, 5619],
  hospital: [25.6, 20.3, 14.7, 0.0, 0.05, 7382],
  school: [24.9, 13.72, 12.01, 0.0, 0.71, 5552],
  policestation: [10.25, 16.74, 12, 0.12, 1.0, 1926],
  firestation: [13.65, 15.54, 10.82, 0.48, -0.19, 2990],
  hotel: [29.6, 25.2, 13.7, 0.0, -0.05, 11028],
  cinema: [17.92, 14.58, 14, 0.0, 0.0, 2308],
  post: [13.92, 6.6, 14.55, 0.0, 0.74, 1434],
  mall: [28.4, 16.1, 13.4, 0.0, -0.5, 3746],
  mosque: [22, 22.33, 24, 0.0, 1.0, 2005],
  'industry-warehouse': [17.55, 6.3, 17.48, 0.03, 0.26, 1773],
  'industry-building': [16.41, 9.49, 12.35, -0.05, 1.17, 1900],
} as const;
export type PackModel = keyof typeof MODELS;
const fileOf = (m: PackModel) => (m === 'mosque' || m.startsWith('industry') ? `buildings/${m}.glb` : `buildings/building-${m}.glb`);

/** What a building is used for (homes can be owned by players later). */
export type Use = 'house' | 'luxury' | 'flat' | 'shop' | 'office' | 'place' | 'industry';
const GROUPS: Record<string, { models: PackModel[]; use: Use }> = {
  small: { models: ['house-block', 'house-block-old', 'house-block-big'], use: 'house' },
  house: { models: ['house-family-small', 'house-family-large', 'house-block-big', 'house-block'], use: 'house' }, // (the dark modern houses only in the wealthy areas)
  luxury: { models: ['house-modern', 'house-modern-big', 'house-family-large'], use: 'luxury' },
  shop: { models: ['cafe', 'restaurant', 'burger-joint'], use: 'shop' },
  flat: { models: ['block-4floor-front', 'block-4floor-short', 'block-4floor-corner', 'block-5floor', 'block-5floor-front', 'block-5floor-short'], use: 'flat' },
  office: { models: ['office', 'office-big', 'office-rounded', 'office-tall', 'office-pyramid'], use: 'office' },
  industry: { models: ['industry-warehouse', 'industry-building'], use: 'industry' },
};
// The map's places -> their own building.
const PLACE_MODEL: Record<string, PackModel> = {
  bank: 'bank', bureau_de_change: 'bank',
  hospital: 'hospital', clinic: 'hospital',
  school: 'school', college: 'school', university: 'school', kindergarten: 'school',
  police: 'policestation', fire_station: 'firestation',
  hotel: 'hotel', guest_house: 'hotel',
  cinema: 'cinema', theatre: 'cinema',
  post_office: 'post',
  mall: 'mall', supermarket: 'mall', department_store: 'mall', marketplace: 'mall',
  restaurant: 'restaurant', fast_food: 'burger-joint', cafe: 'cafe', bakery: 'cafe', food_court: 'restaurant',
  mosque: 'mosque',
};
// The wealthy areas (lon west, lon east, lat south, lat north): modern luxury houses.
const LUXURY: [number, number, number, number][] = [
  [-0.172, -0.125, 5.615, 5.668], // East Legon
  [-0.188, -0.163, 5.594, 5.616], // Airport Residential
  [-0.183, -0.158, 5.574, 5.594], // Cantonments
  [-0.172, -0.152, 5.558, 5.576], // Labone
  [-0.206, -0.19, 5.588, 5.602], // Roman Ridge
  [-0.122, -0.095, 5.64, 5.662], // Trasacco
];
export const isLuxuryArea = (lng: number, lat: number) => LUXURY.some(([w, e, s, n]) => lng > w && lng < e && lat > s && lat < n);

const hash = (n: number) => {
  let x = Math.imul(n ^ 0x2545f491, 0x9e3779b1);
  x = Math.imul(x ^ (x >>> 15), 0x85ebca77);
  return ((x ^ (x >>> 13)) >>> 0) / 4294967296;
};

/** A building swapped for a pack one: where, which way its front faces, its stretch and model. */
export type Pick = { id: number; x: number; z: number; model: PackModel; turn: number; sx: number; sy: number; sz: number; use: Use; address: number };

/**
 * The pack building for one map building: its outline (local metres), height from the map (or null),
 * the place in it (map kind) if any, which way its nearest road is (unit vector from its middle, or
 * null), whether it is on a main road, and whether it is in a wealthy area. None: keep the plain block.
 */
export function choosePack(id: number, ring: [number, number][], height: number | null, place: string | null, road: [number, number] | null, mainRoad: boolean, luxury: boolean): Pick[] {
  // Its best-fitting rectangle (turned to each of its own sides in turn, the smallest).
  let best: { a: number; w: number; d: number; cx: number; cz: number } | null = null;
  for (let i = 0; i < ring.length; i++) {
    const [x1, z1] = ring[i];
    const [x2, z2] = ring[(i + 1) % ring.length];
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 1) continue;
    const ux = (x2 - x1) / len, uz = (z2 - z1) / len;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, z] of ring) {
      const u = x * ux + z * uz, v = -x * uz + z * ux;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.w * best.d) {
      const um = (u0 + u1) / 2, vm = (v0 + v1) / 2;
      best = { a: Math.atan2(uz, ux), w: u1 - u0, d: v1 - v0, cx: um * ux - vm * uz, cz: um * uz + vm * ux };
    }
  }
  if (!best) return [];
  const A = best.w * best.d;
  if (A < 22) return []; // a shed or a kiosk: the plain block
  // The sides: u (along the angle) and v (across). The front is the side facing the road.
  const U = [Math.cos(best.a), Math.sin(best.a)];
  const V = [-Math.sin(best.a), Math.cos(best.a)];
  const dirs: [number, number, number, number][] = [
    [V[0], V[1], best.w, best.d], [-V[0], -V[1], best.w, best.d], // front along v: width w, depth d
    [U[0], U[1], best.d, best.w], [-U[0], -U[1], best.d, best.w],
  ];
  let front = dirs[0];
  if (road) {
    let bestDot = -Infinity;
    for (const d of dirs) {
      const dot = d[0] * road[0] + d[1] * road[1];
      if (dot > bestDot) [bestDot, front] = [dot, d];
    }
  } else if (best.w < best.d) front = dirs[2]; // (no road known: the long side to the front)
  const [fx, fz, W, D] = front;
  const H = height ?? 0;
  // Which kind of building.
  let models: PackModel[];
  let use: Use;
  const own = place ? PLACE_MODEL[place] : undefined;
  if (own && A > 60) [models, use] = [[own], own === 'restaurant' || own === 'cafe' || own === 'burger-joint' ? 'shop' : 'place'];
  else if (H >= 30) [models, use] = [GROUPS.office.models, 'office'];
  else if (H >= 11 || (A > 260 && mainRoad && !luxury)) [models, use] = [GROUPS.flat.models, 'flat'];
  else if (luxury && A > 70) [models, use] = [GROUPS.luxury.models, 'luxury'];
  else if (A > 420) [models, use] = [GROUPS.industry.models, 'industry'];
  else if (mainRoad && A > 90 && hash(id * 3 + 1) < 0.3) [models, use] = [GROUPS.shop.models, 'shop'];
  else if (A < 80) [models, use] = [GROUPS.small.models, 'house'];
  else [models, use] = [GROUPS.house.models, 'house'];
  // Fill the outline: one pack building, or a row (or rows) of them side by side when the outline is
  // longer or deeper than any one of them (a terrace, a row of shops), each the best fit for its part.
  const typical = MODELS[models[0]];
  const kx = own ? 1 : Math.max(1, Math.min(4, Math.round(W / typical[0])));
  const kz = own ? 1 : Math.max(1, Math.min(2, Math.round(D / typical[2])));
  const w = W / kx, d = D / kz;
  // The outline's own axes: across the front (right) and towards the front.
  const rx = fz, rz = -fx; // (right of the front, seen from the road)
  const turn = Math.atan2(fx, fz); // the model's front (+z) turned to face the road
  const c = Math.cos(turn), sn = Math.sin(turn);
  const out: Pick[] = [];
  for (let ix = 0; ix < kx; ix++)
    for (let iz = 0; iz < kz; iz++) {
      const k = ix * kz + iz;
      let pick: PackModel | null = null;
      let score = Infinity;
      for (const m of models) {
        const [mw, , md] = MODELS[m];
        const sc = Math.abs(Math.log(w / mw)) + Math.abs(Math.log(d / md)) + hash(id * 7 + k * 13 + m.length) * 0.3;
        if (sc < score) [score, pick] = [sc, m];
      }
      if (!pick) return [];
      const [mw, , md, mx, mz] = MODELS[pick];
      const fitX = w / mw, fitZ = d / md;
      // Too far from the outline (an odd shape): the plain block stays.
      if (fitX < 0.62 || fitX > 1.6 || fitZ < 0.62 || fitZ > 1.6) return [];
      const sx = Math.min(1.35, Math.max(0.75, fitX)), sz = Math.min(1.35, Math.max(0.75, fitZ));
      const sy = Math.max(0.8, Math.min(1.3, Math.sqrt(sx * sz))) * (kx * kz > 1 ? 0.9 + 0.2 * hash(id + k * 5) : 1);
      // The middle of this part of the outline.
      const along = (ix + 0.5) * w - W / 2;
      const back = (iz + 0.5) * d - D / 2; // (towards the front: +)
      const px = best.cx + rx * along + fx * back, pz = best.cz + rz * along + fz * back;
      const ox = mx * sx, oz = mz * sz;
      out.push({ id: id * 8 + k, x: px - (ox * c + oz * sn), z: pz - (-ox * sn + oz * c), model: pick, turn, sx, sy, sz, use, address: ((id * 8 + k) >>> 0) % 1000000 });
    }
  return out;
}

// The modern houses as Accra's white villas: the pack paints their walls near black (#292929) and dark
// grey (#3f3c3c); here those walls become white and pale grey (the dark windows, the wood and the roofs
// stay). Atlas cells: white and pale grey (the pack's pavement colour).
const REPAINT: Partial<Record<PackModel, [string, [number, number]][]>> = {};
for (const m of ['house-modern', 'house-modern-big'] as PackModel[]) REPAINT[m] = [['292929', [0.8241, 0.6677]], ['3f3c3c', [0.5666, 0.6348]]];
let atlasPx: Promise<{ w: number; h: number; data: Uint8ClampedArray } | null> | null = null;
function atlasPixels() {
  atlasPx ??= (async () => {
    try {
      const img = new Image();
      img.src = '/models/epic/tex/albedo.png';
      await img.decode();
      const c = document.createElement('canvas');
      [c.width, c.height] = [img.width, img.height];
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
    } catch {
      return null;
    }
  })();
  return atlasPx;
}
async function packGeometry(model: PackModel) {
  const g = await epicGeometry(fileOf(model));
  const rules = REPAINT[model];
  if (!rules) return g;
  const px = await atlasPixels();
  if (!px) return g;
  const out = g.clone();
  const uv = out.getAttribute('uv') as THREE.BufferAttribute;
  const nor = out.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    if (nor.getY(i) > 0.7) continue; // (roofs stay)
    const x = Math.min(px.w - 1, Math.floor((((uv.getX(i) % 1) + 1) % 1) * px.w));
    const y = Math.min(px.h - 1, Math.floor((1 - (((uv.getY(i) % 1) + 1) % 1)) * px.h));
    const k = (y * px.w + x) * 4;
    const hex = ((px.data[k] << 16) | (px.data[k + 1] << 8) | px.data[k + 2]).toString(16).padStart(6, '0');
    const to = rules.find(([from]) => from === hex)?.[1];
    if (to) uv.setXY(i, to[0], to[1]);
  }
  uv.needsUpdate = true;
  return out;
}

type Batch = { mesh: THREE.InstancedMesh | null; n: number; loading: boolean };

/** Draws the pack buildings near the player (one draw per model). */
export class PackBuildings {
  readonly group = new THREE.Group();
  private batches = new Map<PackModel, Batch>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private pos = new THREE.Vector3();
  private scl = new THREE.Vector3();
  /** Drawn last time, and their triangles (for the budget). */
  stats = { drawn: 0, triangles: 0 };

  constructor(private capacity: number) {}

  private batch(model: PackModel) {
    let b = this.batches.get(model);
    if (!b) {
      b = { mesh: null, n: 0, loading: true };
      this.batches.set(model, b);
      const bb = b;
      void packGeometry(model).then((g) => {
        const mesh = new THREE.InstancedMesh(g, epicMaterial(), this.capacity);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(mesh);
        bb.mesh = mesh;
        bb.loading = false;
      }, () => (bb.loading = false));
    }
    return b;
  }
  /** Whether this model is ready to draw (it starts downloading the first time it is asked for). */
  ready(model: PackModel) {
    return !!this.batch(model).mesh;
  }
  begin() {
    for (const b of this.batches.values()) b.n = 0;
    this.stats = { drawn: 0, triangles: 0 };
  }
  place(p: Pick) {
    const b = this.batch(p.model);
    if (!b.mesh || b.n >= this.capacity) return false;
    this.q.setFromAxisAngle(this.up, p.turn);
    this.m.compose(this.pos.set(p.x, 0, p.z), this.q, this.scl.set(p.sx, p.sy, p.sz));
    b.mesh.setMatrixAt(b.n++, this.m);
    this.stats.drawn++;
    this.stats.triangles += MODELS[p.model][5];
    return true;
  }
  end() {
    for (const b of this.batches.values()) {
      if (!b.mesh) continue;
      b.mesh.count = b.n;
      b.mesh.visible = b.n > 0;
      b.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

/**
 * Uncle Kwame's family house (6c): the pack's big modern house painted white, made to stand on an
 * outline (its own frame: u across, v towards its front; from u0 to u1 and v0 to v1).
 */
export async function villaMesh(o: { u0: number; u1: number; v0: number; v1: number }) {
  const g = await packGeometry('house-modern-big');
  const [mw, , md, mx, mz] = MODELS['house-modern-big'];
  const sx = (o.u1 - o.u0) / mw, sz = (o.v1 - o.v0) / md;
  const mesh = new THREE.Mesh(g, epicMaterial());
  mesh.scale.set(sx, Math.min(1, Math.sqrt(sx * sz) * 1.08), sz);
  mesh.position.set((o.u0 + o.u1) / 2 - mx * sx, 0, (o.v0 + o.v1) / 2 - mz * sz);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

/** A house of the given model standing with its middle at (cx, cz), its front facing `turn` (as Pick.turn). */
export function housePick(model: PackModel, cx: number, cz: number, turn: number, scale: number, id: number, use: Use = 'house') {
  const [mw, mh, md, mx, mz] = MODELS[model];
  const c = Math.cos(turn), sn = Math.sin(turn);
  const ox = mx * scale, oz = mz * scale;
  const pick: Pick = { id, x: cx - (ox * c + oz * sn), z: cz - (-ox * sn + oz * c), model, turn, sx: scale, sy: scale, sz: scale, use, address: id % 1000000 };
  return { pick, cx, cz, hw: (mw * scale) / 2, hd: (md * scale) / 2, height: mh * scale };
}
/** The houses that line a quiet street (6c). */
export const STREET_HOUSES: PackModel[] = ['house-family-small', 'house-block-big', 'house-family-large', 'house-block', 'house-family-small', 'house-block-old'];
export const modelSize = (m: PackModel) => ({ w: MODELS[m][0], d: MODELS[m][2] });
