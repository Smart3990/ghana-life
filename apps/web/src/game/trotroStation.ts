// The trotro station at Circle: a dusty yard beside the road with rows of parked trotros, a long
// shelter where passengers wait, bus mates calling out where each row goes, hawkers between the
// rows, and a big sign at the entrance. It is found once, on open ground near Circle.
import * as THREE from 'three';
import { box, merge, paint } from './vehicles3d';
import type { BatchKey } from './vehicles3d';

export const DESTINATIONS = ['Kaneshie', 'Madina', 'Lapaz', 'Achimota', 'Kasoa', 'Tema Station', 'Accra Central', 'Odorkor'];

export type StationPlan = {
  group: THREE.Group;
  parked: { key: BatchKey; id: number; x: number; z: number; heading: number; colour: string }[];
  people: { kind: 'man' | 'woman' | 'pupil' | 'hawker' | 'kayayo' | 'muslimMan' | 'muslimWoman' | 'church'; x: number; z: number; face: number; clip: 'call' | 'idle' | 'talk' | 'phone' | 'sell' | 'yes'; cycle: ('call' | 'idle' | 'talk' | 'phone' | 'sell' | 'yes' | 'hand')[] | null; words?: string[] }[];
  x: number;
  z: number;
  radius: number;
};

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0f6b3a';
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = '#e3a92b';
  g.fillRect(0, 0, 1024, 20);
  g.fillRect(0, 236, 1024, 20);
  g.fillStyle = '#ffffff';
  g.font = '900 96px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('CIRCLE LORRY STATION', 512, 130, 980);
  g.font = '700 44px system-ui, sans-serif';
  g.fillStyle = '#fff3c4';
  g.fillText('Kaneshie · Madina · Lapaz · Kasoa · Tema', 512, 200, 980);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Plan the station at (x, z), its front facing the road at `face` (radians clockwise from north:
 * the direction from the station to the road).
 */
export function planStation(x: number, z: number, face: number): StationPlan {
  const group = new THREE.Group();
  const F = [Math.sin(face), -Math.cos(face)]; // towards the road
  const R = [Math.cos(face), Math.sin(face)]; // along the road
  const at = (u: number, v: number) => [x + R[0] * u + F[0] * v, z + R[1] * u + F[1] * v] as const; // v > 0 is towards the road
  const parts: THREE.BufferGeometry[] = [];
  const local = (g: THREE.BufferGeometry, u: number, v: number) => {
    const [px, pz] = at(u, v);
    g.rotateY(Math.PI - face);
    g.translate(px, 0, pz);
    return g;
  };
  // The yard: packed red earth with a concrete strip at the front.
  parts.push(local(paint(new THREE.PlaneGeometry(34, 24).rotateX(-Math.PI / 2).translate(0, 0.02, 0), '#b9895d'), 0, 0));
  parts.push(local(paint(new THREE.PlaneGeometry(34, 3).rotateX(-Math.PI / 2).translate(0, 0.03, -10.5), '#a59f92'), 0, 0));
  // The long shelter at the back: a roof on posts, benches under it.
  parts.push(local(paint(box(30, 0.15, 4.5, 0, 3.2, 0, -0.08), '#8f959b'), 0, -9.5));
  for (let u = -14; u <= 14; u += 4) parts.push(local(paint(box(0.15, 3.2, 0.15, 0, 1.6, 0), '#5d5a55'), u, -8));
  for (let u = -12; u <= 12; u += 6) parts.push(local(paint(box(4.5, 0.45, 0.5, 0, 0.22, 0), '#6b4a2e'), u, -10.4));
  // The station sign on two posts at the entrance.
  parts.push(local(paint(box(0.2, 5, 0.2, -3.8, 2.5, 0), '#4a4844'), 13, 11));
  parts.push(local(paint(box(0.2, 5, 0.2, 3.8, 2.5, 0), '#4a4844'), 13, 11));
  const ground = new THREE.Mesh(merge(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
  ground.receiveShadow = true;
  ground.castShadow = true;
  group.add(ground);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2).translate(0, 5.2, 0.12), new THREE.MeshBasicMaterial({ map: signTexture(), side: THREE.DoubleSide }));
  const [sx, sz] = at(13, 11);
  sign.position.set(sx, 0, sz);
  sign.rotation.y = Math.PI - face;
  group.add(sign);

  // Rows of trotros, noses towards the road, waiting to fill up.
  const parked: StationPlan['parked'] = [];
  const people: StationPlan['people'] = [];
  const cols = ['#0d47b8', '#0d47b8', '#f1ece0', '#1352c4', '#0d47b8'];
  let id = 777000;
  for (const [row, v] of [-4, 1.5, 7].entries()) {
    for (const [k, u] of [-12, -7.5, -3, 1.5, 6].entries()) {
      const [px, pz] = at(u, v);
      parked.push({ key: (row + k) % 3 === 0 ? 'sprinter' : 'trotro', id: id++, x: px, z: pz, heading: face, colour: cols[(row * 5 + k) % cols.length] });
    }
    // The row's bus mate at the front, calling its destination.
    const dest = DESTINATIONS[row % DESTINATIONS.length];
    const [mx, mz] = at(10, v + 2);
    people.push({ kind: 'man', x: mx, z: mz, face: face + Math.PI / 2, clip: 'call', cycle: ['call', 'call', 'hand', 'call', 'talk'], words: [`${dest}! ${dest}!`, `${dest}, one more, come!`, 'Last seat, last seat!', `${dest} straight!`] });
  }
  // Passengers waiting under the shelter, and hawkers between the rows.
  const kinds: StationPlan['people'][number]['kind'][] = ['woman', 'man', 'pupil', 'muslimWoman', 'church', 'man', 'woman', 'muslimMan', 'woman', 'man', 'pupil', 'woman'];
  kinds.forEach((kind, i) => {
    const [px, pz] = at(-13 + i * 2.3, -9 + (i % 2) * 0.8);
    people.push({ kind, x: px, z: pz, face: face, clip: i % 3 === 0 ? 'phone' : 'idle', cycle: ['idle', 'talk', 'phone', 'idle'] });
  });
  for (const [i, u] of [-9.7, -0.7, 3.8].entries()) {
    const [px, pz] = at(u, -1.2 + i * 2.6);
    people.push({ kind: i === 1 ? 'kayayo' : 'hawker', x: px, z: pz, face: face + Math.PI / 2, clip: 'sell', cycle: ['sell', 'call', 'sell'], words: ['Pure water! Pure water!', 'Bread, bread!', 'Meat pie, ice cold drink!'] });
  }
  return { group, parked, people, x, z, radius: 20 };
}
