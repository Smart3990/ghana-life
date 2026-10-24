// Street-level traffic in real 3D: cars, Accra taxis, trotros and pragya tricycles, built in code from
// simple shapes (nothing to download). Each kind is two batched draws (painted body, and everything
// else in fixed colours), plus one shared batch of soft shadows, so 100 vehicles still cost about
// ten draw calls. Positions come from the shared traffic clock (traffic.ts), the same on every phone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kind, Placed, Traffic } from './traffic';

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

function box(w: number, h: number, l: number, x: number, y: number, z: number, tiltX = 0): Part {
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

function paint(g: Part, colour: string): Part {
  const c = new THREE.Color(colour);
  const n = g.getAttribute('position').count;
  const data = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(data, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return g;
}

// Merge parts into one geometry (positions, normals and colours only).
function merge(parts: Part[]): Part {
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

// A soft round shadow, shared by every vehicle (one batch for all of them).
function shadowTexture() {
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

  constructor(
    private traffic: Traffic,
    private toLocal: (lon: number, lat: number) => [number, number],
    private limit: number,
    private radiusM: number,
  ) {
    const paintMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.25 });
    const fixedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1 });
    const models: Record<Kind, Model> = { car: car(false), taxi: car(true), trotro: trotro(), tricycle: pragya() };
    this.batches = {} as typeof this.batches;
    for (const [kind, model] of Object.entries(models) as [Kind, Model][]) {
      const body = new THREE.InstancedMesh(model.body, paintMat, limit);
      const fixed = new THREE.InstancedMesh(model.fixed, fixedMat, limit);
      for (const mesh of [body, fixed]) {
        mesh.count = 0;
        mesh.frustumCulled = false; // instances spread far beyond the shape's own bounds
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
  }

  /** Puts the nearest vehicles in place for the moment t (seconds of shared time). */
  /** The vehicles drawn last frame (for tests). */
  placed: Placed[] = [];

  update(lon: number, lat: number, t: number, lane: number) {
    const placed: Placed[] = this.traffic.near(lon, lat, t, this.radiusM, this.limit, lane);
    this.placed = placed;
    const counts: Record<Kind, number> = { car: 0, taxi: 0, trotro: 0, tricycle: 0 };
    let shadowCount = 0;
    for (const p of placed) {
      const b = this.batches[p.v.kind];
      const i = counts[p.v.kind]++;
      const [x, z] = this.toLocal(p.lon, p.lat);
      this.q.setFromAxisAngle(this.up, Math.PI - p.heading);
      // A gentle bounce, different for each vehicle, so they don't glide like toys.
      this.v.set(x, Math.sin(t * 9 + p.v.id) * 0.012, z);
      this.m.compose(this.v, this.q, this.s);
      b.body.setMatrixAt(i, this.m);
      b.fixed.setMatrixAt(i, this.m);
      b.body.setColorAt(i, this.c.set(p.v.colour));
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
  }
}
