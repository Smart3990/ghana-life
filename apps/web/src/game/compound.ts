// Uncle Kwame's compound house (brief 9.5, Chapter 1): a walled yard with a blue metal gate, a row of
// rooms under one long tin roof with a veranda, a kitchen corner with a coal pot, a water drum and a
// poly tank on a stand, a washing line, a mango tree, a bench and plastic chairs. Our own design,
// built from simple boxes so it is cheap to draw. Built facing +z (the gate is in the +z wall).
import * as THREE from 'three';
import { box, merge, paint } from './vehicles3d';

export const COMPOUND = { w: 18, d: 14 }; // outside size in metres

export function compoundHouse() {
  const W = COMPOUND.w / 2;
  const D = COMPOUND.d / 2;
  const wall = '#e9dcc0';
  const dado = '#9a6a43';
  const parts: THREE.BufferGeometry[] = [
    paint(new THREE.PlaneGeometry(COMPOUND.w - 0.3, COMPOUND.d - 0.3).rotateX(-Math.PI / 2).translate(0, 0.03, 0), '#b9b2a4'), // the yard's concrete
    // The wall round the yard (2.2 m), with a gap for the gate in the front.
    paint(box(COMPOUND.w, 2.2, 0.25, 0, 1.1, -D), wall),
    paint(box(0.25, 2.2, COMPOUND.d, -W, 1.1, 0), wall),
    paint(box(0.25, 2.2, COMPOUND.d, W, 1.1, 0), wall),
    paint(box(W - 1.6, 2.2, 0.25, -(W + 1.6) / 2, 1.1, D), wall),
    paint(box(W - 1.6, 2.2, 0.25, (W + 1.6) / 2, 1.1, D), wall),
    paint(box(W - 1.6, 0.6, 0.27, -(W + 1.6) / 2, 0.3, D), dado),
    paint(box(W - 1.6, 0.6, 0.27, (W + 1.6) / 2, 0.3, D), dado),
    paint(box(0.45, 2.6, 0.45, -1.6, 1.3, D), '#d9c9a8'), // gate pillars
    paint(box(0.45, 2.6, 0.45, 1.6, 1.3, D), '#d9c9a8'),
    // The gate: two blue metal leaves, standing open into the yard.
    paint(box(0.06, 2.0, 1.5, -1.45, 1.05, D - 0.8), '#1f5fa8'),
    paint(box(0.06, 2.0, 1.5, 1.45, 1.05, D - 0.8), '#1f5fa8'),
  ];
  // The rooms: five in a row along the back wall, one long roof and a veranda in front.
  const roomD = 3.4;
  const roomZ = -D + 0.13 + roomD / 2;
  // The rooms are solid blocks, except the middle one: your room, which you can walk into.
  const roomW = (COMPOUND.w - 0.5) / 5;
  const side = (COMPOUND.w - 0.5 - roomW) / 2; // width of the solid block on each side of your room
  for (const sgn of [-1, 1]) {
    const cx = sgn * (roomW / 2 + side / 2);
    parts.push(paint(box(side, 2.8, roomD, cx, 1.4, roomZ), '#efe3c8'));
    parts.push(paint(box(side, 0.7, roomD + 0.02, cx, 0.35, roomZ), dado));
  }
  parts.push(...yourRoom(roomW, roomD, roomZ, dado));
  const roof = [paint(box(COMPOUND.w - 0.2, 0.08, roomD + 1.9, 0, 3.0, roomZ + 0.9, 0.08), '#8f959b')]; // tin roof (lifted away when you are in your room)
  parts.push(paint(box(COMPOUND.w - 0.5, 0.15, 1.6, 0, 0.08, roomZ + roomD / 2 + 0.8), '#a8a092')); // veranda step
  for (const x of [-W + 0.5, W - 0.5]) parts.push(paint(box(0.12, 2.9, 0.12, x, 1.45, roomZ + roomD / 2 + 1.5), '#6b665e'));
  const curtains = ['#c8442e', '#2f8f57', '#e3a92b', '#6a4c93', '#1f5fa8'];
  for (let i = 0; i < 5; i++) {
    const x = -W + 0.25 + (COMPOUND.w - 0.5) * ((i + 0.5) / 5);
    const front = roomZ + roomD / 2 + 0.02;
    if (i !== 2) {
      parts.push(paint(box(0.9, 2.0, 0.05, x - 0.6, 1.0, front), '#6b4a2e')); // door
      parts.push(paint(box(0.85, 1.6, 0.03, x - 0.6, 1.1, front + 0.04), curtains[i])); // its curtain
    }
    parts.push(paint(box(0.9, 0.8, 0.05, x + 0.8, 1.55, front), '#3e4a52')); // louvre window
    for (let k = 0; k < 4; k++) parts.push(paint(box(0.86, 0.04, 0.07, x + 0.8, 1.24 + k * 0.18, front + 0.03), '#c9c4b8'));
  }
  // Kitchen corner (left front): a low shed with a coal pot.
  parts.push(paint(box(3, 0.08, 2.2, -W + 1.7, 2.1, D - 1.4, -0.08), '#8f959b'));
  for (const [x, z] of [[-W + 0.35, D - 0.4], [-W + 3.1, D - 0.4], [-W + 3.1, D - 2.4]]) parts.push(paint(box(0.1, 2.1, 0.1, x, 1.05, z), '#6b665e'));
  parts.push(paint(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 10).translate(-W + 1.5, 0.16, D - 1.5), '#2b2b2b'));
  parts.push(paint(box(1.2, 0.7, 0.5, -W + 2.4, 0.35, D - 2.1), '#7a5636')); // kitchen table
  // Water: a blue drum, and the black poly tank up on its stand.
  parts.push(paint(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12).translate(W - 1.3, 0.45, D - 1.2), '#1f5fa8'));
  parts.push(paint(box(1.4, 0.1, 1.4, W - 1.5, 2.6, -D + roomD + 1.8), '#5d5a55'));
  for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) parts.push(paint(box(0.1, 2.6, 0.1, W - 1.5 + dx, 1.3, -D + roomD + 1.8 + dz), '#5d5a55'));
  parts.push(paint(new THREE.CylinderGeometry(0.62, 0.66, 1.3, 14).translate(W - 1.5, 3.3, -D + roomD + 1.8), '#1d1d1f'));
  // A bench and two plastic chairs under the mango tree.
  parts.push(paint(box(1.8, 0.08, 0.4, 2.2, 0.45, 0.6), '#7a5636'));
  for (const x of [1.5, 2.9]) parts.push(paint(box(0.08, 0.45, 0.35, x, 0.22, 0.6), '#5a3f28'));
  for (const [x, c] of [[1.9, '#f2efe6'], [2.8, '#c8442e']] as const) {
    parts.push(paint(box(0.46, 0.05, 0.44, x, 0.44, 1.9), c));
    parts.push(paint(box(0.46, 0.45, 0.05, x, 0.68, 1.7), c));
  }
  // The parking place in the yard (Uncle Kwame's car): a slightly darker patch of concrete.
  parts.push(paint(new THREE.PlaneGeometry(2.6, 5.4).rotateX(-Math.PI / 2).translate(0, 0.035, 2.6), '#a59f92'));
  // The mango tree.
  parts.push(paint(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7).translate(3.6, 1.3, -0.4), '#5b4330'));
  const crown = new THREE.IcosahedronGeometry(2.1, 1).translate(3.6, 3.6, -0.4);
  parts.push(paint(crown, '#2f6b35'));
  // The washing line with clothes.
  parts.push(paint(box(0.06, 1.9, 0.06, -6, 0.95, 0), '#6b665e'), paint(box(0.06, 1.9, 0.06, -2, 0.95, 0), '#6b665e'), paint(box(4, 0.02, 0.02, -4, 1.88, 0), '#d9d2c2'));
  const cloth = ['#e3a92b', '#2f8f57', '#f2efe6', '#c8442e', '#1f5fa8', '#7a3fb0'];
  for (let i = 0; i < 6; i++) parts.push(paint(box(0.48, 0.6 + (i % 2) * 0.2, 0.02, -5.6 + i * 0.62, 1.55 - (i % 2) * 0.1, 0), cloth[i]));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(merge(parts), mat);
  const roofMesh = new THREE.Mesh(merge(roof), mat);
  roofMesh.name = 'roof';
  roofMesh.castShadow = true;
  mesh.castShadow = mesh.receiveShadow = true;
  const g = new THREE.Group();
  g.add(mesh, roofMesh);
  return g;
}

/** Your room (the middle one): walls, a doorway, a bed, a small table and chair, a mat, a bulb. */
function yourRoom(roomW: number, roomD: number, roomZ: number, dado: string) {
  const back = roomZ - roomD / 2;
  const front = roomZ + roomD / 2;
  const hw = roomW / 2;
  const doorX = -0.6;
  const parts = [
    paint(new THREE.PlaneGeometry(roomW - 0.2, roomD - 0.2).rotateX(-Math.PI / 2).translate(0, 0.06, roomZ), '#8d6e52'), // floor
    paint(box(0.12, 2.8, roomD, -hw, 1.4, roomZ), '#efe3c8'), // side walls
    paint(box(0.12, 2.8, roomD, hw, 1.4, roomZ), '#efe3c8'),
    // Front wall with the doorway (0.9 m) and a window.
    paint(box(doorX - 0.45 + hw, 2.8, 0.12, (-hw + doorX - 0.45) / 2, 1.4, front - 0.06), '#efe3c8'),
    paint(box(hw - (doorX + 0.45), 2.8, 0.12, (hw + doorX + 0.45) / 2, 1.4, front - 0.06), '#efe3c8'),
    paint(box(0.9, 0.7, 0.12, doorX, 2.45, front - 0.06), '#efe3c8'), // over the door
    paint(box(roomW, 0.7, 0.14, 0, 0.35, front - 0.06), dado),
    paint(box(0.08, 2.1, 0.08, doorX - 0.45, 1.05, front - 0.02), '#6b4a2e'), // door frame
    paint(box(0.08, 2.1, 0.08, doorX + 0.45, 1.05, front - 0.02), '#6b4a2e'),
    // Inside: a bed with a new mattress and a pillow, a table and chair, a mat, a bucket, a calendar.
    paint(box(1.0, 0.35, 2.0, hw - 0.65, 0.2, back + 1.15), '#5a3f28'),
    paint(box(0.95, 0.16, 1.95, hw - 0.65, 0.45, back + 1.15), '#2f8f57'),
    paint(box(0.6, 0.1, 0.35, hw - 0.65, 0.58, back + 0.35), '#f2efe6'),
    paint(box(0.8, 0.06, 0.5, -hw + 0.55, 0.75, back + 0.4), '#7a5636'),
    paint(box(0.05, 0.72, 0.05, -hw + 0.2, 0.37, back + 0.2), '#5a3f28'),
    paint(box(0.05, 0.72, 0.05, -hw + 0.9, 0.37, back + 0.2), '#5a3f28'),
    paint(box(0.05, 0.72, 0.05, -hw + 0.2, 0.37, back + 0.6), '#5a3f28'),
    paint(box(0.05, 0.72, 0.05, -hw + 0.9, 0.37, back + 0.6), '#5a3f28'),
    paint(box(0.42, 0.05, 0.4, -hw + 0.55, 0.44, back + 1.0), '#1f5fa8'),
    paint(box(0.42, 0.42, 0.05, -hw + 0.55, 0.66, back + 1.2), '#1f5fa8'),
    paint(new THREE.PlaneGeometry(1.2, 0.8).rotateX(-Math.PI / 2).translate(-0.1, 0.07, roomZ + 0.3), '#c8442e'),
    paint(new THREE.CylinderGeometry(0.16, 0.13, 0.32, 10).translate(-hw + 0.3, 0.22, front - 0.5), '#e3a92b'),
    paint(box(0.4, 0.5, 0.02, 0.3, 1.7, back + 0.03), '#f2efe6'),
    paint(new THREE.SphereGeometry(0.06, 8, 6).translate(0, 2.55, roomZ), '#fff6c8'),
  ];
  return parts;
}

/** Is a point (compound frame) inside your room? */
export function inYourRoom(u: number, v: number) {
  const D = COMPOUND.d / 2;
  return Math.abs(u) < (COMPOUND.w - 0.5) / 10 && v > -D && v < -D + 0.13 + 3.4;
}

/** Solid parts of the compound in its own frame (u across, v towards the gate): walls and rooms. */
export function compoundSolid(u: number, v: number, room: number) {
  const W = COMPOUND.w / 2;
  const D = COMPOUND.d / 2;
  const roomD = 3.4;
  if (Math.abs(u) > W + room || Math.abs(v) > D + room) return false;
  if (v < -D + roomD + room) {
    // Inside your room, or in its doorway, you can walk; everywhere else along the back is rooms.
    const hw = (COMPOUND.w - 0.5) / 10;
    const inRoom = Math.abs(u) < hw - 0.12 - room && v > -D + 0.25 + room && v < -D + roomD - 0.12 - room;
    const inDoor = Math.abs(u + 0.6) < 0.45 - room && v > -D + roomD - 0.4;
    const onBed = u > hw - 1.2 - room && v < -D + 0.13 + 2.2 + room;
    if ((inRoom && !onBed) || inDoor) return false;
    return true;
  }
  if (Math.abs(u) > W - 0.15 - room) return true; // side walls
  if (Math.abs(v - D) < 0.15 + room && Math.abs(u) > 1.4 - room) return true; // front wall (the gate is open)
  if (Math.hypot(u - 3.6, v + 0.4) < 0.25 + room) return true; // mango tree
  if (Math.hypot(u - (W - 1.3), v - (D - 1.2)) < 0.35 + room) return true; // drum
  return false;
}
