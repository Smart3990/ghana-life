// Uncle Kwame's home (brief 9.5, Chapter 1; owner, 28 Oct 2026: "an open modern house for the uncle,
// his wife and children"): a walled yard with a blue metal gate standing open, the family's modern
// two-storey house (the pack's modern house, painted white: packBuildings.ts villaMesh) on the left,
// your small room at the back (the boys' quarters) and a store beside it under one tin roof with a veranda, a kitchen corner with a coal pot, a water drum and a
// poly tank on a stand, a washing line, a mango tree, a bench and plastic chairs, flower pots, and a
// carport just inside the gate where Uncle Kwame parks. Our own design, built from simple boxes so it
// is cheap to draw. Built facing +z (the gate is in the +z wall).
import * as THREE from 'three';
import { box, merge, paint } from './vehicles3d';

export const COMPOUND = { w: 34, d: 24 }; // outside size in metres
/** Your room's width (the boys' quarters, at the back in the middle). */
const ROOM_W = 4.7;
/** Uncle's family house: its outline in the compound's frame (u from, u to, v from, v to). */
export const VILLA = { u0: -16.55, u1: -2.45, v0: -11.7, v1: -3.15 };
/** Where Uncle Kwame's car parks (compound frame: u across, v towards the gate), under the carport. */
export const PARKING = { u: 0, v: COMPOUND.d / 2 - 5.2 };

const TREE = { u: 6.6, v: -1.6 };
const DOOR_HALF = 0.6; // your room's doorway, half its width (its middle is at u = -0.6)

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
  // At the back: your room in the middle (you can walk into it), and the store to its right, under one
  // tin roof with a veranda. (Uncle's family house stands on the left: villaMesh, added by the game.)
  const roomD = 3.4;
  const roomZ = -D + 0.13 + roomD / 2;
  const roomW = ROOM_W;
  const sideL = roomW / 2, sideR = W - 0.25; // the store: from your room's wall to the side wall
  const side = sideR - sideL;
  parts.push(paint(box(side, 2.8, roomD, (sideL + sideR) / 2, 1.4, roomZ), '#efe3c8'));
  parts.push(paint(box(side, 0.7, roomD + 0.02, (sideL + sideR) / 2, 0.35, roomZ), dado));
  parts.push(...yourRoom(roomW, roomD, roomZ, dado));
  const roofL = -roomW / 2 - 0.1, roofR = W - 0.1;
  const roof = [paint(box(roofR - roofL, 0.08, roomD + 1.9, (roofL + roofR) / 2, 3.0, roomZ + 0.9, 0.08), '#8f959b')]; // tin roof (lifted away when you are in your room)
  parts.push(paint(box(roofR - roofL - 0.3, 0.15, 1.6, (roofL + roofR) / 2, 0.08, roomZ + roomD / 2 + 0.8), '#a8a092')); // veranda step
  for (const x of [roofL + 0.4, W - 0.5]) parts.push(paint(box(0.12, 2.9, 0.12, x, 1.45, roomZ + roomD / 2 + 1.5), '#6b665e'));
  const curtains = ['#c8442e', '#2f8f57', '#e3a92b'];
  const front = roomZ + roomD / 2 + 0.02;
  // Your room's window, and the store's doors and windows.
  parts.push(paint(box(0.9, 0.8, 0.05, 0.8, 1.55, front), '#3e4a52'));
  for (let k = 0; k < 4; k++) parts.push(paint(box(0.86, 0.04, 0.07, 0.8, 1.24 + k * 0.18, front + 0.03), '#c9c4b8'));
  for (let i = 0; i < 3; i++) {
    const x = sideL + side * ((i + 0.5) / 3);
    parts.push(paint(box(0.9, 2.0, 0.05, x - 0.6, 1.0, front), '#6b4a2e')); // door
    parts.push(paint(box(0.85, 1.6, 0.03, x - 0.6, 1.1, front + 0.04), curtains[i])); // its curtain
    parts.push(paint(box(0.9, 0.8, 0.05, x + 0.8, 1.55, front), '#3e4a52')); // louvre window
    for (let k = 0; k < 4; k++) parts.push(paint(box(0.86, 0.04, 0.07, x + 0.8, 1.24 + k * 0.18, front + 0.03), '#c9c4b8'));
  }
  // A paved front step and a path to the family house's door.
  parts.push(paint(new THREE.PlaneGeometry(8, 2.4).rotateX(-Math.PI / 2).translate((VILLA.u0 + VILLA.u1) / 2, 0.04, VILLA.v1 + 1.2), '#cfc6b4'));
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
  // A bench and two plastic chairs under the mango tree (to the right of the carport).
  parts.push(paint(box(1.8, 0.08, 0.4, 6.2, 0.45, 0.2), '#7a5636'));
  for (const x of [5.5, 6.9]) parts.push(paint(box(0.08, 0.45, 0.35, x, 0.22, 0.2), '#5a3f28'));
  for (const [x, c] of [[5.6, '#f2efe6'], [6.6, '#c8442e']] as const) {
    parts.push(paint(box(0.46, 0.05, 0.44, x, 0.44, 1.6), c));
    parts.push(paint(box(0.46, 0.45, 0.05, x, 0.68, 1.4), c));
  }
  // The carport: Uncle Kwame's parking place, a tin roof on four posts over darker concrete.
  const P = PARKING;
  parts.push(paint(new THREE.PlaneGeometry(3.2, 6).rotateX(-Math.PI / 2).translate(P.u, 0.035, P.v), '#a59f92'));
  for (const [du, dv] of [[-1.85, -2.9], [1.85, -2.9], [-1.85, 2.9], [1.85, 2.9]]) parts.push(paint(box(0.12, 2.5, 0.12, P.u + du, 1.25, P.v + dv), '#4f4b45'));
  parts.push(paint(box(4.0, 0.07, 6.4, P.u, 2.52, P.v, 0.05), '#9aa1a6'));
  // A paved path from the carport to the rooms, and flower pots along it.
  parts.push(paint(new THREE.PlaneGeometry(1.4, D * 2 - 3.4 - 6.4 - 3.2).rotateX(-Math.PI / 2).translate(-0.6, 0.04, (-D + 3.4 + 1.6 + P.v - 3) / 2), '#cfc6b4'));
  const pots = ['#c8442e', '#e3a92b', '#d84a8c', '#f2efe6'];
  for (let i = 0; i < 4; i++) {
    const v = -D + 5.6 + i * 1.3;
    for (const u of [-1.8, 0.6]) {
      parts.push(paint(new THREE.CylinderGeometry(0.22, 0.16, 0.36, 8).translate(u, 0.18, v), '#a5552f'));
      parts.push(paint(new THREE.IcosahedronGeometry(0.28, 0).translate(u, 0.5, v), i % 2 ? '#3f8a3a' : pots[(i + (u > 0 ? 1 : 0)) % 4]));
    }
  }
  // Bougainvillea over the front wall, either side of the gate.
  for (const u of [-W + 2.2, -4.6, 4.6, W - 2.2]) {
    parts.push(paint(new THREE.IcosahedronGeometry(0.55, 0).scale(1.5, 0.55, 0.45).translate(u, 2.25, D - 0.05), '#3f7a3a'));
    for (const [du, dy] of [[-0.45, 0.12], [0.1, 0.22], [0.5, 0.05], [-0.1, -0.1]]) parts.push(paint(new THREE.IcosahedronGeometry(0.13, 0).translate(u + du, 2.3 + dy, D + 0.2), '#d84a8c'));
  }
  // The mango tree.
  parts.push(paint(new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7).translate(TREE.u, 1.3, TREE.v), '#5b4330'));
  const crown = new THREE.IcosahedronGeometry(2.1, 1).translate(TREE.u, 3.6, TREE.v);
  parts.push(paint(crown, '#2f6b35'));
  // The washing line with clothes.
  parts.push(paint(box(0.06, 1.9, 0.06, 10, 0.95, 4), '#6b665e'), paint(box(0.06, 1.9, 0.06, 14, 0.95, 4), '#6b665e'), paint(box(4, 0.02, 0.02, 12, 1.88, 4), '#d9d2c2')); // (on the right, clear of the house's door)
  const cloth = ['#e3a92b', '#2f8f57', '#f2efe6', '#c8442e', '#1f5fa8', '#7a3fb0'];
  for (let i = 0; i < 6; i++) parts.push(paint(box(0.48, 0.6 + (i % 2) * 0.2, 0.02, 10.4 + i * 0.62, 1.55 - (i % 2) * 0.1, 4), cloth[i]));
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
    // Front wall with the doorway (1.2 m, wide enough to walk in side by side) and a window.
    paint(box(doorX - DOOR_HALF + hw, 2.8, 0.12, (-hw + doorX - DOOR_HALF) / 2, 1.4, front - 0.06), '#efe3c8'),
    paint(box(hw - (doorX + DOOR_HALF), 2.8, 0.12, (hw + doorX + DOOR_HALF) / 2, 1.4, front - 0.06), '#efe3c8'),
    paint(box(DOOR_HALF * 2, 0.7, 0.12, doorX, 2.45, front - 0.06), '#efe3c8'), // over the door
    // The dark band along the bottom of the wall, either side of the doorway (never across it).
    paint(box(doorX - DOOR_HALF + hw, 0.7, 0.14, (-hw + doorX - DOOR_HALF) / 2, 0.35, front - 0.06), dado),
    paint(box(hw - (doorX + DOOR_HALF), 0.7, 0.14, (hw + doorX + DOOR_HALF) / 2, 0.35, front - 0.06), dado),
    paint(box(0.08, 2.1, 0.08, doorX - DOOR_HALF, 1.05, front - 0.02), '#6b4a2e'), // door frame
    paint(box(0.08, 2.1, 0.08, doorX + DOOR_HALF, 1.05, front - 0.02), '#6b4a2e'),
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
  return Math.abs(u) < ROOM_W / 2 && v > -D && v < -D + 0.13 + 3.4;
}

/** Solid parts of the compound in its own frame (u across, v towards the gate): walls and rooms. */
export function compoundSolid(u: number, v: number, room: number) {
  const W = COMPOUND.w / 2;
  const D = COMPOUND.d / 2;
  const roomD = 3.4;
  if (Math.abs(u) > W + room || Math.abs(v) > D + room) return false;
  // Uncle's family house.
  if (u > VILLA.u0 - room && u < VILLA.u1 + room && v > VILLA.v0 - room && v < VILLA.v1 + room) return true;
  if (v < -D + roomD + room) {
    // Inside your room, or in its doorway, you can walk; everywhere else along the back is rooms.
    const hw = ROOM_W / 2;
    const inRoom = Math.abs(u) < hw - 0.12 - room && v > -D + 0.25 + room && v < -D + roomD - 0.12 - room;
    // (The doorway overlaps the room's floor, so there is no sliver of wall between them.)
    const inDoor = Math.abs(u + 0.6) < DOOR_HALF - 0.08 - room * 0.5 && v > -D + roomD - 0.9;
    const onBed = u > hw - 1.2 - room && v < -D + 0.13 + 2.2 + room;
    if ((inRoom && !onBed) || inDoor) return false;
    return true;
  }
  if (Math.abs(u) > W - 0.15 - room) return true; // side walls
  if (Math.abs(v - D) < 0.15 + room && Math.abs(u) > 1.4 - room) return true; // front wall (the gate is open)
  if (Math.hypot(u - TREE.u, v - TREE.v) < 0.25 + room) return true; // mango tree
  for (const du of [-1.85, 1.85]) for (const dv of [-2.9, 2.9]) if (Math.hypot(u - PARKING.u - du, v - PARKING.v - dv) < 0.1 + room) return true; // carport posts
  if (Math.hypot(u - (W - 1.3), v - (D - 1.2)) < 0.35 + room) return true; // drum
  return false;
}
