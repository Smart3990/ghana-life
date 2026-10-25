// Street-level traffic in real 3D: cars, Accra taxis, trotros and pragya tricycles, built in code from
// simple shapes (nothing to download). Each kind is two batched draws (painted body, and everything
// else in fixed colours), plus one shared batch of soft shadows, so 100 vehicles still cost about
// ten draw calls. Positions come from the shared traffic clock (traffic.ts), the same on every phone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Kind, Placed, Traffic } from './traffic';
import { slidingAdMaterial } from './adScreens';

// Modern vehicles (public/models/vehicles): small models of today's Accra traffic (Corolla-size
// sedans, Vitz-size hatchbacks, RAV4-size SUVs, Hilux-size pickups, Hiace-size trotros, buses and
// trucks) from the free Low Poly Vehicles Pack by Rgsdev (CC0), sized to real cars by
// scripts/vehicles. Each file has a "paint" part (repainted per vehicle) and a "fixed" part (glass,
// lights, tyres). Until they have downloaded, the shapes built in code below are shown.
// Batches: each kind, plus a second car model so the streets mix sedans and hatchbacks.
export type BatchKey = Kind | 'hatch' | 'motorking' | 'sprinter';
const MODERN: Partial<Record<BatchKey, string>> = {
  // Our own models shaped after the real vehicles at Circle (scripts/vehicles/build_ghana.py).
  car: 'saloon', // Corolla-type saloon
  taxi: 'saloon', // ... as an Accra taxi
  hatch: 'smallcar', // Picanto / Vitz-type small car
  suv: 'suv', // RAV4-size SUV (Rgsdev pack)
  pickup: 'pickup4x4', // Hilux-type double cab
  trotro: 'trotro', // Hiace-type trotro
  sprinter: 'sprinter', // Sprinter-type trotro
  bus: 'citybus', // Metro-type city bus
  truck: 'cargotruck', // Tata-type cargo truck
};

// Quantized model files store small whole numbers; turn them into ordinary metres.
function toFloat(g: THREE.BufferGeometry, m: THREE.Matrix4) {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const a = g.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const size = name === 'color' ? 3 : a.itemSize; // colours: red, green, blue (no alpha)
    const f = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) f[i * size + c] = a.getComponent(i, c);
    out.setAttribute(name, new THREE.BufferAttribute(f, size));
  }
  if (g.index) out.setIndex(Array.from(g.index.array as ArrayLike<number>));
  out.applyMatrix4(m);
  if (out.getAttribute('normal')) out.normalizeNormals();
  if (!out.getAttribute('color')) paint(out, '#ffffff');
  out.computeBoundingSphere();
  return out;
}

// Accra paint jobs, drawn by the paint itself from the height and length of each point:
//  - taxis: the body colour with orange-yellow front and back corners (below the bonnet line);
//  - trotros: white on top, a yellow stripe, and the lower body in the vehicle's colour (white or blue);
//  - buses: the body colour (mostly Metro yellow) with a blue and red stripe along the side.
function livery(base: THREE.MeshStandardMaterial, kind: 'taxi' | 'trotro' | 'sprinter' | 'bus') {
  const m = base.clone();
  const rule = {
    taxi: 'if (abs(vLocal.z) > 1.35 && vLocal.y < 0.88) diffuseColor.rgb = vec3(0.9, 0.55, 0.07);',
    trotro: 'if (vLocal.y > 1.0) diffuseColor.rgb = vec3(0.93, 0.92, 0.88); else if (vLocal.y > 0.86) diffuseColor.rgb = vec3(0.9, 0.68, 0.1);',
    sprinter: 'if (vLocal.y > 1.15) diffuseColor.rgb = vec3(0.93, 0.92, 0.88); else if (vLocal.y > 0.98) diffuseColor.rgb = vec3(0.9, 0.68, 0.1);',
    bus: 'if (vLocal.y > 1.0 && vLocal.y < 1.12) diffuseColor.rgb = vec3(0.12, 0.33, 0.66); else if (vLocal.y >= 1.12 && vLocal.y < 1.22) diffuseColor.rgb = vec3(0.75, 0.15, 0.12);',
  }[kind];
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLocal;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + rule);
  };
  m.customProgramCacheKey = () => 'livery-' + kind;
  return m;
}

// Extras on top of some vehicles: the taxi's yellow roof sign, and a pickup loaded high with crates.
function extras(key: BatchKey, paint: THREE.BufferGeometry): THREE.BufferGeometry[] {
  paint.computeBoundingBox();
  const top = paint.boundingBox!.max.y;
  if (key === 'taxi') return [paintPart(box(0.55, 0.16, 0.26, 0, top + 0.06, -0.15), '#f2c21a')];
  if (key === 'pickup') {
    const crates: THREE.BufferGeometry[] = [];
    for (let layer = 0; layer < 3; layer++)
      for (let row = 0; row < 3; row++)
        for (const x of [-0.42, 0.42]) {
          if (layer === 2 && row === 0) continue;
          const shade = ['#8a6238', '#7a5531', '#94693c'][(layer + row) % 3];
          crates.push(paintPart(box(0.78, 0.5, 0.6, x, 1.32 + layer * 0.52, -1.0 - row * 0.62), shade));
        }
    return crates;
  }
  return [];
}
const paintPart = (g: THREE.BufferGeometry, colour: string) => paint(g, colour);

// ---------- Adverts on vehicles (design brief 18.1: moving ads on trotros, buses and trucks) ----------
// One picture holds all the adverts, one per row; each vehicle shows the row its number picks.
// Placeholder brands only (the game's own), until real advertisers buy the space.
export const AD_ROWS = 8;
export type VehicleAd = { title: string; line: string; bg: [string, string]; accent: string; ink?: string };
// Placeholder adverts (the game's own brands). Advertisers' own adverts come from /data/ads.json
// (the same fields), so new ones can be added without changing the game.
const DEFAULT_ADS: VehicleAd[] = [
  { title: 'SIKA MOBILE MONEY', line: 'Send money home in seconds', bg: ['#0f6b3a', '#1c9b57'], accent: '#f2c21a' },
  { title: 'GHANAVERSE FM 98.5', line: 'The sound of the city, all day', bg: ['#4a1d6e', '#7a3fb0'], accent: '#ffd25a' },
  { title: 'YOUR AD HERE', line: 'Ride the whole city · ₵250 a week', bg: ['#f2efe6', '#e3dccb'], accent: '#c8442e', ink: '#121a14' },
  { title: 'KELEWELE AT CIRCLE', line: 'Hot and spicy every evening', bg: ['#c2410c', '#f08a24'], accent: '#fff3c4' },
  { title: 'COOL SACHET WATER', line: 'Clean, cold, everywhere', bg: ['#0b4f8a', '#2a86d1'], accent: '#ffffff' },
  { title: 'GHANAVERSE NEWS', line: 'Tonight at 8 on every big screen', bg: ['#8e1b1b', '#c8442e'], accent: '#ffffff' },
  { title: 'TONIGHT IN GHANAVERSE', line: 'Highlife night at Osu · free entry', bg: ['#1f4f8a', '#121a14'], accent: '#e3a92b' },
  { title: 'PHONES & CHARGERS', line: 'Best prices at Circle, come and see', bg: ['#121a14', '#3a3d42'], accent: '#2dd4bf' },
];
function adAtlas(ads: VehicleAd[], canvas = document.createElement('canvas')) {
  const c = canvas;
  c.width = 1024;
  c.height = 256 * AD_ROWS;
  const g = c.getContext('2d')!;
  const kente = ['#e3a92b', '#121a14', '#c8442e', '#121a14', '#2f8f57', '#121a14', '#1f5fa8', '#121a14'];
  for (let r = 0; r < AD_ROWS; r++) {
    const a = ads[r % ads.length];
    const ink = a.ink ?? '#ffffff';
    const y = (AD_ROWS - 1 - r) * 256;
    const grad = g.createLinearGradient(0, y, 1024, y + 256);
    grad.addColorStop(0, a.bg[0]);
    grad.addColorStop(1, a.bg[1]);
    g.fillStyle = grad;
    g.fillRect(0, y, 1024, 256);
    for (let x = 0, i = 0; x < 1024; x += 24, i++) {
      g.fillStyle = kente[i % kente.length];
      g.fillRect(x, y + 232, 24, 24);
    }
    g.fillStyle = a.accent;
    g.beginPath();
    g.arc(930, y + 110, 70, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = ink;
    g.font = '900 86px system-ui, sans-serif';
    g.fillText(a.title, 34, y + 118, 820);
    g.fillStyle = ink === '#121a14' ? '#c8442e' : a.accent;
    g.font = '700 44px system-ui, sans-serif';
    g.fillText(a.line, 38, y + 190, 820);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Where the advert panels go on each commercial vehicle, in the vehicle's own metres (front is +z):
// [half width, bottom, top, back end, front end].
// Full wraps, as on Accra's buses and trotros: from just above the wheels up over the windows to
// the roof line, from behind the driver's door to the back.
const AD_PANELS: Partial<Record<BatchKey, [number, number, number, number, number, number]>> = {
  // [half width, bottom, top, back end, front end, the back face's position]
  trotro: [0.885, 0.7, 2.02, -2.42, 1.35, -2.52],
  sprinter: [0.985, 0.76, 2.45, -2.9, 1.5, -3.02],
  bus: [1.262, 1.0, 2.92, -5.25, 3.55, -5.43], // stops before the front door
  truck: [1.165, 1.1, 2.6, -3.7, 1.85, -3.83],
};
function adPanels([hw, y0, y1, z0, z1, zb]: [number, number, number, number, number, number]) {
  // Two flat panels, one on each side, each reading the right way round from outside.
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  for (const side of [1, -1]) {
    const x = side * (hw + 0.012);
    // Corners: back-bottom, front-bottom, front-top, back-top.
    const quad = [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]];
    // Reads left to right from outside on both sides (the right side reads front to back).
    const u = side > 0 ? [1, 0, 0, 1] : [0, 1, 1, 0];
    const order = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (const k of order) {
      pos.push(...quad[k]);
      uv.push(u[k], k >= 2 ? 1 : 0);
      nor.push(side, 0, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
const AD_TIME = { value: 0 };
function adMaterial(map: THREE.Texture) {
  // The same sliding change as the billboards (the next advert slides in every 8 seconds).
  const sliding = slidingAdMaterial(map, AD_ROWS, 8) as THREE.MeshStandardMaterial;
  sliding.polygonOffset = true;
  sliding.polygonOffsetFactor = -2;
  sliding.side = THREE.FrontSide;
  return sliding;
}
export function oldAdMaterial(map: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  // The wrap changes advert every 8 seconds (each vehicle at its own moment), like a moving screen.
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = AD_TIME;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAd;\nuniform float uTime;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nfloat row = mod(aAd + floor((uTime + aAd * 2.7) / 8.0), ' + AD_ROWS.toFixed(1) + ');\nvMapUv.y = (vMapUv.y + row) / ' + AD_ROWS.toFixed(1) + ';');
  };
  m.customProgramCacheKey = () => 'vehicle-ad';
  return m;
}

// The taxi's roof sign: "TAXI" on its front and back.
function taxiSignTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 72;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f2c21a';
  g.fillRect(0, 0, 256, 72);
  g.fillStyle = '#121a14';
  g.font = '900 56px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('TAXI', 128, 56);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Part = THREE.BufferGeometry;

// ---------- Shape helpers (length runs along +z = forward, y is up, x is across) ----------

// A side profile [along, up] pushed out to a width, centred across the vehicle.
function profile(points: [number, number][], width: number, bevel = 0.04): Part {
  const shape = new THREE.Shape(points.map(([a, u]) => new THREE.Vector2(a, u)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  });
  g.rotateY(-Math.PI / 2); // along → z, width → x
  g.translate(width / 2 - bevel, 0, 0);
  return g;
}

export function box(w: number, h: number, l: number, x: number, y: number, z: number, tiltX = 0): Part {
  const g = new THREE.BoxGeometry(w, h, l);
  if (tiltX) g.rotateX(tiltX);
  g.translate(x, y, z);
  return g;
}

function wheel(radius: number, width: number, x: number, z: number): Part[] {
  const tyre = new THREE.CylinderGeometry(radius, radius, width, 14);
  tyre.rotateZ(Math.PI / 2);
  tyre.translate(x, radius, z);
  const hub = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width + 0.02, 10);
  hub.rotateZ(Math.PI / 2);
  hub.translate(x, radius, z);
  return [paint(tyre, '#161616'), paint(hub, '#9ea3a8')];
}

export function paint(g: Part, colour: string): Part {
  const c = new THREE.Color(colour);
  const n = g.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(data, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return g;
}

// Merge parts into one geometry (positions, normals and colours only).
export function merge(parts: Part[]): Part {
  const clean = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.getAttribute('color')) paint(g, '#ffffff');
    return g;
  });
  const merged = mergeGeometries(clean, false)!;
  merged.computeBoundingSphere();
  return merged;
}

// Vehicle lengths (metres), for keeping a gap.
const KIND_LENGTH: Record<Kind, number> = { car: 4.5, taxi: 4.5, trotro: 5.7, tricycle: 3, okada: 2, bus: 11, truck: 8, pickup: 5.2, suv: 4.8 };

// Widths (metres), for crossings and for not walking through vehicles.
const KIND_WIDTH: Record<Kind, number> = { car: 1.8, taxi: 1.8, trotro: 2.0, tricycle: 1.4, okada: 0.8, bus: 2.5, truck: 2.4, pickup: 1.9, suv: 1.9 };

export type VehicleBox = { x: number; z: number; fx: number; fz: number; half: number; halfW: number };

const GLASS = '#1c252d';
const TRIM = '#2a2b2d';
const HEAD = '#fff4cf';
const TAIL = '#b3121b';

// ---------- The vehicles ----------

type Model = { body: Part; fixed: Part; shadow: [number, number] }; // shadow: width, length

function car(taxi: boolean): Model {
  const W = 1.76;
  const body = merge([
    profile([[-2.2, 0.3], [-2.24, 0.62], [-2.1, 0.9], [-1.45, 0.99], [1.15, 0.99], [2.05, 0.83], [2.24, 0.6], [2.2, 0.3]], W),
    profile([[-0.8, 1.37], [-0.74, 1.45], [0.44, 1.45], [0.5, 1.37]], W - 0.12, 0.02), // roof
  ]);
  const fixed: Part[] = [
    paint(profile([[-1.42, 0.98], [-0.78, 1.39], [0.47, 1.39], [1.12, 0.98]], W - 0.1, 0.02), GLASS),
    paint(box(W + 0.02, 0.18, 0.12, 0, 0.36, 2.22), TRIM), // bumpers
    paint(box(W + 0.02, 0.18, 0.12, 0, 0.36, -2.22), TRIM),
    paint(box(0.34, 0.1, 0.06, 0.6, 0.68, 2.24), HEAD),
    paint(box(0.34, 0.1, 0.06, -0.6, 0.68, 2.24), HEAD),
    paint(box(0.3, 0.1, 0.06, 0.62, 0.74, -2.2), TAIL),
    paint(box(0.3, 0.1, 0.06, -0.62, 0.74, -2.2), TAIL),
    paint(box(0.6, 0.12, 0.05, 0, 0.55, 2.25), TRIM), // grille
    ...wheel(0.32, 0.22, 0.78, 1.35),
    ...wheel(0.32, 0.22, -0.78, 1.35),
    ...wheel(0.32, 0.22, 0.78, -1.35),
    ...wheel(0.32, 0.22, -0.78, -1.35),
  ];
  if (taxi) {
    // Accra taxi: red band along the sides and a roof sign.
    fixed.push(paint(box(W + 0.03, 0.14, 3.9, 0, 0.7, 0), '#c8102e'));
    fixed.push(paint(box(0.62, 0.17, 0.26, 0, 1.53, -0.1), '#f4f1e6'));
  }
  return { body, fixed: merge(fixed), shadow: [2.1, 4.8] };
}

function trotro(): Model {
  const W = 2.0;
  const body = merge([
    profile([[-2.8, 0.36], [-2.82, 2.22], [-2.72, 2.32], [1.55, 2.32], [2.32, 1.48], [2.76, 1.18], [2.8, 0.36]], W, 0.05),
  ]);
  const slope = Math.atan2(2.32 - 1.48, 2.32 - 1.55);
  const fixed: Part[] = [
    paint(box(W + 0.03, 0.66, 4.2, 0, 1.7, -0.62), GLASS), // side windows
    paint(box(W - 0.2, 0.05, 1.12, 0, 1.92, 1.97, -(Math.PI / 2 - slope) - Math.PI / 2), GLASS), // windscreen
    paint(box(1.5, 0.6, 0.05, 0, 1.72, -2.84), GLASS), // rear window
    paint(box(W + 0.03, 0.06, 5.3, 0, 1.3, 0), '#2f8f57'), // a coloured stripe, like many trotros
    paint(box(W + 0.02, 0.22, 0.14, 0, 0.45, 2.8), TRIM),
    paint(box(W + 0.02, 0.22, 0.14, 0, 0.45, -2.84), TRIM),
    paint(box(0.32, 0.14, 0.06, 0.7, 0.85, 2.79), HEAD),
    paint(box(0.32, 0.14, 0.06, -0.7, 0.85, 2.79), HEAD),
    paint(box(0.16, 0.34, 0.06, 0.88, 0.85, -2.84), TAIL),
    paint(box(0.16, 0.34, 0.06, -0.88, 0.85, -2.84), TAIL),
    // Roof rack
    paint(box(1.7, 0.05, 3.6, 0, 2.46, -0.6), '#3a3b3d'),
    paint(box(0.05, 0.12, 3.6, 0.82, 2.4, -0.6), '#3a3b3d'),
    paint(box(0.05, 0.12, 3.6, -0.82, 2.4, -0.6), '#3a3b3d'),
    ...wheel(0.36, 0.24, 0.86, 1.85),
    ...wheel(0.36, 0.24, -0.86, 1.85),
    ...wheel(0.36, 0.24, 0.86, -1.85),
    ...wheel(0.36, 0.24, -0.86, -1.85),
  ];
  return { body, fixed: merge(fixed), shadow: [2.4, 6.2] };
}

function motorKing(): Model {
  // Cargo tricycle ("motor king" / aboboyaa): a motorbike front pulling a painted steel cargo box,
  // loaded high with sacks and crates, a rider in front.
  const body = merge([
    box(1.4, 0.08, 1.9, 0, 0.62, -0.75), // cargo floor
    box(0.06, 0.55, 1.9, 0.7, 0.9, -0.75), // sides
    box(0.06, 0.55, 1.9, -0.7, 0.9, -0.75),
    box(1.4, 0.55, 0.06, 0, 0.9, -1.7), // tailgate
    box(1.4, 0.75, 0.06, 0, 1.0, 0.2), // front board
    box(0.3, 0.32, 0.6, 0, 0.62, 0.65), // tank and engine cover
  ]);
  const skin = '#4e3322';
  const sack = (x: number, y: number, z: number, c: string) => paint(new THREE.SphereGeometry(0.36, 8, 6).scale(1, 0.62, 1.15).translate(x, y, z), c);
  const fixed: Part[] = [
    sack(-0.34, 1.05, -0.4, '#c9b48a'), sack(0.34, 1.05, -0.4, '#bba57c'), sack(-0.34, 1.05, -1.2, '#c4ae84'), sack(0.34, 1.05, -1.2, '#d1bd94'),
    sack(0, 1.48, -0.8, '#bfa97f'), sack(-0.3, 1.45, -1.35, '#2f6b3f'),
    paint(box(0.5, 0.4, 0.45, 0.35, 1.5, -1.35), '#3a5fa8'), // a blue crate on top
    paint(box(0.3, 0.1, 0.5, 0, 0.88, 0.62), '#1f1f1f'), // seat
    paint(box(0.7, 0.04, 0.04, 0, 1.18, 1.0), TRIM), // handlebar
    paint(box(0.05, 0.6, 0.05, 0, 0.85, 1.02), TRIM), // fork
    paint(box(0.14, 0.12, 0.08, 0, 1.0, 1.08), HEAD),
    // The rider
    paint(box(0.36, 0.5, 0.26, 0, 1.2, 0.6), '#7a7f86'),
    paint(new THREE.SphereGeometry(0.12, 10, 8).translate(0, 1.58, 0.62), skin),
    paint(box(0.12, 0.42, 0.12, 0.13, 0.78, 0.8), '#3b5f8a'),
    paint(box(0.12, 0.42, 0.12, -0.13, 0.78, 0.8), '#3b5f8a'),
    ...wheel(0.27, 0.12, 0, 1.05),
    ...wheel(0.27, 0.16, 0.62, -1.0),
    ...wheel(0.27, 0.16, -0.62, -1.0),
  ];
  return { body, fixed: merge(fixed), shadow: [1.7, 3.2] };
}

function pragya(): Model {
  // Passenger tricycle: painted canopy and side panels, a driver in front.
  const body = merge([
    box(1.3, 0.06, 2.0, 0, 1.78, -0.25), // canopy roof
    box(1.24, 0.42, 1.25, 0, 0.72, -0.7), // passenger tub
    box(0.32, 0.36, 0.55, 0, 0.62, 0.65), // front body
  ]);
  const skin = '#5a3a26';
  const fixed: Part[] = [
    paint(box(0.05, 1.1, 0.05, 0.6, 1.22, -1.2), TRIM), // canopy posts
    paint(box(0.05, 1.1, 0.05, -0.6, 1.22, -1.2), TRIM),
    paint(box(0.05, 1.0, 0.05, 0.55, 1.27, 0.7), TRIM),
    paint(box(0.05, 1.0, 0.05, -0.55, 1.27, 0.7), TRIM),
    paint(box(1.16, 0.12, 0.9, 0, 0.98, -0.75), '#1f1f1f'), // bench
    paint(box(0.3, 0.1, 0.5, 0, 0.88, 0.25), '#1f1f1f'), // driver's seat
    paint(box(0.7, 0.04, 0.04, 0, 1.25, 0.85), TRIM), // handlebar
    paint(box(0.12, 0.1, 0.06, 0, 0.95, 0.95), HEAD),
    // The driver
    paint(box(0.36, 0.5, 0.26, 0, 1.2, 0.3), '#33506e'),
    paint(new THREE.SphereGeometry(0.12, 10, 8).translate(0, 1.58, 0.33), skin),
    paint(box(0.12, 0.42, 0.12, 0.13, 0.78, 0.5), '#2a2f38'),
    paint(box(0.12, 0.42, 0.12, -0.13, 0.78, 0.5), '#2a2f38'),
    ...wheel(0.25, 0.14, 0, 1.0),
    ...wheel(0.25, 0.14, 0.58, -0.8),
    ...wheel(0.25, 0.14, -0.58, -0.8),
  ];
  return { body, fixed: merge(fixed), shadow: [1.6, 3.0] };
}

// A rider in fixed colours (head, arms, legs); the painted part is their shirt.
function rider(shirtY: number, z: number): { shirt: Part; rest: Part[] } {
  const skin = '#4a2f20';
  return {
    shirt: box(0.42, 0.55, 0.28, 0, shirtY, z),
    rest: [
      paint(new THREE.SphereGeometry(0.13, 10, 8).translate(0, shirtY + 0.47, z + 0.03), skin),
      paint(box(0.11, 0.42, 0.11, 0.24, shirtY + 0.02, z + 0.22, -0.9), skin), // arms reaching to the handlebar
      paint(box(0.11, 0.42, 0.11, -0.24, shirtY + 0.02, z + 0.22, -0.9), skin),
      paint(box(0.15, 0.45, 0.15, 0.17, shirtY - 0.45, z + 0.18, -1.1), '#2a3446'), // thighs
      paint(box(0.15, 0.45, 0.15, -0.17, shirtY - 0.45, z + 0.18, -1.1), '#2a3446'),
      paint(box(0.13, 0.45, 0.13, 0.19, shirtY - 0.72, z + 0.42), '#2a3446'), // shins
      paint(box(0.13, 0.45, 0.13, -0.19, shirtY - 0.72, z + 0.42), '#2a3446'),
    ],
  };
}

function okada(): Model {
  const r = rider(1.25, -0.15);
  const body = merge([
    r.shirt,
    new THREE.CapsuleGeometry(0.14, 0.3, 4, 8).rotateX(Math.PI / 2 - 0.15).translate(0, 0.82, 0.28), // tank
  ]);
  const fixed: Part[] = [
    ...r.rest,
    paint(box(0.26, 0.09, 0.6, 0, 0.8, -0.25), '#1c1c1c'), // seat
    paint(box(0.24, 0.26, 0.34, 0, 0.42, 0.08), '#4a4d52'), // engine
    paint(box(0.06, 0.06, 0.75, 0.16, 0.36, -0.35), '#d6d9de'), // exhaust
    paint(box(0.05, 0.7, 0.05, 0, 0.75, 0.68, 0.3), '#d6d9de'), // fork
    paint(box(0.68, 0.03, 0.03, 0, 1.08, 0.58), '#1c1c1c'), // handlebar
    paint(box(0.13, 0.11, 0.06, 0, 0.98, 0.72), HEAD),
    paint(box(0.12, 0.07, 0.05, 0, 0.72, -0.62), TAIL),
    ...wheel(0.3, 0.1, 0, 0.66),
    ...wheel(0.3, 0.12, 0, -0.62),
  ];
  return { body, fixed: merge(fixed), shadow: [0.9, 2.2] };
}

function bus(): Model {
  const W = 2.5;
  const body = merge([profile([[-5.5, 0.4], [-5.5, 3.0], [-5.35, 3.1], [5.35, 3.1], [5.5, 2.9], [5.5, 0.4]], W, 0.06)]);
  const fixed: Part[] = [
    paint(box(W + 0.03, 1.0, 9.4, 0, 2.15, -0.4), GLASS),
    paint(box(W - 0.2, 1.3, 0.05, 0, 2.15, 5.52), GLASS),
    paint(box(W + 0.03, 0.12, 10.8, 0, 1.45, 0), '#2f8f57'),
    paint(box(W + 0.02, 0.3, 0.12, 0, 0.55, 5.52), TRIM),
    paint(box(0.4, 0.18, 0.05, 0.85, 0.95, 5.53), HEAD),
    paint(box(0.4, 0.18, 0.05, -0.85, 0.95, 5.53), HEAD),
    paint(box(0.2, 0.4, 0.05, 1.05, 1.0, -5.52), TAIL),
    paint(box(0.2, 0.4, 0.05, -1.05, 1.0, -5.52), TAIL),
    ...wheel(0.5, 0.3, 1.08, 3.6), ...wheel(0.5, 0.3, -1.08, 3.6),
    ...wheel(0.5, 0.3, 1.08, -3.4), ...wheel(0.5, 0.3, -1.08, -3.4),
  ];
  return { body, fixed: merge(fixed), shadow: [3.0, 12] };
}

function truck(): Model {
  // A cargo lorry: painted cab, wooden cargo body with plank sides.
  const W = 2.35;
  const body = merge([profile([[1.9, 0.6], [1.9, 2.75], [2.1, 2.85], [3.6, 2.85], [3.95, 2.0], [4.0, 0.6]], W, 0.05)]);
  const wood = '#8a5a35';
  const fixed: Part[] = [
    paint(box(W + 0.02, 0.8, 0.9, 0, 2.3, 3.45, -0.35), GLASS),
    paint(box(W + 0.04, 0.7, 1.0, 0, 2.25, 2.7), GLASS), // side windows
    paint(box(W, 0.18, 5.9, 0, 1.0, -1.15), '#3a3b3d'), // chassis
    paint(box(W, 1.3, 0.08, 0, 1.75, 1.75), wood),
    paint(box(W, 1.3, 0.08, 0, 1.75, -4.05), wood),
    paint(box(0.08, 1.3, 5.8, W / 2 - 0.04, 1.75, -1.15), wood),
    paint(box(0.08, 1.3, 5.8, -W / 2 + 0.04, 1.75, -1.15), wood),
    paint(box(W - 0.1, 0.06, 5.7, 0, 1.15, -1.15), '#6d4a2c'),
    paint(box(0.32, 0.16, 0.05, 0.8, 1.0, 4.01), HEAD),
    paint(box(0.32, 0.16, 0.05, -0.8, 1.0, 4.01), HEAD),
    ...wheel(0.48, 0.3, 1.0, 2.9), ...wheel(0.48, 0.3, -1.0, 2.9),
    ...wheel(0.48, 0.3, 1.0, -2.6), ...wheel(0.48, 0.3, -1.0, -2.6),
  ];
  return { body, fixed: merge(fixed), shadow: [2.8, 8.6] };
}

function pickup(): Model {
  const W = 1.85;
  const body = merge([
    profile([[-2.6, 0.45], [-2.6, 1.05], [0.15, 1.05], [0.25, 1.1], [1.4, 1.05], [2.45, 0.95], [2.6, 0.65], [2.6, 0.45]], W),
    profile([[-0.45, 1.68], [-0.4, 1.76], [0.78, 1.76], [0.85, 1.68]], W - 0.12, 0.02),
  ]);
  const fixed: Part[] = [
    paint(profile([[-0.5, 1.05], [-0.48, 1.7], [0.8, 1.7], [1.4, 1.05]], W - 0.1, 0.02), GLASS),
    paint(box(W - 0.2, 0.05, 2.3, 0, 0.98, -1.4), '#2a2b2d'), // the open bed
    paint(box(W + 0.02, 0.2, 0.12, 0, 0.5, 2.6), TRIM),
    paint(box(0.32, 0.12, 0.06, 0.62, 0.8, 2.62), HEAD),
    paint(box(0.32, 0.12, 0.06, -0.62, 0.8, 2.62), HEAD),
    paint(box(0.14, 0.3, 0.06, 0.82, 0.85, -2.62), TAIL),
    paint(box(0.14, 0.3, 0.06, -0.82, 0.85, -2.62), TAIL),
    ...wheel(0.38, 0.26, 0.8, 1.65), ...wheel(0.38, 0.26, -0.8, 1.65),
    ...wheel(0.38, 0.26, 0.8, -1.65), ...wheel(0.38, 0.26, -0.8, -1.65),
  ];
  return { body, fixed: merge(fixed), shadow: [2.2, 5.6] };
}

function suv(): Model {
  const W = 1.9;
  const body = merge([
    profile([[-2.4, 0.42], [-2.42, 1.2], [-2.3, 1.25], [1.3, 1.25], [2.3, 1.05], [2.42, 0.7], [2.4, 0.42]], W),
    profile([[-2.32, 1.72], [-2.26, 1.8], [0.62, 1.8], [0.7, 1.72]], W - 0.12, 0.02),
  ]);
  const fixed: Part[] = [
    paint(profile([[-2.32, 1.24], [-2.3, 1.74], [0.66, 1.74], [1.28, 1.24]], W - 0.1, 0.02), GLASS),
    paint(box(W + 0.02, 0.22, 0.12, 0, 0.5, 2.42), TRIM),
    paint(box(W + 0.02, 0.22, 0.12, 0, 0.5, -2.42), TRIM),
    paint(box(0.36, 0.12, 0.06, 0.62, 0.86, 2.43), HEAD),
    paint(box(0.36, 0.12, 0.06, -0.62, 0.86, 2.43), HEAD),
    paint(box(0.16, 0.3, 0.06, 0.82, 1.0, -2.43), TAIL),
    paint(box(0.16, 0.3, 0.06, -0.82, 1.0, -2.43), TAIL),
    paint(box(1.6, 0.05, 2.6, 0, 1.86, -0.8), '#2a2b2d'), // roof rails
    ...wheel(0.4, 0.26, 0.84, 1.5), ...wheel(0.4, 0.26, -0.84, 1.5),
    ...wheel(0.4, 0.26, 0.84, -1.5), ...wheel(0.4, 0.26, -0.84, -1.5),
  ];
  return { body, fixed: merge(fixed), shadow: [2.2, 5.2] };
}

// A soft round shadow, shared by every vehicle (one batch for all of them).
export function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.5)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- The batches ----------

export class StreetTraffic {
  readonly group = new THREE.Group();
  private batches: Record<BatchKey, { body: THREE.InstancedMesh; fixed: THREE.InstancedMesh; shadow: [number, number] }>;
  private shadows: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private shadowScale = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private c = new THREE.Color();

  constructor(
    private traffic: Traffic,
    private toLocal: (lon: number, lat: number) => [number, number],
    public limit: number,
    private radiusM: number,
  ) {
    const paintMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.25 });
    const fixedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
    const models: Record<BatchKey, Model> = { car: car(false), hatch: car(false), sprinter: trotro(), motorking: motorKing(), taxi: car(true), trotro: trotro(), tricycle: pragya(), okada: okada(), bus: bus(), truck: truck(), pickup: pickup(), suv: suv() };
    this.batches = {} as typeof this.batches;
    const adCanvas = this.adCanvas;
    const adMat = adMaterial(adAtlas(DEFAULT_ADS, adCanvas));
    // Advertisers' adverts, when there are any.
    fetch('/data/ads.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((list: VehicleAd[] | null) => {
        if (!Array.isArray(list) || !list.length) return;
        adMat.map = adAtlas([...list, ...DEFAULT_ADS].slice(0, AD_ROWS), adCanvas);
        adMat.needsUpdate = true;
      })
      .catch(() => undefined);
    // "TAXI" on the front and back of the roof sign.
    const signGeo = new THREE.BufferGeometry();
    {
      const pos: number[] = [];
      const uv: number[] = [];
      for (const side of [1, -1]) {
        const z = -0.15 + side * 0.135;
        const q = [[-0.26, 1.43, z], [0.26, 1.43, z], [0.26, 1.57, z], [-0.26, 1.57, z]];
        const u = side > 0 ? [0, 1, 1, 0] : [1, 0, 0, 1];
        const order = side > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const k of order) {
          pos.push(...q[k]);
          uv.push(u[k], k >= 2 ? 1 : 0);
        }
      }
      signGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      signGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    }
    this.taxiSigns = new THREE.InstancedMesh(signGeo, new THREE.MeshBasicMaterial({ map: taxiSignTexture() }), limit);
    this.taxiSigns.count = 0;
    this.taxiSigns.frustumCulled = false;
    this.group.add(this.taxiSigns);
    for (const [kind, model] of Object.entries(models) as [BatchKey, Model][]) {
      const look = kind === 'taxi' || kind === 'trotro' || kind === 'sprinter' || kind === 'bus' ? livery(paintMat, kind) : paintMat;
      const body = new THREE.InstancedMesh(model.body, look, limit);
      const fixed = new THREE.InstancedMesh(model.fixed, fixedMat, limit);
      for (const mesh of [body, fixed]) {
        mesh.count = 0;
        mesh.frustumCulled = false; // instances spread far beyond the shape's own bounds
        mesh.castShadow = true;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(mesh);
      }
      body.setColorAt(0, this.c.set('#ffffff'));
      this.batches[kind] = { body, fixed, shadow: model.shadow };
      const panel = AD_PANELS[kind];
      if (panel) {
        const geo = adPanels(panel);
        geo.setAttribute('aAd', new THREE.InstancedBufferAttribute(new Float32Array(limit), 1));
        const ads = new THREE.InstancedMesh(geo, adMat, limit);
        ads.count = 0;
        ads.frustumCulled = false;
        ads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.group.add(ads);
        this.ads[kind] = ads;
      }
    }
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(
      plane,
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
      limit,
    );
    this.shadows.count = 0;
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = -1;
    this.group.add(this.shadows);
    void this.loadModern();
  }

  private async loadModern() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const files = new Map<string, Promise<{ paint: THREE.BufferGeometry; fixed: THREE.BufferGeometry } | null>>();
    const load = (name: string) => {
      if (!files.has(name))
        files.set(name, loader.loadAsync(`/models/vehicles/${name}.glb`).then((g) => {
          g.scene.updateMatrixWorld(true);
          const parts: Record<string, THREE.BufferGeometry> = {};
          g.scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) parts[mesh.name.startsWith('paint') ? 'paint' : 'fixed'] = toFloat(mesh.geometry, mesh.matrixWorld);
          });
          return parts.paint && parts.fixed ? { paint: parts.paint, fixed: parts.fixed } : null;
        }, () => null));
      return files.get(name)!;
    };
    for (const [key, name] of Object.entries(MODERN) as [BatchKey, string][]) {
      const parts = await load(name);
      if (!parts) continue; // not downloaded: keep the shape built in code
      const b = this.batches[key];
      b.body.geometry = parts.paint;
      const more = extras(key, parts.paint);
      b.fixed.geometry = more.length ? merge([parts.fixed, ...more]) : parts.fixed;
    }
  }

  /** Puts the nearest vehicles in place for the moment t (seconds of shared time). */
  /** The vehicles drawn last frame (for tests). */
  placed: Placed[] = [];
  /** Where each drawn vehicle's body is (centre, facing, half length and half width), for collisions. */
  boxes: VehicleBox[] = [];

  // How far (metres) each vehicle near the player is held back behind its timetable: it stops for
  // the player and keeps its distance from the vehicle in front, then slowly catches up again.
  private held = new Map<number, number>();
  private blockedFor = new Map<number, number>();
  private stuck = new Map<number, number>();
  private lastPlaced = new Map<number, Placed>();
  private lastT = 0;
  /** Traffic lights: vehicles stop at the line on red (set by the street test). */
  signals: { shouldStop: (x: number, z: number, heading: number, half: number, t: number) => boolean } | null = null;
  private ads: Partial<Record<BatchKey, THREE.InstancedMesh>> = {};
  private taxiSigns!: THREE.InstancedMesh;
  /** The story's own vehicles (the car that blocks you in the chase, Uncle Kwame's car): moved by
   *  the story, drawn with the others, and solid. */
  story: { key: BatchKey; kind: Kind; id: number; x: number; z: number; heading: number; colour: string; shown: boolean; moving: boolean }[] = [];
  /** Vehicles parked for good (the trotro station): drawn with the others, and solid. */
  parked: { key: BatchKey; id: number; x: number; z: number; heading: number; colour: string }[] = [];
  /** Share of vehicles shown (1 = all), lowered when the phone struggles. */
  density = 1;
  /** The flyover deck's height at a point (set by the street test). */
  deckHeight: ((x: number, z: number) => number) | null = null;
  /** Called when a driver hoots at the player (x, z in metres). */
  onHoot: ((x: number, z: number) => void) | null = null;
  /** Called every frame for each vehicle stopped because the player stands in its way. */
  onBlocked: ((v: { id: number; x: number; z: number; heading: number; kind: string; halfW: number; half: number; waited: number }) => void) | null = null;
  /** Vehicles not drawn (the story has taken their place on the road). */
  hide = new Set<number>();
  private lane = 1.35;
  private adCanvas = document.createElement('canvas');
  /** Where a vehicle's route goes at a distance s (in the scene's metres), for driving along it. */
  routeAt(v: Placed['v'], s: number) {
    const p = this.traffic.at(v, s, this.lane);
    const [x, z] = this.toLocal(p.lon, p.lat);
    return { x, z, heading: p.heading, bridge: !!p.bridge };
  }
  /** What a vehicle is and which advert it carries (null: no advert space on it). */
  vehicleInfo(v: Placed['v']) {
    const key: BatchKey = v.kind === 'car' && v.id % 3 === 0 ? 'hatch' : v.kind === 'trotro' && v.id % 3 === 0 ? 'sprinter' : v.kind === 'tricycle' && v.id % 2 === 0 ? 'motorking' : v.kind;
    const r = ((v.id * 2246822519) >>> 0) / 4294967296;
    const ad = this.ads[key] && r < 0.8 ? Math.floor(r * 1.25 * AD_ROWS) % AD_ROWS : null;
    return { key, ad };
  }
  /** A picture of one vehicle advert (for the advert card). */
  vehicleAdPicture(row: number) {
    const src = this.adCanvas;
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const h = src.height / AD_ROWS;
    c.getContext('2d')!.drawImage(src, 0, (AD_ROWS - 1 - row) * h, src.width, h, 0, 0, 512, 128);
    return c.toDataURL('image/webp', 0.85);
  }
  /** Show the player's own advert on every vehicle that carries this row (a preview, only for them). */
  previewAd(row: number, draw: (g: CanvasRenderingContext2D, top: number, W: number, H: number) => void) {
    const h = this.adCanvas.height / AD_ROWS;
    draw(this.adCanvas.getContext('2d')!, (AD_ROWS - 1 - row) * h, this.adCanvas.width, h);
    for (const m of Object.values(this.ads)) if (m) ((m.material as THREE.MeshStandardMaterial).map as THREE.Texture).needsUpdate = true;
  }
  /** Vehicles told to stay where they are (a driver who got out). */
  hold = new Set<number>();
  private blockedTotal = new Map<number, number>();

  update(lon: number, lat: number, t: number, lane: number, player?: { x: number; z: number }) {
    this.lane = lane;
    const dt = this.lastT ? Math.min(0.1, Math.max(0, t - this.lastT)) : 0;
    // How far the shared clock really moved on (a slow phone can take longer than 0.1 s per frame):
    // a waiting vehicle is held back by all of it, so it never creeps forward.
    const moved = this.lastT ? Math.min(3, Math.max(0, t - this.lastT)) : 0;
    this.lastT = t;
    // Every vehicle has a timetable position (the shared clock) and is "held back" behind it when it
    // has to wait. Waiting only ever stops a vehicle where it is: it never jumps backwards, and it
    // never moves faster than a little catch-up speed, so there is no flicker or teleporting.
    // When the phone struggles, fewer vehicles are shown: always the same ones go (by their number),
    // so nothing flickers in and out.
    const placed: Placed[] = this.traffic
      .near(lon, lat, t, this.radiusM, this.limit * 2, lane)
      .filter((p) => !this.hide.has(p.v.id))
      .filter((p) => this.density >= 1 || ((p.v.id * 2654435761) >>> 0) / 4294967296 < this.density)
      .slice(0, this.limit);
    // A vehicle held back for a while can be behind its timetable spot, which may already be out of
    // range: keep drawing it where it really is, so it never vanishes.
    const listed = new Set(placed.map((p) => p.v.id));
    const [mx, mz] = this.toLocal(lon, lat);
    for (const [id, old] of this.lastPlaced) {
      if (listed.has(id) || (this.held.get(id) ?? 0) < 0.01) continue;
      const [ox, oz] = this.toLocal(old.lon, old.lat);
      if (Math.hypot(ox - mx, oz - mz) > this.radiusM) continue;
      placed.push({ ...old, s: old.s + old.v.speed * moved });
    }
    this.lastPlaced.clear();
    for (const p of placed) this.lastPlaced.set(p.v.id, p);
    this.placed = placed;
    const before = new Map<number, number>(); // held at the start of this frame
    const waiting = new Set<number>();
    const wait = (p: Placed) => {
      if (waiting.has(p.v.id)) return;
      waiting.add(p.v.id);
      // Hold back by exactly the distance the timetable moved on: the vehicle stays put.
      this.held.set(p.v.id, (before.get(p.v.id) ?? 0) + p.v.speed * moved);
    };
    const place = (p: Placed) => {
      const held = this.held.get(p.v.id) ?? 0;
      if (held > 0.01) {
        const pos = this.traffic.at(p.v, p.s - held, lane);
        p.lon = pos.lon;
        p.lat = pos.lat;
        p.heading = pos.heading;
        p.bridge = pos.bridge;
      }
    };
    for (const p of placed) {
      const was = this.held.get(p.v.id) ?? 0;
      before.set(p.v.id, was);
      this.held.set(p.v.id, Math.max(0, was - p.v.speed * 0.35 * dt)); // catch up gently when free
      place(p);
    }
    // 1. Waiting for the player standing in the lane, and for red lights (vehicles on flyovers ignore both).
    for (const p of placed) {
      if (p.bridge) continue;
      const half = KIND_LENGTH[p.v.kind] / 2;
      const [x, z] = this.toLocal(p.lon, p.lat);
      let byPlayer = false;
      if (player) {
        const fx = Math.sin(p.heading);
        const fz = -Math.cos(p.heading);
        const ahead = (player.x - x) * fx + (player.z - z) * fz;
        const side = Math.abs((player.x - x) * -fz + (player.z - z) * fx);
        byPlayer = ahead > -half && ahead < half + 9 && side < 1.7;
      }
      if (byPlayer || this.hold.has(p.v.id) || this.signals?.shouldStop(x, z, p.heading, half, t)) wait(p);
      const total = byPlayer ? (this.blockedTotal.get(p.v.id) ?? 0) + dt : 0;
      if (total) this.blockedTotal.set(p.v.id, total);
      else this.blockedTotal.delete(p.v.id);
      if (byPlayer) this.onBlocked?.({ id: p.v.id, x, z, heading: p.heading, kind: p.v.kind, halfW: KIND_WIDTH[p.v.kind] / 2, half, waited: total });
      // Hoot after waiting a moment for the player.
      const waited = byPlayer ? (this.blockedFor.get(p.v.id) ?? 0) + dt : 0;
      if (waited > 1.2 && this.onHoot) {
        this.onHoot(x, z);
        this.blockedFor.set(p.v.id, -2.5);
      } else this.blockedFor.set(p.v.id, waited);
    }
    for (const p of placed) place(p);
    // 2. Keeping a gap to whatever is ahead in the lane (any route, any angle, so queues, merges and
    //    crossings all work): if something is too close in front, wait. Vehicles on a flyover and on
    //    the street below never see each other.
    const local = placed.map((p) => {
      const [x, z] = this.toLocal(p.lon, p.lat);
      return { p, x, z, fx: Math.sin(p.heading), fz: -Math.cos(p.heading), half: KIND_LENGTH[p.v.kind] / 2, halfW: KIND_WIDTH[p.v.kind] / 2, up: !!p.bridge && (!this.deckHeight || this.deckHeight(x, z) > 2.5) };
    });
    type L = (typeof local)[number];
    const inPath = (a: L, b: L) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const ahead = dx * a.fx + dz * a.fz;
      if (ahead <= 0) return false;
      const side = Math.abs(dx * -a.fz + dz * a.fx);
      const dot = Math.abs(a.fx * b.fx + a.fz * b.fz);
      const cross = Math.sqrt(Math.max(0, 1 - dot * dot));
      const across = b.half * cross + b.halfW * dot;
      const along = b.half * dot + b.halfW * cross;
      if (side > a.halfW + across + 0.2) return false;
      return ahead < a.half + along + 1.6;
    };
    for (let pass = 0; pass < 5; pass++) {
      for (const a of local) {
        if (waiting.has(a.p.v.id)) continue;
        for (const b of local) {
          if (a === b || a.up !== b.up || Math.abs(b.x - a.x) > 16 || Math.abs(b.z - a.z) > 16) continue;
          const dot = a.fx * b.fx + a.fz * b.fz;
          if (dot < -0.7) continue; // oncoming traffic is in the other lanes
          if (!inPath(a, b)) continue;
          // At a crossing where each is in the other's way, the lower number goes first.
          if (dot < 0.7 && inPath(b, a) && a.p.v.id < b.p.v.id) continue;
          wait(a.p);
          place(a.p);
          [a.x, a.z] = this.toLocal(a.p.lon, a.p.lat);
          a.fx = Math.sin(a.p.heading);
          a.fz = -Math.cos(a.p.heading);
          break;
        }
      }
    }
    // 3. Last check: no two vehicle bodies may ever overlap (a car turning across another, two meeting
    //    at a U-turn). If a move would make them touch, the one driving into the other stays where it
    //    was. Two that drive straight at each other: the higher number waits; if they are stuck for
    //    3 seconds, the lower number squeezes past.
    const corners = (A: L, grow: number) => {
      const h = A.half + grow;
      const w = A.halfW + grow * 0.5;
      return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [A.x + A.fx * h * a - A.fz * w * b, A.z + A.fz * h * a + A.fx * w * b]);
    };
    const touching = (A: L, B: L) => {
      // Oncoming vehicles may pass close (mirrors almost brushing), as they do on Accra's narrow roads.
      const grow = A.fx * B.fx + A.fz * B.fz < -0.7 ? -0.2 : 0.05;
      const ca = corners(A, grow);
      const cb = corners(B, grow);
      for (const [ax, az] of [[A.fx, A.fz], [-A.fz, A.fx], [B.fx, B.fz], [-B.fz, B.fx]]) {
        let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
        for (const c of ca) { const d = c[0] * ax + c[1] * az; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
        for (const c of cb) { const d = c[0] * ax + c[1] * az; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
        if (a1 < b0 || b1 < a0) return false;
      }
      return true;
    };
    const refresh = (a: L) => {
      place(a.p);
      [a.x, a.z] = this.toLocal(a.p.lon, a.p.lat);
      a.fx = Math.sin(a.p.heading);
      a.fz = -Math.cos(a.p.heading);
    };
    const stuckNow = new Set<number>(); // pairs stuck nose to nose this frame
    for (let pass = 0; pass < 6; pass++) {
      let changed = false;
      for (let i = 0; i < local.length; i++) {
        const a = local[i];
        for (let j = i + 1; j < local.length; j++) {
          const b = local[j];
          if (a.up !== b.up || Math.abs(b.x - a.x) > 14 || Math.abs(b.z - a.z) > 14) continue;
          if (!touching(a, b)) continue;
          const intoB = (b.x - a.x) * a.fx + (b.z - a.z) * a.fz; // how much b is in front of a
          const intoA = (a.x - b.x) * b.fx + (a.z - b.z) * b.fz;
          let stop: L[] = [];
          if (intoB > 0 && intoA > 0) {
            // Nose to nose.
            const key = Math.min(a.p.v.id, b.p.v.id) * 1e6 + Math.max(a.p.v.id, b.p.v.id);
            const stuck = (this.stuck.get(key) ?? 0) + (stuckNow.has(key) ? 0 : dt);
            stuckNow.add(key);
            this.stuck.set(key, stuck);
            const low = a.p.v.id < b.p.v.id ? a : b;
            const high = low === a ? b : a;
            stop = stuck > 3 ? [high] : [a, b];
          } else {
            const first = intoB >= intoA ? a : b;
            // Already standing still: then the other one must stop instead.
            stop = [waiting.has(first.p.v.id) ? (first === a ? b : a) : first];
          }
          for (const x of stop) {
            if (waiting.has(x.p.v.id)) continue;
            wait(x.p);
            refresh(x);
            changed = true;
          }
        }
      }
      if (!changed) break;
    }
    for (const k of [...this.stuck.keys()]) if (!stuckNow.has(k)) this.stuck.delete(k); // they got apart
    // 4. The story's own vehicles (a taxi braking in the chase, Uncle Kwame's car) never move for
    //    traffic: anything that would drive into one waits behind it.
    for (const q of this.story) {
      if (!q.shown) continue;
      const b = { x: q.x, z: q.z, fx: Math.sin(q.heading), fz: -Math.cos(q.heading), half: KIND_LENGTH[q.kind] / 2, halfW: KIND_WIDTH[q.kind] / 2, up: false } as L;
      for (const a of local) {
        if (a.up || waiting.has(a.p.v.id) || Math.abs(b.x - a.x) > 16 || Math.abs(b.z - a.z) > 16) continue;
        if (inPath(a, b) || touching(a, b)) {
          wait(a.p);
          refresh(a);
        }
      }
    }
    // Forget vehicles that have gone.
    if (this.held.size > 4000) for (const id of [...this.held.keys()]) if (!before.has(id)) this.held.delete(id);
    this.boxes = local.filter((a) => !a.up).map((a) => ({ x: a.x, z: a.z, fx: a.fx, fz: a.fz, half: a.half, halfW: a.halfW }));
    for (const q of this.parked) this.boxes.push({ x: q.x, z: q.z, fx: Math.sin(q.heading), fz: -Math.cos(q.heading), half: 2.7, halfW: 0.95 });
    for (const q of this.story) if (q.shown) this.boxes.push({ x: q.x, z: q.z, fx: Math.sin(q.heading), fz: -Math.cos(q.heading), half: KIND_LENGTH[q.kind] / 2, halfW: KIND_WIDTH[q.kind] / 2 });
    const adCount: Partial<Record<BatchKey, number>> = {};
    let signs = 0;
    const counts: Record<BatchKey, number> = { car: 0, hatch: 0, sprinter: 0, motorking: 0, taxi: 0, trotro: 0, tricycle: 0, okada: 0, bus: 0, truck: 0, pickup: 0, suv: 0 };
    let shadowCount = 0;
    type Draw = { key: BatchKey; id: number; x: number; z: number; ground: number; heading: number; colour: string; bounce: boolean };
    const draws: Draw[] = [];
    for (const p of placed) {
      // Cars are a mix: about one in three is a small hatchback. About a third of trotros are the
      // longer Sprinter type. Tricycles: half carry passengers (pragya), half goods (motor king).
      const key: BatchKey =
        p.v.kind === 'car' && p.v.id % 3 === 0 ? 'hatch'
        : p.v.kind === 'trotro' && p.v.id % 3 === 0 ? 'sprinter'
        : p.v.kind === 'tricycle' && p.v.id % 2 === 0 ? 'motorking'
        : p.v.kind;
      const [x, z] = this.toLocal(p.lon, p.lat);
      // On a flyover: at the deck's height.
      const ground = p.bridge && this.deckHeight ? this.deckHeight(x, z) : 0;
      draws.push({ key, id: p.v.id, x, z, ground, heading: p.heading, colour: p.v.colour, bounce: true });
    }
    for (const q of this.parked) draws.push({ ...q, ground: 0, bounce: false });
    for (const q of this.story) if (q.shown) draws.push({ key: q.key, id: q.id, x: q.x, z: q.z, heading: q.heading, colour: q.colour, ground: 0, bounce: q.moving });
    for (const d of draws) {
      const b = this.batches[d.key];
      if (counts[d.key] >= b.body.instanceMatrix.count) continue;
      const i = counts[d.key]++;
      // A gentle bounce, different for each moving vehicle.
      this.v.set(d.x, d.ground + (d.bounce ? Math.sin(t * 9 + d.id) * 0.012 : 0), d.z);
      this.q.setFromAxisAngle(this.up, Math.PI - d.heading);
      this.m.compose(this.v, this.q, this.s);
      b.body.setMatrixAt(i, this.m);
      b.fixed.setMatrixAt(i, this.m);
      b.body.setColorAt(i, this.c.set(d.colour));
      // Most commercial vehicles carry an advert along both sides; taxis have the roof sign.
      const ads = this.ads[d.key];
      const r = ((d.id * 2246822519) >>> 0) / 4294967296;
      if (ads && r < 0.8) {
        const n = adCount[d.key] ?? 0;
        adCount[d.key] = n + 1;
        ads.setMatrixAt(n, this.m);
        (ads.geometry.getAttribute('aAd') as THREE.InstancedBufferAttribute).setX(n, Math.floor(r * 1.25 * AD_ROWS) % AD_ROWS);
      }
      if (d.key === 'taxi') this.taxiSigns.setMatrixAt(signs++, this.m);
      this.v.y = d.ground + 0.03;
      this.m.compose(this.v, this.q, this.shadowScale.set(b.shadow[0], 1, b.shadow[1]));
      this.shadows.setMatrixAt(shadowCount++, this.m);
    }
    for (const [kind, b] of Object.entries(this.batches) as [BatchKey, (typeof this.batches)[BatchKey]][]) {
      b.body.count = b.fixed.count = counts[kind];
      b.body.instanceMatrix.needsUpdate = b.fixed.instanceMatrix.needsUpdate = true;
      if (b.body.instanceColor) b.body.instanceColor.needsUpdate = true;
    }
    this.shadows.count = shadowCount;
    this.shadows.instanceMatrix.needsUpdate = true;
    for (const [key, ads] of Object.entries(this.ads) as [BatchKey, THREE.InstancedMesh][]) {
      ads.count = adCount[key] ?? 0;
      ads.instanceMatrix.needsUpdate = true;
      ads.geometry.getAttribute('aAd').needsUpdate = true;
    }
    AD_TIME.value = t;
    this.taxiSigns.count = signs;
    this.taxiSigns.instanceMatrix.needsUpdate = true;
  }
}
