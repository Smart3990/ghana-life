// Street-level traffic in real 3D: cars, Accra taxis, trotros and pragya tricycles, built in code from
// simple shapes (nothing to download). Each kind is two batched draws (painted body, and everything
// else in fixed colours), plus one shared batch of soft shadows, so 100 vehicles still cost about
// ten draw calls. Positions come from the shared traffic clock (traffic.ts), the same on every phone.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'three/examples/jsm/libs/meshopt_simplifier.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { Kind, Placed, Traffic } from './traffic';
import { slidingAdMaterial } from './adScreens';
import { epicGeometry, epicGlowMaps, epicMaterial } from './epicKit';
import type { TrafficSim } from './trafficSim';
import { TYPE_BY_KEY, VEHICLE_TYPES, typeFor } from './vehicleTypes';
import { SEATS, riderShapes } from './riders';

// Modern vehicles (public/models/vehicles): small models of today's Accra traffic (Corolla-size
// sedans, Vitz-size hatchbacks, RAV4-size SUVs, Hilux-size pickups, Hiace-size trotros, buses and
// trucks) from the free Low Poly Vehicles Pack by Rgsdev (CC0), sized to real cars by
// scripts/vehicles. Each file has a "paint" part (repainted per vehicle) and a "fixed" part (glass,
// lights, tyres). Until they have downloaded, the shapes built in code below are shown.
// Batches: each kind, plus a second car model so the streets mix sedans and hatchbacks.
// A batch per vehicle type (vehicleTypes.ts: every road vehicle of the Epic City pack, and our tricycles).
export type BatchKey = string;
/** The type (model) a vehicle is drawn as. */
export const keyOf = (v: { kind: Kind; id: number; type?: string }): BatchKey => v.type ?? typeFor(v.kind, v.id).key;
// The Low Poly Epic City pack's vehicles (public/models/epic/vehicles, step 4 of the Epic City plan):
// which pack model plays each Accra vehicle, and which of its colours is the paintwork (repainted per
// vehicle); `white` colours are made white (the trotro's roof). The tricycles stay our own.
const PACK: Record<BatchKey, { file: string; paint: string[]; white?: string[] }> = Object.fromEntries(
  VEHICLE_TYPES.filter((t) => t.file).map((t) => [t.key, { file: t.file!, paint: t.paint ?? [], white: t.white }]),
);
// Advert wraps on the pack's vehicles: [half width, bottom, top, back end, front end, back face].
// Full-side advert wraps on the pack's vehicles (owner, 28 Oct 2026: the advert "must take up the full
// side ... in both length and width", "made professionally"). Measured on the pack's models: each wrap
// follows the side's own shape, 1.5 cm out from it, from back to front and from bottom to top.
// profile: [height, distance out from the middle] up the side; z0..z1: back to front; shape: which
// advert picture it carries (adverts are designed in each wrap's own proportions, never stretched).
type Wrap = { profile: [number, number][]; z0: number; z1: number; shape: AdShape; bands?: [number, number, [number, number][]][] };
const VAN_WRAP: Wrap = {
  // The van: the lower body (x 0.84), the flat belt (x 0.86) and the windows sloping in (x 0.78 at 1.83).
  profile: [[0.46, 0.862], [0.83, 0.862], [0.85, 0.9], [1.34, 0.9], [1.8, 0.8]], // (clear of the door handles, which reach 0.894)
  z0: -1.6,
  z1: 1.64,
  shape: 'tall',
};
// The taxi's roof screen (owner, 28 Oct 2026: the advert on the taxi's roof sign, like the LED roof
// screens on taxis): a slim dark box over the pack's roof light (which is 1.1 m long, 0.36 m wide,
// up to 1.74 m), with a bright advert screen on each side, inside a thin border.
const TAXI_ROOF: Wrap = { profile: [[1.475, 0.212], [1.835, 0.212]], z0: -0.94, z1: 0.21, shape: 'roof' };
function taxiRoofBox() {
  return merge([
    box(0.4, 0.43, 1.21, 0, 1.655, -0.365), // the screen's case
    box(0.34, 0.06, 0.09, 0, 1.43, -0.82), // two feet on the roof
    box(0.34, 0.06, 0.09, 0, 1.43, 0.09),
  ]);
}
const PACK_WRAPS: Partial<Record<BatchKey, Wrap>> = {
  taxi: TAXI_ROOF,
  trotro: VAN_WRAP,
  sprinter: VAN_WRAP,
  // The city bus (owner, 28 Oct 2026: "full side, bigger in both length and width"): its whole flat
  // side (x 1.32), from just above the ground line to the roof edge and from the back to the driver's
  // window, with the two wheel arches cut out (mapped on the model every 10 cm: bands of height, and
  // the stretches along each band where the side is flat).
  bus: {
    profile: [[0.55, 1.335], [2.75, 1.335]],
    z0: -5.45,
    z1: 4.0,
    shape: 'wide',
    bands: [
      [0.55, 0.75, [[-5.45, -3.35], [-1.75, 2.45]]],
      [0.75, 0.95, [[-5.45, -3.25], [-1.75, 2.55]]],
      [0.95, 1.05, [[-5.45, -3.15], [-1.85, 2.65]]],
      [1.05, 1.15, [[-5.45, -3.05], [-1.95, 2.75]]],
      [1.15, 1.25, [[-5.45, -2.95], [-2.15, 2.85], [3.75, 4.0]]],
      [1.25, 2.75, [[-5.45, 4.0]]],
    ],
  },
  // The box lorry: its whole cargo box (x 1.04, y 0.88 to 2.81, z -3.03 to 1.42).
  truck: { profile: [[0.9, 1.066], [2.79, 1.066]], z0: -3.01, z1: 1.4, shape: 'tall' }, // (clear of the fittings at 1.058)
};
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
/** The two advert shapes: 'tall' (vans and lorry boxes, about 2.35 wide to 1 high), 'wide' (buses, about 4.3 to 1), 'roof' (the taxis' roof screens, 3.2 to 1). */
export type AdShape = 'tall' | 'wide' | 'roof';
export const AD_ASPECT: Record<AdShape, number> = { tall: 2.36, wide: 4.3, roof: 3.2 };
const SHAPE_OF: Partial<Record<string, AdShape>> = { trotro: 'tall', sprinter: 'tall', truck: 'tall', bus: 'wide', taxi: 'roof' };
export type VehicleAd = { title: string; line: string; bg: [string, string]; accent: string; ink?: string; cta?: string };
// Placeholder adverts (the game's own brands). Advertisers' own adverts come from /data/ads.json
// (the same fields), so new ones can be added without changing the game.
const DEFAULT_ADS: VehicleAd[] = [
  { title: 'SIKA MOBILE MONEY', line: 'Send money home in seconds', bg: ['#0f6b3a', '#1c9b57'], accent: '#f2c21a', cta: 'Open the Sika app' },
  { title: 'GHANAVERSE FM 98.5', line: 'The sound of the city, all day', bg: ['#4a1d6e', '#7a3fb0'], accent: '#ffd25a', cta: 'Tune in now' },
  { title: 'YOUR AD HERE', line: 'Ride the whole city · from ₵35 a week', bg: ['#f2efe6', '#e3dccb'], accent: '#c8442e', ink: '#121a14', cta: 'Tap this vehicle' },
  { title: 'KELEWELE AT CIRCLE', line: 'Hot and spicy every evening', bg: ['#c2410c', '#f08a24'], accent: '#fff3c4', cta: 'By the lorry station' },
  { title: 'COOL SACHET WATER', line: 'Clean, cold, everywhere', bg: ['#0b4f8a', '#2a86d1'], accent: '#ffffff', cta: 'Ask for it by name' },
  { title: 'GHANAVERSE NEWS', line: 'Tonight at 8 on every big screen', bg: ['#8e1b1b', '#c8442e'], accent: '#ffffff', cta: 'Every night at 8' },
  { title: 'TONIGHT IN GHANAVERSE', line: 'Highlife night at Osu · free entry', bg: ['#1f4f8a', '#121a14'], accent: '#e3a92b', cta: 'Saturday from 9pm' },
  { title: 'PHONES & CHARGERS', line: 'Best prices at Circle, come and see', bg: ['#121a14', '#3a3d42'], accent: '#2dd4bf', cta: 'Circle market' },
];
/** Fit a line of text into a width: the biggest size up to `size` that fits (never under 40%). */
function fitFont(g: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) {
  let px = size;
  for (; px > size * 0.4; px *= 0.94) {
    g.font = `${weight} ${Math.round(px)}px system-ui, sans-serif`;
    if (g.measureText(text).width <= maxW) break;
  }
  return Math.round(px);
}
/** Split a title into two balanced lines (for the taller wraps). */
function twoLines(text: string): string[] {
  const w = text.split(' ');
  if (w.length < 2) return [text];
  let best = 1, diff = Infinity;
  for (let i = 1; i < w.length; i++) {
    const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length);
    if (d < diff) [best, diff] = [i, d];
  }
  return [w.slice(0, best).join(' '), w.slice(best).join(' ')];
}
/**
 * One vehicle advert, laid out like a real wrap for the space's shape: a deep colour sweep, big
 * shapes in the advert's colour, the brand in large letters (on two lines on the taller wraps), its
 * line, a call-to-action badge, a round brand mark, and a kente band along the bottom.
 */
export function drawVehicleAd(g: CanvasRenderingContext2D, a: VehicleAd, top: number, W: number, H: number) {
  const tall = W / H < 3.2;
  const ink = a.ink ?? '#ffffff';
  g.save();
  g.beginPath();
  g.rect(0, top, W, H);
  g.clip();
  const grad = g.createLinearGradient(0, top, W, top + H);
  grad.addColorStop(0, a.bg[0]);
  grad.addColorStop(1, a.bg[1]);
  g.fillStyle = grad;
  g.fillRect(0, top, W, H);
  // Big soft shapes: a circle off the right edge and a slanted band.
  g.fillStyle = a.accent;
  g.globalAlpha = 0.16;
  g.beginPath();
  g.arc(W * 0.86, top + H * 0.42, H * (tall ? 0.62 : 0.85), 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.1;
  g.beginPath();
  g.moveTo(W * 0.56, top + H);
  g.lineTo(W * 0.66, top + H);
  g.lineTo(W * 0.8, top);
  g.lineTo(W * 0.7, top);
  g.fill();
  g.globalAlpha = 1;
  // Bands: a thin line of the advert's colour along the top, kente along the bottom.
  const kh = Math.max(6, Math.round(H * 0.075));
  g.fillRect(0, top, W, Math.max(3, Math.round(H * 0.025)));
  const kente = ['#e3a92b', '#121a14', '#c8442e', '#121a14', '#2f8f57', '#121a14', '#1f5fa8', '#121a14'];
  for (let x = 0, i = 0; x < W; x += kh, i++) {
    g.fillStyle = kente[i % kente.length];
    g.fillRect(x, top + H - kh, kh, kh);
  }
  // The brand mark on the right: a disc with the brand's initials.
  const r = H * (tall ? 0.2 : 0.3);
  const mx = W - r - H * (tall ? 0.16 : 0.2), my = top + (H - kh) / 2;
  g.fillStyle = a.accent;
  g.beginPath();
  g.arc(mx, my, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = ink === '#ffffff' ? a.bg[0] : '#ffffff';
  if (ink !== '#ffffff') g.fillStyle = a.bg[0] === '#f2efe6' ? '#121a14' : '#ffffff';
  const initials = a.title.split(/\s+/).filter((w) => /[A-Z0-9]/i.test(w[0] ?? '')).slice(0, 2).map((w) => w[0]).join('');
  g.font = `900 ${Math.round(r * 0.9)}px system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(initials, mx, my + r * 0.04);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  // The words, in a block on the left, centred up and down.
  const pad = H * (tall ? 0.1 : 0.14);
  const maxW = mx - r - pad * 1.6;
  const lines = tall ? twoLines(a.title) : [a.title];
  let tsize = H * (tall ? 0.2 : 0.44);
  for (const l of lines) tsize = Math.min(tsize, fitFont(g, l, 900, tsize, maxW));
  const cta = a.cta ?? '';
  // The whole block (brand, line, badge) always fits the height, with a margin.
  const blockOf = (t: number) => lines.length * t * 1.02 + t * 0.4 * 1.5 + (cta ? t * 0.4 * 0.82 * 2.4 : 0);
  while (blockOf(tsize) > (H - kh) * 0.84 && tsize > 8) tsize *= 0.95;
  tsize = Math.round(tsize);
  const lsize = fitFont(g, a.line, 700, tsize * (tall ? 0.42 : 0.4), maxW);
  const csize = Math.round(lsize * 0.82);
  const block = lines.length * tsize * 1.02 + lsize * 1.5 + (cta ? csize * 2.4 : 0);
  let y = top + (H - kh - block) / 2 + tsize * 0.86;
  g.fillStyle = ink;
  g.font = `900 ${tsize}px system-ui, sans-serif`;
  for (const l of lines) {
    g.fillText(l, pad, y);
    y += tsize * 1.02;
  }
  g.globalAlpha = 0.92;
  g.fillStyle = ink === '#121a14' ? '#c8442e' : ink;
  g.font = `700 ${lsize}px system-ui, sans-serif`;
  y += lsize * 0.35;
  g.fillText(a.line, pad, y);
  g.globalAlpha = 1;
  if (cta) {
    // The call to action in a pill of the advert's colour.
    g.font = `800 ${csize}px system-ui, sans-serif`;
    const cw = g.measureText(cta).width + csize * 1.4;
    const ch = csize * 1.7;
    const cy = y + lsize * 0.6;
    g.fillStyle = a.accent;
    g.beginPath();
    g.roundRect(pad, cy, cw, ch, ch / 2);
    g.fill();
    g.fillStyle = a.bg[0] === '#f2efe6' || a.accent === '#ffffff' || a.accent === '#fff3c4' || a.accent === '#ffd25a' || a.accent === '#f2c21a' || a.accent === '#e3a92b' || a.accent === '#2dd4bf' ? '#121a14' : '#ffffff';
    g.fillText(cta, pad + csize * 0.7, cy + ch * 0.68);
  }
  g.restore();
}
/** The adverts of one shape, one per row of one picture (row 0 at the bottom). */
function adAtlas(ads: VehicleAd[], canvas: HTMLCanvasElement, shape: AdShape, W: number) {
  const c = canvas;
  const H = Math.round(W / AD_ASPECT[shape]);
  c.width = W;
  c.height = H * AD_ROWS;
  const g = c.getContext('2d')!;
  for (let r = 0; r < AD_ROWS; r++) drawVehicleAd(g, ads[r % ads.length], (AD_ROWS - 1 - r) * H, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A full-side wrap on both sides: strips up the side's profile, reading the right way round from outside. */
function wrapGeometry(w: Wrap) {
  const pos: number[] = [];
  const uv: number[] = [];
  const nor: number[] = [];
  if (w.bands) {
    // A flat side with cut-outs: one advert over the whole rectangle, drawn only on the bands.
    const x = w.profile[0][1];
    const Y0 = w.profile[0][0], Y1 = w.profile[w.profile.length - 1][0];
    const L = w.z1 - w.z0, H = Y1 - Y0;
    for (const side of [1, -1]) {
      const order = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
      for (const [y0, y1, runs] of w.bands) {
        for (const [z0, z1] of runs) {
          const quad = [[side * x, y0, z0], [side * x, y0, z1], [side * x, y1, z1], [side * x, y1, z0]];
          for (const k of order) {
            const [qx, qy, qz] = quad[k];
            pos.push(qx, qy, qz);
            const u = side > 0 ? (w.z1 - qz) / L : (qz - w.z0) / L;
            uv.push(u, (qy - Y0) / H);
            nor.push(side, 0, 0);
          }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return g;
  }
  const P = w.profile;
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum[cum.length - 1];
  for (const side of [1, -1]) {
    const u = side > 0 ? [1, 0, 0, 1] : [0, 1, 1, 0];
    const order = side > 0 ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (let i = 1; i < P.length; i++) {
      const [ya, xa] = P[i - 1], [yb, xb] = P[i];
      const va = cum[i - 1] / total, vb = cum[i] / total;
      const quad = [[side * xa, ya, w.z0], [side * xa, ya, w.z1], [side * xb, yb, w.z1], [side * xb, yb, w.z0]];
      const vv = [va, va, vb, vb];
      const ny = -(xb - xa), nx = yb - ya, nl = Math.hypot(nx, ny) || 1;
      for (const k of order) {
        pos.push(...quad[k]);
        uv.push(u[k], vv[k]);
        nor.push((side * nx) / nl, ny / nl, 0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
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
  // The same sliding change as the billboards (the next advert slides in every 8 seconds), and lit
  // like them: a bright screen, the same at noon and at midnight, so it is always clear to read.
  const sliding = slidingAdMaterial(map, AD_ROWS, 8, true) as THREE.MeshBasicMaterial;
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
const KIND_LENGTH: Record<Kind, number> = { car: 4.7, taxi: 5.35, trotro: 4.4, tricycle: 3, okada: 2.2, bus: 11.3, truck: 6.3, pickup: 5.3, suv: 4.7 }; // (the pack's vehicles)

// Widths (metres), for crossings and for not walking through vehicles.
const KIND_WIDTH: Record<Kind, number> = { car: 2.1, taxi: 2.2, trotro: 1.85, tricycle: 1.4, okada: 0.85, bus: 2.85, truck: 2.3, pickup: 2.0, suv: 2.1 };

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
  const sack = (x: number, y: number, z: number, c: string) => paint(new THREE.SphereGeometry(0.36, 8, 6).scale(1, 0.62, 1.15).translate(x, y, z), c);
  const fixed: Part[] = [
    sack(-0.34, 1.05, -0.4, '#c9b48a'), sack(0.34, 1.05, -0.4, '#bba57c'), sack(-0.34, 1.05, -1.2, '#c4ae84'), sack(0.34, 1.05, -1.2, '#d1bd94'),
    sack(0, 1.48, -0.8, '#bfa97f'), sack(-0.3, 1.45, -1.35, '#2f6b3f'),
    paint(box(0.5, 0.4, 0.45, 0.35, 1.5, -1.35), '#3a5fa8'), // a blue crate on top
    paint(box(0.3, 0.1, 0.5, 0, 0.88, 0.62), '#1f1f1f'), // seat
    paint(box(0.7, 0.04, 0.04, 0, 1.18, 1.0), TRIM), // handlebar
    paint(box(0.05, 0.6, 0.05, 0, 0.85, 1.02), TRIM), // fork
    paint(box(0.14, 0.12, 0.08, 0, 1.0, 1.08), HEAD),
    // (The rider is one of the pack's people, sat on the seat: riders.ts.)
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
  const fixed: Part[] = [
    paint(box(0.05, 1.1, 0.05, 0.6, 1.22, -1.2), TRIM), // canopy posts
    paint(box(0.05, 1.1, 0.05, -0.6, 1.22, -1.2), TRIM),
    paint(box(0.05, 1.0, 0.05, 0.55, 1.27, 0.7), TRIM),
    paint(box(0.05, 1.0, 0.05, -0.55, 1.27, 0.7), TRIM),
    paint(box(1.16, 0.12, 0.9, 0, 0.98, -0.75), '#1f1f1f'), // bench
    paint(box(0.3, 0.1, 0.5, 0, 0.88, 0.25), '#1f1f1f'), // driver's seat
    paint(box(0.7, 0.04, 0.04, 0, 1.25, 0.85), TRIM), // handlebar
    paint(box(0.12, 0.1, 0.06, 0, 0.95, 0.95), HEAD),
    // (The driver and passengers are the pack's people, sat down: riders.ts.)
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
  /** The same vehicles drawn simpler (fewer triangles) beyond FAR_M, where the difference can't be seen. */
  private far: Partial<Record<BatchKey, { body: THREE.InstancedMesh; fixed: THREE.InstancedMesh }>> = {};
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
    // Until each pack model has loaded, a shape built in code for its kind stands in.
    const byKind: Record<Kind, () => Model> = { car: () => car(false), taxi: () => car(true), trotro: trotro, tricycle: pragya, okada, bus, truck, pickup, suv };
    const models: Record<BatchKey, Model> = {};
    for (const t of VEHICLE_TYPES) models[t.key] = t.key === 'motorking' ? motorKing() : byKind[t.kind]();
    this.batches = {} as typeof this.batches;
    // Two advert pictures, one per wrap shape (smaller on Light phones).
    const AW = limit <= 300 ? 768 : 1024;
    const adMats: Record<AdShape, THREE.MeshBasicMaterial> = {
      tall: adMaterial(adAtlas(DEFAULT_ADS, this.adCanvases.tall, 'tall', AW)),
      wide: adMaterial(adAtlas(DEFAULT_ADS, this.adCanvases.wide, 'wide', AW)),
      roof: adMaterial(adAtlas(DEFAULT_ADS, this.adCanvases.roof, 'roof', Math.round(AW * 0.6))),
    };
    // Advertisers' adverts, when there are any.
    fetch('/data/ads.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((list: VehicleAd[] | null) => {
        if (!Array.isArray(list) || !list.length) return;
        for (const shape of ['tall', 'wide', 'roof'] as const) {
          adMats[shape].map = adAtlas([...list, ...DEFAULT_ADS].slice(0, AD_ROWS), this.adCanvases[shape], shape, shape === 'roof' ? Math.round(AW * 0.6) : AW);
          adMats[shape].needsUpdate = true;
        }
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
    this.roofBoxes = new THREE.InstancedMesh(taxiRoofBox(), new THREE.MeshStandardMaterial({ color: '#16181b', roughness: 0.45, metalness: 0.3 }), limit);
    this.roofBoxes.count = 0;
    this.roofBoxes.frustumCulled = false;
    this.roofBoxes.castShadow = true;
    this.roofBoxes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.roofBoxes);
    this.taxiSigns = new THREE.InstancedMesh(signGeo, new THREE.MeshBasicMaterial({ map: taxiSignTexture() }), limit);
    this.taxiSigns.count = 0;
    this.taxiSigns.frustumCulled = false;
    this.group.add(this.taxiSigns);
    // Night: headlights with a beam on the road ahead, and red tail lights.
    this.headlights = new THREE.InstancedMesh(headlightShape(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), limit);
    this.taillights = new THREE.InstancedMesh(taillightShape(), new THREE.MeshBasicMaterial({ color: 0xff2a1a, side: THREE.DoubleSide }), limit);
    for (const m of [this.headlights, this.taillights]) {
      m.count = 0;
      m.frustumCulled = false;
      m.visible = false;
      this.group.add(m);
    }
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
      if (PACK[kind]) {
        const fb = new THREE.InstancedMesh(model.body, look, limit);
        const ff = new THREE.InstancedMesh(model.fixed, fixedMat, limit);
        for (const mesh of [fb, ff]) {
          mesh.count = 0;
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          this.group.add(mesh);
        }
        fb.setColorAt(0, this.c.set('#ffffff'));
        this.far[kind] = { body: fb, fixed: ff };
      }
      const panel = AD_PANELS[kind];
      if (panel || kind === 'taxi') {
        const geo = kind === 'taxi' ? wrapGeometry(TAXI_ROOF) : adPanels(panel!);
        geo.setAttribute('aAd', new THREE.InstancedBufferAttribute(new Float32Array(limit), 1));
        const ads = new THREE.InstancedMesh(geo, adMats[SHAPE_OF[kind] ?? 'tall'], limit);
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
    void this.loadPack(); // (the earlier downloaded models, loadModern, are no longer used)
    void this.loadRiders();
  }

  private packTaxi = false;
  // People riding and driving the vehicles you can see into (riders.ts).
  private riders: THREE.InstancedMesh[] = []; // near ones, then the same people simpler (far), in one list
  private riderCounts: number[] = [];
  private riderKinds = 0;
  private seat = new THREE.Matrix4();
  private async loadRiders() {
    const near = await riderShapes();
    const far = await Promise.all(near.map((g) => simpler(g, 0.35, true)));
    const shapes = [...near, ...far];
    this.riderKinds = near.length;
    const mat = dayLookMaterial(); // (keeps the day glow at night)
    this.riders = shapes.map((g) => {
      const m = new THREE.InstancedMesh(g, mat, this.limit);
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
      return m;
    });
    this.riderCounts = shapes.map(() => 0);
  }
  /** The pack's vehicles in place of ours, as each one arrives. */
  private async loadPack() {
    const atlas = await atlasPixels();
    if (!atlas) return;
    const fixedMat = dayLookMaterial(); // (its own copy: it keeps the day glow at night, so windows stay glass)
    for (const [key, spec] of Object.entries(PACK) as [BatchKey, NonNullable<(typeof PACK)[BatchKey]>][]) {
      let geo: THREE.BufferGeometry;
      try {
        geo = await epicGeometry(`vehicles/${spec.file}.glb`);
      } catch {
        continue;
      }
      const { paint, fixed } = splitPaint(geo, atlas, spec.paint, spec.white ?? []);
      const b = this.batches[key];
      b.body.geometry = paint;
      b.fixed.geometry = fixed;
      b.fixed.material = fixedMat;
      const f = this.far[key];
      if (f) {
        f.body.geometry = await simpler(paint, 0.35);
        f.fixed.geometry = await simpler(fixed, 0.3, true);
        f.fixed.material = fixedMat;
      }
      const wrap = PACK_WRAPS[key];
      const ads = this.ads[key];
      if (wrap && ads) {
        const g = wrapGeometry(wrap);
        g.setAttribute('aAd', ads.geometry.getAttribute('aAd'));
        ads.geometry = g;
      }
      if (key === 'taxi') this.packTaxi = true;
    }
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
  private roofBoxes!: THREE.InstancedMesh;
  private headlights!: THREE.InstancedMesh;
  private taillights!: THREE.InstancedMesh;
  private night = 0;
  private lamp = new THREE.Matrix4();
  /** 0 by day, 1 at night: headlights and tail lights on. */
  setNight(n: number) {
    this.night = n;
    this.headlights.visible = this.taillights.visible = n > 0.02;
    (this.headlights.material as THREE.MeshBasicMaterial).color.setScalar(n);
  }
  /** The story's own vehicles (the car that blocks you in the chase, Uncle Kwame's car): moved by
   *  the story, drawn with the others, and solid. */
  story: { key: BatchKey; kind: Kind; id: number; x: number; z: number; heading: number; colour: string; shown: boolean; moving: boolean }[] = [];
  /** Vehicles parked for good (the trotro station): drawn with the others, and solid. */
  parked: { key: BatchKey; id: number; x: number; z: number; heading: number; colour: string }[] = [];
  /** Share of vehicles shown (1 = all), lowered when the phone struggles. */
  density = 1;
  /** The flyover deck's height at a point (set by the street test). */
  deckHeight: ((x: number, z: number) => number) | null = null;
  /** How far the ground dips here (the sunk tarmac of the pack's roads, epicRoads.ts); 0 if none. */
  groundDip: ((x: number, z: number) => number) | null = null;
  /** Called when a driver hoots at the player (x, z in metres). */
  onHoot: ((x: number, z: number) => void) | null = null;
  /** Called every frame for each vehicle stopped because the player stands in its way. */
  onBlocked: ((v: { id: number; x: number; z: number; heading: number; kind: string; halfW: number; half: number; waited: number }) => void) | null = null;
  /** Is a point inside a low flyover ramp (set by the street test)? Ground traffic never drives there. */
  lowRamp: ((x: number, z: number) => boolean) | null = null;
  /** The flyovers changed (nothing to redo: each vehicle is checked where it is, every frame). */
  recheckRoutes() {}
  /**
   * A ground vehicle is never drawn where its road runs under the low end of a flyover ramp (lower
   * than a vehicle): there it is out of sight behind the ramp's walls and kerbs. Everywhere else on
   * the same road it drives as usual (only those few metres are left out, so the roads stay full).
   */
  private routeOk(p: Placed) {
    if (!this.lowRamp || p.bridge) return true;
    const [x, z] = this.toLocal(p.lon, p.lat);
    const half = KIND_LENGTH[p.v.kind] / 2;
    const fx = Math.sin(p.heading);
    const fz = -Math.cos(p.heading);
    for (const k of [-half, 0, half]) if (this.lowRamp(x + fx * k, z + fz * k)) return false;
    return true;
  }
  /** Vehicles not drawn (the story has taken their place on the road). */
  hide = new Set<number>();
  private lane = 1.35;
  private adCanvases: Record<AdShape, HTMLCanvasElement> = { tall: document.createElement('canvas'), wide: document.createElement('canvas'), roof: document.createElement('canvas') };
  /** Where a vehicle's route goes at a distance s (in the scene's metres), for driving along it. */
  routeAt(v: Placed['v'], s: number) {
    const p = this.traffic.at(v, s, this.lane);
    const [x, z] = this.toLocal(p.lon, p.lat);
    return { x, z, heading: p.heading, bridge: !!p.bridge };
  }
  /** What a vehicle is and which advert it carries (null: no advert space on it). */
  vehicleInfo(v: Placed['v']) {
    const key = keyOf(v);
    const r = ((v.id * 2246822519) >>> 0) / 4294967296;
    const ad = this.ads[key] && (r < 0.8 || key === 'taxi') ? Math.floor(r * 1.25 * AD_ROWS) % AD_ROWS : null;
    return { key, ad };
  }
  /** The advert shape a vehicle type carries ('tall' vans and lorries, 'wide' buses). */
  adShapeOf(key: string): AdShape {
    return SHAPE_OF[key] ?? 'tall';
  }
  /** A picture of one vehicle advert in the shape of that vehicle's wrap (for the advert card). */
  vehicleAdPicture(row: number, shape: AdShape = 'tall') {
    const src = this.adCanvases[shape];
    const c = document.createElement('canvas');
    c.width = 720;
    c.height = Math.round(720 / AD_ASPECT[shape]);
    const h = src.height / AD_ROWS;
    c.getContext('2d')!.drawImage(src, 0, (AD_ROWS - 1 - row) * h, src.width, h, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', 0.88);
  }
  /** Show the player's own advert on every vehicle that carries this row, in both wrap shapes (a preview, only for them). */
  previewAd(row: number, draw: (g: CanvasRenderingContext2D, top: number, W: number, H: number) => void) {
    for (const c of Object.values(this.adCanvases)) {
      const h = c.height / AD_ROWS;
      draw(c.getContext('2d')!, (AD_ROWS - 1 - row) * h, c.width, h);
    }
    for (const m of Object.values(this.ads)) if (m) ((m.material as THREE.MeshBasicMaterial).map as THREE.Texture).needsUpdate = true;
  }
  /** Vehicles told to stay where they are (a driver who got out). */
  hold = new Set<number>();
  private blockedTotal = new Map<number, number>();

  /** The traffic drivers (trafficSim.ts): when set, vehicles drive by the rules instead of the timetable. */
  sim: TrafficSim | null = null;
  private lastReal = 0;
  private simUpdate(lon: number, lat: number, t: number, player?: { x: number; z: number }) {
    const sim = this.sim!;
    const now = performance.now() / 1000;
    const dt = this.lastReal ? now - this.lastReal : 0;
    this.lastReal = now;
    const [mx, mz] = this.toLocal(lon, lat);
    // What drivers wait behind: the player, the story's vehicles and the parked ones.
    sim.obstacles = [];
    sim.playerFirst = !!player;
    if (player) sim.obstacles.push({ x: player.x, z: player.z, r: 0.45 });
    sim.onWaitForPlayer = this.onBlocked;
    this.storyAt = { lon, lat, t };
    for (const q of this.story) if (q.shown) sim.obstacles.push({ x: q.x, z: q.z, r: KIND_LENGTH[q.kind] / 2, heading: q.heading, half: (TYPE_BY_KEY.get(q.key)?.len ?? KIND_LENGTH[q.kind]) / 2, halfW: (TYPE_BY_KEY.get(q.key)?.width ?? 2) / 2 });
    for (const q of this.parked) sim.obstacles.push({ x: q.x, z: q.z, r: 2.6 });
    sim.hold = this.hold;
    sim.update(dt, mx, mz);
    const placed = sim.near(mx, mz, this.radiusM, this.limit).filter((p) => !this.hide.has(p.v.id) && this.routeOk(p));
    this.placed = placed;
    this.boxes = [];
    for (const p of placed) {
      if (p.bridge) continue;
      const [x, z] = this.toLocal(p.lon, p.lat);
      const type = TYPE_BY_KEY.get(keyOf(p.v));
      this.boxes.push({ x, z, fx: Math.sin(p.heading), fz: -Math.cos(p.heading), half: (type?.len ?? KIND_LENGTH[p.v.kind]) / 2, halfW: (type?.width ?? KIND_WIDTH[p.v.kind]) / 2 });
    }
    for (const q of this.parked) this.boxes.push({ x: q.x, z: q.z, fx: Math.sin(q.heading), fz: -Math.cos(q.heading), half: 2.7, halfW: 0.95 });
    for (const q of this.story) if (q.shown) this.boxes.push({ x: q.x, z: q.z, fx: Math.sin(q.heading), fz: -Math.cos(q.heading), half: KIND_LENGTH[q.kind] / 2, halfW: KIND_WIDTH[q.kind] / 2 });
    this.draw(placed, t, lon, lat);
  }

  private storyAt = { lon: 0, lat: 0, t: 0 };
  /**
   * Road routes near the player for the story to drive along (Uncle Kwame's car, the ambulance):
   * the timetable routes, which are not drawn when the drivers (sim) are on. Use with routeAt.
   */
  storyRoutes(): Placed[] {
    if (!this.sim) return this.placed;
    return this.traffic.near(this.storyAt.lon, this.storyAt.lat, this.storyAt.t, this.radiusM, 60, this.lane);
  }

  update(lon: number, lat: number, t: number, lane: number, player?: { x: number; z: number }) {
    if (this.sim) return this.simUpdate(lon, lat, t, player);
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
    // (When the phone struggles there are fewer vehicles, but never by removing one already close to
    // you: those drive on until they are past; only newcomers and far ones are left out.)
    const placed: Placed[] = this.traffic
      .near(lon, lat, t, this.radiusM, this.limit * 2, lane)
      .filter((p) => !this.hide.has(p.v.id) && this.routeOk(p))
      .filter((p) => this.density >= 1 || ((p.v.id * 2654435761) >>> 0) / 4294967296 < this.density || (p.d < 60 && this.lastPlaced.has(p.v.id)))
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
    this.draw(placed, t, lon, lat);
  }

  /** Draw the vehicles in `placed` (and the story's and parked ones). */
  private draw(placed: Placed[], t: number, lon: number, lat: number) {
    const adCount: Partial<Record<BatchKey, number>> = {};
    let signs = 0;
    let roofBoxes = 0;
    const counts: Record<BatchKey, number> = Object.fromEntries(Object.keys(this.batches).map((k) => [k, 0]));
    let shadowCount = 0;
    type Draw = { key: BatchKey; id: number; x: number; z: number; ground: number; heading: number; colour: string; bounce: boolean };
    const draws: Draw[] = [];
    let lit = 0;
    for (const p of placed) {
      // Cars are a mix: about one in three is a small hatchback. About a third of trotros are the
      // longer Sprinter type. Tricycles: half carry passengers (pragya), half goods (motor king).
      const key = keyOf(p.v);
      const [x, z] = this.toLocal(p.lon, p.lat);
      // On a flyover: at the deck's height.
      // Off it: on the tarmac, which sits a little below the pavement.
      const ground = p.bridge && this.deckHeight ? this.deckHeight(x, z) : -(this.groundDip?.(x, z) ?? 0);
      draws.push({ key, id: p.v.id, x, z, ground, heading: p.heading, colour: p.v.colour, bounce: true });
    }
    for (const q of this.parked) draws.push({ ...q, ground: -(this.groundDip?.(q.x, q.z) ?? 0), bounce: false });
    // The story's own vehicles first, so they are always drawn even when a batch is full.
    for (const q of this.story) if (q.shown) draws.unshift({ key: q.key, id: q.id, x: q.x, z: q.z, heading: q.heading, colour: q.colour, ground: -(this.groundDip?.(q.x, q.z) ?? 0), bounce: q.moving });
    const [px, pz] = this.toLocal(lon, lat);
    const farCounts: Partial<Record<BatchKey, number>> = {};
    this.riderCounts.fill(0);
    for (const d of draws) {
      const near = this.batches[d.key];
      const isFar = !!this.far[d.key] && (d.x - px) ** 2 + (d.z - pz) ** 2 > FAR_M * FAR_M;
      const b = isFar ? this.far[d.key]! : near;
      const used = isFar ? (farCounts[d.key] ?? 0) : counts[d.key];
      if (used >= b.body.instanceMatrix.count) continue;
      const i = used;
      if (isFar) farCounts[d.key] = used + 1;
      else counts[d.key]++;
      // A gentle bounce, different for each moving vehicle.
      this.v.set(d.x, d.ground + (d.bounce ? Math.sin(t * 9 + d.id) * 0.012 : 0), d.z);
      this.q.setFromAxisAngle(this.up, Math.PI - d.heading);
      this.m.compose(this.v, this.q, this.s);
      b.body.setMatrixAt(i, this.m);
      b.fixed.setMatrixAt(i, this.m);
      b.body.setColorAt(i, this.c.set(d.colour));
      // Most commercial vehicles carry an advert along both sides; every taxi has its roof screen.
      const ads = this.ads[d.key];
      const r = ((d.id * 2246822519) >>> 0) / 4294967296;
      if (d.key === 'taxi') this.roofBoxes.setMatrixAt(roofBoxes++, this.m);
      if (ads && (r < 0.8 || d.key === 'taxi')) {
        const n = adCount[d.key] ?? 0;
        adCount[d.key] = n + 1;
        ads.setMatrixAt(n, this.m);
        (ads.geometry.getAttribute('aAd') as THREE.InstancedBufferAttribute).setX(n, Math.floor(r * 1.25 * AD_ROWS) % AD_ROWS);
      }
      // (The old painted "TAXI" sign is replaced by the roof screen.)
      // The rider (and passenger) or driver, where you can see them.
      const seats = SEATS[d.key];
      if (seats && this.riders.length) {
        seats.at.forEach(([sx, sy, sz], si) => {
          if (si > 0 && ((d.id * 2654435761 + si * 40503) >>> 0) / 4294967296 > (seats.extra ?? 1)) return;
          const r = ((d.id + si * 7) % this.riderKinds) + (isFar ? this.riderKinds : 0);
          const mesh = this.riders[r];
          if (this.riderCounts[r] >= mesh.instanceMatrix.count) return;
          mesh.setMatrixAt(this.riderCounts[r]++, this.seat.makeTranslation(sx, sy, sz).premultiply(this.m));
        });
      }
      if (this.night > 0.02) {
        // Lights at the front and back, sized to the vehicle (its model's front is +z).
        const type = TYPE_BY_KEY.get(d.key);
        const half = (type?.len ?? 4.5) / 2, halfW = (type?.width ?? 1.8) / 2;
        this.headlights.setMatrixAt(lit, this.lamp.makeScale(halfW, 1, 1).setPosition(0, 0, half - 0.05).premultiply(this.m));
        this.taillights.setMatrixAt(lit++, this.lamp.makeScale(halfW, 1, 1).setPosition(0, 0, -half + 0.05).premultiply(this.m));
      }
      this.v.y = d.ground + 0.03;
      this.m.compose(this.v, this.q, this.shadowScale.set(near.shadow[0], 1, near.shadow[1]));
      this.shadows.setMatrixAt(shadowCount++, this.m);
    }
    for (const [kind, b] of Object.entries(this.batches) as [BatchKey, (typeof this.batches)[BatchKey]][]) {
      b.body.count = b.fixed.count = counts[kind];
      b.body.visible = b.fixed.visible = counts[kind] > 0; // (an empty batch costs no draw)
      b.body.instanceMatrix.needsUpdate = b.fixed.instanceMatrix.needsUpdate = true;
      if (b.body.instanceColor) b.body.instanceColor.needsUpdate = true;
      const f = this.far[kind];
      if (f) {
        f.body.count = f.fixed.count = farCounts[kind] ?? 0;
        f.body.visible = f.fixed.visible = f.body.count > 0;
        f.body.instanceMatrix.needsUpdate = f.fixed.instanceMatrix.needsUpdate = true;
        if (f.body.instanceColor) f.body.instanceColor.needsUpdate = true;
      }
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
    this.roofBoxes.count = roofBoxes;
    this.roofBoxes.instanceMatrix.needsUpdate = true;
    this.riders.forEach((m, i) => {
      m.count = this.riderCounts[i];
      m.visible = m.count > 0;
      m.instanceMatrix.needsUpdate = true;
    });
    this.headlights.count = this.taillights.count = lit;
    this.headlights.instanceMatrix.needsUpdate = this.taillights.instanceMatrix.needsUpdate = true;
  }
}

/** Two headlamps (x in -1..1 of the half width) and the beam they throw on the road ahead (+z). */
function headlightShape() {
  const pos: number[] = [];
  const col: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], ca: number, cb: number) => {
    for (const [p, k] of [[a, ca], [b, ca], [c, cb], [a, ca], [c, cb], [d, cb]] as [number[], number][]) {
      pos.push(...p);
      col.push(k, k * 0.95, k * 0.82);
    }
  };
  for (const x of [-0.72, 0.72]) quad([x - 0.2, 0.55, 0.02], [x + 0.2, 0.55, 0.02], [x + 0.2, 0.78, 0.02], [x - 0.2, 0.78, 0.02], 1, 1);
  // The beam: bright near the car, fading out 14 m ahead.
  quad([-0.95, 0.05, 0.3], [0.95, 0.05, 0.3], [2.6, 0.05, 14], [-2.6, 0.05, 14], 0.42, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** Two red tail lights facing back (-z). */
function taillightShape() {
  const pos: number[] = [];
  for (const x of [-0.78, 0.78]) {
    const [a, b, c, d] = [[x + 0.16, 0.6, -0.02], [x - 0.16, 0.6, -0.02], [x - 0.16, 0.8, -0.02], [x + 0.16, 0.8, -0.02]];
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** The pack's material with its day glow always (even when made at night): vehicles' windows stay glass. */
function dayLookMaterial() {
  const m = epicMaterial().clone();
  m.emissiveMap = epicGlowMaps().day;
  m.emissive.setRGB(0.58, 0.58, 0.58);
  m.emissiveIntensity = 1;
  return m;
}
/** The pack's texture sheet as pixels (to tell which parts of a model are which colour). */
async function atlasPixels(): Promise<{ w: number; h: number; data: Uint8ClampedArray } | null> {
  try {
    const img = new Image();
    img.src = '/models/epic/tex/albedo.png';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
  } catch {
    return null;
  }
}
const WHITE_UV = [0.8241, 0.6677]; // a white cell of the pack's texture sheet
const FAR_M = 30; // beyond this, vehicles (and their riders) are drawn with their simpler shape
/** A simpler copy of a shape (about `ratio` of its triangles), keeping its outline and colour edges. */
async function simpler(g: THREE.BufferGeometry, ratio: number, uv = false): Promise<THREE.BufferGeometry> {
  try {
    await MeshoptSimplifier.ready;
    const keep = uv ? ['position', 'uv'] : ['position'];
    const src = new THREE.BufferGeometry();
    for (const k of keep) src.setAttribute(k, g.getAttribute(k));
    const w = mergeVertices(src, 1e-3);
    const index = new Uint32Array(w.index!.array as ArrayLike<number>);
    const pos = w.getAttribute('position').array as Float32Array;
    const target = Math.max(3, Math.floor((index.length * ratio) / 3) * 3);
    const [out] = MeshoptSimplifier.simplify(index, pos, 3, target, 0.03, ['LockBorder']);
    w.setIndex(new THREE.BufferAttribute(out, 1));
    const flat = w.toNonIndexed();
    flat.computeVertexNormals(); // (flat faces, as the pack's low-poly look)
    flat.computeBoundingSphere();
    return flat;
  } catch {
    return g;
  }
}
/**
 * Splits a pack vehicle into its paintwork (the triangles of the `paint` colours: no texture, painted
 * per vehicle) and everything else (glass, tyres, lights, trim: the pack's own colours).
 */
function splitPaint(geo: THREE.BufferGeometry, atlas: { w: number; h: number; data: Uint8ClampedArray }, paint: string[], white: string[]) {
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
  const index = geo.index;
  const count = index ? index.count : pos.count;
  const out = { paint: { p: [] as number[], n: [] as number[] }, fixed: { p: [] as number[], n: [] as number[], u: [] as number[] } };
  const hex = (u: number, v: number) => {
    const x = Math.min(atlas.w - 1, Math.max(0, Math.floor(u * atlas.w)));
    const y = Math.min(atlas.h - 1, Math.max(0, Math.floor((1 - v) * atlas.h)));
    const i = (y * atlas.w + x) * 4;
    return ((atlas.data[i] << 16) | (atlas.data[i + 1] << 8) | atlas.data[i + 2]).toString(16).padStart(6, '0');
  };
  for (let t = 0; t < count; t += 3) {
    const ids = [0, 1, 2].map((k) => (index ? index.getX(t + k) : t + k));
    const colour = hex(uv.getX(ids[0]), uv.getY(ids[0]));
    const isPaint = paint.includes(colour);
    const makeWhite = white.includes(colour);
    for (const i of ids) {
      const dst = isPaint ? out.paint : out.fixed;
      dst.p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      dst.n.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      if (!isPaint) out.fixed.u.push(makeWhite ? WHITE_UV[0] : uv.getX(i), makeWhite ? WHITE_UV[1] : uv.getY(i));
    }
  }
  const make = (p: number[], n: number[], u?: number[]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.length ? p : [0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n.length ? n : [0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    if (u) g.setAttribute('uv', new THREE.Float32BufferAttribute(u.length ? u : [0, 0, 0, 0, 0, 0], 2));
    g.computeBoundingSphere();
    return g;
  };
  return { paint: make(out.paint.p, out.paint.n), fixed: make(out.fixed.p, out.fixed.n, out.fixed.u) };
}
