// Planes over Accra at street level (step 7 of the Epic City plan: "the living world").
//
// The flights are the shared schedule of planes.ts (one every two and a half minutes on Kotoka's
// runway 21: arrivals down a 3° slope from the north-east, departures climbing out south-west over
// Airport, Ridge and central Accra), so every phone sees the same plane in the same place. Here each
// one is the Epic City pack's passenger jet (real size on the runway, twice that high in the sky),
// nose up a little on the way down and more as it climbs away, with blinking red and white lights at
// night.
import * as THREE from 'three';
import { epicGeometry, epicMaterial } from './epicKit';
import { planesAt } from './planes';

const SHOW_WITHIN = 12000; // metres
const POOL = 4;

export class Aircraft {
  readonly group = new THREE.Group();
  private jets: THREE.Mesh[] = [];
  private lights: THREE.Mesh[] = [];
  private q = new THREE.Quaternion();
  private yaw = new THREE.Quaternion();
  private pitch = new THREE.Quaternion();
  private up = new THREE.Vector3(0, 1, 0);
  private side = new THREE.Vector3(1, 0, 0);
  /** Where each plane in view is (local metres, height), for tests. */
  readonly seen: { x: number; z: number; y: number }[] = [];
  night = 0;

  constructor(private toLocal: (lng: number, lat: number) => [number, number]) {
    void epicGeometry('vehicles/plane-passenger.glb').then((g) => {
      g.computeBoundingBox();
      const b = g.boundingBox!;
      const wing = (b.max.x - b.min.x) / 2;
      const red = new THREE.MeshBasicMaterial({ color: '#ff2a1a' });
      const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      const dot = new THREE.SphereGeometry(0.45, 6, 4);
      for (let i = 0; i < POOL; i++) {
        const jet = new THREE.Mesh(g, epicMaterial());
        jet.visible = false;
        jet.matrixAutoUpdate = false;
        this.group.add(jet);
        this.jets.push(jet);
        // Lights: red on the left wing tip, white on the right and on the tail; they blink.
        const lights = new THREE.Group();
        for (const [x, y, z, m] of [[-wing, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2, red], [wing, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2, white], [0, b.max.y, b.min.z, white]] as [number, number, number, THREE.Material][]) {
          const l = new THREE.Mesh(dot, m);
          l.position.set(x, y, z);
          lights.add(l);
        }
        const holder = new THREE.Mesh();
        holder.add(lights);
        holder.matrixAutoUpdate = false;
        holder.visible = false;
        this.group.add(holder);
        this.lights.push(holder);
      }
    });
  }

  /** The planes at time `now` (seconds of shared time); (px, pz): the player. */
  update(now: number, px: number, pz: number) {
    this.seen.length = 0;
    if (!this.jets.length) return;
    const flights = planesAt(now);
    for (let i = 0; i < POOL; i++) {
      const jet = this.jets[i], holder = this.lights[i];
      const f = flights[i];
      if (!f) {
        jet.visible = holder.visible = false;
        continue;
      }
      const [x, z] = this.toLocal(f.at[0], f.at[1]);
      if ((x - px) ** 2 + (z - pz) ** 2 > SHOW_WITHIN ** 2) {
        jet.visible = holder.visible = false;
        continue;
      }
      // Facing its course (compass degrees: local forward is (sin, -cos)); nose up 3° coming in,
      // 9° climbing out (level on the runway).
      const heading = (f.headingDeg * Math.PI) / 180;
      const noseUp = f.arriving ? (f.altitude > 2 ? 3 : 0) : f.altitude > 0.5 ? 9 : 0;
      this.yaw.setFromAxisAngle(this.up, Math.PI - heading);
      this.pitch.setFromAxisAngle(this.side, (-noseUp * Math.PI) / 180);
      this.q.copy(this.yaw).multiply(this.pitch);
      // Real size on the runway; up to twice that once high, so it reads in the sky from the street
      // (a jet 3 or 4 km off is otherwise a few pixels, as the overview map found: drawn 2.2 times).
      const k = 1 + Math.min(1, f.altitude / 150);
      jet.matrix.compose(new THREE.Vector3(x, f.altitude, z), this.q, new THREE.Vector3(k, k, k));
      jet.visible = true;
      holder.matrix.copy(jet.matrix);
      holder.visible = this.night > 0.3 && Math.floor(now * 1.2 + i) % 2 === 0;
      this.seen.push({ x: Math.round(x), z: Math.round(z), y: Math.round(f.altitude) });
    }
  }
}
