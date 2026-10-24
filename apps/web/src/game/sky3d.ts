// Planes and helicopters over Accra at street level. Planes follow the same shared-clock flights as
// the overview map (planes.ts: arrivals and departures on Kotoka's runway); helicopters circle over
// busy parts of the city. Everyone sees the same aircraft in the same place. Built from simple shapes.
import * as THREE from 'three';
import { box, merge, paint } from './vehicles3d';
import { planesAt } from './planes';

type ToLocal = (lng: number, lat: number) => [number, number];

function jet(): THREE.BufferGeometry {
  const white = '#f3f4f6';
  const parts = [
    paint(new THREE.CylinderGeometry(2, 2, 34, 12).rotateX(Math.PI / 2), white), // fuselage
    paint(new THREE.SphereGeometry(2, 12, 8).scale(1, 1, 1.8).translate(0, 0, 17), white), // nose
    paint(new THREE.ConeGeometry(2, 7, 12).rotateX(-Math.PI / 2).translate(0, 0.4, -20.5), white), // tail cone
    paint(box(34, 0.5, 6, 0, -0.6, 1), '#dfe2e6'), // wings
    paint(box(12, 0.4, 3.2, 0, 0.6, -19), '#dfe2e6'), // tailplane
    paint(box(0.5, 7, 4.5, 0, 4.5, -19), '#1f5fa8'), // fin (a fictional airline's blue)
    paint(new THREE.CylinderGeometry(1.1, 1.1, 4, 10).rotateX(Math.PI / 2).translate(7, -2, 3), '#c9ccd0'), // engines
    paint(new THREE.CylinderGeometry(1.1, 1.1, 4, 10).rotateX(Math.PI / 2).translate(-7, -2, 3), '#c9ccd0'),
    paint(box(4.2, 1.2, 0.5, 0, 0.6, 18.8), '#1c252d'), // cockpit windows
    paint(box(0.3, 0.5, 26, 2.02, 0.5, -1), '#2a3446'), // window lines
    paint(box(0.3, 0.5, 26, -2.02, 0.5, -1), '#2a3446'),
  ];
  return merge(parts);
}

function helicopterBody(): THREE.BufferGeometry {
  return merge([
    paint(new THREE.SphereGeometry(1.3, 12, 8).scale(1, 1, 1.7), '#c8442e'),
    paint(new THREE.SphereGeometry(1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1.2).rotateX(Math.PI / 2.3).translate(0, 0.25, 1.1), '#1c252d'),
    paint(box(0.35, 0.35, 5.5, 0, 0.4, -4.2), '#c8442e'), // tail boom
    paint(box(0.12, 1.4, 0.9, 0, 1.0, -6.8), '#c8442e'),
    paint(box(0.08, 0.08, 2.4, 0.8, -1.4, 0), '#3a3b3d'), // skids
    paint(box(0.08, 0.08, 2.4, -0.8, -1.4, 0), '#3a3b3d'),
    paint(box(0.08, 0.7, 0.08, 0.8, -1.05, 0.6), '#3a3b3d'),
    paint(box(0.08, 0.7, 0.08, -0.8, -1.05, 0.6), '#3a3b3d'),
    paint(new THREE.CylinderGeometry(0.15, 0.15, 0.6, 6).translate(0, 1.5, 0), '#3a3b3d'),
  ]);
}

const rotorGeometry = () => merge([paint(box(10, 0.06, 0.3, 0, 0, 0), '#2a2b2d'), paint(box(0.3, 0.06, 10, 0, 0, 0), '#2a2b2d')]);

// Helicopters circle over busy places: centre (lng, lat), radius (m), height (m), seconds per lap.
const CIRCUITS: [number, number, number, number, number][] = [
  [-0.2166, 5.5694, 700, 160, 95], // over Circle
  [-0.2069, 5.5481, 900, 210, 120], // over Makola
  [-0.1985, 5.5625, 600, 180, 80], // over Ridge
];

export class SkyTraffic {
  readonly group = new THREE.Group();
  private planes: THREE.Mesh[] = [];
  private helis: { body: THREE.Mesh; rotor: THREE.Mesh }[] = [];

  constructor(private toLocal: ToLocal) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 });
    const jetGeometry = jet();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(jetGeometry, mat);
      m.visible = false;
      m.frustumCulled = false;
      this.planes.push(m);
      this.group.add(m);
    }
    const hb = helicopterBody();
    const rg = rotorGeometry();
    for (let i = 0; i < CIRCUITS.length; i++) {
      const body = new THREE.Mesh(hb, mat);
      const rotor = new THREE.Mesh(rg, mat);
      rotor.position.y = 1.85;
      body.add(rotor);
      body.frustumCulled = rotor.frustumCulled = false;
      this.helis.push({ body, rotor });
      this.group.add(body);
    }
  }

  /** now: seconds of shared time. */
  update(now: number) {
    const flights = planesAt(now);
    this.planes.forEach((m, i) => {
      const f = flights[i];
      m.visible = !!f && f.altitude > 3;
      if (!f) return;
      const [x, z] = this.toLocal(f.at[0], f.at[1]);
      m.position.set(x, f.altitude + 3, z);
      m.rotation.set(f.arriving ? 0.05 : -0.12, Math.PI - (f.headingDeg * Math.PI) / 180, 0, 'YXZ');
    });
    this.helis.forEach(({ body, rotor }, i) => {
      const [lng, lat, radius, height, lap] = CIRCUITS[i];
      const [cx, cz] = this.toLocal(lng, lat);
      const a = ((now % lap) / lap) * Math.PI * 2 + i * 2;
      body.position.set(cx + Math.cos(a) * radius, height + Math.sin(now * 0.3 + i) * 8, cz + Math.sin(a) * radius);
      // Flying along the circle (anticlockwise), nose a little down.
      const dirX = -Math.sin(a);
      const dirZ = Math.cos(a);
      body.rotation.set(0.12, Math.atan2(dirX, dirZ), -0.15, 'YXZ');
      rotor.rotation.y = now * 28;
    });
  }
}
