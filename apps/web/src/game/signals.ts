// Traffic lights and zebra crossings at the big junctions. Where a main road meets another road,
// every arm of the junction gets a zebra crossing and a traffic light on a pole at the kerb. The
// lights follow the shared clock (the same colours on every phone): one road has green while the
// crossing road has red, with amber in between. Vehicles stop at the line on red and amber
// (vehicles3d.ts asks shouldStop), so people can cross on the zebra.
import * as THREE from 'three';
import { ROAD_DIP } from './epicRoads';
import { epicGeometry, epicMaterial } from './epicKit';
import { box, merge, paint } from './vehicles3d';

export type Arm = { angle: number; half: number }; // angle: direction from the centre out along the road (clockwise from north)
export type Junction = { x: number; z: number; axis: number; arms: Arm[]; half: number; phase: number };
export type Light = 'green' | 'amber' | 'red';

// (Owner, 28 Oct 2026: a wait at the lights of more than 6 s, but every wait under 10 s. 29 Oct: no car
// anywhere waits more than 10 s, so 7 s on red, leaving time for a queue to get through.)
const CYCLE = 14; // seconds for both roads to have their turn
const GREEN = 5.5;
const AMBER = 1.5;
const GUTTER = 0.6;

/** The light for traffic moving along `heading` at this junction, at time t (seconds of shared time). */
export function lightFor(j: Junction, heading: number, t: number): Light {
  const group = Math.abs(Math.cos(heading - j.axis)) > 0.7 ? 0 : 1;
  const s = (((t + j.phase) % CYCLE) + CYCLE) % CYCLE - group * (CYCLE / 2);
  const u = ((s % CYCLE) + CYCLE) % CYCLE;
  return u < GREEN ? 'green' : u < GREEN + AMBER ? 'amber' : 'red';
}

/** How far out from the junction's centre the zebra is (its middle), and the stop line. */
export const zebraAt = (j: Junction) => j.half + GUTTER + 2.2;
export const stopLineAt = (j: Junction) => zebraAt(j) + 2.2;

export class Signals {
  readonly group = new THREE.Group();
  junctions: Junction[] = [];
  private near: Junction[] = [];
  private poles: THREE.InstancedMesh;
  private lamps: Record<Light, THREE.InstancedMesh>;
  private stripes: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  private up = new THREE.Vector3(0, 1, 0);
  private c = new THREE.Color();
  private lastRefresh = { x: Infinity, z: Infinity, n: -1, v: -1 };
  /**
   * Is this spot road (or a flyover ramp)? A pole never stands there (owner, 28 Oct 2026: a pole stood
   * on the tarmac by the zebra, in the cars' way). Set by the game; `roadsVersion` changes as more
   * roads are built, so the poles are checked again.
   */
  blocked: (x: number, z: number) => boolean = () => false;
  roadsVersion = 0;
  /** How many poles had to move off the road, and how many could not stand anywhere (for tests). */
  stats = { moved: 0, dropped: 0 };
  private packPole = false;
  private local = new THREE.Matrix4();
  private pole = new THREE.Matrix4();

  constructor(private maxArms = 60) {
    // A dark pole with the light box on top, facing the traffic that comes towards it (+z).
    const pole = merge([
      paint(new THREE.CylinderGeometry(0.06, 0.07, 3.4, 6).translate(0, 1.7, 0), '#3b3f44'),
      paint(box(0.34, 0.98, 0.24, 0, 3.5, 0), '#1c1e20'),
      paint(box(0.5, 1.1, 0.03, 0, 3.5, -0.13), '#f2c230'), // the yellow back plate
    ]);
    this.poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), maxArms);
    // The Epic City pack's traffic light in place of ours once it has loaded: a tall pole with an arm
    // over the road and a signal head above the lanes, and a second, low head for people at the kerb.
    void epicGeometry('props/traffic-lights.glb').then((g) => {
      this.poles.geometry = g;
      this.poles.material = epicMaterial();
      this.packPole = true;
      this.lastRefresh = { x: Infinity, z: Infinity, n: -1, v: -1 };
    });
    const lamp = new THREE.CircleGeometry(0.13, 12);
    const lampMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.lamps = {
      red: new THREE.InstancedMesh(lamp, lampMat(), maxArms * 2),
      amber: new THREE.InstancedMesh(lamp, lampMat(), maxArms * 2),
      green: new THREE.InstancedMesh(lamp, lampMat(), maxArms * 2),
    };
    this.stripes = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.5, 3).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xdbdbda, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }), // the Epic City pack's white
      maxArms * 16,
    );
    for (const mesh of [this.poles, this.stripes, ...Object.values(this.lamps)]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    this.poles.castShadow = true;
    this.stripes.receiveShadow = true;
    for (const l of Object.values(this.lamps)) l.setColorAt(0, this.c.set(0x000000));
  }

  /** Should a vehicle at (x, z) facing `heading`, `half` metres long, stop for a light ahead? */
  shouldStop(x: number, z: number, heading: number, half: number, t: number) {
    const fx = Math.sin(heading);
    const fz = -Math.cos(heading);
    for (const j of this.near) {
      const dx = j.x - x;
      const dz = j.z - z;
      if (Math.abs(dx) > 45 || Math.abs(dz) > 45) continue;
      const along = dx * fx + dz * fz;
      if (along <= 0) continue;
      if (Math.abs(dx * -fz + dz * fx) > j.half + 3) continue; // not heading into this junction
      const toLine = along - half - stopLineAt(j); // gap from the front bumper to the stop line
      // Drive up to the line, then wait there (once over the line, carry on across).
      if (toLine < -0.5 || toLine > 3) continue;
      const light = lightFor(j, heading, t);
      if (light === 'red' || (light === 'amber' && toLine > 0.5)) return true;
    }
    return false;
  }

  /** Draw the lights and crossings near the player and set the lamps for time t. */
  update(x: number, z: number, t: number) {
    if (Math.hypot(x - this.lastRefresh.x, z - this.lastRefresh.z) > 25 || this.junctions.length !== this.lastRefresh.n || this.roadsVersion !== this.lastRefresh.v) this.refresh(x, z);
    let i = 0;
    for (const j of this.near) {
      for (const arm of j.arms) {
        if (i >= this.maxArms) break;
        // The light facing traffic that comes in along this arm (driving towards the centre).
        const light = lightFor(j, arm.angle + Math.PI, t);
        for (const k of ['red', 'amber', 'green'] as const) {
          this.c.set(k === light ? LIT[k] : DIM[k]);
          this.lamps[k].setColorAt(i * 2, this.c);
          this.lamps[k].setColorAt(i * 2 + 1, this.c); // the low head shows the same
        }
        i++;
      }
    }
    for (const l of Object.values(this.lamps)) if (l.instanceColor) l.instanceColor.needsUpdate = true;
  }

  private refresh(x: number, z: number) {
    this.lastRefresh = { x, z, n: this.junctions.length, v: this.roadsVersion };
    this.stats = { moved: 0, dropped: 0 };
    this.near = this.junctions.filter((j) => Math.hypot(j.x - x, j.z - z) < 170);
    let arms = 0;
    let stripes = 0;
    const zebras: [number, number][] = []; // where zebras are already (two junction points close together share one)
    for (const j of this.near) {
      for (const arm of j.arms) {
        if (arms >= this.maxArms) break;
        const ox = Math.sin(arm.angle);
        const oz = -Math.cos(arm.angle);
        const rx = Math.cos(arm.angle); // across the arm
        const rz = Math.sin(arm.angle);
        // Pole at the kerb on the drivers' right as they come in (Ghana drives on the right), just before the line.
        // Never on the road: if the spot is tarmac (a curved junction corner, a slip road, the other
        // side of a dual road) or a ramp, the pole steps back along the pavement or further from the
        // kerb; if no spot is clear, this pole is left out (the other heads still show the lights).
        let d = stopLineAt(j) + 0.4;
        let side = -(arm.half + GUTTER + 0.5);
        const clearAt = (dd: number, ss: number) => {
          const px = j.x + ox * dd + rx * ss, pz = j.z + oz * dd + rz * ss;
          // The pole's foot and a little round it (about its base).
          for (const [ax, az] of [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]]) if (this.blocked(px + ax, pz + az)) return false;
          return true;
        };
        let ok = clearAt(d, side);
        if (!ok) {
          search: for (const back of [0, 1, 2, 3, 4.5, 6, 8, 10]) {
            for (const out of [0, 0.6, 1.2, 1.8]) {
              if (clearAt(d + back, side - out)) {
                d += back;
                side -= out;
                ok = true;
                break search;
              }
            }
          }
          if (ok) this.stats.moved++;
          else this.stats.dropped++;
        }
        this.q.setFromAxisAngle(this.up, Math.PI - arm.angle);
        this.m.compose(this.p.set(j.x + ox * d + rx * side, 0, j.z + oz * d + rz * side), this.q, this.s.set(ok ? 1 : 0, ok ? 1 : 0, ok ? 1 : 0));
        this.poles.setMatrixAt(arms, this.m);
        this.pole.copy(this.m);
        // Three lamps on the front of each signal head, red on top: on the pack's light, on the head
        // over the lanes and on the low one; on ours, on its one box. (The pole's front is +z, its
        // arm reaches over the road along -x.)
        const heads: [number, number, number][] = this.packPole ? [[-1.75, 8.44, 0.33], [-0.09, 3.46, 0.37]] : [[0, 3.5, 0.125]];
        heads.forEach(([hx, hy, hz], hi) => {
          for (const [k, dy] of [['red', 0.34], ['amber', 0], ['green', -0.34]] as const) {
            this.local.makeTranslation(hx, hy + (this.packPole ? dy : dy * 0.94), hz);
            this.lamps[k].setMatrixAt(arms * 2 + hi, this.m.multiplyMatrices(this.pole, this.local));
          }
        });
        if (heads.length === 1) for (const k of ['red', 'amber', 'green'] as const) this.lamps[k].setMatrixAt(arms * 2 + 1, this.m.makeScale(0, 0, 0));
        // Zebra: only across the main road (its two arms), white bars side by side across its width.
        const zc = zebraAt(j);
        let onMain = Math.abs(Math.cos(arm.angle - j.axis)) > 0.7;
        const zx = j.x + ox * zc, zz = j.z + oz * zc;
        if (onMain && zebras.some(([x2, z2]) => Math.hypot(x2 - zx, z2 - zz) < arm.half * 2)) onMain = false;
        if (onMain) zebras.push([zx, zz]);
        const n = Math.min(16, Math.floor((arm.half * 2) / 1.0));
        for (let b = 0; onMain && b < n && stripes < this.stripes.instanceMatrix.count; b++) {
          const across = -arm.half + 0.5 + b * ((arm.half * 2 - 1) / Math.max(1, n - 1));
          this.m.compose(this.p.set(j.x + ox * zc + rx * across, -ROAD_DIP + 0.012, j.z + oz * zc + rz * across), this.q, this.s.set(1, 1, 1)); // on the sunk tarmac
          this.stripes.setMatrixAt(stripes++, this.m);
        }
        arms++;
      }
    }
    this.poles.count = arms;
    for (const l of Object.values(this.lamps)) {
      l.count = arms * 2;
      l.instanceMatrix.needsUpdate = true;
    }
    this.stripes.count = stripes;
    this.poles.instanceMatrix.needsUpdate = this.stripes.instanceMatrix.needsUpdate = true;
  }

  /** The nearest zebra to a point: where it is, which way the road runs, and its junction. */
  nearestZebra(x: number, z: number, within = 150) {
    let best: { x: number; z: number; angle: number; half: number; j: Junction } | null = null;
    let bestD = within;
    for (const j of this.junctions) {
      for (const arm of j.arms) {
        if (Math.abs(Math.cos(arm.angle - j.axis)) <= 0.7) continue; // zebras are on the main road only
        const zc = zebraAt(j);
        const zx = j.x + Math.sin(arm.angle) * zc;
        const zz = j.z - Math.cos(arm.angle) * zc;
        const d = Math.hypot(zx - x, zz - z);
        if (d < bestD) [best, bestD] = [{ x: zx, z: zz, angle: arm.angle, half: arm.half, j }, d];
      }
    }
    return best;
  }
}

const LIT: Record<Light, number> = { red: 0xff2a1a, amber: 0xffb020, green: 0x2dff6a };
const DIM: Record<Light, number> = { red: 0x2a0806, amber: 0x2a1c05, green: 0x062a10 };
