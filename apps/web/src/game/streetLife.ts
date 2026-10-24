// Street life: trees and palms, street lights, container kiosks, vendors' umbrellas, black polytanks
// on the roofs, and crowds of people on the pavements. Everything is placed from the real roads and
// buildings in the map tiles, the same way every time (fixed random numbers from positions).
//
// Cost: each kind of thing is one batched draw, refreshed only when the player has moved a fair way.
// People are drawn in big batches animated by the graphics card (crowd.ts).
import * as THREE from 'three';
import { box, merge, paint, shadowTexture } from './vehicles3d';
import type { Roof, StreetLine } from './streetBuildings';
import { CrowdBatch, lookFor, MIX, type Clip, type CrowdBody, type Kind as PersonKind, type Look } from './crowd';

type Part = THREE.BufferGeometry;
type Spot = { x: number; z: number; angle: number; scale: number; colour: number };

// Road sizes (metres): must match the street style (src/map/streetStyle.ts).
const HALF: Record<string, { half: number; walk: number }> = {
  highway: { half: 7, walk: 2.5 },
  major_road: { half: 5, walk: 2.5 },
  minor_road: { half: 3.25, walk: 1.8 },
};
const GUTTER = 0.55;

const hash = (a: number, b: number) => {
  let x = Math.imul(Math.floor(a * 10) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(Math.floor(b * 10), 0xc2b2ae35);
  x = Math.imul(x ^ (x >>> 13), 0x27d4eb2d);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// ---------- The things, built from simple shapes ----------

function neem(): Part {
  const leaf = ['#4f7a35', '#5e8a3c', '#476f30'];
  const parts: Part[] = [paint(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6).translate(0, 1.3, 0), '#6b4f37')];
  const blobs: [number, number, number, number][] = [[0, 3.6, 0, 1.7], [0.9, 3.2, 0.3, 1.2], [-0.8, 3.3, -0.4, 1.25], [0.2, 4.3, -0.5, 1.1]];
  blobs.forEach(([x, y, z, r], i) => parts.push(paint(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), leaf[i % 3])));
  return merge(parts);
}

function palm(): Part {
  const parts: Part[] = [];
  // A gently curved trunk from short sections.
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.CylinderGeometry(0.15, 0.19, 1.25, 6);
    seg.rotateZ(i * 0.035);
    seg.translate(i * 0.07, 0.62 + i * 1.2, 0);
    parts.push(paint(seg, i % 2 ? '#8a7356' : '#7c664b'));
  }
  for (let k = 0; k < 7; k++) {
    const frond = new THREE.ConeGeometry(0.35, 3.2, 3, 1);
    frond.rotateZ(Math.PI / 2 + 0.45);
    frond.translate(1.5, 0, 0);
    frond.rotateY((k / 7) * Math.PI * 2);
    frond.translate(0.42, 7.4, 0);
    parts.push(paint(frond, k % 2 ? '#5f8f3a' : '#4d7b31'));
  }
  return merge(parts);
}

function streetLight(): Part {
  return merge([
    paint(new THREE.CylinderGeometry(0.07, 0.1, 7.5, 6).translate(0, 3.75, 0), '#7d8287'),
    paint(box(0.08, 0.08, 1.6, 0, 7.45, 0.75), '#7d8287'),
    paint(box(0.3, 0.12, 0.55, 0, 7.38, 1.55), '#e9e3cf'),
  ]);
}

function kiosk(): Part {
  // A container shop: painted box, dark open front with a counter, and a sloping awning.
  return merge([
    paint(box(2.4, 2.5, 2.4, 0, 1.25, 0), '#ffffff'),
    paint(box(1.9, 1.3, 0.04, 0, 1.45, 1.21), '#2b2620'),
    paint(box(2.0, 0.08, 0.35, 0, 0.82, 1.35), '#d9d2c2'),
    paint(box(2.7, 0.06, 1.1, 0, 2.6, 1.6, 0.25), '#ffffff'),
    paint(box(2.5, 0.12, 2.5, 0, 2.55, 0), '#8f959b'),
  ]);
}

function umbrella(): Part {
  return merge([
    paint(new THREE.ConeGeometry(1.4, 0.55, 8).translate(0, 2.25, 0), '#ffffff'),
    paint(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5).translate(0, 1.1, 0), '#d0d0d0'),
    paint(box(0.9, 0.06, 0.6, 0, 0.75, 0), '#6b4f37'),
    paint(box(0.06, 0.75, 0.06, 0.4, 0.37, 0.25), '#6b4f37'),
    paint(box(0.06, 0.75, 0.06, -0.4, 0.37, -0.25), '#6b4f37'),
  ]);
}

function polytank(): Part {
  return merge([
    paint(new THREE.CylinderGeometry(0.62, 0.62, 1.25, 10).translate(0, 0.9, 0), '#1d1e20'),
    paint(new THREE.CylinderGeometry(0.2, 0.62, 0.18, 10).translate(0, 1.6, 0), '#26282a'),
    paint(box(1.3, 0.28, 1.3, 0, 0.14, 0), '#9a9590'),
  ]);
}

const KIOSK_COLOURS = [0x2f8f57, 0xe3a92b, 0xc8442e, 0x1f5fa8, 0xf2efe6, 0x7a3e9d];
const UMBRELLA_COLOURS = [0xe3a92b, 0xc8442e, 0x2f8f57, 0x1f5fa8, 0xf2efe6];

type Batch = { mesh: THREE.InstancedMesh; all: Spot[]; tint: boolean };

// ---------- People on the pavements ----------

/** A pavement: a line of points (x, z pairs) with the distance along it at each point. */
type Walkway = { pts: Float32Array; cum: Float32Array; total: number; cx: number; cz: number };
type Agent = {
  kind: PersonKind;
  look: Look & { load: 'basin' | 'tray' | null };
  batch: CrowdBody;
  slot: number;
  run: Walkway | null;
  spot: { x: number; z: number; face: number } | null;
  s0: number;
  speed: number;
  lateral: number;
  still: boolean;
  leader: number; // school children walk in groups behind a leader (-1 = no group)
};

function headLoad(kind: 'basin' | 'tray'): Part {
  if (kind === 'basin') {
    // An aluminium basin piled with goods.
    return merge([
      paint(new THREE.CylinderGeometry(0.34, 0.2, 0.15, 12, 1, true).translate(0, 0.075, 0), '#c9ccd0'),
      paint(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12).translate(0, 0.01, 0), '#b8bbbf'),
      paint(new THREE.SphereGeometry(0.28, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1).translate(0, 0.13, 0), '#d98a3a'),
    ]);
  }
  // A wooden tray of small goods.
  return merge([
    paint(box(0.62, 0.05, 0.46, 0, 0.025, 0), '#8a6a4a'),
    paint(box(0.18, 0.12, 0.14, -0.16, 0.11, -0.1), '#e3a92b'),
    paint(box(0.18, 0.1, 0.14, 0.12, 0.1, 0.08), '#c8442e'),
    paint(box(0.14, 0.14, 0.12, 0.15, 0.12, -0.12), '#f2efe6'),
    paint(box(0.16, 0.09, 0.14, -0.12, 0.095, 0.12), '#2f7d55'),
  ]);
}

export class StreetLife {
  readonly group = new THREE.Group();
  private batches: Batch[] = [];
  private walkways: Walkway[] = [];
  // The middle of the big roads, where hawkers walk between the queuing cars.
  private centreWays: Walkway[] = [];
  private nearCentre: Walkway[] = [];
  private agents: Agent[] = [];
  private crowds: Partial<Record<CrowdBody, CrowdBatch>> = {};
  private loads: Record<'basin' | 'tray', THREE.InstancedMesh>;
  private gatherings: { x: number; z: number; face: number }[] = [];
  private time = { value: 0 };
  private density = 1;

  /** Share of the crowd to show (1 = everyone): lowered automatically when the phone struggles. */
  setDensity(d: number) {
    this.density = Math.max(0.2, Math.min(1, d));
    for (const b of Object.values(this.crowds)) if (b) b.mesh.count = Math.floor(b.count * this.density);
  }
  private lastRefresh = { x: Infinity, z: Infinity };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private colour = new THREE.Color();
  private shadowBatch: THREE.InstancedMesh;

  constructor(
    private blocked: (x: number, z: number, margin: number) => boolean,
    private opts: { radiusM: number; people: number; props: number; smoothCrowd?: boolean },
  ) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
    const make = (geometry: Part, tint: boolean) => {
      const mesh = new THREE.InstancedMesh(geometry, mat, opts.props);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      if (tint) mesh.setColorAt(0, this.colour.set(0xffffff));
      this.group.add(mesh);
      const b: Batch = { mesh, all: [], tint };
      this.batches.push(b);
      return b;
    };
    this.trees = make(neem(), true);
    this.palms = make(palm(), true);
    this.lights = make(streetLight(), false);
    this.kiosks = make(kiosk(), true);
    this.umbrellas = make(umbrella(), true);
    this.tanks = make(polytank(), false);
    this.shadowBatch = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
      opts.props + opts.people,
    );
    this.shadowBatch.count = 0;
    this.shadowBatch.frustumCulled = false;
    this.group.add(this.shadowBatch);
    const loadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
    this.loads = { basin: new THREE.InstancedMesh(headLoad('basin'), loadMat, opts.people), tray: new THREE.InstancedMesh(headLoad('tray'), loadMat, opts.people) };
    for (const l of Object.values(this.loads)) {
      l.count = 0;
      l.frustumCulled = false;
      this.group.add(l);
    }
    this.makePeople();
  }
  private trees: Batch;
  private palms: Batch;
  private lights: Batch;
  private kiosks: Batch;
  private umbrellas: Batch;
  private tanks: Batch;

  // Everyone who will be out on the streets, with their looks fixed for the session.
  private async makePeople() {
    const [male, female] = await Promise.all([
      CrowdBatch.create('male', this.opts.people, this.time, this.opts.smoothCrowd),
      CrowdBatch.create('female', this.opts.people, this.time, this.opts.smoothCrowd),
    ]);
    this.crowds = { male, female };
    this.group.add(male.mesh, female.mesh);
    const total = MIX.reduce((n, [, w]) => n + w, 0);
    for (let i = 0; i < this.opts.people; i++) {
      // School children come in groups of three or four; friends walk together in twos and threes.
      const prev = this.agents[i - 1];
      const head = prev ? (prev.leader === -1 ? i - 1 : prev.leader) : -1;
      const size = prev ? i - head : 0;
      const groupKind = prev && !prev.still && ['pupil', 'man', 'woman', 'church', 'muslimWoman'].includes(prev.kind) ? prev.kind : null;
      const wantGroup = groupKind && (groupKind === 'pupil' ? size < 3 + Math.floor(hash(head, 1) * 2) : hash(head, 12) < 0.45 && size < 2 + Math.floor(hash(head, 13) * 2));
      const inGroup = !!wantGroup;
      let kind: PersonKind = groupKind && inGroup ? (groupKind as PersonKind) : 'pupil';
      if (!inGroup) {
        let r = hash(i, 2) * total;
        kind = MIX.find(([, w]) => (r -= w) < 0)?.[0] ?? 'man';
      }
      const look = lookFor(kind, (k) => hash(i, 40 + k));
      const batch = this.crowds[look.body]!;
      const slot = batch.count++;
      const still = !inGroup && kind !== 'pupil' && kind !== 'kayayo' && kind !== 'hawker' && hash(i, 3) < 0.3;
      const speed = (kind === 'pupil' || kind === 'child' ? 1.0 : 1.15) + hash(i, 4) * 0.45;
      const clip: Clip = still ? (hash(i, 5) < 0.6 ? 'talk' : 'idle') : 'walk';
      // Feet match the ground: play the walk faster or slower with speed and size.
      const rate = clip === 'walk' ? speed / (1.35 * look.scale) : 1;
      batch.setLook(slot, look, clip, hash(i, 6) * 10, rate);
      this.agents.push({
        kind, look, batch: look.body, slot, run: null, spot: null,
        s0: hash(i, 7) * 500, speed, lateral: (hash(i, 8) - 0.5) * 1.1, still,
        leader: inGroup ? head : -1,
      });
    }
    this.setDensity(this.density);
  }

  // Road pieces in a grid of 25 m squares, so things are never put on a road.
  private roadGrid = new Map<string, number[]>();
  private addToGrid(x1: number, z1: number, x2: number, z2: number, half: number) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    for (let s = 0; s <= len; s += 10) {
      const k = `${Math.floor((x1 + ((x2 - x1) * s) / (len || 1)) / 25)},${Math.floor((z1 + ((z2 - z1) * s) / (len || 1)) / 25)}`;
      const list = this.roadGrid.get(k) ?? [];
      if (list.length && list[list.length - 5] === x1 && list[list.length - 4] === z1) continue;
      list.push(x1, z1, x2, z2, half);
      this.roadGrid.set(k, list);
    }
  }
  private onRoad(x: number, z: number, margin: number) {
    const cx = Math.floor(x / 25);
    const cz = Math.floor(z / 25);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const list = this.roadGrid.get(`${cx + i},${cz + j}`);
      if (!list) continue;
      for (let k = 0; k < list.length; k += 5) {
        const [ax, az, bx, bz, half] = [list[k], list[k + 1], list[k + 2], list[k + 3], list[k + 4]];
        const dx = bx - ax;
        const dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        if (Math.hypot(ax + dx * t - x, az + dz * t - z) < half + margin) return true;
      }
    }
    return false;
  }
  private free(x: number, z: number, margin: number) {
    return !this.blocked(x, z, margin) && !this.onRoad(x, z, margin);
  }

  /** New roads and roofs from a tile: place things along them. */
  add(roads: StreetLine[], roofs: Roof[]) {
    for (const road of roads) {
      const size = HALF[road.kind];
      if (!size) continue;
      for (let i = 0; i + 3 < road.pts.length; i += 2) this.addToGrid(road.pts[i], road.pts[i + 1], road.pts[i + 2], road.pts[i + 3], size.half + GUTTER);
    }
    for (const road of roads) {
      const size = HALF[road.kind];
      if (!size) continue;
      const pts = road.pts;
      let carried = 0;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const [x1, z1, x2, z2] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
        const len = Math.hypot(x2 - x1, z2 - z1);
        if (len < 0.5) continue;
        const dx = (x2 - x1) / len;
        const dz = (z2 - z1) / len;
        const angle = Math.atan2(dx, -dz); // clockwise from north, along the road
        const spacing = road.kind === 'minor_road' ? 14 : 16;
        for (let s = (spacing - carried) % spacing; s < len; s += spacing) {
          const x = x1 + dx * s;
          const z = z1 + dz * s;
          const r = hash(x, z);
          const side = hash(z, x) < 0.5 ? 1 : -1;
          const edge = size.half + GUTTER + size.walk;
          const at = (extra: number) => [x - dz * (edge + extra) * side, z + dx * (edge + extra) * side] as const;
          const facing = angle + (side > 0 ? -Math.PI / 2 : Math.PI / 2); // facing the road
          if (road.kind !== 'minor_road' && Math.round(s / spacing) % 2 === 0) {
            // Street lights along the big roads, at the kerb.
            const [lx, lz] = [x - dz * (size.half + GUTTER + 0.3) * side, z + dx * (size.half + GUTTER + 0.3) * side];
            if (!this.onRoad(lx, lz, 0.1)) this.lights.all.push({ x: lx, z: lz, angle: facing + Math.PI, scale: 1, colour: 0 });
          }
          if (r < 0.22) {
            const [tx, tz] = at(1.2);
            if (this.free(tx, tz, 1.2)) {
              const b = r < 0.08 ? this.palms : this.trees;
              b.all.push({ x: tx, z: tz, angle: r * 40, scale: 0.85 + hash(tx, tz) * 0.45, colour: 0xffffff });
            }
          } else if (r < 0.34 && road.kind !== 'minor_road') {
            const [kx, kz] = at(1.5);
            if (this.free(kx, kz, 1.6)) this.kiosks.all.push({ x: kx, z: kz, angle: facing, scale: 1, colour: KIOSK_COLOURS[Math.floor(hash(kx, kz) * KIOSK_COLOURS.length)] });
          } else if (r < 0.42) {
            const [ux, uz] = at(-size.walk / 2);
            if (this.free(ux, uz, 0.9)) this.umbrellas.all.push({ x: ux, z: uz, angle: r * 30, scale: 1, colour: UMBRELLA_COLOURS[Math.floor(hash(ux, uz) * UMBRELLA_COLOURS.length)] });
          }
        }
        carried = (carried + len) % spacing;
      }
    }
    // A pavement on each side of each road, for people to walk on (split where a building or another road is in the way).
    for (const road of roads) {
      const size = HALF[road.kind];
      if (!size?.walk) continue;
      for (const side of [1, -1]) this.addWalkways(road.pts, (size.half + GUTTER + size.walk / 2) * side);
      if (road.kind !== 'minor_road' && road.pts.length >= 4) {
        const cum = new Float32Array(road.pts.length / 2);
        for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(road.pts[i * 2] - road.pts[i * 2 - 2], road.pts[i * 2 + 1] - road.pts[i * 2 - 1]);
        const total = cum[cum.length - 1];
        if (total > 15) this.centreWays.push({ pts: road.pts, cum, total, cx: road.pts[0], cz: road.pts[1] });
      }
    }
    for (const k of this.kiosks.all.concat(this.umbrellas.all)) this.gatherings.push({ x: k.x, z: k.z, face: k.angle });
    for (const roof of roofs) {
      if (hash(roof.x, roof.z) < 0.35) this.tanks.all.push({ x: roof.x, z: roof.z, angle: roof.id, scale: 1, colour: 0, y: roof.top } as Spot & { y: number });
    }
    this.lastRefresh = { x: Infinity, z: Infinity }; // show the new things straight away
  }

  private addWalkways(pts: Float32Array, off: number) {
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 4) {
        const cum = new Float32Array(run.length / 2);
        for (let i = 1; i < cum.length; i++) cum[i] = cum[i - 1] + Math.hypot(run[i * 2] - run[i * 2 - 2], run[i * 2 + 1] - run[i * 2 - 1]);
        const total = cum[cum.length - 1];
        if (total > 8) this.walkways.push({ pts: new Float32Array(run), cum, total, cx: run[0], cz: run[1] });
      }
      run = [];
    };
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      // Sideways from the road, using the road's direction at this point.
      const a = Math.max(0, i - 1);
      const b = Math.min(n - 1, i + 1);
      const dx = pts[b * 2] - pts[a * 2];
      const dz = pts[b * 2 + 1] - pts[a * 2 + 1];
      const len = Math.hypot(dx, dz) || 1;
      const x = pts[i * 2] - (dz / len) * off;
      const z = pts[i * 2 + 1] + (dx / len) * off;
      if (!this.free(x, z, 0.15)) {
        flush();
        continue;
      }
      // Long road pieces get extra points, so a blocked stretch only cuts out a little.
      if (run.length) {
        const [px, pz] = [run[run.length - 2], run[run.length - 1]];
        const gap = Math.hypot(x - px, z - pz);
        let broke = false;
        for (let s = 6; s < gap; s += 6) {
          const mx = px + ((x - px) * s) / gap;
          const mz = pz + ((z - pz) * s) / gap;
          if (!this.free(mx, mz, 0.15)) {
            flush();
            broke = true;
            break;
          }
          run.push(mx, mz);
        }
        if (broke) continue;
      }
      run.push(x, z);
    }
    flush();
  }

  /** Call every frame. */
  update(x: number, z: number, dt: number, t: number) {
    this.time.value = t;
    if (Math.hypot(x - this.lastRefresh.x, z - this.lastRefresh.z) > 30) this.refresh(x, z);
    this.movePeople(x, z, t);
    void dt;
  }

  // Draw only the things near the player (rebuilt after moving 30 m).
  private nearWalkways: Walkway[] = [];
  private nearLength = 0;
  private nearSpots: { x: number; z: number; face: number }[] = [];
  private refresh(x: number, z: number) {
    this.lastRefresh = { x, z };
    // People stay close to the player (within about 65 m), so the streets around you are packed.
    const reach = Math.min(65, this.opts.radiusM * 0.75);
    this.nearWalkways = this.walkways.filter((w) => {
      for (let i = 0; i < w.pts.length; i += 2) if (Math.abs(w.pts[i] - x) < reach && Math.abs(w.pts[i + 1] - z) < reach) return true;
      return false;
    });
    this.nearLength = this.nearWalkways.reduce((n, w) => n + w.total, 0);
    this.nearCentre = this.centreWays.filter((w) => {
      for (let i = 0; i < w.pts.length; i += 2) if (Math.abs(w.pts[i] - x) < reach && Math.abs(w.pts[i + 1] - z) < reach) return true;
      return false;
    });
    this.nearSpots = this.gatherings.filter((g) => Math.hypot(g.x - x, g.z - z) < reach);
    const r2 = this.opts.radiusM ** 2;
    let shadows = 0;
    for (const b of this.batches) {
      let n = 0;
      for (const s of b.all) {
        if ((s.x - x) ** 2 + (s.z - z) ** 2 > r2 || n >= this.opts.props) continue;
        const y = (s as Spot & { y?: number }).y ?? 0;
        this.q.setFromAxisAngle(this.up, Math.PI - s.angle);
        this.m.compose(this.p.set(s.x, y, s.z), this.q, this.sc.setScalar(s.scale));
        b.mesh.setMatrixAt(n, this.m);
        if (b.tint) b.mesh.setColorAt(n, this.colour.set(s.colour));
        n++;
        if (y === 0 && b !== this.lights && shadows < this.opts.props) {
          const size = b === this.kiosks ? 3.4 : b === this.umbrellas ? 2.6 : 3.2 * s.scale;
          this.m.compose(this.p.set(s.x, 0.04, s.z), this.q, this.sc.set(size, 1, size));
          this.shadowBatch.setMatrixAt(shadows++, this.m);
        }
      }
      b.mesh.count = n;
      b.mesh.instanceMatrix.needsUpdate = true;
      if (b.mesh.instanceColor) b.mesh.instanceColor.needsUpdate = true;
    }
    this.propShadows = shadows;
  }
  private propShadows = 0;

  // Picks a pavement near the player, longer ones more often (so people spread evenly).
  private pickWalkway(r: number) {
    let left = r * this.nearLength;
    for (const w of this.nearWalkways) if ((left -= w.total) < 0) return w;
    return this.nearWalkways[this.nearWalkways.length - 1] ?? null;
  }

  private pointOn(w: Walkway, s: number): [number, number, number] {
    let lo = 0;
    let hi = w.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (w.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const seg = w.cum[hi] - w.cum[lo] || 1;
    const k = (s - w.cum[lo]) / seg;
    const [x1, z1, x2, z2] = [w.pts[lo * 2], w.pts[lo * 2 + 1], w.pts[hi * 2], w.pts[hi * 2 + 1]];
    return [x1 + (x2 - x1) * k, z1 + (z2 - z1) * k, Math.atan2(x2 - x1, -(z2 - z1))];
  }

  private movePeople(x: number, z: number, t: number) {
    let shadows = this.propShadows;
    const loadCount = { basin: 0, tray: 0 };
    const far = Math.min(85, this.opts.radiusM * 0.8);
    for (const [i, a] of this.agents.entries()) {
      const batch = this.crowds[a.batch];
      if (!batch || a.slot >= batch.mesh.count) continue; // not shown at the current density
      const leader = a.leader >= 0 ? this.agents[a.leader] : null;
      // Someone who has fallen far behind the player moves to a pavement (or a kiosk) nearby.
      if (leader) {
        a.run = leader.run;
        a.s0 = leader.s0;
      } else if (!a.run || this.tooFar(a, x, z, t, far)) {
        // Hawkers (and some kayayei) work the traffic, walking between the lanes.
        const inTraffic = (a.kind === 'hawker' || (a.kind === 'kayayo' && hash(i, 14) < 0.35)) && this.nearCentre.length;
        a.run = inTraffic ? this.nearCentre[Math.floor(hash(i, t) * this.nearCentre.length)] : this.pickWalkway(hash(i, Math.floor(t)));
        a.spot = a.still && this.nearSpots.length && hash(i, 9) < 0.7 ? this.nearSpots[Math.floor(hash(i, t) * this.nearSpots.length)] : null;
      }
      let px: number;
      let pz: number;
      let heading: number;
      if (a.spot) {
        // Standing at a kiosk or a vendor's umbrella, facing it.
        const ang = hash(i, 21) * Math.PI * 2;
        px = a.spot.x + Math.sin(ang) * 1.6;
        pz = a.spot.z - Math.cos(ang) * 1.6;
        heading = ang + Math.PI;
      } else if (a.run) {
        const w = a.run;
        const along = a.still ? a.s0 % w.total : (a.s0 + t * (leader ? leader.speed : a.speed)) % (w.total * 2);
        const forward = along < w.total;
        let s = forward ? along : w.total * 2 - along;
        if (leader) s = Math.max(0, Math.min(w.total, s - (forward ? 1 : -1) * (1 + ((i - a.leader) % 3) * 0.9)));
        const [qx, qz, dir] = this.pointOn(w, s);
        heading = forward ? dir : dir + Math.PI;
        // Keep to the right of the pavement a little, so people pass each other.
        const side = (a.still ? a.lateral : 0.45 * (forward ? 1 : -1) + a.lateral * 0.5) * (leader ? 0.6 : 1);
        px = qx + Math.cos(dir) * side;
        pz = qz + Math.sin(dir) * side;
        if (a.still) heading = dir + (a.lateral > 0 ? Math.PI / 2 : -Math.PI / 2);
      } else {
        // No pavements nearby yet: hide.
        this.m.makeScale(0, 0, 0);
        batch.mesh.setMatrixAt(a.slot, this.m);
        continue;
      }
      this.q.setFromAxisAngle(this.up, Math.PI - heading);
      this.m.compose(this.p.set(px, 0, pz), this.q, this.sc.setScalar(a.look.scale));
      batch.mesh.setMatrixAt(a.slot, this.m);
      if (a.look.load) {
        const top = (a.look.body === 'female' ? 1.74 : 1.8) * a.look.scale;
        const bob = a.still ? 0 : Math.abs(Math.sin(t * Math.PI * 2 * (a.speed / 1.35))) * 0.025;
        this.m.compose(this.p.set(px, top + bob, pz), this.q, this.sc.setScalar(1));
        this.loads[a.look.load].setMatrixAt(loadCount[a.look.load]++, this.m);
      }
      if (shadows < this.shadowBatch.instanceMatrix.count) {
        const r = 0.75 * a.look.scale;
        this.m.compose(this.p.set(px, 0.03, pz), this.q, this.sc.set(r, 1, r));
        this.shadowBatch.setMatrixAt(shadows++, this.m);
      }
    }
    for (const b of Object.values(this.crowds)) b!.mesh.instanceMatrix.needsUpdate = true;
    for (const k of ['basin', 'tray'] as const) {
      this.loads[k].count = loadCount[k];
      this.loads[k].instanceMatrix.needsUpdate = true;
    }
    this.shadowBatch.count = shadows;
    this.shadowBatch.instanceMatrix.needsUpdate = true;
  }

  // Far from the player now (checked a few times a second per person, not every frame).
  private tooFar(a: Agent, x: number, z: number, t: number, far: number) {
    if (Math.floor(t * 3) % 7 !== a.slot % 7) return false;
    const w = a.run!;
    const along = a.still ? a.s0 % w.total : (a.s0 + t * a.speed) % (w.total * 2);
    const s = along < w.total ? along : w.total * 2 - along;
    const [px, pz] = this.pointOn(w, s);
    return Math.hypot(px - x, pz - z) > far;
  }
}
