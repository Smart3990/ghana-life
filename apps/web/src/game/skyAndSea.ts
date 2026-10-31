// The rest of the living world (step 7 of the Epic City plan): a helicopter circling over central
// Accra with its rotor turning, a hot-air balloon drifting slowly high over the city, and boats off
// the coast: fishing boats rocking off Jamestown and Osu, a sailing boat and a speedboat, and a cargo
// ship far out heading east towards Tema. All from the Epic City pack, all on the shared clock (every
// phone sees them in the same place), each drawn only when it is near enough to be seen.
import * as THREE from 'three';
import { epicGeometry, epicMaterial } from './epicKit';

type LngLat = [number, number];
/** Where a thing is at time t: a point (lng, lat), its height, compass heading (radians), and a rock. */
type Path = (t: number) => { at: LngLat; y: number; heading: number; roll?: number; pitch?: number };

const M_LAT = 110574;
const M_LON = 111320 * Math.cos((5.56 * Math.PI) / 180);
/** A circle round `c` of radius r metres, once every `period` seconds (anticlockwise seen from above). */
const circle = (c: LngLat, r: number, period: number, y: number, phase = 0): Path => (t) => {
  const a = (t / period) * Math.PI * 2 + phase;
  const at: LngLat = [c[0] + (Math.cos(a) * r) / M_LON, c[1] + (Math.sin(a) * r) / M_LAT];
  // Moving along the circle: east (cos) then north (sin) turning; compass heading of the tangent.
  const ve = -Math.sin(a), vn = Math.cos(a);
  return { at, y, heading: Math.atan2(ve, vn) };
};
/** Rocking at anchor on the waves. */
const anchored = (at: LngLat, heading: number, seed: number): Path => (t) => ({
  at, y: 0.15 * Math.sin(t * 1.1 + seed), heading: heading + 0.08 * Math.sin(t * 0.13 + seed),
  roll: 0.07 * Math.sin(t * 0.9 + seed * 2), pitch: 0.04 * Math.sin(t * 0.7 + seed),
});
/** Back and forth along a line between a and b, at `speed` metres a second. */
const shuttle = (a: LngLat, b: LngLat, speed: number, seed: number): Path => {
  const len = Math.hypot((b[0] - a[0]) * M_LON, (b[1] - a[1]) * M_LAT);
  const h = Math.atan2((b[0] - a[0]) * M_LON, (b[1] - a[1]) * M_LAT);
  return (t) => {
    const k = ((t * speed) / len + seed) % 2;
    const f = k < 1 ? k : 2 - k;
    return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], y: 0.1 * Math.sin(t * 1.3 + seed), heading: k < 1 ? h : h + Math.PI, roll: 0.03 * Math.sin(t + seed) };
  };
};

// The coast (its shore from the old forts that stand on it: James Fort and the lighthouse at
// Jamestown, Usher Fort, Osu Castle; east of Osu as measured from the map): boats about 200 m out.
// scale: drawn larger than life high in the sky, so they read from the street (as the planes are).
const THINGS: { file: string; path: Path; within: number; rotor?: boolean; scale?: number }[] = [
  // Right over Circle, 120 m up, round every minute and a half.
  { file: 'vehicles/helicopter.glb', path: circle([-0.2166, 5.5694], 450, 90, 120), within: 5000, rotor: true, scale: 2 },
  // Over Adabraka and Circle, drifting round slowly (once in 40 minutes), rising and sinking a little.
  { file: 'vehicles/balloon-stripes.glb', path: (t) => ({ ...circle([-0.207, 5.564], 900, 2400, 0)(t), y: 220 + 20 * Math.sin(t / 90) }), within: 8000, scale: 3 },
  // Fishing canoes off Jamestown and Osu, rocking at anchor.
  { file: 'vehicles/boat-fishing.glb', path: anchored([-0.2105, 5.529], 1.2, 1), within: 4000 },
  { file: 'vehicles/boat-fishing.glb', path: anchored([-0.206, 5.5318], 2.4, 2), within: 4000 },
  { file: 'vehicles/boat-fishing.glb', path: anchored([-0.196, 5.5394], 0.4, 3), within: 4000 },
  { file: 'vehicles/boat-fishing.glb', path: anchored([-0.1795, 5.5466], 1.9, 4), within: 4000 },
  { file: 'vehicles/boat-sail.glb', path: shuttle([-0.205, 5.53], [-0.175, 5.5455], 3, 0.3), within: 5000 },
  { file: 'vehicles/boat-speed.glb', path: shuttle([-0.212, 5.527], [-0.158, 5.551], 12, 0.7), within: 5000 },
  // Far out, the cargo ship on its way along the coast to Tema harbour.
  { file: 'vehicles/ship-cargo.glb', path: shuttle([-0.26, 5.49], [-0.05, 5.55], 6, 0.2), within: 12000 },
];

export class SkyAndSea {
  readonly group = new THREE.Group();
  private items: { mesh: THREE.Mesh; path: Path; within: number; rotor?: THREE.Group; scale: number }[] = [];
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private v = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  /** Where each thing in view is (for tests). */
  readonly seen: { file: string; x: number; z: number; y: number }[] = [];

  constructor(private toLocal: (lng: number, lat: number) => [number, number]) {
    for (const thing of THINGS) {
      void epicGeometry(thing.file).then((g) => {
        const mesh = new THREE.Mesh(g, epicMaterial());
        mesh.matrixAutoUpdate = false;
        mesh.visible = false;
        mesh.name = thing.file;
        this.group.add(mesh);
        let rotor: THREE.Group | undefined;
        if (thing.rotor) {
          // Its main rotor: two long dark blades turning fast on top (the pack's helicopter has fixed ones).
          g.computeBoundingBox();
          const b = g.boundingBox!;
          rotor = new THREE.Group();
          const blade = new THREE.MeshStandardMaterial({ color: '#202326', roughness: 0.6 });
          const span = (b.max.z - b.min.z) * 0.95;
          for (const a of [0, Math.PI / 2]) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, span), blade);
            m.rotation.y = a;
            rotor.add(m);
          }
          rotor.position.set((b.min.x + b.max.x) / 2, b.max.y + 0.12, (b.min.z + b.max.z) / 2);
          mesh.add(rotor);
          mesh.matrixWorldAutoUpdate = true;
        }
        this.items.push({ mesh, path: thing.path, within: thing.within, rotor, scale: thing.scale ?? 1 });
      });
    }
  }

  /** Everything at time t (seconds of shared time); (px, pz): the player. */
  update(t: number, px: number, pz: number) {
    this.seen.length = 0;
    for (const it of this.items) {
      const p = it.path(t);
      const [x, z] = this.toLocal(p.at[0], p.at[1]);
      const show = (x - px) ** 2 + (z - pz) ** 2 < it.within ** 2;
      it.mesh.visible = show;
      if (!show) continue;
      // (Compass heading: local forward is (sin, -cos); the pack's things face +z.)
      this.e.set(-(p.pitch ?? 0), Math.PI - p.heading, p.roll ?? 0);
      this.q.setFromEuler(this.e);
      it.mesh.matrix.compose(this.v.set(x, p.y, z), this.q, this.one.setScalar(it.scale));
      if (it.rotor) it.rotor.rotation.y = t * 40;
      this.seen.push({ file: it.mesh.name, x: Math.round(x), z: Math.round(z), y: Math.round(p.y) });
    }
  }
}
