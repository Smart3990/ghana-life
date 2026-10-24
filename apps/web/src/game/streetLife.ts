// Street life: trees and palms, street lights, container kiosks, vendors' umbrellas, black polytanks
// on the roofs, and people walking on the pavements. Everything is placed from the real roads and
// buildings in the map tiles, the same way every time (fixed random numbers from positions).
//
// Cost: each kind of thing is one batched draw, refreshed only when the player has moved a fair way.
// People use the light crowd models, and the far ones animate at half rate.
import * as THREE from 'three';
import { box, merge, paint, shadowTexture } from './vehicles3d';
import type { Roof, StreetLine } from './streetBuildings';
import { createPerson, SKIN_TONES, type Person } from './person';

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

type Walkway = { pts: Float32Array; at: Float32Array; total: number };
type Walker = { person: Person; path: Walkway | null; s0: number; speed: number; still: boolean; skip: number; dt: number };

const SHIRTS = ['#2f7d55', '#e3a92b', '#c8442e', '#1f5fa8', '#f2efe6', '#6b4f93', '#151515', '#d98a3a'];
const BOTTOMS = ['#2a3446', '#3b3b3b', '#c9b48a', '#5a3a22', '#1f5fa8', '#7a1f2b', '#2f5f3a'];
const SKINS = [SKIN_TONES.deep, SKIN_TONES.veryDeep, SKIN_TONES.medium, SKIN_TONES.deep];

export class StreetLife {
  readonly group = new THREE.Group();
  private batches: Batch[] = [];
  private walkways: Walkway[] = [];
  private walkers: Walker[] = [];
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
    private opts: { radiusM: number; people: number; props: number },
  ) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
    const make = (geometry: Part, tint: boolean) => {
      const mesh = new THREE.InstancedMesh(geometry, mat, opts.props);
      mesh.count = 0;
      mesh.frustumCulled = false;
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
    this.makePeople();
  }
  private trees: Batch;
  private palms: Batch;
  private lights: Batch;
  private kiosks: Batch;
  private umbrellas: Batch;
  private tanks: Batch;

  private async makePeople() {
    for (let i = 0; i < this.opts.people; i++) {
      const female = hash(i, 3) < 0.5;
      const person = await createPerson(
        {
          skin: SKINS[i % SKINS.length],
          shirt: SHIRTS[Math.floor(hash(i, 5) * SHIRTS.length)],
          trousers: BOTTOMS[Math.floor(hash(i, 7) * BOTTOMS.length)],
          shoes: hash(i, 9) < 0.5 ? '#2b2b2e' : '#5a3a22',
        },
        female ? 'female' : 'male',
        'crowd',
      );
      const still = hash(i, 11) < 0.25;
      const action = still ? person.actions.talk : person.actions.walk;
      action.play();
      action.time = hash(i, 13) * 2;
      person.root.visible = false;
      this.group.add(person.root);
      this.walkers.push({ person, path: null, s0: hash(i, 17) * 1000, speed: 1.1 + hash(i, 19) * 0.5, still, skip: i % 2, dt: 0 });
    }
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
        // A pavement on each side, for people to walk on.
        if (size.walk > 0 && len > 6) {
          for (const side of [1, -1]) {
            const off = (size.half + GUTTER + size.walk / 2) * side;
            const nx = -dz * off;
            const nz = dx * off;
            this.addWalkway(x1 + nx, z1 + nz, x2 + nx, z2 + nz);
          }
        }
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
    for (const roof of roofs) {
      if (hash(roof.x, roof.z) < 0.35) this.tanks.all.push({ x: roof.x, z: roof.z, angle: roof.id, scale: 1, colour: 0, y: roof.top } as Spot & { y: number });
    }
    this.lastRefresh = { x: Infinity, z: Infinity }; // show the new things straight away
  }

  private addWalkway(x1: number, z1: number, x2: number, z2: number) {
    const total = Math.hypot(x2 - x1, z2 - z1);
    if (!this.free((x1 + x2) / 2, (z1 + z2) / 2, 0.2)) return; // pavement under a building or another road: skip
    this.walkways.push({ pts: new Float32Array([x1, z1, x2, z2]), at: new Float32Array([0, total]), total });
  }

  /** Call every frame. */
  update(x: number, z: number, dt: number, t: number) {
    if (Math.hypot(x - this.lastRefresh.x, z - this.lastRefresh.z) > 30) this.refresh(x, z);
    this.moveWalkers(x, z, dt, t);
  }

  // Draw only the things near the player (rebuilt after moving 30 m).
  private nearWalkways: Walkway[] = [];
  private refresh(x: number, z: number) {
    this.lastRefresh = { x, z };
    this.nearWalkways = this.walkways.filter((w) => Math.hypot(w.pts[0] - x, w.pts[1] - z) < this.opts.radiusM * 0.6);
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

  private moveWalkers(x: number, z: number, dt: number, t: number) {
    let shadows = this.propShadows;
    const near = this.nearWalkways;
    for (const [i, w] of this.walkers.entries()) {
      // Someone too far away moves to a pavement near the player.
      const pos = w.person.root.position;
      if (!w.path || Math.hypot(pos.x - x, pos.z - z) > this.opts.radiusM * 0.7) {
        if (!near.length) {
          w.person.root.visible = false;
          continue;
        }
        w.path = near[Math.floor(hash(i, t) * near.length)];
      }
      const path = w.path;
      // Walk to one end and back again (or stand chatting).
      const along = w.still ? (w.s0 % path.total) : (w.s0 + t * w.speed) % (path.total * 2);
      const forward = along < path.total;
      const s = forward ? along : path.total * 2 - along;
      const k = s / path.total;
      const [x1, z1, x2, z2] = path.pts;
      const px = x1 + (x2 - x1) * k;
      const pz = z1 + (z2 - z1) * k;
      const heading = Math.atan2(x2 - x1, -(z2 - z1)) + (forward ? 0 : Math.PI);
      // Keep to the right of the pavement a little, so people pass each other.
      const lane = (forward ? 0.5 : -0.5) * (w.still ? 0 : 1);
      pos.set(px + Math.cos(heading) * lane, 0, pz + Math.sin(heading) * lane);
      w.person.root.rotation.y = w.still ? (i * 1.3) % (Math.PI * 2) : Math.PI - heading;
      w.person.root.visible = true;
      // Far people animate at half rate (they are small on screen).
      w.dt += dt;
      const far = Math.hypot(pos.x - x, pos.z - z) > 45;
      if (!far || (w.skip = 1 - w.skip) === 0) {
        if (!w.still) w.person.actions.walk.setEffectiveTimeScale(w.speed / 1.35);
        w.person.mixer.update(w.dt);
        w.dt = 0;
      }
      this.m.compose(this.p.set(pos.x, 0.03, pos.z), this.q.identity(), this.sc.set(0.8, 1, 0.8));
      this.shadowBatch.setMatrixAt(shadows++, this.m);
    }
    this.shadowBatch.count = shadows;
    this.shadowBatch.instanceMatrix.needsUpdate = true;
  }
}
