// Street-level traffic in real 3D: cars, Accra taxis, trotros and pragya tricycles, built in code from
// simple shapes (nothing to download). Each kind is two batched draws (painted body, and everything
// else in fixed colours), plus one shared batch of soft shadows, so 100 vehicles still cost about
// ten draw calls. Positions come from the shared traffic clock (traffic.ts), the same on every phone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Kind, Placed, Traffic } from './traffic';

// Real-looking vehicles (public/models/vehicles): small textured models, about 300 to 480 triangles
// each, from the free PSX Style Cars pack, repainted in Accra colours (see scripts/vehicles). Each
// model and paint is one batch. Kinds not listed here keep the shapes built in code below.
const SKINS = (name: string, n: number) => Array.from({ length: n }, (_, i) => `${name}-${i}`);
const REAL: Partial<Record<Kind, { model: string; skins: string[] }[]>> = {
  car: [
    { model: 'wagon', skins: SKINS('wagon', 6) },
    { model: 'sedan', skins: SKINS('sedan', 6) },
    { model: 'hatch', skins: SKINS('hatch', 5) },
  ],
  taxi: [{ model: 'sedan', skins: SKINS('taxi', 5) }], // Accra taxi: yellow front and back corners
  suv: [{ model: 'wagon', skins: ['wagon-1', 'wagon-3', 'wagon-4'] }],
  trotro: [{ model: 'van', skins: ['van-0'] }],
  truck: [{ model: 'boxtruck', skins: ['boxtruck-0'] }],
};
// The models face the same way as the shapes built in code (checked with a parked test car).
const REAL_TURN = 0;

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
  private batches: Record<Kind, { body: THREE.InstancedMesh; fixed: THREE.InstancedMesh; shadow: [number, number] }>;
  private shadows: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private shadowScale = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private c = new THREE.Color();
  // Real models, once downloaded: for each kind, a list of batches (one per model and paint).
  private real: Partial<Record<Kind, THREE.InstancedMesh[]>> = {};
  private realCount = new Map<THREE.InstancedMesh, number>();

  constructor(
    private traffic: Traffic,
    private toLocal: (lon: number, lat: number) => [number, number],
    public limit: number,
    private radiusM: number,
  ) {
    const paintMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.25 });
    const fixedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
    const models: Record<Kind, Model> = { car: car(false), taxi: car(true), trotro: trotro(), tricycle: pragya(), okada: okada(), bus: bus(), truck: truck(), pickup: pickup(), suv: suv() };
    this.batches = {} as typeof this.batches;
    for (const [kind, model] of Object.entries(models) as [Kind, Model][]) {
      const body = new THREE.InstancedMesh(model.body, paintMat, limit);
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
    void this.loadReal(limit);
  }

  private async loadReal(limit: number) {
    try {
      const loader = new GLTFLoader();
      const textures = new THREE.TextureLoader();
      const geometry = new Map<string, Promise<THREE.BufferGeometry>>();
      const geo = (name: string) => {
        if (!geometry.has(name))
          geometry.set(name, loader.loadAsync(`/models/vehicles/${name}.glb`).then((g) => {
            let found: THREE.BufferGeometry | null = null;
            g.scene.traverse((o) => {
              if ((o as THREE.Mesh).isMesh && !found) found = (o as THREE.Mesh).geometry;
            });
            return found!;
          }));
        return geometry.get(name)!;
      };
      const real: Partial<Record<Kind, THREE.InstancedMesh[]>> = {};
      for (const [kind, options] of Object.entries(REAL) as [Kind, { model: string; skins: string[] }[]][]) {
        const skins = options.reduce((n, o) => n + o.skins.length, 0);
        const list: THREE.InstancedMesh[] = [];
        for (const o of options) {
          const g = await geo(o.model);
          for (const skin of o.skins) {
            const map = await textures.loadAsync(`/models/vehicles/${skin}.png`);
            map.colorSpace = THREE.SRGBColorSpace;
            map.flipY = false; // glTF texture coordinates
            map.anisotropy = 4;
            const mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ map, roughness: 0.5, metalness: 0.15 }), Math.max(4, Math.ceil((limit / skins) * 2)));
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.castShadow = true;
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            list.push(mesh);
          }
        }
        real[kind] = list;
      }
      for (const list of Object.values(real)) for (const m of list) this.group.add(m);
      this.real = real;
    } catch {
      // The models did not download: the shapes built in code stay.
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
  private lastS = new Map<number, number>();
  private lastT = 0;
  /** Is this point on a street drawn at ground level? (Set by the street test.) */
  onStreet: ((x: number, z: number) => boolean) | null = null;
  /** Called when a driver hoots at the player (x, z in metres). */
  onHoot: ((x: number, z: number) => void) | null = null;

  update(lon: number, lat: number, t: number, lane: number, player?: { x: number; z: number }) {
    const dt = this.lastT ? Math.min(0.1, Math.max(0, t - this.lastT)) : 0;
    this.lastT = t;
    // Only vehicles on streets we draw: the route data also has flyovers and slip roads, which at
    // street level would look like cars floating across open ground.
    const placed: Placed[] = this.traffic.near(lon, lat, t, this.radiusM, this.limit, lane).filter((p) => {
      if (!this.onStreet) return true;
      const [x, z] = this.toLocal(p.lon, p.lat);
      return this.onStreet(x, z);
    });
    this.placed = placed;
    // Front of each route first, so the ones behind can keep their distance.
    const byRoute = new Map<number, Placed[]>();
    for (const p of placed) {
      // Each lane of each route queues on its own.
      const key = p.v.route * 2 + p.v.lane;
      const list = byRoute.get(key) ?? [];
      list.push(p);
      byRoute.set(key, list);
    }
    for (const list of byRoute.values()) {
      list.sort((a, b) => b.s - a.s);
      let frontS = Infinity;
      let frontHalf = 0;
      for (const p of list) {
        const half = KIND_LENGTH[p.v.kind] / 2;
        let held = this.held.get(p.v.id) ?? 0;
        let s = p.s - held;
        let pos = held ? this.traffic.at(p.v, s, lane) : p;
        let stopped = false;
        if (player) {
          // Is the player standing in this vehicle's lane, just ahead?
          const [x, z] = this.toLocal(pos.lon, pos.lat);
          const fx = Math.sin(pos.heading);
          const fz = -Math.cos(pos.heading);
          const ahead = (player.x - x) * fx + (player.z - z) * fz;
          const side = Math.abs((player.x - x) * -fz + (player.z - z) * fx);
          if (ahead > -half && ahead < half + 9 && side < 1.7) stopped = true;
        }
        // Stopped: stay exactly where it was last frame, however long the frame took.
        if (stopped) held = Math.max(held, p.s - (this.lastS.get(p.v.id) ?? p.s - held));
        else held = Math.max(0, held - p.v.speed * 0.35 * dt); // then catch up gently
        // Keep a gap to the vehicle in front.
        const gap = frontHalf + half + 1.6; // nose to tail, Accra style
        if (p.s - held > frontS - gap) held = p.s - (frontS - gap);
        s = p.s - held;
        if (held > 0.01) {
          pos = this.traffic.at(p.v, s, lane);
          p.lon = pos.lon;
          p.lat = pos.lat;
          p.heading = pos.heading;
          this.held.set(p.v.id, held);
        } else this.held.delete(p.v.id);
        // Hoot after waiting a moment.
        const waited = stopped ? (this.blockedFor.get(p.v.id) ?? 0) + dt : 0;
        if (waited > 1.2 && this.onHoot) {
          const [x, z] = this.toLocal(p.lon, p.lat);
          this.onHoot(x, z);
          this.blockedFor.set(p.v.id, -2.5); // hoot again in a few seconds if still blocked
        } else this.blockedFor.set(p.v.id, waited);
        this.lastS.set(p.v.id, s);
        frontS = s;
        frontHalf = half;
      }
    }
    // Many routes share the same roads: every vehicle also keeps its distance from whatever is ahead
    // of it in its lane, whichever route that one is on (two passes settle short queues).
    const local = placed.map((p) => {
      const [x, z] = this.toLocal(p.lon, p.lat);
      return { p, x, z, fx: Math.sin(p.heading), fz: -Math.cos(p.heading), half: KIND_LENGTH[p.v.kind] / 2, halfW: KIND_WIDTH[p.v.kind] / 2 };
    });
    type L = (typeof local)[number];
    // Is b in the way of a, just in front of it? (Works for any angle, so crossings are handled too.)
    const inPath = (a: L, b: L) => {
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const ahead = dx * a.fx + dz * a.fz;
      if (ahead <= 0) return 0;
      const side = Math.abs(dx * -a.fz + dz * a.fx);
      const dot = Math.abs(a.fx * b.fx + a.fz * b.fz);
      const cross = Math.sqrt(Math.max(0, 1 - dot * dot));
      const across = b.half * cross + b.halfW * dot; // how far b reaches sideways from a's point of view
      const along = b.half * dot + b.halfW * cross; // and along a's direction
      if (side > a.halfW + across + 0.25) return 0;
      const need = a.half + along + 1.5;
      return ahead < need ? need - ahead : 0;
    };
    for (let pass = 0; pass < 2; pass++) {
      for (const a of local) {
        let push = 0;
        for (const b of local) {
          if (a === b || Math.abs(b.x - a.x) > 16 || Math.abs(b.z - a.z) > 16) continue;
          const dot = a.fx * b.fx + a.fz * b.fz;
          if (dot < -0.7) continue; // oncoming traffic is in the other lanes
          const need = inPath(a, b);
          if (!need) continue;
          // Same direction: the one behind waits. At a crossing, whoever has the other in front of
          // them waits; if both do, the lower number goes first, so nobody is stuck for ever.
          if (dot < 0.7 && inPath(b, a) && a.p.v.id < b.p.v.id) continue;
          push = Math.max(push, need);
        }
        if (push > 0.05) {
          const held = (this.held.get(a.p.v.id) ?? 0) + push;
          this.held.set(a.p.v.id, held);
          const pos = this.traffic.at(a.p.v, a.p.s - held, lane);
          a.p.lon = pos.lon;
          a.p.lat = pos.lat;
          a.p.heading = pos.heading;
          [a.x, a.z] = this.toLocal(pos.lon, pos.lat);
          a.fx = Math.sin(pos.heading);
          a.fz = -Math.cos(pos.heading);
          this.lastS.set(a.p.v.id, a.p.s - held);
        }
      }
    }
    this.boxes = local.map((a) => ({ x: a.x, z: a.z, fx: a.fx, fz: a.fz, half: a.half, halfW: a.halfW }));
    const counts: Record<Kind, number> = { car: 0, taxi: 0, trotro: 0, tricycle: 0, okada: 0, bus: 0, truck: 0, pickup: 0, suv: 0 };
    let shadowCount = 0;
    for (const m of this.realCount.keys()) this.realCount.set(m, 0);
    for (const p of placed) {
      const b = this.batches[p.v.kind];
      const [x, z] = this.toLocal(p.lon, p.lat);
      // A gentle bounce, different for each vehicle, so they don't glide like toys.
      this.v.set(x, Math.sin(t * 9 + p.v.id) * 0.012, z);
      const realList = this.real[p.v.kind];
      if (realList?.length) {
        // A real model: the vehicle's number picks its model and paint, the same on every phone.
        const mesh = realList[Math.abs(p.v.id * 7 + 3) % realList.length];
        const n = this.realCount.get(mesh) ?? 0;
        if (n < mesh.instanceMatrix.count) {
          this.q.setFromAxisAngle(this.up, Math.PI - p.heading + REAL_TURN);
          this.m.compose(this.v, this.q, this.s);
          mesh.setMatrixAt(n, this.m);
          this.realCount.set(mesh, n + 1);
        }
      } else {
        const i = counts[p.v.kind]++;
        this.q.setFromAxisAngle(this.up, Math.PI - p.heading);
        this.m.compose(this.v, this.q, this.s);
        b.body.setMatrixAt(i, this.m);
        b.fixed.setMatrixAt(i, this.m);
        b.body.setColorAt(i, this.c.set(p.v.colour));
      }
      this.q.setFromAxisAngle(this.up, Math.PI - p.heading);
      this.v.y = 0.03;
      this.m.compose(this.v, this.q, this.shadowScale.set(b.shadow[0], 1, b.shadow[1]));
      this.shadows.setMatrixAt(shadowCount++, this.m);
    }
    for (const [kind, b] of Object.entries(this.batches) as [Kind, (typeof this.batches)[Kind]][]) {
      b.body.count = b.fixed.count = counts[kind];
      b.body.instanceMatrix.needsUpdate = b.fixed.instanceMatrix.needsUpdate = true;
      if (b.body.instanceColor) b.body.instanceColor.needsUpdate = true;
    }
    this.shadows.count = shadowCount;
    this.shadows.instanceMatrix.needsUpdate = true;
    for (const list of Object.values(this.real)) {
      for (const mesh of list) {
        mesh.count = this.realCount.get(mesh) ?? 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
